# ADR 0014: Homepage provider public read

- Status: Accepted
- Date: 2026-08-16
- Scope: Published Rèm Việt landing singleton reads

## Context

The live homepage mutations used the portable provider, but the public homepage
still read the immutable revision through the legacy Drizzle service. This
meant the reference application had not adopted the provider's `ContentReader`
port on its highest-value public render path.

The existing response also contains application compatibility metadata—current
row version, schedule fields, and timestamps—that is intentionally absent from
the immutable published content snapshot.

## Decision

The `home` branch of `getPageBySlug` now reads published content through
`CloudflareCmsPageProvider.getPublished`. The Rèm Việt adapter converts the ten
canonical blocks back to the established flattened response and performs one
metadata-only D1 query for the legacy row fields. Ordinary page reads remain on
the existing service while their generic block contract and CRUD adoption are
still under review.

## Verification

- API type checks and package-boundary tests require the public-read adapter.
- The isolated Acme migration smoke renders the published homepage and FAQ.
- The Acme schedule/unschedule Playwright scenario revisits the public homepage
  before and after each mutation and confirms no early publication.

## Consequences

- The flagship public renderer now consumes the same provider API proven by the
  clean consumer.
- Compatibility metadata remains an explicit application adapter concern.
- Public listing and ordinary-page reads remain additive legacy paths.
