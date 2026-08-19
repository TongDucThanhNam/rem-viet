import { describe, expect, test } from "bun:test";

import { createPreviewSessionBinding } from "./preview-session-binding.server";

describe("visual preview authenticated session binding", () => {
  test("is deterministic, opaque, and scoped to one authenticated session", async () => {
    const first = await createPreviewSessionBinding("session-alpha-1234");
    const repeated = await createPreviewSessionBinding("session-alpha-1234");
    const other = await createPreviewSessionBinding("session-beta-5678");

    expect(first).toBe(repeated);
    expect(first).not.toBe(other);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toContain("session-alpha-1234");
  });
});
