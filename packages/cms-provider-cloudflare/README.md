# `@agency/cms-provider-cloudflare`

Cloudflare D1 reference adapter for the `@agency/cms-runtime` page workflow.
It preserves separate `pages` and immutable `page_revisions` tables and uses a
structural subset of the D1 API so consumers do not need Drizzle types in their
public CMS contract.

Version `0.1.0` implements draft create/read/save, published snapshot reads,
optimistic conflicts, schedule/unschedule, publish, revision listing, restore,
and idempotent empty/upgraded schema initialization. Publishing clears pending
schedule metadata. The package also implements a D1/R2 media store with upload
rollback, metadata updates, application-supplied usage discovery, and protected
delete.

The additive `0005_editorial_reviews` migration provides an immutable,
version-bound page review event log and ranked pending queue. Request and
decision writes use D1 version guards; duplicate requests are idempotent; stale
requests leave the queue; and publication records its resolution inside the
same provider batch as the immutable revision and page pointer update.

Optional block/revision encoders preserve an application's existing storage
shape during additive migration. Applications may also contribute prepared D1
mutation statements, allowing compatibility metadata or audit writes to share
the provider batch without coupling this package to a specific audit schema.

Migration `0006_generic_collections` adds provider-owned document and immutable
revision tables keyed by registered collection slug. The generic collection
provider has no collection-specific switch: it migrates stored snapshots through
the registry, applies shared field validation/defaults, verifies relationship
targets, keeps drafts isolated behind published revision pointers, supports
filtered/paginated reads, and enforces restrict/nullify reference behavior on
delete. An optional authorization callback binds neutral collection actions to a
consumer's permission system.

Consumers can append prepared statements to every generic collection mutation.
The statements share the provider's D1 batch, enabling atomic audit records,
compatibility projections, redirects, and review publication events without a
brand or collection switch inside the provider.

Consumers with installable modules pass an instance-scoped
`CmsExtensionRegistry` as `extensions`; passing the legacy `registry` option
remains supported. Authorization runs before module hooks. For create, update,
publish, restore, unpublish, and delete, validation and operation hooks complete
before any D1 batch executes. Hook transforms are parsed again through the
registered collection schema and relationship checks. Hook failure therefore
leaves documents, revisions, compatibility projections, and audit statements
unchanged.
