# ADR 0006 — Scheduled publishing

Status: accepted (2026-08-13).

Cloudflare Cron invokes the TanStack Start Worker every minute. A scheduled
document keeps its current public revision and stores `scheduledAt`, actor and
note on the mutable working row. When due, the worker calls the same
`publishPage`/`publishPost` service used by the admin. That service creates an
immutable revision, moves the published pointer and clears the schedule in one
D1 batch.

We deliberately do not change a published row to `status=scheduled`: doing so
would make the existing public revision disappear before the new revision is
due. Failed jobs remain scheduled, are retried on the next minute, and are
logged with entity ids.
