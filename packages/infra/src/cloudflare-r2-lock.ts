import { z } from "zod";

const ageConditionSchema = z.object({
  type: z.literal("Age"),
  maxAgeSeconds: z.number().int().positive(),
});
const dateConditionSchema = z.object({
  type: z.literal("Date"),
  date: z.string().datetime({ offset: true }),
});
const indefiniteConditionSchema = z.object({
  type: z.literal("Indefinite"),
});

export const r2BucketLockRulesSchema = z.object({
  rules: z
    .array(
      z.object({
        id: z.string().min(1),
        enabled: z.boolean(),
        prefix: z.string().default(""),
        condition: z.discriminatedUnion("type", [
          ageConditionSchema,
          dateConditionSchema,
          indefiniteConditionSchema,
        ]),
      }),
    )
    .default([]),
});

export type R2LockProtection = {
  immutable: true;
  mode: "age" | "date" | "indefinite";
  prefix: string;
  retentionSeconds: number | null;
  retainUntil: string | null;
};

const r2ManagedDomainSchema = z.object({
  enabled: z.boolean(),
});
const r2CustomDomainsSchema = z.object({
  domains: z.array(
    z.object({
      enabled: z.boolean(),
    }),
  ),
});

export type R2PrivateAccessReport = {
  private: true;
  managedPublicAccess: false;
  enabledCustomDomains: 0;
};

export function assertR2BucketPrivate(input: {
  managedResult: unknown;
  customResult: unknown;
}): R2PrivateAccessReport {
  const managed = r2ManagedDomainSchema.parse(input.managedResult);
  const custom = r2CustomDomainsSchema.parse(input.customResult);
  const enabledCustomDomains = custom.domains.filter(
    (domain) => domain.enabled,
  ).length;

  if (managed.enabled || enabledCustomDomains > 0) {
    throw new Error(
      "R2 backup bucket has public access enabled; archive operations are disabled until access is reviewed.",
    );
  }

  return {
    private: true,
    managedPublicAccess: false,
    enabledCustomDomains: 0,
  };
}

export function ensureR2BackupLockRule(input: {
  result: unknown;
  objectKey: string;
  retentionDays: number;
  ruleId: string;
}) {
  const parsed = r2BucketLockRulesSchema.parse(input.result);
  try {
    assertR2ObjectLock({
      result: parsed,
      objectKey: input.objectKey,
      minimumRetentionDays: input.retentionDays,
    });
    return { changed: false as const, rules: parsed.rules };
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !/No enabled R2 bucket lock/.test(error.message)
    )
      throw error;
  }

  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/.test(input.ruleId)) {
    throw new Error("R2 bucket lock rule ID is unsafe.");
  }
  if (parsed.rules.some((rule) => rule.id === input.ruleId)) {
    throw new Error(
      "The requested R2 bucket lock rule ID already exists with different protection.",
    );
  }
  return {
    changed: true as const,
    rules: [
      ...parsed.rules,
      {
        id: input.ruleId,
        enabled: true,
        prefix: "d1/",
        condition: {
          type: "Age" as const,
          maxAgeSeconds: input.retentionDays * 86_400,
        },
      },
    ],
  };
}

export function assertR2ObjectLock(input: {
  result: unknown;
  objectKey: string;
  minimumRetentionDays: number;
  now?: Date;
}): R2LockProtection {
  if (
    !Number.isSafeInteger(input.minimumRetentionDays) ||
    input.minimumRetentionDays < 1 ||
    input.minimumRetentionDays > 3650
  ) {
    throw new Error(
      "Minimum retention must be an integer from 1 to 3650 days.",
    );
  }
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._/-]{2,511}$/.test(input.objectKey) ||
    input.objectKey.includes("..") ||
    input.objectKey.includes("//")
  ) {
    throw new Error("R2 archive object key is unsafe.");
  }

  const now = input.now ?? new Date();
  if (Number.isNaN(now.getTime()))
    throw new Error("Lock audit time is invalid.");
  const minimumSeconds = input.minimumRetentionDays * 24 * 60 * 60;
  const candidates = r2BucketLockRulesSchema
    .parse(input.result)
    .rules.filter(
      (rule) => rule.enabled && input.objectKey.startsWith(rule.prefix),
    )
    .flatMap((rule): Array<R2LockProtection & { score: number }> => {
      if (rule.condition.type === "Indefinite") {
        return [
          {
            immutable: true,
            mode: "indefinite",
            prefix: rule.prefix,
            retentionSeconds: null,
            retainUntil: null,
            score: Number.POSITIVE_INFINITY,
          },
        ];
      }
      if (rule.condition.type === "Age") {
        if (rule.condition.maxAgeSeconds < minimumSeconds) return [];
        return [
          {
            immutable: true,
            mode: "age",
            prefix: rule.prefix,
            retentionSeconds: rule.condition.maxAgeSeconds,
            retainUntil: null,
            score: rule.condition.maxAgeSeconds,
          },
        ];
      }

      const remainingSeconds =
        (Date.parse(rule.condition.date) - now.getTime()) / 1000;
      if (
        !Number.isFinite(remainingSeconds) ||
        remainingSeconds < minimumSeconds
      )
        return [];
      return [
        {
          immutable: true,
          mode: "date",
          prefix: rule.prefix,
          retentionSeconds: null,
          retainUntil: new Date(rule.condition.date).toISOString(),
          score: remainingSeconds,
        },
      ];
    })
    .sort((left, right) => right.score - left.score);

  const protection = candidates[0];
  if (!protection) {
    throw new Error(
      `No enabled R2 bucket lock covers the archive object for at least ${input.minimumRetentionDays} days.`,
    );
  }
  const { score: _score, ...report } = protection;
  return report;
}
