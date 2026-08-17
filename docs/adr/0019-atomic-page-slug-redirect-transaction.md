# ADR 0019: Atomic page-slug and redirect transaction

- Status: Accepted
- Date: 2026-08-16
- Scope: published standard-page slug changes

## Context

Changing a published page slug can strand inbound links. The legacy service
updated the page first and created a redirect in a separate call, allowing a
partial success. The packaged page provider already supported application-owned
statements in its mutation batch, but the redirect intent and graph validation
were not composed through that boundary.

## Decision

The standard-page adapter normalizes the target slug and validates the active
redirect graph before saving. When the editor requests a redirect for a
published page, it injects the redirect row and its audit row into the provider's
optimistic page-save batch alongside the page update and page audit. A unique or
statement failure rejects the portable command and rolls back every statement.

Redirect graph policy remains application-owned because it depends on the full
Rèm Việt redirect corpus. D1 transaction execution remains provider-owned. The
runtime/provider contract stays neutral through its established application
mutation-statement hook; it does not import the redirect schema.

## Consequences

- A successful published slug change updates the working page and creates the
  301 redirect atomically before the new immutable revision is published.
- A provider integration test proves that a conflicting application statement
  leaves the page content and version unchanged.
- The Acme browser lifecycle proves the old path returns 301, resolves to the new
  slug, and renders the newly published snapshot.
- Cross-provider redirect implementations may use a different transaction hook,
  but must provide the same no-partial-success guarantee.
