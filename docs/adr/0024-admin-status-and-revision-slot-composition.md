# ADR 0024: Admin status and revision slot composition

- Status: Accepted
- Date: 2026-08-16
- Scope: reusable workflow surface below the outer admin shell

## Context

Action capability and command ordering were neutral, but the homepage,
standard-page, and post editors still owned repeated branching for draft state
and revision-list lifecycle. Moving localized copy, confirmation dialogs, or
design-system classes into the package would make it Rèm Việt-specific.

## Decision

`@agency/cms-admin` adds two presentation-injection primitives:

- `CmsDraftStatusSlots` selects an application-provided node from the neutral
  `CmsDraftSaveState` state machine.
- `CmsRevisionList` owns loading/empty/list selection and stable revision keys,
  while the application injects every row and action.
- `compareCmsBlockRevisions` computes provider-neutral structural metadata from
  stable block IDs: added, removed, content-modified, reordered, and combined
  changes. Reorder detection compares the relative order of surviving blocks,
  so a neighboring insertion or deletion is not reported as a move.
- `compareCmsRevisionFields` accepts application-provided field readers and
  returns only keys and localized labels for changed metadata. Raw values remain
  inside the authenticated consumer and are never copied into generic summaries.

Homepage and post save status use the shared status selector. Homepage and
standard-page revision cards use the shared revision list. All three editors can
expand any immutable revision and compare it with the current working draft
before deciding whether to restore. The flagship homepage uses stable-ID block
structure plus page/SEO metadata and includes unsaved canvas state; standard
pages and posts use value-safe field definitions matching their existing form
contracts. Localized copy, accessibility attributes, restore confirmations,
mutations, and styling stay in the application.

## Consequences

- Action, status, and revision lifecycle composition now ship together without
  creating a second app shell or design system.
- The tarball consumer proves the primitives render from the public package API.
- Unit coverage proves deep JSON comparison, duplicate-ID rejection, relative
  reorder semantics, and value-free metadata output. Authenticated browser
  coverage publishes changed homepage, standard-page, and post drafts, expands
  earlier revision summaries, runs accessibility audits, then completes the
  existing publish/redirect/restore lifecycles.
- tRPC bindings, outer navigation/layout, and conflict recovery copy remain
  explicit consumer adapters.
