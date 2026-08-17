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
