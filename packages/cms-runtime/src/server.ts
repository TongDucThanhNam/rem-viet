import {
  CmsError,
  type CmsCapability,
  type CmsCollectionData,
  type CmsCollectionDefinition,
  type CmsCollectionRegistry,
  type CmsErrorContract,
  type CmsRelationshipField,
} from "@agency/cms-core";

import {
  assertCmsCollectionAccess,
  type CmsCollectionDocument,
  type CmsCollectionFilter,
  type CmsCollectionProvider,
  type CmsCollectionReadLocaleInput,
  type CmsCollectionRevision,
  type CmsCollectionVersionInput,
  type ListCmsCollectionDocumentsInput,
} from "./collections.js";

type CollectionIn<
  TRegistry extends CmsCollectionRegistry,
  TSlug extends TRegistry["collections"][number]["slug"],
> =
  Extract<TRegistry["collections"][number], { slug: TSlug }> extends never
    ? CmsCollectionDefinition<TSlug>
    : Extract<TRegistry["collections"][number], { slug: TSlug }>;

type DataIn<
  TRegistry extends CmsCollectionRegistry,
  TSlug extends TRegistry["collections"][number]["slug"],
> = CmsCollectionData<CollectionIn<TRegistry, TSlug>>;

export type CmsServerCollectionSdk<
  TDefinition extends CmsCollectionDefinition,
> = Readonly<{
  definition: TDefinition;
  getDraft(
    input: { id: string; actorId?: string } & CmsCollectionReadLocaleInput,
  ): Promise<CmsCollectionDocument<CmsCollectionData<TDefinition>> | null>;
  getPublished(
    input: { id: string; actorId?: string } & CmsCollectionReadLocaleInput,
  ): Promise<CmsCollectionDocument<CmsCollectionData<TDefinition>> | null>;
  list(input?: Omit<ListCmsCollectionDocumentsInput, "collection">): Promise<{
    documents: readonly CmsCollectionDocument<CmsCollectionData<TDefinition>>[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  }>;
  create(input: {
    id?: string;
    data: CmsCollectionData<TDefinition>;
    actorId: string;
    locale?: string;
  }): Promise<CmsCollectionDocument<CmsCollectionData<TDefinition>>>;
  update(input: {
    id: string;
    expectedVersion: number;
    data: CmsCollectionData<TDefinition>;
    actorId: string;
    locale?: string;
  }): Promise<CmsCollectionDocument<CmsCollectionData<TDefinition>>>;
  schedule(
    input: Omit<CmsCollectionVersionInput, "collection"> & {
      scheduledAt: string;
    },
  ): Promise<CmsCollectionDocument<CmsCollectionData<TDefinition>>>;
  unschedule(
    input: Omit<CmsCollectionVersionInput, "collection">,
  ): Promise<CmsCollectionDocument<CmsCollectionData<TDefinition>>>;
  publish(input: Omit<CmsCollectionVersionInput, "collection">): Promise<{
    document: CmsCollectionDocument<CmsCollectionData<TDefinition>>;
    revision: CmsCollectionRevision<CmsCollectionData<TDefinition>>;
  }>;
  unpublish(
    input: Omit<CmsCollectionVersionInput, "collection">,
  ): Promise<CmsCollectionDocument<CmsCollectionData<TDefinition>>>;
  revisions(input: {
    id: string;
    actorId?: string;
    locale?: string;
  }): Promise<readonly CmsCollectionRevision<CmsCollectionData<TDefinition>>[]>;
  restore(
    input: Omit<CmsCollectionVersionInput, "collection"> & {
      revisionId: string;
    },
  ): Promise<CmsCollectionDocument<CmsCollectionData<TDefinition>>>;
  delete(
    input: Omit<CmsCollectionVersionInput, "collection">,
  ): Promise<CmsCollectionDocument<CmsCollectionData<TDefinition>>>;
  resolveRelationship(input: {
    field: TDefinition["fields"][number]["name"];
    id: string;
    sourceLocale?: string;
    actorId?: string;
    view?: "draft" | "published";
  }): Promise<CmsCollectionDocument | null>;
}>;

export type CmsServerSdk<TRegistry extends CmsCollectionRegistry> = Readonly<{
  registry: TRegistry;
  collection<TSlug extends TRegistry["collections"][number]["slug"]>(
    slug: TSlug,
  ): CmsServerCollectionSdk<CollectionIn<TRegistry, TSlug>>;
}>;

function resolveDefinition(
  registry: CmsCollectionRegistry,
  slug: string,
): CmsCollectionDefinition {
  if (!registry.has(slug)) {
    throw new CmsError({
      code: "NOT_FOUND",
      message: `Collection "${slug}" is not registered.`,
      retryable: false,
    });
  }
  return registry.get(slug);
}

/** Creates an actor-explicit server SDK whose data types derive from the registry. */
export function createCmsServerSdk<
  const TRegistry extends CmsCollectionRegistry,
>(
  registry: TRegistry,
  provider: CmsCollectionProvider,
): CmsServerSdk<TRegistry> {
  if (provider.registry !== registry) {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: "The SDK and provider must use the same collection registry.",
      retryable: false,
    });
  }

  return Object.freeze({
    registry,
    collection(slug) {
      const definition = resolveDefinition(registry, slug) as CollectionIn<
        TRegistry,
        typeof slug
      >;
      const target = { collection: slug };
      return Object.freeze({
        definition,
        getDraft: (input) =>
          provider.getDraft({ ...target, ...input }) as never,
        getPublished: (input) =>
          provider.getPublished({ ...target, ...input }) as never,
        list: (input = {}) => provider.list({ ...target, ...input }) as never,
        create: (input) =>
          provider.createDraft({ ...target, ...input }) as never,
        update: (input) => provider.saveDraft({ ...target, ...input }) as never,
        schedule: (input) =>
          provider.schedule({ ...target, ...input }) as never,
        unschedule: (input) =>
          provider.unschedule({ ...target, ...input }) as never,
        publish: (input) => provider.publish({ ...target, ...input }) as never,
        unpublish: (input) =>
          provider.unpublish({ ...target, ...input }) as never,
        revisions: (input) =>
          provider.listRevisions({ ...target, ...input }) as never,
        restore: (input) => provider.restore({ ...target, ...input }) as never,
        delete: (input) => provider.delete({ ...target, ...input }) as never,
        async resolveRelationship(input) {
          const field = definition.fields.find(
            (candidate) => candidate.name === input.field,
          );
          if (!field || field.kind !== "relationship") {
            throw new CmsError({
              code: "VALIDATION_FAILED",
              message: `Field "${definition.slug}.${input.field}" is not a relationship.`,
              retryable: false,
            });
          }
          const relationship = field as CmsRelationshipField;
          const related = resolveDefinition(registry, relationship.relationTo);
          const read =
            input.view === "published"
              ? provider.getPublished.bind(provider)
              : provider.getDraft.bind(provider);
          const base = {
            collection: related.slug,
            id: input.id,
            actorId: input.actorId,
          };
          if (!related.localization) return read(base);
          if (relationship.localeBehavior === "default") {
            return read({
              ...base,
              locale: related.localization.defaultLocale,
            });
          }
          if (relationship.localeBehavior === "same") {
            if (!input.sourceLocale) {
              throw new CmsError({
                code: "VALIDATION_FAILED",
                message:
                  "A source locale is required for same-locale relationships.",
                retryable: false,
              });
            }
            return read({ ...base, locale: input.sourceLocale });
          }
          for (const locale of related.localization.locales) {
            const document = await read({ ...base, locale });
            if (document) return document;
          }
          return null;
        },
      }) as CmsServerCollectionSdk<typeof definition>;
    },
  });
}

export type CmsRestResource = Readonly<{
  collection: string;
  path: string;
  methods: readonly ("GET" | "POST" | "PATCH" | "DELETE")[];
}>;

export type CmsRestHandlerOptions = {
  readonly provider: CmsCollectionProvider;
  readonly basePath?: string;
  readonly actorFor: (
    request: Request,
  ) =>
    | { actorId: string; capabilities: readonly CmsCapability[] }
    | Promise<{ actorId: string; capabilities: readonly CmsCapability[] }>;
  readonly maxBodyBytes?: number;
};

const safeDetailKeys = new Set([
  "action",
  "actualVersion",
  "collection",
  "expectedVersion",
  "field",
  "locale",
  "locales",
  "missing",
  "relationTo",
]);

export function toCmsRestError(error: unknown): CmsErrorContract {
  if (!(error instanceof CmsError)) {
    return {
      code: "CAPABILITY_UNAVAILABLE",
      message: "CMS request failed.",
      retryable: false,
    };
  }
  const details = error.details
    ? Object.fromEntries(
        Object.entries(error.details).filter(([key]) =>
          safeDetailKeys.has(key),
        ),
      )
    : undefined;
  return {
    code: error.code,
    message: error.message,
    retryable: error.retryable,
    ...(details && Object.keys(details).length ? { details } : {}),
  };
}

function errorStatus(code: CmsErrorContract["code"]) {
  if (code === "NOT_FOUND") return 404;
  if (code === "FORBIDDEN") return 403;
  if (code === "CONFLICT") return 409;
  if (code === "CAPABILITY_UNAVAILABLE") return 500;
  return 400;
}

function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function positiveInteger(value: string | null, fallback: number, max: number) {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: "Pagination values must be non-negative integers.",
      retryable: false,
    });
  }
  return Math.min(Number(value), max);
}

async function requestData(request: Request, maxBodyBytes: number) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBodyBytes) {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: "Request body exceeds the configured limit.",
      retryable: false,
    });
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBodyBytes) {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: "Request body exceeds the configured limit.",
      retryable: false,
    });
  }
  try {
    const value: unknown = text ? JSON.parse(text) : {};
    if (!value || typeof value !== "object" || Array.isArray(value)) throw 0;
    return value as Record<string, unknown>;
  } catch {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: "Request body must be a JSON object.",
      retryable: false,
    });
  }
}

/** Generates a small, allow-listed Fetch REST surface from collection contracts. */
export function createCmsRestResources(options: CmsRestHandlerOptions) {
  const basePath = (options.basePath ?? "/cms").replace(/\/$/, "");
  const resources = Object.freeze(
    options.provider.registry.collections.flatMap((collection) => [
      {
        collection: collection.slug,
        path: `${basePath}/collections/${collection.slug}/documents`,
        methods: ["GET", "POST"] as const,
      },
      {
        collection: collection.slug,
        path: `${basePath}/collections/${collection.slug}/documents/:id`,
        methods: ["GET", "PATCH", "DELETE"] as const,
      },
      {
        collection: collection.slug,
        path: `${basePath}/collections/${collection.slug}/documents/:id/revisions`,
        methods: ["GET"] as const,
      },
      {
        collection: collection.slug,
        path: `${basePath}/collections/${collection.slug}/documents/:id/actions/:action`,
        methods: ["POST"] as const,
      },
    ]),
  ) satisfies readonly CmsRestResource[];

  return Object.freeze({
    resources,
    async handle(request: Request): Promise<Response> {
      try {
        const url = new URL(request.url);
        const relative = url.pathname.startsWith(`${basePath}/`)
          ? url.pathname.slice(basePath.length + 1)
          : "";
        const parts = relative.split("/").filter(Boolean);
        if (parts[0] !== "collections" || parts[2] !== "documents") {
          throw new CmsError({
            code: "NOT_FOUND",
            message: "CMS REST resource was not found.",
            retryable: false,
          });
        }
        const definition = resolveDefinition(
          options.provider.registry,
          parts[1]!,
        );
        const sdk = createCmsServerSdk(
          options.provider.registry,
          options.provider,
        ).collection(definition.slug);
        const actor = await options.actorFor(request);
        const locale = url.searchParams.get("locale") ?? undefined;
        const method = request.method.toUpperCase();
        const documentId = parts[3];
        const tail = parts.slice(4);

        if (!documentId && method === "GET") {
          assertCmsCollectionAccess(definition, "read", actor.capabilities);
          const requestedStatus = url.searchParams.get("status");
          if (
            requestedStatus !== null &&
            requestedStatus !== "draft" &&
            requestedStatus !== "published"
          ) {
            throw new CmsError({
              code: "VALIDATION_FAILED",
              message: "status must be draft or published.",
              retryable: false,
            });
          }
          const rawFilters = url.searchParams.get("filters");
          let filters: readonly CmsCollectionFilter[] | undefined;
          if (rawFilters) {
            let parsed: unknown;
            try {
              parsed = JSON.parse(rawFilters);
            } catch {
              throw new CmsError({
                code: "VALIDATION_FAILED",
                message: "REST filters must be valid JSON.",
                retryable: false,
              });
            }
            if (!Array.isArray(parsed) || parsed.length > 5) {
              throw new CmsError({
                code: "VALIDATION_FAILED",
                message: "REST queries support at most five filters.",
                retryable: false,
              });
            }
            filters = parsed as CmsCollectionFilter[];
          }
          return json(
            await sdk.list({
              actorId: actor.actorId,
              locale,
              status: requestedStatus === "published" ? "published" : "draft",
              filters,
              pagination: {
                limit: positiveInteger(url.searchParams.get("limit"), 25, 100),
                offset: positiveInteger(
                  url.searchParams.get("offset"),
                  0,
                  10_000,
                ),
              },
            }),
          );
        }
        if (!documentId && method === "POST") {
          assertCmsCollectionAccess(definition, "create", actor.capabilities);
          const body = await requestData(
            request,
            options.maxBodyBytes ?? 262_144,
          );
          return json(
            await sdk.create({
              id: typeof body.id === "string" ? body.id : undefined,
              data: body.data as DataIn<
                typeof options.provider.registry,
                string
              >,
              actorId: actor.actorId,
              locale,
            }),
            201,
          );
        }
        if (!documentId) {
          throw new CmsError({
            code: "NOT_FOUND",
            message: "CMS REST resource was not found.",
            retryable: false,
          });
        }
        if (!tail.length && method === "GET") {
          assertCmsCollectionAccess(definition, "read", actor.capabilities);
          const view = url.searchParams.get("view");
          const result =
            view === "published"
              ? await sdk.getPublished({
                  id: documentId,
                  actorId: actor.actorId,
                  locale,
                  fallback:
                    url.searchParams.get("fallback") === "default"
                      ? "default"
                      : "none",
                })
              : await sdk.getDraft({
                  id: documentId,
                  actorId: actor.actorId,
                  locale,
                  fallback:
                    url.searchParams.get("fallback") === "default"
                      ? "default"
                      : "none",
                });
          if (!result) {
            throw new CmsError({
              code: "NOT_FOUND",
              message: "CMS document was not found.",
              retryable: false,
            });
          }
          return json(result);
        }
        if (tail[0] === "revisions" && method === "GET") {
          assertCmsCollectionAccess(definition, "read", actor.capabilities);
          return json(
            await sdk.revisions({
              id: documentId,
              actorId: actor.actorId,
              locale,
            }),
          );
        }

        const body = await requestData(
          request,
          options.maxBodyBytes ?? 262_144,
        );
        const expectedVersion = body.expectedVersion;
        if (!Number.isInteger(expectedVersion) || Number(expectedVersion) < 1) {
          throw new CmsError({
            code: "VALIDATION_FAILED",
            message: "expectedVersion must be a positive integer.",
            retryable: false,
          });
        }
        const command = {
          id: documentId,
          expectedVersion: Number(expectedVersion),
          actorId: actor.actorId,
          locale,
          note: typeof body.note === "string" ? body.note : undefined,
        };
        if (!tail.length && method === "PATCH") {
          assertCmsCollectionAccess(definition, "update", actor.capabilities);
          return json(
            await sdk.update({ ...command, data: body.data as never }),
          );
        }
        if (!tail.length && method === "DELETE") {
          assertCmsCollectionAccess(definition, "delete", actor.capabilities);
          return json(await sdk.delete(command));
        }
        if (tail[0] === "actions" && method === "POST") {
          assertCmsCollectionAccess(
            definition,
            tail[1] === "restore" ? "update" : "publish",
            actor.capabilities,
          );
          if (tail[1] === "publish") return json(await sdk.publish(command));
          if (tail[1] === "unpublish")
            return json(await sdk.unpublish(command));
          if (tail[1] === "unschedule")
            return json(await sdk.unschedule(command));
          if (tail[1] === "schedule" && typeof body.scheduledAt === "string") {
            return json(
              await sdk.schedule({ ...command, scheduledAt: body.scheduledAt }),
            );
          }
          if (tail[1] === "restore" && typeof body.revisionId === "string") {
            return json(
              await sdk.restore({ ...command, revisionId: body.revisionId }),
            );
          }
        }
        throw new CmsError({
          code: "NOT_FOUND",
          message: "CMS REST resource was not found.",
          retryable: false,
        });
      } catch (error) {
        const contract = toCmsRestError(error);
        return json({ error: contract }, errorStatus(contract.code));
      }
    },
  });
}
