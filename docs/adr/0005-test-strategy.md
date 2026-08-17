# ADR 0005: CMS test strategy

- Status: Accepted
- Date: 2026-08-13

## Decision

Use three layers:

1. Bun unit tests for Zod contracts, role/capability policy and pure snapshot
   behavior.
2. D1 integration tests against a disposable local Wrangler/Miniflare database
   for migrations, publish, restore and draft isolation.
3. Browser E2E for login, edit, preview, publish, restore, media and leads after
   the editor exists.

Tests must cover both an empty database and an upgraded fixture created from the
last released schema. Production migration gates require a backup artifact and
a successful staging restore drill.

Public-content tests are fail-closed: an absent/invalid revision must produce no
public document, never a fallback to the working row.

## Initial commands

The first implementation adds package-local `bun test` commands. M0 also keeps
the existing typecheck/build checks. A root aggregate and browser runner are
added when the integration/E2E harness lands; documentation must not claim those
layers pass before their commands exist.
