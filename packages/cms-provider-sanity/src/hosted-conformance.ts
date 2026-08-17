import { CmsError } from "@agency/cms-core";
import {
  runGlobalContentProviderConformance,
  type CmsPageContent,
} from "@agency/cms-runtime";

import {
  SANITY_RECOMMENDED_API_VERSION,
  createSanityCmsGlobalContentProvider,
  createSanityCmsPageProvider,
  createSanityPreviewClientOverlay,
  createSanityPresentationConfig,
  sanityCmsCapabilities,
  sanityGlobalContentCapabilities,
  sanityVisualEditingCapabilities,
  type SanityClientPort,
} from "./index";

export const SANITY_HOSTED_RECEIPT_SCHEMA_VERSION = 3;

type SanityHostedGlobalContent = Readonly<{
  label: string;
  links: ReadonlyArray<Readonly<{ id: string; label: string }>>;
}>;

export type SanityHostedConformanceReceipt = Readonly<{
  schemaVersion: typeof SANITY_HOSTED_RECEIPT_SCHEMA_VERSION;
  status: "complete";
  provider: "sanity";
  apiVersion: typeof SANITY_RECOMMENDED_API_VERSION;
  projectId: string;
  dataset: string;
  documentId: string;
  globalKey: string;
  startedAt: string;
  completedAt: string;
  gitCommit: string;
  checks: Readonly<{
    cleanPreflight: true;
    twoBlockModel: true;
    draftCreate: true;
    stableKeySourceMap: true;
    optimisticSave: true;
    staleWriteRejected: true;
    publish: true;
    unpublish: true;
    delete: true;
    globalCreate: true;
    globalUpdate: true;
    globalOptimisticConflict: true;
    globalRevisionHistory: true;
    globalRestore: true;
    cleanup: true;
  }>;
  visualEditing: Readonly<{
    studioOrigin: string;
    previewOrigin: string;
    capabilities: typeof sanityVisualEditingCapabilities;
  }>;
  storageCapabilities: typeof sanityCmsCapabilities;
  globalStorageCapabilities: typeof sanityGlobalContentCapabilities;
}>;

const sanityHostedCheckNames = [
  "cleanPreflight",
  "twoBlockModel",
  "draftCreate",
  "stableKeySourceMap",
  "optimisticSave",
  "staleWriteRejected",
  "publish",
  "unpublish",
  "delete",
  "globalCreate",
  "globalUpdate",
  "globalOptimisticConflict",
  "globalRevisionHistory",
  "globalRestore",
  "cleanup",
] as const;

export const sanityHostedReceiptJsonSchema = Object.freeze({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  additionalProperties: false,
  properties: {
    schemaVersion: { const: SANITY_HOSTED_RECEIPT_SCHEMA_VERSION },
    status: { const: "complete" },
    provider: { const: "sanity" },
    apiVersion: { const: SANITY_RECOMMENDED_API_VERSION },
    projectId: { type: "string", minLength: 1 },
    dataset: { type: "string", minLength: 1 },
    documentId: { type: "string", minLength: 1 },
    globalKey: { type: "string", minLength: 1 },
    startedAt: { type: "string", format: "date-time" },
    completedAt: { type: "string", format: "date-time" },
    gitCommit: { type: "string", pattern: "^[a-f0-9]{40}$" },
    checks: {
      additionalProperties: false,
      properties: Object.fromEntries(
        sanityHostedCheckNames.map((name) => [name, { const: true }]),
      ),
      required: sanityHostedCheckNames,
      type: "object",
    },
    visualEditing: {
      additionalProperties: false,
      properties: {
        studioOrigin: { type: "string", format: "uri" },
        previewOrigin: { type: "string", format: "uri" },
        capabilities: { const: sanityVisualEditingCapabilities },
      },
      required: ["studioOrigin", "previewOrigin", "capabilities"],
      type: "object",
    },
    storageCapabilities: { const: sanityCmsCapabilities },
    globalStorageCapabilities: { const: sanityGlobalContentCapabilities },
  },
  required: [
    "schemaVersion",
    "status",
    "provider",
    "apiVersion",
    "projectId",
    "dataset",
    "documentId",
    "globalKey",
    "startedAt",
    "completedAt",
    "gitCommit",
    "checks",
    "visualEditing",
    "storageCapabilities",
    "globalStorageCapabilities",
  ],
  type: "object",
} as const);

export function parseSanityHostedConformanceReceipt(
  value: unknown,
): SanityHostedConformanceReceipt {
  assert(isRecord(value), "Sanity hosted receipt is not an object.");
  assertExactKeys(value, sanityHostedReceiptJsonSchema.required);
  assert(
    value.schemaVersion === SANITY_HOSTED_RECEIPT_SCHEMA_VERSION,
    "Sanity hosted receipt schema is invalid.",
  );
  assert(value.status === "complete", "Sanity hosted receipt is incomplete.");
  assert(
    value.provider === "sanity",
    "Sanity hosted receipt provider is invalid.",
  );
  assert(
    value.apiVersion === SANITY_RECOMMENDED_API_VERSION,
    "Sanity hosted receipt API version is invalid.",
  );
  for (const [name, field] of [
    ["projectId", value.projectId],
    ["dataset", value.dataset],
    ["documentId", value.documentId],
    ["globalKey", value.globalKey],
  ] as const) {
    assert(
      typeof field === "string" && field.length > 0,
      `Sanity hosted receipt ${name} is invalid.`,
    );
  }
  assertIsoRange(value.startedAt, value.completedAt);
  assert(
    typeof value.gitCommit === "string" &&
      /^[a-f0-9]{40}$/.test(value.gitCommit),
    "Sanity hosted receipt Git commit is invalid.",
  );
  assertExactTrueChecks(value.checks, sanityHostedCheckNames);
  assert(
    isRecord(value.visualEditing),
    "Sanity hosted visual receipt is missing.",
  );
  assertExactKeys(value.visualEditing, [
    "studioOrigin",
    "previewOrigin",
    "capabilities",
  ]);
  for (const name of ["studioOrigin", "previewOrigin"] as const) {
    assert(
      typeof value.visualEditing[name] === "string" &&
        ["http:", "https:"].includes(
          new URL(value.visualEditing[name] as string).protocol,
        ),
      `Sanity hosted ${name} is invalid.`,
    );
  }
  assertJsonEqual(
    value.visualEditing.capabilities,
    sanityVisualEditingCapabilities,
    "Sanity hosted visual capabilities are invalid.",
  );
  assertJsonEqual(
    value.storageCapabilities,
    sanityCmsCapabilities,
    "Sanity hosted storage capabilities are invalid.",
  );
  assertJsonEqual(
    value.globalStorageCapabilities,
    sanityGlobalContentCapabilities,
    "Sanity hosted global capabilities are invalid.",
  );
  return value as SanityHostedConformanceReceipt;
}

export type SanityHostedConformanceInput<TContent extends CmsPageContent> = {
  client: SanityClientPort;
  projectId: string;
  dataset: string;
  documentId: string;
  actorId: string;
  confirmation: string;
  content: TContent;
  parseContent: (value: unknown) => TContent;
  studioUrl: string;
  previewUrl: string;
  allowOrigins: readonly string[];
  gitCommit: string;
  now?: () => Date;
  allowProduction?: boolean;
};

export function requiredSanityHostedConfirmation(input: {
  projectId: string;
  dataset: string;
  documentId: string;
  allowProduction?: boolean;
}) {
  const scope = normalizeScope(input);
  return `VERIFY SANITY ${scope.projectId}/${scope.dataset} ${scope.documentId}${
    scope.dataset === "production" ? " PRODUCTION" : ""
  }`;
}

export async function runSanityHostedConformance<
  TContent extends CmsPageContent,
>(
  input: SanityHostedConformanceInput<TContent>,
): Promise<SanityHostedConformanceReceipt> {
  const scope = normalizeScope(input);
  const configured = input.client.config();
  if (configured.dataset !== scope.dataset) {
    validation(
      "Configured Sanity client dataset does not match the receipt scope.",
    );
  }
  if (
    "projectId" in configured &&
    configured.projectId &&
    configured.projectId !== scope.projectId
  ) {
    validation(
      "Configured Sanity client project does not match the receipt scope.",
    );
  }
  const requiredConfirmation = requiredSanityHostedConfirmation(input);
  if (input.confirmation !== requiredConfirmation) {
    validation(`Hosted Sanity verification requires: ${requiredConfirmation}`);
  }
  if (input.content.blocks.length !== 2) {
    validation(
      "Hosted Sanity verification requires exactly two content blocks.",
    );
  }
  if (!/^[a-f0-9]{40}$/.test(input.gitCommit)) {
    validation("Hosted Sanity verification requires a full Git commit.");
  }
  const presentation = createSanityPresentationConfig({
    previewUrl: input.previewUrl,
    allowOrigins: input.allowOrigins,
  });
  const studioOverlay = createSanityPreviewClientOverlay(input.studioUrl);
  const studioOrigin = new URL(studioOverlay.stega.studioUrl).origin;
  if (!presentation.allowOrigins.includes(new URL(input.previewUrl).origin)) {
    validation("Presentation allowOrigins must include the preview origin.");
  }

  const now = input.now ?? (() => new Date());
  const startedAt = now().toISOString();
  const publishedId = `agency-sanity-proof-${scope.documentId}`;
  const globalKey = `hosted-conformance/${scope.documentId}`;
  const provider = createSanityCmsPageProvider({
    client: input.client,
    parseContent: input.parseContent,
    createId: () => scope.documentId,
    publishedId: () => publishedId,
    now,
  });
  const globalProvider = createSanityCmsGlobalContentProvider({
    client: input.client,
    parseContent: parseHostedGlobalContent,
  });
  let pageCleanupRequired = false;
  let globalCleanupRequired = false;
  const cleanupErrors: unknown[] = [];

  try {
    const existingDraft = await provider.getDraft({ id: scope.documentId });
    const existingPublished = await provider.getPublished({
      id: scope.documentId,
    });
    if (existingDraft || existingPublished) {
      validation(
        "Hosted Sanity proof document already exists; choose a fresh id.",
      );
    }
    if (
      (await listSanityGlobalProofDocumentIds(input.client, globalKey)).length
    ) {
      validation(
        "Hosted Sanity global proof documents already exist; choose a fresh id.",
      );
    }

    pageCleanupRequired = true;
    const created = await provider.createDraft({
      id: scope.documentId,
      content: input.content,
      actorId: input.actorId,
    });
    assert(
      created.version === 1,
      "Sanity draft create did not return version 1.",
    );
    assert(
      created.content.blocks.length === 2,
      "Sanity draft did not preserve the two-block model.",
    );

    const sourceMapResponse = await input.client.fetch<{
      result?: unknown;
      resultSourceMap?: {
        documents?: Array<{ _id?: string; _type?: string }>;
        mappings?: Record<string, unknown>;
        paths?: string[];
      };
    }>(
      `*[_type == $documentType && agencyId == $agencyId][0]{content}`,
      { agencyId: scope.documentId, documentType: "agencyPage" },
      {
        filterResponse: false,
        perspective: "drafts",
        resultSourceMap: "withKeyArraySelector",
        useCdn: false,
      },
    );
    const sourceDocuments = sourceMapResponse.resultSourceMap?.documents ?? [];
    const mappings = sourceMapResponse.resultSourceMap?.mappings ?? {};
    const paths = sourceMapResponse.resultSourceMap?.paths ?? [];
    assert(
      sourceDocuments.some(
        (document) =>
          document._id === `drafts.${publishedId}` ||
          document._id === publishedId,
      ),
      "Sanity Content Source Map does not identify the proof document.",
    );
    assert(
      Object.keys(mappings).length > 0,
      "Sanity Content Source Map is empty.",
    );
    for (const block of input.content.blocks) {
      assert(
        paths.some((path) => path.includes(`_key==\"${block.id}\"`)),
        `Sanity Content Source Map does not contain the stable _key selector for ${block.id}.`,
      );
    }

    const changedContent = input.parseContent({
      ...created.content,
      title: `${created.content.title} · hosted-proof`,
    });
    const saved = await provider.saveDraft({
      id: scope.documentId,
      expectedVersion: created.version,
      content: changedContent,
      actorId: input.actorId,
    });
    assert(
      saved.version === 2,
      "Sanity optimistic save did not advance version.",
    );
    let staleWriteRejected = false;
    try {
      await provider.saveDraft({
        id: scope.documentId,
        expectedVersion: created.version,
        content: input.content,
        actorId: input.actorId,
      });
    } catch (error) {
      staleWriteRejected =
        error instanceof CmsError && error.code === "CONFLICT";
    }
    assert(staleWriteRejected, "Sanity stale write was not rejected.");

    const publication = await provider.publish({
      id: scope.documentId,
      expectedVersion: saved.version,
      actorId: input.actorId,
      note: "Hosted provider conformance",
    });
    assert(
      publication.document.version === 3,
      "Sanity publish version mismatch.",
    );
    const published = await provider.getPublished({ id: scope.documentId });
    assert(
      published?.content.title === changedContent.title,
      "Sanity published read did not return the saved content.",
    );

    const unpublished = await provider.unpublish({
      id: scope.documentId,
      expectedVersion: publication.document.version,
      actorId: input.actorId,
    });
    assert(unpublished.version === 4, "Sanity unpublish version mismatch.");
    assert(
      (await provider.getPublished({ id: scope.documentId })) === null,
      "Sanity published document remains after unpublish.",
    );

    await provider.delete({
      id: scope.documentId,
      expectedVersion: unpublished.version,
      actorId: input.actorId,
    });
    assert(
      (await provider.getDraft({ id: scope.documentId })) === null,
      "Sanity draft remains after delete.",
    );
    pageCleanupRequired = false;

    globalCleanupRequired = true;
    const globalChecks = await runGlobalContentProviderConformance({
      provider: globalProvider,
      key: globalKey,
      actorId: input.actorId,
      initial: hostedGlobalContent("Initial"),
      changed: hostedGlobalContent("Changed"),
    });
    assert(
      Object.values(globalChecks).every(Boolean),
      "Sanity global-content conformance did not complete every check.",
    );
    assert(
      (await listSanityGlobalProofDocumentIds(input.client, globalKey))
        .length === 4,
      "Sanity global-content conformance did not preserve one current document and three revisions.",
    );
    await cleanupSanityGlobalProofDocuments(
      input.client,
      scope.dataset,
      globalKey,
    );
    assert(
      (await listSanityGlobalProofDocumentIds(input.client, globalKey))
        .length === 0,
      "Sanity global proof documents remain after cleanup.",
    );
    globalCleanupRequired = false;

    return Object.freeze({
      schemaVersion: SANITY_HOSTED_RECEIPT_SCHEMA_VERSION,
      status: "complete",
      provider: "sanity",
      apiVersion: SANITY_RECOMMENDED_API_VERSION,
      projectId: scope.projectId,
      dataset: scope.dataset,
      documentId: scope.documentId,
      globalKey,
      startedAt,
      completedAt: now().toISOString(),
      gitCommit: input.gitCommit,
      checks: Object.freeze({
        cleanPreflight: true,
        twoBlockModel: true,
        draftCreate: true,
        stableKeySourceMap: true,
        optimisticSave: true,
        staleWriteRejected: true,
        publish: true,
        unpublish: true,
        delete: true,
        globalCreate: globalChecks.create,
        globalUpdate: globalChecks.update,
        globalOptimisticConflict: globalChecks.optimisticConflict,
        globalRevisionHistory: globalChecks.revisionHistory,
        globalRestore: globalChecks.restore,
        cleanup: true,
      }),
      visualEditing: Object.freeze({
        studioOrigin,
        previewOrigin: new URL(input.previewUrl).origin,
        capabilities: sanityVisualEditingCapabilities,
      }),
      storageCapabilities: sanityCmsCapabilities,
      globalStorageCapabilities: sanityGlobalContentCapabilities,
    });
  } finally {
    if (pageCleanupRequired) {
      try {
        await cleanupSanityProofDocument(
          input.client,
          scope.dataset,
          publishedId,
        );
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    if (globalCleanupRequired) {
      try {
        await cleanupSanityGlobalProofDocuments(
          input.client,
          scope.dataset,
          globalKey,
        );
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    if (cleanupErrors.length) {
      throw new CmsError({
        code: "VALIDATION_FAILED",
        message:
          "Hosted Sanity verification failed and automatic cleanup also failed; remove the proof document manually.",
        retryable: false,
        details: { publishedId, globalKey },
      });
    }
  }
}

export async function cleanupSanityProofDocument(
  client: SanityClientPort,
  dataset: string,
  publishedId: string,
) {
  await client.request({
    uri: `/data/actions/${dataset}`,
    method: "POST",
    body: {
      actions: [
        {
          actionType: "sanity.action.document.delete",
          includeVersions: [`drafts.${publishedId}`],
          publishedId,
        },
      ],
    },
  });
}

export async function listSanityGlobalProofDocumentIds(
  client: SanityClientPort,
  globalKey: string,
) {
  const records = await client.fetch<Array<{ _id?: string }>>(
    `*[_type in [$documentType, $revisionType] && globalKey == $key]{_id}`,
    {
      documentType: "agencyGlobal",
      revisionType: "agencyGlobalRevision",
      key: globalKey,
    },
    { perspective: "raw", useCdn: false },
  );
  return records
    .map((record) => record._id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

export async function cleanupSanityGlobalProofDocuments(
  client: SanityClientPort,
  dataset: string,
  globalKey: string,
) {
  const ids = await listSanityGlobalProofDocumentIds(client, globalKey);
  if (!ids.length) return;
  await client.request({
    uri: `/data/mutate/${dataset}`,
    method: "POST",
    query: { returnIds: "true", visibility: "sync" },
    body: { mutations: ids.map((id) => ({ delete: { id } })) },
  });
}

function hostedGlobalContent(label: string): SanityHostedGlobalContent {
  return {
    label,
    links: [{ id: "proof-link", label: `${label} link` }],
  };
}

function parseHostedGlobalContent(value: unknown): SanityHostedGlobalContent {
  if (
    !value ||
    typeof value !== "object" ||
    !("label" in value) ||
    typeof value.label !== "string" ||
    !("links" in value) ||
    !Array.isArray(value.links)
  ) {
    validation("Sanity returned malformed hosted global content.");
  }
  return value as SanityHostedGlobalContent;
}

function normalizeScope(input: {
  projectId: string;
  dataset: string;
  documentId: string;
  allowProduction?: boolean;
}) {
  const projectId = input.projectId.trim();
  const dataset = input.dataset.trim();
  const documentId = input.documentId.trim();
  if (!/^[a-z0-9-]+$/i.test(projectId))
    validation("Invalid Sanity project id.");
  if (!/^[a-z0-9_-]+$/i.test(dataset)) validation("Invalid Sanity dataset.");
  if (!/^[a-z0-9_-]{1,80}$/i.test(documentId)) {
    validation("Invalid hosted proof document id.");
  }
  if (dataset === "production" && !input.allowProduction) {
    validation(
      "Hosted conformance is staging-only unless production is explicit.",
    );
  }
  return { projectId, dataset, documentId };
}

function assertExactKeys(
  value: Record<string, unknown>,
  names: readonly string[],
) {
  const actual = Object.keys(value).sort();
  const expected = [...names].sort();
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    "Sanity hosted receipt contains missing or unknown fields.",
  );
}

function assertExactTrueChecks(value: unknown, names: readonly string[]) {
  assert(isRecord(value), "Sanity hosted checks are missing.");
  assertExactKeys(value, names);
  for (const name of names) {
    assert(value[name] === true, `Sanity hosted check ${name} did not pass.`);
  }
}

function assertIsoRange(startedAt: unknown, completedAt: unknown) {
  assert(typeof startedAt === "string", "Sanity hosted start time is invalid.");
  assert(
    typeof completedAt === "string",
    "Sanity hosted completion time is invalid.",
  );
  const start = Date.parse(startedAt);
  const end = Date.parse(completedAt);
  assert(
    Number.isFinite(start) && Number.isFinite(end) && end >= start,
    "Sanity hosted receipt timestamps are invalid.",
  );
}

function assertJsonEqual(value: unknown, expected: unknown, message: string) {
  assert(JSON.stringify(value) === JSON.stringify(expected), message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) validation(message);
}

function validation(message: string): never {
  throw new CmsError({
    code: "VALIDATION_FAILED",
    message,
    retryable: false,
  });
}
