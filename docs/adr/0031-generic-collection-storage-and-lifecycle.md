# ADR 0031: Generic collection storage and lifecycle

- Status: Accepted
- Date: 2026-08-17
- Scope: Collection runtime ports, Cloudflare D1 persistence, revisions, and relationships

## Context

The existing Cloudflare adapter intentionally models Rèm Việt pages, globals,
media, and review events with dedicated tables. Code-first consumer collections
cannot reuse that page row shape without adding a new provider switch for every
content type. The core registry now owns versioned fields and relationship
metadata, so storage needs a stable envelope that treats collection data as an
opaque validated document.

## Decision

The neutral runtime exposes generic collection draft/published reads, create,
save, schedule, publish, unpublish, immutable revision list, restore, delete,
and filtered/paginated query ports. Optimistic mutations use the same explicit
expected-version and portable error semantics as pages. Capability-based access
metadata remains in core; the provider accepts a consumer authorization callback
and never imports roles.

Cloudflare migration `0006_generic_collections` adds
`cms_collection_documents` and `cms_collection_revisions`. Documents are keyed
by `(collection_slug, id)` and store the registered schema version plus validated
JSON. Publication appends an immutable snapshot and changes only the published
revision pointer. Draft saves and restores never rewrite that snapshot.

Reads migrate older JSON through the collection's explicit one-version migration
chain before validating it. New writes always persist the current schema.
Filters and sorting accept only registered top-level fields or bounded system
fields, and pagination is capped at 100 items per page. This first vertical
slice evaluates those predicates after decoding the collection rows; provider-
specific generated indexes can be added later without changing the public port.

Relationship targets are checked before create, save, restore, and publish.
Delete scans registered documents and published snapshots in the same provider
boundary. `restrict` references fail closed. `nullify` edits are included in the
delete batch for drafts, while published snapshots must first be unpublished or
republished without the target because immutable revisions are never rewritten.

## Consequences

- Consumers add collections through the registry without changing Cloudflare
  provider code or database schema per collection.
- Existing page/global/media/admin paths remain intact during incremental
  adoption.
- Schema migrations, validation, relationships, permissions, and lifecycle use
  shared contracts rather than route-specific checks.
- The JSON query implementation is correct and bounded for the P0 slice but does
  not yet materialize registry-declared indexes or uniqueness constraints.
- Historical revisions remain immutable even when a relationship target is
  deleted; live published references therefore block deletion.
