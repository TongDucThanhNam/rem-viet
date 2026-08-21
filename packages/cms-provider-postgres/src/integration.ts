const postgresCmsStorageCapabilities = Object.freeze({
  schedule: true,
  media: true,
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
        provider: "postgres",
        collectionModule: "./src/cms/collections.ts",
        adminRoute: "/admin/cms",
        apiBasePath: "/api/cms",
        databaseUrlEnvironment: "CMS_POSTGRES_URL",
      },
      null,
      2,
    )}\n`,
  },
  {
    path: ".env.cms.example",
    content:
      "# Server-only PostgreSQL and S3-compatible storage configuration.\n" +
      "CMS_POSTGRES_URL=postgresql://user:password@127.0.0.1:5432/agency_cms\n" +
      "CMS_S3_REGION=us-east-1\n" +
      "CMS_S3_BUCKET=replace-with-a-private-bucket\n" +
      "CMS_S3_ACCESS_KEY_ID=replace-with-a-server-only-access-key\n" +
      "CMS_S3_SECRET_ACCESS_KEY=replace-with-a-server-only-secret\n" +
      "# Optional for MinIO, R2 S3 API, and other S3-compatible services.\n" +
      "CMS_S3_ENDPOINT=\n" +
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
  applyPostgresCmsMigrations,
  createPostgresCmsCollectionProvider,
  createPostgresCmsDatabase,
  type PostgresCmsDatabase,
} from "@agency/cms-provider-postgres";
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
  return { actorId: "postgres-admin", capabilities: cmsCapabilities };
}

let database: PostgresCmsDatabase | undefined;
let migration: Promise<void> | undefined;

export async function cmsDatabase() {
  if (!database) {
    const connectionString = serverEnvironment().CMS_POSTGRES_URL?.trim();
    if (!connectionString) {
      throw new Error(
        "CMS_POSTGRES_URL is required before PostgreSQL CMS requests can run.",
      );
    }
    database = createPostgresCmsDatabase({
      connectionString,
      max: 10,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
    });
    migration = applyPostgresCmsMigrations(database);
  }
  await migration;
  return database;
}

export async function createCmsProvider() {
  return createPostgresCmsCollectionProvider({
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
    path: "src/cms/media-storage.server.ts",
    content: `import { createPostgresCmsMediaProvider } from "@agency/cms-provider-postgres";
import {
  createS3CmsObjectStorage,
  createS3DamDeliveryAdapter,
} from "@agency/cms-provider-postgres/s3";

import { cmsDatabase } from "./provider.server";

type ServerProcess = { env?: Record<string, string | undefined> };
const environment =
  (globalThis as { process?: ServerProcess }).process?.env ?? {};

function required(name: string) {
  const value = environment[name]?.trim();
  if (!value) throw new Error(name + " is required for CMS media storage.");
  return value;
}

export function createCmsMediaStorage() {
  const storage = createS3CmsObjectStorage({
    bucket: required("CMS_S3_BUCKET"),
    clientConfig: {
      region: required("CMS_S3_REGION"),
      endpoint: environment.CMS_S3_ENDPOINT?.trim() || undefined,
      forcePathStyle: Boolean(environment.CMS_S3_ENDPOINT?.trim()),
      credentials: {
        accessKeyId: required("CMS_S3_ACCESS_KEY_ID"),
        secretAccessKey: required("CMS_S3_SECRET_ACCESS_KEY"),
      },
    },
  });
  return {
    storage,
    delivery: createS3DamDeliveryAdapter({ storage }),
  };
}

export async function createCmsMediaProvider() {
  const { storage, delivery } = createCmsMediaStorage();
  return createPostgresCmsMediaProvider({
    database: await cmsDatabase(),
    storage,
    deliveryAdapter: delivery,
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
  applyPostgresCmsMigrations as migrateCms,
  createPostgresCmsDatabase,
} from "@agency/cms-provider-postgres";
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
            provider: "postgres",
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
    content: `# Agency CMS PostgreSQL migrations

The PostgreSQL provider owns its idempotent state-table migration. The generated
server integration applies it lazily before the first CMS request. Production
deployment pipelines should call \`migrateCms(database)\` before shifting traffic.
Set \`CMS_POSTGRES_URL\` to a server-only PostgreSQL connection string.
`,
  },
] as const;

/** Provider-owned install files loaded structurally by the neutral CLI. */
export const cmsIntegrationProvider = Object.freeze({
  schemaVersion: 1 as const,
  id: "postgres",
  packageName: "@agency/cms-provider-postgres",
  packageVersion: "0.1.0",
  capabilities: postgresCmsStorageCapabilities,
  diagnostics: Object.freeze({
    databaseBinding: null,
    authenticationEnvironment: "CMS_ADMIN_TOKEN",
    databaseConfigFiles: Object.freeze([]),
  }),
  files: Object.freeze(files.map((file) => Object.freeze(file))),
});
