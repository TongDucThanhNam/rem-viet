# ADR 0009: Runtime ports and Cloudflare page-provider semantics

- Status: Accepted
- Date: 2026-08-16
- Scope: KIT-008 through KIT-013

## Context

Rèm Việt already has working Drizzle services for page drafts, immutable page
revisions, publish, optimistic conflicts, and restore. Those services expose
application rows and depend directly on the repository database package. The
Platform Kit needs the same behavior behind a portable contract without making
Drizzle tables part of the public API or inventing one large provider interface.

## Decision

`@agency/cms-runtime` owns three small page workflow ports:

- `ContentReader` reads normalized working drafts and published snapshots.
- `DraftWriter` creates and saves drafts with an expected version.
- `PublishingWorkflow` publishes, lists revisions, and restores a revision into
  the working draft.

The ports use normalized `CmsPageContent`, `CmsPageDocument`, and
`CmsPageRevision` values. They expose no SQL, Drizzle, Cloudflare, route, or UI
type. Portable failures use `CmsError`; a stale expected version is always
`CONFLICT`.

`@agency/cms-provider-cloudflare` implements the ports using the structural D1
statement and batch API. It preserves the existing `pages` and
`page_revisions` persistence model. It does not add a generic content table.
Template validation is injected as `parseContent`, so the provider does not
import Rèm Việt schemas.

Version semantics are:

1. A new draft starts at version 1.
2. Save, publish, and restore each increment the working version once.
3. Publish inserts an immutable snapshot and updates `published_revision_id` in
   one D1 batch.
4. The revision insert is conditional on the expected working version, so a
   racing stale publish cannot leave an orphan revision.
5. Published reads resolve only through `published_revision_id`; later draft
   saves cannot change the public response.
6. Restore copies a validated historical snapshot into the working draft and
   never changes `published_revision_id`.

The provider declares only the capabilities implemented in this slice:
`content.readDraft`, `content.write`, `content.publish`, and `content.restore`.
Scheduling and R2 media remain separate later ports.

## Verification contract

`runPageProviderConformance` is provider-neutral and proves empty-state reads,
draft isolation, stale-version rejection, two immutable publishes, revision
listing, and restore-without-publish. The Cloudflare package runs it against:

- a libSQL-backed D1 statement adapter for fast migration fixtures; and
- an isolated Miniflare D1 binding for reference-runtime semantics.

The clean consumer runs the same conformance scenario from packed artifacts,
then renders the published Hero/FAQ blocks through `@agency/cms-react`.

## Consequences

- Provider consumers do not import the Rèm Việt DB schema or Drizzle.
- Existing Rèm Việt API routes remain compatible during the additive
  strangler phase; their tables and revision semantics match the adapter.
- The app service is not removed in this release. Moving route ownership onto
  the runtime is a later compatibility step after the vertical slice is stable.
- The next eight blocks may move only through the template registry; their
  extraction must not broaden the provider contract.

Post-decision note: ADR 0012 records the later, partial adoption of homepage
draft-save, revision-list, publish, and restore routes using storage codecs and
injected mutation statements. The remaining routes still follow this ADR's
additive strangler constraint.
