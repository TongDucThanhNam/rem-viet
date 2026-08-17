# Platform Kit v1 completion audit

Audit date: 2026-08-17<br>
Source of truth: `docs/agency-cms-master-plan.md`<br>
Current claim: internal `0.1.0` technical candidate; **not stable 1.0**

Status meanings:

- **Proven locally**: repeatable evidence exists in this repository, but it is
  not a registry, deployed staging, production, human, or commercial receipt.
- **External open**: completion requires a real external event or owner-provided
  credential/approval and must not be synthesized.
- **Complete**: the plan's full scope and evidence source both pass.

## Track B exit gates

| Master-plan gate                                                             | Status                         | Authoritative evidence                                                                                                                                                                                                                                                                                                                                                                | Missing evidence                                                                                       |
| ---------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Rèm Việt builds through package public APIs without privileged deep imports  | Proven locally                 | `cms-kit-boundaries.test.ts`, monorepo typecheck, secure web build                                                                                                                                                                                                                                                                                                                    | Install the released private-registry version into the Rèm Việt repository/clean commit                |
| Clean consumer installs artifacts without monorepo source                    | Proven locally                 | `bun run cms:kit:consumer`; eight tarballs install, load the packed template initializer, generate/review/repeat a schema-v2 plan, apply its canonical manifest/empty env/ten-block seed/portable assets/handover files, report the secret checklist, derive isolated Alchemy resources from that exact manifest, typecheck, build, and execute conformance                           | Registry-hosted install and independent deployed staging receipt                                       |
| New block has contract/editor/renderer/seed/migration path                   | Proven locally                 | The packed `agency-cms add-block` command emits a versioned envelope, defaults, migration hook, fresh-ID seed, editor/renderer definitions, manifest and explicit template-registration contract. The clean consumer typechecks, builds, parses, migrates, registers and renders the generated block; ten flagship plus three standard contracts prove the established registry path. | Real second template/block adoption may improve product evidence but is not a local API gap            |
| Cloudflare provider passes one conformance suite locally and in staging      | Proven locally / external open | SQLite, isolated Miniflare, and the authenticated deployed-API adapter pass the exact neutral lifecycle locally; `site:smoke:staging` now requires that test in its four-desktop/two-mobile matrix                                                                                                                                                                                    | Run the fail-closed command against the exact clean independent staging release and retain its receipt |
| N→N+1 preserves content/revisions/media and rollback works                   | Proven locally                 | `bun run cms:kit:upgrade`; receipt-bound backup/apply/verify/rollback and package reinstall preserve D1/R2 state                                                                                                                                                                                                                                                                      | Execute the released versions and provider driver on independent staging                               |
| One core fix reaches two consumers without a copied patch                    | External open                  | No qualifying receipt                                                                                                                                                                                                                                                                                                                                                                 | Two independent paid consumers on one released core, followed by one coordinated core upgrade          |
| Stable neutral packages contain no Rèm Việt import/default/resource coupling | Proven locally                 | forbidden-import boundary tests and release tarball content policy                                                                                                                                                                                                                                                                                                                    | Re-run from the clean release commit and retain registry provenance                                    |
| Global settings/navigation cross neutral versioned provider ports            | Proven locally                 | The identical runtime conformance passes Cloudflare D1 and the structural Sanity document adapter; boundary tests, typed app adapter, and authenticated Worker edit/public-render/history/restore E2E also pass                                                                                                                                                                       | Run the browser recovery flow on independent staging and retain a hosted Sanity global-content receipt |

## Stable 1.0 definition

| Requirement                                                                         | Status                         | Evidence / blocker                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Neutral package graph and explicit exports                                          | Proven locally                 | Eight packages, boundary tests, packed consumer, and the provider-neutral versioned site-manifest contract in core                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Rèm Việt consumes released artifacts like an ordinary client                        | External open                  | Workspace packages are intentionally still used before the first private publish                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Independent repository installs, provisions, and deploys without copied source      | Proven locally / external open | Independent artifact install/build passes. Its installed CLI generates the review artifact from the installed template—not a handwritten fixture—then validates/applies its canonical manifest, env example, full seed, placeholder assets and required-secret names. The exact persisted manifest drives the neutral Alchemy resource plan; independent deployed staging is missing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Cloudflare provider conformance and production-like restore drill                   | Proven locally / external open | Miniflare/libSQL, the authenticated deployed-API conformance adapter, and isolated backup/restore tests pass. The release schema now requires distinct desktop/mobile projects plus deployed provider conformance; the clean independent staging and deployed restore receipts are missing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Optional Sanity provider validates portability and hosted visual-editing boundary   | Proven locally / external open | Experimental structural-client adapter plus staging-first official-client conformance gate pass two-block key normalization, draft/save/conflict/publish/unpublish/delete, stable-`_key` source-map, exact-confirmation, partial-cleanup, and secure preview-configuration tests. Its explicit-document global adapter passes the same save/conflict/history/restore contract as D1. The signed webhook edge now proves raw-body verification, strict scope/payload checks, D1 idempotency leases, retry release, retention, and deterministic Cloudflare page purge locally. Hosted receipt schema v3 adds clean full-Git provenance to the document scenario and cleanup. The authenticated Playwright gate binds the parsed v3 receipt, exact HTTPS origins, CHIPS/stega/click-to-edit/no-reload/perspective/responsive checks, cleanup, report, screenshot, and hashes. A final promotion verifier checks both committed schemas, all evidence hashes, strict ancestry, and evidence-only commit intervals. Page scheduling/native history remain fail-closed; no external promotion or webhook-attempt receipt has yet been retained. |
| Block version/migration plus renderer/editor extension without core switch          | Proven locally                 | Template contracts and registries plus the packed CLI scaffold. Its generated block has a literal schema version, neutral envelope, defaults, contiguous migration entry point, fresh-ID seed, renderer/editor registry definitions and machine-readable manifest; the independent consumer executes it without changing core.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Reusable admin workflow with template-specific field UX                             | Proven locally                 | Admin registry, autosave/commands/action/status/revision slots, value-safe stable-ID revision diff metadata with relative-order detection, field-label comparison for standard pages/posts, bounded/coalesced/branch-safe local draft history, plus ADR 0027's neutral live-canvas protocol, responsive canvas, contextual keyboard/drag section moves, template-owned min/max/pinning policy and exhaustive localized discovery catalog, accent-insensitive searchable descriptive pickers on canvas/sidebar, add and duplicate, remove, global canvas undo/redo controls and keyboard shortcuts, pinned-region enforcement, occurrence-safe repeated-block annotations, sidebar fallback, hover identification, and authenticated rendered-surface → mounted-control/catalog/composition/history/revision-compare browser proof across all ten flagship blocks plus standard-page and post lifecycles. Invisible companion metadata remains intentionally inspector-only.                                                                                                                                                                |
| Version-bound editorial review crosses the neutral provider boundary                | Proven locally                 | Core request/decision schemas and capabilities, runtime immutable-event derivation/workflow/conformance, admin presentation/action state, and Cloudflare migration/provider are app-independent. The admin resolver independently requires request and decision grants, so write or publish authority cannot leak into review presentation. D1 conformance proves idempotent request, current-only queue, stale rejection, re-request, required change notes, approval and publication of only the exact approved version; Rèm Việt consumes the neutral derivation/presentation APIs and exact server-issued claims. API and focused Worker E2E prove Editor request without decision/publish/restore. The packed clean consumer installs all eight tarballs and executes the same lifecycle plus the neutral published presentation through public exports.                                                                                                                                                                                                                                                                              |
| Versioned global settings and navigation recovery                                   | Proven locally                 | Generic keyed runtime ports pass identical D1 and structural Sanity conformance; both retain immutable revisions and restore by appending a new version. The human-field Cloudflare admin uses expected versions and confirmation-gated restore; authenticated Worker E2E proves settings restore, navigation public propagation, navigation restore, and exact cleanup.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| CLI plan-init/init/add-block/migrate/rollback/verify as an installed package binary | Proven locally                 | `agency-cms` is declared in the publishable package manifest. The packed consumer loads `@agency/cms-template-rem-viet/bootstrap`, proves plan dry-run/create/repeat, schema-v2 init dry-run/apply with missing-secret output, complete block vertical-slice generation, verification, exact-confirmation migration and receipt-bound rollback without monorepo source. Template ID/version and requested inputs are bound to the plan; mismatches, malformed features, divergent plans/files/receipts and provider failures fail closed. Generated seed, assets, editor/renderer, schema, migrations and neutral registry execute in the consumer.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Semver/schema/compatibility/changelog/migration notes checked in release pipeline   | Proven locally                 | Preparation validates and hashes every record; the guarded publisher revalidates clean provenance/artifacts and emits complete or partial receipts. No actual registry receipt exists.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| N→N+1 and rollback on a non-Rèm consumer                                            | Proven locally                 | Independent upgrade fixture and content/provider receipts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Two paid sites share core and receive a core fix via upgrade                        | External open                  | No paid-site or shared-fix receipts exist                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Installation/template/upgrade/incident/handover/support documentation               | Proven locally                 | `platform-kit-operator-guide.md`, client manual, pilot script, agency runbook                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

The final Track B claim is now mechanically fail-closed rather than a prose
checklist. `cms:kit:v1:verify` requires two parsed restricted-registry
publication receipts and at least two unique paid-site adoption receipts tied to
the same coordinated before/after versions and named core fix. It rehashes every
tracked artifact, checks client and agency approval chronology, binds the
changelog, and permits only evidence-tree changes after the target publication
source commit. The templates deliberately fail until the external commercial
events occur; therefore this closes an evidence-contract gap but does not change
the current `0.1.0` candidate status.

The shared application shell now also exposes one permission-aware command
center across every admin module instead of leaving discovery to nested sidebar
groups. Header click, `Ctrl/Cmd+K`, and Help converge on the same feature-flagged,
role-filtered route registry; accent-insensitive search, arrow/Enter navigation,
focus behavior, empty results and responsive layout pass authenticated desktop
and mobile accessibility E2E. The Editor fixture cannot discover forbidden staff
management through either navigation surface. This is local usability evidence,
not the required unassisted pilot receipt.

The shared dashboard now also opens with a content-operations workspace rather
than commerce reporting alone. Existing page/post API truth drives its total,
draft, scheduled and published counts, recent-change links and feature-aware
authoring actions; explicit loading, provider-error and empty states avoid
invented activity. Desktop/mobile authenticated accessibility E2E covers the
workspace, and authenticated in-app browser inspection confirms its live desktop
composition against real seeded content. This strengthens local operator
evidence but does not satisfy the external pilot or commercial-adoption gates.

The same command surface now searches authorized pages and posts in addition to
module routes, with accent-insensitive matching, workflow-state labels, recent
content, feature/role filtering, explicit degraded behavior and direct editor
links. Standard pages have reload-stable `pageId` URLs instead of requiring the
client to find the row again. Desktop/mobile authenticated accessibility E2E
proves a real seeded post result, and the Editor fixture proves allowed content
remains discoverable while staff management remains absent. This is local
product evidence only, not an unassisted usability receipt.

Standard-page authoring now also satisfies the local preview contract that was
previously stronger on homepage and posts. The editor embeds a capability-aware
Desktop/Tablet/Mobile iframe and sends schema-validated same-origin working-copy
blocks into the actual public block renderer, so unsaved changes are visible
without a second rendering model. A detached authenticated route at
`/admin/pages/:pageId/preview` renders the last saved draft independently with
private/no-store and noindex/nofollow/noarchive controls; the separate-tab label
distinguishes that saved state from the live editor canvas. Authenticated E2E
proves unsaved rendering, mobile width, saved-draft/public isolation, headers,
robots meta, anonymous redirect, independent accessibility, the existing
immutable lifecycle and deterministic cleanup. Build, all 18 typecheck tasks,
26 web unit tests, formatting and diff checks pass. This remains local product
evidence; a fresh authenticated in-app Browser inspection additionally confirms
the clean fixture-free list and honest pre-save responsive-preview state without
creating content. It does not close the human pilot, hosted registry, staging
provenance or paid-client gates.

Ordinary page authoring now also adopts the packaged autosave/flush/conflict
contract rather than stopping at a live canvas. Existing-page edits debounce to
the provider, survive reload, keep dirty/saving/saved/conflict and exact
last-saved state visible, flush before page switching/private-preview, and feed
the saved target version into publish, scheduling, restore and unpublish.
Published slug changes pause autosave for the redirect decision. The focused
authenticated lifecycle creates a genuine stale second-tab write, proves it
cannot silently overwrite, and recovers the latest server state. The signed-in
Browser inspection confirms the clean synchronized create state after exact E2E
cleanup. This strengthens local product parity but does not substitute for the
non-developer pilot.

Standard pages now progress from live preview to direct bounded composition.
Rendered blocks send validated, page-scoped neutral intents for selection,
move, insertion, duplication and removal; selection focuses the real inspector,
the contextual toolbar supports mouse and keyboard activation, and the sidebar
remains the fallback. The separate saved-draft tab is deliberately view-only.
Legacy blocks initially receive deterministic compatibility IDs; the persisted
identity continuation below removes their former position-derived limitation.
The original 1.9-minute authenticated lifecycle proves protocol receipt, the
composition sequence, autosave/reload, two-tab conflict recovery,
private/public isolation, immutable workflow behavior and independent preview
accessibility. It closes the local ordinary-page visual-authoring gap without
changing any external gate.

The renderer also owns exact standard-page field annotations where the rendered
surface truthfully maps to a control: rich text uses `data.content`, while CTA
title and link use `data.title` and `data.href`. Selection focuses the matching
mounted inspector input and canonical authoring blocks preserve their outer
identity when rendered individually. Product-grid remains block-level because
its category/limit configuration is not separately rendered. A fresh
1.3-minute authenticated lifecycle proves mouse and keyboard field paths plus
the complete composition, workflow, security and accessibility sequence.

The 2026-08-17 signed-in Browser fault audit tightened that visual-authoring
claim. Homepage, ordinary-page and post chrome now shares a reusable fail-closed
connection state machine, so an iframe load is not represented as live until a
validated ready handshake arrives; slow/failed frames stay explicit and expose
a safe retry. Ordinary-page messages are bound to the current iframe window in
addition to origin and page scope. The same fresh-runtime run exposed missing
application migration ownership for the provider's `cms_review_events` table.
The typed app schema and additive canonical migration now create the constrained
table and both indexes; the verifier passes all 12 migrations on empty and
upgraded databases. A clean isolated production-Worker ordinary-page lifecycle
then passed in 27.1 seconds through direct field focus and the full immutable
publish/redirect/unpublish cleanup sequence. This is stronger local integration
evidence, not a private-registry, independent-staging or paid-client receipt.

A follow-up signed-in Browser quality pass addressed authoring-space parity,
not another schema feature. At normal desktop width the three-pane flagship
workspace reduced its live page to roughly 24% scale. The homepage application
now adopts a desktop-only focus workspace that retains the provider-neutral
canvas and inspector, hides only the structure rail, locks background scroll,
contains keyboard focus, supports Escape/trigger restoration and closes below
the desktop breakpoint. Browser evidence proves a 1256×696 modal workspace and
the complete enter/exit state transition. The focused axe scan also drove unique
admin/public/preview `main` and toaster landmark labels across homepage,
standard-page and post preview routes. Primary-pointer selection is captured
before animated preview layout can retarget the later click; keyboard-generated
clicks retain exact selection. The fresh production-Worker homepage lifecycle
passes in 16.4 seconds with focused accessibility, exact FAQ field routing and
the existing save/review sequence. This strengthens application adoption of the
neutral visual protocol without satisfying the external pilot or reuse gates.

The same Browser-led product pass upgraded the reference application's asset
intake from a raw file control to a keyboard-operable drag/drop queue. It reuses
the canonical media limits and signature validator before transport, deduplicates
multi-file selections, exposes thumbnails/aggregate size/per-file progress,
supports removal and retry, and collapses a completed batch without hiding its
receipts. The list view keeps alt metadata and its save action together. An
asset-first reusable field now keeps manual URLs under an advanced disclosure and
opens a searchable side-panel picker with shared upload progress/errors,
in-context drop/upload, accent-insensitive full-library discovery and explicit
loading/error/empty states. The neutral admin package now resolves an asset
selection into portable `src`/`alt` values: public image editors adopt reviewed
metadata and clear stale text when absent, while decorative contexts opt into
preservation. An independent axe scan rejected and then verified the corrected
native-button and sibling-input semantics. The isolated production-Worker media
lifecycle passes in 9.3 seconds through a real drop, invalid-file rejection,
failed-request retry, R2 delivery, library discovery, independent picker
accessibility, advanced-URL concealment, picker preflight, accent-insensitive
search, exact selection, reviewed-alt propagation over stale rich-image text,
reference-safe deletion and cleanup. Neutral unit coverage proves missing-alt
clearing and decorative preservation. This improves reference-app UX without
changing neutral provider semantics or satisfying an external reuse gate.

Standard-page pointer composition now matches the flagship canvas rather than
stopping at toolbar arrows. A contextual drag grip marks the rendered source,
candidate blocks expose before/after drop edges, and the drop uses the same
page-scoped neutral move intent; arrow controls remain the accessible fallback.
An isolated Cloudflare lifecycle passes in 29.5 seconds with a real drag reorder
and then exercises autosave/reload, optimistic conflict recovery, immutable
revision behavior, unpublish and cleanup. Public and saved-draft view-only
renders are explicitly proven to contain no drag handle. This strengthens local
editor parity without changing the external pilot or commercial gates.

The ordinary-page editor now consumes the reusable draft-history primitive as
well as the visual protocol. Block content and composition retain a bounded,
coalesced, branch-safe undo/redo history; canvas buttons and Ctrl/Meta shortcuts
drive it, selection is clamped after structural recovery, and an authoritative
server install clears stale local history. The 29.7-second isolated Cloudflare
lifecycle proves drag undo, keyboard redo, CTA field undo/redo, final-value live
preview and autosave/reload persistence, then disabled history controls after
reload before the full conflict/revision/unpublish cleanup. This makes the
reusable-admin history row true for standard pages without substituting for a
human pilot.

Standard blocks now keep stable identities across the entire reference-app
codec rather than only inside their canonical in-memory envelopes. The app
schema accepts legacy rows without IDs, deterministically upgrades missing or
duplicated identities, assigns collision-safe bounded IDs to inserts and
duplicates, and persists them through draft and revision encoding. The visual
canvas therefore targets the same semantic block after reorder and reload.
Forty-four focused contract/template/API tests pass, and the refreshed
production-Worker lifecycle passes in 25.6 seconds while proving distinct
original/duplicate CTA IDs and the original exact ID after drag, autosave and
reload. This closes the recorded persistent-identity caveat without changing
the external pilot, distribution or paid-site gates.

The focused visual workspace is now reusable admin infrastructure rather than a
flagship-only implementation. `useCmsFocusWorkspace` centralizes the desktop
breakpoint guard, body scroll lock, Escape, Tab containment and focus restore.
Homepage, standard-page and post routes compose that behavior with their real
renderer plus mounted inspector/form; standard pages hide only the redundant
structure rail, and neither route creates a second working copy. Both new
dialogs pass independent axe scans. Their complete isolated production-Worker
lifecycles pass together in 52.1 seconds, including an actual below-1280px
automatic exit, and the pre-existing homepage workflow passes again in 15.4
seconds after extraction. This improves local visual-editor parity but does not
substitute for a non-developer pilot.

The standard-page component palette now has one template-owned source of truth.
The Rèm Việt template publishes frozen, exhaustive authoring metadata for rich
text, product grid and CTA: label, description, category and bilingual search
keywords. Both the parent structure surface and contextual canvas composer
intersect that catalog with live composition support and apply the shared
accent-insensitive platform filter; route-local label copies are gone. Thirteen
template-package tests pass. A refreshed 29.4-second production-Worker lifecycle
proves parent search with `keu goi`, contextual canvas search with `van ban`,
accessible dialog semantics, neutral visual insertion and the full immutable
workflow. A fresh signed-in Browser check also showed the three descriptive
cards and reduced unaccented `keu goi` to CTA alone without a save. This closes
the local component-discovery parity gap without changing the external pilot,
hosting or distribution gates.

Nested rich-text composition now follows the same discovery contract instead
of reverting to a hardcoded seven-button toolbar. The template owns immutable,
exhaustive metadata for paragraph, heading, list, quote, image, video and code;
the shared page/post editor provides compact accent-insensitive search with
purpose and category, while post revision summaries use the same labels.
Schema validation, direct insertion and canvas composition share one 500-block
limit. Fourteen template tests pass. The focused production-Worker post flow
finds heading with `tieu de`, proves unrelated results are absent, passes axe
with the catalog open and completes the full lifecycle in 24.6 seconds. That
run also exposed and fixed a focus selector that could choose the new catalog
input over a rendered body field; exact canvas-to-control focus is green again.
The standard-page lifecycle remains green at 29.7 seconds. This improves local
nested-composition parity without affecting external gates.

Nested rich-text blocks now also have persistent identity parity across posts
and standard pages. The shared schema upgrades legacy missing/duplicate IDs
deterministically, preserves unique IDs, and gives direct additions, canvas
insertions and duplicates fresh collision-safe identities. Post inputs and the
nested standard-page provider codec normalize the structured document before
writing it. Preview selection and composition require the exact rendered
snapshot with matching block IDs and indices, rejecting stale or mismatched
pairs; the renderer uses those IDs for keys and annotations. Forty-two CMS,
twenty-four API authorization and seven focused web protocol tests pass. A
24.9-second production-Worker post lifecycle proves four distinct rendered IDs
and the original heading ID across drag, autosave and reload. The independent
29.3-second standard-page lifecycle proves its nested rich-text ID across
provider encoding, autosave and reload. This closes the local position-derived
identity gap without satisfying an external gate.

Post authoring now has explicit working-copy preview parity rather than relying
only on a save-before-new-tab flow. The editor embeds the existing authenticated
private preview route, sends its current typed form snapshot through a
same-origin, parent-scoped channel, and exposes Desktop/Tablet/Mobile profiles.
The route preserves its private/no-store and robots boundary, uses the shared
`PostContent` renderer for structured body output, and falls back to the saved
server draft when opened independently. Exact working-copy annotations cover
date, title, description, cover, tags and structured body; validated
same-origin mouse/keyboard selection identifies the field and focuses the
mounted form control. Structured body wrappers add a contextual grip, truthful
before/after edges, keyboard move, insert-paragraph, duplicate and remove; every
structural command is bound to the exact serialized content snapshot and
matching persistent block IDs plus indices, while the detached draft stays
view-only. Body edits and composition share the bounded
draft history used by the other visual editors: rapid same-block changes
coalesce, structural commands stay discrete, redo branches invalidate on a new
edit, canvas controls plus Ctrl/Meta shortcuts navigate history, and a server
install resets it. A focused 22.6-second Cloudflare lifecycle proves
title/description selection, hover feedback, exact block focus, rendered drag,
bounded composition, composition undo plus keyboard redo, rich-text value
undo/redo, reset after reload, a pristine draft remaining revision-stable beyond
the autosave window, an unsaved marker, exact 390px mobile width,
autosave and navigation flush, two-tab conflict recovery, public isolation,
secure preview, publish, redirect, immutable comparison, restore,
accessibility and exact cleanup. It remains local automated evidence and does
not change any external promotion gate.

Sanity local evidence now goes beyond preview-configuration helpers. The optional
Studio and TanStack edge build with code-owned Hero/FAQ schemas,
provider-compatible `_type`/`_key` encoding, atomic version/audit patches,
native Sanity image selection with rendered crop/hotspot transformations and
portable URL fallbacks, a code-owned asset-to-neutral materializer,
preview-secret validation, HMAC-signed HttpOnly release perspectives,
server-only stega reads, CSP/CHIPS/no-store controls, overlays, navigation sync,
and in-place mutation refetch. This still does not satisfy the row's external
real-dataset schema-v3 or browser-visible Presentation receipt. The local
browser workflow is no longer prose-only: `cms:sanity:presentation` has a
network-free dry run, exact confirmation, clean-checkout provenance, disposable
content, authenticated desktop-Chrome execution, redacted failure output,
cleanup verification, and hashed evidence. No browser pass is inferred until
that command produces its receipt against the named external staging scope.
The network-free promotion verifier then prevents either receipt from being
used after intervening source drift; it emits no technical promotion evidence
until the hosted receipt, Presentation receipt, report, and screenshot are all
committed with the required ancestry and exact digests.
The research-baseline webhook row is no longer satisfied by a boolean alone:
the optional adapter exports the exact filter/projection and a framework-neutral
receiver, while the Rèm edge requires an isolated secret, raw official
signature verification, persistent at-least-once deduplication, and an actual
cache purge. A deployed Sanity attempts-log receipt is still external evidence.

The provider-neutral homepage canvas now also has deterministic navigation
semantics. A signed-in Browser comparison found that selecting the fixed footer
could leave the canvas at Hero and that reselecting an active section emitted no
new observable state. A preview-only sentinel anchors the footer at the true
document end, while the bounded visual-state protocol carries a validated
`selectionRevision` so each explicit selection can retrigger reduced-motion-
aware alignment. A one-shot guarded retry preserves exact inspector focus only
when cross-frame reconciliation temporarily returns focus to the document body,
iframe or intended control. Twenty `cms-admin` tests pass with 85 expectations.
The strict production-Worker homepage lifecycle passed in 16.4 seconds through
exact bottom/top navigation, same-selection retrigger, exact FAQ control focus
and full cleanup. Live Browser verification independently measured
`scrollY=16442` and `fromBottom=0` at `10. CTA cuối trang`. This strengthens the
local visual-authoring contract; it does not satisfy hosted or human evidence.

A further signed-in Browser comparison exposed that homepage focus mode was
still not canvas-first: status and revision cards compressed the live site to a
roughly 200px strip at 36% scale. The focused two-pane workspace now gives the
preview the full left column and layout-hides those supporting cards only until
exit; normal workflow/history access and the single underlying draft remain
unchanged. The final Browser receipt measures an 814×670 preview shell, an
813×580 canvas and 53% desktop-page scale. The refreshed 16.4-second
production-Worker lifecycle enforces 640px/520px minimum shell/canvas heights,
focused accessibility, Escape and trigger restoration, supporting-panel return
and the complete existing workflow. This is stronger local visual-authoring
evidence, not the required hosted or human receipt.

The standard-page create path now exposes its real responsive canvas before the
first save. A reserved in-memory page scope reuses the authenticated preview
route and validated working-copy/selection protocol while disabling the server
page query and withholding the saved-draft external link. It therefore creates
no second document source and no public or independently openable preview. The
focused production-Worker lifecycle passed in 33.0 seconds: it renders the
unsaved CTA, selects its exact parent inspector field, proves through an
independent signed-in page list that no record exists, then verifies the iframe
switches to the persisted page ID and completes the established lifecycle. A
live signed-in Browser receipt measured a 776×485 focus-mode canvas at 54% scale
with the CTA inspector beside it and an empty page list. No save or publish was
performed in that Browser run. This is stronger local create-flow evidence, not
the required hosted or human receipt.

Standard-page recovery now spans the complete working document rather than only
its block array. Title, slug, stable-ID blocks, SEO metadata, social image and
robots controls share one bounded/coalesced/branch-safe history and an exact
installed/saved baseline. Reaching that baseline clears dirty state and the
navigation guard; save completion moves it only to the generation actually
persisted, preserving later edits as dirty. The focused production-Worker
lifecycle passed in 32.0 seconds with metadata undo/redo, clean navigation and
zero persistence before continuing the established provider lifecycle. A live
signed-in Browser check independently undid SEO then page title, returned to the
synchronized state with undo disabled and redo available, navigated to Posts
without a save, and found no temporary page row. This strengthens local editor
recovery semantics without satisfying hosted or human evidence.

Post recovery now has the same whole-document contract. Rich text, title, slug,
description, cover, tags, publish date, SEO metadata, social image and robots
controls share one bounded/branch-safe history with semantic field coalescing
and an exact installed/saved baseline. Undo/redo remounts the complete form
snapshot while retaining live-preview and structured-content bounds; saves move
the baseline only to the submitted generation. The focused production-Worker
post lifecycle passed in 26.0 seconds with title/SEO reverse chronology and
clean restoration added to the established lifecycle. A live signed-in Browser
check independently returned the seeded post to synchronized v2, navigated away
without saving and reopened both original fields unchanged. This strengthens
local cross-editor recovery without satisfying hosted or human evidence.

Global site settings and navigation now complete that recovery contract. Site
identity, contact data, socials, compatibility flags, header menu and footer
menu share one bounded/coalesced/branch-safe working history against the exact
installed or persisted baseline. Undo/redo is chronological across both forms;
baseline equality clears the navigation guard, and internal navigation flushes
only dirty regions. Header/footer provider writes deliberately advance their
baselines independently, preserving truthful retry state after a partial
failure. The focused production-Worker lifecycle passed in 8.5 seconds with
cross-form recovery, clean restoration, save-before-navigation, immutable
restore, public propagation and exact cleanup. Its new accessibility gate found
and fixed a pre-existing h1→h3 outline jump before passing with zero violations.
A signed-in Browser check independently undid header then address, returned to
the synchronized baseline, navigated away and reopened unchanged values. This
closes local global-content recovery parity without supplying hosted or human
evidence.

Global content now also reaches rendered-surface authoring parity. The settings
workspace has a responsive sticky canvas whose private, authenticated preview
route mounts the production Header and Footer rather than a parallel mock. Its
typed message envelope recursively validates menus, accepts only the exact
same-origin parent, retries the working-copy handshake, and locks preview
components to unsaved initial data so background queries cannot replace an edit.
Desktop/mobile modes use real 1280×820 and 390×844 viewports. Two protocol tests
pass, and the extended production-Worker lifecycle passed in 12.1 seconds with
connection, viewport switching, unsaved phone/menu rendering, undo restoration,
accessibility, revision/public propagation and cleanup. A live signed-in Browser
check independently rendered an unsaved header label and restored both canvas
and field through global Undo without saving. This is local portability and
authoring evidence, not hosted or human evidence.

## Current live Track A readiness snapshot

The following checkpoint supersedes the earlier pre-publication snapshots in
this section. At `2026-08-17T03:06Z`, published/local `main` and the exact root
quality run all matched
`f71d096b65b67bf09ee587ed4abadf72f6ae1f7f`. That clean candidate is live on
flagship staging with matching deploy-input identity, all 12 D1 migrations, and
an exact Worker/D1/R2 `noop` post-apply plan. The staging-provenance and
client-ready-workflow gates now pass. The scheduled-backup workflow is exact and
three non-secret variables are configured; only the dedicated token plus manual
and weekly receipts remain for that workflow. The aggregate remains `NOT READY`
for the honest external gaps listed below.

The fail-closed command was run against the documented Rèm Việt staging origin:

```bash
bun run release:readiness --site=rem-viet --stage=staging \
  --origin=https://rem-viet-web-staging.terasumi.workers.dev \
  --profile=default --alerts-profile=alerts
```

2026-08-17 result: `NOT READY`; live prerequisites `BLOCKED`.

- Cloudflare D1 inventory: 10/10 used, no calculated release-slot deficit, and
  three zero-table resources that still require owner review. The audit does not
  authorize deletion.
- Operational alert policy exists, but a real dispatch receipt is missing.
- `CLOUDFLARE_ALERT_EMAIL` is missing from the private environment.
- Field data is below the 75-sample gate: CLS 0, LCP 1, INP 0.
- Staging reports clean, exact matching deployment provenance.
- Deployed email notifications lack `RESEND_API_KEY`,
  `LEAD_NOTIFICATION_EMAIL`, and `EMAIL_FROM`.
- `docs/releases/v1.0.0-client-ready.json` does not exist.
- The release checkout is clean and matches remote `main`.

The aggregate now validates this live scope before repository inspection or any
provider/GitHub child audit is started. It accepts only a safe manifest slug,
exact `staging` stage and origin-only HTTPS URL without credentials, path, query
or hash. The observed production-scope misuse now fails immediately with the
explicit staging requirement instead of a generic nested-audit error; the correct
scope still returns the sanitized snapshot above. Fourteen focused readiness
tests pass. This is local operator-safety evidence, not an external gate receipt.

The private registry environment is also absent:
`CMS_PRIVATE_REGISTRY_URL=false`, `CMS_PRIVATE_REGISTRY_TOKEN=false`.

The same 2026-08-17 boundary was re-audited directly against GitHub. Remote
default branch `main` remains at
`8af868cec3f805411376939c8bf3685864428020`; the local branch is two commits
ahead at `4cc3cbd8246fba098a9e78baa0dd4f6e4129072e`, with additional uncommitted
candidate changes. Neither release workflow is on the remote branch or
registered, the four scheduled-backup settings are absent,
and no manual/weekly receipt exists. The exact root `bun run quality` then
passed end to end locally after fixing the dashboard contrast and
authenticated-E2E selector defects its first run exposed. No commit, push,
external configuration or dispatch was performed. At that checkpoint, the
candidate was locally verified while Track A activation remained blocked on
publication and provider receipts.

Publication was subsequently owner-authorized. Remote `main` reached
`41fbd7eb4493342eef3b8946d255f9845e043b03`, and the read-only audit at
`2026-08-17T02:06:10Z` proves the exact client-ready workflow registered and
active. The backup workflow is exact on default branch but remains not ready
because its dedicated token and both required receipts are absent. Its three
non-secret repository variables are now configured. Pre-push object
inspection excluded an accidental 203 MB installer and generated local-provider
databases from the unpublished range, retained the original tip on local branch
`codex/pre-publication-cms-c8f9224`, and limited the published tree's largest
blob to 7 MB. Removing one unused legacy manifest also reduced the 22 GitHub
dependency alerts exposed by the push to zero; frozen install and both security
audits remain green. Publication therefore closes the repository-activation
step, not the private-registry, provider, staging or human-evidence gates.

## Exact remaining completion sequence

1. Configure an agency-controlled private registry in the release environment,
   run the exact-confirmation guarded publisher for eligible provenance, retain
   its verified eight-package registry receipt, and reinstall the released
   versions into Rèm Việt and an independent repo.
2. Deploy that exact clean commit to independent staging; run
   `site:smoke:staging`, whose exact matrix includes the neutral provider suite
   through the authenticated deployed API in desktop Chrome plus separate mobile
   Chrome navigation and authoring checks; then run receipt-bound
   migration/rollback, backup, immutable archive, isolated restore,
   notification, and alert-dispatch drills.
3. Collect at least 75 qualifying samples for CLS, LCP, and INP and meet the p75
   budgets.
4. Run and attest the unassisted non-developer pilot; complete the schema-v3
   release record only with real receipts.
5. Deliver two independent paid sites on the same released core and ship one
   core fix to both through the documented upgrade path.

Until every step has authoritative evidence, the active goal and stable-1.0
claim remain open.
