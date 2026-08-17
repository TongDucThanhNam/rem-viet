# ADR 0030: Provider-neutral versioned global content

- Status: Accepted
- Date: 2026-08-16
- Scope: Site settings, navigation, runtime ports, and Cloudflare persistence

## Context

The reusable page and media lifecycles already crossed neutral runtime ports,
but site settings and header/footer navigation still wrote directly through the
Rèm Việt Drizzle service. That left two core surfaces named by the research
baseline—`SiteSettings` and `Navigation`—outside the provider boundary. It also
meant an accidental global-content edit had audit metadata but no client-facing
revision recovery.

## Decision

The runtime exports a generic keyed `CmsGlobalContentProvider` with read, save,
newest-first immutable revision list, and restore operations. Saves require an
explicit expected version (or `null` for creation); stale writes use the same
portable conflict semantics as page content. Restore copies an old snapshot
into a new version and never mutates or deletes history.

The Cloudflare provider implements the contract over `cms_globals` and
`cms_global_revisions`, with document and revision writes in one D1 batch. A
neutral conformance scenario proves empty reads, create/update versioning,
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
the existing public API shapes. Existing `site_settings` and `menus` rows are
read only for concurrency-safe lazy bootstrap; all subsequent writes use the
provider. The public site continues to read the same settings/navigation API,
so no renderer imports storage details.

The settings admin sends expected versions, exposes the three histories (site
settings, header navigation, footer navigation), and confirms restore actions.
Every save and restore retains the existing application audit event in addition
to the immutable provider revision.

## Consequences

- Global content is now portable across provider implementations without moving
  Rèm Việt defaults or field UX into a neutral package.
- A client can recover a broken header, footer, logo, or contact configuration
  from the admin; recovery appends history instead of rewriting it.
- Fresh/default navigation becomes versioned on its first explicit save. Legacy
  persisted navigation is imported automatically on first read.
- The authenticated Worker browser test proves human-field edits, public
  propagation, history, restore, exact recovery, and cleanup.
- Footer and broader reusable-content schemas can adopt the same keyed contract;
  provider-neutral SEO/redirect primitives remain separate future decisions.
- Independent staging and the hosted alternate-provider v3 receipt are still
  required before stable 1.0; this ADR records local structural and gate
  evidence only.
