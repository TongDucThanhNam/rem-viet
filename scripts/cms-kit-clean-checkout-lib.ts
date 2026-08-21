import { isAbsolute } from "node:path";

const forbiddenSnapshotSegments = new Set([".git", ".tmp", "node_modules"]);

export function parseCleanSnapshotFileList(output: string) {
  const files = output
    .split("\0")
    .filter(Boolean)
    .map((path) => path.replaceAll("\\", "/"));
  if (!files.length)
    throw new Error("Clean snapshot source file list is empty.");
  const unique = new Set<string>();
  for (const path of files) {
    const segments = path.split("/");
    if (
      isAbsolute(path) ||
      /^[a-z]:/i.test(path) ||
      path.includes("\0") ||
      segments.some(
        (segment) =>
          !segment ||
          segment === "." ||
          segment === ".." ||
          segment.includes(":"),
      ) ||
      segments.some((segment) => forbiddenSnapshotSegments.has(segment))
    ) {
      throw new Error(`Unsafe clean snapshot source path: ${path}`);
    }
    if (unique.has(path)) {
      throw new Error(`Duplicate clean snapshot source path: ${path}`);
    }
    unique.add(path);
  }
  return [...unique].sort((left, right) => left.localeCompare(right));
}

export function assertCleanSnapshotStatus(status: string, phase: string) {
  const paths = status
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (paths.length) {
    throw new Error(
      `Clean snapshot became dirty during ${phase}: ${paths.slice(0, 8).join(", ")}`,
    );
  }
}

export function requireSingleRunDirectory(
  entries: readonly string[],
  prefix: string,
) {
  const matches = entries.filter((entry) => entry.startsWith(prefix));
  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one ${prefix} run directory, found ${matches.length}.`,
    );
  }
  return matches[0]!;
}
