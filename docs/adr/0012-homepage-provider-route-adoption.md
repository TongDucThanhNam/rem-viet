# ADR 0012: Homepage provider route adoption with legacy storage codecs

- Status: Accepted
- Date: 2026-08-16
- Scope: Rèm Việt landing singleton draft save/publish/revisions/restore

> Amendment: ADR 0013 extends this decision to schedule/unschedule and moves
> publish-time schedule cleanup into the provider itself.

## Context

The portable D1 page provider passed conformance but was not used by live API
routes. Direct adoption would have changed the stored block and revision JSON
from the established flattened shape to canonical envelopes. It also would
have skipped the app's audit row, `published_at`, and scheduling cleanup. Any of
those changes would break the additive strangler contract or public reads that
still use the legacy service.

## Decision

The Cloudflare provider accepts two optional storage codecs:

- `encodeBlocks` controls the mutable `pages.blocks` representation.
- `encodeRevision` controls immutable revision snapshots.

It also accepts `prepareMutationStatements`, which contributes D1 statements to
the same batch as a create, save, publish, or restore mutation. The provider
remains template- and audit-schema-neutral; an application adapter supplies
compatibility metadata and audit statements.

The Rèm Việt API adapter canonicalizes all ten landing blocks on read and
flattens them on storage. For homepage publish it adds `published_at`, clears
the schedule fields, and inserts the existing `audit_events` record in the
provider batch. Restore also records the established audit shape. Portable
`CmsError` failures map to the existing tRPC error contract.

The `content.pages.update`, `content.pages.revisions`, `content.pages.publish`,
and `content.pages.restore` routes select this provider adapter only when the
target row is the `home` landing singleton. Draft-save selection also requires
that callers keep the home slug/template and do not request a status transition.
All ordinary pages, homepage draft creation, public reads, schedule, unpublish,
and delete remain on the legacy services until their provider capabilities and
compatibility mapping exist.

## Verification

- Provider unit tests prove custom row/revision codecs and mutation statements
  under the conformance workflow.
- API tests prove the ten-block flattened codec and portable conflict mapping.
- Boundary tests require the three homepage routes to call the adapter.
- The isolated Acme second-site Playwright workflow passes draft isolation,
  publish, revision restore, media, and site-reuse scenarios against real local
  D1/R2 bindings.

## Consequences

- The packaged provider now executes a live reference-application workflow.
- Existing public readers and admin payloads remain compatible during gradual
  route migration.
- This is partial adoption. The routes still branch at the application
  boundary, and general page/media ports remain future work. Scheduling was
  subsequently adopted by ADR 0013.
