import {
  canonicalizeCmsExtensionValue,
  defineCmsExtensionPackageManifest,
  defineCmsFeatureModuleManifest,
  defineFeatureModule,
} from "@agency/cms-core";
import { defineCmsTask } from "@agency/cms-runtime";

export const cmsCloudflareCacheExtensionManifest =
  defineCmsExtensionPackageManifest({
    schemaVersion: 1,
    id: "official/cache-cloudflare",
    packageName: "@agency/cms-module-cache-cloudflare",
    version: "0.1.0",
    classification: "official",
    cmsCompatibility: { minimum: "0.1.0", maximumExclusive: "1.0.0" },
    permissions: [
      {
        id: "official/cache-cloudflare/purge",
        capability: "settings.manage",
        description: "Purge reviewed same-origin URLs and cache tags.",
      },
    ],
    secrets: [
      {
        name: "CLOUDFLARE_API_TOKEN",
        required: true,
        description:
          "Scoped token with cache-purge access for exactly one zone.",
        exposure: "server-only",
      },
      {
        name: "CLOUDFLARE_ZONE_ID",
        required: true,
        description: "Exact Cloudflare zone receiving cache purges.",
        exposure: "server-only",
      },
    ],
    routes: [
      {
        id: "official/cache-cloudflare/route",
        path: "/api/cms/cache/invalidate",
        methods: ["POST"],
        authorization: "session",
        mutationProtection: "rate-limit-idempotency",
      },
    ],
    admin: [
      {
        id: "official/cache-cloudflare/dashboard",
        slot: "dashboard",
        label: "Cache invalidation",
        requiredCapability: "settings.manage",
      },
    ],
    entrypoints: [
      {
        id: "official/cache-cloudflare/server",
        export: ".",
        runtime: "server",
        capabilities: ["settings.manage"],
      },
    ],
    data: {
      schemaVersion: 1,
      migrations: [
        {
          id: "official/cache-cloudflare/v1",
          from: 0,
          to: 1,
          reversible: false,
        },
      ],
      uninstall: {
        policy: "delete",
        description:
          "Derived purge receipts may be deleted without changing canonical content.",
      },
    },
  });

export const cmsCloudflareCacheModule = defineFeatureModule({
  id: "official-cache-cloudflare",
  manifest: defineCmsFeatureModuleManifest({
    schemaVersion: 1,
    packageName: "@agency/cms-module-cache-cloudflare",
    version: "0.1.0",
    cmsCompatibility: { minimum: "0.1.0", maximumExclusive: "1.0.0" },
    uninstall: {
      dataPolicy: "delete",
      description:
        "Derived purge receipts may be deleted without changing canonical content.",
    },
  }),
  permissions: [
    {
      id: "official-cache-cloudflare/purge",
      capability: "settings.manage",
      operations: ["update"],
      description: "Purge reviewed same-origin URLs and cache tags.",
    },
  ],
  migrations: [
    {
      id: "official-cache-cloudflare/v1",
      from: 0,
      to: 1,
      migrate: (state) => state ?? { receipts: [] },
    },
  ],
  admin: [
    {
      id: "official-cache-cloudflare/dashboard",
      placement: "dashboard",
      label: "Cache invalidation",
    },
  ],
});

export type CmsCacheInvalidationEvent =
  | "content.published"
  | "content.unpublished"
  | "content.restored"
  | "redirect.changed"
  | "media.replaced";

export type CmsCacheInvalidationPayload = Readonly<{
  event: CmsCacheInvalidationEvent;
  paths?: readonly string[];
  tags?: readonly string[];
}>;

export type CmsNormalizedCacheInvalidation = Readonly<{
  event: CmsCacheInvalidationEvent;
  files: readonly string[];
  tags: readonly string[];
}>;

const eventNames = new Set<CmsCacheInvalidationEvent>([
  "content.published",
  "content.unpublished",
  "content.restored",
  "redirect.changed",
  "media.replaced",
]);
const tagPattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;

function exactOrigin(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || value !== url.origin)
    throw new Error("Cache invalidation origin must be an exact HTTPS origin.");
  return url.origin;
}

export function normalizeCmsCacheInvalidation(
  originInput: string,
  input: CmsCacheInvalidationPayload,
): CmsNormalizedCacheInvalidation {
  const origin = exactOrigin(originInput);
  if (!eventNames.has(input.event))
    throw new Error(`Unsupported cache invalidation event: ${input.event}.`);
  if ((input.paths?.length ?? 0) > 1_000 || (input.tags?.length ?? 0) > 1_000)
    throw new Error("Cache invalidation payload exceeds 1000 paths or tags.");
  const files = [...new Set(input.paths ?? [])]
    .map((path) => {
      if (
        !path.startsWith("/") ||
        path.startsWith("//") ||
        path.includes("\\") ||
        /[\u0000-\u001f\u007f]/.test(path)
      ) {
        throw new Error(`Unsafe cache invalidation path: ${path}.`);
      }
      const url = new URL(path, origin);
      if (url.origin !== origin)
        throw new Error(
          "Cache invalidation paths must remain on the configured origin.",
        );
      url.hash = "";
      return url.toString();
    })
    .sort();
  const tags = [...new Set(input.tags ?? [])]
    .map((tag) => tag.trim())
    .map((tag) => {
      if (!tagPattern.test(tag)) throw new Error(`Unsafe cache tag: ${tag}.`);
      return tag;
    })
    .sort();
  if (!files.length && !tags.length)
    throw new Error("Cache invalidation requires at least one path or tag.");
  return Object.freeze({
    event: input.event,
    files: Object.freeze(files),
    tags: Object.freeze(tags),
  });
}

export interface CmsCacheInvalidator {
  purge(
    input: Pick<CmsNormalizedCacheInvalidation, "files" | "tags">,
    context?: { signal?: AbortSignal },
  ): Promise<{
    requests: number;
  }>;
}

function chunks<T>(values: readonly T[], size: number) {
  const output: T[][] = [];
  for (let index = 0; index < values.length; index += size)
    output.push(values.slice(index, index + size));
  return output;
}

export function createCloudflareCacheInvalidator(input: {
  zoneId: string;
  apiToken: string;
  fetch?: typeof globalThis.fetch;
  maximumBatchSize?: number;
}): CmsCacheInvalidator {
  const zoneId = input.zoneId.trim();
  const apiToken = input.apiToken.trim();
  const maximumBatchSize = input.maximumBatchSize ?? 30;
  if (!/^[a-f0-9]{32}$/i.test(zoneId))
    throw new Error(
      "Cloudflare zone id must contain 32 hexadecimal characters.",
    );
  if (apiToken.length < 32 || /\s/.test(apiToken))
    throw new Error("Cloudflare API token is missing or malformed.");
  if (
    !Number.isInteger(maximumBatchSize) ||
    maximumBatchSize < 1 ||
    maximumBatchSize > 30
  )
    throw new Error(
      "Cloudflare cache purge batch size must be between 1 and 30.",
    );
  const request = input.fetch ?? globalThis.fetch;
  const endpoint = `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`;
  const send = async (
    body: { files?: readonly string[]; tags?: readonly string[] },
    signal?: AbortSignal,
  ) => {
    const response = await request(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal,
    });
    const result = (await response.json().catch(() => null)) as {
      success?: boolean;
    } | null;
    if (!response.ok || result?.success !== true)
      throw new Error(
        `Cloudflare cache purge failed with status ${response.status}.`,
      );
  };
  return Object.freeze({
    async purge(
      payload: Pick<CmsNormalizedCacheInvalidation, "files" | "tags">,
      context?: { signal?: AbortSignal },
    ) {
      let requests = 0;
      for (const files of chunks(payload.files, maximumBatchSize)) {
        await send({ files }, context?.signal);
        requests += 1;
      }
      for (const tags of chunks(payload.tags, maximumBatchSize)) {
        await send({ tags }, context?.signal);
        requests += 1;
      }
      return { requests };
    },
  });
}

export interface CmsCacheInvalidationLedger {
  claim(input: {
    idempotencyKey: string;
    payloadSha256: string;
    ownerId: string;
    claimedAt: number;
    leaseMs: number;
  }): Promise<"claimed" | "active" | "completed" | "conflict">;
  complete(input: {
    idempotencyKey: string;
    payloadSha256: string;
    ownerId: string;
  }): Promise<void>;
  release(input: {
    idempotencyKey: string;
    payloadSha256: string;
    ownerId: string;
  }): Promise<void>;
}

export function createMemoryCmsCacheInvalidationLedger(): CmsCacheInvalidationLedger {
  const records = new Map<
    string,
    {
      digest: string;
      status: "active" | "completed";
      ownerId: string;
      leaseExpiresAt: number;
    }
  >();
  return {
    async claim({
      idempotencyKey,
      payloadSha256,
      ownerId,
      claimedAt,
      leaseMs,
    }) {
      const current = records.get(idempotencyKey);
      if (current?.digest !== undefined && current.digest !== payloadSha256)
        return "conflict";
      if (current?.status === "completed") return "completed";
      if (current && current.leaseExpiresAt > claimedAt) return "active";
      records.set(idempotencyKey, {
        digest: payloadSha256,
        status: "active",
        ownerId,
        leaseExpiresAt: claimedAt + leaseMs,
      });
      return "claimed";
    },
    async complete({ idempotencyKey, payloadSha256, ownerId }) {
      const current = records.get(idempotencyKey);
      if (
        !current ||
        current.digest !== payloadSha256 ||
        current.ownerId !== ownerId
      )
        throw new Error("Cache invalidation claim no longer matches.");
      records.set(idempotencyKey, { ...current, status: "completed" });
    },
    async release({ idempotencyKey, payloadSha256, ownerId }) {
      const current = records.get(idempotencyKey);
      if (
        current?.digest === payloadSha256 &&
        current.ownerId === ownerId &&
        current.status === "active"
      )
        records.delete(idempotencyKey);
    },
  };
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function createCmsCacheInvalidationService(input: {
  origin: string;
  invalidator: CmsCacheInvalidator;
  ledger: CmsCacheInvalidationLedger;
  leaseMs?: number;
  now?: () => Date;
  createOwnerId?: () => string;
}) {
  const origin = exactOrigin(input.origin);
  const leaseMs = input.leaseMs ?? 2 * 60_000;
  if (!Number.isInteger(leaseMs) || leaseMs < 1_000 || leaseMs > 15 * 60_000)
    throw new Error(
      "Cache invalidation lease must be between 1 and 15 minutes.",
    );
  const now = input.now ?? (() => new Date());
  const createOwnerId = input.createOwnerId ?? (() => crypto.randomUUID());
  return Object.freeze({
    async execute(
      payload: CmsCacheInvalidationPayload,
      idempotencyKeyInput: string,
      signal?: AbortSignal,
    ) {
      const idempotencyKey = idempotencyKeyInput.trim();
      if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/.test(idempotencyKey))
        throw new Error("Cache invalidation idempotency key is invalid.");
      const normalized = normalizeCmsCacheInvalidation(origin, payload);
      const payloadSha256 = await sha256(
        canonicalizeCmsExtensionValue(normalized),
      );
      const ownerId = createOwnerId();
      const claimInput = {
        idempotencyKey,
        payloadSha256,
        ownerId,
        claimedAt: now().getTime(),
        leaseMs,
      };
      const claim = await input.ledger.claim(claimInput);
      if (claim === "conflict")
        throw new Error(
          "Cache invalidation idempotency key was reused for another payload.",
        );
      if (claim === "active")
        throw new Error(
          "Cache invalidation is already active; retry after its lease.",
        );
      if (claim === "completed")
        return Object.freeze({ duplicate: true, payloadSha256, requests: 0 });
      try {
        const result = await input.invalidator.purge(normalized, { signal });
        await input.ledger.complete({ idempotencyKey, payloadSha256, ownerId });
        return Object.freeze({ duplicate: false, payloadSha256, ...result });
      } catch (error) {
        await input.ledger.release({ idempotencyKey, payloadSha256, ownerId });
        throw error;
      }
    },
  });
}

function parseTaskPayload(value: unknown): CmsCacheInvalidationPayload {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Cache invalidation task payload must be an object.");
  const input = value as Record<string, unknown>;
  if (!eventNames.has(input.event as CmsCacheInvalidationEvent))
    throw new Error("Cache invalidation task event is invalid.");
  for (const key of ["paths", "tags"] as const) {
    if (
      input[key] !== undefined &&
      (!Array.isArray(input[key]) ||
        input[key].some((item) => typeof item !== "string"))
    ) {
      throw new Error(`Cache invalidation task ${key} must be a string array.`);
    }
  }
  return Object.freeze({
    event: input.event as CmsCacheInvalidationEvent,
    ...(input.paths === undefined
      ? {}
      : { paths: Object.freeze(input.paths as string[]) }),
    ...(input.tags === undefined
      ? {}
      : { tags: Object.freeze(input.tags as string[]) }),
  });
}

export function createCmsCloudflareCacheInvalidationTask(input: {
  service: ReturnType<typeof createCmsCacheInvalidationService>;
}) {
  return defineCmsTask({
    definition: {
      name: "official-cache-cloudflare/purge",
      queue: "cms-cache",
      timeoutMs: 60_000,
      retry: {
        maxAttempts: 8,
        initialDelayMs: 1_000,
        multiplier: 2,
        maxDelayMs: 5 * 60_000,
        jitter: 0.2,
      },
      retentionDays: 30,
    },
    parsePayload: parseTaskPayload,
    execute(payload, context) {
      return input.service.execute(
        payload,
        context.idempotencyKey,
        context.signal,
      );
    },
  });
}
