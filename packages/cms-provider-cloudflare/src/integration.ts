const files = [
  {
    path: "agency-cms.config.json",
    content: `${JSON.stringify(
      {
        schemaVersion: 1,
        framework: "tanstack-start",
        provider: "cloudflare",
        collectionModule: "./src/cms/collections.ts",
        adminRoute: "/admin/cms",
        apiBasePath: "/api/cms",
        databaseBinding: "CMS_DB",
      },
      null,
      2,
    )}\n`,
  },
  {
    path: ".env.cms.example",
    content:
      "# Agency CMS uses a Cloudflare D1 binding, not a database secret.\n" +
      "# Bind the D1 database as CMS_DB in the selected Cloudflare environment.\n" +
      "CMS_DATABASE_BINDING=CMS_DB\n",
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
    content: `import type { CmsCapability } from "@agency/cms-core";
import {
  applyCloudflareCmsMigrations,
  createCloudflareCmsCollectionProvider,
  type CloudflareD1Database,
} from "@agency/cms-provider-cloudflare";
import { createCmsRestResources } from "@agency/cms-runtime";

import { cmsCollections } from "./collections";

export type CmsActor = Readonly<{
  actorId: string;
  capabilities: readonly CmsCapability[];
}>;

export type CmsRequestBindings = Readonly<{
  database: CloudflareD1Database;
  actorFor(request: Request): CmsActor | Promise<CmsActor>;
}>;

export async function createCmsProvider(database: CloudflareD1Database) {
  await applyCloudflareCmsMigrations(database);
  return createCloudflareCmsCollectionProvider({
    database,
    registry: cmsCollections,
  });
}

export async function createCmsApi(bindings: CmsRequestBindings) {
  const provider = await createCmsProvider(bindings.database);
  return createCmsRestResources({
    provider,
    basePath: "/api/cms",
    actorFor: bindings.actorFor,
  });
}
`,
  },
  {
    path: "src/cms/integration.server.ts",
    content: `import type { CmsRequestBindings } from "./provider.server";

type CmsBindingsResolver = (
  request: Request,
) => CmsRequestBindings | Promise<CmsRequestBindings>;

let resolveBindings: CmsBindingsResolver | undefined;

/** Configure this once from the app's server composition root. */
export function configureCmsIntegration(resolver: CmsBindingsResolver) {
  if (resolveBindings && resolveBindings !== resolver) {
    throw new Error("Agency CMS bindings were already configured.");
  }
  resolveBindings = resolver;
}

export async function cmsBindingsFor(request: Request) {
  if (!resolveBindings) {
    throw new Error(
      "CMS_BINDINGS_MISSING: configure the CMS_DB binding and authenticated actor resolver.",
    );
  }
  return resolveBindings(request);
}
`,
  },
  {
    path: "src/cms/handler.server.ts",
    content: `import { cmsBindingsFor } from "./integration.server";
import { createCmsApi } from "./provider.server";

export async function handleCmsRequest(request: Request) {
  try {
    const api = await createCmsApi(await cmsBindingsFor(request));
    return api.handle(request);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("CMS_BINDINGS_MISSING:")
    ) {
      return Response.json(
        {
          code: "CMS_BINDINGS_MISSING",
          message:
            "Agency CMS is installed but its database/auth bindings are not configured.",
        },
        { status: 503, headers: { "cache-control": "no-store" } },
      );
    }
    throw error;
  }
}
`,
  },
  {
    path: "src/cms/migrate.server.ts",
    content: `export {
  applyCloudflareCmsMigrations as migrateCms,
  cloudflareCmsMigrations,
} from "@agency/cms-provider-cloudflare";
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
            provider: "cloudflare",
            databaseBinding: "CMS_DB",
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
    content: `# Agency CMS migrations

The Cloudflare provider owns its ordered, idempotent migration definitions.
Call \`migrateCms(database)\` from \`src/cms/migrate.server.ts\` with the D1
binding named \`CMS_DB\` during deployment. Do not copy provider SQL into the
application; package upgrades must keep the migration chain authoritative.
`,
  },
] as const;

/** Provider-owned install files loaded structurally by the neutral CLI. */
export const cmsIntegrationProvider = Object.freeze({
  schemaVersion: 1 as const,
  id: "cloudflare",
  packageName: "@agency/cms-provider-cloudflare",
  packageVersion: "0.1.0",
  capabilities: Object.freeze({
    schedule: true,
    media: true,
    webhook: false,
    release: false,
    localization: true,
    transaction: true,
    search: false,
  }),
  diagnostics: Object.freeze({
    databaseBinding: "CMS_DB",
    authenticationEnvironment: null,
    databaseConfigFiles: Object.freeze([
      "wrangler.jsonc",
      "wrangler.toml",
      "wrangler.json",
    ]),
  }),
  files: Object.freeze(files.map((file) => Object.freeze(file))),
});
