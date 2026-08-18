# Core CMS competitiveness execution evidence

This ledger records the implementation evidence for the active `CMP-001`
through `CMP-009` track. The scope is core product capability; external
release, operations, registry, credential, and paid-adoption receipts are
deliberately excluded.

## CMP-001 — collection contracts

Status: **Complete (2026-08-17).**

- `@agency/cms-core` exposes stable collection/field identifiers, collection
  labels, schema versions, explicit contiguous migrations, draft/revision/
  scheduling lifecycle metadata, and capability-based access metadata.
- `defineCollection()` rejects malformed definitions, duplicate fields,
  invalid lifecycle combinations, unknown capabilities, and incomplete schema
  migration chains.
- `createCollectionRegistry()` gives consumers typed lookup and rejects
  duplicate slugs without a provider, React, database, template, or brand
  dependency.
- `CmsCollectionData<T>` infers required and optional authoring data from the
  public definition.

Targeted verification:

```text
bun --cwd packages/cms-core test        # 8 pass, 0 fail
bun --cwd packages/cms-core check-types # pass
```

## CMP-002 — typed fields and shared validation

Status: **Complete (2026-08-17).**

- Public field builders cover text, number, boolean, date/datetime, structured
  rich text, media IDs, versioned block envelopes, and typed single/multiple
  selects.
- Definitions carry typed defaults, field-specific bounds/options, indexing and
  uniqueness hints, authoring descriptions/read-only hints, and declarative
  conditional visibility.
- `parseCmsCollectionData()` applies defaults, rejects unknown keys, validates
  every built-in kind, and enforces required fields only while their declared
  visibility condition is active. It is the shared contract intended for
  provider writes, migrations, and generated admin forms.
- Definition-time checks reject invalid defaults, regular expressions, ranges,
  duplicate select/block options, and missing/self visibility dependencies.

Targeted verification:

```text
bun --cwd packages/cms-core test        # 12 pass, 0 fail
bun --cwd packages/cms-core check-types # pass
```

## CMP-003 — relationships and integrity contracts

Status: **Complete (2026-08-17).**

- `relationshipField()` defines a typed target collection, to-one/to-many
  cardinality, optional item bounds, and explicit `restrict`/`nullify` deletion
  policy.
- Registry creation rejects relationship definitions whose targets are not in
  the same consumer registry. Required relationships cannot declare a
  nullification policy.
- `collectCmsRelationshipReferences()` creates normalized reference records and
  `assertCmsRelationshipIntegrity()` rejects dangling targets through a neutral
  async lookup supplied by a provider.
- `nullifyCmsRelationshipTarget()` is a deterministic, database-free fixture
  for provider delete transactions; the core tests cover to-one, to-many,
  dangling, missing-target, restrict metadata, and nullification behavior.

Targeted verification:

```text
bun --cwd packages/cms-core test        # 16 pass, 0 fail
bun --cwd packages/cms-core check-types # pass
```

## CMP-004 — generic runtime and Cloudflare lifecycle

Status: **Complete (2026-08-17).**

- `@agency/cms-runtime` exposes registry-based collection CRUD, separate draft
  and published reads, schedule/unschedule, publish/unpublish, immutable
  revisions, restore, delete, and filtered/sorted/paginated list contracts.
- The runtime includes capability-based access enforcement and a portable
  lifecycle conformance scenario without application roles, D1, or React.
- Cloudflare migration `0006_generic_collections` adds generic document and
  revision envelopes. `CloudflareCmsCollectionProvider` uses the registry and
  shared parser for every collection; there is no slug-specific provider switch.
- Stored schema-v1 fixture data migrates through a registered schema-v2 chain on
  read. Creates, saves, restores, and publishes validate fields and relationship
  targets; stale writes return portable conflicts.
- D1 conformance proves draft isolation, filters, pagination, scheduling,
  publication, revisions, restore, dangling-reference rejection,
  restrict/nullify deletion, and an authorization callback. Existing page,
  global, media, review, Miniflare, and migration tests continue to pass.

Decision record: `docs/adr/0031-generic-collection-storage-and-lifecycle.md`.

Targeted verification:

```text
bun --cwd packages/cms-runtime test                    # 3 pass, 0 fail
bun --cwd packages/cms-runtime check-types             # pass
bun --cwd packages/cms-provider-cloudflare test        # 13 pass, 0 fail
bun --cwd packages/cms-provider-cloudflare check-types # pass
bun run cms:migrations:verify                          # pass (12 migrations)
bun test scripts/cms-kit-boundaries.test.ts            # 20 pass, 0 fail
```

## CMP-005 — registry-generated admin UI

Status: **Complete (2026-08-17).**

- Collection definitions may declare a validated title field and default list
  columns; references to unknown fields fail at registry definition time.
- `CmsCollectionAdminShell` generates semantic collection navigation,
  filter/search controls, captioned list tables, create links, edit links, and
  create/edit forms directly from the registry.
- Built-in accessible controls cover text, number, boolean, date/datetime,
  select, media, structured rich text, blocks, and to-one/to-many relationships.
  The application supplies relationship options without coupling the package to
  a provider or transport.
- Form submit runs the same core parser used by migrations and provider writes;
  field errors map to an alert summary and labelled controls. Declarative
  visibility is shared with the core contract.
- `createCollectionFieldControlRegistry()` supports field-specific and kind-wide
  React overrides, so templates can retain premium rich-text/media/block UX
  without forking navigation, list, filter, or workflow surfaces.

Targeted verification:

```text
bun --cwd packages/cms-core test            # 16 pass, 0 fail
bun --cwd packages/cms-core check-types     # pass
bun --cwd packages/cms-admin test           # 24 pass, 0 fail
bun --cwd packages/cms-admin check-types    # pass
bun test scripts/cms-kit-boundaries.test.ts # 20 pass, 0 fail
```

## CMP-006 — Rèm Việt and independent Acme vertical slice

Status: **Complete (2026-08-17).**

- The template package publishes `remVietStandardPagesCollection`, a versioned
  public collection definition for the real standard-page content type. Its
  shared fields cover slug/title, bounded standard blocks, SEO, robots policy,
  lifecycle, permission metadata, and generated-admin metadata.
- The live Rèm Việt API now composes `CloudflareCmsCollectionProvider` through
  `createCmsPageCollectionAdapter()`. The public page/editor/router contract is
  unchanged, while generic storage owns draft/published reads, validation,
  scheduling, revisions, restore, queries, and optimistic versions.
- Application migration `0012_worried_devos.sql` creates the generic D1 tables
  and idempotently backfills standard pages and immutable revisions. Legacy
  flattened blocks are converted to canonical versioned block envelopes.
- Generic provider mutation hooks keep the existing `pages` and
  `page_revisions` projection, editorial review resolution, audit events, and
  slug redirects in the same D1 batch. This preserves existing admin listing,
  preview, permissions, scheduling metadata, public rendering, SEO, and review
  behavior during the incremental migration.
- The API integration test drives create, save, schedule/unschedule, review
  request/approval, publish, public lookup, immutable revision, audit, redirect,
  and delete through the generic provider, then verifies the legacy projection.
- The packed clean consumer defines independent `acme-authors` and
  `acme-articles` collections through installed public tarballs. Its typed
  author relationship is persisted and validated by the same generic provider;
  lifecycle conformance passes and `CmsCollectionAdminShell` renders accessible
  list, filter, create, edit, and relationship-picker markup from that registry.
- Core, runtime, and provider retain the documented dependency direction; no
  collection slug switch was added to core or the Cloudflare provider.

Targeted verification:

```text
bun test packages/api/tests/standard-page-runtime.test.ts # 1 pass, 0 fail
bun run cms:migrations:verify                             # pass (13 migrations; upgraded collection fixture)
bun run cms:kit:consumer                                  # packed install/typecheck/build/provider smoke pass
bun --cwd packages/cms-template-rem-viet test             # 15 pass, 0 fail
bun run check-types                                       # 18 package tasks pass
```

Full track gate:

```text
bun run quality # pass: audits, formatting, tests, 13 migrations, packed consumer/upgrade,
                # typechecks, secure build, performance, Rèm Việt E2E, and Acme reuse E2E
```

## CMP-007 — typed lifecycle hooks and feature modules

Status: **Complete (2026-08-18).**

- `@agency/cms-core` exposes typed `validate`, `create`, `update`, `publish`,
  `unpublish`, `restore`, and `delete` hooks. Hooks may validate or transform
  data, and deterministic ordering is dependency order, explicit hook order,
  then stable hook ID.
- `defineFeatureModule()` registers collections, hooks, permission metadata,
  executable one-version migrations, and provider-neutral admin contributions.
  Registry construction rejects duplicate IDs/slugs, missing dependencies,
  cycles, and unknown collection targets.
- Every `createCmsExtensionRegistry()` call owns isolated state; tests prove an
  installed module cannot leak hooks into another registry.
- The Cloudflare provider authorizes before hooks and runs validation plus the
  operation hook before assembling its D1 batch. Transformed data is parsed and
  relationship-checked again. A hook error leaves the document and every
  compatibility statement unchanged; the provider conformance test exercises
  every event, transform ordering, failure rollback, and unauthorized calls.
- Rèm Việt installs `remVietStandardPagesModule` in its live compatibility
  adapter. The packed Acme consumer independently installs `acme-content`, runs
  its hook, persists relationships, completes lifecycle conformance, and renders
  the generated admin shell using the same public APIs.

Decision record:
`docs/adr/0032-instance-scoped-feature-modules-and-hooks.md`.

Targeted verification:

```text
bun --cwd packages/cms-core test                         # 19 pass, 0 fail
bun --cwd packages/cms-core check-types                  # pass
bun --cwd packages/cms-provider-cloudflare test          # 14 pass, 0 fail
bun --cwd packages/cms-provider-cloudflare check-types   # pass
bun test packages/api/tests/standard-page-runtime.test.ts # 1 pass, 0 fail
bun --cwd packages/cms-template-rem-viet test            # 15 pass, 0 fail
bun run cms:kit:consumer                                 # packed install/typecheck/build/provider smoke pass
```

## CMP-008 — explicit locale lifecycle

Status: **Complete (2026-08-18).**

- Collection definitions declare supported/default locales, and each field is
  explicitly shared or localized. Registry validation rejects incoherent field
  and relationship locale policies.
- Every generic lifecycle operation carries locale. Draft, schedule,
  publication, revisions, restore, unpublish, and delete are independent per
  locale; fallback is opt-in and marked with `fallbackFrom`.
- Cloudflare migration `0007_collection_locales` uses locale in document and
  revision identity while preserving legacy rows. Shared fields remain rooted
  in the default locale, and localized relationship checks obey `same`,
  `default`, or `any` resolution.
- Generated admin surfaces expose locale selection, shared/localized field
  labels, fallback state, and locale-aware edit/preview URLs.
- Rèm Việt supplies a Vietnamese/English campaign fixture. The packed Acme
  consumer independently publishes Vietnamese and English author/article
  variants with a same-locale relationship through installed tarballs.

Decision record: `docs/adr/0033-explicit-locale-lifecycle-and-fallback.md`.

Targeted verification:

```text
bun --cwd packages/cms-core test                         # 21 pass, 0 fail
bun --cwd packages/cms-runtime test                      # 3 pass, 0 fail
bun --cwd packages/cms-provider-cloudflare test          # 15 pass, 0 fail
bun --cwd packages/cms-admin test                        # 25 pass, 0 fail
bun test packages/api/tests/standard-page-runtime.test.ts # 2 pass, 0 fail
bun run cms:migrations:verify                            # pass (14 migrations)
bun run cms:kit:consumer                                 # packed localized consumer pass
```

## CMP-009 — typed server API and atomic portability

Status: **Complete (2026-08-18).**

- `createCmsServerSdk()` derives collection data and operations from a registry
  and exposes reads, bounded queries, create/update, publish/schedule/unpublish,
  revisions/restore/delete, relationship resolution, and locale/fallback input.
- `createCmsRestResources()` generates an allow-listed Fetch surface from those
  contracts. It enforces capabilities, 100-row pages, five-filter queries,
  bounded JSON bodies, registered fields/routes, and sanitized shared-error
  responses with no provider/database details.
- Deterministic schema-v1 export carries registry identity and canonical draft,
  published, schedule, relationship, and locale state while excluding secrets,
  provider rows, audit data, and module/private configuration.
- Import supports validation-only, dry-run, and apply. Reports distinguish
  creates, updates, skips, conflicts, missing relationships, validation
  failures, and required collection migrations before any write.
- The Cloudflare apply boundary repeats authorization/hook/schema/relationship
  checks and uses guarded statements in one D1 batch. A rejected later hook and
  partly invalid Rèm Việt/Acme bundles prove earlier documents do not persist.
- Rèm Việt's installed bilingual campaign and the packed Acme author/article
  module both exercise SDK relationship reads, bounded REST, deterministic
  export, write-free dry runs, successful published imports, and atomic
  rejection through the public installed-package APIs.

Decision record: `docs/adr/0034-bounded-server-api-and-atomic-portability.md`.

Targeted verification:

```text
bun --cwd packages/cms-runtime test                      # 3 pass, 0 fail
bun --cwd packages/cms-runtime check-types               # pass
bun --cwd packages/cms-provider-cloudflare test          # 16 pass, 0 fail
bun --cwd packages/cms-provider-cloudflare check-types   # pass
bun test packages/api/tests/standard-page-runtime.test.ts # 2 pass, 0 fail
bun run cms:kit:consumer                                 # packed SDK/REST/portability proof pass
bun test scripts/cms-kit-boundaries.test.ts              # 20 pass, 0 fail
```
