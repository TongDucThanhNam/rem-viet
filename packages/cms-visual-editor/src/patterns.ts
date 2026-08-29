import {
  applyCmsVisualCommand,
  type CmsVisualInsertLocation,
} from "./commands.js";
import type {
  CmsVisualComponentRegistry,
  CmsVisualDocument,
  CmsVisualNode,
} from "./registry.js";
import { assertCmsVisualPatternNodeBounds } from "./pattern-limits.js";

export const CMS_VISUAL_PATTERN_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export type CmsVisualPatternContext = Readonly<{
  createId: (nodeType: string) => string;
}>;

export type CmsVisualPatternDefinition = Readonly<{
  id: string;
  label: string;
  description: string;
  category: string;
  keywords?: readonly string[];
  createNodes: (context: CmsVisualPatternContext) => readonly CmsVisualNode[];
}>;

export type CmsVisualPatternRegistry = Readonly<{
  patterns: readonly CmsVisualPatternDefinition[];
  get(id: string): CmsVisualPatternDefinition | undefined;
  require(id: string): CmsVisualPatternDefinition;
}>;

function assertPatternText(
  value: string,
  label: string,
  maxLength: number,
): string {
  const normalized = value.normalize("NFC").trim();
  if (!normalized || [...normalized].length > maxLength) {
    throw new Error(
      `Visual pattern ${label} must contain 1-${maxLength} characters.`,
    );
  }
  return normalized;
}

export function defineCmsVisualPattern(
  input: CmsVisualPatternDefinition,
): CmsVisualPatternDefinition {
  if (!CMS_VISUAL_PATTERN_ID_PATTERN.test(input.id) || input.id.length > 64) {
    throw new Error(`Visual pattern id is invalid: ${input.id}`);
  }
  const keywords = input.keywords ?? [];
  if (keywords.length > 16) {
    throw new Error(`Visual pattern ${input.id} has too many keywords.`);
  }
  const normalizedKeywords = keywords.map((keyword) =>
    assertPatternText(keyword, "keyword", 48),
  );
  if (new Set(normalizedKeywords).size !== normalizedKeywords.length) {
    throw new Error(`Visual pattern ${input.id} has duplicate keywords.`);
  }
  return Object.freeze({
    ...input,
    label: assertPatternText(input.label, "label", 80),
    description: assertPatternText(input.description, "description", 240),
    category: assertPatternText(input.category, "category", 64),
    keywords: Object.freeze(normalizedKeywords),
  });
}

export function createCmsVisualPatternRegistry(
  inputs: readonly CmsVisualPatternDefinition[],
): CmsVisualPatternRegistry {
  const byId = new Map<string, CmsVisualPatternDefinition>();
  for (const input of inputs) {
    const pattern = defineCmsVisualPattern(input);
    if (byId.has(pattern.id)) {
      throw new Error(`Duplicate visual pattern id: ${pattern.id}`);
    }
    byId.set(pattern.id, pattern);
  }
  const patterns = Object.freeze([...byId.values()]);
  return Object.freeze({
    patterns,
    get: (id: string) => byId.get(id),
    require: (id: string) => {
      const pattern = byId.get(id);
      if (!pattern) throw new Error(`Unknown visual pattern: ${id}`);
      return pattern;
    },
  });
}

const normalizeSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[đĐ]/gu, "d")
    .toLocaleLowerCase("vi")
    .trim();

export function filterCmsVisualPatterns(
  patterns: readonly CmsVisualPatternDefinition[],
  query: string,
): readonly CmsVisualPatternDefinition[] {
  const terms = normalizeSearch(query).split(/\s+/u).filter(Boolean);
  if (terms.length === 0) return patterns;
  return patterns.filter((pattern) => {
    const searchable = normalizeSearch(
      [
        pattern.id,
        pattern.label,
        pattern.description,
        pattern.category,
        ...(pattern.keywords ?? []),
      ].join(" "),
    );
    return terms.every((term) => searchable.includes(term));
  });
}

export function instantiateCmsVisualPattern(input: {
  patterns: CmsVisualPatternRegistry;
  patternId: string;
  createId: CmsVisualPatternContext["createId"];
}): readonly CmsVisualNode[] {
  const nodes = input.patterns
    .require(input.patternId)
    .createNodes({ createId: input.createId });
  assertCmsVisualPatternNodeBounds(nodes, `Visual pattern ${input.patternId}`);
  return Object.freeze([...nodes]);
}

export function applyCmsVisualPattern(input: {
  document: CmsVisualDocument;
  registry: CmsVisualComponentRegistry;
  patterns: CmsVisualPatternRegistry;
  patternId: string;
  location: CmsVisualInsertLocation;
  createId: CmsVisualPatternContext["createId"];
  grants: ReadonlySet<string>;
}): CmsVisualDocument {
  const nodes = instantiateCmsVisualPattern(input);
  return applyCmsVisualCommand({
    document: input.document,
    registry: input.registry,
    grants: input.grants,
    command: { type: "insert-pattern", location: input.location, nodes },
  });
}
