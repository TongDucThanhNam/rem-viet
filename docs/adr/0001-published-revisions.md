# ADR 0001: Immutable published revisions

- Status: Accepted
- Date: 2026-08-13
- Owners: Agency CMS core

## Context

`posts` and `pages` currently store the working content and `status` on the same
row. A save to a published row therefore changes the public response before an
explicit publish step. That violates the draft/public isolation required by the
agency starter.

## Decision

- `posts` and `pages` remain the mutable working document.
- Each document points to an immutable `publishedRevisionId`.
- `post_revisions` and `page_revisions` store validated JSON snapshots.
- Public services resolve content only through `publishedRevisionId`; they never
  fall back to working fields.
- Publish creates a snapshot and updates the pointer in one D1 batch.
- Restore copies a historical snapshot to the working document, increments its
  version, and does not change the published pointer.
- A document may remain publicly published while its working document contains
  newer, unpublished edits.
- Existing published rows are backfilled to deterministic `legacy-*` revisions
  by an idempotent migration.
- Revisions cascade when their parent content is permanently deleted. Audit
  records do not cascade.

## Concurrency

Working documents have an integer `version`. Mutations may send
`expectedVersion`; a mismatch is a conflict and must not overwrite newer work.
Autosave will make this required in the human editor milestone.

## Consequences

- Public reads require a join to the revision table.
- Slug lookup uses the published snapshot slug, so editing a slug does not move
  the public URL before publish.
- Unpublish is explicit: clear the published pointer and set working status to
  draft. Historical revisions remain available.
- Invalid revision payloads fail closed and are excluded from public output.
