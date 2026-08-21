import { describe, expect, test } from "bun:test";

import {
  cmsReleaseDefinitionSchema,
  cmsRetryPolicySchema,
  cmsWorkflowDefinitionSchema,
} from "../src";

describe("portable jobs and release contracts", () => {
  test("normalizes a bounded retry policy", () => {
    expect(cmsRetryPolicySchema.parse({})).toEqual({
      maxAttempts: 5,
      initialDelayMs: 1_000,
      multiplier: 2,
      maxDelayMs: 60_000,
      jitter: 0.2,
    });
    expect(() =>
      cmsRetryPolicySchema.parse({
        initialDelayMs: 10_000,
        maxDelayMs: 1_000,
      }),
    ).toThrow(/maxDelayMs/);
  });

  test("rejects duplicate workflow steps", () => {
    expect(() =>
      cmsWorkflowDefinitionSchema.parse({
        name: "campaign/publish",
        queue: "content",
        steps: [{ name: "validate" }, { name: "validate" }],
        retry: {},
        timeoutMs: 60_000,
      }),
    ).toThrow(/Duplicate workflow step/);
  });

  test("rejects duplicate documents in a release", () => {
    expect(() =>
      cmsReleaseDefinitionSchema.parse({
        name: "Summer campaign",
        items: [
          {
            documentType: "page",
            documentId: "home",
            locale: "vi",
            expectedVersion: 4,
          },
          {
            documentType: "page",
            documentId: "home",
            locale: "vi",
            expectedVersion: 4,
          },
        ],
      }),
    ).toThrow(/Duplicate release item/);
  });
});
