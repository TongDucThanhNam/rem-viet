# ADR 0016: Standard-page contracts and provider adoption

- Status: Accepted
- Date: 2026-08-16
- Scope: generic page continuation after the flagship and media slices

## Context

The first provider adoption deliberately used the flagship homepage as a narrow
vertical slice. Ordinary pages still stored three unversioned legacy block
shapes, rendered them through an application type switch, and performed all
workflow operations through the legacy mutable-row service. That left a second
content model outside the template and runtime contracts.

## Decision

`@agency/cms-template-rem-viet` owns version-1 contracts, defaults, migration
lists, and compatibility adapters for the `richText`, `productGrid`, and `cta`
standard-page blocks. The public application converts legacy stored blocks at
its boundary and dispatches canonical blocks through the generic React registry.

For existing standard pages whose slug and template are unchanged, the Rèm Việt
API now composes the packaged Cloudflare page provider for draft save, publish,
revision list, restore, schedule, unschedule, and immutable published reads.
Legacy response shapes and audit records remain compatibility adapters. Template
changes, slug changes with redirect creation, initial create, unpublish, and
delete remain on the legacy service until the runtime owns explicit contracts
for those lifecycle operations.

## Consequences

- Standard-page drafts and public snapshots have the same optimistic-version and
  immutable-publication guarantees as the homepage.
- Adding a standard block changes the template registries rather than the public
  renderer or core runtime.
- A browser workflow proves that saving a changed CTA as draft does not change
  public output and that publishing promotes the new immutable snapshot.
- This is additive route adoption, not a claim that every page lifecycle command
  or the reusable admin workflow shell has been extracted.
