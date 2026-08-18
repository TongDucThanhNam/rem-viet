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

Built-in field builders cover text, number, boolean, date/datetime, structured
rich text, media IDs, bounded block arrays, and single/multiple select values.
Each definition carries typed defaults, validation metadata, admin hints, and
optional declarative visibility. `parseCmsCollectionData()` is the shared,
strict validator for migrations, provider writes, and authoring UI.

`relationshipField()` declares an explicit registered target, to-one/to-many
cardinality, bounds, and `restrict` or `nullify` deletion behavior. Registry
creation rejects missing targets, while `assertCmsRelationshipIntegrity()`
uses a provider-supplied lookup to reject dangling IDs before persistence.

Editorial handoff is modeled as bounded request/decision schemas with separate
`content.review.request` and `content.review.decide` capabilities. Notes are
trimmed and capped at 500 characters; provider storage, roles, labels, and UI
remain outside the core contract.

`cmsSiteManifestSchema` binds the exact kit/template/provider/content-schema
versions, locales, brand inputs, feature flags, HTTPS production origin, and
isolated infrastructure names. Provider- or template-specific fields belong in
their own configuration rather than weakening this shared contract.

## Feature modules and lifecycle hooks

`defineFeatureModule()` packages collections, lifecycle hooks, permission
metadata, one-step migrations, and provider-neutral admin contributions.
`createCmsExtensionRegistry()` validates duplicate IDs, missing dependencies,
dependency cycles, and unknown collection targets, then returns an isolated
registry instance. There is no process-global module state.

Hooks use `defineCmsLifecycleHook()` and cover `validate`, `create`, `update`,
`publish`, `unpublish`, `restore`, and `delete`. Modules are topologically
ordered by dependency and stable ID; hooks then run by module order, numeric
`order`, and hook ID. A hook may return `{ data }` to transform the next hook's
input. Reference adapters execute `validate` followed by the operation hook
after authorization and optimistic-version checks but before assembling their
transaction. A thrown error aborts the operation without a write; hooks do not
provide post-commit side effects. Use an adapter's transaction contribution API
for database effects that must commit atomically with the content mutation.
