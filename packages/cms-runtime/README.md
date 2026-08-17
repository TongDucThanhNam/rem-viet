# `@agency/cms-runtime`

Provider-neutral CMS workflow ports for versioned page drafts and immutable
published revisions. The package exposes small reader, writer, and publishing
interfaces plus a conformance scenario. It does not expose persistence tables,
provider SDKs, application routes, or UI components.

The runtime also exposes media/global-content ports and a version-bound
editorial review workflow. Review state is derived from newest-first immutable
events: intervening saves make a request stale, reviewer decisions never
publish, and only publication of the exact approved version resolves the
handoff. `runEditorialReviewProviderConformance` proves idempotent requests,
queue behavior, stale protection, decision validation, and publication
resolution against a real provider lifecycle.
