# ADR 0030: Provider-neutral versioned global content

- Status: Accepted
- Date: 2026-08-16
- Amended: 2026-08-21 (explicit publication and release compensation)
- Scope: Site settings, navigation, runtime ports, Cloudflare, and Sanity persistence

## Context

The reusable page and media lifecycles already crossed neutral runtime ports,
but site settings and header/footer navigation still wrote directly through the
Rèm Việt Drizzle service. That left two core surfaces named by the research
baseline—`SiteSettings` and `Navigation`—outside the provider boundary. It also
meant an accidental global-content edit had audit metadata but no client-facing
revision recovery.

## Decision

The runtime exports a generic keyed `CmsGlobalContentProvider` with working and
published reads, save, explicit publish, newest-first immutable revision list,
restore, and exact publication-compensation operations. Saves require an
explicit expected version (or `null` for creation); stale writes use the same
portable conflict semantics as page content. Save and restore change only the
working draft. Publish appends an immutable public snapshot. Compensation is a
bounded release primitive that restores the exact prior version/publication
pointer and deletes only the release-created revision.

The Cloudflare provider implements the contract over `cms_globals` and
`cms_global_revisions`, with document, revision, audit, and publication-outbox
writes in one D1 batch. A neutral conformance scenario proves empty reads,
create/update versioning, draft isolation, publication, exact compensation,
conflicts, immutable history, and restore.

The experimental Sanity adapter implements the same contract with a current
`agencyGlobal` document plus explicit immutable `agencyGlobalRevision`
documents in one mutation transaction. Portable keys are retained verbatim but
mapped to safe deterministic document IDs with SHA-256. Sanity `_rev` guards
provide the storage-level concurrency check. This proves the port against a
second storage model locally. Hosted receipt schema v3 now requires the same
neutral conformance and cleanup of its current document plus all proof revisions,
and binds the run to a clean full Git commit; the real-dataset run itself remains
external evidence.

Rèm Việt owns the concrete Zod schemas and maps the neutral documents back to
the existing API shapes. Existing `site_settings` and `menus` rows are read only
for concurrency-safe lazy bootstrap into a published baseline; all subsequent
writes use the provider. Public APIs read only the referenced published
revision, while protected admin APIs read the working draft, so no renderer
imports storage details and an admin save cannot leak before release.

The settings admin sends expected versions, exposes the three histories (site
settings, header navigation, footer navigation), labels save/restore as draft
operations, and directs publication through multi-document releases. Every
mutation retains application audit evidence; publication additionally emits a
content-free reliable outbox event.

## Consequences

- Global content is now portable across provider implementations without moving
  Rèm Việt defaults or field UX into a neutral package.
- A client can recover a broken header, footer, logo, or contact configuration
  from the admin; recovery appends history instead of rewriting it.
- Fresh/default navigation becomes versioned on its first explicit save. Legacy
  persisted navigation is imported and published automatically on first read.
- Provider and release tests prove private drafts, publication, exact replay,
  history, restore, content-free outbox delivery, and reverse compensation. The
  authenticated Worker browser test proves a human-field draft cannot alter the
  public site before release.
- Footer and broader reusable-content schemas can adopt the same keyed contract;
  provider-neutral SEO/redirect primitives remain separate future decisions.
- Independent staging and the hosted alternate-provider v3 receipt are still
  required before stable 1.0; this ADR records local structural and gate
  evidence only.
