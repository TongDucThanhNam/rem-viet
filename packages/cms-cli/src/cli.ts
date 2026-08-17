#!/usr/bin/env bun

import { lstatSync, realpathSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { normalizeCmsCliRelativePath } from "./index";
import { runCmsCli } from "./command";

const root = realpathSync(process.cwd());

try {
  await runCmsCli(process.argv.slice(2), {
    read: async (path) => {
      const target = targetPath(path);
      try {
        return await readFile(target, "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
    write: async (path, content) => {
      const target = targetPath(path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content, { flag: "wx" });
    },
    importTemplateInitializer: async (specifier) =>
      import(templateModuleUrl(specifier)),
    importMigrationDriver: async (path) =>
      import(pathToFileURL(targetPath(path)).href),
    environment: process.env,
    output: (value) => console.log(value),
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : "CMS CLI failed.");
  process.exitCode = 1;
}

function templateModuleUrl(specifier: string) {
  if (specifier.startsWith("./")) {
    return pathToFileURL(targetPath(specifier.slice(2))).href;
  }
  if (
    !/^(?:@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*|[a-z0-9][a-z0-9._-]*)(?:\/[a-z0-9][a-z0-9._-]*)*$/i.test(
      specifier,
    )
  ) {
    throw new Error(
      "Template must be a safe installed package specifier or ./relative module.",
    );
  }
  return specifier;
}

function targetPath(path: string) {
  const normalized = normalizeCmsCliRelativePath(path);
  let cursor = root;
  for (const part of normalized.split("/")) {
    cursor = resolve(cursor, part);
    try {
      if (lstatSync(cursor).isSymbolicLink()) {
        throw new Error(
          `CMS CLI paths cannot traverse symlinks: ${normalized}.`,
        );
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") break;
      throw error;
    }
  }
  return resolve(root, normalized);
}
