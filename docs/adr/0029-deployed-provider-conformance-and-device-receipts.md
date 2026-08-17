# ADR 0029: Deployed provider conformance and device-specific receipts

- Status: Accepted
- Date: 2026-08-16
- Scope: Second-site staging validation and release evidence

## Context

The Platform Kit requires one Cloudflare page-provider contract to pass locally
and in staging. The local SQLite and isolated Miniflare drivers executed the
neutral `runPageProviderConformance` scenario, but the staging command covered
only selected browser workflows. It also described desktop and mobile coverage
while invoking only the desktop Playwright project. Those checks were useful,
but they could not substantiate either claim.

## Decision

The staging gate executes the same exported provider-conformance function
through a thin authenticated tRPC adapter. The adapter implements the neutral
`CmsPageProvider` interface over the deployed page API, maps suite-owned logical
IDs to server-generated IDs, converts stale-version responses to the portable
`CmsError` conflict, and cleans every disposable document in a `finally` block.
Unique slugs and IDs isolate concurrent or repeated runs.

The exact lifecycle covers empty reads, create, schedule/unschedule, publish,
draft isolation, optimistic conflict, second publish, immutable revisions,
restore without implicit publish, unpublish, republish, and delete. Route
availability or a similar hand-written browser flow does not count as provider
conformance.

Staging smoke also invokes distinct `desktop-chrome` and `mobile-chrome`
Playwright projects. The desktop project owns the state-mutating lifecycles and
provider contract; the mobile project owns narrow navigation, overflow,
accessibility, and visual-authoring checks. The runner requires exactly four
desktop and two mobile passes with zero unexpected, flaky, or skipped tests.
The release schema fails closed unless both device flags and
`cloudflarePageProviderConformance` are true.

## Consequences

- Local Cloudflare-compatible proof now exercises the deployed API boundary
  with the same neutral contract and passes with real lifecycle mutations.
- Credentials remain environment-injected and no secret value enters reports or
  release evidence.
- Test documents are disposable and self-cleaning; cleanup failure fails the
  run instead of producing a receipt.
- A clean independent staging execution and its retained receipt remain external
  evidence. This ADR does not claim that missing run or stable 1.0 completion.
