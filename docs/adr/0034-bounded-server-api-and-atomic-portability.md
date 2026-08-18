# ADR 0034: bounded server API and atomic portability

Date: 2026-08-18

## Status

Accepted.

## Context

Consumers need a typed content API without reproducing provider calls, plus a
small HTTP surface and a safe way to move content between compatible
installations. Free-form provider queries, transport-specific core contracts,
or serial best-effort imports would weaken the package boundary and could leak
private infrastructure details or partially persist content.

## Decision

The runtime owns a registry-derived server SDK over the existing collection
provider. It exposes collection reads, bounded queries, mutations, lifecycle,
relationships, revisions, and explicit locale/fallback options. A Fetch adapter
registers only collection/document/revision/action resources generated from the
same registry. It caps pages, filters, and request bodies, checks collection
capabilities before provider calls, and serializes the existing `CmsError`
contract. Unknown failures receive a generic message with no provider details.

Portable bundles use schema version 1 and carry a registry manifest plus
canonical draft, published, schedule, relationship, and locale state. Stable
sorting and recursive key ordering make export deterministic. Credentials,
provider rows, audit records, module code, and private metadata are excluded.

Import fully validates the bundle and target registry, runs collection
migrations and shared field parsing, checks relationships (including targets in
the same bundle), reads target versions, and builds a complete report before a
write. Validation-only and dry-run modes never call the write boundary. An
apply with any validation failure, missing relationship, or conflict also does
not write. The reference provider rechecks authorization, versions, hooks,
schemas, and relationships, then executes guarded statements in one D1 batch.

## Consequences

- SDK data types remain derived from consumer collection definitions.
- REST is intentionally bounded and does not offer arbitrary SQL-like query or
  method dispatch.
- Imports either apply the accepted plan atomically or persist none of it.
- Existing collection migrations are reused and surfaced in the import report.
- Canonical generic collection state is portable. Temporary application legacy
  projections remain the responsibility of their established migration/backfill
  adapters until those projections are retired.
