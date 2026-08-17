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
