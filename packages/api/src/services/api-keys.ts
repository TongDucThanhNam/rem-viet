import {
  cmsCapabilitySchema,
  type CmsCapability,
  type StaffRole,
} from "@rem-viet/cms";
import { createDb } from "@rem-viet/db";
import {
  auditEvents,
  cmsApiKeys,
  serviceAccounts,
} from "@rem-viet/db/schema/governance";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import type { GovernanceActor } from "./governance";

const keyPrefix = "cmsk";
const maximumLifetimeMs = 366 * 24 * 60 * 60 * 1000;
const allowedServiceScopes = cmsCapabilitySchema.options.filter(
  (capability) => capability !== "staff.manage",
);

export const apiKeyScopeSchema = z
  .array(cmsCapabilitySchema)
  .min(1)
  .max(allowedServiceScopes.length)
  .transform((scopes) => [...new Set(scopes)].sort())
  .refine((scopes) => !scopes.includes("staff.manage"), {
    message: "Service accounts cannot receive staff.manage",
  });

const futureExpirySchema = z.coerce.date().superRefine((value, context) => {
  const remaining = value.getTime() - Date.now();
  if (remaining <= 0) {
    context.addIssue({
      code: "custom",
      message: "Expiry must be in the future",
    });
  }
  if (remaining > maximumLifetimeMs) {
    context.addIssue({
      code: "custom",
      message: "API keys can be issued for at most 366 days",
    });
  }
});

export const createServiceAccountInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).default(""),
  keyLabel: z.string().trim().min(2).max(120),
  scopes: apiKeyScopeSchema,
  expiresAt: futureExpirySchema,
});

export const rotateApiKeyInputSchema = z.object({
  keyId: z.string().trim().min(1),
  scopes: apiKeyScopeSchema.optional(),
  expiresAt: futureExpirySchema,
});

export const apiKeyIdInputSchema = z.object({
  keyId: z.string().trim().min(1),
});

export const serviceAccountIdInputSchema = z.object({
  serviceAccountId: z.string().trim().min(1),
});

export type CmsApiKeyPrincipal = Readonly<{
  apiKeyId: string;
  serviceAccountId: string;
  serviceAccountName: string;
  capabilities: readonly CmsCapability[];
}>;

export type CmsApiKeyRuntime = Readonly<{
  db?: ReturnType<typeof createDb>;
}>;

function runtimeDb(runtime?: CmsApiKeyRuntime) {
  return runtime?.db ?? createDb();
}

function randomHex(byteLength: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export function parseCmsApiKeyToken(token: string) {
  const match = /^cmsk_([a-f0-9]{16})_([a-f0-9]{64})$/.exec(token);
  return match ? { publicId: match[1]!, secret: match[2]! } : null;
}

export async function hashCmsApiKeyToken(token: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function constantTimeEqual(left: string, right: string) {
  const length = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}

async function createKeyMaterial() {
  const publicId = randomHex(8);
  const secret = randomHex(32);
  const rawKey = `${keyPrefix}_${publicId}_${secret}`;
  return {
    publicId,
    rawKey,
    secretHash: await hashCmsApiKeyToken(rawKey),
  };
}

function lifecycleAudit(input: {
  action: string;
  actor: GovernanceActor;
  entityId: string;
  before?: unknown;
  after?: unknown;
}) {
  return {
    id: crypto.randomUUID(),
    actorUserId: input.actor.userId,
    actorEmail: input.actor.email,
    actorRole: input.actor.role,
    action: input.action,
    entityType: "service_account",
    entityId: input.entityId,
    before: input.before ?? null,
    after: input.after ?? null,
    requestId: input.actor.requestId,
    createdAt: new Date(),
  } satisfies typeof auditEvents.$inferInsert;
}

function publicKeyMetadata(key: typeof cmsApiKeys.$inferSelect) {
  const scopes = apiKeyScopeSchema.safeParse(key.scopes);
  return {
    id: key.id,
    label: key.label,
    publicId: key.publicId,
    scopes: scopes.success ? scopes.data : [],
    expiresAt: key.expiresAt,
    lastUsedAt: key.lastUsedAt,
    createdAt: key.createdAt,
    revokedAt: key.revokedAt,
    rotatedFromKeyId: key.rotatedFromKeyId,
  };
}

export async function listServiceAccounts(runtime?: CmsApiKeyRuntime) {
  const db = runtimeDb(runtime);
  const [accounts, keys] = await Promise.all([
    db.select().from(serviceAccounts).orderBy(desc(serviceAccounts.createdAt)),
    db.select().from(cmsApiKeys).orderBy(desc(cmsApiKeys.createdAt)),
  ]);
  return accounts.map((account) => ({
    ...account,
    keys: keys
      .filter((key) => key.serviceAccountId === account.id)
      .map(publicKeyMetadata),
  }));
}

export async function createServiceAccountWithKey(
  input: z.infer<typeof createServiceAccountInputSchema>,
  actor: GovernanceActor,
  runtime?: CmsApiKeyRuntime,
) {
  const db = runtimeDb(runtime);
  const serviceAccountId = crypto.randomUUID();
  const keyId = crypto.randomUUID();
  const now = new Date();
  const material = await createKeyMaterial();
  await db.batch([
    db.insert(serviceAccounts).values({
      id: serviceAccountId,
      name: input.name,
      description: input.description,
      createdBy: actor.userId,
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(cmsApiKeys).values({
      id: keyId,
      serviceAccountId,
      label: input.keyLabel,
      publicId: material.publicId,
      secretHash: material.secretHash,
      scopes: input.scopes,
      expiresAt: input.expiresAt,
      createdBy: actor.userId,
      createdAt: now,
    }),
    db.insert(auditEvents).values(
      lifecycleAudit({
        action: "service_account.create",
        actor,
        entityId: serviceAccountId,
        after: {
          name: input.name,
          keyId,
          keyLabel: input.keyLabel,
          publicId: material.publicId,
          scopes: input.scopes,
          expiresAt: input.expiresAt,
        },
      }),
    ),
  ]);
  return {
    serviceAccount: {
      id: serviceAccountId,
      name: input.name,
      description: input.description,
    },
    key: {
      id: keyId,
      label: input.keyLabel,
      publicId: material.publicId,
      scopes: input.scopes,
      expiresAt: input.expiresAt,
    },
    rawKey: material.rawKey,
  };
}

export async function rotateApiKey(
  input: z.infer<typeof rotateApiKeyInputSchema>,
  actor: GovernanceActor,
  runtime?: CmsApiKeyRuntime,
) {
  const db = runtimeDb(runtime);
  const [existing] = await db
    .select()
    .from(cmsApiKeys)
    .innerJoin(
      serviceAccounts,
      eq(cmsApiKeys.serviceAccountId, serviceAccounts.id),
    )
    .where(
      and(
        eq(cmsApiKeys.id, input.keyId),
        isNull(cmsApiKeys.revokedAt),
        isNull(serviceAccounts.revokedAt),
      ),
    )
    .limit(1);
  if (!existing) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "API key is missing, revoked, or belongs to a revoked account",
    });
  }
  const oldScopes = apiKeyScopeSchema.safeParse(existing.cms_api_keys.scopes);
  if (!oldScopes.success) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Invalid stored API key scopes",
    });
  }
  const scopes = input.scopes ?? oldScopes.data;
  const material = await createKeyMaterial();
  const keyId = crypto.randomUUID();
  const now = new Date();
  await db.batch([
    db
      .update(cmsApiKeys)
      .set({ revokedAt: now })
      .where(and(eq(cmsApiKeys.id, input.keyId), isNull(cmsApiKeys.revokedAt))),
    db.insert(cmsApiKeys).values({
      id: keyId,
      serviceAccountId: existing.cms_api_keys.serviceAccountId,
      label: existing.cms_api_keys.label,
      publicId: material.publicId,
      secretHash: material.secretHash,
      scopes,
      expiresAt: input.expiresAt,
      createdBy: actor.userId,
      createdAt: now,
      rotatedFromKeyId: existing.cms_api_keys.id,
    }),
    db.insert(auditEvents).values(
      lifecycleAudit({
        action: "service_account.key_rotate",
        actor,
        entityId: existing.cms_api_keys.serviceAccountId,
        before: {
          keyId: existing.cms_api_keys.id,
          publicId: existing.cms_api_keys.publicId,
        },
        after: {
          keyId,
          publicId: material.publicId,
          scopes,
          expiresAt: input.expiresAt,
        },
      }),
    ),
  ]);
  return {
    key: {
      id: keyId,
      label: existing.cms_api_keys.label,
      publicId: material.publicId,
      scopes,
      expiresAt: input.expiresAt,
      rotatedFromKeyId: existing.cms_api_keys.id,
    },
    rawKey: material.rawKey,
  };
}

export async function revokeApiKey(
  input: z.infer<typeof apiKeyIdInputSchema>,
  actor: GovernanceActor,
  runtime?: CmsApiKeyRuntime,
) {
  const db = runtimeDb(runtime);
  const key = await db.query.cmsApiKeys.findFirst({
    where: and(eq(cmsApiKeys.id, input.keyId), isNull(cmsApiKeys.revokedAt)),
  });
  if (!key)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Active API key not found",
    });
  const now = new Date();
  await db.batch([
    db
      .update(cmsApiKeys)
      .set({ revokedAt: now })
      .where(eq(cmsApiKeys.id, key.id)),
    db.insert(auditEvents).values(
      lifecycleAudit({
        action: "service_account.key_revoke",
        actor,
        entityId: key.serviceAccountId,
        before: { keyId: key.id, publicId: key.publicId },
      }),
    ),
  ]);
  return { revoked: true as const };
}

export async function revokeServiceAccount(
  input: z.infer<typeof serviceAccountIdInputSchema>,
  actor: GovernanceActor,
  runtime?: CmsApiKeyRuntime,
) {
  const db = runtimeDb(runtime);
  const account = await db.query.serviceAccounts.findFirst({
    where: and(
      eq(serviceAccounts.id, input.serviceAccountId),
      isNull(serviceAccounts.revokedAt),
    ),
  });
  if (!account)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Active service account not found",
    });
  const now = new Date();
  await db.batch([
    db
      .update(serviceAccounts)
      .set({ revokedAt: now })
      .where(eq(serviceAccounts.id, account.id)),
    db
      .update(cmsApiKeys)
      .set({ revokedAt: now })
      .where(
        and(
          eq(cmsApiKeys.serviceAccountId, account.id),
          isNull(cmsApiKeys.revokedAt),
        ),
      ),
    db.insert(auditEvents).values(
      lifecycleAudit({
        action: "service_account.revoke",
        actor,
        entityId: account.id,
        before: { name: account.name },
      }),
    ),
  ]);
  return { revoked: true as const };
}

export async function authenticateCmsApiKey(
  authorization: string | null,
  runtime?: CmsApiKeyRuntime,
): Promise<CmsApiKeyPrincipal | null> {
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  const parsed = parseCmsApiKeyToken(token);
  if (!parsed) return null;
  const db = runtimeDb(runtime);
  const [match] = await db
    .select()
    .from(cmsApiKeys)
    .innerJoin(
      serviceAccounts,
      eq(cmsApiKeys.serviceAccountId, serviceAccounts.id),
    )
    .where(eq(cmsApiKeys.publicId, parsed.publicId))
    .limit(1);
  if (
    !match ||
    match.cms_api_keys.revokedAt ||
    match.service_accounts.revokedAt ||
    match.cms_api_keys.expiresAt.getTime() <= Date.now()
  ) {
    return null;
  }
  const suppliedHash = await hashCmsApiKeyToken(token);
  if (!constantTimeEqual(suppliedHash, match.cms_api_keys.secretHash)) {
    return null;
  }
  const scopes = apiKeyScopeSchema.safeParse(match.cms_api_keys.scopes);
  if (!scopes.success) return null;
  await db
    .update(cmsApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(cmsApiKeys.id, match.cms_api_keys.id));
  return {
    apiKeyId: match.cms_api_keys.id,
    serviceAccountId: match.service_accounts.id,
    serviceAccountName: match.service_accounts.name,
    capabilities: scopes.data,
  };
}

export const apiKeyPermissionMatrix = {
  available: allowedServiceScopes,
  forbidden: ["staff.manage"] as const,
} satisfies Readonly<{
  available: readonly CmsCapability[];
  forbidden: readonly CmsCapability[];
}>;

export type CmsRequestActor = Readonly<{
  userId: string;
  email: string;
  role: StaffRole | "system";
  requestId?: string;
}>;
