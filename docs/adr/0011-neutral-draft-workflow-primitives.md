# ADR 0011: Neutral draft workflow primitives with app routing adapters

- Status: Accepted
- Date: 2026-08-16
- Scope: post-KIT-014 admin workflow continuation

## Context

The homepage and post editors independently implemented the same trailing
autosave gate and save-before-preview behavior. The latter must handle edits
made during an in-flight save, fail closed after bounded retries, and avoid
exposing an authenticated preview URL until the draft is safely persisted.
The application also uses TanStack Router and localized placeholder markup,
which are not Platform Kit contracts.

## Decision

`@agency/cms-admin` owns these reusable primitives:

- `useCmsAutosave` schedules a trailing save only for a dirty, idle,
  conflict-free draft and resets when the caller's change token changes.
- `flushCmsDraft` and `useCmsDraftFlush` wait for an active save, repeat when
  newer edits remain, and fail closed after a bounded attempt count.
- `openCmsPreviewAfterSave` opens an injected placeholder synchronously, then
  navigates it to the private preview URL only after a successful flush.
- `CmsDraftSaveState` provides the shared UI state vocabulary.

The package does not import a router, query client, transport, provider, or
client template. The Rèm Việt adapter keeps `useBlocker`, `beforeunload`, popup
creation, and localized placeholder markup. Save/publish/restore mutations and
conflict messages remain application orchestration.

Both the homepage and post editors use the shared autosave hook. Their existing
save timing, validation, optimistic-conflict behavior, and preview routes are
unchanged.

## Consequences

- Consumers can reuse the race-sensitive draft behavior without adopting the
  Rèm Việt application stack.
- Router and browser presentation remain replaceable adapters.
- Packed-consumer evidence exercises draft flush and preview gating from the
  package tarball.
- A complete reusable admin workflow shell still requires provider-backed
  data adapters, revision/publish controls, and composable UI surfaces.
