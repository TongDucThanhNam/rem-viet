# `@agency/cms-runtime`

Provider-neutral CMS workflow ports for versioned page drafts and immutable
published revisions. The package exposes small reader, writer, and publishing
interfaces plus a conformance scenario. It does not expose persistence tables,
provider SDKs, application routes, or UI components.

The generic collection runtime composes a consumer registry with CRUD,
draft/published reads, scheduling, immutable revisions, restore, delete, and
filtered/paginated list ports. `assertCmsCollectionAccess()` evaluates the
capability metadata declared by the collection without owning application roles,
and `runCollectionProviderConformance()` exercises the shared lifecycle against
any provider.

Localized collection calls carry an explicit locale through reads, writes,
queries, schedules, revisions, restores, and deletes. Draft and publication
state are independent per locale. Reads default to no fallback; callers may
request default-locale fallback explicitly and receive `fallbackFrom` metadata
instead of mistaking fallback content for a translated document.

`createCmsPageCollectionAdapter()` lets an established page application adopt
that generic lifecycle one content type at a time. Consumer-supplied mappers
preserve the public page contract while storage, queries, validation, and
revisions move to the collection provider; optional editorial review remains on
the established page workflow surface.

The runtime also exposes media/global-content ports and a version-bound
editorial review workflow. Review state is derived from newest-first immutable
events: intervening saves make a request stale, reviewer decisions never
publish, and only publication of the exact approved version resolves the
handoff. `runEditorialReviewProviderConformance` proves idempotent requests,
queue behavior, stale protection, decision validation, and publication
resolution against a real provider lifecycle.
