# ADR 0017: Provider-capability admin composition

- Status: Accepted
- Date: 2026-08-16
- Scope: reusable page workflow controls

## Context

The provider runtime declared capabilities, but the two page editors inferred
publish access from hard-coded application roles and assumed every workflow
operation existed. This duplicated policy in the UI and made a partial provider
look fully capable.

## Decision

`@agency/cms-admin` exposes a headless workflow resolver. It combines provider
capabilities, server-granted capabilities, and document state into explicit
availability records for save, preview, publish, schedule, unschedule, revision
list, and restore. Unavailable actions retain a machine-readable reason:
provider unsupported, permission denied, document required, or schedule required.

The authenticated page-capabilities query derives provider support from the
packaged Cloudflare page provider and intersects it with the server role policy.
Both the flagship and standard-page editors consume the neutral result instead
of duplicating owner/admin checks. Presentation, localized copy, confirmation
dialogs, and transport mutations remain application adapters.

## Consequences

- Providers may expose subsets without causing invalid admin actions to render.
- Authorization still fails closed on every mutation; client gating is only an
  accurate UX projection of server/provider policy.
- The model is transport- and template-neutral and ships in the packed clean
  consumer artifact.
- Full reusable page-shell layout and transport bindings remain later work.
