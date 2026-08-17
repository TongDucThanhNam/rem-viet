# ADR 0025: Fail-closed release migration orchestration

- Status: Accepted
- Date: 2026-08-16
- Scope: Platform Kit CLI migration and rollback boundary

## Context

The package rehearsal proved content migration and rollback, but its scripts
directly copied and replaced files. That did not give client repositories a
reusable production procedure for checking the current schema, creating a
backup, applying a contiguous migration, verifying each step, or binding a
rollback to the exact backup receipt.

## Decision

`@agency/cms-cli` exposes a provider-neutral release migration plan and executor.
Plans identify the site, staging/production target, current and target versions,
contiguous step IDs, and exact apply/rollback confirmations. Mutating behavior
is injected through a small driver so D1, another provider, or a content store
can supply its own inspect, backup, apply, and restore mechanics.

Execution checks the live version, creates and validates a non-empty SHA-256
backup proof before applying any step, verifies the observed version after every
step, and emits a timestamped recovery receipt. Failures after backup throw a
typed error containing the recovery point. Rollback accepts either a successful
receipt or that recovery point, rejects mismatched targets and unknown steps,
verifies the backup through the driver, and confirms the restored version.

The independent N to N+1 fixture now persists this receipt, validates backup
bytes before restore, and performs rollback through the same packaged API.

## Consequences

- Client adapters cannot bypass backup-before-migrate ordering accidentally.
- Dry planning remains pure; external writes require an exact confirmation.
- Provider-specific backup storage and migration SQL stay outside the neutral
  package.
- A real production backup, private-registry install, and deployed staging
  execution remain external evidence rather than being inferred from the local
  rehearsal.
