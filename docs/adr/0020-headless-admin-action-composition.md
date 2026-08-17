# ADR 0020: Headless admin action composition

- Status: Accepted
- Date: 2026-08-16
- Scope: reusable admin workflow execution and controls

## Context

The capability resolver made action availability portable, but each page editor
still repeated two kinds of orchestration: saving dirty or new content before a
publish/schedule command, and branching over the availability model to render
controls. Moving concrete buttons or tRPC mutations into the neutral package
would couple it to the Rèm Việt application and its presentation system.

## Decision

`@agency/cms-admin` exposes two headless composition primitives:

- `runCmsWorkflowCommand` selects the current versioned document or invokes the
  injected save function before executing an injected command.
- `CmsWorkflowActionSlots` accepts the resolved workflow model, an explicit
  action order, and application-provided React nodes, rendering only available
  actions.

The Rèm Việt homepage uses the command runner for publish and schedule, and its
header controls use action slots. The standard-page editor uses the same slots
for unpublish, draft save, and publish. Localized copy, confirmation dialogs,
mutation transports, cache invalidation, and page layout remain app-owned.

## Consequences

- Provider capability and server authorization projections determine control
  visibility through one reusable path without making the package a design
  system or transport client.
- Dirty/new save ordering is independently testable and reusable for any async
  transport that returns a versioned document target.
- Package tests, boundary tests, and the tarball-installed clean consumer prove
  save-before-command ordering and omission of unauthorized action slots.
- A larger reusable page shell or typed transport adapter can be added later
  without changing these headless contracts.
