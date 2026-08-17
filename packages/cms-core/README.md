# @agency/cms-core

Vendor-neutral, React-free CMS contracts for versioned documents, blocks,
capabilities, migrations, safe links, portable errors, and the canonical
per-site manifest consumed by provisioning tools.

## Code-first collections

`defineCollection()` declares a stable slug, labels, schema version, fields,
lifecycle capabilities, access requirements, and explicit one-version migration
steps. `createCollectionRegistry()` rejects duplicate slugs and provides typed
lookup without provider or application switches. `CmsCollectionData<T>` infers
the authorable data shape from a definition while keeping this package free of
React, database, provider, and brand dependencies.

Editorial handoff is modeled as bounded request/decision schemas with separate
`content.review.request` and `content.review.decide` capabilities. Notes are
trimmed and capped at 500 characters; provider storage, roles, labels, and UI
remain outside the core contract.

`cmsSiteManifestSchema` binds the exact kit/template/provider/content-schema
versions, locales, brand inputs, feature flags, HTTPS production origin, and
isolated infrastructure names. Provider- or template-specific fields belong in
their own configuration rather than weakening this shared contract.
