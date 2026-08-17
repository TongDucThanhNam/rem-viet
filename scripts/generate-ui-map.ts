#!/usr/bin/env bun
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    focus: { type: "string" },
    scope: { type: "string", default: "down" },
    layoutOnly: { type: "boolean", default: false },
    output: { type: "string" },
    src: { type: "string", default: "apps/web/src" },
  },
  strict: true,
});

const root = process.cwd();
const sourceRoot = path.resolve(root, values.src ?? "apps/web/src");
const focus = values.focus;

if (!focus) {
  throw new Error("--focus <ComponentName> is required");
}

type SourceFile = { file: string; source: string; focusIndex?: number };
let entry: SourceFile | undefined;
const glob = new Bun.Glob("**/*.{tsx,jsx}");

for await (const candidate of glob.scan({ cwd: sourceRoot, absolute: true })) {
  const source = await Bun.file(candidate).text();
  const patterns = [
    new RegExp(`(?:export\\s+default\\s+)?function\\s+${focus}\\s*\\(`),
    new RegExp(`(?:export\\s+)?const\\s+${focus}\\s*=`),
  ];
  const found = patterns
    .map((pattern) => source.search(pattern))
    .find((index) => index >= 0);
  if (found !== undefined) {
    entry = { file: candidate, source, focusIndex: found };
    break;
  }
}

if (!entry) {
  throw new Error(
    `Component ${focus} was not found below ${path.relative(root, sourceRoot)}`,
  );
}

function relative(file: string) {
  return path.relative(root, file).replaceAll("\\", "/");
}

function lineAt(source: string, index: number) {
  return source.slice(0, index).split("\n").length;
}

function compact(value: string, limit = 180) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > limit
    ? `${normalized.slice(0, limit - 1)}…`
    : normalized;
}

async function resolveImport(fromFile: string, specifier: string) {
  if (!specifier.startsWith(".") && !specifier.startsWith("@/"))
    return undefined;
  const base = specifier.startsWith("@/")
    ? path.join(sourceRoot, specifier.slice(2))
    : path.resolve(path.dirname(fromFile), specifier);
  for (const candidate of [
    base,
    `${base}.tsx`,
    `${base}.jsx`,
    path.join(base, "index.tsx"),
    path.join(base, "index.jsx"),
  ]) {
    if (await Bun.file(candidate).exists()) return path.resolve(candidate);
  }
  return undefined;
}

async function collectSurface(start: SourceFile) {
  const queue = [start.file];
  const visited = new Set<string>();
  const files: SourceFile[] = [];

  while (queue.length) {
    const file = queue.shift();
    if (!file || visited.has(file)) continue;
    visited.add(file);
    const source =
      file === start.file ? start.source : await Bun.file(file).text();
    files.push({
      file,
      source,
      focusIndex: file === start.file ? start.focusIndex : undefined,
    });

    if (values.scope !== "full") continue;
    const imports = /from\s+["']([^"']+)["']/g;
    for (const item of source.matchAll(imports)) {
      const resolved = await resolveImport(file, item[1]);
      if (resolved && !visited.has(resolved)) queue.push(resolved);
    }
  }

  return files;
}

function componentFunctions(source: string) {
  const names: Array<{ name: string; index: number }> = [];
  const patterns = [
    /(?:export\s+default\s+)?function\s+([A-Z][A-Za-z0-9]*)\s*\(/g,
    /(?:export\s+)?const\s+([A-Z][A-Za-z0-9]*)\s*=\s*(?:\([^)]*\)|[A-Za-z0-9_]+)\s*=>/g,
  ];
  for (const pattern of patterns) {
    for (const item of source.matchAll(pattern)) {
      if (item.index !== undefined)
        names.push({ name: item[1], index: item.index });
    }
  }
  return names.sort((a, b) => a.index - b.index);
}

function semanticNodes(source: string) {
  const nodes: Array<{ label: string; index: number }> = [];
  const tagPattern =
    /<(nav|main|section|header|footer|aside|article|form|details|summary|button|a|input|select|textarea|h1|h2|h3|p|img)\b([^>]*)>/g;
  for (const item of source.matchAll(tagPattern)) {
    if (item.index === undefined) continue;
    const [, tag, rawAttributes] = item;
    const attributes = compact(rawAttributes, 130);
    const id = rawAttributes.match(/\bid=["']([^"']+)["']/)?.[1];
    const href = rawAttributes.match(/\bhref=["']([^"']+)["']/)?.[1];
    const type = rawAttributes.match(/\btype=["']([^"']+)["']/)?.[1];
    const aria = rawAttributes.match(/\baria-label=["']([^"']+)["']/)?.[1];
    const details = [
      id && `id=${id}`,
      href && `href=${href}`,
      type && `type=${type}`,
      aria && `aria-label=${aria}`,
      attributes && `attrs=${attributes}`,
    ]
      .filter(Boolean)
      .join(" | ");
    nodes.push({
      label: `[${tag}]${details ? ` (${details})` : ""}`,
      index: item.index,
    });
  }
  return nodes;
}

function literalInventory(source: string) {
  const literals: Array<{ value: string; index: number }> = [];
  const patterns = [
    />\s*([^<{][^<{]*?)\s*</g,
    /(?:title|label|description|eyebrow|question|answer|text|alt|aria-label|data-cursor)\s*[:=]\s*["'`]([^"'`]+)["'`]/g,
  ];
  for (const pattern of patterns) {
    for (const item of source.matchAll(pattern)) {
      if (item.index === undefined) continue;
      const value = compact(item[1]);
      if (
        value &&
        /[\p{L}\p{N}]/u.test(value) &&
        !value.startsWith("className")
      ) {
        literals.push({ value, index: item.index });
      }
    }
  }
  const seen = new Set<string>();
  return literals
    .sort((a, b) => a.index - b.index)
    .filter(({ value }) => (seen.has(value) ? false : (seen.add(value), true)));
}

const files = await collectSurface(entry);
const entryFile = relative(entry.file);
const lines: string[] = [`[${focus}] ${entryFile} (full route surface)`];

for (const item of files) {
  const file = relative(item.file);
  lines.push(`  [source] ${file}`);
  lines.push("    [component inventory]");
  for (const component of componentFunctions(item.source)) {
    lines.push(
      `      [${component.name}] ${file}:${lineAt(item.source, component.index)}`,
    );
  }
  lines.push("    [semantic hierarchy]");
  for (const node of semanticNodes(item.source)) {
    lines.push(
      `      ${node.label} @ ${file}:${lineAt(item.source, node.index)}`,
    );
  }
  lines.push("    [visible copy and content literals]");
  for (const literal of literalInventory(item.source)) {
    lines.push(
      `      ${JSON.stringify(literal.value)} @ ${file}:${lineAt(item.source, literal.index)}`,
    );
  }
}

const map = `${lines.join("\n")}\n`;
if (values.output) {
  const output = path.resolve(root, values.output);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, map, "utf8");
}
process.stdout.write(map);
