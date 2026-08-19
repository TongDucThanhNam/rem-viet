import { describe, expect, test } from "bun:test";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");

describe("visual authoring public bundle boundary", () => {
  test("keeps admin and editor-kernel sources outside the public entry graph", async () => {
    const result = await Bun.build({
      entrypoints: [
        join(root, "fixtures", "visual-authoring-public-bundle", "entry.ts"),
      ],
      target: "browser",
      format: "esm",
      minify: true,
      write: false,
      metafile: true,
    });

    expect(result.success).toBe(true);
    const inputs = Object.keys(result.metafile?.inputs ?? {}).join("\n");
    const output = await result.outputs[0]?.text();

    expect(inputs).not.toContain("packages/cms-admin/");
    expect(inputs).not.toContain("packages/cms-visual-editor/");
    expect(output).not.toContain("@agency/cms-visual-editor/preview/v2");
    expect(output).not.toContain("rem-viet-custom");
  });
});
