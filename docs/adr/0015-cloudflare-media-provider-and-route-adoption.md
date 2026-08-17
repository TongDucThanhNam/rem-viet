# ADR 0015: Cloudflare media provider and route adoption

- Status: Accepted
- Date: 2026-08-16
- Scope: Portable media lifecycle and Rèm Việt D1/R2 integration

## Context

Media behavior was split across an HTTP route, Drizzle metadata services, an R2
binding, application-wide usage scans, audit writes, and owner-only force-delete
authorization. The master plan requires a small `MediaStore` port without
coupling neutral packages to Rèm Việt content owners or roles.

## Decision

`@agency/cms-runtime` defines portable media records and a `MediaStore` for
list/get, upload, metadata update, usage discovery, and protected delete. Its
conformance scenario proves object lifecycle, metadata, usage, and safe-delete
semantics.

`@agency/cms-provider-cloudflare` implements the port with D1 metadata and a
structural R2 binding. Upload writes R2 first and removes the new object if D1
metadata or same-batch audit persistence fails. Referenced media rejects normal
delete. Application code must explicitly request force delete; the provider
does not model application roles.

The Rèm Việt adapter supplies cross-domain usage discovery for pages, posts,
revisions, products, and site settings, plus legacy audit statements. Server
authorization retains the owner-only force-delete rule. The HTTP upload and
live list/update/delete paths use the provider. File validation, object-key and
public-URL policy remain application concerns. The metadata-only tRPC create
mutation remains a compatibility path because it has no object body and is not
an upload operation.

Migration `0003_media_metadata` is idempotent for fresh provider databases and
existing application databases.

## Verification

- D1-compatible provider tests pass media conformance and injected upload
  persistence failure cleanup.
- Empty/repeated/upgraded migration tests include the media table.
- The six-artifact clean consumer installs and executes page plus media
  conformance without workspace aliases.
- Boundary tests require live upload/list/update/delete adoption and forbid R2
  writes in the HTTP route.
- The isolated Acme Playwright workflow passes upload retry, R2 serving,
  alt-text update, picker usage, protected delete, reference cleanup, and final
  object/metadata deletion.

## Consequences

- Neutral packages own storage lifecycle semantics but not client roles or
  cross-domain reference knowledge.
- Multi-file request rollback may emit compensating create/delete audit events;
  each individual upload remains R2/D1 consistent.
- The compatibility metadata-create endpoint should be removed or replaced by
  an explicit registration contract before stable 1.0.
