# Rèm Việt Visual Studio

This optional Sanity Studio is the executable visual-editing edge for the
experimental `@agency/cms-provider-sanity` adapter. It deliberately remains
outside the stable Platform Kit artifact set.

## Proven scope

- One provider-created `agencyPage` document.
- The bounded Hero + FAQ vertical slice only.
- Human-readable fields, SEO, responsive Presentation iframe, stega overlays,
  click-to-edit, in-place mutation refresh, and stacked Content Release
  perspectives.
- Native Sanity image selection for Hero and SEO, including crop/hotspot
  controls, with portable URL fallbacks for existing provider-managed assets.
- Stable neutral IDs encoded as Sanity `_key` values and schema `_type`
  discriminators.
- Atomic `version` increments and the signed-in Studio user ID on direct edits,
  preserving the provider's optimistic-concurrency contract.

The Studio intentionally disables new-document templates for provider-managed
types. Create the page through `createSanityCmsPageProvider`, passing
`encodeRemVietSanityPageContent` as `encodeContent`; the provider owns the
deterministic document identity and initial version metadata. Direct editing of
`agencyGlobal` and `agencyGlobalRevision` is also intentionally absent because
it would bypass the immutable global-revision contract.

## Configure

Copy `apps/studio/.env.example` to an uncommitted `.env` and set:

- `SANITY_STUDIO_PROJECT_ID`
- `SANITY_STUDIO_DATASET`
- `SANITY_STUDIO_PREVIEW_URL`
- `SANITY_STUDIO_ALLOW_ORIGINS`

The preview frontend requires the matching optional server bindings:

- `SANITY_PROJECT_ID`
- `SANITY_DATASET`
- `SANITY_STUDIO_URL`
- `SANITY_API_READ_TOKEN` (Viewer access; server only)
- `SANITY_PREVIEW_COOKIE_SECRET` (at least 32 characters; server only)
- `SANITY_WEBHOOK_SECRET` (separate 32+ character secret; server only)

All five frontend values are all-or-nothing. An incomplete configuration fails
closed. Add the exact frontend origin to the Sanity project CORS settings and
to `SANITY_STUDIO_ALLOW_ORIGINS`; never use a wildcard.

## Run and verify

```bash
bun run dev:web
bun run dev:studio
bun --cwd apps/studio test
bun --cwd apps/studio check-types
bun run build:studio
```

Opening Presentation performs Sanity's short-lived secret handshake, then the
frontend issues only signed, HttpOnly, no-store draft requests. The read token
never enters route data or browser JavaScript. The preview route allows framing
only by the configured Studio origin and supports CHIPS partitioned cookies for
cross-site iframe operation.

When a native Hero or SEO asset is selected it takes precedence over the
fallback URL. The frontend's code-owned GROQ projection selects the complete
asset object and Sanity's official image URL builder applies the saved crop/hotspot at
the Hero or SEO target ratio before emitting an ordinary URL and ID into the
portable image contract. Sanity references never cross into the neutral
renderer/template API. Keep the fallback until the document has
been verified in Presentation so existing content remains immediately
recoverable.

A successful local build is not a hosted receipt. Before promoting the adapter,
retain both the schema-v3 hosted-conformance receipt and a browser-visible proof
that draft activation, click-to-edit, in-place updates, perspective switching,
and cleanup pass against the named external staging dataset.

### Authenticated Presentation receipt

First run the hosted-conformance gate from a clean checkout and retain its
Git-bound schema-v3 receipt in a
clean commit. Then configure these operator-only values outside Studio's client
bundle:

- `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_STUDIO_URL`, and
  `SANITY_PREVIEW_URL` for the exact hosted staging scope;
- `SANITY_API_TOKEN` with document read/write access;
- `SANITY_PRESENTATION_URL_TEMPLATE`, the exact deployed Presentation URL with
  `{id}` where the proof id is substituted;
- `SANITY_PRESENTATION_STORAGE_STATE=.playwright/.auth/sanity.json`.

Capture a signed-in browser state in the ignored auth directory. The visible
browser must be closed after confirming that the exact Studio and Presentation
tool are accessible:

```bash
bun run cms:sanity:presentation:login
```

Use the dry run to obtain the exact confirmation and inspect scope without
network access, dataset mutation, browser launch, or evidence writes:

```bash
bun run cms:sanity:presentation --id="proof-2026-08-16" \
  --hosted-receipt="docs/releases/evidence/sanity-hosted-proof-2026-08-16.json"
```

From that clean checkout, execute the exact confirmed command:

```bash
bun run cms:sanity:presentation --apply --id="proof-2026-08-16" \
  --hosted-receipt="docs/releases/evidence/sanity-hosted-proof-2026-08-16.json" \
  --confirmation="VERIFY SANITY PRESENTATION <project>/<dataset> proof-2026-08-16"
```

The runner creates disposable published/draft Hero + FAQ content, proves the
authenticated HTTPS Studio, signed HttpOnly and partitioned iframe cookies,
embedded stega overlay, click-to-edit, mutation refresh without navigation,
published/draft perspectives, and responsive viewport behavior. It verifies
source-document and newly created preview-secret cleanup before exclusively
writing a versioned receipt, Playwright JSON report, screenshot, Git SHA, hosted
receipt hash, and artifact hashes below `docs/releases/evidence/`. A failed run
writes no receipt and removes partial Presentation artifacts. Treat the storage
state as a credential: never commit, copy into evidence, or share it.

Commit the Presentation receipt and both artifacts, then run the final
read-only promotion chain verifier. It rejects source changes between the
hosted, Presentation, and evidence commits; each interval may contain only
files below `docs/releases/evidence/`:

```bash
bun run cms:sanity:promotion \
  --hosted-id="hosted-proof-2026-08-16" \
  --presentation-id="proof-2026-08-16" \
  --hosted-receipt="docs/releases/evidence/sanity-hosted-hosted-proof-2026-08-16.json" \
  --presentation-receipt="docs/releases/evidence/sanity-presentation-proof-2026-08-16.json"

bun run cms:sanity:promotion --apply \
  --hosted-id="hosted-proof-2026-08-16" \
  --presentation-id="proof-2026-08-16" \
  --hosted-receipt="docs/releases/evidence/sanity-hosted-hosted-proof-2026-08-16.json" \
  --presentation-receipt="docs/releases/evidence/sanity-presentation-proof-2026-08-16.json" \
  --confirmation="VERIFY SANITY PROMOTION <project>/<dataset> hosted-proof-2026-08-16 proof-2026-08-16"
```

The promotion receipt is readiness evidence, not an automatic package-version
change. Review and commit it before deliberately removing the adapter's
experimental status.
