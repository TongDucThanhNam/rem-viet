# V1 completion audit — 2026-08-18

Source of truth: `docs/agency-cms-master-plan.md`.

This audit maps the plan's KPIs, Definition of Done and release gates to current
evidence. A green local build is not used as evidence for an external or human
acceptance criterion.

## Verdict

Current label: **technical release candidate**.

- Repository-local implementation and automated critical paths are complete.
  The 2026-08-17 flagship deployment remains valid historical evidence, but it
  is not evidence for the newer 14-migration candidate now in the repository.
- Real notification delivery, real-user p75 vitals, a non-developer pilot and
  clean independent-site release provenance remain external gates. Flagship
  staging exposes the exact clean historical commit and deploy-input hash;
  the isolated remote restore and isolated Acme staging runtime are proven and
  cleaned up, but the Acme receipt predates the clean release checkout.
- No `v1.0.0-client-ready` tag is permitted until every row marked **EXTERNAL**
  below has recorded evidence. `bun run release:verify` validates that evidence
  against the exact release commit, and tag-triggered CI reruns root quality plus
  the verifier.

Status legend:

- **PROVEN** — authoritative automated or artifact evidence exists.
- **PARTIAL** — implementation exists, but the plan requires broader evidence.
- **EXTERNAL** — cannot be truthfully established from the local repository.

## 2026-08-18 Track A re-audit

This snapshot supersedes older "current" wording elsewhere in this historical
audit. It does not invalidate the receipts that were true for their recorded
commits.

| Gate                   | Local/authorized status                                                                                                                                                                                       | Remaining exact gate                                                                                                                                                                                                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M3 — human editor      | **PROVEN locally.** Root quality covers the editor workflows, recovery, accessibility and responsive contracts. The bounded 30-minute script and handover checklist are executable.                           | **EXTERNAL:** one non-developer must complete all eight tasks without developer intervention and approve a pilot record bound to the deployed commit, site, stage, origin and deploy-input hash.                                                                                                                                |
| M4 — preview/publish   | **PROVEN locally; historical staging proof retained.** Preview remains private/no-store, public reads remain immutable published revisions, and publish/schedule/restore/conflict paths pass automated tests. | **EXTERNAL for this candidate:** apply the current staging plan only after a staging backup and restore drill, then rerun authenticated staging smoke against the exact clean deployed commit.                                                                                                                                  |
| M5 — client operations | **PROVEN locally.** Backup/restore, notification idempotency, incident sources, alert policy verification and release aggregation are executable and fail closed.                                             | **EXTERNAL:** deploy the three Resend settings and retain an exactly-once inbox receipt; configure the alert recipient and dashboard threshold, trigger a controlled failure and retain correlated dispatch/inbox receipts; configure the four GitHub backup settings and retain distinct manual and following-weekly receipts. |
| M6 — white-label       | **PROVEN locally.** Manifest isolation, the packed clean consumer and provider contracts pass; no new package baseline was rebuilt.                                                                           | **EXTERNAL:** deploy and smoke Acme from the exact clean release checkout with its own password-manager-injected credential and retain the timed provenance/cleanup receipt.                                                                                                                                                    |
| M7 — hardening/pilot   | **PROVEN locally.** Root quality, security, migration, accessibility, production build, browser critical paths, packed consumer and upgrade/rollback rehearsals pass.                                         | **EXTERNAL:** deploy the current candidate, collect at least 75 eligible samples for each of LCP/CLS/INP within budget, complete the human pilot, and assemble the final schema-v3 record.                                                                                                                                      |

The current local migration verifier reports 14 files and passes both the empty
database and upgraded-fixture paths. `cms:kit:consumer` passes packed install,
typecheck, build and provider smoke. `cms:kit:upgrade` passes baseline install,
upgrade and receipt-bound rollback while preserving content, revisions, media
and objects. `release:verify` and `release:pilot:verify` reject absent evidence;
focused tests also prove rejection of records bound to another commit or a dirty
checkout.

Safe provider-backed inspection was run without applying anything:

- `site:deploy --dry-run` and `--preflight` pass for Rèm Việt staging;
- `site:deploy --plan` reports D1 update, Worker update and R2 `noop`;
- live staging provenance is clean but identifies the older deployed commit, so
  readiness correctly rejects it for the current checkout;
- `release:github:audit` passes for the exact active client-ready workflow;
- `site:backup:github:audit` fails closed because required repository
  configuration and both execution receipts are absent or mismatched;
- the live 28-day RUM counts remain CLS 0/75, LCP 1/75 and INP 0/75;
- the deterministic operational alert policy exists, but its recipient and
  correlated dispatch/inbox receipt are absent;
- deployed `RESEND_API_KEY`, `LEAD_NOTIFICATION_EMAIL` and `EMAIL_FROM` are
  absent; and
- the final schema-v3 release record remains intentionally absent.

Exact clean-checkout staging, backup/restore, smoke, evidence and rollback
instructions live in `docs/cms/track-a-staging-release-procedure.md`. No staging
apply, GitHub mutation, workflow dispatch, secret write, public package publish
or production action was performed by this audit.

## Historical live checkpoint — 2026-08-17

At `2026-08-17T03:06Z`, local `main`, remote `main`, and the exact successful
root quality gate all matched
`f71d096b65b67bf09ee587ed4abadf72f6ae1f7f`. Flagship staging was deployed from
that clean checkout and now reports matching site/stage/commit plus deploy-input
SHA-256 `96dd0b92bfc1c4ccfc6788a7c2da5c68c0fc868c1db9de7fc0c90e740f2ce47c`.
All 12 migrations are live and the provider-backed post-apply plan is three
`noop` resources. Before applying the three additive migrations, `site:backup`
exported staging, restored it in isolation, proved `integrity_check=ok`, 26
tables and exact critical-row counts, and recorded artifact SHA-256
`e74cf35bc03fd9fb6417740b1784fa90fff2bc475a5670c00f56f77dfd3f57ca`.

The client-ready GitHub workflow is byte-exact, registered and active. The
scheduled-backup workflow is byte-exact; `CMS_BACKUP_SITE`,
`CMS_BACKUP_STAGE`, and `CLOUDFLARE_ACCOUNT_ID` are now shape-valid and match
the expected scope. Its dedicated token and both run receipts remain absent.
The live readiness audit therefore no longer reports a staging-provenance or
workflow-registration gap. It remains fail-closed for notification/alert
configuration and receipts, representative RUM, scheduled-backup completion,
the final release record, independent-site clean provenance, and human pilot.

## Product KPI audit

| KPI                                      | Status   | Evidence required / current evidence                                                                                                                              |
| ---------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New site to staging <= 2 hours           | PARTIAL  | Real Acme Worker/D1/R2 provisioning completed in about 55 seconds and the live smoke passed. Repeat from the exact clean release checkout for final KPI evidence. |
| Brand + demo content <= 1 day            | EXTERNAL | Time an operator following the handover checklist. `acme-demo` build and verify pass locally.                                                                     |
| Client can edit >= 90% recurring content | EXTERNAL | Non-developer content inventory and pilot result. The ten flagship blocks have human forms.                                                                       |
| Editor training <= 30 minutes            | EXTERNAL | Timestamped handover pilot using `docs/pilot-handover-script.md`.                                                                                                 |
| Publish visible <= 10 seconds            | PROVEN   | Authenticated staging publish advanced the homepage from v8 to v9 and the optimized immutable public revision was confirmed in under 5 seconds.                   |
| Restore revision <= 5 minutes            | PARTIAL  | Browser restore workflow and local DB restore drill pass; pilot timing is required.                                                                               |
| Public draft leaks = 0                   | PROVEN   | Draft/public/publish/restore E2E and server capability tests. Public loaders resolve immutable published revisions only.                                          |
| Shared client DB/bucket = 0              | PROVEN   | Real Rem Viet and Acme staging deployments use separate manifest-owned Worker, D1 and R2 resources; Acme D1 has its own 26-table state and cleanup receipt.       |

## Definition of Done audit

| Requirement                                                              | Status   | Authoritative evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client edits the full flagship homepage without JSON/code                | PARTIAL  | `admin/home.tsx` and typed editors cover all ten blocks. Fresh-state browser proof covers structured add/duplicate/reorder/delete, block enable/reorder, autosave persistence across reload, save-before-immediate-navigation/preview and a genuine two-tab optimistic conflict with latest-server recovery. A non-developer pilot is still required.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Draft, preview, publish, schedule, revisions and restore work end-to-end | PROVEN   | Staging E2E covers draft isolation, private preview, publish/restore and scheduling; a real Cloudflare cron published a due page once with one revision/audit event. Fresh-state homepage/post E2E additionally proves dirty-preview flush with the exact just-edited marker, visible dirty/saving/saved/version state, debounced autosave persistence after reload, save-before-immediate-navigation, deterministic two-tab optimistic-conflict recovery, marked/link-rich content preservation, authenticated no-store/noindex draft previews, public draft isolation, publish, safe slug-change isolation/redirect choice, republish, revision restore without changing public content and exact cleanup. Standard-page E2E now also proves direct rendered-field selection, a real rendered-canvas drag reorder plus bounded insert/duplicate/remove composition through the neutral protocol, reversible composition and field values through canvas undo plus keyboard redo, history reset after authoritative reload, an unsaved working copy in the real renderer, responsive mobile canvas, private/no-store/noindex saved-draft response, anonymous redirect, public isolation, independent accessibility, trailing autosave persistence across reload, genuine second-tab optimistic-conflict recovery, immutable revision lifecycle, redirect, unpublish and interrupted-fixture cleanup. Public and saved-draft view-only renders expose neither click-to-edit nor drag controls.          |
| Human-readable revision review                                           | PROVEN   | Homepage, standard-page and post history is directly reachable from each editor header. Expanded revisions use labeled before/after cards. The neutral package exposes only summaries explicitly opted in by the app, normalizes and caps them at 160 code points, and otherwise withholds arbitrary structured values; media identifiers remain presence-only. Legacy page/post snapshots are schema-normalized so absent historical defaults do not create false diffs. Signed-in Browser review proved the shortcut and the seeded legacy-content comparison. Focused production-Worker lifecycles assert both old/new post slugs and standard-page CTA copy and retain the automated accessibility scans.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Version-bound editorial handoff                                          | PROVEN   | Home, standard-page and post editors share one review panel. Editor may save/request; Admin/Owner may approve or request changes; publish stays separately capability-gated. Request and decision now use exact `content.review.request` / `content.review.decide` procedures rather than borrowing write/publish authority, the shared admin model gates both actions independently, and the app consumes server-issued request/decision/publish claims instead of role-name inference. Immutable audit events bind every request/decision to an exact version, later edits make the request stale and leave the actionable queue, and a ranked query returns each latest current request without a fixed audit-scan horizon. The same semantics live behind neutral core schemas/capabilities, a runtime review port/derivation/conformance suite, an admin presentation model and Cloudflare migration/provider implementation. D1 conformance proves idempotency, stale rejection, re-request, required change notes and exact approved-version publication. The packed clean consumer installs all eight tarballs and executes that conformance plus the neutral published presentation. API tests assert the exact missing Editor decision capability. A signed-in Browser run proved request → queue → approval; focused production-Worker E2E passes both the disposable lifecycle and Editor request-without-decision/publish/restore boundary. This does not satisfy the non-developer pilot. |
| Owner/Admin/Editor enforced at server                                    | PROVEN   | Capability procedures, server-issued client claims, exact request/decision review authorization, API authorization tests and Owner governance E2E.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Media alt management and unsafe-delete protection                        | PROVEN   | Staging R2 upload/fetch/alt-update/delete passed. The Browser-audited library now has keyboard-operable drag/drop, deduplicated multi-file thumbnails, shared type/signature/count/file/batch preflight limits, aggregate and per-file progress, removal/retry and a compact completion state. The reusable field defaults to an asset card and searchable side-panel picker with shared upload behavior; manual URLs are advanced-only. A neutral selection resolver propagates reviewed asset alt text into public image editors, clears stale text when metadata is missing and lets decorative contexts explicitly preserve their value. Fresh-state production-Worker E2E passes in 9.3 seconds after a real drop, invalid-file rejection and independent library/picker axe scans; it deliberately fails/retries transport, proves 100% progress, date/MIME/search filters, grid/list views, copy URL, adjacent alt update, advanced-URL concealment, picker preflight, accent-insensitive search, exact selection into page SEO and reviewed-alt replacement in a rich-image field, visible usage, blocked referenced delete, reference cleanup and final deletion. Unit coverage includes metadata selection policy, page/post SEO images, body/block content, revisions, products, site settings, magic-byte validation and Owner-only force-delete.                                                                                                                                           |
| SEO, redirects, sitemap and leads operate                                | PROVEN   | Staging desktop/mobile structured-data, sitemap/public-boundary and durable lead lifecycle tests pass. Fresh-state desktop/mobile production-Worker E2E proves human redirect create, exact public status/`Location`, reverse-loop rejection, disable/re-enable without status drift, delete and public fall-through. The post lifecycle independently proves automatic old-slug redirect creation and legacy `.html` redirect compatibility after republish; the API regression suite proves partial updates do not inject create defaults. Resend idempotency/retry policy passes locally.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| New-site init/seed/deploy/verify from clean checkout                     | PARTIAL  | Provisioning contracts and the real Acme staging deployment prove safe names/origin, private env preparation, isolated Worker/D1/R2 creation, 26-table migration/seed, Owner bootstrap and converged plans. First provisioning took about 55 seconds and the live login/publish/media smoke passed with exact cleanup. The runtime receipt reports dirty source provenance, so the exact clean-checkout repetition remains external.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Backup and restore rehearsed                                             | PARTIAL  | `site:backup` exported real staging D1 and passed unique local plus isolated remote restores. The latest clean-release pre-migration export restored with `integrity_check=ok`, 26 tables, exact critical-row counts and artifact SHA-256 `e74cf35bc03fd9fb6417740b1784fa90fff2bc475a5670c00f56f77dfd3f57ca`. The earlier remote drill restored an archived export into a separate APAC D1, proved exact parity in 2.11 minutes, reverified it, and deleted the target. `rem-viet-backups` remains private with the 365-day `d1/` lock. The exact scheduled workflow is active on default branch; site, production stage and account variables are configured. The dedicated token, manual/weekly receipts and production pre-migration export remain external.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Automated critical-path tests pass                                       | PROVEN   | Root `bun run quality` includes valid/invalid cases for every flagship block schema, explicit duplicate page/post slug service conflicts, path-safe ephemeral D1/R2 isolation with source-seed validation, an 89-check compatibility audit, production-Worker runtime migration smoke, 35 flagship browser scenarios and a separate three-scenario Acme reuse gate before exact validated cleanup; exact counts are in `execution-ledger.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Client manual and agency runbook exist                                   | PROVEN   | `docs/client-manual-vi.md` and `docs/agency-operations-runbook.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Non-developer pilot completes handover                                   | EXTERNAL | The Vietnamese script now has a standalone evidence template and fail-closed verifier using the exact final release pilot schema. It reads live no-store Worker provenance and requires one clean site/stage/commit/deploy-input identity; no completed human record exists.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Second site proves core reuse                                            | PARTIAL  | `sites/acme-demo` now has both the permanent fresh local reuse gate and a real isolated Cloudflare staging runtime. Its own Worker/D1/R2, Acme identity, Owner login, homepage publish/restore, media upload/alt/picker/protected-delete and zero-fixture cleanup all pass. Only the clean-checkout provenance requirement prevents this row from being final release evidence.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

The post portion of the proven workflow now includes an embedded
Desktop/Tablet/Mobile working-copy canvas with exact field selection for date,
title, description, cover, tags and structured body. Structured blocks expose
snapshot-bound before/after drag edges plus keyboard move, insert-paragraph,
duplicate and remove controls. Body edits and structural composition share the
50-entry bounded draft history, including same-block coalescing, redo-branch
invalidation, accessible canvas controls, Ctrl/Meta shortcuts and reset on an
authoritative server install. A focused 22.6-second Cloudflare lifecycle proves
mouse title/description selection, hover feedback, exact block focus, a real
rendered drag, bounded composition, composition undo plus keyboard redo,
rich-text value undo/redo, history reset after reload, a pristine draft staying
revision-stable beyond the autosave window, an unsaved typed-form
marker through the authenticated same-origin preview route, and the exact
390px mobile profile. It then continues through autosave, navigation flush,
deterministic conflict recovery, private/no-store/noindex checks, public
isolation, publish, redirect, immutable comparison, restore, accessibility and
exact cleanup. The detached preview still represents a view-only saved draft
without selection, composition or drag hooks. This strengthens the local
`PROVEN` workflow row without satisfying any human or hosted external gate.

## Release-gate audit

| Gate                                  | Status   | Evidence / missing proof                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck, build and tests            | PROVEN   | Root quality command, including pinned formatting, static migration compatibility and runtime Worker migration smoke.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Critical/high dependency audit        | PROVEN   | `bun run audit:security` reports zero critical/high findings. Accepted lower findings are recorded in `docs/dependency-security-audit.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Client secret boundary                | PROVEN   | The audited production build injects unique canaries for all 13 server-only configuration keys, then scans every client artifact for raw, JSON-escaped and URI-encoded values. The current gate scanned 176 files plus configured local private values with zero exposure; reports never print the values.                                                                                                                                                                                                                                                                                                                                                                |
| Frozen install                        | PROVEN   | `bun install --frozen-lockfile` completes with no changes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Empty and upgraded migration fixtures | PROVEN   | Nine migrations pass on both verifier paths, including the privacy-safe `web_vitals` store.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Backup before production migration    | EXTERNAL | Must be generated immediately before the actual production migration.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| No open P0/P1 issue                   | PARTIAL  | Repository/security review found none; staging/pilot can still discover release blockers.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Public draft-leak checks              | PROVEN   | Server and browser coverage.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Critical keyboard path                | PROVEN   | Fresh-state authenticated E2E reaches the homepage field, stable-name save control and private-preview link through the real Tab/Shift+Tab order; it edits with Ctrl+A/typing, activates save/preview with Enter, verifies the exact previewed marker, restores the original value and confirms persistence after reload. Save state is a polite atomic live status. The public contact form also has explicit labels, focus visibility and keyboard reachability. Human pilot remains broader usability proof.                                                                                                                                                           |
| Automated accessibility standard      | PROVEN   | Production-artifact Playwright runs axe-core with WCAG 2.0 A/AA, WCAG 2.1 A/AA, WCAG 2.2 AA and best-practice tags. Desktop/mobile homepage and contact plus authenticated admin/private preview have zero automated violations; the preview iframe is scanned independently rather than excluded from evidence.                                                                                                                                                                                                                                                                                                                                                          |
| No unintended horizontal overflow     | PROVEN   | Desktop/mobile browser assertion; gallery remains the intentional exception.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Representative p75 LCP/CLS/INP        | PARTIAL  | Privacy-safe RUM collection/reporting is live on staging. `site:vitals:audit` runs a provider-authenticated, read-only 28-day aggregate directly against remote D1, withholds release evidence until every metric has 75 samples and passes budget, and currently reports CLS 0/75, LCP 1/75 and INP 0/75. Collection validation, admin aggregation/facets and the remote audit now consistently exclude admin, API, sign-in, preview and synthetic traffic from customer evidence. The admin contract additionally exposes a real preceding-period baseline plus route/device discovery without manufacturing trends. Representative p75 still requires traffic.         |
| Desktop/mobile smoke after deploy     | PROVEN   | Staging public/quality suite passes 10/10 across Desktop Chrome and Pixel 7 and its authenticated CMS suite passes 5/5 on desktop. The current fresh-state Rem Viet production-Worker regression is broader: 35 pass with 9 intentional mobile skips for serial state-mutating desktop scenarios; the separate Acme desktop reuse gate passes 3/3.                                                                                                                                                                                                                                                                                                                        |
| Legacy API connection reuse           | PROVEN   | Six sequential protected staging requests return `401`, including `/api/logs/:logId`, followed by a `200` health response on the same client flow.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Client-ready evidence and tag gate    | PARTIAL  | Schema v3, sanitized live `release:readiness`, live Worker provenance, commit/clean-checkout verifier and tag-triggered CI contract fail closed on dirty/mismatched deployment, missing pilot, p75, exactly-once Resend, enabled/delivered Cloudflare alert, isolated staging restore, second-site, manual/weekly immutable backup receipts or production backup proof. `release:github:audit` proves the byte-exact client-ready workflow is on default branch, registered and active. Live flagship staging now matches the exact clean published commit and deploy-input hash. The final release record remains correctly absent until every external receipt is real. |

## Deployment safety audit

The canonical deployment command is `site:deploy`.

- Dry-run resolves manifest, stage-specific Worker/D1/R2 names and seed plan
  without invoking Alchemy.
- Provider-backed `--plan` exposes the real Alchemy diff without applying it;
  `--yes` is forwarded only to deploy, and conflicting inspection modes fail
  before the CLI is spawned.
- Every non-production preflight/deploy requires
  `--origin=<https-origin-without-path>`.
- That explicit origin becomes both `CORS_ORIGIN` and `BETTER_AUTH_URL`.
- After the 2026-08-14 compatibility fix, the staging deployment changed only
  the Worker; a subsequent Alchemy dry-run reported Worker, D1 and R2 all noop.
- Production origin is locked to `site.manifest.json.siteUrl`.
- Secondary sites require their own `sites/<id>/.env`; no fallback to flagship
  private bindings is allowed.
- Every Worker exposes a no-store deployment identity containing only site,
  stage, Git SHA, deterministic deploy-input SHA-256 and clean/dirty/unknown
  source state. Production deploy rejects a dirty checkout; staging records it
  honestly and pilot/release verification rejects it.
- Preflight executes the real Alchemy 2 CLI and exits before provider/resource
  Effects run.
- A first-apply D1 poll error was recovered without deletion or state reset:
  inventory and state proved the database existed with migrations, the next plan
  reported D1/R2 noop, the noninteractive retry updated only the Worker, and the
  post-deploy plan reported all three resources noop.

The flagship staging environment is live and converged through Alchemy:

- Worker: `rem-viet-web-staging`
- D1: `rem-viet-db-staging`
- R2: `rem-viet-product-images-staging`
- Backup R2: `rem-viet-backups` (outside stack lifecycle; managed `r2.dev`
  disabled; zero enabled custom domains; `d1/` locked for 365 days)
- Origin: `https://rem-viet-web-staging.terasumi.workers.dev`
- RUM: public ingestion and authenticated p75 reporting are live; synthetic
  insert/deduplication/rejection/remote-cleanup smoke passed. The sanitized
  `site:vitals:audit` independently queries the remote D1 with a fixed read-only
  statement and emits schema-compatible performance evidence only on pass.
- Convergence: two consecutive Alchemy plans reported Worker, D1 and R2 as
  `noop`; a temporary source-change probe correctly changed only the Worker
  plan and returned to all-`noop` after removal. The RUM rollout subsequently
  updated D1/Worker and its post-deploy plan again returned all three resources
  to `noop`.

The account currently contains 10 D1 databases. One reusable slot was sufficient
for the two sequential proofs: the isolated restore target was verified and
deleted first, then that slot became `acme-demo-db-staging`. Rem Viet and Acme
are both manifest-managed; the other eight databases remain unrecognized by this
repository and three are zero-table but actively Worker-bound. Unrecognized
never implies deletion-safe. No further deletion is authorized.

Before this current state, the audit found one additional empty, unbound resource:
`deploy2cloudflare-database-terasumi` (`b2452788…`). On 2026-08-15 the owner
explicitly authorized permanent deletion of that exact database. A fail-closed
retirement command revalidated the unique exact name, `0` tables and `0` Worker
bindings in the same operation before deleting it at
`2026-08-15T01:36:30.873Z`. Immediate post-delete audits confirmed it absent and
9/10 capacity. The deletion is irreversible and no other deletion is authorized.

That single slot then hosted `rem-viet-restore-drill-20260815`. The restore used
the immutable staging artifact hash, normalized only a temporary import copy to
satisfy D1 dependency ordering, and left the source bytes untouched. Verification
at `2026-08-15T01:56:29.198Z` proved `quick_check=ok`, all 26 tables and exact
critical row counts in 2.11 minutes. Cleanup reverified the same parity, deleted
the isolated target at `2026-08-15T01:58:14.537Z`, and the capacity audit again
reported 9/10. The returned slot was sufficient for the second-site deploy and
was subsequently consumed by the successful Acme staging deployment,
bringing the account to 10/10 after both sequential proofs completed.

The redacted, read-only `cloudflare:alerts:audit` command also queried the live
account. It found 57 available alert types, including Health Check status and
Workers Observability alerts, with email delivery eligible and ready. It found
only one unrelated billing-budget policy, no enabled operational policy and no
dispatch receipt in the latest 30-day slice. Privacy-safe structured incident
sources now cover publish, upload, notification and migration failures, so the
account can support the route; M5 release evidence remains **PARTIAL** until a
real policy fires and its email is received.

`cloudflare:alerts:policy` now turns policy preparation into a separate
fail-closed workflow. Dry-run validates the live `FIRING_FAILED` filter contract,
email eligibility, private recipient presence and deterministic-name collisions.
Apply requires exact origin and policy-name confirmation, creates at most one
policy, and never updates or deletes drifted policies. Verify correlates dispatch
history to that exact provider policy ID and emits schema-v2 operational-alert
evidence only after a human supplies the real inbox receipt timestamp. A later
live dry-run used the authenticated account email transiently, sent nothing and
proved the policy ready to create. Apply with the default deploy OAuth token
then received Cloudflare 403 because that token lacks Notifications Write; no
policy was mutated. The repository now prepares an isolated `alerts` profile
with exactly account/user read plus notification read/write and validates its
OAuth credential without exposing any secret. The profile config is
idempotently present and browser authorization now yields the privacy-safe
receipt `credentialsReady=true`. A second live POST using the generic environment
token still returned Cloudflare 403, while a sanitized membership audit confirmed
the user is an accepted Super Administrator. No policy was created. Provisioning
therefore ignores the generic deploy token and fails closed until a dedicated
private `CLOUDFLARE_ALERT_API_TOKEN`, scoped to the account with Notifications
Read plus Edit/Write, is present. That dedicated token was subsequently supplied:
the guarded live apply created exactly one deterministic staging policy, and an
independent dry-run converged to `noop` with zero additional mutations. The
underlying Workers Observability query/threshold and real inbox receipt remain
explicit dashboard prerequisites because the alert threshold is not exposed by
Cloudflare's public SDK/API.

`bun run release:readiness --site=rem-viet --stage=staging
--origin=https://rem-viet-web-staging.terasumi.workers.dev --profile=default
--alerts-profile=alerts` now
runs capacity, alert history, deterministic alert-policy, field-performance and
notification-runtime dry-run audits in parallel and composes their sanitized
results with schema-v3 release evidence, deployed-source provenance and Git
state. It emits no
database/resource names or IDs, recipients, policy payloads or credentials. Its
live 2026-08-14 snapshot exited nonzero as designed:
D1 was 9/10 with the one sequential proof slot available and three zero-table databases, all actively Worker-bound;
the live alert contract is ready but its private recipient, deterministic policy
and receipt are absent; CLS/LCP/INP each have zero of 75 required samples;
provider configuration is exposed but Resend runtime values are missing; live
provenance is exposed and matches site/stage/HEAD but correctly reports the
deployed source as dirty; the final evidence file is absent; and the active
implementation checkout is dirty.
The slot was later used sequentially for the completed restore and Acme deploy;
current 10/10 capacity is not an unmet proof because both resource-requiring
operations are complete.
The 2026-08-15 follow-up readiness audit therefore requests zero additional
slots, reports 10/10 used with zero deficit, and emits no D1-capacity gap. The
remaining gaps are alert policy/receipt, field performance, clean
staging provenance, Resend runtime, scheduled-backup activation, schema-v3
evidence and a clean checkout. The unified `release:readiness` aggregate now
re-audits that live GitHub activation instead of trusting a potentially stale
release receipt.

The read-only 2026-08-17 aggregate confirms the deterministic operational alert
policy now exists and alert write authentication is ready, while the private
recipient and real dispatch receipt remain absent. The live 28-day release slice
has CLS 0/75, LCP 1/75 and INP 0/75; deployed provenance is dirty and no longer
matches the implementation HEAD; email runtime configuration and the final
schema-v3 release record remain absent. Its sixth live input now also reports the
default-branch backup workflow, repository configuration, manual receipt and
weekly receipt absent through a boolean-only summary. Capacity is 10/10 with
zero required-slot deficit because both capacity-consuming proofs are already
complete.

The same aggregate now validates its live target before repository inspection or
child audit spawn. A safe manifest slug, exact `staging` stage and origin-only
HTTPS URL are mandatory; credentials, paths, queries and hashes are rejected
without echoing the supplied value. The real production-scope misuse now fails
immediately with the explicit staging requirement, and a fresh correct-scope run
returns the unchanged sanitized snapshot above. Fourteen focused readiness tests
cover the scope and reduction contracts. This hardens operator behavior without
satisfying any external receipt.

`site:notification:smoke` now automates the remaining exactly-once Resend proof
without weakening the human boundary. Dry-run reads the deployed health contract,
active form definition and manifest-owned D1 only. Apply requires a retained UUID
plus exact origin confirmation, creates one synthetic lead, performs one real
provider request and one duplicate replay, then proves one row/provider attempt.
Verify replays only the existing key and emits notification release evidence only
after an operator supplies the actual inbox-receipt timestamp. The current Worker
contract was deployed on 2026-08-14 without changing D1/R2; public remained HTTP
200, while six consecutive health reads correctly returned 503 with only the
missing `email` provider named and zero failed/stale attempts. The following live
dry-run sent nothing, confirmed the provider fields are exposed, and withheld
apply because email runtime configuration is still absent.

The fresh-state E2E and conflict-safe site-settings initialization hardening was
also deployed on 2026-08-14 after the complete local quality gate passed. The
provider plan and apply preserved D1/R2 as `noop`, skipped seed, changed only the
Worker/provenance input, and converged to an all-`noop` post-plan. Homepage and
sitemap remained HTTP 200; health reported D1 `ok` and the expected HTTP 503 only
for missing email configuration. The refreshed sanitized readiness audit remained
nonzero for the same external evidence and clean-release gates, rather than
mistaking a successful staging rollout for client-ready completion.

The redirect hydration, pending-toggle and partial-update fixes were then
deployed through the same guarded Worker-only path after `bun run quality`
passed 160 unit/contract checks and 27 fresh-state browser checks. The post-plan
converged Worker, D1 and R2 to `noop`; homepage/sitemap returned HTTP 200 and
health reported D1 `ok`, with HTTP 503 only for the still-missing required email
provider. Live provenance remained `dirty`, so the clean release gate correctly
remains open.

The home-editor initialization and stale-tab conflict hardening was subsequently
deployed after the expanded quality gate passed 160 unit/contract checks and 29
fresh-state browser scenarios. The pre-plan preserved D1/R2 as `noop`, apply
skipped seed and updated only the Worker/release-input provenance, and the
post-plan converged all three resources to `noop`. Homepage and sitemap returned
HTTP 200; health reported D1 `ok` and the expected HTTP 503 solely for the
missing required email provider, with zero failed or stale notification
attempts. Live provenance remained truthfully `dirty`.

The completed Media Library controls and redirect-toggle optimistic
reconciliation were then deployed after another complete 160-check quality run
and 29-scenario fresh-state browser pass. Plan/apply preserved D1/R2 as `noop`,
skipped seed and changed only Worker/release-input provenance; the post-plan
returned all three resources to `noop`. Homepage/sitemap remained HTTP 200 and
health reported D1 `ok`, with HTTP 503 solely for missing required email
configuration and zero failed/stale notification attempts. Live provenance
remained truthfully `dirty`.

The post-authoring workflow was then completed and deployed after the full
160-check quality gate and 30-scenario fresh-state browser suite passed. The
editor now preserves structured inline marks and safe links, exposes an
authenticated no-store/noindex draft preview, keeps publish/schedule/delete
controls capability-aware and supports legacy `.html` URLs when a published
slug changes. Converting the admin and public post list routes into real parent
layouts also removed a file-route masking defect that had hidden their nested
create/edit/preview/detail screens. The guarded provider plan kept D1 and R2 at
`noop`; apply skipped seed and updated only the Worker/release-input provenance;
the post-plan returned all three resources to `noop`. Live homepage, sitemap and
blog list returned HTTP 200. Unauthenticated post creation and preview returned
307 to `/dang-nhap`. Health reported D1 `ok` and HTTP 503 solely for the missing
required email provider, with zero failed/stale notification attempts. Live
provenance still truthfully reports `dirty`, so client-ready authorization
remains open.

The subsequent post safety pass adds 1.6-second valid-draft autosave, explicit
dirty/saving/saved/version feedback, unload protection and local-value retention
on stale-version conflicts; published slug edits remain manual so redirect
creation is an explicit decision. Fresh-state browser evidence proves reload
persistence and a genuine two-tab winner/stale recovery. After root quality
again passed all 160 unit/contracts and 30 browser scenarios (8 deliberate
mobile skips), the guarded staging plan changed only the Worker/release-input;
D1 and R2 stayed `noop`, seed was skipped and the post-plan converged all three
resources to `noop`. Public routes remained 200, protected post routes remained
307 to `/dang-nhap`, and health remained 503 solely for missing required email
configuration while D1 stayed `ok` with zero failed/stale attempts. Provenance
still reports `dirty`; this does not close the external client-ready gates.

The internal-navigation hardening closes the remaining implementable autosave
flush gap for homepage and post editors. A shared router blocker now waits for a
successful save before leaving a dirty editor; validation failure or conflict
cancels the navigation and preserves local state, while browser/tab shutdown
uses the only reliable browser contract: a native unsaved-change warning.
Fresh-state E2E edits both document types and navigates immediately, before the
debounce can fire, then returns and proves persistence. The full root gate again
passed 160 unit/contracts and 30 browser scenarios (8 deliberate mobile skips).
Guarded staging apply changed only the Worker/release input, D1/R2 stayed `noop`,
seed was skipped and the post-plan converged all resources to `noop`. Public
routes returned 200, protected editor routes returned 307 to login, and health
remained 503 solely for missing email while D1 stayed `ok` with zero failed or
stale attempts. This strengthens M3 without changing any external release gate.

The preview follow-up closes the new-tab race left outside router navigation.
Homepage and post Preview actions now reserve a popup synchronously, flush the
latest dirty state (including edits made during an in-flight save), and navigate
the tab only after persistence succeeds; failed validation/conflict closes the
temporary tab. Fresh-state E2E types unique markers and clicks Preview before
the debounce, then proves both private previews show the new data. Full quality
again passed 160 unit/contracts and 30 browser scenarios with 8 intentional
mobile skips. The guarded staging rollout remained Worker-only, skipped seed,
kept D1/R2 `noop`, and converged to all-noop. Public routes returned 200,
anonymous previews returned 307 to login, and health stayed 503 solely for
missing email while D1 was `ok` with zero failed/stale attempts. This strengthens
M4 without changing the external client-ready gates.

The M7 keyboard gate now has an authenticated editor proof rather than relying
on public-form semantics. Homepage save state is exposed as a polite atomic live
status and the save control keeps a stable accessible name while its visible
label changes during autosave. The fresh-state desktop test reaches the hero
field, save control and private-preview link through Tab/Shift+Tab, edits using
Ctrl+A plus typing, activates save and preview with Enter, verifies the exact
private-preview marker, then restores and reloads the original value. Root
quality passed 160 unit/contracts and 31 browser scenarios with 9 intentional
mobile skips. Guarded Alchemy apply updated only the Worker/release input,
skipped seed, kept D1/R2 `noop` and converged to a three-resource `noop` plan.
Live public routes returned 200, anonymous preview/editor routes returned 307 to
login, and health remained 503 solely for missing required email while D1 was
`ok` with zero failed/stale notification attempts. External client-ready gates
remain unchanged.

The M7 standards-based accessibility gate is now executable rather than inferred
from semantic spot checks or Lighthouse alone. The production-Worker suite uses
official `@axe-core/playwright` rules for WCAG 2.0 A/AA, WCAG 2.1 A/AA, WCAG
2.2 AA and best practices on desktop/mobile public homepage and contact routes,
the authenticated admin shell and the independently loaded private preview. No
rules are disabled or allowlisted. The audit fixed contrast, landmark naming and
nesting, file-input naming, scroll-region keyboard access, redundant logo text,
reduced-motion visibility and preview/loading-region semantics. Root quality
passed 160 unit/contracts and 31 browser scenarios with 9 intentional mobile
skips. A guarded 2026-08-15 Alchemy rollout changed only the Worker/release input,
kept D1/R2 `noop`, skipped seed and converged to an all-`noop` post-plan. The
live public axe suite then passed 4/4 across desktop and mobile. Public routes
remained 200, protected admin routes remained 307 to login, and health remained
503 solely for missing required email with D1 `ok` and zero failed/stale
notification attempts. This closes automated accessibility evidence, not the
human pilot or any external client-ready gate.

The second-site proof was completed at the runtime level on 2026-08-15. The
permanent local `test:e2e:second-site` gate still passes 3/3 from a fresh
manifest-selected production Worker with temporary isolated state. In addition,
the real Acme staging apply created `acme-demo-web-staging`, its separate D1 and
its separate R2 bucket in about 55 seconds. Owner bootstrap was idempotent;
homepage returned HTTP 200 with Acme identity; the D1 held 26 tables and
`quick_check=ok`; and the provider plan converged all resources to `noop` after
the final provenance-only Worker update.

The live browser receipt passed draft isolation, publish, public visibility and
revision restore in 10.6 seconds, then passed media retry/upload, R2 delivery,
alt text, picker usage, the Owner force-delete warning and exact cleanup. Remote
counts afterward were zero for interrupted E2E pages and media. The bootstrap
binding was removed from the ignored private env without logging its value, and
the owner confirmed the usable credential is stored outside the repository. The
Worker truthfully reports `sourceState=dirty`, so the exact clean-checkout
repetition remains mandatory before client-ready evidence can be emitted.

The two previously unrecorded public flags now also pass live: Acme sitemap is
HTTP 200 and excludes admin/preview paths; a contact submission was accepted,
its exact replay was identified as duplicate, remote D1 held one durable row and
exact cleanup returned the count to zero. `site:smoke:staging` now packages the
entire final repetition into one fail-closed evidence workflow. It requires a
clean checkout matching clean live provenance, a three-noop provider plan,
password-manager injection, exact confirmations and measured timing windows,
then runs four authenticated self-cleaning desktop scenarios (including the
exact neutral page-provider contract through the deployed API), two separate
mobile navigation/authoring scenarios, plus sitemap and emits the schema-valid
`secondSite` fragment. Current dry-run truthfully reports dirty
checkout, no injected password and no final timing receipt, so no clean evidence
was fabricated.

The same 2026-08-15 root gate now treats the browser/server secret boundary as
executable evidence. Its production build injects unique canaries for all 13
server-only configuration keys and scans 176 generated client artifacts for
raw, JSON-escaped and URI-encoded values; it also checks configured local
private values without printing them. The result was zero exposure. The
desktop/mobile production-Worker regression additionally proves public email
sign-up returns 400 and a subsequent sign-in with the same credentials returns 401. Login exposes neither public registration nor unconfigured OAuth controls,
and password recovery no longer claims that an automatic reset email was sent.

That exact candidate was then rolled out to staging through a guarded Alchemy
plan on 2026-08-15. The plan changed only the Worker/release-input hash; D1 and
R2 remained `noop`, the idempotent seed action skipped, and the immediate
post-plan converged all three resources to `noop`. The live closed-registration
test passed 2/2 across desktop and mobile. Health reported D1 `ok` and zero
failed/stale notification attempts; its 503 remains solely the missing required
email provider. Provenance still truthfully reports a dirty source state, so
this receipt does not satisfy the clean-commit client-ready gate.

The ordinary-page editor now has direct bounded composition on the real
responsive renderer rather than a view-only working-copy iframe. Its
same-origin, page-scoped neutral protocol covers block selection, move, insert,
duplicate and remove for the standard rich-text/product-grid/CTA catalog;
selection focuses the mounted inspector, mouse and keyboard toolbar paths are
covered, and the sidebar remains the fallback. The independently opened saved
draft remains intentionally view-only, and deterministic position/type IDs for
legacy blocks are not represented as persistent IDs. The focused authenticated
desktop lifecycle passed in 1.9 minutes, proving protocol receipts and the full
composition sequence before continuing through autosave reload, genuine
two-tab conflict recovery, private/public isolation, publish/revision/redirect/
unpublish, independent preview accessibility and exact cleanup. This strengthens
the `PROVEN` preview/publish row locally; it does not replace the non-developer
pilot or any hosted/commercial receipt.

The renderer now adds exact neutral field paths where ordinary-page output maps
truthfully to an inspector control: rich text → `data.content`, CTA heading →
`data.title`, and CTA link → `data.href`. Product-grid remains block-level
because category and limit are configuration rather than distinct rendered
fields. Canonical authoring blocks retain the outer working-copy identity when
rendered individually. The refreshed 1.3-minute lifecycle proves mouse link →
href focus, Enter title → title focus and exact path receipts before completing
the existing composition, autosave, conflict, privacy, immutable-workflow and
accessibility checks. External evidence requirements remain unchanged.

A signed-in Browser fault audit on 2026-08-17 found that the embedded-editor
chrome could previously display green/live before a validated child-frame
handshake. Homepage, standard-page and post canvases now share a fail-closed
connection state machine with explicit connecting/delayed/retry presentation;
only a validated ready event enables the live/direct-sync claim. The
standard-page listener also requires the current iframe window as the message
source. Browser inspection observed connecting first and connected only after
the real handshake. During the corresponding isolated fresh-D1 lifecycle, the
review publish path exposed a missing canonical app migration even though the
neutral provider migration was already proven. Typed `cms_review_events` schema
ownership plus migration `0011_real_iron_lad` closes that deployment gap, and
the migration verifier now applies all 12 files to empty and upgraded fixtures
while checking both review indexes. The refreshed 27.1-second production-Worker
lifecycle passes direct focus, publish, revision, redirect, unpublish and exact
cleanup. This strengthens the local `PROVEN` rows without changing the external
pilot, clean-release, operations or commercial gates.

The follow-up signed-in Browser quality pass found a presentation-quality gap:
the flagship's complete three-pane workspace compressed the page canvas to
roughly 24% at normal desktop width. The homepage now provides a desktop-only
focused canvas-plus-inspector dialog with background-scroll lock, contained Tab
focus, Escape close, trigger restoration, hidden structure rail and automatic
exit below 1280px. Browser evidence measured the live dialog at 1256×696 and
proved restoration on exit. Its independent axe pass exposed duplicate unnamed
landmarks across the parent and iframe, so admin, public and homepage/page/post
preview `main` and notification regions now have route-aware accessible names.
FAQ selection now commits on primary `pointerdown` before its animated layout can
retarget a click, while detail-zero clicks preserve keyboard operation. The
isolated production-Worker homepage workflow passed in 16.4 seconds with the
focused accessibility gate, exact question-field path and existing save/review
lifecycle. External pilot, release, hosted-provider and commercial rows are
unchanged.

The explicit Google Docs paste requirement is now executable rather than
inferred from textarea browser behavior. A reusable `@agency/cms-admin`
primitive accepts only bounded `text/plain`, normalizes line endings, NBSP,
Unicode composition and invisible/control markers, preserves the canonical
selection, and truncates without splitting a surrogate pair. Every post
rich-text span intercepts paste through that boundary and ignores HTML-only
payloads; clipboard styles, classes, scripts and Office metadata never enter the
structured document. Package tests cover normalization, replacement, reversal,
length limits and malformed target state. The 21.6-second authenticated
production-Worker lifecycle supplies both dirty plain text and styled HTML,
then proves the exact normalized value through save, reload, live/detached
preview, publish, revision restore and cleanup.

The performance command center now supports diagnosis without weakening its
release-evidence boundary. `getWebVitalSummary` calculates the current and
preceding equal-length p75/sample windows, exposes top-route and device facets,
and keeps absent history explicitly unavailable. The signed-in in-app Browser
proved a real route-chip selection and the filtered metrics on the running app.
That review exposed pre-existing admin telemetry in a report described as
public traffic: the mixed local view showed 11 reports, including
`/admin/inventory`, `/admin/performance` and `/admin/products`. The reusable CMS
contract and reporter now refuse private collection, ingestion rejects those
paths, both admin summary/facet queries exclude them defensively, and the remote
Cloudflare release query applies the same exclusions. The refreshed view shows
only three real public reports and no admin route. Contract/API/infra unit tests
cover path boundaries and comparison math; the focused production-Worker admin
shell scenario passes with prior-period semantics and zero private route chips.
This improves the quality of the collection and operator workflow, but does not
replace the still-required 75 representative public samples per metric.

Release confidence is now visible in that same workspace instead of being
reconstructed from scattered scripts. An authenticated, audit-scoped runtime
query combines deployment provenance with operations health, and the UI fails
closed across four gates: representative Web Vitals, clean/identified source,
notification configuration/delivery health and database response. It separately
names the operational-alert, scheduled-backup and non-developer-pilot receipts
that remain external. The signed-in local Browser displayed `1/4` exactly as the
current evidence requires: CLS `0/75`, LCP `1/75`, INP `2/75`, dirty development
source and missing email configuration did not pass; only database health did.
The API authorization test, affected typechecks and focused production-Worker
operations E2E pass, including accessibility and viewport coverage. This makes
the readiness state harder to misread but does not satisfy those outstanding
external gates.

The remaining human pilot now has a guarded in-product runner. Audit-capable
Owner/Admin users can open `/admin/handover`; it will not start or export unless
server-issued provenance says clean, fully identified `staging`. The eight timed
tasks preserve one active timer in per-user session storage across route changes,
capture bounded
observer/KPI notes, require the no-JSON/code assertion, and export the existing
verifier-shaped draft with approval/recording timestamps intentionally blank.
Five unit tests prove provenance, timing, completion and export boundaries.
Authenticated production-Worker E2E proves route discovery, the non-staging
block, accessibility/no-overflow and Editor invisibility. A signed-in local
Browser correctly showed dirty `dev-terasumi`, `0/8` and a disabled start. This
makes the real pilot easier to run consistently; no non-developer has completed
or approved it yet.

The standard-page canvas no longer relies on position-derived visual IDs.
Flattened legacy blocks are deterministically upgraded, inserted and duplicated
blocks receive distinct bounded identities, and draft/revision codecs persist
the ID instead of discarding it. Existing unique IDs remain unchanged while a
duplicate legacy ID is safely re-keyed. Forty-four focused core/template/API
tests prove the compatibility and round-trip contract. A refreshed isolated
production-Worker lifecycle passed in 25.6 seconds and proves the original CTA
keeps its exact ID through duplicate, rendered drag/reorder, autosave and
reload, before completing the existing immutable workflow, conflict and cleanup
sequence. This strengthens local Storyblok/Sanity-style targeting; it does not
replace the outstanding non-developer or hosted release evidence.

The premium focus workspace now covers all three rendered editors instead of
only the flagship homepage. A reusable `@agency/cms-admin` hook enforces
desktop-only entry, automatic exit below 1280px, background scroll lock, Escape,
focus containment and trigger restoration. Standard pages render canvas-left
and the actual selected-block inspector right; posts render canvas-left and the
actual autosaving form right. No duplicate form or draft state is introduced.
Independent focused-dialog axe scans pass. The combined isolated post and
standard-page production-Worker lifecycles pass in 52.1 seconds with the real
responsive exit, while the extracted homepage workflow passes again in 15.4
seconds. This strengthens Storyblok-style authoring-space parity without
manufacturing the required human usability receipt.

Standard-page block discovery is now driven by the template contract rather
than three hardcoded application buttons. The immutable Rèm Việt catalog is
exhaustive for rich text, product grid and CTA and supplies labels,
descriptions, categories and bilingual search keywords. The structure editor
and contextual visual composer share the platform's accent-insensitive filter
and the same labels. Thirteen template tests pass. The refreshed isolated
production-Worker lifecycle passed in 29.4 seconds, proving `keu goi` and
`van ban` discovery, filtered results, an axe-clean labelled canvas dialog,
neutral insertion, and the remaining autosave/publish/revision/cleanup flow.
A fresh signed-in Browser check independently showed all three descriptive
cards and reduced `keu goi` to CTA alone without persisting content. This
improves current Sanity/Storyblok-style component discovery locally; it does
not replace the outstanding non-developer or hosted evidence.

The structured-body editor shared by pages and posts now has the same
template-owned discovery quality as page composition. One immutable catalog
exhaustively describes paragraph, heading, list, quote, image, video and code;
the compact inserter searches Vietnamese without accents and post revision
summaries use the same labels. Direct and canvas insertion share the schema's
500-block ceiling. Fourteen template tests pass. The refreshed post
production-Worker lifecycle passed in 24.6 seconds with `tieu de` filtering,
unrelated-choice exclusion and an open-catalog axe scan before the complete
visual/autosave/conflict/revision cleanup flow. The proof initially caught the
catalog search stealing the broad content-focus fallback; that route now scopes
focus to actual block controls and exact canvas click-to-edit passes again. The
standard-page lifecycle remains green in 29.7 seconds. This is local product
evidence, not a human or hosted receipt.

The same structured-body contract now persists identity rather than deriving it
from array position. Parsing deterministically upgrades legacy missing or
duplicate IDs, retains existing unique IDs, and every add, canvas insert or
duplicate operation creates a collision-safe identity. The post input boundary
and nested standard-page provider codec normalize the document before storage.
Preview selection and composition require an exact rendered snapshot plus
matching block IDs and indices, so stale or mismatched commands fail closed.
Forty-two CMS, twenty-four API authorization and seven focused web protocol
tests pass. A refreshed 24.9-second production-Worker post lifecycle proves four
distinct rendered IDs and the original heading ID through drag, autosave and
reload; an independent 29.3-second standard-page lifecycle proves its nested
rich-text ID through provider encoding, autosave and reload. This removes the
local position-derived identity caveat, not any external evidence requirement.

The homepage canvas now has deterministic section-navigation semantics in
addition to stable content identity. A signed-in Browser comparison exposed
that the fixed footer could be selected while the preview remained at Hero, and
that reselecting an already-active section produced no observable update. The
preview now owns a non-visual footer target at the true document end and a
validated, bounded `selectionRevision` retriggers reduced-motion-aware alignment
for every explicit selection. A one-shot guarded focus retry handles the
cross-frame reconciliation race only when focus falls to the body, iframe or
intended inspector control, avoiding focus theft after a user changes fields.
Twenty `cms-admin` tests pass with 85 expectations. The strict 16.4-second
production-Worker homepage lifecycle requires footer selection at the exact
bottom, Hero at the exact top, repeat same-section navigation, exact FAQ field
focus and complete cleanup. A final live Browser check measured
`scrollY=16442` and `fromBottom=0` after selecting `10. CTA cuối trang`. This is
local product evidence and does not replace the outstanding pilot, hosted or
release receipts.

The homepage focus workspace is now canvas-first in measured layout as well as
interaction semantics. A signed-in Browser comparison found that supporting
status and revision cards compressed the live page into a roughly 200px-tall
strip at 36% scale even after focus mode opened. Those cards now leave layout
only while focused and return on exit, preserving their normal-editor access and
the single underlying draft. The final live measurement is an 814×670 preview
shell, an 813×580 canvas and 53% desktop-page scale. The strict 16.4-second
production-Worker lifecycle now requires at least 640px shell and 520px canvas
height at the desktop test viewport, confirms both hidden and restored panel
states, reruns the focused axe scan, and retains Escape/trigger restoration plus
the full workflow cleanup. This closes a local presentation-quality gap, not
the non-developer pilot or hosted release gates.

Brand-new standard pages now receive the same real responsive canvas before any
save. The create flow uses a reserved, in-memory preview scope on the existing
authenticated private/no-store/noindex route, disables that scope's server
query and hides the independently opened saved-draft link. The parent streams
the one editor working copy over the existing validated visual protocol, so
responsive rendering, composition and exact canvas-to-field selection do not
create a second state source. The focused production-Worker lifecycle passed in
33.0 seconds and proves unsaved rendering, exact CTA-title focus, zero page-list
persistence in an independent signed-in context, real-ID handoff on publish and
the full existing cleanup. A live signed-in Browser receipt rendered a two-block
unsaved sample at 776×485 and 54% scale beside its CTA inspector while the list
remained empty; no save or publish was invoked. This closes a local zero-save
parity gap, not the non-developer pilot or hosted release gates.

Standard-page undo/redo now covers the complete working document instead of
only blocks. Title, slug, stable-ID blocks, SEO metadata, social image and robots
controls share a bounded, coalesced and branch-safe history against the exact
installed or saved baseline. Reaching that baseline restores clean state and
removes the navigation guard; a save advances it only to the generation sent to
the provider, so later edits remain dirty. The focused production-Worker
lifecycle passed in 32.0 seconds with metadata undo/redo, exact baseline
restoration, clean navigation, zero persistence and the established end-to-end
workflow. A live signed-in Browser check independently undid SEO then page
title, observed synchronized state with undo disabled and redo available,
navigated to Posts immediately and found no temporary page row. This closes a
local recovery-trust defect, not the non-developer pilot or hosted release
gates.

Post undo/redo now matches that whole-document standard-page contract. Title,
slug, description, cover, tags, publish date, structured rich text, SEO
metadata, social image and robots controls share one bounded, branch-safe
history with semantic input coalescing and an exact installed/saved baseline.
History navigation restores the complete form snapshot and structured-content
bounds; saves advance the baseline only to the submitted generation. The
focused production-Worker post lifecycle passed in 26.0 seconds with title/SEO
chronology and clean restoration added to its established composition,
autosave, conflict, publish, revision, redirect and cleanup path. A live
signed-in Browser check independently undid SEO then title, returned to
synchronized v2 with undo disabled and redo available, navigated away without a
save and reopened both original values unchanged. This closes the local
cross-editor recovery asymmetry, not the non-developer pilot or hosted release
gates.

The mandatory global settings/navigation editor now has the same recovery
standard. Site identity, contact data, socials, compatibility flags, header
menu and footer menu share one bounded, coalesced and branch-safe history
against the exact installed or persisted baseline. Undo/redo crosses both forms
chronologically; reaching the baseline clears the navigation guard, and
internal navigation flushes only dirty regions. Header and footer writes move
their baselines independently so a partial failure remains truthful and
retryable. The focused production-Worker lifecycle passed in 8.5 seconds with
cross-form undo/redo, clean restoration, save-before-navigation, immutable
revision restore, public menu propagation and exact cleanup. Its added
accessibility scan exposed the screen's existing h1→h3 jump; semantic h2 card
headings fixed it and the rerun passed with zero violations. A live signed-in
Browser check independently changed address then header label, undid them in
reverse order, returned to synchronized state with undo disabled and redo
available, navigated away and reopened unchanged originals. This closes the
local global-content recovery asymmetry, not the non-developer pilot or hosted
release gates.

The global editor now also has the rendered-surface contract already proven for
homepage, standard pages and posts. A responsive sticky canvas uses an
authenticated private/no-store/no-index route to mount the production Header and
Footer. Its typed envelope recursively validates navigation, checks same origin
and parent source, retries the iframe handshake, and prevents server-query data
from replacing the unsaved working copy. Desktop/mobile modes render real
1280×820 and 390×844 viewports. Two protocol tests pass; the extended
production-Worker lifecycle passed in 12.1 seconds with connection, responsive
switching, unsaved phone/menu propagation, undo-restored rendering,
accessibility, immutable restore, public propagation and exact cleanup. A live
signed-in Browser check independently observed an unsaved header-label edit in
the production Header, then restored field and canvas with global Undo without a
save. This closes local global-content visual parity, not the non-developer
pilot or hosted release gates.

The 2026-08-17 release-boundary re-audit also passed the exact root
`bun run quality` workflow against the uncommitted local candidate based on
`4cc3cbd8246fba098a9e78baa0dd4f6e4129072e`. Its first run exposed a
dark-theme dashboard contrast defect plus stale/ambiguous authenticated E2E
selectors; those were corrected before the end-to-end gate passed. GitHub
remains intentionally fail-closed: the local branch is two commits ahead of
remote `main` at
`8af868cec3f805411376939c8bf3685864428020`, neither release workflow is
present or registered there, the four scheduled-backup settings are absent, and
no manual/weekly receipt exists. No commit, push, external configuration or
dispatch was performed, so this is local release-candidate evidence rather than
client-ready activation.

Owner-authorized publication has now closed the workflow-registration portion
of that gap. Remote `main` reached
`41fbd7eb4493342eef3b8946d255f9845e043b03`; the read-only audit at
`2026-08-17T02:06:10Z` proves the exact client-ready workflow present,
registered and active. The exact scheduled-backup workflow is also on default
branch. Three non-secret settings are now configured; its dedicated token plus
manual and weekly receipts are still absent.
Pre-push inspection excluded an accidental 203 MB installer and generated local
provider databases from the unpublished history while preserving the original
tip on `codex/pre-publication-cms-c8f9224`. The push also exposed 22 alerts from
one unused legacy manifest; removing it reduced GitHub's open alert count to
zero, with frozen install unchanged and both high-severity and client-secret
audits passing. The remaining evidence below is still mandatory.

## Evidence still required for client-ready

1. Configure Resend and prove exactly-once lead notification plus operational
   alert delivery on staging. Stable provider idempotency, bounded email retry,
   manual recovery and degraded-health signaling are implemented and tested;
   Telegram remains optional and intentionally has no automatic retry. Deploy
   the current health contract, run `site:notification:smoke` dry-run/apply, have
   the recipient confirm exactly one message, then run verify to emit evidence.
   Configure `CLOUDFLARE_ALERT_EMAIL`, authenticate the isolated least-privilege
   `alerts` profile, run `cloudflare:alerts:policy --profile=alerts` dry-run/apply,
   configure the documented Workers Observability incident threshold, trigger a
   controlled notification failure, confirm the Cloudflare email, then run policy
   verify with the receipt timestamp. Re-run `bun run cloudflare:alerts:audit`;
   it must report a dispatch correlated to the exact enabled policy rather than
   capability or an unrelated same-type receipt.
2. Repeat the now-passing Acme deployment/smoke from the exact clean release
   checkout and retain matching provenance. Private env preparation, isolated
   Worker/D1/R2, ~55-second provisioning, Owner bootstrap, login,
   publish/restore, media lifecycle, lead idempotency, sitemap and cleanup are
   proven locally. The staging runner now additionally requires the same neutral
   provider conformance through the deployed API and distinct desktop/mobile
   Playwright projects; the independent Acme Worker receipt still reports dirty
   source provenance. Run `site:smoke:staging` with the clean deployment
   timestamps and password-manager injection to emit the final fragment.
3. Collect representative real-user p75 LCP/CLS/INP through the now-live staging
   collector after traffic exists; rerun `bun run site:vitals:audit --site=rem-viet
--stage=staging --origin=https://rem-viet-web-staging.terasumi.workers.dev
--profile=default --json` and copy its `releaseEvidence` only after it is
   non-null. Keep Lighthouse and synthetic endpoint smoke as lab/plumbing
   evidence only.
4. Have a non-developer complete the handover script without intervention,
   record per-step duration/confusion points in the standalone pilot template,
   obtain the tester's post-run approval and pass `release:pilot:verify` against
   the exact live clean commit/site/stage/origin/deploy-input identity.
5. Before the production migration, create and lock/hash-verify a production
   export with `site:backup:archive`; the staging archive proves the transport,
   not the production timing requirement. Reconcile the current missing or
   mismatched `CMS_BACKUP_SITE`, `CMS_BACKUP_STAGE`,
   `CLOUDFLARE_ACCOUNT_ID`, and dedicated
   `CMS_BACKUP_CLOUDFLARE_API_TOKEN`, pass `site:backup:github:audit`, and
   retain both a green manual dispatch and the next weekly receipt. Keep the
   published client-ready workflow byte-exact and require
   `release:github:audit` to keep proving active Actions registration, then
   rotate production secrets, rerun the dependency/security review, complete
   `docs/releases/v1.0.0-client-ready.json`, and only tag after
   `bun run release:verify` passes from the exact clean release commit.

## Clean-candidate release-boundary refresh — 2026-08-27

The current code-bearing candidate is
`5bd7fb9f468573859e0476ebb51dc73a5364b533`; local `main` and
`origin/main` matched it with a clean worktree when the candidate was verified.
They now point to documentation-only descendant `9de4e04`; the intervening
diff changes only CMS evidence documents and does not promote a different code
candidate. The exact sequential `bun run quality` command exited zero on
`5bd7fb9` after correcting the last deterministic
API-key mutation defect, transient dark-theme contrast transition, CMS
hydration/scaled-preview interactions, toast-blocked autosave action, and the
mobile product-filter result race exposed by prior aggregate attempts. The
passing run includes the complete clean-checkout rehearsal, all typechecks,
secure build, performance audit, desktop/mobile stateful CMS matrix, and the
independent `acme-demo` smoke. Release preparation for version `0.1.0` reports
24 packages, `publishEligible=true`, and `sourceState=clean`.

The same-turn sanitized readiness audit remains intentionally nonzero:

- live Rèm Việt staging is healthy and clean but reports commit
  `9ee320c991507ab3bc4717d6142c1f4236d4178e`, not the current candidate;
- the notification provider contract and email configuration are ready for one
  controlled smoke, but no exactly-once inbox receipt exists;
- the deterministic Cloudflare alert policy/provisioning contract is ready, but
  no controlled-failure dispatch and human inbox receipt exists;
- the qualifying 28-day field sample counts are CLS `0/75`, LCP `1/75`, and
  INP `0/75`;
- the production scheduled-backup configuration gate, manual receipt, and
  following weekly receipt are absent;
- `docs/releases/v1.0.0-client-ready.json` remains correctly absent.

Cloudflare D1 inventory is saturated at `10/10`, with no calculated release-slot
deficit and one zero-table owner-review candidate. The audit does not authorize
deletion. No staging deployment, credential reset, external notification,
controlled alert failure, database deletion, production operation, package
publication, or release evidence was performed during this refresh.

The next exact sequence is therefore: obtain action-scoped authorization,
deploy the current SHA and retain matching provenance; produce notification and
alert receipts; collect representative RUM and the unassisted pilot; reconcile
and execute the manual/following-weekly production backup workflow; publish and
reinstall the released packages in Rèm Việt plus independent paid sites; then
assemble schema-v3 evidence and run `bun run release:verify` before tagging.
