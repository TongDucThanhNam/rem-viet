# ADR 0013: Provider scheduling and homepage route adoption

- Status: Accepted
- Date: 2026-08-16
- Scope: Portable page scheduling and the Rèm Việt landing singleton

## Context

Schedule and unschedule were still application-service mutations even though
the runtime's publishing boundary is responsible for publish policy. This left
the packaged provider unable to prove scheduling semantics in a clean consumer,
and the live homepage route had one more privileged persistence path outside
the provider.

The existing application contract increments the optimistic version, stores the
future timestamp and actor metadata, emits `page.schedule` or
`page.unschedule`, and clears scheduling metadata when publishing. Existing D1
databases already have these columns, while standalone provider databases may
need an additive upgrade.

## Decision

`@agency/cms-core` declares `content.schedule`. The runtime
`PublishingWorkflow` exposes `schedule` and `unschedule`, and its provider
conformance suite proves both transitions plus publish-time schedule clearing.

The Cloudflare provider validates that schedules are valid future timestamps,
uses optimistic versions for schedule changes, records scheduling mutation
events in the same D1 batch, and owns publish-time `published_at` plus schedule
cleanup. Migration `0002_page_scheduling` adds any missing scheduling columns
individually, so fresh databases, old standalone provider databases, and the
existing application schema all converge idempotently.

The Rèm Việt adapter contributes only its established audit row and storage
codecs. Homepage schedule and unschedule routes select the provider adapter;
ordinary pages retain the legacy service during the additive migration. Page
and post schedule endpoints now authorize against `content.schedule` rather
than overloading `content.publish`. The current role policy remains unchanged:
owner/admin may schedule and editor may not.

This ADR covers scheduling state transitions, not the cron worker that executes
due publications. Scheduler execution remains an application/infrastructure
capability until a provider-neutral execution contract is extracted.

## Verification

- The provider conformance suite passes on libSQL's D1-compatible harness and
  an isolated Miniflare D1 binding.
- Migration tests cover empty, repeated, and upgraded schemas.
- The six-artifact clean consumer installs, typechecks, builds, and reports
  scheduling conformance without workspace source aliases.
- API authorization and package-boundary tests require the dedicated
  capability and homepage adapter routes.
- The isolated Acme Playwright workflow schedules and unschedules the homepage
  without early publication against real local D1/R2 bindings.

## Consequences

- Scheduling persistence is portable and provider-owned.
- The application audit schema remains outside the neutral provider.
- General page adoption, due-publication execution, media, and infrastructure
  boundaries remain separate follow-up slices.
