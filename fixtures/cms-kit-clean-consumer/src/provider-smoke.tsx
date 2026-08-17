import {
  applyCloudflareCmsMigrations,
  createCloudflareCmsCollectionProvider,
  createCloudflareCmsMediaProvider,
  createCloudflareCmsPageProvider,
} from "@agency/cms-provider-cloudflare";
import {
  CmsDraftStatusSlots,
  CmsCollectionAdminShell,
  CmsRevisionList,
  CmsWorkflowActionSlots,
  flushCmsDraft,
  openCmsPreviewAfterSave,
  resolveCmsAdminWorkflow,
  resolveCmsEditorialReviewPresentation,
  runCmsWorkflowCommand,
} from "@agency/cms-admin";
import {
  createCollectionRegistry,
  defineCollection,
  relationshipField,
  textField,
} from "@agency/cms-core";
import {
  composeCmsAlchemyResources,
  createCmsAlchemyResourcePlan,
} from "@agency/cms-alchemy";
import {
  applyCmsFilePlan,
  createCmsMigrationPlan,
  createCmsSiteInitPlan,
  executeCmsMigrationPlan,
  migrateCmsValue,
  rollbackCmsMigration,
  verifyCmsSiteArtifacts,
} from "@agency/cms-cli";
import { CmsBlockRenderer } from "@agency/cms-react";
import {
  runEditorialReviewProviderConformance,
  runCollectionProviderConformance,
  runMediaProviderConformance,
  runPageProviderConformance,
  type CmsPageContent,
} from "@agency/cms-runtime";
import {
  createRemVietBlockRegistry,
  defaultRemVietTemplateBlocks,
  toRemVietTemplateBlock,
  type RemVietTemplateBlock,
} from "@agency/cms-template-rem-viet";
import { renderToStaticMarkup } from "react-dom/server";

import { LocalD1 } from "./libsql-d1";

type Content = CmsPageContent<RemVietTemplateBlock>;

function parseContent(value: unknown): Content {
  const input = value as Content;
  if (
    !input ||
    typeof input.title !== "string" ||
    typeof input.slug !== "string" ||
    !Array.isArray(input.blocks) ||
    !input.seo
  ) {
    throw new Error("Invalid clean-consumer page content");
  }
  return {
    ...input,
    blocks: input.blocks.map((block) => {
      const parsed = toRemVietTemplateBlock(block);
      if (!parsed.success) throw parsed.error;
      return parsed.data;
    }),
  };
}

function page(title: string, prefix: string, question: string): Content {
  const blocks = defaultRemVietTemplateBlocks.map(
    (block): RemVietTemplateBlock => {
      if (block.type === "hero") {
        return {
          ...structuredClone(block),
          data: {
            ...structuredClone(block.data),
            title: { ...block.data.title, prefix },
          },
        };
      }
      if (block.type === "faq") {
        return {
          ...structuredClone(block),
          data: {
            ...structuredClone(block.data),
            items: [
              {
                ...block.data.items[0]!,
                question,
              },
              ...structuredClone(block.data.items.slice(1)),
            ],
          },
        };
      }
      return structuredClone(block);
    },
  );

  return {
    title,
    slug: "home",
    template: "landing",
    blocks,
    seo: {
      title,
      description: `${title} description`,
      canonicalUrl: "",
      ogImage: "",
      robotsIndex: true,
      robotsFollow: true,
    },
  };
}

const database = new LocalD1();
await applyCloudflareCmsMigrations(database);

const acmeLifecycle = {
  drafts: true,
  revisions: true,
  scheduling: true,
} as const;
const acmeAccess = {
  read: [] as const,
  create: ["content.write"] as const,
  update: ["content.write"] as const,
  delete: ["content.delete"] as const,
  publish: ["content.publish"] as const,
};
const acmeAuthors = defineCollection({
  slug: "acme-authors",
  labels: { singular: "Acme author", plural: "Acme authors" },
  schemaVersion: 1,
  lifecycle: acmeLifecycle,
  access: acmeAccess,
  fields: [
    textField({ name: "name", label: "Name", required: true, indexed: true }),
  ],
  admin: { useAsTitle: "name", defaultColumns: ["name"] },
});
const acmeArticles = defineCollection({
  slug: "acme-articles",
  labels: { singular: "Acme article", plural: "Acme articles" },
  schemaVersion: 1,
  lifecycle: acmeLifecycle,
  access: acmeAccess,
  fields: [
    textField({
      name: "title",
      label: "Title",
      required: true,
      indexed: true,
    }),
    relationshipField({
      name: "author",
      label: "Author",
      relationTo: "acme-authors",
      hasMany: false,
      required: true,
      onDelete: "restrict",
    }),
  ],
  admin: { useAsTitle: "title", defaultColumns: ["title", "author"] },
});
const acmeRegistry = createCollectionRegistry([
  acmeAuthors,
  acmeArticles,
] as const);
let acmeSequence = 0;
const acmeProvider = createCloudflareCmsCollectionProvider({
  database,
  registry: acmeRegistry,
  createId: () => `acme-${++acmeSequence}`,
  now: () => new Date("2026-08-17T00:00:00.000Z"),
});
await acmeProvider.createDraft({
  collection: acmeAuthors.slug,
  id: "acme-author-1",
  data: { name: "Ada Acme" },
  actorId: "acme-editor",
});
const acmeEvidence = await runCollectionProviderConformance({
  provider: acmeProvider,
  collection: acmeArticles.slug,
  documentId: "acme-article-1",
  actorId: "acme-editor",
  initial: { title: "Acme launch", author: "acme-author-1" },
  changed: { title: "Acme launch updated", author: "acme-author-1" },
  filter: { field: "title", operator: "equals", value: "Acme launch" },
});
const acmeDocuments = await acmeProvider.list({
  collection: acmeArticles.slug,
  pagination: { limit: 10, offset: 0 },
});
const acmeAdminProps = {
  registry: acmeRegistry,
  collection: acmeArticles.slug,
  collectionHref: (slug: string) => `/admin/collections/${slug}`,
  createHref: "/admin/collections/acme-articles/create",
  editHref: (id: string) => `/admin/collections/acme-articles/${id}`,
  cancelHref: "/admin/collections/acme-articles",
};
const acmeAdminMarkup = [
  renderToStaticMarkup(
    <CmsCollectionAdminShell
      {...acmeAdminProps}
      mode="list"
      documents={acmeDocuments.documents}
      total={acmeDocuments.total}
    />,
  ),
  renderToStaticMarkup(
    <CmsCollectionAdminShell
      {...acmeAdminProps}
      mode="create"
      data={{ title: "", author: "" }}
      relationshipOptions={{
        "acme-authors": [{ id: "acme-author-1", label: "Ada Acme" }],
      }}
    />,
  ),
  renderToStaticMarkup(
    <CmsCollectionAdminShell
      {...acmeAdminProps}
      mode="edit"
      data={acmeDocuments.documents[0]!.data}
      relationshipOptions={{
        "acme-authors": [{ id: "acme-author-1", label: "Ada Acme" }],
      }}
    />,
  ),
].join("");
if (
  !acmeAdminMarkup.includes("Acme articles") ||
  !acmeAdminMarkup.includes("Create Acme article") ||
  !acmeAdminMarkup.includes("Edit Acme article") ||
  !acmeAdminMarkup.includes("Ada Acme") ||
  !acmeAdminMarkup.includes("Filter")
) {
  throw new Error(`Generated Acme collection admin failed: ${acmeAdminMarkup}`);
}

let sequence = 0;
const provider = createCloudflareCmsPageProvider({
  database,
  parseContent,
  createId: () => `clean-consumer-${++sequence}`,
  now: () => new Date("2026-08-16T00:00:00.000Z"),
});
const initial = page("Initial homepage", "Initial Hero", "Initial FAQ?");
const changed = page("Changed homepage", "Changed Hero", "Changed FAQ?");
const evidence = await runPageProviderConformance({
  provider,
  initial,
  changed,
});
const mediaObjects = new Map<string, unknown>();
const mediaEvidence = await runMediaProviderConformance({
  provider: createCloudflareCmsMediaProvider({
    database,
    bucket: {
      async put(key, value) {
        mediaObjects.set(key, value);
      },
      async delete(key) {
        mediaObjects.delete(key);
      },
    },
    resolveUsage: (record) =>
      record.id === "conformance-media" ? [{ type: "page", id: "home" }] : [],
  }),
});
if (mediaObjects.size !== 0) throw new Error("Media object cleanup failed");
const published = await provider.getPublished({ slug: "home" });
if (!published) throw new Error("Published page was not found");

const registry = createRemVietBlockRegistry<Record<string, never>>({
  hero: ({ block }) => <h1>{block.data.title.prefix}</h1>,
  threatNarrative: ({ block }) => (
    <section>{block.data.steps[0]?.title}</section>
  ),
  marquee: ({ block }) => <p>{block.data.text}</p>,
  benefits: ({ block }) => <section>{block.data.title}</section>,
  craftProcess: ({ block }) => <section>{block.data.title}</section>,
  bentoDetails: ({ block }) => <section>{block.data.title}</section>,
  horizontalGallery: ({ block }) => (
    <section>{block.data.titleLines.join(" ")}</section>
  ),
  measurementGuide: ({ block }) => <section>{block.data.title}</section>,
  faq: ({ block }) => <p>{block.data.items[0]?.question ?? ""}</p>,
  footerCta: ({ block }) => <footer>{block.data.title.prefix}</footer>,
});
const html = published.content.blocks
  .map((block) =>
    renderToStaticMarkup(
      <CmsBlockRenderer block={block} context={{}} registry={registry} />,
    ),
  )
  .join("");

if (!html.includes("Changed Hero") || !html.includes("Changed FAQ?")) {
  throw new Error(`Published Hero/FAQ SSR parity failed: ${html}`);
}

const reviewCandidate = await provider.getDraft({ id: "conformance-home" });
if (!reviewCandidate) throw new Error("Review conformance draft was not found");
let reviewDocument = reviewCandidate;
let reviewStep = 0;
const reviewEvidence = await runEditorialReviewProviderConformance({
  workflow: provider.reviews,
  target: { documentId: reviewDocument.id, documentType: "page" },
  advanceDocument: async () => {
    reviewStep += 1;
    reviewDocument = await provider.saveDraft({
      id: reviewDocument.id,
      expectedVersion: reviewDocument.version,
      content: page(
        `Review draft ${reviewStep}`,
        `Review Hero ${reviewStep}`,
        `Review FAQ ${reviewStep}?`,
      ),
      actorId: "clean-consumer-editor",
    });
    return reviewDocument;
  },
  publishDocument: async () => {
    const result = await provider.publish({
      id: reviewDocument.id,
      expectedVersion: reviewDocument.version,
      actorId: "clean-consumer-reviewer",
    });
    reviewDocument = result.document;
    return reviewDocument;
  },
});
const reviewPresentation = resolveCmsEditorialReviewPresentation({
  currentVersion: reviewDocument.version,
  decisionGranted: true,
  dirty: false,
  requestGranted: true,
  state: await provider.reviews.getState({
    documentId: reviewDocument.id,
    documentType: "page",
  }),
});
if (reviewPresentation.kind !== "published") {
  throw new Error("Packed review presentation did not resolve publication");
}

let dirty = true;
const draftFlushed = await flushCmsDraft({
  getState: () => ({ dirty, saving: false }),
  save: async () => {
    dirty = false;
    return { version: 2 };
  },
  waitForActiveSave: async () => undefined,
  settle: async () => undefined,
});
const previewEvents: string[] = [];
const previewResult = await openCmsPreviewAfterSave({
  flushDraft: async () => draftFlushed,
  openPlaceholder: () => ({
    close: () => previewEvents.push("closed"),
    navigate: (url) => previewEvents.push(url),
  }),
  url: "/private-preview",
});
if (
  !draftFlushed ||
  previewResult !== "opened" ||
  previewEvents[0] !== "/private-preview"
) {
  throw new Error("Packed admin workflow primitives failed");
}

const workflowEvents: string[] = [];
const workflowCommand = await runCmsWorkflowCommand({
  current: { id: "consumer", version: 1 },
  dirty: true,
  save: async () => {
    workflowEvents.push("save");
    return { id: "consumer", version: 2 };
  },
  command: async (target) => {
    workflowEvents.push(`publish:${target.version}`);
    return target.version;
  },
});
const workflowMarkup = renderToStaticMarkup(
  <CmsWorkflowActionSlots
    model={resolveCmsAdminWorkflow({
      providerCapabilities: {
        supported: ["content.readDraft", "content.write", "content.publish"],
      },
      grantedCapabilities: ["content.readDraft", "content.write"],
      documentExists: true,
      published: false,
      scheduled: false,
    })}
    slots={{
      preview: <button type="button">Preview</button>,
      publish: <button type="button">Publish</button>,
      save: <button type="button">Save</button>,
    }}
  />,
);
const workflowSurfaceMarkup = renderToStaticMarkup(
  <>
    <CmsDraftStatusSlots state="saved" slots={{ saved: <span>Saved</span> }} />
    <CmsRevisionList
      empty={<span>Empty</span>}
      renderRevision={(revision) => <span>v{revision.version}</span>}
      revisions={[{ id: "consumer-revision", version: 2 }]}
    />
  </>,
);
if (
  workflowCommand !== 2 ||
  workflowEvents.join(",") !== "save,publish:2" ||
  !workflowMarkup.includes("Preview") ||
  !workflowMarkup.includes("Save") ||
  workflowMarkup.includes("Publish") ||
  workflowSurfaceMarkup !== "<span>Saved</span><span>v2</span>"
) {
  throw new Error("Packed admin action composition failed");
}

const infrastructurePlan = createCmsAlchemyResourcePlan({
  manifest: {
    id: "consumer-site",
    siteUrl: "https://consumer.example.com",
    infrastructure: {
      alchemyApp: "consumer-site",
      workerName: "consumer-web",
      d1Name: "consumer-db",
      r2BucketName: "consumer-media",
      backupBucketName: "consumer-backups",
    },
  },
  stage: "staging",
  origin: "https://staging.consumer.example.com",
  bindings: {
    CORS_ORIGIN: "https://staging.consumer.example.com",
    BETTER_AUTH_URL: "https://staging.consumer.example.com",
    BETTER_AUTH_SECRET: "secret",
    ADMIN_EMAILS: "owner@example.com",
  },
});
const composedInfrastructure = composeCmsAlchemyResources(infrastructurePlan, {
  database: ({ name }) => ({ name }),
  mediaBucket: ({ name }) => ({ name }),
  website: ({ name }) => ({ name }),
});
const cliFiles = new Map<string, string>();
const cliPlan = createCmsSiteInitPlan({
  siteId: "consumer-site",
  files: [
    {
      path: "sites/consumer-site/site.manifest.json",
      content: '{"id":"consumer-site"}\n',
      mode: "json-exact",
    },
    {
      path: "sites/consumer-site/seed.sql",
      content: "-- consumer seed\n",
      mode: "preserve",
    },
  ],
});
const cliInit = await applyCmsFilePlan(cliPlan, {
  read: async (path) => cliFiles.get(path) ?? null,
  write: async (path, content) => {
    cliFiles.set(path, content);
  },
});
const cliMigration = migrateCmsValue({
  value: { title: "Version one" },
  currentVersion: 1,
  targetVersion: 2,
  migrations: [
    {
      from: 1,
      to: 2,
      migrate: (value) => ({ ...value, title: "Version two" }),
    },
  ],
});
const cliReleasePlan = createCmsMigrationPlan({
  siteId: "consumer-site",
  stage: "staging",
  target: "consumer-db-staging",
  currentVersion: 1,
  targetVersion: 2,
  steps: [{ id: "0002-consumer", from: 1, to: 2 }],
});
let cliReleaseVersion = 1;
const cliReleaseDriver = {
  inspectVersion: async () => cliReleaseVersion,
  createBackup: async () => ({
    locator: "memory:consumer-db-v1",
    sha256: "c".repeat(64),
    bytes: 64,
  }),
  applyStep: async (step: { to: number }) => {
    cliReleaseVersion = step.to;
  },
  restoreBackup: async () => {
    cliReleaseVersion = 1;
  },
};
const cliReleaseMigration = await executeCmsMigrationPlan(
  cliReleasePlan,
  cliReleaseDriver,
  { confirmation: cliReleasePlan.applyConfirmation },
);
const cliReleaseRollback = await rollbackCmsMigration(
  cliReleasePlan,
  cliReleaseMigration,
  cliReleaseDriver,
  { confirmation: cliReleasePlan.rollbackConfirmation },
);
const cliVerification = verifyCmsSiteArtifacts({
  siteId: "consumer-site",
  files: [...cliFiles.keys()],
  requiredFiles: cliPlan.files.map((file) => file.path),
  resources: {
    database: infrastructurePlan.database.name,
    worker: infrastructurePlan.website.name,
  },
});
if (
  composedInfrastructure.database.name !== "consumer-db-staging" ||
  cliInit.some((result) => result.status !== "created") ||
  cliMigration.version !== 2 ||
  cliReleaseMigration.status !== "applied" ||
  cliReleaseRollback.restoredVersion !== 1 ||
  !cliVerification.ok
) {
  throw new Error("Packed infrastructure/CLI composition failed");
}

console.log(
  JSON.stringify({
    ok: true,
    evidence: {
      ...evidence,
      acmeCollections: acmeEvidence,
      acmeAdmin: acmeAdminMarkup,
      review: reviewEvidence,
      reviewPresentation: reviewPresentation.kind,
      media: mediaEvidence,
      draftFlushed,
      previewResult,
      workflowCommand,
      workflowMarkup,
      workflowSurfaceMarkup,
      infrastructure: {
        database: composedInfrastructure.database.name,
        media: composedInfrastructure.mediaBucket?.name,
        worker: composedInfrastructure.website.name,
      },
      cliInit,
      cliMigration,
      cliReleaseMigration,
      cliReleaseRollback,
      cliVerification,
    },
    html,
  }),
);
database.close();
