# ADR 0018: Page create, unpublish, and delete lifecycle

- Status: Accepted
- Date: 2026-08-16
- Scope: completion of the page-provider lifecycle

## Context

The page provider already created drafts internally, but application routes still
used legacy services for initial create, unpublish, and delete. The runtime also
lacked portable unpublish/delete commands, so provider capabilities and admin
behavior could not describe the complete page lifecycle.

## Decision

The runtime page provider now exposes optimistic `unpublish` and `delete`
commands. Unpublish clears the public revision pointer and published timestamp,
increments the working version, and retains the draft and every immutable
revision. Delete requires the expected working version and atomically deletes
the document plus its revision history. Both commands participate in the
provider mutation/audit batch and return portable conflict/not-found errors.

The Cloudflare provider declares `content.delete`. Its conformance scenario now
proves unpublish isolation, revision retention, document deletion, revision
deletion, stale-command conflicts, and duplicate-slug conflict mapping.

Initial Rèm Việt homepage and standard-page creation, plus their unpublish and
delete routes, select the packaged provider while preserving the legacy tRPC
response shape. The page admin supplies expected versions and exposes unpublish
through the neutral capability model.

## Consequences

- Standard-page browser evidence now covers create, draft isolation, publish,
  unpublish, and delete through provider-native commands.
- Older callers that omit an expected delete version remain accepted by the app
  adapter, which loads the current version before invoking the provider.
- Slug changes that also create redirects remain outside this decision because
  they cross the page and redirect domains and require an explicit atomic
  transaction contract.
