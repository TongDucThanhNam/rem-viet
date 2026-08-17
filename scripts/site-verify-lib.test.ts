import { describe, expect, test } from "bun:test";

import { verifySite } from "./site-verify-lib";

describe("callable site verification", () => {
  test("verifies the isolated Acme consumer manifest", async () => {
    const result = await verifySite("acme-demo");

    expect(result.ok).toBe(true);
    expect(result.site).toBe("acme-demo");
    expect(result.checks.envTemplate).toBe("strict");
    expect(result.checks.resourceNames).toBe("unique");
  });

  test("rejects an empty site before reading files", async () => {
    await expect(verifySite("")).rejects.toThrow("--site");
  });
});
