# `@agency/cms-provider-local`

Local SQLite/libSQL reference provider for Agency CMS. It is intended for local
development, consumer tests, and installations that do not require a hosted
database service.

```ts
import {
  applyLocalCmsMigrations,
  createLocalCmsCollectionProvider,
  createLocalCmsDatabase,
} from "@agency/cms-provider-local";

const database = createLocalCmsDatabase({
  url: "file:.agency-cms/content.db",
});
await applyLocalCmsMigrations(database);

const provider = createLocalCmsCollectionProvider({
  database,
  registry: cmsCollections,
});
```

The local provider has no Cloudflare or Sanity dependency. Its storage
capability manifest is exported as `localCmsStorageCapabilities` and unsupported
capabilities remain explicitly `false` in the install manifest.
