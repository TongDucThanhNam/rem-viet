import { describe, expect, test } from "bun:test";

import {
  assertCleanSnapshotStatus,
  parseCleanSnapshotFileList,
  requireSingleRunDirectory,
} from "./cms-kit-clean-checkout-lib";

describe("CMS Kit clean checkout verifier", () => {
  test("accepts a deterministic non-ignored source list", () => {
    expect(
      parseCleanSnapshotFileList(
        "packages/cms-core/src/index.ts\0package.json\0.github/workflows/cms.yml\0",
      ),
    ).toEqual([
      ".github/workflows/cms.yml",
      "package.json",
      "packages/cms-core/src/index.ts",
    ]);
  });

  test("rejects traversal, generated directories, platform-unsafe paths, and duplicates", () => {
    for (const path of [
      "../secret",
      "/absolute",
      "C:/absolute",
      ".git/config",
      ".tmp/evidence.json",
      "packages/cms-core/node_modules/zod/index.js",
      "unsafe:name.ts",
    ]) {
      expect(() => parseCleanSnapshotFileList(`${path}\0`)).toThrow(
        "Unsafe clean snapshot source path",
      );
    }
    expect(() =>
      parseCleanSnapshotFileList("package.json\0package.json\0"),
    ).toThrow("Duplicate clean snapshot source path");
  });

  test("fails closed for source drift and ambiguous operation output", () => {
    expect(() => assertCleanSnapshotStatus("", "install")).not.toThrow();
    expect(() =>
      assertCleanSnapshotStatus(" M bun.lock\n?? output.json", "install"),
    ).toThrow("Clean snapshot became dirty during install");
    expect(
      requireSingleRunDirectory(
        ["cms-kit-consumer-1", "cms-kit-upgrade-1"],
        "cms-kit-consumer-",
      ),
    ).toBe("cms-kit-consumer-1");
    expect(() =>
      requireSingleRunDirectory(
        ["cms-kit-upgrade-1", "cms-kit-upgrade-2"],
        "cms-kit-upgrade-",
      ),
    ).toThrow("found 2");
  });
});
