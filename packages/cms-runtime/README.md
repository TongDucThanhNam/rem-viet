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

`cmsReusableContentModule` installs a versioned `cms-reusable-content`
collection on the same provider surface. `createCmsReusableContentRuntime()`
adds typed fragment create/save/publish/unpublish/restore/delete operations,
synced and pinned loaders, cycle/dangling/type validation, public-dependency
gates, safe detach, and a serializable usage graph. It scans both working and
published fragment states before destructive actions, so editing a draft cannot
hide a dependency that remains live in an immutable published revision. No
extra provider table is required: local SQLite/libSQL, Cloudflare D1, and
Postgres inherit the existing collection persistence and revision contract.

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
editorial review workflow. Keyed globals have separate working and published
reads, immutable publish revisions, and an exact compensation primitive for
multi-document releases; save/restore operations cannot change public content.
Review state is derived from newest-first immutable
events: intervening saves make a request stale, reviewer decisions never
publish, and only publication of the exact approved version resolves the
handoff. The immutable request also owns assignee IDs/roles, mentions, due date,
notification intent, and checklist requirements; decision events provide the
completion evidence. Shared helpers fail closed when a decision actor is not
assigned or required checklist items are missing.
`runEditorialReviewProviderConformance` proves exact-retry idempotency,
same-version conflict rejection, assignment and checklist gates, queue behavior,
stale protection, decision validation, and publication resolution against a
real provider lifecycle.

## Server SDK and REST resources

`createCmsServerSdk()` binds a collection registry to its provider and derives
collection slugs, authoring data, lifecycle inputs, revisions, relationships,
and locale options from that registry. Every server call carries its actor
explicitly. `createCmsRestResources()` exposes the same SDK through an
allow-listed Fetch handler: generated collection/document/revision/action
resources, a 100-item page ceiling, at most five filters, a configurable body
limit, capability checks, and provider validation. Unknown failures become a
generic shared `CmsError` contract; database/provider messages are never sent.

## Portable content

`exportCmsContent()` emits a deterministic schema-v1 bundle containing registry
identity plus canonical draft, published, schedule, relationship, and locale
state. It excludes credentials, provider rows, audit data, hook configuration,
and other private state. `importCmsContent()` supports validation-only, dry-run,
and apply modes. Its report separates creates, updates, skips, conflicts,
missing relationships, field failures, and required collection migrations.
Apply is available only through a provider that implements the atomic import
boundary; a blocked report never invokes that boundary.
