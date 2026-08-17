import { describe, expect, test } from "bun:test";

import { readSanityWebhookEnvironment } from "./sanity-webhook-config";

describe("Sanity webhook environment", () => {
  test("stays disabled until its dedicated secret is configured", () => {
    expect(
      readSanityWebhookEnvironment({
        SANITY_PROJECT_ID: "project-test",
        SANITY_DATASET: "staging",
      }),
    ).toBeNull();
  });

  test("fails closed for partial or weak webhook configuration", () => {
    expect(() =>
      readSanityWebhookEnvironment({
        SANITY_WEBHOOK_SECRET: "webhook-secret-with-at-least-32-characters",
      }),
    ).toThrow(/missing SANITY_PROJECT_ID, SANITY_DATASET/i);
    expect(() =>
      readSanityWebhookEnvironment({
        SANITY_PROJECT_ID: "project-test",
        SANITY_DATASET: "staging",
        SANITY_WEBHOOK_SECRET: "weak",
      }),
    ).toThrow(/32 to 512 characters/i);
  });

  test("accepts an isolated server-only webhook scope", () => {
    expect(
      readSanityWebhookEnvironment({
        SANITY_PROJECT_ID: "project-test",
        SANITY_DATASET: "staging",
        SANITY_WEBHOOK_SECRET: "webhook-secret-with-at-least-32-characters",
      }),
    ).toEqual({
      projectId: "project-test",
      dataset: "staging",
      secret: "webhook-secret-with-at-least-32-characters",
    });
  });
});
