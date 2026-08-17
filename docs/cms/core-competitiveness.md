# Core CMS competitiveness execution evidence

This ledger records the implementation evidence for the active `CMP-001`
through `CMP-006` vertical slice. The scope is core product capability; external
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
