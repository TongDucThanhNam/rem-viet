const localCmsStorageCapabilities = Object.freeze({
  schedule: true,
  media: false,
  webhook: false,
  release: false,
  localization: true,
  transaction: true,
  search: false,
});

const files = [
  {
    path: "agency-cms.config.json",
    content: `${JSON.stringify(
      {
        schemaVersion: 1,
        framework: "tanstack-start",
        provider: "local",
        collectionModule: "./src/cms/collections.ts",
        adminRoute: "/admin/cms",
        apiBasePath: "/api/cms",
        databaseUrlEnvironment: "CMS_LOCAL_DATABASE_URL",
      },
      null,
      2,
    )}\n`,
  },
  {
    path: ".env.cms.example",
    content:
      "# Copy these values into the server-only local development environment.\n" +
      "CMS_LOCAL_DATABASE_URL=file:.agency-cms/content.db\n" +
      "# Generate at least 32 random characters; never expose this to client code.\n" +
      "CMS_ADMIN_TOKEN=replace-with-a-random-server-only-token\n",
  },
  {
    path: "src/cms/collections.ts",
    content: `import {
  createCollectionRegistry,
  defineCollection,
  textField,
} from "@agency/cms-core";

export const pagesCollection = defineCollection({
  slug: "pages",
  labels: { singular: "Page", plural: "Pages" },
  schemaVersion: 1,
  fields: [
    textField({
      name: "title",
      label: "Title",
      required: true,
      indexed: true,
      validation: { minLength: 1, maxLength: 200 },
    }),
    textField({
      name: "slug",
      label: "Slug",
      required: true,
      indexed: true,
      unique: true,
      validation: {
        minLength: 1,
        maxLength: 200,
        pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
      },
    }),
  ],
  lifecycle: { drafts: true, revisions: true, scheduling: true },
  access: {
    read: ["content.readDraft"],
    create: ["content.write"],
    update: ["content.write"],
    delete: ["content.delete"],
    publish: ["content.publish"],
  },
  admin: { useAsTitle: "title", defaultColumns: ["title", "slug"] },
});

export const cmsCollections = createCollectionRegistry([pagesCollection]);
`,
  },
  {
    path: "src/cms/provider.server.ts",
    content: `import { CmsError, type CmsCapability } from "@agency/cms-core";
import {
  applyLocalCmsMigrations,
  createLocalCmsCollectionProvider,
  createLocalCmsDatabase,
  type LocalCmsDatabase,
} from "@agency/cms-provider-local";
import { createCmsRestResources } from "@agency/cms-runtime";

import { cmsCollections } from "./collections";

const cmsCapabilities = Object.freeze([
  "content.readDraft",
  "content.write",
  "content.publish",
  "content.schedule",
  "content.restore",
  "content.delete",
] satisfies readonly CmsCapability[]);

type ServerProcess = { env?: Record<string, string | undefined> };

function serverEnvironment() {
  return (globalThis as { process?: ServerProcess }).process?.env ?? {};
}

function constantTimeEqual(left: string, right: string) {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

export function cmsActorFor(request: Request) {
  const expected = serverEnvironment().CMS_ADMIN_TOKEN?.trim();
  const authorization = request.headers.get("authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  if (!expected || expected.length < 32 || !constantTimeEqual(expected, supplied)) {
    throw new CmsError({
      code: "FORBIDDEN",
      message: "A valid server-only CMS admin bearer token is required.",
      retryable: false,
    });
  }
  return { actorId: "local-admin", capabilities: cmsCapabilities };
}

let database: LocalCmsDatabase | undefined;
let migration: Promise<void> | undefined;

async function cmsDatabase() {
  if (!database) {
    database = createLocalCmsDatabase({
      url:
        serverEnvironment().CMS_LOCAL_DATABASE_URL?.trim() ||
        "file:.agency-cms/content.db",
    });
    migration = applyLocalCmsMigrations(database);
  }
  await migration;
  return database;
}

export async function createCmsProvider() {
  return createLocalCmsCollectionProvider({
    database: await cmsDatabase(),
    registry: cmsCollections,
  });
}

export async function createCmsApi() {
  return createCmsRestResources({
    provider: await createCmsProvider(),
    basePath: "/api/cms",
    actorFor: cmsActorFor,
  });
}
`,
  },
  {
    path: "src/cms/handler.server.ts",
    content: `import { createCmsApi } from "./provider.server";

export async function handleCmsRequest(request: Request) {
  const api = await createCmsApi();
  return api.handle(request);
}
`,
  },
  {
    path: "src/cms/migrate.server.ts",
    content: `export {
  applyLocalCmsMigrations as migrateCms,
  createLocalCmsDatabase,
} from "@agency/cms-provider-local";
`,
  },
  {
    path: "src/routes/api/cms/$.ts",
    content: `import { createFileRoute } from "@tanstack/react-router";

import { handleCmsRequest } from "../../../cms/handler.server";

const handle = ({ request }: { request: Request }) =>
  handleCmsRequest(request);

export const Route = createFileRoute("/api/cms/$")({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
      PATCH: handle,
      DELETE: handle,
    },
  },
});
`,
  },
  {
    path: "src/routes/api/cms/health.ts",
    content: `import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/cms/health")({
  server: {
    handlers: {
      GET: () =>
        Response.json(
          {
            ok: true,
            framework: "tanstack-start",
            provider: "local",
          },
          { headers: { "cache-control": "no-store" } },
        ),
    },
  },
});
`,
  },
  {
    path: "src/routes/admin/cms.tsx",
    content: `import { CmsCollectionAdminShell } from "@agency/cms-admin";
import { createFileRoute } from "@tanstack/react-router";

import { cmsCollections } from "../../cms/collections";

export const Route = createFileRoute("/admin/cms")({
  component: CmsAdminRoute,
});

function CmsAdminRoute() {
  return (
    <main>
      <h1>Content management</h1>
      <CmsCollectionAdminShell
        registry={cmsCollections}
        collection="pages"
        mode="list"
        collectionHref={(slug) => "/admin/cms?collection=" + slug}
        createHref="/admin/cms?mode=create"
        editHref={(id) =>
          "/admin/cms?mode=edit&id=" + encodeURIComponent(id)
        }
        cancelHref="/admin/cms"
        documents={[]}
      />
    </main>
  );
}
`,
  },
  {
    path: "cms/migrations/README.md",
    content: `# Agency CMS local migrations

The local provider stores content in SQLite/libSQL and owns its idempotent
migration. The generated server integration applies it lazily before the first
CMS request. Set \`CMS_LOCAL_DATABASE_URL\` to move the database; the default is
\`file:.agency-cms/content.db\`.
`,
  },
] as const;

/** Provider-owned install files loaded structurally by the neutral CLI. */
export const cmsIntegrationProvider = Object.freeze({
  schemaVersion: 1 as const,
  id: "local",
  packageName: "@agency/cms-provider-local",
  packageVersion: "0.1.0",
  capabilities: localCmsStorageCapabilities,
  diagnostics: Object.freeze({
    databaseBinding: null,
    authenticationEnvironment: "CMS_ADMIN_TOKEN",
    databaseConfigFiles: Object.freeze([]),
  }),
  files: Object.freeze(files.map((file) => Object.freeze(file))),
});
