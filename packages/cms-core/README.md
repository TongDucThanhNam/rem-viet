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

Built-in field builders cover text, number, boolean, date/datetime, email, URL,
slug, code, JSON, color, geo points, nested groups/arrays, structured rich text,
media IDs, bounded block arrays, select values, computed/virtual/join values,
and single or polymorphic relationships. Definitions carry typed defaults,
validation metadata, admin hints, and optional declarative visibility.
`parseCmsCollectionData()` is the deterministic storage/import validator;
`parseCmsCollectionDataAsync()` adds field access, pure lifecycle hooks, async
validation, and computed values at the provider mutation boundary.

`defineCmsFieldGroup()`, `extendCmsFieldGroup()`, and
`composeCmsFieldGroups()` provide reusable, type-inferred schema composition
with duplicate-key rejection. `createCmsCollectionJsonSchema()` emits JSON
Schema 2020-12 accepted directly by OpenAPI 3.1, including nested constraints,
relationship targets, derived read-only fields, localization, and admin hints.

`relationshipField()` declares an explicit registered target, to-one/to-many
cardinality, bounds, and `restrict` or `nullify` deletion behavior. Registry
creation rejects missing targets, while `assertCmsRelationshipIntegrity()`
uses a provider-supplied lookup to reject dangling IDs before persistence.

Collections may opt into localization with a bounded locale list and one
default locale. Fields are explicitly shared or localized; marking a field
localized without collection localization is rejected. Relationships to a
localized target must choose `same`, `default`, or `any` locale resolution, so
providers never infer cross-locale integrity behavior.

Editorial handoff is modeled as bounded request/decision schemas with separate
`content.review.request` and `content.review.decide` capabilities. Requests may
carry provider-neutral assignee IDs/roles, mentions, an ISO due date,
notification intent, and a required/optional checklist. Decisions carry the
checklist evidence they completed. IDs are normalized, duplicate checklist IDs
are rejected, and notes are trimmed and capped at 500 characters; provider
storage, role labels, delivery, and UI remain outside the core contract.

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

## Signed extension package lifecycle

`defineCmsExtensionPackageManifest()` declares an extension's compatibility,
permissions, server-only secrets, protected routes, admin slots, runtime
entrypoints, contiguous data migrations, and uninstall policy.
`verifyCmsExtensionPackage()` binds that manifest to a packed artifact, SPDX or
CycloneDX SBOM, source commit, and host-trusted Ed25519 signature before code is
loaded. `inspectCmsExtensionCompatibility()` and
`assertCmsExtensionClientBoundary()` fail closed on missing provider
capabilities/secrets, server code in public bundles, secret exposure, and
undeclared client capabilities.

`createCmsExtensionLifecycleManager()` executes idempotent install,
enable/disable, forward upgrade, receipt-bound reversible rollback, and exact-
artifact uninstall through a provider-owned transaction. Providers can run
`runCmsExtensionLifecycleConformance()` against disposable storage to prove the
full lifecycle. See `docs/cms/extension-sdk-guide.md` for the operating and trust
model.
