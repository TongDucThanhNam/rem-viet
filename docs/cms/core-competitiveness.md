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
