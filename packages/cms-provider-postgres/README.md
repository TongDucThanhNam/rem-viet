# `@agency/cms-provider-postgres`

PostgreSQL collection and DAM metadata providers plus an S3-compatible
object-storage adapter for Agency CMS deployments outside Cloudflare.
PostgreSQL mutations run on one checked-out client in a serializable
transaction; all values use parameterized queries. S3 operations use AWS
Signature Version 4 through the official SDK.

Production applications must run `applyPostgresCmsMigrations(pool)` before
serving CMS traffic and should inject the same `pg.Pool` into
`createPostgresCmsCollectionProvider` and `createPostgresCmsMediaProvider`.
The media provider passes both the DAM v2 and legacy media conformance suites;
applications provide usage discovery, global replacement, and a variant queue
through its explicit callbacks.
