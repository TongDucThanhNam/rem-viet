import {
  defineCmsExtensionPackageManifest,
  defineCmsFeatureModuleManifest,
  defineFeatureModule,
} from "@agency/cms-core";
import {
  defineCmsTask,
  type CmsTaskExecutionContext,
} from "@agency/cms-runtime";

export const cmsSearchExtensionManifest = defineCmsExtensionPackageManifest({
  schemaVersion: 1,
  id: "official/search",
  packageName: "@agency/cms-module-search",
  version: "0.1.0",
  classification: "official",
  cmsCompatibility: { minimum: "0.1.0", maximumExclusive: "1.0.0" },
  permissions: [
    {
      id: "official/search/reindex",
      capability: "settings.manage",
      description: "Rebuild the derived search index from canonical content.",
    },
  ],
  secrets: [],
  routes: [],
  admin: [
    {
      id: "official/search/dashboard",
      slot: "dashboard",
      label: "Search index",
      requiredCapability: "settings.manage",
    },
  ],
  entrypoints: [
    {
      id: "official/search/server",
      export: ".",
      runtime: "server",
      capabilities: ["settings.manage"],
    },
  ],
  data: {
    schemaVersion: 1,
    migrations: [
      { id: "official/search/v1", from: 0, to: 1, reversible: false },
    ],
    uninstall: {
      policy: "delete",
      description:
        "Derived search indexes may be deleted and rebuilt from canonical content.",
    },
  },
});

export const cmsSearchModule = defineFeatureModule({
  id: "official-search",
  manifest: defineCmsFeatureModuleManifest({
    schemaVersion: 1,
    packageName: "@agency/cms-module-search",
    version: "0.1.0",
    cmsCompatibility: { minimum: "0.1.0", maximumExclusive: "1.0.0" },
    uninstall: {
      dataPolicy: "delete",
      description:
        "Derived search indexes may be deleted and rebuilt from canonical content.",
    },
  }),
  permissions: [
    {
      id: "official-search/reindex",
      capability: "settings.manage",
      operations: ["update"],
      description: "Rebuild the derived search index from canonical content.",
    },
  ],
  migrations: [
    {
      id: "official-search/v1",
      from: 0,
      to: 1,
      migrate: (state) => state ?? {},
    },
  ],
  admin: [
    {
      id: "official-search/dashboard",
      placement: "dashboard",
      label: "Search index",
    },
  ],
});

export type CmsSearchScalar = string | number | boolean;

export type CmsSearchDocument = Readonly<{
  id: string;
  collection: string;
  locale: string | null;
  title: string;
  body: string;
  path: string;
  facets?: Readonly<
    Record<string, CmsSearchScalar | readonly CmsSearchScalar[]>
  >;
  updatedAt?: string;
}>;

export type CmsSearchQuery = Readonly<{
  query: string;
  filters?: Readonly<
    Record<string, CmsSearchScalar | readonly CmsSearchScalar[]>
  >;
  facets?: readonly string[];
  limit?: number;
  offset?: number;
}>;

export type CmsSearchHit = Readonly<{
  document: CmsSearchDocument;
  score: number;
  highlights: readonly string[];
}>;

export type CmsSearchResult = Readonly<{
  hits: readonly CmsSearchHit[];
  total: number;
  facets: Readonly<Record<string, Readonly<Record<string, number>>>>;
}>;

export interface CmsSearchIndexProvider {
  replaceAll(
    documents: readonly CmsSearchDocument[],
    context: {
      idempotencyKey: string;
      signal: AbortSignal;
    },
  ): Promise<{ indexed: number }>;
  upsert(document: CmsSearchDocument): Promise<void>;
  delete(
    id: string,
    collection: string,
    locale: string | null,
  ): Promise<boolean>;
  search(query: CmsSearchQuery): Promise<CmsSearchResult>;
}

const identityPattern = /^[a-z0-9][a-z0-9._/-]{0,127}$/i;

function assertIdentity(value: string, label: string) {
  const normalized = value.trim();
  if (!identityPattern.test(normalized))
    throw new Error(`Invalid search ${label}: ${value}`);
  return normalized;
}

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function tokenize(value: string) {
  return [
    ...new Set(
      normalizeText(value)
        .split(/\s+/)
        .filter((token) => token.length > 1),
    ),
  ];
}

function normalizeFacetValue(value: CmsSearchScalar) {
  if (typeof value === "string") return value.trim();
  return String(value);
}

export function normalizeCmsSearchDocument(
  input: CmsSearchDocument,
): CmsSearchDocument {
  const title = input.title.trim();
  const path = input.path.trim();
  if (!title || title.length > 500)
    throw new Error("Search document title must contain 1-500 characters.");
  if (input.body.length > 1_000_000)
    throw new Error("Search document body exceeds 1 MB.");
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    throw new Error("Search document path must be origin-relative.");
  }
  if (input.updatedAt && !Number.isFinite(Date.parse(input.updatedAt))) {
    throw new Error(
      "Search document updatedAt must be an ISO-compatible date.",
    );
  }
  const facets = Object.fromEntries(
    Object.entries(input.facets ?? {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => {
        assertIdentity(key, "facet name");
        const values = Array.isArray(value) ? value : [value];
        if (values.length > 100)
          throw new Error(`Search facet ${key} contains too many values.`);
        return [key, Object.freeze(values.map(normalizeFacetValue))];
      }),
  );
  return Object.freeze({
    id: assertIdentity(input.id, "document id"),
    collection: assertIdentity(input.collection, "collection"),
    locale:
      input.locale === null ? null : assertIdentity(input.locale, "locale"),
    title,
    body: input.body.trim(),
    path,
    facets: Object.freeze(facets),
    ...(input.updatedAt
      ? { updatedAt: new Date(input.updatedAt).toISOString() }
      : {}),
  });
}

function documentKey(
  document: Pick<CmsSearchDocument, "id" | "collection" | "locale">,
) {
  return `${document.collection}\u0000${document.id}\u0000${document.locale ?? ""}`;
}

function normalizeQuery(input: CmsSearchQuery) {
  if (input.query.length > 500)
    throw new Error("Search query exceeds 500 characters.");
  const limit = input.limit ?? 20;
  const offset = input.offset ?? 0;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new Error("Search limit must be between 1 and 100.");
  if (!Number.isInteger(offset) || offset < 0 || offset > 10_000)
    throw new Error("Search offset is invalid.");
  const filters = Object.fromEntries(
    Object.entries(input.filters ?? {}).map(([key, value]) => {
      assertIdentity(key, "filter name");
      return [
        key,
        (Array.isArray(value) ? value : [value]).map(normalizeFacetValue),
      ];
    }),
  );
  const facets = [...new Set(input.facets ?? [])];
  facets.forEach((facet) => assertIdentity(facet, "facet name"));
  return { tokens: tokenize(input.query), limit, offset, filters, facets };
}

/** Small reference index for local development and provider conformance tests. */
export function createMemoryCmsSearchIndex(): CmsSearchIndexProvider {
  const documents = new Map<string, CmsSearchDocument>();
  return {
    async replaceAll(input, context) {
      if (context.signal.aborted) throw context.signal.reason;
      const next = new Map<string, CmsSearchDocument>();
      for (const item of input) {
        const document = normalizeCmsSearchDocument(item);
        const key = documentKey(document);
        if (next.has(key)) throw new Error(`Duplicate search document: ${key}`);
        next.set(key, document);
      }
      documents.clear();
      for (const [key, document] of [...next].sort(([left], [right]) =>
        left.localeCompare(right),
      )) {
        documents.set(key, document);
      }
      return { indexed: documents.size };
    },
    async upsert(input) {
      const document = normalizeCmsSearchDocument(input);
      documents.set(documentKey(document), document);
    },
    async delete(id, collection, locale) {
      return documents.delete(documentKey({ id, collection, locale }));
    },
    async search(input) {
      const query = normalizeQuery(input);
      const matched = [...documents.values()]
        .flatMap((document) => {
          const facetValues = document.facets ?? {};
          const passesFilters = Object.entries(query.filters).every(
            ([key, expected]) => {
              const actual = facetValues[key];
              const values = (
                Array.isArray(actual)
                  ? actual
                  : actual === undefined
                    ? []
                    : [actual]
              ).map(normalizeFacetValue);
              return expected.some((value) => values.includes(value));
            },
          );
          if (!passesFilters) return [];
          const title = normalizeText(document.title);
          const body = normalizeText(document.body);
          const path = normalizeText(document.path);
          if (
            !query.tokens.every(
              (token) =>
                title.includes(token) ||
                body.includes(token) ||
                path.includes(token),
            )
          )
            return [];
          const score = query.tokens.reduce(
            (total, token) =>
              total +
              (title.includes(token) ? 10 : 0) +
              (body.includes(token) ? 2 : 0) +
              (path.includes(token) ? 1 : 0),
            0,
          );
          const highlights = query.tokens.filter(
            (token) => title.includes(token) || body.includes(token),
          );
          return [{ document, score, highlights: Object.freeze(highlights) }];
        })
        .sort(
          (left, right) =>
            right.score - left.score ||
            left.document.path.localeCompare(right.document.path),
        );
      const facets = Object.fromEntries(
        query.facets.map((name) => {
          const counts: Record<string, number> = {};
          for (const { document } of matched) {
            const raw = document.facets?.[name];
            const values = Array.isArray(raw)
              ? raw
              : raw === undefined
                ? []
                : [raw];
            for (const value of values) {
              const key = normalizeFacetValue(value);
              counts[key] = (counts[key] ?? 0) + 1;
            }
          }
          return [
            name,
            Object.freeze(
              Object.fromEntries(
                Object.entries(counts).sort(([left], [right]) =>
                  left.localeCompare(right),
                ),
              ),
            ),
          ];
        }),
      );
      return Object.freeze({
        hits: Object.freeze(
          matched.slice(query.offset, query.offset + query.limit),
        ),
        total: matched.length,
        facets: Object.freeze(facets),
      });
    },
  };
}

export type CmsSearchReindexPayload = Readonly<{
  collections?: readonly string[];
  locales?: readonly string[];
}>;

function parseReindexPayload(payload: unknown): CmsSearchReindexPayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Search reindex payload must be an object.");
  }
  const value = payload as Record<string, unknown>;
  const parseList = (input: unknown, label: string) => {
    if (input === undefined) return undefined;
    if (
      !Array.isArray(input) ||
      input.length > 100 ||
      input.some((item) => typeof item !== "string")
    ) {
      throw new Error(
        `Search reindex ${label} must be a bounded string array.`,
      );
    }
    return Object.freeze([
      ...new Set(input.map((item) => assertIdentity(item as string, label))),
    ]);
  };
  return Object.freeze({
    ...(value.collections === undefined
      ? {}
      : { collections: parseList(value.collections, "collections") }),
    ...(value.locales === undefined
      ? {}
      : { locales: parseList(value.locales, "locales") }),
  });
}

export function createCmsSearchReindexTask(input: {
  index: CmsSearchIndexProvider;
  loadDocuments: (
    payload: CmsSearchReindexPayload,
    context: CmsTaskExecutionContext,
  ) => Promise<readonly CmsSearchDocument[]>;
}) {
  return defineCmsTask({
    definition: {
      name: "official-search/reindex",
      queue: "cms-search",
      timeoutMs: 15 * 60 * 1000,
      retry: {
        maxAttempts: 5,
        initialDelayMs: 1_000,
        multiplier: 2,
        maxDelayMs: 60_000,
        jitter: 0.2,
      },
      retentionDays: 30,
    },
    parsePayload: parseReindexPayload,
    async execute(payload, context) {
      const documents = await input.loadDocuments(payload, context);
      return input.index.replaceAll(documents, {
        idempotencyKey: context.idempotencyKey,
        signal: context.signal,
      });
    },
  });
}
