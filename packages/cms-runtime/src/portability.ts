import {
  CmsError,
  collectCmsRelationshipReferences,
  migrateCollectionData,
  parseCmsCollectionData,
  type CmsBuiltInField,
  type CmsCollectionDefinition,
  type CmsCollectionRegistry,
} from "@agency/cms-core";

import type {
  CmsCollectionDocument,
  CmsCollectionProvider,
} from "./collections.js";

export const CMS_PORTABILITY_SCHEMA_VERSION = 1;

export type CmsPortableRegistryEntry = Readonly<{
  slug: string;
  schemaVersion: number;
  locales: readonly string[];
  defaultLocale: string | null;
}>;

export type CmsPortableDocument = Readonly<{
  collection: string;
  id: string;
  locale: string | null;
  schemaVersion: number;
  expectedVersion: number | null;
  data: Readonly<Record<string, unknown>>;
  publishedData: Readonly<Record<string, unknown>> | null;
  scheduledAt: string | null;
}>;

export type CmsPortableBundle = Readonly<{
  schemaVersion: typeof CMS_PORTABILITY_SCHEMA_VERSION;
  registry: readonly CmsPortableRegistryEntry[];
  documents: readonly CmsPortableDocument[];
}>;

export type CmsImportIssue = Readonly<{
  collection: string;
  id: string;
  locale: string | null;
  message: string;
}>;

export type CmsRequiredMigration = Readonly<{
  collection: string;
  id: string;
  from: number;
  to: number;
}>;

export type CmsImportReport = Readonly<{
  mode: "validation" | "dry-run" | "apply";
  applied: boolean;
  creates: readonly CmsImportIssue[];
  updates: readonly CmsImportIssue[];
  skips: readonly CmsImportIssue[];
  conflicts: readonly CmsImportIssue[];
  missingRelationships: readonly CmsImportIssue[];
  validationFailures: readonly CmsImportIssue[];
  requiredMigrations: readonly CmsRequiredMigration[];
}>;

export type CmsAtomicImportOperation = Readonly<{
  kind: "create" | "update";
  collection: string;
  id: string;
  locale: string | null;
  expectedVersion: number | null;
  schemaVersion: number;
  data: Readonly<Record<string, unknown>>;
  publishedData: Readonly<Record<string, unknown>> | null;
  scheduledAt: string | null;
}>;

export interface CmsCollectionPortabilityProvider extends CmsCollectionProvider {
  applyImportAtomically(input: {
    actorId: string;
    operations: readonly CmsAtomicImportOperation[];
  }): Promise<void>;
}

function keyOf(collection: string, id: string, locale: string | null) {
  return `${collection}\u0000${id}\u0000${locale ?? ""}`;
}

function definitionFor(registry: CmsCollectionRegistry, slug: string) {
  if (!registry.has(slug)) {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: `Import references unregistered collection "${slug}".`,
      retryable: false,
    });
  }
  return registry.get(slug);
}

function localeFor(
  definition: CmsCollectionDefinition,
  locale: string | null,
): string | undefined {
  if (!definition.localization) {
    if (locale !== null) {
      throw new CmsError({
        code: "VALIDATION_FAILED",
        message: `Collection "${definition.slug}" does not support locales.`,
        retryable: false,
      });
    }
    return undefined;
  }
  if (!locale || !definition.localization.locales.includes(locale)) {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: `Collection "${definition.slug}" requires a supported locale.`,
      retryable: false,
    });
  }
  return locale;
}

function issue(document: CmsPortableDocument, message: string): CmsImportIssue {
  return {
    collection: document.collection,
    id: document.id,
    locale: document.locale,
    message,
  };
}

function equal(left: unknown, right: unknown) {
  return stableJson(left) === stableJson(right);
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableValue(entry)]),
    );
  }
  return value;
}

/** Serializes a bundle with stable object-key and document ordering. */
export function stableJson(value: unknown) {
  return JSON.stringify(stableValue(value));
}

async function allDocuments(
  provider: CmsCollectionProvider,
  definition: CmsCollectionDefinition,
  locale: string | undefined,
  actorId: string,
) {
  const documents: CmsCollectionDocument[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await provider.list({
      collection: definition.slug,
      locale,
      actorId,
      pagination: { limit: 100, offset },
    });
    documents.push(...page.documents);
    if (!page.hasMore) break;
  }
  return documents;
}

/** Exports public collection state only; provider rows, secrets and hooks stay out. */
export async function exportCmsContent(input: {
  provider: CmsCollectionProvider;
  actorId: string;
}): Promise<CmsPortableBundle> {
  const registry = [...input.provider.registry.collections]
    .sort((left, right) => left.slug.localeCompare(right.slug))
    .map((definition) => ({
      slug: definition.slug,
      schemaVersion: definition.schemaVersion,
      locales: [...(definition.localization?.locales ?? [])].sort(),
      defaultLocale: definition.localization?.defaultLocale ?? null,
    }));
  const documents: CmsPortableDocument[] = [];
  for (const entry of registry) {
    const definition = definitionFor(input.provider.registry, entry.slug);
    const locales = definition.localization
      ? definition.localization.locales
      : [undefined];
    for (const locale of locales) {
      for (const draft of await allDocuments(
        input.provider,
        definition,
        locale,
        input.actorId,
      )) {
        const published = await input.provider.getPublished({
          collection: definition.slug,
          id: draft.id,
          locale,
          actorId: input.actorId,
        });
        documents.push({
          collection: definition.slug,
          id: draft.id,
          locale: draft.locale,
          schemaVersion: draft.schemaVersion,
          expectedVersion: null,
          data: stableValue(draft.data) as Record<string, unknown>,
          publishedData: published
            ? (stableValue(published.data) as Record<string, unknown>)
            : null,
          scheduledAt: draft.scheduledAt,
        });
      }
    }
  }
  documents.sort((left, right) =>
    keyOf(left.collection, left.id, left.locale).localeCompare(
      keyOf(right.collection, right.id, right.locale),
    ),
  );
  return {
    schemaVersion: CMS_PORTABILITY_SCHEMA_VERSION,
    registry,
    documents,
  };
}

function parseBundle(bundle: unknown): CmsPortableBundle {
  if (!bundle || typeof bundle !== "object" || Array.isArray(bundle)) {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: "Import bundle must be an object.",
      retryable: false,
    });
  }
  const candidate = bundle as Partial<CmsPortableBundle>;
  if (
    candidate.schemaVersion !== CMS_PORTABILITY_SCHEMA_VERSION ||
    !Array.isArray(candidate.registry) ||
    !Array.isArray(candidate.documents) ||
    !candidate.registry.every(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        typeof entry.slug === "string" &&
        Number.isInteger(entry.schemaVersion) &&
        Array.isArray(entry.locales) &&
        entry.locales.every((locale: unknown) => typeof locale === "string") &&
        (entry.defaultLocale === null ||
          typeof entry.defaultLocale === "string"),
    ) ||
    !candidate.documents.every(
      (document) =>
        document &&
        typeof document === "object" &&
        typeof document.collection === "string" &&
        typeof document.id === "string" &&
        (document.locale === null || typeof document.locale === "string") &&
        Number.isInteger(document.schemaVersion) &&
        (document.expectedVersion === null ||
          Number.isInteger(document.expectedVersion)) &&
        Boolean(document.data) &&
        typeof document.data === "object" &&
        !Array.isArray(document.data) &&
        (document.publishedData === null ||
          (Boolean(document.publishedData) &&
            typeof document.publishedData === "object" &&
            !Array.isArray(document.publishedData))) &&
        (document.scheduledAt === null ||
          typeof document.scheduledAt === "string"),
    )
  ) {
    throw new CmsError({
      code: "MIGRATION_FAILED",
      message: "Import bundle schema is incompatible with this runtime.",
      retryable: false,
    });
  }
  return candidate as CmsPortableBundle;
}

/** Plans every item before calling the provider's single atomic apply boundary. */
export async function importCmsContent(input: {
  provider: CmsCollectionPortabilityProvider;
  bundle: unknown;
  actorId: string;
  validationOnly?: boolean;
  dryRun?: boolean;
}): Promise<CmsImportReport> {
  const bundle = parseBundle(input.bundle);
  const mode = input.validationOnly
    ? "validation"
    : input.dryRun
      ? "dry-run"
      : "apply";
  const creates: CmsImportIssue[] = [];
  const updates: CmsImportIssue[] = [];
  const skips: CmsImportIssue[] = [];
  const conflicts: CmsImportIssue[] = [];
  const missingRelationships: CmsImportIssue[] = [];
  const validationFailures: CmsImportIssue[] = [];
  const requiredMigrations: CmsRequiredMigration[] = [];
  const operations: CmsAtomicImportOperation[] = [];
  const manifest = new Map<string, CmsPortableRegistryEntry>();
  for (const entry of bundle.registry) {
    if (
      !entry ||
      typeof entry.slug !== "string" ||
      !Number.isInteger(entry.schemaVersion) ||
      !Array.isArray(entry.locales) ||
      manifest.has(entry.slug)
    ) {
      validationFailures.push({
        collection:
          entry && typeof entry.slug === "string" ? entry.slug : "unknown",
        id: "*",
        locale: null,
        message: "Invalid or duplicate registry manifest entry.",
      });
      continue;
    }
    manifest.set(entry.slug, entry);
    if (!input.provider.registry.has(entry.slug)) {
      validationFailures.push({
        collection: entry.slug,
        id: "*",
        locale: null,
        message: "Registry manifest references an unregistered collection.",
      });
      continue;
    }
    const definition = input.provider.registry.get(entry.slug);
    const currentLocales = [...(definition.localization?.locales ?? [])].sort();
    if (
      entry.schemaVersion > definition.schemaVersion ||
      entry.defaultLocale !==
        (definition.localization?.defaultLocale ?? null) ||
      !equal([...entry.locales].sort(), currentLocales)
    ) {
      validationFailures.push({
        collection: entry.slug,
        id: "*",
        locale: null,
        message: "Registry manifest is incompatible with the target registry.",
      });
    }
  }
  const planned = new Set(
    bundle.documents.map((document) =>
      keyOf(document.collection, document.id, document.locale),
    ),
  );
  const seen = new Set<string>();

  for (const document of bundle.documents) {
    const key = keyOf(document.collection, document.id, document.locale);
    if (seen.has(key)) {
      validationFailures.push(issue(document, "Duplicate document identity."));
      continue;
    }
    seen.add(key);
    if (!manifest.has(document.collection)) {
      validationFailures.push(
        issue(
          document,
          "Document collection is absent from the registry manifest.",
        ),
      );
      continue;
    }
    let definition: CmsCollectionDefinition;
    let locale: string | undefined;
    let data: Record<string, unknown>;
    let publishedData: Record<string, unknown> | null;
    try {
      definition = definitionFor(input.provider.registry, document.collection);
      const builtInDefinition = definition as CmsCollectionDefinition<
        string,
        readonly CmsBuiltInField[]
      >;
      locale = localeFor(definition, document.locale);
      if (
        !Number.isInteger(document.schemaVersion) ||
        document.schemaVersion < 1 ||
        document.schemaVersion > definition.schemaVersion
      ) {
        throw new CmsError({
          code: "MIGRATION_FAILED",
          message: "Document schema version is incompatible.",
          retryable: false,
        });
      }
      if (document.schemaVersion < definition.schemaVersion) {
        requiredMigrations.push({
          collection: document.collection,
          id: document.id,
          from: document.schemaVersion,
          to: definition.schemaVersion,
        });
      }
      data = parseCmsCollectionData(
        builtInDefinition,
        migrateCollectionData(
          builtInDefinition,
          document.data,
          document.schemaVersion,
        ),
      );
      publishedData = document.publishedData
        ? parseCmsCollectionData(
            builtInDefinition,
            migrateCollectionData(
              builtInDefinition,
              document.publishedData,
              document.schemaVersion,
            ),
          )
        : null;
      if (
        document.scheduledAt !== null &&
        !Number.isFinite(Date.parse(document.scheduledAt))
      ) {
        throw new CmsError({
          code: "VALIDATION_FAILED",
          message: "Scheduled timestamps must be ISO-compatible dates.",
          retryable: false,
        });
      }
    } catch (error) {
      validationFailures.push(
        issue(
          document,
          error instanceof Error ? error.message : "Invalid document.",
        ),
      );
      continue;
    }

    for (const source of [data, ...(publishedData ? [publishedData] : [])]) {
      for (const reference of collectCmsRelationshipReferences(
        definition as CmsCollectionDefinition<
          string,
          readonly CmsBuiltInField[]
        >,
        source,
      )) {
        const target = definitionFor(
          input.provider.registry,
          reference.targetCollection,
        );
        const targetLocales = !target.localization
          ? [null]
          : reference.localeBehavior === "same"
            ? [document.locale]
            : reference.localeBehavior === "default"
              ? [target.localization.defaultLocale]
              : target.localization.locales;
        let found = false;
        for (const targetLocale of targetLocales) {
          if (
            planned.has(
              keyOf(
                reference.targetCollection,
                reference.targetId,
                targetLocale,
              ),
            ) ||
            (await input.provider.getDraft({
              collection: reference.targetCollection,
              id: reference.targetId,
              locale: targetLocale ?? undefined,
              actorId: input.actorId,
            }))
          ) {
            found = true;
            break;
          }
        }
        if (!found) {
          missingRelationships.push(
            issue(
              document,
              `Missing ${reference.targetCollection}/${reference.targetId}.`,
            ),
          );
        }
      }
    }

    const existing = await input.provider.getDraft({
      collection: document.collection,
      id: document.id,
      locale,
      actorId: input.actorId,
    });
    if (
      existing &&
      equal(existing.data, data) &&
      equal(
        (
          await input.provider.getPublished({
            collection: document.collection,
            id: document.id,
            locale,
            actorId: input.actorId,
          })
        )?.data ?? null,
        publishedData,
      ) &&
      existing.scheduledAt === document.scheduledAt
    ) {
      skips.push(issue(document, "Content already matches."));
      continue;
    }
    if (existing && document.expectedVersion !== existing.version) {
      conflicts.push(
        issue(
          document,
          `Expected version ${document.expectedVersion ?? "new"}, received ${existing.version}.`,
        ),
      );
      continue;
    }
    const kind = existing ? "update" : "create";
    (kind === "create" ? creates : updates).push(
      issue(document, `${kind} ready.`),
    );
    operations.push({
      kind,
      collection: document.collection,
      id: document.id,
      locale: document.locale,
      expectedVersion: existing?.version ?? null,
      schemaVersion: definition.schemaVersion,
      data,
      publishedData,
      scheduledAt: document.scheduledAt,
    });
  }

  const blocked =
    validationFailures.length > 0 ||
    missingRelationships.length > 0 ||
    conflicts.length > 0;
  if (mode === "apply" && !blocked && operations.length) {
    await input.provider.applyImportAtomically({
      actorId: input.actorId,
      operations,
    });
  }
  return {
    mode,
    applied: mode === "apply" && !blocked,
    creates,
    updates,
    skips,
    conflicts,
    missingRelationships,
    validationFailures,
    requiredMigrations,
  };
}
