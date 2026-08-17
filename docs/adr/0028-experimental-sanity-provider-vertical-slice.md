# ADR 0028: Experimental Sanity provider vertical slice

- Status: Accepted, experimental
- Date: 2026-08-16
- Scope: optional hosted provider and visual-editing portability proof

## Context

The Cloudflare provider proves the native platform workflow, while ADR 0027
proves provider-neutral visual-authoring intent. Neither alone proves that the
runtime ports can map onto a current hosted visual CMS without leaking vendor
types into core, runtime, admin or a template.

Sanity's current official architecture aligns with the desired boundary:
published and drafts query perspectives normalize document variants; stable
array `_key` values support Content Source Maps; stega metadata and the
Presentation Tool supply hosted overlays; Actions model document lifecycle; and
patch mutations accept `ifRevisionID` for optimistic concurrency.

## Decision

Add `@agency/cms-provider-sanity` as an experimental workspace package outside
the stable eight-artifact release set. It accepts a structural
`SanityClientPort`, so the consumer supplies its official configured
`@sanity/client` instance and no Sanity dependency crosses into neutral
packages.

The first vertical slice implements:

- published/draft reads by neutral id or slug;
- create and save of working drafts;
- recursive `_key` decoration from stable neutral item ids and stripping on the
  normalized return path;
- revision-guarded draft saves using `ifRevisionID`;
- native document publish, unpublish and delete actions;
- published/draft client overlays and validated Presentation Tool configuration;
- an official raw-body signed webhook receiver with bounded payloads,
  project/dataset/document pinning, stale-signature rejection, a required
  durable idempotency port, and a required revalidation callback;
- an honest visual capability declaration.

The executable consumer lives in the optional `apps/studio` workspace. It
registers code-owned Hero + FAQ schemas, filters provider-managed document
templates, and wraps root `agencyPage` edits with an atomic portable version
increment plus the current Studio user ID. The template owns an explicit Sanity
encoder that adds array `_key` values and schema `_type` discriminators, so
provider-created documents remain editable without teaching the generic
provider about Rèm Việt block names.

Hero and SEO image fields use the native Sanity asset picker with crop/hotspot
metadata, while optional URL fields preserve provider-created and migrated
documents. The provider exposes a code-owned `contentProjection` seam and the
TanStack edge supplies a Rèm Việt GROQ selection plus official image URL
materializer. It applies the saved crop/hotspot at fixed Hero/SEO target ratios
and returns ordinary asset URLs/IDs through the neutral image contract. These
provider/application concerns remain optional; neutral core and template
packages never import Sanity image types.

The TanStack Start executable edge implements the other half of Presentation:
short-lived preview-secret validation, a separately HMAC-signed HttpOnly
perspective session, stacked release perspectives, server-only authenticated
stega reads, no-store/noindex responses, Studio-origin `frame-ancestors`, CHIPS
cookies, click-to-edit overlays, bidirectional navigation, and in-place React
refetch on Studio mutation or perspective change. Invalid, forged, incomplete,
missing, and schema-invalid states fail closed without exposing the read token.

The package also exposes a separate hosted-conformance entry point and an
official-client CLI. The gate is staging-only by default, requires the exact
`VERIFY SANITY <project>/<dataset> <document>` confirmation, preflights a fresh
document id, verifies a two-block lifecycle and a Content Source Map containing
stable `_key` selectors, proves stale-write rejection, and always attempts
cleanup after partial mutation. Production additionally requires an explicit
flag and `PRODUCTION` confirmation suffix. It emits no partial success receipt;
the complete schema-v3 JSON receipt is written with exclusive-create semantics
only after delete and cleanup verification succeed. Apply additionally requires
a clean checkout and binds the receipt to its full Git commit.

A second guarded CLI consumes that complete schema-v3 receipt and an
authenticated, Git-ignored Playwright storage state. From a clean checkout it
seeds disposable Hero + FAQ documents and requires a real desktop Chrome pass
through the hosted Presentation Tool. The pass proves the HTTPS Studio session,
preview-secret handshake, HttpOnly/Secure/SameSite=None plus CHIPS iframe
cookies, embedded stega overlay, click-to-edit field focus, mutation propagation
without iframe navigation, published/draft perspectives, and a responsive
Presentation viewport. It rechecks document and preview-secret cleanup before
writing an exclusive versioned receipt bound to the full Git SHA, the hosted
receipt digest, exact origins, a hashed Playwright report, and a hashed
screenshot. Failure output is redacted and partial evidence is removed.

A third, network-free verifier consumes the committed hosted and Presentation
receipts. It re-parses both schemas, verifies all four evidence hashes, requires
strict commit ancestry, and rejects any non-evidence source change between the
hosted proof, Presentation proof, and final clean evidence commit. It emits a
separate promotion-readiness receipt but never changes package versions or
stable-release membership automatically.

The executable frontend mounts the webhook receiver at
`POST /api/sanity/webhook`. A dedicated secret activates it independently of
preview. Sanity's `idempotency-key` is persisted in D1 with processing leases,
completion state, retry release, and 30-day retention. Valid published
`agencyPage` create/update/delete deliveries purge deterministic Cloudflare
cache keys; a cache failure returns 503 so at-least-once delivery remains useful
instead of being acknowledged before invalidation. The filter and delete-safe
`before()`/`after()` projection are exported from the provider package and
documented as the only accepted payload contract.
The provider capability defaults to `webhooks: false`; a consumer must opt in
only when that receiver, durable store, and purge callback are all deployed.

Scheduling, revision listing and restore throw `CAPABILITY_UNAVAILABLE` and are
absent from `supported`. They will not be advertised until native Content
Releases and History API semantics pass a real hosted-dataset exercise.

## Consequences

- The package demonstrates a second provider boundary locally without changing
  the neutral page model or the Rèm Việt renderer.
- Preview tokens are never returned by configuration helpers and remain at the
  verifier/web executable edges.
- Official Sanity libraries exist only in the optional Studio, verifier, and
  integration/provider edges; they remain absent from neutral
  core/runtime/admin source and stable release artifacts.
- Local Studio and web builds now prove that Presentation is executable rather
  than configuration-only. The authenticated browser receipt is also locally
  executable and fail-closed, while the external receipt requirement remains
  unchanged until that runner passes against the named hosted staging scope.
- The gate is not itself a hosted-provider receipt. Promotion into the
  coordinated release still requires executing it against an external Sanity
  project/dataset plus a browser-visible Presentation Tool proof.

## Primary references

- https://www.sanity.io/docs/apis-and-sdks/js-client-querying
- https://www.sanity.io/docs/visual-editing/visual-editing-client-stega
- https://www.sanity.io/docs/visual-editing/configuring-the-presentation-tool
- https://www.sanity.io/docs/content-lake/dispatch-actions
- https://www.sanity.io/docs/content-lake/transactions
- https://www.sanity.io/docs/content-lake/webhooks
- https://www.sanity.io/docs/content-lake/webhook-best-practices
