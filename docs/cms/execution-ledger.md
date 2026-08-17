# Agency CMS execution ledger

Last updated: 2026-08-17

This ledger records evidence against `docs/agency-cms-master-plan.md`. “Complete”
below means the implementation and local/reproducible gates are complete. It
does not replace the external release gates at the end of this document.

## Release snapshot

Status: **technical release candidate**. Do not tag
`v1.0.0-client-ready` yet.

| Milestone                     | Implementation                 | Exit evidence                            | External gate                                 |
| ----------------------------- | ------------------------------ | ---------------------------------------- | --------------------------------------------- |
| M0 — Lock baseline            | Complete                       | Complete                                 | None                                          |
| M1 — Safe content core        | Complete                       | Complete                                 | None                                          |
| M2 — Flagship content-driven  | Complete                       | Staging desktop/mobile smoke complete    | Final customer visual approval                |
| M3 — Human editor             | Complete                       | Automated workflow pass                  | Non-developer usability pilot pending         |
| M4 — Preview/publish workflow | Complete                       | Staging workflow + real cron pass        | None                                          |
| M5 — Client operations        | Partial: event source complete | D1/R2/lead + alert capability audit      | Real notification/error-alert routing pending |
| M6 — White-label              | Complete                       | Local + real isolated staging smoke pass | Clean-checkout provenance receipt pending     |
| M7 — Hardening/pilot          | Technical scope complete       | Staging smoke/Lighthouse complete        | Real-user p75 and human pilot pending         |

## M0 — Lock baseline

Status: complete.

| Deliverable                       | Evidence                                                   |
| --------------------------------- | ---------------------------------------------------------- |
| Published revision ADR            | `docs/adr/0001-published-revisions.md`                     |
| Role/capability ADR               | `docs/adr/0002-staff-roles-and-capabilities.md`            |
| Preview security ADR              | `docs/adr/0003-preview-security.md`                        |
| Per-client isolation ADR          | `docs/adr/0004-per-client-isolation.md`                    |
| Test strategy ADR                 | `docs/adr/0005-test-strategy.md`                           |
| Scheduler and rich-text decisions | `docs/adr/0006-scheduler.md`, `docs/adr/0007-rich-text.md` |
| Field-level landing inventory     | `docs/cms/landing-content-inventory.md`                    |
| Desktop/mobile visual guard       | 18 PNGs under `docs/visual-baselines/2026-08-13/`          |
| Contract test harness             | `packages/cms/tests`, `packages/api/tests`, `apps/web/e2e` |

## M1 — Safe content core

Status: complete.

- Immutable `page_revisions` and `post_revisions` snapshots with published
  pointers, document versions, actors and timestamps.
- Public reads resolve only the published snapshot and fail closed on malformed
  payloads; admin reads the working document.
- Publish, unpublish and restore are explicit services. Restore creates a new
  working draft and never silently republishes.
- `staff_roles` enforces owner/admin/editor capabilities on the server, with
  bootstrap-owner compatibility through `ADMIN_EMAILS`.
- The Owner-only staff console creates accounts, changes roles and revokes CMS
  access while protecting self, bootstrap and last-owner invariants.
- `audit_events` records content, settings, menu, media, staff and sensitive
  authentication activity. The Admin/Owner audit inbox is capability-gated.
- Optimistic version checks prevent two tabs from silently overwriting one
  another.
- Duplicate page/post slugs fail at the service boundary as explicit `CONFLICT`
  responses; create and update forms surface that error instead of silently
  failing or leaking an internal-server response.
- Backfill and seed paths are additive/idempotent and preserve revision history.

Automated evidence: CMS contracts, role policy, API capability boundaries,
partial-update semantics, duplicate page/post slug rejection and public/draft
isolation pass in `bun run test`. Migration verification applies all 12
migrations to an empty database and an upgraded fixture, including page/post
revision backfill and the editorial-review event table plus both required
indexes.

## M2 — Flagship content-driven

Status: complete.

- A shared typed registry defines all ten landing blocks: Hero, Threat, Bento,
  Craft, Horizontal Gallery, Measure, Benefits, Marquee, FAQ and Footer.
- The `home` seed contains all ten blocks and an immutable initial published
  revision.
- The public homepage renders the published document only. Runtime migration
  fallback, fallback copy and block de-duplication were removed.
- Landing components receive content props while preserving the existing GSAP,
  Lenis, reduced-motion and responsive behavior.
- Browser-only GSAP plugin/ease registration keeps Cloudflare Worker SSR free of
  module-scope timers.

Runtime evidence: the E2E workflow edits seeded content, confirms the draft is
private, publishes without deploying, restores an older revision without making
it public, then republishes it. Desktop and mobile public-renderer smoke passes.

## M3 — Human editor

Status: implementation complete; external usability validation remains under
M7.

- Human-readable block forms replace raw JSON for normal admin/editor use.
- Site identity, contact/social links, homepage flags and nested header/footer
  menus also use structured fields; no normal client route asks for JSON.
- Array items support add, duplicate, reorder and removal; blocks support
  enable/disable and ordering within registry constraints.
- Media library and picker integrate alt text and usage metadata. The library
  now exposes grid/list views, key/alt search, MIME and upload-date filters,
  pagination, copy URL, real per-file upload percentage and retry from an
  explicit failed state.
- Dirty state, debounced autosave, explicit save state and optimistic conflict
  responses are implemented.
- All submitted values remain schema-validated at the server boundary,
  including safe link, media and embed protocols.
- Homepage, standard-page and post editors now share a version-bound editorial
  review panel. Editors can save and request review, while only Admin/Owner can
  approve or request changes; publish remains a separate server capability.
  Request and decision are independently authorized by
  `content.review.request` and `content.review.decide`; neither procedure
  inherits write or publish authority. The app renders request, decision and
  publish affordances from server-issued capability claims rather than role-name
  checks, and the shared admin resolver gates both review action directions.
  Requests and decisions are immutable audit events with bounded notes. Any
  later save makes the older request stale instead of silently carrying an
  approval onto changed content.

E2E evidence: admin sees human fields and no JSON editor; structured controls
add, duplicate, reorder, delete and hide content without raw JSON; debounced
autosave survives a reload; an immediate internal navigation waits for the
dirty draft to save; and a genuine stale second tab receives the optimistic-
conflict response and can load the winning server version. Editor can edit and
preview, request review, but has no review-decision, publish or restore control.
Server API tests independently prove that a forged editor publish call receives
`FORBIDDEN`, and that forged review queue/decision calls name the missing
`content.review.decide` capability. The
real-R2 media lifecycle deliberately aborts its first upload, retries to a 201,
reaches 100%, exercises date/MIME/search and grid/list controls, copies the URL,
updates alt text, selects the asset into page SEO, proves usage protection and
then cleans up both the reference and object.

The post editor now has the same loss-prevention contract: a valid dirty draft
autosaves after 1.6 seconds, displays dirty/saving/saved/version state, flushes
before internal router navigation and retains the local form on an optimistic-
version conflict. Browser/tab shutdown uses the native unsaved-change warning,
because browsers cannot guarantee an asynchronous write during unload. A
published slug change is deliberately held out of background autosave so the
explicit save action can offer redirect creation. The browser scenario proves
autosave persistence after reload, immediate-leave persistence and a real
two-tab race in which the stale tab keeps its local values, reports the conflict
and can explicitly load the winning server version.

Post authoring now also embeds a Desktop/Tablet/Mobile working-copy preview.
The editor streams the current typed form values through a same-origin,
parent-scoped message into the existing authenticated private preview route;
that route keeps the saved server draft as its detached-tab fallback and uses
the shared `PostContent` body renderer. Incomplete local edits can therefore be
inspected before autosave without relaxing save validation, authentication,
private/no-store headers or robots controls. Exact canvas annotations cover the
date, title, description, cover, tags and structured body. Mouse and keyboard
selection returns a validated same-origin field intent, shows hover/selection
feedback and focuses the real mounted form control. Structured body wrappers
now expose snapshot-bound drag/drop edges plus keyboard move,
insert-paragraph, duplicate and remove commands; stale content snapshots fail
closed, while detached saved-draft output contains no authoring hooks. The
focused isolated Cloudflare lifecycle passed in 23.7 seconds. It proves exact
block focus, rendered drag, bounded composition and restoration alongside
title/description selection, hover identification, an unsaved description
marker, the exact 390px mobile
viewport, the existing autosave/navigation flush and conflict recovery,
private preview headers/meta and anonymous guard, public isolation, publish,
automatic old-slug redirect, immutable comparison, restore, accessibility and
exact fixture/redirect cleanup. This is local product evidence, not the
outstanding human pilot or hosted release receipt.

The reviewer dashboard now lists the latest current request for each page/post
via a ranked D1 query without dropping an older open request merely because
unrelated audit volume crosses a fixed scan limit. Stale requests retain their
immutable provenance but leave the actionable queue.
A signed-in Browser run proved seeded-post request → queue → approval. A fresh
production-Worker Playwright lifecycle passed again in 8.2 seconds and independently
proved disposable page creation, version-bound request, queue deep-link,
approval, queue removal, automated accessibility and exact cleanup. These are
local technical receipts, not the outstanding non-developer handover pilot.
After the exact-capability hardening, a focused two-scenario Worker run passed in
11.0 seconds: the full lifecycle remained intact, while the Editor saw request
but no decision, change-request, publish or restore action. Package/API tests,
all 18 root typecheck tasks and the packed eight-artifact consumer also pass.

Editorial review is now a reusable Platform Kit boundary rather than a copied
Rèm Việt service. Core exports bounded target/request/decision schemas and
separate provider capabilities; runtime exports immutable newest-first state
derivation, a small workflow port and an executable conformance scenario; admin
exports the framework-neutral presentation/action model consumed by the shared
localized panel, with explicit request and decision grants required before an
action becomes available. Cloudflare migration `0005_editorial_reviews` provides guarded
immutable D1 events and a ranked current queue. Its page provider records the
publication event inside the same batch as the immutable revision and published
pointer. The provider conformance passes request idempotency, current/stale
queue behavior, stale-decision rejection, re-request, required change notes,
approval and exact-version publication resolution. Package tests, API tests,
boundary tests and both API/web typechecks pass locally. The packed clean
consumer also installs all eight tarballs, builds, then executes the review
conformance and neutral admin `published` presentation from public exports.

## M4 — Preview/publish workflow

Status: complete, including real Cloudflare scheduled execution on staging.

- Session-protected, `noindex`, private/no-store preview uses the same block
  renderer as public output and provides responsive viewport controls.
- New-tab preview first flushes the latest dirty homepage/post draft; validation
  or conflict failure closes the temporary tab instead of showing stale data.
- Publish confirmation, validation summary, revision metadata and explicit
  restore flow are present.
- Homepage, standard-page and post headers expose a direct revision-history
  shortcut. Expanded revisions use a shared accessible before/after surface;
  app adapters explicitly opt public fields into normalized, 160-code-point
  summaries while arbitrary structured values and internal media identifiers
  remain hidden. Historical page/post snapshots are schema-normalized before
  comparison so missing legacy defaults cannot masquerade as SEO changes.
- Schedule/unschedule is implemented with an idempotent scheduled-content
  service and Cloudflare cron entrypoint.
- Slug changes surface redirect creation instead of silently breaking URLs.

Evidence: anonymous preview redirects to login; draft/publish/restore and
schedule/unschedule workflows pass against the production Worker artifact.
Fresh-state E2E also edits homepage and post content, clicks preview before the
1.6-second debounce, and proves each newly opened private preview renders the
exact just-saved marker. On staging, a uniquely identified due draft was
published by the real every-minute Cloudflare cron. It produced exactly one
immutable revision and one `page.publish` audit event; only the smoke rows were
then removed. A signed-in local Browser review additionally proved that the
post History shortcut reaches the expanded comparison and that the seeded
legacy revision reports only its real content-format change. Package tests prove
the opt-in/fail-closed summary boundary and truncation. Focused production-Worker
post and standard-page lifecycles assert both sides of slug and CTA changes and
run the existing automated accessibility scans.

## M5 — Client operations

Status: partial. The client operations, degraded-health and privacy-safe incident
source implementation is complete, but the master plan's external error-alert
route is not configured or receipt-proven yet.

- Structured SEO fields, canonical metadata, robots controls and a sitemap that
  excludes drafts/previews.
- Theme-owned `Store`/`Organization` JSON-LD is derived from the validated site
  manifest plus customer-editable CMS contact settings, and serialized so
  content cannot terminate the script element.
- Redirect CRUD with collision/loop validation.
- Durable, idempotent lead submission with size limits, honeypot/rate limiting,
  inbox status workflow, CSV export and retention cleanup.
- Health endpoint plus durable notification attempt state. Resend requests use
  `lead/<submission-id>/email-v1` as the provider idempotency key; the cron
  retries email after 1, 5, 15, 60 and 240 minutes, stops after six total
  attempts or 23 hours, safely recovers an ambiguous `pending` attempt after 10
  minutes, and never auto-retries Telegram because that adapter has no provider
  deduplication guarantee.
- Alchemy forces `NOTIFICATIONS_REQUIRED=1` in staging/production and `0` in
  local/dev. An active email-enabled form with missing Resend configuration now
  fails closed in deployed stages and makes `/api/health` return 503 before a
  lead is submitted; the response exposes only the missing provider name.
  Telegram remains optional unless configured, while real Telegram provider
  errors still become durable failures/incidents.
- Failed/skipped email can be retried by an authorized operator from the lead
  inbox. Provider failures and stale pending attempts make `/api/health` return
  503 until an operator resolves them; adapter results, attempt count, next
  retry and audit events remain attached to the durable lead row.
- `site:notification:smoke` turns the external Resend acceptance test into a
  fail-closed two-phase workflow. Dry-run reads health, the active form and the
  manifest-owned D1 only. Apply requires a stable UUID and exact origin
  confirmation, creates one synthetic lead, sends once and replays the public
  idempotency key; D1 must retain one row, one sent email adapter/provider ID and
  `attemptCount=1`. Verify replays only an existing key and withholds release
  evidence until the operator attests the real inbox receipt timestamp.
- `cloudflare:alerts:policy` provides the matching fail-closed alert-policy
  workflow. Dry-run validates the live Workers Observability `FIRING_FAILED`
  contract, email eligibility, private recipient presence and deterministic-name
  collisions. Apply requires exact origin plus policy-name confirmation and can
  create one policy only; it never updates/deletes drift. Verify accepts only a
  dispatch whose provider `policy_id` matches that exact policy and withholds
  schema-v2 evidence until the operator records the real inbox receipt time.
- Manifest-aware remote D1 backup plus local-store backup/restore scripts and
  agency runbook. Remote export refuses overwrite, keeps output inside the
  ignored `backups/` root, streams SHA-256, redacts provider URLs and verifies a
  unique isolated local restore before emitting evidence metadata. The remote
  restore drill validates that evidence again, requires an existing empty
  `<site>-restore-drill-*` target plus exact confirmation, then enforces D1
  `PRAGMA quick_check` and exact table/row parity without auto-create/delete.
- Every site manifest now names a separate private backup bucket outside the
  Alchemy application stack. Preparation preserves existing lock rules and
  requires exact confirmation before creating the bucket or adding a `d1/`
  retention rule. Preparation and archive apply both fail closed if managed
  `r2.dev` access or any custom domain is enabled; they report only sanitized
  booleans/counts and never disable a domain automatically. Archive apply reruns
  the local restore, requires a covering lock, refuses overwrite, downloads the
  object, and emits `immutable=true` evidence only after exact SHA-256 and size
  parity.
- A weekly/manual GitHub Actions workflow composes the same five fail-closed
  steps for periodic operation. It requires an explicit manifest site/stage,
  account ID and dedicated environment token, never loads interactive OAuth in
  CI, uploads only non-secret JSON evidence and never uploads the SQL artifact
  to GitHub. Repository variables/secret, the first green manual dispatch and
  the following weekly receipt are still external activation evidence.
- Upload validation covers extension, MIME, magic bytes, size/batch limits,
  server-generated keys, alt text and delete protection for referenced media.
  The reference scanner covers page/post SEO images, post covers, structured
  body/block content, immutable revisions, products and site settings.
- Interactive/scheduled publish, media/product-image upload, initial/retry
  notification and D1 migration failures emit the bounded
  `cms.operational_incident` contract with stable category/operation
  fingerprints. Actor data, form payloads and stacks are excluded; free text is
  redacted before provider logging.

Evidence: redirect contracts, safe URL protocols, lead idempotency, admin
operations pages, sitemap, structured data, health and local backup/restore all
pass. Unit coverage proves the stable Resend idempotency header, provider ID
capture, stage-aware missing-credential behavior, incident redaction and
retry-window boundaries. A production-Worker browser regression additionally
proves upload, alt update, picker selection into a page OG image, blocked delete
while referenced, reference cleanup and final media deletion. The staging suite
proved real R2 upload, fetch, alt update and delete cleanup plus the lead inbox lifecycle. Provider
credentials for outbound email/Telegram and alert routing are intentionally
still unconfigured, so real delivery is not claimed. This is now an external
configuration/evidence gap rather than a missing runtime incident source.

The current fail-closed Worker was deployed to flagship staging on 2026-08-14.
Alchemy updated only the Worker plus `NOTIFICATIONS_REQUIRED`; D1 and R2 were
no-ops, and the following Alchemy dry-run reported all three resources as
converged. Public remained HTTP 200. After edge propagation, six consecutive
health reads returned the expected HTTP 503 with `required=true`, configuration
`degraded`, only `email` named missing, and zero failed/stale attempts.

The following live notification smoke dry-run performed only health/form/D1
reads and sent no request. It confirmed that provider configuration is now
exposed but email runtime configuration is absent, so it failed closed before
apply. This is an external secret/sender/recipient and delivery-evidence gap, not
a missing deployment contract or a claim that Resend delivery passed.

The read-only, redacted `cloudflare:alerts:audit` command queried the live
account on 2026-08-14. Cloudflare exposes 57 eligible alert types, including
Health Check status and Workers Observability alerts; email delivery is eligible
and ready. The account has one unrelated billing-budget email policy, no enabled
operational policy and no dispatch history in the 30-day slice. The command
never copies recipient IDs, webhook URLs, policy IDs, filters, alert bodies or
account credentials into its report and exits non-zero until a matching policy
and receipt exist. Receipt matching now remains internal and requires the
dispatch's provider `policy_id` to equal the enabled operational policy ID; an
unrelated dispatch of the same alert type cannot pass.

The following `cloudflare:alerts:policy` live dry-run also sent nothing. It
confirmed that the provider exposes the Workers Observability `FIRING_FAILED`
filter and that email delivery is eligible/ready. It found no deterministic
same-name policy and stopped because `CLOUDFLARE_ALERT_EMAIL` is absent. No
recipient, account ID, policy ID, filter payload or dispatch body was printed.

## M6 — White-label

Status: implementation and isolated second-site staging runtime are complete;
clean-checkout provenance remains a release-evidence gate.

- Typed `site.manifest.json` contract with brand, features, content preset and
  per-stage resource names.
- Idempotent `site:init`, `site:seed`, `site:build`, `site:deploy` and
  `site:verify` commands, including dry-run support.
- `site.manifest.siteUrl` is an HTTPS origin contract, not an arbitrary URL.
  Client env templates are parsed strictly: required keys must be complete and
  unique, origins must match the manifest, unknown keys are rejected, and
  secrets/recipients must stay empty in committed templates.
- Worker, D1 and R2 names derive from site key and stage; no Rem Viet resource
  name leaks into the `acme-demo` plan.
- The production-Worker E2E harness accepts `--site`, reads that manifest,
  builds with the selected site ID, derives a fresh isolated Worker/D1/R2
  configuration, applies every migration, selects the site's own seed and
  validates its published homepage snapshot before browser startup.
- Per-site handover checklist and seeded demo content. Init creates a neutral,
  site-named logo placeholder and verify proves every local seed asset exists.
  Existing client-owned seed/env/handover/logo changes are reported as
  `preserved`, never overwritten.

Evidence collected for `sites/acme-demo`:

```text
bun run site:init --id=acme-demo --preset=showcase                    5 unchanged
bun run site:build --site=acme-demo                                  PASS
bun run site:deploy --site=acme-demo --stage=staging --dry-run       PASS
bun run site:seed --site=acme-demo --dry-run                         PASS
bun run site:verify --site=acme-demo                                 ok=true; 14 assets present
bun run test:e2e:second-site                                         PASS (3/3 desktop)
worker=acme-demo-web-staging
d1=acme-demo-db-staging
r2=acme-demo-media-staging
```

The three Acme scenarios run against a fresh production Worker plus isolated
temporary D1/R2 state. They prove the Acme manifest/seed/deployment identity,
authenticated homepage draft/publish/restore and media
upload/alt/usage-protected delete. Exact cleanup runs after the browser exits.
This local proof is now supplemented by a real Cloudflare staging receipt from
2026-08-15. Private env preparation generated unique credentials without logging
values, Owner bootstrap completed idempotently, and the first apply created the
manifest-owned Worker, D1 and R2 in about 55 seconds. The homepage returned HTTP
200 with Acme identity, the database had all 26 migrations/tables, and the
immediate plan converged all three resources to `noop`.

After the browser smoke, the owner confirmed the usable login credential was
stored outside the repository. The one-time bootstrap binding is absent from the
ignored private env; the reusable finalization command now requires an explicit
`--credential-stored` acknowledgement before removing a present value.

The live Owner browser smoke passed homepage draft isolation, publish, public
visibility and revision restore in 10.6 seconds. Media smoke passed upload retry,
R2 delivery, alt text, picker usage, referenced-media Owner warning and exact
page/media cleanup. A post-smoke database receipt reported zero interrupted E2E
pages, zero interrupted E2E media, and `quick_check=ok`. The account is now 10/10
D1 because the previously restored-and-cleaned slot is intentionally occupied by
`acme-demo-db-staging`; Rem Viet and Acme use separate D1/R2/Worker resources.

The remaining public second-site smoke flags were then exercised directly:
Acme sitemap returned HTTP 200 with a valid URL set and no admin/preview paths;
the contact submission returned `202`, its exact replay returned duplicate
`202`, remote D1 contained exactly one durable row, and exact-key cleanup left
zero rows.

The Worker was deployed from a dirty implementation checkout and correctly
reports `sourceState=dirty`. This is authoritative isolated runtime evidence,
but it does not satisfy the clean-checkout release provenance gate.

`site:smoke:staging` now owns the final clean repetition. Its current Acme
dry-run reports the ignored private env but truthfully withholds readiness for
the dirty checkout, missing process-injected password and missing final timing
windows; it prints no values. A negative apply without exact site/origin
confirmation exited before health/provider/browser access. Unit contracts prove
timestamp ordering, the 120-minute/one-day KPI ceilings, exact three-test JSON
reporting and generation of the schema-valid seven-flag `secondSite` fragment.

## M7 — Hardening and pilot

Status: technical scope complete; external release gates pending.

- Root `quality` command is the single reproducible local gate.
- Root `quality` permanently runs both the full Rem Viet production-Worker suite
  and the focused `acme-demo` second-site reuse suite.
- The production build inside `quality` injects unique canaries for all 13
  server-only configuration keys, then scans every generated client artifact
  for raw, JSON-escaped and URI-encoded values. It also checks configured local
  private values while never printing them.
- The gate now starts with critical/high dependency and 89-check migration
  compatibility audits plus a pinned, executable Prettier check, then
  typechecks every workspace rather than only the four core data/application
  packages.
- The production Worker harness runs an API migration smoke before Playwright.
  It verifies legacy REST compatibility, including the restored authenticated
  `/api/logs/:logId` detail route, and sequential body-bearing authorization
  failures. This caught and now guards the request-body drain regression that
  could corrupt a reused Worker proxy connection.
- Production-artifact Playwright coverage runs through Wrangler with one shared,
  deterministic D1 worker.
- Desktop and mobile checks cover authentication, human home editor, private
  preview, publish/restore, capability boundaries, Owner staff governance,
  audit, structured settings/navigation, scheduling, media, leads, health,
  sitemap, structured data, keyboard semantics and horizontal overflow.
- Official `@axe-core/playwright` scans enforce WCAG 2.0 A/AA, WCAG 2.1 A/AA,
  WCAG 2.2 AA and best-practice rules on public desktop/mobile routes plus the
  authenticated admin shell and its independently loaded private preview. No
  axe rule is disabled or allowlisted.
- Performance artifact budgets are executable in
  `scripts/audit-performance.ts` and documented in
  `docs/performance-budgets.md`.
- Privacy-minimized RUM is implemented end-to-end: sampled public browser
  collection, same-origin schema-validated ingestion, D1 deduplication and
  90-day retention, authenticated nearest-rank p75 reporting and JSON evidence
  export. Automated/synthetic traffic is excluded from the release summary.
- `site:vitals:audit` is the provider-authenticated release path for that field
  data: one fixed read-only SQL statement queries the remote manifest-owned D1,
  uses a half-open 28-day window, excludes `/__synthetic__/`, applies the same
  nearest-rank/75-sample budgets and withholds its copy-safe release object until
  all CLS/LCP/INP gates pass. Account/database identifiers and provider errors
  never enter its report.
- The RUM collector and `web_vitals` migration were deployed to flagship
  staging on 2026-08-14. Live smoke returned `202` for an insert and its
  duplicate, `400` for a query-bearing pathname and `403` cross-origin. The
  synthetic row was read from remote D1, deleted by exact ID/path and confirmed
  absent. The immediate non-synthetic sample query returned zero rows, and a
  same-day read-only aggregate recheck still returned zero. This proves plumbing
  only—not representative p75 field performance.
- The migration-compatibility/body-drain fix was deployed to the same Worker.
  Six sequential unauthenticated legacy API checks returned `401` and the
  reused connection then returned `200` from `/api/health`. A post-deploy
  Alchemy dry-run reported three no-ops (Worker, D1 and R2).
- Security review, Vietnamese client manual, handover script and agency
  operations runbook are present.
- A strict schema-v3 client-ready evidence contract and `release:verify` command
  bind the remaining pilot, field-vitals, exactly-once Resend, enabled/delivered
  Cloudflare alert, isolated staging restore, isolated second-site, production
  pre-migration backup and distinct manual/weekly immutable backup receipts to
  one clean Git commit. Tag-triggered CI reruns full quality and refuses the
  release when the evidence file is absent or any threshold is incomplete.
- `release:readiness` runs live capacity, alert history, deterministic
  alert-policy, field-vitals and read-only notification-smoke preflight audits in
  parallel when site/stage/origin are supplied, then composes them with
  schema-v3 evidence plus Git commit/clean-checkout state and live Worker
  deployment provenance. It strips all database IDs/names,
  recipient/policy payloads, smoke UUIDs and provider errors before reporting
  only safe counts, p75 values, booleans and next actions; no-argument mode
  explicitly reports both site audits as omitted instead of treating them as
  pass.
- The aggregate now validates the target before repository inspection or child
  audit spawn: the site must be a safe manifest slug, the release stage must be
  exactly `staging`, and the origin must be an origin-only HTTPS URL without
  credentials, path, query or hash. A real production-scope misuse previously
  collapsed into a generic child-audit failure; it now fails immediately with
  the staging requirement, while the correct live scope still returns the same
  sanitized red report. Fourteen focused readiness tests cover this boundary.

Flagship staging evidence on 2026-08-14:

```text
Worker / D1 / R2                    LIVE through Alchemy
Owner bootstrap + Better Auth      PASS (dashboard rendered)
Authenticated CMS staging suite    5 passed
Public desktop/mobile suite        10 passed
Real R2 media lifecycle            PASS
Real Cloudflare scheduler          PASS (one revision + one audit event)
Sequential protected API smoke     PASS (6 x 401, then health 200)
Alchemy post-deploy convergence    PASS (3 resources noop)
Lighthouse accessibility           100 mobile / 100 desktop
Automated axe accessibility        PASS (WCAG 2.0/2.1 A/AA + 2.2 AA; zero violations)
Lighthouse best practices / SEO    100 / 100 on both profiles
Desktop warm modeled LCP           1.52 s (observed 1.86 s)
Mobile observed LCP, 3 traces      1.45–2.01 s
Mobile CLS                         0.008
```

Lighthouse's mobile throttling model still estimates LCP at 6.1–7.1 seconds and
performance at 55–58 despite the observed trace values above. These are lab
results, not a substitute for real-user p75 or INP; both remain release gates.

Current local quality evidence on 2026-08-15:

The production-Worker E2E harness now creates a new, path-validated temporary
Miniflare state for every run, applies all migrations, seeds posts/home from the
checked-in SQL and validates the published homepage snapshot before starting
the Worker. A regression run initially proved all 29 browser checks against that fresh
D1/R2 state, removed the temporary state afterward and left the developer
`.alchemy/miniflare` tree byte-for-byte unchanged. This exposed and fixed four
real fresh-runtime defects: concurrent first reads of the site-settings
singleton now use conflict-safe initialization; the redirect form remains inert
until hydration and gives stable pending feedback; active-only redirect updates
no longer inject the create-time `301` default into an existing `307`; and the
home editor now remains non-interactive until its server revision is loaded, so
a late query cannot overwrite an early client edit and autosave stale content
while claiming success. Conflict recovery explicitly refetches and installs the
latest server revision. Desktop and mobile prove the human redirect lifecycle
from admin create to public HTTP status/`Location`, loop rejection,
disable/re-enable with status preservation, deletion and public fall-through.
The exact-path cleanup also uses a bounded Windows lock retry after its existing
safety validation, preventing a released Miniflare handle from producing a
false-negative `EBUSY` after every functional check has passed.

The expanded media workflow then exposed a separate asynchronous-control defect
in redirect administration: a controlled active checkbox could visually snap
back until its mutation completed even though the server accepted the update.
Redirect toggles now install an immediate local optimistic value, keep other
mutations disabled during the request, reconcile after the authoritative list
refetch and roll back on failure. The same fresh-state suite proves both the
forced media retry lifecycle and the redirect toggle on desktop/mobile.

The post-authoring pass added the 30th passing browser scenario. It revealed two
independent TanStack file-route composition defects: the admin post list and the
public blog list were parent routes that rendered themselves without an
`Outlet`, masking their nested create/edit/preview and detail routes. Both lists
now live at index routes under authenticated/public parent layouts. The
structured editor preserves multiple inline spans, bold/italic/code marks and
safe links instead of flattening them on edit; list items are independently
editable. The new authenticated draft preview is private, no-store and noindex.
The scenario proves structured content survives reload, drafts never leak,
publish and slug republish update public content, the old canonical and legacy
`.html` paths redirect, restoring an old revision changes only the draft, and
post/redirect cleanup is exact. Editor-facing delete UI is also hidden where
the server capability already denies it. The follow-up safety pass additionally
proves debounced post autosave survives reload, dirty homepage/post edits flush
before an immediate internal navigation or new-tab preview, both previews show
the just-edited marker, and recovery from a genuine stale-tab update is
deterministic. The focused mutation run passed 2/2 desktop with its serial mobile
mutations intentionally skipped; the complete suite then passed 30 with 8
intentional mobile skips.

```text
Root provisioning/release/backup contracts 70 passed / 261 expects
Infra capacity/alerts/vitals/notification  45 passed / 120 expects
CMS unit/contracts                 38 passed
API capability/services           24 passed
Web media/structured-data units     6 passed
Total unit/contract checks        183 passed
Migration verifier                 PASS (9 migrations; empty + upgraded fixture)
All workspace typechecks            PASS
Audited production web build       PASS (176 client files; 13 keys; 0 exposures)
Dependency audit (critical/high)    PASS (0 findings)
Migration compatibility audit      PASS (89 checks)
Pinned formatter check             PASS (Prettier 3.9.6)
Performance artifact audit         PASS (132.7/280.9/26.9 KiB gzip)
Production Worker migration smoke  PASS
Automated axe accessibility        PASS (public/admin/private preview)
Rem Viet Worker Playwright         35 passed, 9 intentionally skipped on mobile
Acme reuse Worker Playwright        3 passed
E2E isolation/cleanup               PASS (fresh state removed; dev state unchanged)
Root bun run quality               PASS
```

The Acme gate is manifest-driven rather than a renamed Rem Viet fixture. Its
generated local configuration uses Acme-specific Worker, D1 and R2 names and
contains no Rem Viet resource identity. The full root gate passed with this
second environment included; no runtime or Cloudflare resource was changed by
the local proof.

The closed-auth boundary is now covered in the same production-Worker suite on
desktop and mobile. The login screen exposes neither public registration nor
placeholder OAuth controls; public email sign-up returns 400 and a sign-in using
the same credentials remains 401. The password-recovery route truthfully directs
the user to the Owner/agency instead of simulating an email reset.

The live readiness snapshot after this gate correctly returned nonzero:

```text
D1 capacity                    10/10 used; both sequential proofs completed
zero-table owner-review        3 candidates; all actively Worker-bound
operational alert              policy missing; receipt missing
alert provisioning             provider contract/recipient ready; alerts OAuth missing
28-day field samples           CLS 0/75; LCP 0/75; INP 0/75
notification runtime           contract exposed; email configuration missing
schema-v3 release evidence     missing
release checkout               dirty during implementation
provider/account identifiers   suppressed
```

Generated Lighthouse JSON remains local evidence under `.tmp/lighthouse/` and
is now explicitly ignored by Git. This removes twelve large scratch artifacts
from release-checkout noise without deleting them or hiding the unrelated user
spreadsheet/installer that still require an explicit owner decision.

The nine Playwright skips are durable state-mutating scenarios already
exercised in the desktop project: autosave/two-tab conflict, structured home
mutation, publish/restore, lead lifecycle, scheduling, media and Owner staff
governance. Mobile still runs the human editor, operations, structured settings,
editor capability boundary, public/structured-data, accessibility and form
smoke. Serial execution is intentional because the tests share one seeded D1
database.

## Backup/restore evidence

Local D1 backup/restore drill:

```text
backups/alchemy-2026-08-13T09-07-00.973Z-160ca9ed640e893b18ba5dd2ef193049e9159aed575ae988b107586817c7bfb5.sqlite
integrity_check=ok
tables=27
pages=1; page_revisions=16; posts=4; media=0; form_submissions=0
```

Backups are ignored by Git and must be copied into the agency's protected backup
location for a real launch.

Staging D1 export/restore evidence:

```text
command: bun run site:backup --site=rem-viet --stage=staging --remote
backups/rem-viet-staging-20260814T103726Z.sql
sha256=26160e6752c95223b2e29082760fd2f0c5f2ae2bea30860fad60ab0d628da911
size=213469 bytes; immutable=false (local artifact)
restore target: isolated local temporary database
integrity_check=ok
tables=26
pages=1; page_revisions=4; posts=4; media=0; form_submissions=4; web_vitals=0
```

The manifest-aware command exported the live staging D1 without overwriting an
artifact, suppressed Wrangler's short-lived signed download URL, verified a
unique isolated local restore and emitted non-secret hash metadata. The local
artifact is explicitly not immutable and cannot satisfy production backup
evidence until copied to protected storage and hash-verified there. Its exact
hash-matched copy is protected in the private R2 archive described below.

After one D1 slot became available, the same artifact completed the isolated
Cloudflare-to-Cloudflare restore contract:

```text
bun run site:restore:remote --site=rem-viet --stage=staging \
  --file=backups/rem-viet-staging-20260814T103726Z.sql \
  --target=rem-viet-restore-drill-20260815 --apply/verify-only/cleanup
source sha256=26160e6752c95223b2e29082760fd2f0c5f2ae2bea30860fad60ab0d628da911
restore started=2026-08-15T01:54:22.700Z
restore verified=2026-08-15T01:56:29.198Z
recovery=2.11 minutes; quick_check=ok
tables=26; exact table parity=true; exact row parity=true
pages=1; page_revisions=4; posts=4; media=0; form_submissions=4; web_vitals=0
target deleted=2026-08-15T01:58:14.537Z
post-cleanup capacity=9/10 used; one slot returned
```

The original D1 export interleaved dependent inserts before referenced tables.
Remote D1 rejected that ordering even though the local restore was valid. The
restore tool now builds an ephemeral normalized import: all table definitions
first, followed by parent-to-child data, while preserving each SQL statement and
leaving the immutable source artifact untouched. It also preserves sanitized
provider diagnostics, treats Wrangler file-import exit status rather than query
JSON as the apply contract, verifies counts with bounded statements, supports a
confirmation-gated verification-only recovery, and re-verifies exact parity
before cleanup. Every failed attempt rolled back to zero tables and was deleted
by exact name before a fresh target was created; no failed target was reused.

The staging export is also preserved in the manifest-owned private R2 archive:

```text
bucket=rem-viet-backups (APAC; not managed by the Alchemy app stack)
private access=PASS (managed r2.dev disabled; enabled custom domains=0)
lock=d1/ age retention 365 days
artifact=r2://rem-viet-backups/d1/staging/20260814T103726Z-26160e6752c95223b2e29082760fd2f0c5f2ae2bea30860fad60ab0d628da911.sql
sha256=26160e6752c95223b2e29082760fd2f0c5f2ae2bea30860fad60ab0d628da911
size=213469 bytes
download verification=PASS
immutable=true; protected until 2027-08-14T11:18:03.839Z
```

An idempotent live preparation audit returned `changed=false`, confirmed both
public-domain surfaces disabled and revalidated the covering lock. This closes
the durable/immutable staging-archive gap without claiming the separate
production pre-migration backup or remote D1 restore drill. The object cannot be
overwritten or deleted during the active lock window.

The composed periodic-backup command was also exercised against staging:

```text
command=bun run site:backup:scheduled (... --auth-source=alchemy --apply)
database=rem-viet-db-staging; bucket=rem-viet-backups; bucketChanged=false
artifact=r2://rem-viet-backups/d1/staging/20260814T113642Z-26160e6752c95223b2e29082760fd2f0c5f2ae2bea30860fad60ab0d628da911.sql
sha256=26160e6752c95223b2e29082760fd2f0c5f2ae2bea30860fad60ab0d628da911
size=213469 bytes; local restore=PASS; download verification=PASS
immutable=true; protected until 2027-08-14T11:38:03.970Z
```

The first orchestration smoke had already completed and locked its R2 upload
before the wrapper rejected the child CLI's absolute evidence path. That extra
valid object remains protected at
`d1/staging/20260814T113503Z-26160e6752c95223b2e29082760fd2f0c5f2ae2bea30860fad60ab0d628da911.sql`
until `2027-08-14T11:36:25.348Z`; it cannot be cleaned up early by design. The
CLI now emits a repository-relative path, the wrapper safely accepts either
legacy absolute or current relative form, and regression coverage locks the
contract. This proves the orchestration manually, not activation of the GitHub
weekly schedule.

A read-only inventory now reuses the Alchemy OAuth profile directly:

```text
bun run cloudflare:capacity:audit --required-slots=1
capacity                               9/10 used
remaining operation requirement        1 slot
slot deficit                           0
manifest-managed                      1 (rem-viet-db-staging)
unrecognized by this repository       8
zero-table unrecognized databases     3
legacy-named rem-viet databases       2 (18 tables each; not deletion-safe)
```

The original follow-up provider-reference audit inspected all 10 databases and
all 14 deployed Workers through the Alchemy OAuth provider. Three zero-table resources
are actively bound respectively to `tanstack-start-portfolio-web-dev`,
`vlxd-thanhnam-web-dev` and `vlxd-thanhnam-web-terasumi`; every non-empty database
is also actively Worker-bound. Only `deploy2cloudflare-database-terasumi`
(`b2452788…`) is unbound, and no checked-out source repository references its
name or ID. The permanent `cloudflare:d1-references:audit` command redacts IDs,
never reads or prints unrelated binding values and always returns
`deletionAuthorized=false`.

On 2026-08-15 the owner explicitly authorized permanent deletion of that exact
database. The fail-closed `cloudflare:d1:retire-empty-unbound` command revalidated
its unique name, exact confirmation, `0` tables and `0` Worker bindings in the
same operation, then deleted only `deploy2cloudflare-database-terasumi`
(`b2452788…`) at `2026-08-15T01:36:30.873Z`. The deletion is irreversible. The
immediate post-delete audits inspected 9 D1 databases and 14 Workers, confirmed
the resource absent, and reported 9/10 used with one free slot. All three
remaining zero-table databases are actively Worker-bound, so no further deletion
is authorized. The one returned slot is sufficient because restore cleanup
precedes the second-site deployment.

## Cloudflare staging readiness audit

Cloudflare staging was provisioned and verified on 2026-08-14.

```text
rem-viet deploy/preflight           PASS (explicit HTTPS origin)
worker=rem-viet-web-staging         LIVE
d1=rem-viet-db-staging              LIVE
r2=rem-viet-product-images-staging  LIVE
alchemy post-deploy plan            NOOP
public home/sitemap                 HTTP 200
health notification gate           HTTP 503 (missing email provider)
public RUM contract                 202/202/400/403
remote web_vitals insert/cleanup    PASS (synthetic row removed)
non-synthetic RUM samples           0 after rollout and same-day recheck

acme-demo verify/preflight          PASS (14 assets; private env ready)
first isolated deploy elapsed       ~55 seconds
worker=acme-demo-web-staging        LIVE
d1=acme-demo-db-staging             LIVE (26 tables; quick_check=ok)
r2=acme-demo-media-staging          LIVE
acme post-deploy plan               NOOP after provenance convergence
public home                         HTTP 200; Acme identity present
Owner publish/restore smoke         PASS (10.6 seconds; original restored)
Owner media lifecycle smoke         PASS (exact cleanup; zero fixtures)
health notification gate           HTTP 503 (missing email provider; D1 ok)
source provenance                   dirty (not release evidence)
```

Alchemy `2.0.0-beta.72` produced non-deterministic hashes for the unchanged
multi-file Vite memo tree on Windows, which made every plan falsely propose a
Worker update. The infra stack now reduces the complete non-secret deploy input
tree to one deterministic sentinel and disables redundant workspace auto-hash.
After the one-time transition, two consecutive plans reported all three
resources as `noop`. A negative-control probe changed only `web` to `update`;
removing it returned the plan to three `noop` resources, proving real source
changes are still detected. The 2026-08-14 RUM rollout updated D1 and Worker,
then a fresh post-deploy dry-run again reported database, bucket and Worker as
three `noop` resources.

The primary root manifest is now accepted by the same `site:build` and
`site:deploy` interface as generated client manifests. The deploy command maps
the primary site back to the root Alchemy seed path and remains side-effect-free
under `--dry-run`. The wrapper now also exposes provider-backed `--plan`, forwards
`--yes` only for an actual deploy and rejects ambiguous combinations of
`--dry-run`, `--plan` and `--preflight`. A secondary deploy must supply
`sites/<site>/.env`; Alchemy
does not fall back to the primary app environment and fails before provisioning
if required auth/origin bindings are absent. `--preflight` additionally executes
the real Alchemy 2 CLI and exits before provider/resource Effects run; this
guards against runner/import regressions that an application build cannot
detect.

Non-production preflight/deploy now fails closed unless the operator supplies an
origin-only HTTPS `--origin`. That origin becomes both `CORS_ORIGIN` and
`BETTER_AUTH_URL`; production is locked to the manifest `siteUrl`. Contract tests
cover missing/unsafe staging origins and production mismatch, preventing a green
preflight for a Worker whose login origin would be wrong.

The same-day staging creation also exercised partial-apply recovery. Alchemy
`2.0.0-beta.72` returned `D1 import poll missing bookmark`, but read-only provider
inventory and Alchemy state proved the manifest-owned D1 had already been
created and migrated. A fresh plan showed D1/R2 `noop` and only the Worker
`update`; a single noninteractive retry skipped seed, updated the Worker and
exited zero. The following plan returned all three resources to `noop`. No D1
was deleted, renamed or recreated. The public homepage remained HTTP 200;
`/api/health` intentionally remains 503 solely because the required email
notification provider is not configured.

The Worker now publishes a no-store, non-secret deployment identity from
Alchemy bindings: manifest site, stage, full Git SHA, deterministic deployment
input SHA-256 and source cleanliness. A staging rollout changed only the Worker;
D1/R2 stayed noop and the following plan returned all three resources to noop.
The live contract matches the expected site/stage and well-formed Git/hash
identity, while honestly reporting `dirty` for the current uncommitted checkout.
Schema-v3 release evidence, unified readiness and the standalone pilot verifier
all reject dirty or mismatched live provenance; production deploy also rejects a
dirty checkout before applying resources.

The subsequent media-reference regression rollout followed the same safe path:
the provider plan showed D1 and R2 `noop` with only the Worker update, seed was
skipped, deploy exited zero, and the post-deploy plan returned all three
resources to `noop`. Live homepage and sitemap checks returned HTTP 200; health
reported D1 `ok` and the expected HTTP 503 solely for the still-unconfigured
required email provider. The no-store deployment identity again matched
`rem-viet`/`staging` and truthfully remained `dirty`.

The fresh-state E2E and conflict-safe site-settings initialization hardening was
then released through the same guarded path. The pre-apply plan showed D1 and R2
`noop` with only the Worker and release-input provenance changing; seed was
skipped, deploy exited zero, and the post-apply plan returned all three resources
to `noop`. The live homepage and sitemap remained HTTP 200. Health continued to
report D1 `ok` and HTTP 503 only because the required email provider is absent.
The sanitized readiness command still exited nonzero for the real external
gates: D1 capacity, alert policy/receipt/recipient, 75 field samples per metric,
email runtime configuration, clean deployed provenance and schema-v3 release
evidence.

The redirect lifecycle hardening was subsequently released through the same
guarded path after the complete 160-check local quality gate and 27-check
fresh-state browser suite passed. The pre-apply plan again kept D1 and R2 at
`noop`, updated only the Worker/release input and skipped seed; the post-apply
plan converged all three resources to `noop`. Homepage and sitemap remained HTTP 200. Health reported D1 `ok` and HTTP 503 solely for the absent required email
provider, with zero failed or stale notification attempts. Deployment provenance
remained truthfully `dirty`, so this is staging evidence rather than release-tag
authorization.

The home-editor initialization/conflict hardening was then released after the
expanded quality gate passed 160 unit/contract checks and 29 fresh-state browser
scenarios. The provider plan kept D1 and R2 at `noop`, changed only the Worker
and release-input provenance, and skipped seed; the post-apply plan converged all
three resources to `noop`. Homepage and sitemap remained HTTP 200. Health
reported D1 `ok` and HTTP 503 only for the absent required email provider, with
zero failed or stale notification attempts. The live no-store identity matched
`rem-viet`/`staging` and truthfully reported the dirty implementation checkout,
so clean-release authorization remains open.

The complete Media Library UX and redirect-toggle reconciliation were released
through the same guarded path after another full 160-check quality gate and
29-scenario fresh-state browser pass. The pre-apply plan preserved D1 and R2 as
`noop`, apply skipped seed and changed only the Worker/release-input provenance,
and the post-apply plan converged all three resources to `noop`. Homepage and
sitemap remained HTTP 200. Health reported D1 `ok` and HTTP 503 solely for the
absent required email provider, with zero failed or stale notification attempts;
live provenance remained truthfully `dirty`.

The post-authoring and nested-route hardening was then released after the full
160-check quality gate and the expanded 30-pass/8-skip fresh-state browser
suite. The pre-apply plan again reported D1 and R2 `noop` with one Worker update;
apply explicitly left D1/R2 unchanged, skipped the idempotent seed action and
updated only the Worker/release-input provenance. The immediate follow-up plan
returned all three resources to `noop`. Live homepage, sitemap and blog list
returned HTTP 200, while unauthenticated post creation and private preview both
returned 307 to `/dang-nhap`. Health reported D1 `ok` and HTTP 503 solely for
the absent required email provider, with zero failed or stale notification
attempts. The refreshed live readiness audit remained nonzero for D1 capacity,
the missing Cloudflare alert recipient/policy/receipt, zero of 75 qualifying
CLS/LCP/INP samples, missing email runtime configuration, dirty deployment
provenance and absent schema-v3 release evidence.

The post autosave, visible save-state and stale-tab recovery pass was deployed
through the same guarded path after a fresh root `bun run quality` receipt: all
160 unit/contract checks passed, every workspace typecheck and production build
passed, performance budgets passed, and Playwright finished 30 pass/8 intentional
mobile skips. The provider plan proposed one Worker/release-input update with D1
and R2 `noop`; apply skipped seed; the immediate follow-up plan returned all
three resources to `noop`. Live homepage, sitemap and blog list returned HTTP
200, and unauthenticated post-list/edit routes returned 307 to `/dang-nhap`.
Health remained intentionally 503 solely for the missing required email
provider: D1 was `ok`, with zero failed and zero stale notification attempts.
Deployment provenance remains truthfully `dirty`, so this is technical staging
evidence rather than client-ready release authorization.

The internal-navigation flush pass was then deployed after the same full root
quality gate. Homepage and post editors now share a TanStack Router blocker that
awaits a successful dirty-draft save before allowing navigation; invalid or
conflicting drafts stay on the editor, and browser shutdown retains a native
unload warning. Fresh-state production-Worker E2E edits each document and clicks
away before the 1.6-second debounce, then returns and proves the value persisted.
The guarded plan/apply again changed only the Worker/release input, skipped seed
and kept D1/R2 `noop`; the immediate post-plan was three-resource `noop`. Live
homepage, sitemap and blog list returned HTTP 200, protected home/post edit
routes returned 307 to `/dang-nhap`, and health reported D1 `ok`. The intentional
503 remained solely the missing required email provider, with zero failed and
zero stale notification attempts. Dirty provenance and every external release
gate remain explicit.

The dirty-preview race was closed in the next guarded pass. Both homepage and
post preview actions now synchronously reserve a popup, flush the latest draft
(including edits made while another save is settling), and only navigate that
tab to the authenticated preview after persistence succeeds. A failed
validation/conflict closes the temporary tab; automatic flushes do not emit a
manual-save success toast. Fresh-state E2E proves each preview contains a marker
typed immediately before clicking Preview, while all prior workflow assertions
remain green. Root quality again passed 160 unit/contracts and 30 browser
scenarios with 8 intentional mobile skips. Alchemy changed only the Worker and
release input, skipped seed, preserved D1/R2 as `noop`, and converged to a
three-resource `noop` post-plan. Live public routes returned 200; anonymous home
and post previews returned 307 to login. Health kept D1 `ok` and remained 503
solely for missing required email, with zero failed/stale attempts. This is M4
technical evidence, not client-ready authorization.

The authenticated editor keyboard gate was then closed with a real critical-path
mutation. Homepage save state is now a polite atomic live status and the save
button keeps the stable accessible name `Lưu draft` while autosave changes its
visible text. Fresh-state desktop Playwright reaches the hero field, save button
and private-preview link through Tab/Shift+Tab, edits with Ctrl+A plus typing,
activates save and preview with Enter, verifies the exact preview marker, then
restores and reloads the original value. The complete root quality gate passed
all 160 unit/contracts and 31 browser scenarios with 9 intentional mobile skips.
The guarded provider plan showed one Worker/release-input update with D1/R2
`noop`; apply skipped seed; the immediate post-plan returned all three resources
to `noop`. Homepage, sitemap and blog list returned 200, anonymous home preview
and post-list routes returned 307 to login, and health reported D1 `ok`. Its 503
remains solely the missing required email provider, with zero failed/stale
notification attempts and truthful dirty provenance. This closes the automated
M7 keyboard evidence without changing any external release gate.

The standards-based M7 accessibility gate was then closed with official
`@axe-core/playwright` coverage instead of relying only on Lighthouse and
handwritten semantic assertions. The scan applies WCAG 2.0 A/AA, WCAG 2.1 A/AA,
WCAG 2.2 AA and best-practice tags to the desktop/mobile homepage and contact
form, authenticated admin shell and independently loaded private preview, with
no disabled or allowlisted rules. Fixes covered contrast, landmark naming and
nesting, file-input names, keyboard access for the scrollable preview, redundant
logo text, reduced-motion visibility and preview/loading-region semantics. The
complete root quality gate passed all 160 unit/contracts and 31 browser scenarios
with 9 intentional mobile skips. The guarded 2026-08-15 provider plan proposed
only one Worker/release-input update while D1/R2 remained `noop`; apply skipped
seed and the post-plan converged all three resources to `noop`. The live public
axe suite passed 4/4 across desktop and mobile. Homepage, sitemap and blog list
returned 200, protected admin routes returned 307 to login, and health reported
D1 `ok`; its 503 remained solely missing required email with zero failed/stale
notification attempts. No external release gate changed.

The secret-boundary and closed-auth candidate was deployed through another
guarded Alchemy rollout on 2026-08-15. The provider plan changed only the
Worker/release-input hash; D1 and R2 stayed `noop`, seed skipped, and the
immediate post-plan returned every resource to `noop`. The live
closed-registration regression passed 2/2 across desktop and mobile, proving
the UI has no public sign-up/OAuth controls, sign-up remains rejected and those
credentials cannot sign in. Health reported D1 `ok`, zero failed/stale
notification attempts and 503 solely for the missing required email provider.
Live provenance remains deliberately truthful about the dirty source state.

The operational-alert write preflight then proved the deterministic policy was
ready to create, but the default Alchemy OAuth token correctly failed the live
write with Cloudflare 403 because it lacks Notifications Write; no policy was
created. A guarded `cloudflare:alerts:profile` workflow now prepares a separate
`alerts` profile with only account/user read and notification read/write. Its
apply was idempotent and did not touch any credential. The command now also
validates the corresponding OAuth credential shape and exact scope set without
printing the account ID or token. Exact-scope browser authorization subsequently
completed and the privacy-safe receipt is now `status=unchanged`,
`credentialsReady=true`. A live read-only preflight succeeded, but a second
guarded POST still returned Cloudflare 403 when the generic environment token was
selected; no policy was created. Read-only membership evidence also confirmed an
accepted Super Administrator role, so the remaining issue is token permission,
not account membership. The workflow now ignores the generic deploy token for
policy provisioning and requires a dedicated private
`CLOUDFLARE_ALERT_API_TOKEN` scoped to this account with Notifications Read plus
Edit/Write. Release readiness now accepts `--profile=default` for D1/Workers and
`--alerts-profile=alerts` only for Notifications; a live aggregate rerun completed
without credential broadening and reported `operational-alert-write-auth` as the
precise gate. After the dedicated token was supplied, the guarded apply created
exactly one `rem-viet-staging-operational-failures` policy. An independent live
dry-run then converged to `action=noop` with zero create/update/delete operations,
and aggregate readiness now reports the policy configured with write auth ready.
The Workers Observability threshold and real inbox dispatch receipt remain open
external gates.

On 2026-08-16 the versioned global-content port gained a second concrete storage
model. The experimental Sanity package now stores one explicit `agencyGlobal`
document plus immutable `agencyGlobalRevision` documents in a single mutation,
uses deterministic SHA-256 document IDs for arbitrary portable keys, maps native
`_rev` conflicts, preserves stable array IDs, and passes the exact same neutral
create/update/conflict/history/restore conformance as the D1 provider. Hosted
receipt schema v2 first added that neutral scenario after the disposable page and
Content Source Map lifecycle, exposes every global check independently, and
withholds a receipt unless the current global document plus all three proof
revisions are deleted. Focused Sanity tests pass 15/15, the repository unit suite
passes, all 17 monorepo typecheck tasks pass, boundary tests protect the optional
package and hosted gate, and the full formatting check passes. This is local
structural and verifier evidence only: no real Sanity dataset or Presentation
Tool receipt is claimed.

The same 2026-08-16 follow-up closes the prior configuration-only Presentation
gap without changing that external claim. `apps/studio` now builds as a real
Sanity 6 Studio with bounded Hero + FAQ schemas, code-owned document routing,
and a root input wrapper that atomically increments the neutral version while
recording the signed-in Studio actor. Hero and SEO media fields now expose
Sanity's native asset picker with crop/hotspot controls while preserving the
portable URL fallback for provider-created and migrated documents. A code-owned
GROQ selection plus the official image URL builder applies crop/hotspot and
materializes native asset URLs/IDs into the existing neutral image contract
without adding Sanity types to core or template packages. The template encoder supplies stable
array `_key` and schema `_type` metadata for provider-created content. TanStack
Start now exposes a fail-closed preview-secret handshake, a separately
HMAC-signed HttpOnly/CHIPS perspective session, stacked release perspectives,
server-only stega queries, Studio-origin framing, no-store/noindex preview
responses, overlays/navigation sync, and an authenticated refetch endpoint that
updates the React canvas in place on Studio mutations. Focused Studio, template,
web security, type, and boundary tests pass, and both Studio and web production
build paths are executable. No hosted dataset, browser-visible Presentation, or
hosted receipt is inferred from those local results.

The final 2026-08-16 local follow-up makes the missing Presentation evidence
mechanical without changing its external status. A versioned receipt contract
now requires eleven exact browser checks plus clean preflight, source-document
cleanup and preview-secret cleanup. The guarded `cms:sanity:presentation` CLI
requires a clean full Git SHA, a completely parsed and scope-matched hosted
hosted receipt, an exact confirmation, a Git-ignored authenticated browser
state, distinct HTTPS Studio/preview origins, and a fresh proof id. Its desktop
Chrome scenario creates disposable Hero + FAQ published/draft variants, proves
the preview handshake, secure partitioned iframe cookies, a real Sanity stega
overlay, click-to-edit field focus, mutation refresh without navigation,
published/draft perspectives and responsive controls, then cleans documents
and newly created preview secrets. Only then may it write an exclusive receipt
with hosted-receipt, Playwright-report and screenshot hashes; failures redact
browser output and remove partial evidence. The login capture and dry-run path
are executable locally. No hosted/browser receipt is claimed until the guarded
apply command passes against the named external staging project.

The evidence chain was subsequently tightened before any external Sanity
receipt existed. Hosted receipt schema v3 now refuses a dirty apply and embeds
the full source Git commit. The Presentation receipt carries that hosted source
commit in addition to the hosted file hash. A separate network-free
`cms:sanity:promotion` gate parses both committed receipts, rehashes the hosted
receipt, Presentation receipt, Playwright report and screenshot, requires the
hosted proof commit to be a strict ancestor of the Presentation proof commit
and that commit to be a strict ancestor of the clean evidence commit, and
rejects every change outside `docs/releases/evidence/` across both intervals.
It also verifies that the hosted blob existed at the Presentation commit while
the later browser receipt/artifacts did not. `.gitattributes` preserves exact
evidence bytes across platforms. The resulting promotion-readiness receipt is
still external until both hosted runs occur; no package status is changed by
the verifier.

The same audit then found that `webhooks: true` was ahead of its implementation.
That gap is now closed locally rather than hidden by downgrading the checklist:
`@agency/cms-provider-sanity/webhook` verifies the untouched body with Sanity's
official Web Crypto toolkit, rejects stale/scope-mismatched/draft/version
deliveries, enforces the exported delete-safe agency-page projection, and
requires both a durable delivery store and non-empty revalidation. The TanStack
endpoint persists `idempotency-key` leases and completion in D1, releases failed
work for retry, purges deterministic Cloudflare keys, and the scheduler expires
completed receipts after 30 days. Unit/boundary/type/build evidence is local;
an actual hosted webhook attempt and cache-observation receipt remains external.
The provider default was corrected to `webhooks: false`; deployments opt into
`true` only when the receiver is actually configured.

The remaining Track B audit found no unified stable-product gate even though
the master plan requires registry distribution, independent deployment,
production-like restore, coordinated upgrade, two paid sites receiving one core
fix, and a commercial support boundary together. A new strict schema plus
`cms:kit:v1:verify` now binds two complete restricted-registry publication
receipts, at least two unique paid-client adoption receipts, opaque off-repo
commercial/repository fingerprints, exact versions and core-fix ID, provider/
restore/admin/handover checks, client approvals, changelog digest, Git ancestry,
and evidence-only changes after the target source commit. Templates are
intentionally invalid. This creates the missing proof mechanism; it does not
invent the external registry writes, paid engagements, upgrades, or approvals.

The verifier graph is exercised by the declared repository suite rather than a
parallel test-only implementation. It checks publication-reference digests,
publication chronology, distinct site/repository/origin/paid-engagement/support
identities, both release digests on every adoption, the shared core-fix ID,
client/agency approval chronology and the release changelog. On 2026-08-16 the
declared tests, 18 typecheck tasks, 11 CMS migrations on empty and upgraded
fixtures, migration parity, formatting, dependency and client-secret audits,
packed consumer, coordinated upgrade/rollback, performance budget, secure web
build and fixture-scoped Studio build all passed. These are local technical
checks only; no hosted or commercial event is inferred from them. An attempted
read-only inspection of the user-opened local admin page could not proceed
because the in-app browser rejected the localhost target, so no browser receipt
was recorded from that attempt.

The subsequent research-baseline audit found one local productization claim was
too generous: `@agency/cms-cli` had callable functions but no installable
command, while the master plan requires init/add-block/migrate/verify from an
independent repository. The package now publishes the `agency-cms` binary and a
small command API. It consumes strict versioned init plans and verification
specs, rejects unknown arguments and repository-escaping paths, preserves
intentional client customization, refuses divergent files and existing
receipts, and loads a project-owned provider migration driver without importing
an app. Apply and rollback require the plan's exact confirmations; provider
failure writes the validated recovery point to the named path while success
writes an exclusive receipt. The packed clean-consumer gate now installs the
tarball and executes help, no-write init dry-run, init, add-block, verification,
migration and receipt-bound rollback before its typecheck/build/provider smoke.
This closes a real distribution/UX gap; it is not a private-registry or paid-site
receipt.

A follow-up completion audit then invalidated one narrower claim inside that
CLI: the first `add-block` implementation emitted only a data schema, renderer,
editor and prose reminder, while the master-plan gate explicitly requires a
versioned contract, seed and migration path as one extension slice. The command
now emits ten non-destructive template-owned artifacts: a literal-version block
envelope, defaults, contiguous migration entry point, fresh-ID seed factory,
renderer, editor, typed registry definitions, public barrel, machine-readable
manifest and explicit registration/upgrade checklist. The packed independent
consumer places those files under its compiled source tree, verifies them with
the installed binary, typechecks and builds them, then executes schema parsing,
v1 migration, seed creation and neutral-registry SSR. Re-running is idempotent;
divergent generated code still fails closed. This is local extension evidence,
not proof that a paid client adopted the new block.

The clean-start audit also found that the binary's first init-plan schema only
required a file named `site.manifest.json`; a payload containing just an `id`
could pass, and no secret checklist was bound to the plan. Neutral core now owns
`cmsSiteManifestSchema`, covering the exact kit/template/provider/content-schema
versions, locale set, brand/features, HTTPS site origin and isolated resource
names. The additive schema-v2 bootstrap plan requires exactly one `json-exact`
manifest, binds the plan copy to the file copy and site ID, validates secret
names without accepting values, and reports which names are absent from the
runtime environment. The packed consumer applies that plan and uses the exact
persisted manifest to derive its Alchemy staging resources. Schema-v1 plans are
still readable for the repository-wrapper migration window; they are no longer
presented as proof of canonical bootstrap validation.

The research target also exposed a remaining clean-start discontinuity: a
schema-v2 plan was trustworthy once present, but a new repository still had to
write that plan by hand. The installed CLI now has a review-first `plan-init`
command. It imports only an explicitly selected installed package subpath or
safe `./` local module, requires a versioned `cmsTemplateInitializer`, binds its
ID and exact semver to the returned manifest, and rejects any mismatch in site,
name, origin, provider, preset, locale or requested features. Dry-run prints the
complete plan without writing; apply writes only that plan exclusively;
repeating identical input is `unchanged`, while drift is rejected. The Rèm Việt
template's new `./bootstrap` entrypoint produces the strict manifest, empty env
example, all-ten-block draft seed, handover checklist and generated logo/media
placeholders so the seed never depends on assets present only in the source
application. The packed consumer performs plan dry-run/create/repeat, init
dry-run/apply, seed/asset verification and manifest-driven Alchemy planning from
the installed tarballs. This proves local bootstrap continuity, not registry or
deployed staging provenance.

The user-facing quality review then confirmed a different kind of gap: the
visual editor already implements the bounded component-composition model from
the research baseline, but the operations surface still presented Web Vitals
as three undifferentiated CRUD cards. `/admin/performance` now opens with an
evidence-backed overall state, separates pass/fail/collecting semantics, shows
sample coverage and p75 budget positions per LCP/INP/CLS, explains each metric
in client language, retains path/device/window scoping, and exposes provenance
without fabricating historical trend data. Empty filters get an explicit
real-data state. The app typecheck and production build pass. Authenticated
desktop-Chrome and Pixel-class mobile E2E prove the command-center region,
overall/metric states, all three sample-confidence indicators, filter validation,
disabled invalid actions, zero horizontal overflow and an automated accessibility
scan. The proper local Cloudflare runtime and owner authentication were also
proven in the in-app browser, but control repeatedly timed out while attaching
to the hot-reloaded dashboard. The E2E result is local automated evidence, not a
claimed browser screenshot, human visual-approval receipt or production RUM
receipt.

The next release-confidence pass makes the same workspace useful at handover
time while preserving the evidence boundary. A new authenticated `audit.read`
query exposes only current deployment provenance and the existing operations
health result. The UI evaluates representative Web Vitals, clean/identified
deployment, notification health and database response as four separate runtime
gates, then lists operational-alert dispatch, scheduled backup and the
non-developer pilot as external receipts that cannot be inferred from that
score. It fails closed for query errors, under-sampled metrics, unknown or dirty
provenance and missing notification providers. A signed-in in-app Browser
inspection of the running development app showed the intended honest result:
`1/4`, with CLS `0/75`, LCP `1/75`, INP `2/75`, dirty source and missing email
configuration visible while database health passed. The focused 22-test API
authorization/contract file, web and API typechecks, and the authenticated
production-Worker operations scenario all pass; that E2E also retains the
automated accessibility and responsive-overflow checks. This is developer-led
local evidence and does not close any external release receipt.

The handover workflow now has an in-product execution surface instead of a
Markdown checklist alone. `/admin/handover` is discoverable only with
`audit.read`, reads the current server-issued deployment identity and blocks
unless stage is `staging`, source is `clean`, and both full Git/deploy-input
hashes are known. Its eight task timers survive navigation through per-user
session storage without leaking into a later browser/admin session, only one task
can be active, and completion additionally requires the global no-JSON/code
observation. Bounded tester/device/KPI/confusion/issue fields feed a
verifier-shaped observer JSON draft, but approval and final-record timestamps
remain blank by design. Five focused workspace tests plus the route-registry
tests pass. Authenticated production-Worker E2E proves the non-staging block,
disabled start, command-center navigation, accessibility and zero overflow; the
Editor browser scenario proves the audit-scoped destination stays hidden. The
signed-in local Browser showed `dev-terasumi`, dirty source and `0/8` with the
start action disabled. This reduces pilot execution risk but is not the missing
non-developer run or approval.

The delivery-boundary audit then found that the tag-triggered client-ready
workflow, like the scheduled-backup workflow, exists only in the current local
candidate and is absent from remote `main`. A new read-only
`release:github:audit` hashes the exact default-branch bytes and separately
requires GitHub Actions to register the workflow as active. Three focused tests
cover match, drift, missing registration and disabled state. Live execution
reports both the remote file and registration missing. This seventh live input
is now mandatory in `release:readiness`, so schema-valid evidence cannot mask a
missing/disabled tag gate. The completion audit row was downgraded from PROVEN
to PARTIAL until remote activation exists; no push or workflow mutation was
performed. The current high-severity dependency audit still passes.

The next shared-admin pass closes a navigation-quality gap that existed across
otherwise mature modules. A single permission-aware command center now opens
from the header, `Ctrl/Cmd+K`, or the previously inert Help action on every admin
route. It derives destinations from the canonical navigation registry, filters
both site feature flags and the active staff-role capabilities, supports
accent-insensitive search, current-route context, arrow/Enter operation, focus
management and an explicit no-result state, and fits desktop plus mobile
viewports. Authenticated desktop and Pixel-class mobile E2E open the launcher by
keyboard, search `hieu nang`, pass an automated accessibility scan and navigate
to the performance workspace without reload. A dedicated Editor-role scenario
proves the forbidden staff-management destination is absent from command search
as well as the sidebar. This is automated operator-UX evidence; it does not
stand in for the unassisted non-developer pilot.

The dashboard quality pass then restores editorial work as the first-class
orientation point. Its `Nội dung đang chuyển động` workspace computes total,
draft, scheduled and published counts from the existing page/post admin APIs,
shows recent real content changes, and links directly to the home canvas, new
post flow and media library. It adds no parallel analytics contract and renders
deterministic loading, provider-error and genuinely empty states. Authenticated
desktop-Chrome and Pixel-class mobile E2E verify the four metric labels, all
three authoring actions, responsive layout and an automated accessibility scan.
An authenticated in-app browser inspection then confirmed the live desktop
composition, five real seeded records and their edit destinations. This remains
developer-led local product evidence, not the unassisted pilot receipt.

The command center is now a content navigator rather than a route launcher
alone. On open it loads the existing page/post admin contracts only for roles
with `content.readDraft`, preserves the blog feature flag, exposes five recent
items before a query, and searches title/slug metadata accent-insensitively.
Content results carry draft/scheduled/published state and deep-link to the home,
post or standard-page editor; the standard-page `pageId` selection survives a
full reload. If content queries fail, the palette keeps allowed module routes
usable and reports the degraded state instead of collapsing. Authenticated
desktop and Pixel-class mobile E2E find the real seeded maintenance article and
its exact editor URL while retaining the accessibility pass. The Editor-role
scenario sees that allowed article but still receives no staff-management
result. The long-running local Alchemy process was restarted after isolated E2E
build artifacts left it at HTTP 500, and `/admin/dashboard` returned HTTP 200;
two subsequent in-app control attempts timed out, so this pass does not claim a
fresh visual screenshot.

The next standard-page quality pass closes the remaining preview-parity gap.
Existing standard pages now expose a responsive Desktop/Tablet/Mobile canvas
inside the editor, and every unsaved block change is sent through a same-origin,
schema-validated message into the same `CmsPageBlocks` renderer used by the
public route. A detached TanStack file route keeps the stable
`/admin/pages/:pageId/preview` URL outside the `pages.tsx` parent, requires the
existing preview-admin session, reads the saved draft through
`content.pages.byId`, and returns private/no-store plus noindex/nofollow/
noarchive response and document controls. The separate-tab action is explicitly
labelled as the saved draft so it cannot imply that unsaved editor state was
persisted. The focused authenticated desktop lifecycle proves the unsaved CTA
inside the iframe, the 390px mobile profile, draft/public isolation, response
headers, robots meta, anonymous redirect, an independent zero-violation
accessibility scan, publish/revision/slug-redirect/unpublish behavior and exact
cleanup. The scenario also removes interrupted `Standard provider <8-hex>`
fixtures before rerunning. Production web build, 18/18 typecheck tasks, 26/26
web unit tests, repository formatting and `git diff --check` pass. A fresh
authenticated in-app Browser inspection confirmed that cleanup left no fixture
pages and that the new-page state explains the save-first responsive canvas
without exposing a dead control; no content was created. These are local
technical receipts; no non-developer pilot, registry publication or paid-site
adoption is inferred.

The follow-up standard-page authoring pass closes the remaining local draft-
safety asymmetry with the homepage and post editors. The editor now consumes
the shared trailing autosave and flush primitives, keeps the current page open
after persistence, and visibly distinguishes dirty, saving, saved, conflict and
last-saved time. Internal page changes and the private separate-tab preview
flush first; publish, schedule, unschedule, restore and unpublish resolve their
command against the exact post-save version. Published slug changes deliberately
pause background persistence until the editor confirms whether to create the 301. Validation no longer marks a pristine rich-text editor dirty when its
mount-time normalization is semantically unchanged. The focused authenticated
desktop lifecycle passed in 1.2 minutes and now proves an edited CTA autosaves,
survives reload, remains isolated from public content, and produces a real
stale-version conflict from a second authenticated tab before the first tab
loads the latest server state. The Alchemy development worker was restarted
after its known stale hot-reload `undefined.update` state; health returned 200.
A fresh signed-in in-app Browser snapshot then confirmed the fixture-free page
list, honest save-first preview guidance and visible synchronized status without
creating content. This remains local technical evidence, not the outstanding
human pilot or hosted receipt.

The direct-authoring continuation closes the standard-page canvas parity gap.
The real rendered rich-text/product-grid/CTA blocks now emit the neutral visual
protocol's select, move, insert, duplicate and remove intents through a
same-origin, page-scoped envelope. Selection scrolls and focuses the mounted
inspector; the contextual toolbar supports mouse plus Enter/Space activation,
and the existing sidebar remains the accessible fallback. The independently
opened saved-draft route remains intentionally view-only. Legacy standard-page
blocks use deterministic IDs derived from their current position and type, so
this pass does not claim persistent stable IDs across reorder. The focused
authenticated desktop lifecycle passed in 1.9 minutes after its second-tab test
was anchored on the deep-linked page actually loading. It proves the canvas
receipt and bounded composition sequence, then continues through autosave
reload, optimistic-conflict recovery, private saved draft, public isolation,
publish/revision/slug redirect/unpublish, independent preview axe scan and exact
fixture cleanup. This is local product evidence only; registry publication,
clean independent staging, RUM, human pilot and paid-site receipts remain open.

The field-target follow-up moves ordinary pages from block-only selection to
truthful click-to-edit intent. The shared renderer annotates rich-text content as
`data.content` and the CTA heading/link as `data.title`/`data.href`; the parent
resolves those neutral paths to the exact mounted inspector container before
focusing its input. Product-grid stays block-level because category and limit
are not separately rendered surfaces. Authoring now passes the canonical block
into the one-block renderer, preventing legacy index-derived identity from
collapsing to index zero. The refreshed authenticated lifecycle passed in 1.3
minutes and asserts a mouse link → `#cta-href` path, an Enter title →
`#cta-title` path, exact protocol receipts, the composition sequence and all
existing autosave/security/workflow/accessibility checks. No external receipt is
inferred.

A signed-in in-app Browser fault audit then found that all three embedded
editors could display a green/live claim before the iframe had completed a
validated handshake; the running homepage canvas simultaneously exposed a
stale dynamic-module failure. Homepage, standard-page and post authoring now
share a fail-closed `connecting → connected | delayed` state machine. Green and
the direct-sync claim appear only after the child frame's ready message;
connecting/delayed states stay explicit and delayed canvases expose a bounded
reload action without discarding inspector data. The ordinary-page receiver now
also pins every accepted message to the current iframe's `contentWindow`, not
only the same origin and page ID. Unit tests cover load, timeout, handshake and
retry transitions. The signed-in Browser observed amber connecting state first
and green connected state only after the real handshake.

That fresh-runtime exercise also exposed a provider/application integration
defect: the neutral Cloudflare provider owned the editorial-review migration,
but the app's canonical Drizzle stream did not create `cms_review_events`.
Typed schema ownership and additive migration `0011_real_iron_lad.sql` now
create the constrained event table and its document/action indexes. The
migration verifier applies all 12 migrations to both an empty database and the
legacy-upgrade fixture and explicitly asserts the table and indexes. The
isolated production-Worker standard-page lifecycle then passed in 27.1 seconds,
including the secured canvas handshake, deterministic post-render field focus,
publish/revision/redirect/unpublish behavior and exact cleanup. These are local
fresh-deploy receipts; external staging, pilot, registry and commercial gates
remain open.

A follow-up signed-in Browser quality pass ranked the remaining authoring gaps
against the research baseline and found that the complete three-pane homepage
workspace left the live canvas at roughly 24% scale in ordinary desktop chrome.
The flagship editor now exposes a desktop-only focused workspace that preserves
the canvas and live inspector, hides the structure rail, locks body scroll, wraps
Tab focus, exits on Escape, restores the trigger and automatically exits below
1280px. Live Browser evidence measured a 1256×696 modal surface, with structure
hidden and scroll locked while active and both restored on exit. The focused axe
gate initially found duplicate unnamed parent/iframe `main` and notification
landmarks; route-aware labels now distinguish the admin shell, public document,
homepage/standard-page/post preview documents and their toaster regions. A
separate animated-FAQ regression revealed that click capture could observe a
different descendant after layout movement, so visual selection now commits on
primary `pointerdown`; detail-zero click capture retains keyboard activation.
The isolated production-Worker homepage workflow passed in 16.4 seconds with
the focused accessibility scan, exact FAQ question-path receipt and existing
save/review flow. No external receipt is inferred.

The following signed-in Browser comparison found that the otherwise complete
media lifecycle still exposed its intake as a raw browser file control. The
Media Library now provides a native-button drag/drop surface and a deduplicated
multi-file queue with thumbnails, aggregate size, shared preflight contract
validation, per-file progress, removal, retry and a compact completed-batch
state. Alt-text save now sits beside its field in list view, outside the
bottom-right notification collision zone. The reusable page field now presents
a selected/empty asset card and searchable side-panel picker by default, with
manual URLs contained in an advanced disclosure. It shares the upload transport,
progress and failure contract, accepts an in-context drop/upload, searches the
full library without Vietnamese diacritics and renders explicit loading, provider
error and empty states. A provider-neutral selection resolver carries reviewed
asset metadata into homepage and rich-text image fields: public images adopt the
trimmed library alt or clear stale text when metadata is missing, while decorative
images can explicitly preserve contextual text. The new axe gate initially
rejected a hidden input nested inside the interactive drop target; the corrected
sibling input structure passes without an exclusion. The fresh isolated
production-Worker lifecycle passed in 9.3 seconds and proves an actual drop,
client rejection of a non-image, independent library and picker accessibility,
simulated connection failure, retry/201 storage, filter and view controls,
adjacent alt update, advanced-URL concealment, invalid picker-upload preflight,
accent-insensitive search, exact picker selection, reviewed-alt propagation over
stale rich-image text, referenced delete protection, dependency cleanup and final
object deletion. Neutral unit coverage separately proves missing-alt clearing and
decorative preservation. External release and commercial gates remain unchanged.

The standard-page canvas now closes the remaining pointer-composition
asymmetry with the flagship editor. Its selected-block toolbar exposes a real
HTML drag handle; candidate blocks render before/after drop edges and the drop
is sent through the same page-scoped neutral move message already consumed by
the editor. Up/down controls remain available for keyboard and assistive input.
The focused isolated Cloudflare lifecycle passed in 29.5 seconds and proves an
actual rendered-canvas drag before continuing through autosave, reload,
two-tab conflict recovery, public/draft isolation, revision, unpublish and
cleanup. It also asserts that neither public output nor the separate saved-
draft preview exposes the drag handle. This improves local Storyblok/Sanity-
style composition parity; it does not manufacture the outstanding human or
hosted receipt.

Ordinary-page direct manipulation is now locally recoverable rather than only
autosaved. The editor stores standard block content and composition in the
shared 50-entry bounded command history, coalesces rapid changes to one block,
invalidates the redo branch after a new edit, clamps selection after structural
undo, and resets history whenever an authoritative page replaces the working
copy. The responsive-canvas chrome exposes undo/redo buttons and Ctrl/Meta
shortcuts remain available outside native text controls. A fresh isolated
Cloudflare lifecycle passed in 29.7 seconds: it undoes a real canvas drag,
redoes it by keyboard, undoes/redoes the CTA value, confirms the final value in
live preview and after autosave/reload, then confirms both history controls are
reset before the existing two-tab conflict, immutable workflow and cleanup.
This closes a local recovery-contract gap; it is not a pilot usability receipt.

The standard-page visual protocol now has persisted identity parity with the
flagship registry. Flattened legacy blocks are upgraded to deterministic,
collision-safe IDs when installed; newly inserted and duplicated blocks receive
fresh bounded IDs, and the compatibility codec preserves those IDs through
draft storage and immutable revision snapshots instead of stripping them back
to position/type. Existing unique IDs survive unchanged and duplicate persisted
IDs fail safe by re-keying the later occurrence. Forty-four focused
core/template/API tests prove legacy upgrade, collision handling and a full
encode→parse round-trip. The refreshed isolated production-Worker lifecycle
passed in 25.6 seconds and asserts that the original CTA and its duplicate have
different IDs, then that the original exact ID survives rendered drag/reorder,
autosave and reload before the existing publish, revision, conflict, unpublish
and cleanup sequence. This removes the prior position-derived-identity caveat;
the non-developer and hosted release receipts remain external.

Focused visual authoring is now a platform behavior instead of a homepage-only
route detail. `@agency/cms-admin` owns the desktop breakpoint exit, background
scroll lock, Escape handling, focus containment and trigger restoration; the
homepage reuses that primitive, while standard pages and posts add their own
route-labelled dialog layouts. Both new workspaces devote the viewport to the
real renderer on the left and the mounted inspector/form on the right, preserving
the same working copy, autosave and visual-message channels rather than opening
a second editor. Focus buttons stay desktop-only and a live drop below 1280px
exits safely. Independent axe scans pass for both dialogs. The combined
production-Worker post/standard-page run passed both full mutation lifecycles in
52.1 seconds, including standard-page responsive exit; the extracted homepage
workflow passed again in 15.4 seconds. This closes the remaining authoring-space
asymmetry without claiming the external usability pilot.

Standard-page component discovery is now template-owned rather than duplicated
between the editor and canvas. The Rèm Việt template exports one frozen,
exhaustive catalog for rich text, product grid and CTA, with labels,
descriptions, categories and bilingual keywords. The parent add-block surface
and contextual canvas composer use the same accent-insensitive platform filter,
while the structure tree resolves labels from the same template contract.
Thirteen template-package tests pass. The refreshed isolated production-Worker
lifecycle passed in 29.4 seconds: it finds CTA with `keu goi`, proves unrelated
choices disappear, finds rich text with `van ban` inside the rendered-block
composer, passes an axe scan while that labelled dialog is open, inserts through
the neutral visual protocol, and completes the existing immutable lifecycle and
cleanup. A fresh signed-in Browser check showed all three descriptive cards and
reduced unaccented `keu goi` to CTA alone; the query was cleared and no content
was persisted. This is local discovery/accessibility evidence, not a hosted or
human pilot receipt.

Structured-body composition no longer falls back to seven duplicated toolbar
labels below the page-level catalog. The Rèm Việt template now exports one
frozen, exhaustive rich-text authoring catalog for paragraph, heading, list,
quote, image, video and code, with descriptions, categories and bilingual
keywords. The shared page/post editor exposes it through a compact searchable
disclosure, and post revision summaries consume the same labels. Direct adds
and preview composition also use the schema-owned 500-block ceiling. Fourteen
template tests pass. The production-Worker post lifecycle filters unaccented
`tieu de` to heading, hides paragraph, passes axe while the catalog is open and
then completes canvas editing, history, autosave, conflict, publish, revision,
redirect and cleanup in 24.6 seconds. Its first run exposed that the generic
content-focus selector now saw the search input before the first body field;
the repaired selector targets mounted block controls only, and the green rerun
proves exact click-to-edit. The shared standard-page lifecycle also passes in
29.7 seconds. No external release receipt is inferred.

Structured-body identity is now durable across both storage paths instead of
being reconstructed from array position. Every parsed rich-text block receives
a bounded ID; legacy missing/duplicate IDs are upgraded deterministically,
existing unique IDs survive, and direct add, canvas insert and duplication mint
collision-safe identities. Post input normalization and the nested standard-
page provider codec serialize the canonical document before persistence.
Preview selection and composition are bound to the exact rendered content
snapshot plus matching source/target block IDs and indices, rejecting stale or
mismatched pairs. Forty-two CMS tests, twenty-four API authorization tests and
seven focused web protocol tests pass. The refreshed production-Worker post
lifecycle passed in 24.9 seconds, proving four distinct rendered IDs and the
original heading ID through drag, autosave and reload before completing the
existing immutable lifecycle and cleanup. The independent standard-page flow
passed in 29.3 seconds and proves its nested rich-text ID survives provider
encoding, autosave and reload. This closes the local position-derived rich-text
gap; it does not replace any hosted, release or human receipt.

The post editor now reaches the same responsive working-copy baseline. Its
embedded canvas receives the current unsaved form snapshot over the secured
same-origin preview channel and offers 1440×900, 768×1024 and 390×844 profiles;
the separate-tab action still flushes and opens the independently loaded saved
draft. Exact rendered-field annotations and validated selection intents now
cover date, title, description, cover, tags and body, focusing the mounted
control through mouse or keyboard while the detached draft remains view-only.
Post body content and composition now share the neutral 50-entry bounded draft
history. Rapid edits to one rendered block coalesce, structural commands remain
discrete, a new edit clears the redo branch, selected indices clamp after
structural recovery, and every authoritative server install resets history.
The canvas exposes accessible undo/redo buttons and Ctrl/Meta shortcuts outside
native text controls. The 22.6-second focused lifecycle proves
title/description selection, hover identification, exact block focus, rendered
drag, insert/duplicate/remove, composition undo plus keyboard redo, rich-text
value undo/redo, history reset after autosave/reload, a pristine v1 draft
remaining v1 beyond the autosave window, the live unsaved marker and mobile width
before continuing through the complete post save, conflict, security, publish,
redirect, revision, restore and cleanup sequence. Each structural command is
bound to the exact serialized content snapshot and matching persistent
source/target block IDs plus indices, and is rejected if either the identity or
working copy has moved on; detached preview output remains view-only.

The post authoring contract now closes the previously unevidenced Google Docs
paste requirement. `@agency/cms-admin` exposes a reusable bounded plain-text
paste primitive that normalizes Unicode/line endings/NBSP, removes invisible and
control markers, preserves selection, truncates safely and rejects invalid
targets. Every post span intercepts the clipboard, accepts only `text/plain` and
discards the accompanying HTML/CSS/classes/scripts/Office metadata. Fourteen
package tests pass, and the refreshed 21.6-second authenticated lifecycle sends
a dual-format Google Docs-like payload, verifies its exact clean value, then
continues through persistence, preview, publish, redirect, revision restore and
deterministic cleanup.

The scheduled-backup activation boundary is now mechanically auditable rather
than a manual GitHub checklist. `site:backup:github:audit` reads only the current
repository metadata, suppresses every variable value and all secret material,
requires the remote default-branch workflow to match the local contract, and
downloads only retained JSON evidence from the latest manual and scheduled
runs. It validates exact run ID/attempt filenames, isolated restore evidence,
export/archive site-stage-database/hash/size parity, manifest-owned R2 locator,
365-day immutable protection, distinct objects and manual→weekly ordering.
Three focused tests cover redaction/configuration, retention and sequence.

The first live read-only run against `TongDucThanhNam/rem-viet` truthfully
returned `NOT READY`: the workflow exists in the local commits but is absent
from remote default branch `main`; `CMS_BACKUP_SITE`, `CMS_BACKUP_STAGE`,
`CLOUDFLARE_ACCOUNT_ID` and `CMS_BACKUP_CLOUDFLARE_API_TOKEN` are all absent;
therefore no manual or scheduled run/evidence exists. Local `main` is two commits
ahead of `origin/main`, and the implementation worktree is dirty, so this audit
does not authorize a push, secret write or workflow dispatch.

The sanitized read-only release aggregate was rerun against flagship staging on
2026-08-17. It remains correctly nonzero: D1 is 10/10 with zero required-slot
deficit and three owner-review candidates; the deterministic operational alert
policy exists and write authentication is ready, but its private recipient and
real dispatch receipt are absent; field evidence is CLS 0/75, LCP 1/75 and INP
0/75; deployed provenance is dirty and does not match the implementation HEAD;
email runtime configuration and the schema-v3 release record are absent. The
signed-in local performance dashboard separately renders its current local
11-sample view, but that local database is not substituted for the remote
flagship release slice.

The scheduled-backup proof is now part of the unified release control plane
rather than an operator-only follow-up command. `release:readiness` runs the
read-only GitHub audit beside the five existing live audits whenever the exact
site/stage/origin scope is supplied, reduces its output to seven non-secret
booleans, and rejects internally impossible workflow/sequence states. Both
`livePrerequisitesReady` and `releaseReady` now require the current workflow,
repository configuration, manual receipt, next weekly receipt and valid
distinct-object sequence. The backup audit uses exit `2` for an expected release
gap, matching the aggregate audit contract; authentication/provider failures
remain hard errors. Twelve aggregate tests plus three backup tests cover the
ready, missing, redacted and inconsistent paths.

The first six-source live aggregate completed without weakening any gate. Its
new scheduled-backup summary is entirely boolean and reports workflow on default
branch `false`, contract match `false`, configuration `false`, manual receipt
`false`, weekly receipt `false` and sequence `false`. The existing live results
remain unchanged: zero D1 slot deficit, alert receipt/recipient absent, remote
field samples `0/1/0`, dirty mismatched staging provenance, missing email runtime
and no schema-v3 release record. The command exits nonzero for those explicit
release gaps, not because the GitHub child audit uses its documented gap exit.

The 2026-08-17 release-boundary re-audit confirms that distinction. At
`2026-08-17T00:08:36Z`, remote default branch `main` remained at
`8af868cec3f805411376939c8bf3685864428020` without either release workflow;
the scheduled-backup repository settings and manual/weekly receipts were also
absent. The local worktree is based on
`4cc3cbd8246fba098a9e78baa0dd4f6e4129072e`, two commits ahead, and contains
both contracts plus uncommitted candidate changes. The exact root
`bun run quality` subsequently passed end to end
after correcting the dark-theme dashboard contrast and stale/ambiguous
authenticated E2E selectors surfaced by its first run. This is local candidate
evidence only; no commit, push, repository setting, dispatch or receipt was
created.

Explicit publication authorization then advanced remote `main` to
`41fbd7eb4493342eef3b8946d255f9845e043b03`. A pre-push object audit stopped
the first transfer before remote mutation when the older unpublished range was
found to contain a 203 MB installer and generated Alchemy/Miniflare databases.
The exact original state remains recoverable on local branch
`codex/pre-publication-cms-c8f9224`; the published fast-forward excludes and
ignores those artifacts. The final read-only workflow audit at
`2026-08-17T02:06:10Z` proves the client-ready contract exact, registered and
active. The backup workflow is exact on default branch, while its four settings
and manual/weekly receipts remain absent. GitHub's 22 dependency alerts all
mapped to an unused source-less legacy manifest; deleting it reduced the open
alert count to zero, with frozen install unchanged and high-severity/client
secret audits still green.

The performance command center now adds real diagnostic context: an equal prior
period, route discovery, device coverage, sample runway and metric-specific next
checks. No chart or trend is synthesized when history is absent. A signed-in
in-app Browser run selected the `/` route and observed the metrics refetch. The
same run exposed an evidence-boundary bug: the prior 11-report total included
admin paths even though the UI promised public traffic. Shared validation,
client collection, ingestion, both admin aggregate/facet queries and the remote
release-audit SQL now consistently exclude admin, API, sign-in and preview
routes; explicit synthetic probes remain accepted for endpoint smoke but cannot
enter release evidence. The refreshed local view contains three public reports
and zero admin route chips. Focused contract/API/infra tests (19 pass), full
typecheck and the production-Worker admin-shell E2E pass.

A signed-in Browser comparison of the homepage studio exposed two canvas
orientation defects that protocol-only checks had not made visible: selecting
the fixed footer could leave the preview at Hero, and selecting an already
active section did not produce new observable state. The preview now scrolls a
non-visual footer sentinel at the true document end, uses reduced-motion-aware
alignment, and consumes a validated, bounded `selectionRevision` so each
explicit selection retriggers navigation. A guarded one-shot settled-focus
retry preserves exact canvas-to-inspector focus if animated reconciliation
briefly returns focus to the body or iframe, without overriding a user's move to
another field. Twenty `cms-admin` tests pass with 85 expectations. The strict
production-Worker homepage lifecycle passed in 16.4 seconds, asserting footer
selection at the exact bottom, Hero at the exact top, same-selection retrigger,
exact FAQ control focus and the complete mutation/review/cleanup sequence. The
live signed-in Browser independently measured `scrollY=16442` and
`fromBottom=0` after selecting `10. CTA cuối trang`. This is local product
evidence, not an external promotion receipt.

The next signed-in Browser pass showed that the homepage's nominal focus mode
still rendered the live site as a roughly 200px-tall strip at 36% scale because
status and revision cards occupied most of the canvas column. Focused authoring
now dedicates that column to the preview and inspector; the supporting cards are
layout-hidden only while focused and reappear on exit, leaving the normal
workflow, history and underlying draft state intact. Browser measurement rose
to an 814×670 preview shell, an 813×580 canvas and 53% desktop-page scale. The
strict production-Worker homepage lifecycle passed again in 16.4 seconds and
now enforces a 640px shell and 520px canvas floor at the standard desktop
viewport, both hidden-panel and restored-panel states, the existing focused axe
scan, Escape/trigger restoration, and the full mutation/review/cleanup flow.
This closes a local canvas-first presentation gap without manufacturing the
non-developer pilot.

The standard-page create flow now closes the remaining zero-save canvas gap.
Previously its Desktop/Tablet/Mobile renderer appeared only after the first
save, even though posts and existing standard pages already worked against the
current in-memory document. A reserved create-mode page ID now opens the same
authenticated private/no-store/noindex preview route with its server query
disabled; the parent streams the single working copy over the existing
validated visual protocol, and the standalone saved-draft link stays hidden
because a separate tab cannot receive that memory-only state. First publish
hands the iframe the persisted page ID without replacing the editor or renderer.
The focused production-Worker lifecycle passed in 33.0 seconds and proves the
reserved URL, private draft badge, unsaved rendering, exact CTA-title focus,
absence from an independent signed-in page list before persistence, real-ID
handoff and the complete existing lifecycle. A signed-in Browser sample then
measured a 776×485 canvas at 54% scale with its CTA inspector alongside it; the
list remained empty and no persistence action was invoked. This is local
product evidence, not a pilot, hosted-provider or promotion receipt.

The same Browser pass uncovered a recovery-trust defect behind that new create
canvas. Standard-page history was block-only, while title, slug and SEO/media/
robots edits merely flipped an event-based dirty flag; even manually restoring
the visible defaults could leave navigation blocked. The route now treats the
complete working document as one bounded, coalesced and branch-safe history
against the exact installed or persisted baseline. Undo/redo is chronological
across metadata and blocks, exact baseline equality restores the clean/saved
status, and save completion advances the baseline only to the generation sent
to the provider so concurrent local edits remain dirty. The focused
production-Worker lifecycle passed in 32.0 seconds through metadata undo/redo,
clean-baseline navigation, zero persistence and the full existing lifecycle. A
signed-in Browser check changed page title then SEO title, undid them in exact
reverse order, observed synchronized state with undo disabled/redo available,
navigated immediately to Posts and found no temporary page row on return. This
is local product evidence, not an external receipt.

The cross-editor continuation found posts still used content-only recovery:
rich text entered the history, while title, slug, description, cover, tags,
publish date and SEO/social/robots fields only marked the route dirty. The post
editor now stores the complete normalized form in one bounded, branch-safe
history, with semantic field groups coalescing rapid input and an exact
installed/saved baseline. History navigation restores the full form snapshot
and rich-text selection bounds; a successful save advances the baseline only
to the submitted generation. The focused production-Worker post lifecycle
passed in 26.0 seconds, adding title/SEO chronology and clean restoration to
its established canvas composition, autosave, conflict, publish, revision,
redirect and cleanup gates. A signed-in Browser check independently undid SEO
then title, returned to synchronized v2 with undo disabled and redo available,
navigated to the post list without a save and reopened the unchanged originals.
This is local product evidence, not an external receipt.

The recovery audit then reached the mandatory global-content editor. Site
information, socials, compatibility flags and both navigation locations had
immutable server revisions but only isolated submit-local state: no
chronological recovery, exact dirty baseline or internal-navigation flush. They
now form one bounded, coalesced and branch-safe working document. Undo/redo
crosses the settings and navigation forms in edit order; exact baseline return
clears the guard, while internal navigation saves only dirty regions. Header
and footer writes advance independently, so partial failure stays visible and
retryable instead of being reported as an atomic save. The focused
production-Worker lifecycle passed in 8.5 seconds with cross-form undo/redo,
clean restoration, save-before-navigation, revision restore, public navigation
propagation, exact cleanup and a zero-violation accessibility scan. That scan
also caught and fixed the prior h1→h3 outline jump. A signed-in Browser check
independently changed address then header label, undid them in reverse order,
returned to synchronized state, navigated away and reopened unchanged values.
This is local product evidence, not an external receipt.

The same screen now closes its remaining visual-authoring gap. A responsive,
sticky canvas mounts the production Header and Footer in a capability-protected,
private/no-store/no-index preview route and receives the complete unsaved global
working copy. The typed protocol validates nested menus, checks both origin and
window source, retries its handshake to survive fast iframe hydration, and
prevents preview data from being replaced by background server reads. Desktop
and mobile modes render at 1280×820 and 390×844 without persistence. Two focused
protocol tests pass; the extended production-Worker lifecycle passed in 12.1
seconds with connection, viewport switching, unsaved phone/menu propagation,
undo-restored rendering, accessibility, immutable restore, public propagation
and exact cleanup. A signed-in Browser check independently rendered an unsaved
header-label edit through the production Header and then returned both field and
canvas to the synchronized baseline with global Undo. No Browser save occurred.
This is local product evidence, not an external receipt.

The requirement-by-requirement acceptance matrix is maintained in
`docs/cms/v1-completion-audit.md`.

## 2026-08-17 clean flagship staging activation

The published candidate at
`f71d096b65b67bf09ee587ed4abadf72f6ae1f7f` passed the exact root
`bun run quality` gate, including secure build, package/consumer/upgrade and
rollback suites, performance budgets, isolated desktop/mobile production-Worker
journeys, and the `acme-demo` second-site proof. Local and remote `main` matched
that SHA with a clean checkout.

The staging deployment followed the guarded sequence: manifest dry-run, real
preflight, provider-backed plan, pre-migration export, apply, and post-apply
plan. The live D1 ledger contained migrations `0000` through `0008`; the plan's
database update was confirmed to be the three additive `0009`–`0011` tables and
indexes. The pre-migration export
`rem-viet-staging-20260817T030216Z.sql` was 214,547 bytes with SHA-256
`e74cf35bc03fd9fb6417740b1784fa90fff2bc475a5670c00f56f77dfd3f57ca`.
Its isolated restore passed `integrity_check=ok`, found 26 tables, and matched
the recorded page, revision, post, media, lead, and Web Vitals counts.

Alchemy then updated D1 and the Worker while leaving R2 unchanged. The next
provider-backed plan reported exactly three `noop` resources. Live health
reports site `rem-viet`, stage `staging`, clean source commit
`f71d096b65b67bf09ee587ed4abadf72f6ae1f7f`, and deploy-input SHA-256
`96dd0b92bfc1c4ccfc6788a7c2da5c68c0fc868c1db9de7fc0c90e740f2ce47c`.
D1 now records all 12 migrations. Public home, sitemap, and web manifest return
HTTP 200; database health is `ok`. Overall health remains intentionally HTTP 503
only because required email delivery is not configured.

The GitHub scheduled-backup workflow remains byte-exact on default branch.
`CMS_BACKUP_SITE=rem-viet`, `CMS_BACKUP_STAGE=production`, and the account ID
variable are now configured and audit as shape-valid. The existing deployment
token was not reused because its Worker/D1/R2 deployment authority is broader
than a dedicated backup token. `CMS_BACKUP_CLOUDFLARE_API_TOKEN`, the first
manual receipt, and the following weekly receipt remain open. A production
export was attempted fail-closed and confirmed that no
`rem-viet-db-production` resource exists yet; no resource was created or
modified.

## External release gates — required before v1.0 tag

These cannot be truthfully completed in the local repository alone:

1. Configure and verify real notification/error-alert delivery on flagship
   staging. Deploy the current health contract, then use
   `site:notification:smoke` dry-run/apply/recipient-confirmed verify;
   configure the private alert recipient, authenticate the isolated `alerts`
   Alchemy profile, use `cloudflare:alerts:policy --profile=alerts` dry-run/apply,
   create the documented Workers Observability incident threshold,
   trigger a controlled failure, confirm the real email and run policy verify.
   `bun run cloudflare:alerts:audit` proves capability/correlated dispatch but
   correctly fails while no operational policy or receipt exists.
   Worker, D1, R2, cron and desktop/mobile smoke are already proven.
2. Reproduce the now-passing Acme deployment from the exact clean release
   checkout and retain matching provenance. The isolated restore, separate
   Worker/D1/R2, ~55-second provisioning, Owner login, publish/restore, media
   lifecycle and cleanup receipts are complete; only clean-commit identity is
   outstanding for this gate.
3. Collect representative real-user Core Web Vitals through the live staging
   collector; Lighthouse and synthetic endpoint evidence are recorded, but p75
   LCP <= 2.5 s, CLS <= 0.1 and INP <= 200 ms still require real traffic and at
   least 75 samples per metric in the selected release slice.
4. Have a non-developer complete `docs/pilot-handover-script.md` without
   developer intervention; record time, confusion points and open defects. The
   standalone `release:pilot:verify` contract now validates the exact live clean
   commit/site/stage/origin/deploy-input identity, every required task, per-step
   timing, KPI limits and the tester's post-run approval before emitting the
   fragment consumed by the final release evidence. No human result has been
   recorded yet.
5. Configure the scheduled-backup repository variables and dedicated secret,
   retain a green manual-dispatch receipt and confirm the next weekly run. Also
   create and immutable-archive the production export immediately before its
   migration; periodic/staging objects prove the mechanism but not production
   timing. Rotate production secrets. The dependency review is complete with no
   open P0/P1 finding; see `docs/dependency-security-audit.md`. Re-run it
   immediately before tagging `v1.0.0-client-ready`.

The release record template is
`docs/releases/v1.0.0-client-ready.template.json`. Until all five gates are
recorded in its completed counterpart and `bun run release:verify` passes on the
exact clean commit, the correct product label is **technical release candidate**,
not “client ready”.
