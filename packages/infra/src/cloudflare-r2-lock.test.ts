import { describe, expect, test } from "bun:test";

import {
  assertR2BucketPrivate,
  assertR2ObjectLock,
  ensureR2BackupLockRule,
} from "./cloudflare-r2-lock";

const now = new Date("2026-08-14T00:00:00.000Z");
const objectKey = "d1/staging/20260814T000000Z-aabbcc.sql";

describe("Cloudflare R2 backup retention", () => {
  test("accepts covering age, date and indefinite rules", () => {
    expect(
      assertR2ObjectLock({
        result: {
          rules: [
            {
              id: "media-only",
              enabled: true,
              prefix: "media/",
              condition: { type: "Indefinite" },
            },
            {
              id: "backup-90d",
              enabled: true,
              prefix: "d1/",
              condition: { type: "Age", maxAgeSeconds: 90 * 86_400 },
            },
          ],
        },
        objectKey,
        minimumRetentionDays: 90,
        now,
      }),
    ).toMatchObject({
      immutable: true,
      mode: "age",
      prefix: "d1/",
      retentionSeconds: 90 * 86_400,
    });

    expect(
      assertR2ObjectLock({
        result: {
          rules: [
            {
              id: "dated",
              enabled: true,
              prefix: "",
              condition: { type: "Date", date: "2027-01-01T00:00:00.000Z" },
            },
          ],
        },
        objectKey,
        minimumRetentionDays: 90,
        now,
      }).mode,
    ).toBe("date");

    expect(
      assertR2ObjectLock({
        result: {
          rules: [
            {
              id: "forever",
              enabled: true,
              prefix: "d1/staging/",
              condition: { type: "Indefinite" },
            },
          ],
        },
        objectKey,
        minimumRetentionDays: 3650,
        now,
      }).mode,
    ).toBe("indefinite");
  });

  test("rejects disabled, short, unrelated and unsafe rules", () => {
    for (const rules of [
      [],
      [
        {
          id: "disabled",
          enabled: false,
          prefix: "d1/",
          condition: { type: "Indefinite" },
        },
      ],
      [
        {
          id: "short",
          enabled: true,
          prefix: "d1/",
          condition: { type: "Age", maxAgeSeconds: 89 * 86_400 },
        },
      ],
      [
        {
          id: "wrong-prefix",
          enabled: true,
          prefix: "media/",
          condition: { type: "Indefinite" },
        },
      ],
    ]) {
      expect(() =>
        assertR2ObjectLock({
          result: { rules },
          objectKey,
          minimumRetentionDays: 90,
          now,
        }),
      ).toThrow(/No enabled R2 bucket lock/);
    }

    expect(() =>
      assertR2ObjectLock({
        result: { rules: [] },
        objectKey: "d1/../escape.sql",
        minimumRetentionDays: 90,
        now,
      }),
    ).toThrow(/unsafe/);
  });

  test("preserves existing rules when adding backup retention", () => {
    const existing = {
      id: "keep-media",
      enabled: true,
      prefix: "media/",
      condition: { type: "Age" as const, maxAgeSeconds: 86_400 },
    };
    const created = ensureR2BackupLockRule({
      result: { rules: [existing] },
      objectKey,
      retentionDays: 365,
      ruleId: "cms-d1-backups-365d",
    });
    expect(created.changed).toBe(true);
    expect(created.rules).toHaveLength(2);
    expect(created.rules[0]).toEqual(existing);
    expect(created.rules[1]).toMatchObject({
      id: "cms-d1-backups-365d",
      enabled: true,
      prefix: "d1/",
      condition: { type: "Age", maxAgeSeconds: 365 * 86_400 },
    });

    expect(
      ensureR2BackupLockRule({
        result: { rules: created.rules },
        objectKey,
        retentionDays: 365,
        ruleId: "cms-d1-backups-365d",
      }).changed,
    ).toBe(false);
    expect(() =>
      ensureR2BackupLockRule({
        result: {
          rules: [
            {
              ...existing,
              id: "cms-d1-backups-365d",
            },
          ],
        },
        objectKey,
        retentionDays: 365,
        ruleId: "cms-d1-backups-365d",
      }),
    ).toThrow(/already exists/);
  });
});

describe("Cloudflare R2 backup privacy", () => {
  test("accepts disabled managed access with no enabled custom domains", () => {
    expect(
      assertR2BucketPrivate({
        managedResult: {
          bucketId: "rem-viet-backups",
          domain: "example.r2.dev",
          enabled: false,
        },
        customResult: {
          domains: [
            { domain: "old.example.com", enabled: false, status: "inactive" },
          ],
        },
      }),
    ).toEqual({
      private: true,
      managedPublicAccess: false,
      enabledCustomDomains: 0,
    });
  });

  test("rejects managed or custom public access", () => {
    expect(() =>
      assertR2BucketPrivate({
        managedResult: { enabled: true },
        customResult: { domains: [] },
      }),
    ).toThrow(/public access enabled/);
    expect(() =>
      assertR2BucketPrivate({
        managedResult: { enabled: false },
        customResult: { domains: [{ enabled: true }] },
      }),
    ).toThrow(/public access enabled/);
  });

  test("rejects malformed provider responses", () => {
    expect(() =>
      assertR2BucketPrivate({
        managedResult: {},
        customResult: { domains: [] },
      }),
    ).toThrow();
    expect(() =>
      assertR2BucketPrivate({
        managedResult: { enabled: false },
        customResult: {},
      }),
    ).toThrow();
  });
});
