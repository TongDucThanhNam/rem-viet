# `@agency/cms-provider-sanity`

Experimental Sanity Content Lake adapter for the provider-neutral CMS runtime.
Consumers pass a configured official `@sanity/client` instance through the
structural `SanityClientPort`; Sanity is not imported by core, runtime, admin or
template packages.

The vertical slice implements published/draft reads, create/save with stable
array `_key` values, optimistic save conflicts via `ifRevisionID`, publish,
unpublish and delete. Its capability list deliberately excludes scheduling and
history restore: native Content Releases and History API behavior must pass a
real hosted-dataset exercise before those ports are advertised.

The package also implements the keyed global-content contract for settings and
navigation. Unlike page history, this adapter owns explicit immutable
`agencyGlobalRevision` documents and a referenced published revision. Draft
saves and restores cannot change public reads; explicit publication advances an
immutable public snapshot, and failed multi-document releases can compensate
that publication to the exact prior revision. The shared conformance suite also
proves newest-first history, optimistic `_rev` conflicts, and
restore-as-new-version. Document IDs use a SHA-256 digest of the portable key,
so arbitrary Unicode/URL-like keys remain valid Sanity IDs without leaking or
truncating the original key. This global path has structural/local evidence,
and the hosted verifier runs the same neutral conformance against its real
dataset before a receipt can be emitted.

Preview helpers return safe published/draft client overlays for Sanity's current
perspective + stega model. Tokens are intentionally absent from all returned
configuration and must remain server-side. The package is not part of the stable
eight-artifact release set until external dataset and Presentation Tool receipts
exist.

The workspace now includes an executable consumer at `apps/studio` and a
TanStack Start preview edge at `apps/web/src/routes/sanity-preview/$id.tsx`.
Together they implement the bounded Hero + FAQ schema, Presentation routing,
signed draft/release perspective cookies, server-only stega reads, click-to-edit
overlays, and in-place mutation refetches. Provider-created Rèm Việt content must
pass `encodeRemVietSanityPageContent` as `encodeContent` so Sanity receives both
stable `_key` values and the schema `_type` discriminators. This is repeatable
local implementation evidence, not a claim that a hosted dataset has passed.

For schema fields that use native Sanity references, pass a code-owned
`contentProjection` to `createSanityCmsPageProvider`. The provider applies the
same projection to lookup and raw lifecycle reads before parsing the portable
content. The Rèm Việt preview follows the same boundary pattern with a GROQ
selection and the official image URL builder, materializing Hero/SEO image
assets (including crop/hotspot) into `{src, mediaId, alt}` without coupling the
neutral contracts to Sanity. Projection strings are trusted application code,
never editor input.

## Signed publish webhooks

The `./webhook` export makes webhook support executable. The provider default is
`webhooks: false`; consumers may pass `webhooks: true` only after deploying this
receiver with durable storage and real invalidation. It
uses Sanity's official `@sanity/webhook` verifier against the untouched request
text, rejects stale signatures, pins project/dataset/document identity, refuses
draft and version namespaces, and requires Sanity's delivery metadata. The
receiver also requires a durable `SanityWebhookDeliveryStore` and a non-empty
revalidation result; an adapter cannot claim success with an in-memory dedupe
map or a no-op callback.

Configure one document webhook with POST, drafts and versions disabled, the
same 32+ character `SANITY_WEBHOOK_SECRET` as the receiving environment, and:

```groq
// Filter
_type == "agencyPage" && defined(agencyId)

// Projection (also exported as SANITY_WEBHOOK_PROJECTION)
{
  "_type": coalesce(after()._type, before()._type),
  "agencyId": coalesce(after().agencyId, before().agencyId)
}
```

The `before()` fallback is required for delete deliveries. Rèm Việt mounts the
receiver at `POST /api/sanity/webhook`, records each `idempotency-key` in D1,
reclaims abandoned processing leases, releases failed work for Sanity retry,
purges the exact Cloudflare page keys, and retains completed delivery records
for 30 days. Missing configuration returns 503; invalid signatures and scope
mismatches fail closed without echoing secrets or payloads.

## Hosted conformance gate

The official client is wired only in the verifier script; neutral package source
continues to depend on `SanityClientPort`. Set `SANITY_PROJECT_ID`,
`SANITY_DATASET`, `SANITY_STUDIO_URL`, and `SANITY_PREVIEW_URL`, then run a dry
run to obtain the exact confirmation phrase:

```bash
bun run cms:sanity:hosted --id="proof-2026-08-16"
```

The mutating run additionally requires a server-side `SANITY_API_TOKEN` with
document read/write access:

```bash
bun run cms:sanity:hosted --apply --id="proof-2026-08-16" \
  --confirmation="VERIFY SANITY <project>/<dataset> proof-2026-08-16"
```

Apply requires a clean checkout. Receipt schema v3 binds the complete hosted
run to that full Git commit; it does not accept a caller-supplied abbreviated or
dirty provenance claim.
Schema-v2 hosted receipts are intentionally rejected and must be regenerated;
they cannot prove which verifier revision touched the external dataset.

The gate is staging-only unless both `--allow-production` and the confirmation
suffix `PRODUCTION` are supplied. It creates a disposable two-block draft,
checks a stable-`_key` Content Source Map, proves optimistic conflict handling,
publishes, unpublishes, and deletes. It also runs the neutral global-content
create, draft-isolation, publish, compensating-rollback, optimistic-conflict,
immutable-history, and restore-as-new-version scenario. The current global
document and all five proof revisions must be deleted before a complete receipt
is created with exclusive-write semantics below `docs/releases/evidence/`.
Tokens are never included in output. The gate is implemented locally; hosted
global-content evidence exists only after this command passes against the named
real dataset and its receipt is retained.

## Presentation receipt gate

After the schema-v3 hosted receipt has been committed, the separate
Presentation gate converts the browser-visible requirement into a reproducible,
fail-closed receipt. Configure `SANITY_PRESENTATION_URL_TEMPLATE` with one
`{id}` placeholder and keep an authenticated Playwright storage state below the
Git-ignored `.playwright/.auth/` directory. Capture that state with
`bun run cms:sanity:presentation:login`, then inspect the non-mutating command:

```bash
bun run cms:sanity:presentation --id="proof-2026-08-16" \
  --hosted-receipt="docs/releases/evidence/<schema-v3-hosted-receipt>.json"
```

Apply only from a clean checkout with the exact phrase printed by dry-run:

```bash
bun run cms:sanity:presentation --apply --id="proof-2026-08-16" \
  --hosted-receipt="docs/releases/evidence/<schema-v3-hosted-receipt>.json" \
  --confirmation="VERIFY SANITY PRESENTATION <project>/<dataset> proof-2026-08-16"
```

The versioned receipt is bound to the full Git SHA, the completely parsed
schema-v3 hosted receipt, its source commit and digest, the exact Studio/preview origins, an
authenticated desktop-Chrome observation, cleanup checks, and SHA-256 hashes
for one Playwright report plus one screenshot. Distinct HTTPS origins are
mandatory so CHIPS is actually exercised. Browser failure output is bounded
and redacted; failed or partial runs cannot leave a success receipt. The gate's
existence is local evidence only—promotion still requires retaining a complete
receipt produced against the named external staging project.

## Promotion-readiness gate

Commit the Presentation receipt, report, and screenshot without changing
source. Then run `cms:sanity:promotion` with the hosted and Presentation proof
ids and receipt paths. Dry-run is network-free and prints the exact confirmation;
`--apply` requires a clean checkout and writes one exclusive promotion receipt.
The verifier fully parses both receipt schemas, validates the hosted binding and
all four file hashes, requires strict Git ancestry, proves that both commit
intervals contain evidence-only changes, and confirms that the hosted receipt
blob already existed at the Presentation proof commit while the browser receipt
and artifacts did not. Exact evidence bytes are protected from line-ending
conversion by `.gitattributes`.

This gate never edits package versions or claims commercial approval. It makes
the technical promotion decision auditable after both external runs have
actually occurred.

Reference contracts:

- https://www.sanity.io/docs/apis-and-sdks/js-client-querying
- https://www.sanity.io/docs/visual-editing/visual-editing-client-stega
- https://www.sanity.io/docs/content-lake/dispatch-actions
- https://www.sanity.io/docs/content-lake/transactions
- https://www.sanity.io/docs/content-lake/webhooks
- https://www.sanity.io/docs/content-lake/webhook-best-practices
