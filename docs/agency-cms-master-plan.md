# Agency CMS Platform Kit — Master Plan

> **Core-first scope decision — 2026-08-17.** The active build goal is now the
> CMS product itself: a competitive, code-owned alternative for the agency use
> cases currently served by WordPress and Payload CMS. Product capability is
> evaluated independently from production operations and commercial evidence.
> Backup activation, email delivery, alert receipts, representative RUM,
> registry publication, human-pilot receipts and paid-site adoption remain
> useful release/operations evidence, but they do **not** block the core CMS
> build. When an older status note in this document mixes those concerns, this
> scope decision takes precedence.
>
> The active priority order is:
>
> 1. code-first collections and typed field contracts;
> 2. relationships and reusable globals;
> 3. generated authoring UI on the existing premium workflow shell;
> 4. safe extension hooks/modules;
> 5. localization and portable content APIs/import-export.
>
> Existing visual composition, live preview, click-to-edit, draft/publish,
> scheduling, immutable revisions, restore, media, roles, SEO, audit and
> optimistic conflict protection are the baseline to preserve, not backlog to
> rebuild.

> **Latest verified release checkpoint — 2026-08-17 03:23 UTC.** Published
> `main`, `origin/main`, and the locally verified checkout all resolved to
> `875f941af070af2a41cb2361ad39c10445f90408`; the exact root `bun run quality`
> gate passed on that SHA. The same clean commit was deployed to flagship
> staging with deploy-input SHA-256
> `96dd0b92bfc1c4ccfc6788a7c2da5c68c0fc868c1db9de7fc0c90e740f2ce47c`.
> Live `/api/health` now matches site, stage, commit, input hash, and clean source
> state; D1 contains all 12 canonical migrations and the post-apply Alchemy plan
> is exactly Worker/D1/R2 `noop`. A pre-migration staging export restored in an
> isolated local database with `integrity_check=ok`, 26 tables, exact critical
> row counts, and artifact SHA-256
> `e74cf35bc03fd9fb6417740b1784fa90fff2bc475a5670c00f56f77dfd3f57ca`.
> The client-ready workflow is exact, registered, and active; the scheduled
> backup workflow is exact, and its site/stage/account variables are configured.
> The dedicated least-privilege backup token, manual/weekly receipts, Resend and
> Cloudflare alert recipient/delivery, representative RUM, clean independent
> Acme receipt, non-developer pilot, private-registry publication, paid-site
> adoption, and final schema-v3 record remain external release-readiness
> evidence; they are not blockers for core CMS capability work.

> Trạng thái có hai track độc lập:
>
> - **Track A — Rèm Việt reference implementation:** technical release candidate;
>   M0-M6 và phần kỹ thuật M7 đã triển khai. Isolated second-site runtime smoke
>   đã pass, nhưng clean-checkout evidence, staging pilot, human handover và các
>   receipt vận hành vẫn còn trước tag `v1.0.0-client-ready`.
> - **Track B — CMS Platform Kit:** `KIT-001` đến `KIT-014` và all-block
>   continuation đã pass package boundaries, isolated Miniflare D1 conformance,
>   eight-artifact clean-consumer workflow, ten-block renderer proof và neutral
>   editor dispatch plus autosave/flush/preview primitives. Provider-backed
>   homepage public-read/draft-save/publish/schedule/unschedule/revision/restore
>   routes also pass isolated Acme browser workflows. The reusable D1/R2 media
>   lifecycle also passes packed-consumer conformance and
>   the isolated Acme browser workflow. Ordinary standard pages now have
>   versioned rich-text/product-grid/CTA contracts, registry-based public
>   rendering, and provider-backed create/draft/publish/read/revision/restore/
>   schedule/unpublish/delete workflows plus atomic slug-change redirects proven
>   in Acme. Provider-capability resolution, save-before-command execution, and
>   capability-filtered action composition are reusable and adopted by both page
>   editors. Callable Alchemy resource planning and CLI init/add-block/migrate/
>   verify primitives are packaged and adopted by the live stack/scripts. The
>   CLI is also a real `agency-cms` package binary: strict versioned plans/specs,
>   dry-run init, complete template-owned block vertical-slice scaffolding,
>   artifact verification, and
>   exact-confirmation migrate/rollback with exclusive success receipts plus a
>   recovery file on failure all execute from the packed tarball in the clean
>   consumer. The generated block's versioned envelope, defaults, migration
>   hook, fresh-ID seed, renderer/editor definitions and manifest are
>   typechecked, built and executed through the neutral registry there; template
>   registration remains an explicit non-destructive integration step. Template
>   plans and provider drivers stay outside the neutral package.
>   A schema-v2 bootstrap plan now binds exactly one generated manifest to a
>   provider-neutral core schema: exact kit/template/provider/content versions,
>   locale set, brand/features, HTTPS origin and isolated infrastructure names.
>   The installed binary validates the manifest/site identity before any write
>   and prints the required-secret names still absent from its environment. The
>   packed consumer then parses that exact manifest and uses it to derive the
>   Alchemy staging resources. Schema-v1 init plans remain readable only for the
>   compatibility window.
>   The clean repository no longer has to hand-author that plan: `agency-cms
plan-init` safely loads the packed template's `./bootstrap` export, binds its
>   exact package identity/version and every requested site/provider/preset/
>   feature input, emits a review-only schema-v2 plan, and refuses divergent
>   output. The Rèm Việt initializer supplies manifest, empty env example,
>   all-ten-block draft seed, handover checklist and client-named portable SVG
>   assets. The packed consumer proves plan dry-run/create/repeat, then applies
>   the reviewed artifact.
>   The first client-facing operations quality pass has also replaced the plain
>   Web Vitals card grid with a performance command center: an evidence-backed
>   overall state, trustworthy sample coverage, metric-specific explanations,
>   visible p75 budget markers, scoped filters and audit metadata. It continues
>   to use only the existing real-user summary contract and explicitly renders
>   an empty/insufficient state rather than inventing trends. Typecheck and the
>   production web build pass. Authenticated desktop-Chrome and Pixel-class
>   mobile E2E now prove the command-center semantics, metric/status states,
>   filter validation, disabled invalid actions, zero horizontal overflow and
>   automated accessibility scan. A later signed-in Browser review superseded
>   the initial timed-out visual-inspection attempt; human approval and
>   production RUM receipts remain open.
>   The release-confidence follow-up now turns that diagnostic surface into a
>   fail-closed handover decision without pretending that local health equals a
>   release. An authenticated `audit.read` endpoint joins current deployment
>   provenance and operations health; `/admin/performance` evaluates four
>   independently visible runtime gates: representative Web Vitals, clean and
>   fully identified deployment, notification configuration/delivery health,
>   and database response. Operational-alert dispatch, scheduled-backup and
>   non-developer-pilot receipts remain explicitly outside the runtime score.
>   A signed-in Browser inspection of the actual development runtime correctly
>   showed only `1/4`: under-sampled LCP/INP/CLS, dirty source provenance and a
>   missing email provider stayed red/amber while the database alone passed.
>   Focused authorization tests, both affected typechecks and the production-
>   Worker operations E2E (including accessibility and viewport assertions)
>   pass. This is stronger operator evidence, not a client-ready claim.
>   The non-developer handover is now executable inside the product without
>   weakening that external gate. An `audit.read`-scoped `/admin/handover`
>   workspace refuses to start unless the current runtime is the exact clean,
>   fully identified staging deployment. It guides the eight timed pilot tasks,
>   preserves the single active timer in per-user session storage across admin
>   navigation, captures bounded
>   confusion/issue/KPI observations and exports a verifier-shaped observer
>   draft. The export deliberately leaves tester approval and final recording
>   timestamps blank, so the CMS cannot self-issue a pilot receipt. Unit tests
>   cover provenance, timer, completion and export boundaries; authenticated
>   production-Worker E2E proves route discovery, fail-closed non-staging UX,
>   accessibility and no overflow, while the Editor scenario proves the route
>   stays absent without `audit.read`. A signed-in Browser inspection showed
>   `dev-terasumi · source dirty`, `0/8` and a disabled start action as required.
>   A real non-developer still has to run and approve the clean staging pilot.
>   The follow-up performance-intelligence pass now makes that command center
>   diagnostic instead of merely presentational. Its additive summary contract
>   returns the preceding equal-length p75/sample baseline, top measured public
>   routes and device facet counts. The UI exposes honest improvement/regression
>   context, exact remaining sample runway, metric-specific investigation cues
>   and one-click route discovery; absent baselines remain explicit instead of
>   becoming synthetic trends. Signed-in interaction proved the route filter on
>   the running app. That Browser review also caught `/admin/*` reports leaking
>   into a dashboard labelled public traffic. The shared contract, reporter,
>   ingestion validation, admin summary/facets and remote release-audit SQL now
>   all fail closed for admin, API, sign-in and preview paths while preserving
>   explicit synthetic probes outside release evidence. Local mixed telemetry
>   dropped from 11 reports to the correct three public reports after the fix.
>   A second shared-admin quality pass adds a permission-aware command center to
>   every CMS route. The header, `Ctrl/Cmd+K`, and the former inert Help action
>   now open the same searchable workspace; matching is accent-insensitive,
>   current-route aware, feature-flagged and filtered by the active staff role.
>   Arrow/Enter navigation, focus management, honest empty results and responsive
>   presentation pass authenticated desktop/mobile E2E plus an automated
>   accessibility scan. A dedicated Editor scenario proves forbidden staff tools
>   remain absent from both sidebar and command search. This improves operator UX
>   without weakening server-side authorization or replacing the human pilot.
>   The main dashboard now also leads with a real editorial pulse instead of
>   opening on commerce reporting alone. It derives page/post draft, scheduled
>   and published counts plus recent changes from the existing content APIs, and
>   provides direct, feature-aware paths into the home canvas, post authoring and
>   media library. Loading, provider-error and genuinely empty states remain
>   explicit. Authenticated desktop/mobile E2E verifies the metrics, actions,
>   responsive presentation and automated accessibility scan. A subsequent
>   authenticated in-app browser inspection confirmed the live desktop
>   composition and real seeded content. This is still developer-led product
>   evidence, not the outstanding non-developer pilot.
>   The global command center now searches the permitted editorial corpus as
>   well as CMS modules. It loads page/post truth only for roles with draft-read
>   capability, keeps blog results behind the site feature flag, normalizes
>   Vietnamese accents, shows draft/scheduled/published state, and links directly
>   into the home, standard-page and post editors. Recent content is useful before
>   a query, while provider failure leaves route navigation available with an
>   explicit degraded message. Standard-page selection is URL-addressable and
>   survives reload. Authenticated desktop/mobile E2E proves a real seeded-post
>   result and automated accessibility; the Editor fixture can discover allowed
>   content but still cannot discover staff management. The local `:3001` runtime
>   was restored to HTTP 200 after stale E2E artifacts, but the browser-control
>   channel timed out during the subsequent palette inspection, so no new visual
>   screenshot is claimed for this pass.
>   The standard-page editor now has the same premium preview contract as the
>   flagship workflows: a capability-filtered responsive Desktop/Tablet/Mobile
>   canvas streams schema-validated, same-origin working-copy blocks into the
>   actual public renderer without requiring a save, while an independently
>   addressable saved-draft route requires an admin session and emits private,
>   no-store, noindex/nofollow/noarchive controls. TanStack's detached file-route
>   convention preserves `/admin/pages/:pageId/preview` without nesting the
>   editor inside the iframe. The authenticated desktop lifecycle proves the
>   unsaved marker in the iframe, mobile profile, saved-draft/public isolation,
>   response/meta robots controls, anonymous redirect, independent automated
>   accessibility scan, publish/revision/redirect/unpublish behavior and exact
>   cleanup. Interrupted `Standard provider <8-hex>` fixtures are cleaned before
>   reruns. Production build, 18 typecheck tasks, 26 web unit tests, formatting
>   and diff checks pass. A fresh authenticated in-app Browser inspection also
>   confirmed the clean no-page state and the honest pre-save responsive-preview
>   guidance; no temporary content was created. This is local technical evidence,
>   not a human pilot or hosted commercial receipt.
>   The same standard-page workflow now closes its draft-safety gap. Existing
>   pages use the neutral trailing autosave primitive, retain the editor after
>   persistence, expose dirty/saving/saved/conflict plus second-level last-saved
>   time, flush before internal page switches and separate-tab preview, and run
>   publish/schedule/restore/unpublish against the exact saved version. A
>   published slug change pauses autosave until the 301 decision is explicit.
>   The focused desktop lifecycle proves autosave survives reload and a second
>   authenticated tab receives an optimistic conflict instead of overwriting,
>   then recovers the latest server version. A fresh signed-in Browser inspection
>   confirmed the clean create state and visible synchronization status after the
>   runtime restart; no fixture content remained.
>   Ordinary standard pages now also use the neutral visual-authoring protocol
>   instead of treating the responsive iframe as view-only. Clicking a rendered
>   block selects and focuses the real inspector; a contextual toolbar can move,
>   insert, duplicate and remove the bounded rich-text/product-grid/CTA set, with
>   mouse and Enter/Space paths and the sidebar retained as the accessible
>   fallback. The saved-draft route opened in a separate tab intentionally stays
>   view-only. The page-scoped, same-origin intent envelope is validated before
>   dispatch; legacy standard blocks still receive deterministic position-based
>   visual IDs for the current working copy, not a false persistent-ID guarantee.
>   The focused authenticated lifecycle passed in 1.9 minutes and proves canvas
>   protocol receipts plus composition, autosave/reload, genuine two-tab
>   conflict recovery, draft privacy, publish/revision/redirect/unpublish and the
>   independent preview accessibility scan. This closes the local standard-page
>   canvas parity gap identified against Sanity/Storyblok-style component visual
>   editing; it does not close the non-developer or hosted commercial gates.
>   The standard renderer now owns truthful field annotations as well as block
>   selection. Rendered rich-text content emits `data.content`; the CTA heading
>   and rendered link emit `data.title` and `data.href`, and each intent focuses
>   the exact mounted inspector control. Product-grid selection remains
>   block-level because category and limit are configuration, not distinct
>   rendered fields. The canonical authoring block is passed into the renderer so
>   legacy position-derived IDs cannot drift when a block is rendered alone. A
>   fresh 1.3-minute lifecycle proves mouse link → href control, Enter title →
>   title control, exact field-path receipts and the complete workflow/a11y gate.
>   A later signed-in Browser fault audit caught a false-positive canvas status:
>   the editor chrome could say live before a child-frame handshake while the
>   homepage iframe was actually failing on stale development-module state. All
>   three embedded editors now consume one reusable fail-closed connection
>   state machine (`connecting`, handshake-proven `connected`, or `delayed`),
>   show a safe reload action on delay and claim direct synchronization only
>   after the validated ready message. Standard-page intents are additionally
>   pinned to the current iframe window as well as origin/page scope. Browser
>   inspection proved amber connecting first and green only after the real
>   handshake; reducer tests cover load, timeout, ready and retry.
>   The resulting fresh-D1 production-Worker run uncovered and closed a second
>   integration gap: the neutral Cloudflare provider's review table had never
>   entered the app's canonical Drizzle migration stream. Typed
>   `cms_review_events` ownership and additive migration `0011_real_iron_lad`
>   now match the provider contract. The verifier applies all 12 migrations to
>   empty and upgraded fixtures and asserts both review indexes. The complete
>   standard-page lifecycle then passed in 27.1 seconds through field focus,
>   publish, immutable revision, redirect, unpublish and cleanup. This strengthens
>   local fresh-deploy evidence without changing any external gate.
>   A second signed-in Browser quality pass compared the running flagship editor
>   with the research baseline and found that the complete three-pane workspace
>   compressed the actual canvas to roughly 24% at a normal desktop width. The
>   homepage now has a desktop-only focus workspace that keeps the live canvas and
>   inspector together, hides only the structure rail, locks background scroll,
>   traps focus, exits with Escape, restores the trigger and auto-closes below the
>   desktop breakpoint. Browser evidence measured a 1256×696 modal workspace and
>   proved the structure/scroll/focus transitions in both directions. The new
>   focused-workspace accessibility scan also exposed duplicate unnamed parent/
>   iframe landmarks; route-aware `main` and toaster labels now distinguish admin,
>   public and every preview surface. Preview selection now commits on primary
>   `pointerdown` before an animated layout shift can retarget the click, while
>   detail-zero click handling preserves Enter/Space selection. The isolated
>   production-Worker homepage workflow then passed in 16.4 seconds, including
>   focus-mode accessibility, exact FAQ question → inspector routing and the
>   existing save/review lifecycle. This is local product evidence only; pilot,
>   hosted, release and commercial receipts remain open.
>   The next signed-in Browser comparison found a second product-quality gap:
>   the proven R2/media workflow still entered through a raw browser file input.
>   The Media Library now exposes a keyboard-operable drag/drop ingest surface
>   with multi-file deduplication, shared client/server type, signature, file,
>   count and batch-size validation, thumbnail queue, aggregate size, per-file
>   progress/removal/retry and a compact completed-batch state. List metadata
>   saving now sits beside the alt field instead of in the notification collision
>   zone. The reusable field now defaults to a selected/empty asset card and a
>   searchable side-panel picker; manual URLs live only under an advanced
>   disclosure. The picker shares upload transport, progress and errors, supports
>   in-context drop/upload, accent-insensitive discovery, full-library results and
>   explicit loading/error/empty states. Its neutral selection contract now carries
>   reviewed asset metadata into homepage and rich-text image fields: public images
>   adopt the trimmed library alt (and clear stale text when metadata is missing),
>   while explicitly decorative images preserve their contextual value. The first
>   independent axe pass rejected a
>   nested hidden input; the
>   final native-button plus sibling-input structure passes. A fresh isolated
>   production-Worker lifecycle passed in 9.3 seconds through real drag/drop,
>   invalid-file rejection, library and picker accessibility, aborted-network
>   retry, R2 delivery, filters/views, alt update, advanced-URL concealment,
>   invalid picker-upload preflight, accent-insensitive search, exact picker
>   selection, reviewed-alt propagation over stale rich-image text, reference
>   protection and cleanup. Neutral unit coverage separately proves missing-alt
>   clearing and decorative preservation. No external receipt or capability
>   expansion is inferred.
>   A non-Rèm eight-package `0.1.0` → `0.2.0-rehearsal.1` install/migrate/
>   rollback preserves D1 drafts, immutable revisions, media metadata, and object
>   bytes. A fail-closed private-release bundle records coordinated package
>   digests and Git/lock/compatibility provenance. Its separate exact-confirmation
>   publisher revalidates the clean checkout and artifacts, disables package
>   lifecycle scripts, and emits complete or partial verification receipts;
>   no registry write has been claimed locally. Admin action, draft-status, and
>   revision-list
>   composition is packaged while localized layout/tRPC remain app adapters.
>   The flagship homepage now also proves a provider-neutral visual-authoring
>   protocol: the rendered page is the primary responsive canvas, unsaved block
>   state streams into the preview without reload, section selection flows back
>   to the inspector, and a contextual on-canvas toolbar plus direct drag target
>   moves share one neutral intent while preserving pinned template regions.
>   The template now publishes min/max cardinality and pinning for every block;
>   canvas and sidebar add, duplicate and undoable remove actions consume the
>   same neutral intents and issue fresh stable IDs for repeated instances. The
>   reusable admin layer now also provides bounded, branch-safe draft command
>   history: rapid field edits coalesce, all block/composition changes can be
>   undone or redone from the canvas chrome or keyboard, and loading a newer
>   server draft resets local history. The sidebar tree remains the accessible
>   fallback. Component discovery is now template-owned as an exhaustive
>   localized catalog (label, purpose, category and keywords); sidebar and
>   canvas intersect it with live composition limits and provide
>   accent-insensitive searchable choices instead of duplicated app labels or a
>   name-only select. Revision comparison lets an editor expand an immutable
>   published revision before restore across homepage, standard-page and post
>   workflows. The flagship editor reports added, removed, edited and truly
>   reordered stable-ID sections plus changed page/SEO metadata against the live
>   working draft, including unsaved canvas changes. Revision review is now a
>   first-class, discoverable action in all three editors rather than a control
>   buried below long forms. Standard-page and post workflows render accessible
>   side-by-side `Phiên bản`/`Bản nháp` cards with explicit, normalized and
>   160-code-point-bounded summaries. Public editable values such as slugs, CTA
>   copy/links and rich-text excerpts are opt-in; media references, arbitrary
>   structured payloads and internal metadata fail closed to a presence-only or
>   hidden-detail state. Legacy snapshots are schema-normalized before comparison,
>   preventing absent historical SEO defaults from becoming false changes. A
>   signed-in Browser review proved the shortcut and caught that compatibility
>   defect; package coverage and the focused post/standard-page Cloudflare
>   lifecycles prove exact old/new slug and CTA values plus accessibility. The
>   neutral diff primitive remains backward compatible and rejects duplicate
>   stable IDs.
>   Editorial handoff is now explicit instead of relying on chat or a hidden
>   publish permission. Homepage, standard-page and post editors share one
>   version-bound review panel: an Editor can save and request review, while
>   only Admin/Owner can approve or request changes and publication remains a
>   separate `content.publish` capability. Requests and decisions are immutable,
>   privacy-bounded audit events; any intervening edit marks the prior request
>   stale, and only the approved draft immediately followed by publication is
>   shown as resolved. The dashboard exposes a ranked, uncapped-by-audit-volume
>   reviewer queue. API tests retain the forged-Editor decision/publish boundary,
>   a signed-in Browser run proved request → queue → approval on the seeded post,
>   and a fresh production-Worker E2E repeated the lifecycle on a disposable
>   page with accessibility and exact cleanup. This is local workflow evidence,
>   not the outstanding non-developer pilot.
>   That workflow is no longer a flagship-only implementation. `cms-core` now
>   owns bounded provider-neutral request/decision schemas plus separate request
>   and decision capabilities; `cms-runtime` owns immutable event derivation, a
>   small review port and an executable conformance lifecycle; `cms-admin` owns
>   the presentation/action state machine while each client retains its labels
>   and visual design. Cloudflare migration `0005_editorial_reviews` adds guarded
>   D1 event writes and a ranked queue, and the page provider records exact
>   approval resolution in the same publish batch. The conformance test proves
>   idempotent request, stale exclusion, re-request, required change notes,
>   approval and exact-version publication. Rèm Việt consumes the shared
>   derivation/presentation APIs; stale requests are no longer left in its queue.
>   The packed clean-consumer harness installs the eight tarballs and executes
>   the same review conformance plus the admin `published` presentation state,
>   proving this slice through public artifacts rather than workspace imports.
>   A follow-up authorization audit removed the last broad-permission shortcut.
>   Editor policy now grants `content.review.request` explicitly; queue and
>   decisions require `content.review.decide` instead of borrowing publish
>   authority, and the shared admin resolver requires separate request and
>   decision grants. Rèm Việt sends server-issued capability claims to every
>   review panel and keeps publish presentation independent. API coverage checks
>   the exact missing capability, the packed consumer reruns the public contract,
>   and focused production-Worker E2E passes both the owner/admin lifecycle and
>   Editor request-without-decision/publish/restore boundary. This hardens local
>   least privilege; it does not invent a reviewer-only role or close the human
>   pilot and hosted-release gates.
>   Stable schema field paths now cover every distinct rendered editing
>   surface registered by all ten flagship blocks: copy, title lines, media,
>   CTA/link regions, icons, statistics, measurement overlays, accessibility
>   labels and repeated items. A floating hover label identifies the destination
>   before selection; authenticated E2E proves every annotation renders and every
>   registered control mounts. Invisible metadata (for example image alt text,
>   internal media IDs and crop/format companions) remains in the adjacent
>   inspector by design rather than pretending to have a separate canvas hit
>   target. Standard-page composition now has the same direct drag affordance
>   as the flagship canvas: a contextual grip starts a real rendered-block drag,
>   every target shows a truthful before/after insertion edge, and drop emits
>   the existing page-scoped neutral move intent. Arrow controls remain the
>   keyboard fallback, while public and saved-draft view-only renders expose no
>   drag handle. A fresh isolated Cloudflare lifecycle passed in 29.5 seconds
>   with drag reorder followed by autosave/reload, two-tab conflict recovery,
>   immutable revision workflow, unpublish and exact fixture cleanup. This is
>   local product evidence, not a non-developer pilot. Standard-page block
>   content and composition now also use the shared bounded command history
>   instead of making direct manipulation irreversible. Rapid edits coalesce,
>   new edits clear the redo branch, canvas buttons expose undo/redo, Ctrl/Meta
>   shortcuts work outside native text controls, and an authoritative server
>   reload resets local history. The isolated lifecycle passed in 29.7 seconds,
>   proving drag undo, keyboard redo, CTA value undo/redo and reset after
>   autosave/reload before conflict/revision/unpublish cleanup.
>   Post authoring now has an embedded Desktop/Tablet/Mobile working-copy
>   preview too. The editor sends the current typed form snapshot through a
>   same-origin, parent-scoped message into the existing authenticated
>   private/no-store preview route, which retains the shared `PostContent` body
>   renderer and falls back to the saved server draft when opened separately.
>   This means title, description, cover, tags and structured body changes are
>   visible before autosave without weakening form validation or preview
>   security. The working-copy canvas also annotates date, title, description,
>   cover, tags and structured body as exact selectable fields. Mouse or
>   keyboard selection shows the field label, returns a validated same-origin
>   intent and focuses the real mounted form control. Structured body blocks now
>   add the same bounded composition vocabulary: a contextual grip, truthful
>   before/after drop edges, keyboard move controls, insert-paragraph, duplicate
>   and remove. Every canvas command carries the exact serialized content
>   snapshot plus the persistent source/target block identities it was rendered
>   from, so stale index/ID pairs are rejected before the mounted editor applies
>   them; the detached saved draft exposes none of
>   these hooks. Post body edits and composition now use the shared 50-entry
>   bounded draft history too: rapid edits to one block coalesce, structural
>   commands remain discrete, new edits invalidate redo, canvas buttons plus
>   Ctrl/Meta shortcuts navigate history outside native text controls, and an
>   authoritative server install resets the stack. A 22.6-second isolated
>   Cloudflare lifecycle proves exact block focus, a real rendered-block drag,
>   insert/duplicate/remove, composition undo plus keyboard redo, rich-text
>   value undo/redo, reset after autosave/reload, title/description selection,
>   hover identification, a
>   pristine draft staying revision-stable beyond the autosave window, an
>   unsaved marker, a real 390px mobile viewport, autosave and
>   navigation flush, two-tab conflict recovery, no-store/noindex controls,
>   publish, redirect, immutable revision comparison, restore, accessibility
>   and exact cleanup. This remains automated local product evidence, not a
>   human usability or hosted-release receipt. An experimental
>   `@agency/cms-provider-sanity` vertical slice now
>   proves a second provider boundary locally: perspectives, stable `_key`
>   encoding, revision-guarded saves, native publish/unpublish/delete actions,
>   secure preview overlays and Presentation configuration. The optional
>   `apps/studio` consumer now makes that configuration executable with
>   code-owned Hero + FAQ schemas, provider-owned document creation, atomic
>   portable version increments, current-user audit metadata, and native Sanity
>   asset selection with crop/hotspot controls plus migration-free portable URL
>   fallbacks. A code-owned GROQ selection plus Sanity's official image URL
>   builder applies the saved crop/hotspot and materializes native assets back
>   into the neutral `{src, mediaId, alt}` and SEO contracts. The TanStack
>   edge validates Sanity's preview secret, adds a separately signed HttpOnly
>   perspective session (including Content Releases), performs server-only
>   stega draft reads, constrains iframe framing, and refreshes the React canvas
>   in place on mutations without exposing the token. The previously
>   declarative webhook capability is now executable: an official raw-body
>   signature verifier pins project/dataset/document headers, rejects stale or
>   non-published events, persists Sanity idempotency keys and processing leases
>   in D1, releases failed work for retry, and purges deterministic Cloudflare
>   page keys. A delete-safe exported GROQ projection, bounded payload contract,
>   30-day delivery retention and server-only dedicated secret make publish →
>   revalidation an auditable adapter boundary rather than an optimistic flag.
>   A template codec supplies
>   the `_type` and stable `_key` identities required for provider-created
>   documents to remain Studio-editable. A staging-first
>   hosted-conformance gate now wires the official client at the executable
>   edge, requires an exact project/dataset/document confirmation, exercises a
>   disposable two-block lifecycle plus stable-`_key` Content Source Maps,
>   runs the neutral global-content create/conflict/history/restore scenario,
>   cleans the page plus every global revision on partial or successful runs,
>   and writes an exclusive complete receipt only after every check passes. Page
>   scheduling/history remain fail-closed. A separate clean-checkout browser
>   gate now consumes that clean-Git schema-v3 hosted receipt, authenticated Git-ignored
>   Playwright state and an exact confirmation; it seeds disposable Hero + FAQ
>   content, proves the HTTPS Presentation handshake, secure partitioned iframe
>   cookies, stega overlay, click-to-edit, no-reload live mutation, published/
>   draft perspectives and responsive controls, rechecks document/secret
>   cleanup, then binds the Git SHA, hosted receipt, report and screenshot hashes
>   in an exclusive versioned receipt. The runner is implemented and tested
>   locally. A final network-free promotion verifier parses both committed
>   receipts, rehashes all four evidence files, checks strict Git ancestry and
>   permits only evidence-path changes between proof commits before emitting a
>   promotion-readiness receipt. It never changes the package version itself.
>   An actual hosted dataset + browser-produced Presentation receipt is still
>   required before this adapter joins the stable release set.
>   The CLI now also packages exact-confirmation, backup-before-apply migration
>   orchestration with per-step verification and receipt-bound rollback; the
>   non-Rèm rehearsal adopts it. Installation, template authoring, upgrade,
>   incident, handover, commercial support, SLA, and deprecation boundaries are
>   consolidated in the Platform Kit operator guide. The second-site staging
>   gate now runs the same neutral Cloudflare page-provider lifecycle through the
>   authenticated deployed API and fails closed unless four desktop plus two
>   distinct mobile Playwright checks pass; its release schema records both
>   device projects and provider conformance explicitly. The local
>   Cloudflare-compatible proof passes, but the exact clean independent staging
>   receipt is still external. Site settings and header/footer navigation now
>   cross a provider-neutral keyed global-content contract with optimistic
>   versions, immutable history, restore-as-new-version semantics and D1
>   conformance. The existing human-field admin exposes all three histories;
>   authenticated Worker E2E proves settings/navigation edits, public navigation
>   propagation and exact recovery without JSON or database access. The
>   experimental Sanity adapter now passes the identical global-content
>   conformance over explicit Sanity documents and `_rev` guards, proving the
>   port against a second storage model locally. The hosted verifier now includes
>   that same global conformance, but its real-dataset receipt remains external.
>   Remaining deployed
>   production execution, independent staging và private registry receipts vẫn còn
>   trước stable `1.0`.
>   Track B now also has one fail-closed `cms:kit:v1:verify` evidence gate. It
>   parses two coordinated private-registry publications, requires at least two
>   unique paid-client adoption/upgrade receipts for the same named core fix,
>   binds opaque engagement/support/repository fingerprints, provider/restore/
>   admin/handover checks and client approvals, and rejects source drift after
>   the `1.0.0` publication commit. The verifier and intentionally invalid
>   templates are local; the registry, paid-site, upgrade, and commercial
>   approvals remain external and have not been claimed.
>   Requirement-by-requirement evidence and the current live blocker snapshot are
>   tracked in `docs/cms/platform-kit-v1-completion-audit.md`.
>
> Ngày cập nhật mục tiêu sản phẩm: 2026-08-17
>
> Reference implementation đầu tiên: Rèm Việt
>
> Mục tiêu gần nhất của Track A: `v1.0.0-client-ready`
>
> Mục tiêu sản phẩm cuối: `Agency CMS Platform Kit v1.0` dùng được cho nhiều
> website khách hàng mà không copy/paste hoặc fork toàn bộ Rèm Việt.
>
> Ma trận nghiệm thu Track A: `docs/cms/v1-completion-audit.md`

## 1. Tuyên bố sản phẩm

Xây một **Agency CMS Platform Kit**: bộ package, runtime contracts, provider
adapters, admin shell, template SDK, infrastructure module và CLI để agency tạo,
vận hành và nâng cấp nhiều website khách hàng từ cùng một nền tảng sản phẩm.

Rèm Việt không phải sản phẩm cuối. Rèm Việt là **reference implementation đầu
tiên**, proving ground cho Cloudflare-native provider và flagship template đầu
tiên. Một capability chỉ được coi là thuộc Platform Kit khi nó được đặt sau API
ổn định, có test contract, cài được vào consumer độc lập và không phụ thuộc vào
brand/data/component riêng của Rèm Việt.

Mỗi website khách hàng vẫn có frontend riêng, chất lượng thiết kế cao, nhưng
khách tự quản lý nội dung qua `/admin` mà không cần sửa code hoặc deploy lại.

Đây không phải WordPress clone, không phải SaaS multi-tenant, và không phải một
page builder cho phép tùy ý sửa DOM/CSS. Sản phẩm là một hệ thống content có cấu
trúc, trong đó agency kiểm soát layout và animation, còn khách hàng kiểm soát
nội dung trong những vùng đã được thiết kế an toàn. Platform Kit là **internal
product/IP của agency trước**, không cần trở thành public npm library để chứng
minh giá trị kinh doanh.

### North star

Từ một repository sạch, agency cài Platform Kit, chọn preset/provider, nhận logo,
brand guideline và nội dung rồi đưa một website riêng biệt lên production trong
tối đa hai ngày. Sau bàn giao, khách tự sửa được ít nhất 90% nội dung thường
xuyên mà không cần developer; agency có thể nâng cấp core mà không phải merge
lại một fork Rèm Việt hoặc viết lại CMS cho từng khách.

### Core-first competitive target

The goal is not feature-count parity with every WordPress plugin or every
Payload deployment option. The goal is to combine WordPress's practical content
model extensibility with Payload's code-first type safety while keeping the
visual, design-constrained authoring experience already proven by Rèm Việt.

| Competitive surface                               | Core target for Platform Kit                                                                                          | Status                                  |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| WordPress custom post types / Payload collections | A code-first collection registry with stable slugs, labels, access rules and versioned schemas                        | **Active next milestone**               |
| Custom fields / Payload fields                    | Typed text, rich text, number, boolean, date, select, media, blocks and relationship contracts with shared validation | **Active next milestone**               |
| Relationships and reusable data                   | Typed to-one/to-many references plus globals, integrity checks and authoring pickers                                  | **Active next milestone**               |
| Gutenberg / Payload Live Preview                  | Bounded visual composition, responsive draft canvas, click-to-edit and exact inspector focus                          | Implemented                             |
| Drafts, versions and publishing                   | Draft isolation, autosave, schedule, publish, immutable revisions, restore and conflict protection                    | Implemented                             |
| Media and permissions                             | R2 media lifecycle, reference-safe delete, alt policy, owner/admin/editor enforcement and audit                       | Implemented                             |
| WordPress plugins / Payload hooks                 | Safe, typed feature modules and lifecycle hooks; no arbitrary runtime code installed by editors                       | Planned after collection vertical slice |
| Localization                                      | Locale-aware fields/documents, preview and independent publication state                                              | Planned                                 |
| REST/Local API and portability                    | Typed server SDK, bounded REST resources and schema-aware import/export                                               | Planned                                 |

Explicit non-goals remain a public plugin marketplace, arbitrary PHP/JS/CSS,
free-form Elementor-style layout editing, multi-tenant SaaS and automatic
GraphQL generation before a real consumer requires it.

### Mô hình triển khai được chốt

- Một **versioned Platform Kit** được duy trì bởi agency; starter/template chỉ là
  một consumer của kit, không phải source of truth duy nhất.
- Mỗi khách có repository sản phẩm riêng; không dùng long-lived client branch
  trong repository Rèm Việt làm mô hình mặc định.
- Mỗi khách có Worker, D1 database, R2 bucket, secrets và domain riêng.
- Không dùng chung dữ liệu hoặc tài khoản giữa các khách.
- Bắt đầu extraction theo strangler pattern ngay từ reference implementation,
  nhưng giữ package ở `0.x`/private cho đến khi clean consumer và upgrade proof
  pass. Không generalize feature chưa có use case lặp lại.
- Cloudflare D1/R2 là provider reference đầu tiên. Provider khác là capability
  riêng, không được làm loãng contract core hoặc chặn release provider native.

## 2. Kết quả kinh doanh cần đạt

Sản phẩm chỉ được coi là thành công khi đồng thời đạt năm kết quả:

1. **Khách dùng được:** một content editor không biết code có thể sửa trang chủ,
   bài viết, hình ảnh, menu, SEO và publish mà không nhìn thấy JSON.
2. **Agency giao nhanh:** một site mới có thể khởi tạo, đổi brand, seed demo và
   deploy trong một buổi làm việc.
3. **Không hy sinh thiết kế:** GSAP, layout tùy biến và chất lượng flagship không
   bị giới hạn bởi editor.
4. **Vận hành an toàn:** draft không lọt ra public, có revision/restore, backup,
   audit log và quy trình nâng cấp rõ ràng.
5. **Reuse tạo margin:** site mới tiêu thụ package/version của Platform Kit,
   không copy implementation từ site cũ; fix core có đường nâng cấp kiểm chứng
   được sang các client repository đang được agency bảo trì.

### Mô hình kinh doanh

- **Phí dự án:** discovery, design, theme/block riêng, content migration và launch.
- **Phí vận hành định kỳ:** hosting, backup, monitoring, security update, support
  và nâng phiên bản Platform Kit.
- **Add-on:** catalog/commerce, localization, integration nghiệp vụ, analytics
  hoặc visual editing provider cao cấp khi khách thực sự cần.
- **Không bán quyền tự do phá layout:** phạm vi editor và số block/template tùy
  theo hợp đồng; custom development vẫn là dịch vụ có phí.
- **Không SaaS hóa sớm:** mỗi khách tiếp tục có hạ tầng cô lập; chỉ xem xét
  multi-tenant control plane khi doanh thu và chi phí vận hành chứng minh nhu cầu.

### KPI cho `v1.0 Client Ready`

| KPI                                         |     Target |
| ------------------------------------------- | ---------: |
| Thời gian tạo một site mới đến staging      |   <= 2 giờ |
| Thời gian đổi brand + nhập content mẫu      |  <= 1 ngày |
| Nội dung thường xuyên khách tự sửa được     |     >= 90% |
| Thời gian đào tạo editor                    | <= 30 phút |
| Publish đến khi public thấy thay đổi        | <= 10 giây |
| Khôi phục một revision                      |  <= 5 phút |
| Draft bị public nhìn thấy                   |          0 |
| Site/client dùng chung database hoặc bucket |          0 |

### KPI cho `Agency CMS Platform Kit v1.0`

| KPI                                                    | Target                                    |
| ------------------------------------------------------ | ----------------------------------------- |
| Consumer độc lập cài kit mà không copy source Rèm Việt | 100%                                      |
| Thời gian từ clean repo đến staging                    | <= 2 giờ                                  |
| Template/provider code import brand Rèm Việt           | 0 trong package neutral                   |
| Provider reference conformance suite                   | 100% pass                                 |
| Nâng một consumer từ version N lên N+1                 | <= 1 buổi, có migration/rollback evidence |
| Site trả phí chạy cùng core versioned                  | >= 2 trước stable `1.0`                   |
| Fix core cần copy/paste thủ công sang từng site        | 0                                         |
| Breaking change không có migration note/codemod        | 0                                         |

## 3. Baseline hiện tại

Repo đã có một CMS V1 thực tế, không còn là prototype trắng. Theo audit ngày
2026-08-15, implementation local, automated critical paths, isolated Acme
runtime và phần lớn M0-M7 đã hoàn thành. Các external receipt còn thiếu thuộc
release authorization của Track A, không phủ định capability kỹ thuật đã có.

Capability kỹ thuật không còn chỉ nằm trong một app monolith: neutral core,
runtime, provider, React/admin, template, Alchemy và CLI package boundaries đã
được tách và pass packed-consumer/upgrade rehearsal. Tuy nhiên, **workspace package
và local fixture không đồng nghĩa với product release**. Private-registry
publication, clean independent staging provenance, two-paid-site adoption và một
core upgrade thực vẫn là các bằng chứng bắt buộc trước stable `1.0`.

### Đã có và nên giữ

- TanStack Start, React, tRPC, TanStack Query.
- Cloudflare Workers, D1 và R2 qua Alchemy.
- Drizzle schema/migrations.
- Better Auth, tắt public sign-up, admin allowlist qua `ADMIN_EMAILS`.
- Admin shell và CRUD cho products, categories, inventory, orders, logs.
- Content schema cho posts, pages, media, menus và site settings.
- Draft/published cho posts và pages.
- Generic media upload, media library và metadata trong D1.
- Dynamic CMS pages ở `/$slug`.
- SEO fields cơ bản, sitemap và robots routes.
- Landing page chất lượng flagship với GSAP + Lenis.

### Khoảng trống lịch sử của Track A

Bảng này giữ lại contract ban đầu của M0-M7 để trace quyết định. Trạng thái thực
tế và evidence mới nhất nằm trong `docs/cms/v1-completion-audit.md`; không dùng
bảng này để kết luận implementation hiện tại còn thiếu toàn bộ các capability
bên dưới.

| Khu vực            | Hiện trạng                         | Target                                                  |
| ------------------ | ---------------------------------- | ------------------------------------------------------- |
| Trang chủ flagship | Text/ảnh nằm trong component React | Toàn bộ nội dung lấy từ published CMS document          |
| Pages editor       | JSON textarea                      | Form theo block, reorder, duplicate, enable/disable     |
| Posts editor       | Textarea/raw blocks                | Rich-text editor an toàn và media picker                |
| Preview            | Chưa có workflow hoàn chỉnh        | Preview draft đúng theme trong iframe/tab riêng         |
| Publish            | Status trên mutable row            | Published snapshot bất biến, draft tiếp tục chỉnh riêng |
| Revision           | Chưa có                            | Version history, diff metadata, restore                 |
| Roles              | Email allowlist                    | Owner/Admin/Editor được enforce ở server                |
| Autosave           | Chưa có                            | Debounced autosave + conflict detection                 |
| Landing sections   | Không có typed CMS model           | Typed schema cho từng section flagship                  |
| Forms/leads        | Endpoint rời rạc                   | Module submissions thống nhất, spam protection, export  |
| White-label        | Tên resource hard-code `rem-viet`  | Site manifest + scripts init/seed/provision             |
| Testing            | Chủ yếu typecheck/build/manual     | Unit + integration + E2E critical paths                 |
| Operations         | Migration/deploy có sẵn            | Backup, restore drill, monitoring, runbook              |

### Khoảng trống hiện tại của Platform Kit

Không dùng lại các khoảng trống lịch sử ở trên làm backlog. Bảng này là trạng
thái productization hiện tại và tách rõ **capability local đã chứng minh** khỏi
**receipt bên ngoài chưa thể tự tạo trong repository**.

| Khu vực                 | Evidence local hiện tại                                                                                                             | Gate còn thiếu trước stable `1.0`                                               |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Contract boundary       | Eight-package graph, explicit exports và forbidden-import tests pass                                                                | Cài đúng artifact đã publish từ clean consumer                                  |
| Runtime workflow        | Neutral page/global ports và conformance pass D1 plus structural Sanity                                                             | Independent deployed conformance receipt                                        |
| Persistence/media       | D1/R2 provider package pass lifecycle, migration fixture và isolated Miniflare                                                      | Production-like deployed restore receipt trên release artifact                  |
| Renderer/template       | Generic registry không có core switch; Rèm Việt owns all flagship/standard contracts                                                | Một template khách thật nhận core upgrade không copy patch                      |
| Admin authoring         | Reusable workflow shell, bounded composition, visual canvas và template field editors                                               | Non-developer pilot/handover receipt                                            |
| Infrastructure          | Callable Alchemy composition nhận manifest/provider config và resources tách theo site                                              | Clean independent staging provenance                                            |
| Provisioning            | Packed clean-consumer install/build/conformance và Acme isolated runtime pass                                                       | Registry-hosted install + deploy từ repository độc lập                          |
| Versioning/upgrade      | Semver matrix, changelog, migrations và N→N+1 rollback rehearsal pass                                                               | Upgrade thực giữa hai released versions                                         |
| Distribution            | Guarded prepare/publish workflow kiểm tra clean provenance và artifact hashes                                                       | Private-registry publication receipt                                            |
| Multi-project evidence  | Rèm Việt + Acme prove reuse locally                                                                                                 | Ít nhất hai paid independent sites trên cùng versioned core                     |
| Optional Sanity adapter | Executable Studio + signed TanStack Presentation edge, page/global adapters, clean-Git hosted gate v3, and promotion-chain verifier | Real dataset + browser-visible Presentation Tool + schema-v3/promotion receipts |

## 4. Phạm vi sản phẩm

### Personas

- **Agency developer:** tạo site, viết theme/block mới, deploy và nâng cấp core.
- **Agency operator/support:** provision, monitor, backup, upgrade và xử lý sự cố
  trên nhiều client repository mà không cần hiểu implementation của từng theme.
- **Client owner:** quản lý người dùng, publish, cấu hình global và xem leads.
- **Content editor:** sửa draft, media, blog và page content; không quản trị users.
- **Visitor:** chỉ nhận published snapshot, không bao giờ nhận draft payload.

### Capability bắt buộc cho Track A client-ready

- Dashboard.
- Pages và structured page blocks.
- Homepage singleton/flagship editor.
- Posts/blog.
- Media library.
- Navigation và global site settings.
- Products/catalog có thể bật/tắt theo preset.
- SEO, sitemap, robots, redirects.
- Forms/leads.
- Roles, audit log, revisions, preview và publish workflow.
- Seed, backup, deploy và client handover documentation.

### Module bắt buộc cho Platform Kit v1.0

- Neutral core contracts và content/schema versioning.
- Runtime query/command ports và provider conformance suite.
- Cloudflare D1/R2 reference provider.
- Typed React registry/renderer và reusable admin workflow shell.
- Template SDK cùng Rèm Việt reference template.
- Alchemy infrastructure composition theo per-client manifest.
- CLI plan-init/init/add-block/migrate/verify với dry-run và idempotency.
- Private distribution, semantic version, compatibility matrix và upgrade path.
- Clean-consumer, two-paid-site và N → N+1 evidence.

### Không làm trước Platform Kit v1.0

- Free-form page builder kiểu Elementor/Webflow.
- Cho editor nhập className, CSS, script hoặc GSAP config.
- Plugin marketplace.
- Multi-tenant SaaS, billing và subscription.
- Realtime collaborative editing.
- Theme marketplace.
- A/B testing engine.
- Localization nhiều ngôn ngữ nếu chưa có khách thật yêu cầu.
- AI content generation trong core.

Các mục trên chỉ được mở lại sau khi có ít nhất hai site khách hàng chạy thật và
có bằng chứng rằng nhu cầu lặp lại.

## 5. Nguyên tắc kiến trúc

1. **Structured content, locked presentation.** CMS quản lý dữ liệu; React quản
   lý markup, responsive, accessibility và animation.
2. **Published snapshot is immutable.** Edit draft không được thay đổi public
   content cho đến khi Publish thành công.
3. **Server authorization first.** Ẩn button không phải phân quyền; mọi mutation
   phải được kiểm tra ở tRPC/server route.
4. **Per-client isolation.** Không thêm `tenantId` vào mọi bảng trong giai đoạn
   agency Platform Kit per-project.
5. **Schema is a contract.** Zod schema neutral trong `cms-core` định nghĩa
   document/block envelope; schema theo ngành/theme nằm trong template package
   và là source of truth giữa provider, admin form và renderer.
6. **Compatibility before cleanup.** Migrate từng lát, seed dữ liệu hiện tại,
   giữ fallback cho đến khi visual parity được xác nhận.
7. **No JSON for clients.** JSON chỉ tồn tại ở storage/debug view dành cho dev.
8. **Boring operations win.** Backup, restore, migration và audit quan trọng
   ngang với UI editor.
9. **Reference app is a consumer.** Rèm Việt phải dùng public API giống client
   khác; không cho phép import ngược từ package neutral vào source riêng của app.
10. **Portable core, explicit capabilities.** Normalize content contract và
    workflow tối thiểu; preview, revision, scheduling, realtime và media transform
    khác nhau giữa provider phải được khai báo capability, không giả vờ tương đương.
11. **No copy-paste reuse.** Việc clone file từ Rèm Việt sang site mới không
    được tính là Platform Kit reuse; package install + config + template registry
    mới là đường chuẩn.
12. **Version before scale.** Mọi client ghi rõ kit version, schema version và
    migration state; không launch paid client từ `workspace:*` không truy vết.

## 6. Kiến trúc đích

```text
                         Independent client repository
                                      |
               +----------------------+----------------------+
               |                                             |
               v                                             v
       Client theme/template                          /admin application
       blocks + renderers                            editors + workflow UI
               |                                             |
               +----------------------+----------------------+
                                      |
                                      v
                          CMS React/Admin registries
                                      |
                                      v
                         CMS Runtime command/query API
                                      |
                        +-------------+-------------+
                        |                           |
                        v                           v
              Cloudflare provider             Optional provider
                  D1 + R2                    Sanity/other adapter
                        |
                        v
              Alchemy infrastructure module

Public requests only consume validated published documents. Draft/preview and
workflow capabilities remain authenticated and capability-aware.
```

### Package graph đích

Tên scope cuối cùng được chốt bằng ADR trước distribution. `@agency/*` dưới đây
là tên kiến trúc, không bắt buộc rename toàn repo trong một commit.

| Package                           | Trách nhiệm                                                                            | Không được chứa                                     |
| --------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `@agency/cms-core`                | Document/block envelopes, Zod primitives, versions, capabilities, errors               | React, Drizzle, Cloudflare, block/brand Rèm Việt    |
| `@agency/cms-runtime`             | Query/command API, publish/review workflow ports, policies, conformance contracts      | Provider SDK, UI component, app routes              |
| `@agency/cms-react`               | Typed block registry, renderer, unknown-block policy, preview hooks                    | Concrete Rèm Việt blocks, persistence               |
| `@agency/cms-admin`               | Admin workflow shell, autosave/conflict/revision/preview/review-state primitives       | Theme-specific forms, provider-specific assumptions |
| `@agency/cms-provider-cloudflare` | D1 persistence, R2 media, review/audit/revision/scheduler adapters                     | Rèm Việt theme and public components                |
| `@agency/cms-alchemy`             | Worker/D1/R2/cron/domain resource composition and binding validation                   | Content/theme data                                  |
| `@agency/cms-template-rem-viet`   | Ten flagship schemas/defaults/editors/renderers/assets mapping                         | Generic provider implementation                     |
| `@agency/cms-cli`                 | `plan-init`, `init`, `add-block`, `migrate`, `verify`, pack/install and upgrade checks | Hidden destructive behavior, client credentials     |

### Mapping từ monorepo hiện tại

| Source hiện tại                        | Hướng extraction                                            |
| -------------------------------------- | ----------------------------------------------------------- |
| `packages/cms`                         | Split neutral contract khỏi landing/site-specific schemas   |
| `packages/api` content services        | Runtime ports + Cloudflare provider/application integration |
| `packages/db` content schema           | Provider-owned D1 schema/migrations, không export qua core  |
| `apps/web` admin components/routes     | Admin shell generic + template-specific editors             |
| `apps/web` landing renderer/components | Generic registry consumer + Rèm Việt template renderers     |
| `packages/infra`                       | Alchemy module nhận manifest/provider config                |
| `scripts/site-*`                       | CLI library trước; thin repository scripts sau              |

Dependency chỉ đi một chiều: consumer/template → React/Admin/Runtime → Core.
Provider implement Runtime/Core ports. Core không import provider, template hoặc
application. CI phải có forbidden-import checks để boundary này không bị xói mòn.

### Block registry

Core chỉ biết block envelope có version; nó không biết `hero` hoặc `faq`:

```ts
type CmsBlock<TType extends string, TData> = {
  id: string;
  type: TType;
  schemaVersion: number;
  enabled: boolean;
  data: TData;
};
```

Template package đăng ký schema/default/editor/renderer theo type:

```ts
const blockRegistry = {
  hero: {
    schema: heroBlockSchema,
    defaults: heroBlockDefaults,
    Editor: HeroBlockEditor,
    Renderer: Hero,
  },
};
```

Registry types và generic renderer nằm trong `cms-react`; workflow field
primitives nằm trong `cms-admin`; concrete schema/default/editor/renderer nằm
trong template package. Không import React, Drizzle hoặc Cloudflare runtime vào
`cms-core`.

### Provider contract và capability negotiation

Không tạo một interface khổng lồ giả định mọi CMS giống nhau. Contract được tách
thành các port nhỏ:

- `ContentReader`: published/draft reads đã normalize.
- `DraftWriter`: validate và lưu working draft với optimistic version.
- `PublishingWorkflow`: publish, schedule, restore và revision access.
- `MediaStore`: upload, metadata, usage và safe delete.
- `PreviewProvider`: session/token/live-preview integration tùy capability.

Cloudflare provider phải pass toàn bộ capability native đang có. Adapter SaaS
có thể chỉ implement subset và khai báo capability rõ ràng; admin ẩn/chặn action
theo capability, không silently emulate semantics không an toàn.

### Chiến lược provider

1. **Cloudflare D1/R2:** provider reference và production baseline đầu tiên vì
   implementation đã được chứng minh trong Rèm Việt/Acme.
2. **Sanity:** experimental adapter + hosted-conformance gate sau khi native
   boundary pass clean-consumer; dùng để kiểm chứng portability và cung cấp
   visual-editing tier cho khách cần. Không promote trước receipt từ dataset và
   Presentation Tool thực.
3. **Payload:** theo dõi Payload 4/TanStack production maturity; không migrate
   capability native đang hoạt động chỉ để đổi admin framework.
4. **Storyblok/khác:** chỉ thêm từ paid requirement hoặc lợi thế editor UX có
   thể định giá, không thêm để làm đẹp danh sách adapter.

## 7. Content model đích

### Page document

```ts
type PageDocument = {
  id: string;
  schemaVersion: number;
  title: string;
  slug: string;
  template: "landing" | "standard";
  blocks: PageBlock[];
  seo: SeoFields;
  status: "draft" | "scheduled" | "published" | "archived";
  publishedRevisionId: string | null;
  scheduledAt: string | null;
  version: number;
  updatedBy: string;
  updatedAt: string;
};
```

### Landing block set đầu tiên

Rèm Việt là reference implementation. Typed block union đầu tiên gồm:

- `hero`
- `threatNarrative`
- `marquee`
- `benefits`
- `craftProcess`
- `bentoDetails`
- `horizontalGallery`
- `measurementGuide`
- `faq`
- `footerCta`

Editor được thay text, ảnh, link, list item và thứ tự hợp lệ. Animation parameters,
CSS classes và DOM structure không nằm trong payload.

### Published revisions

Không sửa trực tiếp dữ liệu mà public đang dùng.

- Row `pages`/`posts` giữ working draft hiện tại.
- `page_revisions` và `post_revisions` giữ snapshot JSON bất biến.
- Publish tạo snapshot mới và cập nhật `publishedRevisionId` trong cùng một DB
  batch/transaction khả dụng.
- Public loader resolve qua `publishedRevisionId`.
- Restore copy snapshot cũ về draft; restore không tự publish.
- Revision history cung cấp diff metadata trước restore. Flagship blocks báo
  thêm, xóa, sửa hoặc đổi thứ tự thật sự theo stable ID; standard pages và posts
  báo field label đã đổi theo form contract. Không flow nào render raw value vào
  generic summary.
- Legacy published rows được backfill thành revision trong migration/seed có thể
  chạy lại an toàn.

### Persistence model của Cloudflare reference provider

Các bảng dưới đây là implementation detail của D1 provider, không phải API của
`cms-core`. Phần lớn đã được triển khai trong Track A; bảng được giữ để mô tả
semantics mà provider conformance phải bảo toàn.

| Bảng               | Mục đích                                                 |
| ------------------ | -------------------------------------------------------- |
| `page_revisions`   | Snapshot page, version, author, note, timestamp          |
| `post_revisions`   | Snapshot post, version, author, note, timestamp          |
| `staff_roles`      | Map Better Auth user sang owner/admin/editor             |
| `redirects`        | oldPath, newPath, statusCode, active                     |
| `audit_events`     | actor, action, entity, before/after metadata, request id |
| `form_definitions` | form key, fields/schema, notification settings           |
| `form_submissions` | payload, status, source page, timestamps                 |

Không tạo generic `content_entries` trong v1.0. Pages và posts đang có contract
khác nhau; gom tất cả vào một bảng sớm sẽ làm query, migration và type safety khó
hơn mà chưa tạo giá trị thực.

## 8. Trải nghiệm admin đích

### Page/home editor

- Canvas ở trung tâm: chính renderer thật của draft route, cập nhật trực tiếp
  khi block chưa lưu và responsive desktop/tablet/mobile.
- Click một section trên canvas chọn đúng block; form schema ở pane phải đóng vai
  trò inspector theo selection, không phải workspace chính.
- Toolbar theo section cho phép đưa lên/xuống bằng bàn phím hoặc kéo trực tiếp
  tới section đích; intent đi qua neutral protocol và template vẫn chặn hero/
  final CTA. Sidebar tree là fallback tương đương, không phải implementation
  riêng có semantics khác.
- Sidebar trái: cây section, trạng thái enable/disable và drag reorder trong
  giới hạn template; vùng pin như hero/final CTA không được kéo khỏi vị trí.
- Add, duplicate, delete và reorder chỉ trong bounded composition do template
  registry công bố; không cho editor tự sửa DOM/CSS tùy ý.
- Component picker ở sidebar và canvas dùng cùng catalog metadata do template
  sở hữu (label, mô tả mục đích, category, keywords), searchable không phụ thuộc
  dấu tiếng Việt và chỉ hiển thị block còn hợp lệ theo cardinality hiện tại;
  app/provider không duy trì bản copy label riêng.
- Undo/redo tức thời cho block content và composition, có giới hạn bộ nhớ,
  coalesce thao tác gõ liên tục, clear redo branch sau edit mới và reset khi
  server draft thay thế working copy; published revision/restore vẫn là lịch sử
  bất biến riêng.
- Visual editing phải được mô tả bằng neutral capability/protocol. Transport,
  overlays và field paths riêng của Sanity/Storyblok/provider khác ở trong
  adapter; không leak vendor type vào core hoặc template renderer.
- Media picker dùng chung, không nhập URL thủ công trừ chế độ advanced.
- Validation inline bằng tiếng Việt.
- Dirty state, autosave state và last saved time luôn nhìn thấy.
- Actions tách rõ: `Lưu draft`, `Xem trước`, `Publish`.

### Posts editor

- Title, slug, excerpt, cover, tags, publish date và SEO.
- Rich text có heading, paragraph, list, quote, link, image, video embed và code
  block nếu preset bật.
- Paste từ Google Docs không mang style rác vào public renderer.
- Output được validate/sanitize; không lưu HTML tùy ý không kiểm soát.

> **Post paste boundary, 2026-08-17:** `@agency/cms-admin` now owns a reusable
> bounded `text/plain` insertion primitive. Post span controls explicitly ignore
> clipboard HTML/CSS/classes/Office metadata, normalize Unicode/line endings,
> remove invisible/control markers and keep canonical selection/length limits.
> The authenticated production-Worker lifecycle pastes a Google Docs-like
> dual-format payload, persists only the normalized marker, publishes/restores
> it through the safe renderer and cleans up the post/redirect fixture.

### Media library

- Grid/list, search, filter theo mime/date và pagination.
- Upload progress, per-file error và retry.
- Alt text bắt buộc trước khi ảnh được dùng ở vị trí public quan trọng.
- Copy URL, replace metadata và usage references.
- Xóa bị chặn nếu asset đang được tham chiếu, trừ khi owner force-delete.

### Workflow

- Owner: users, roles, settings, publish, restore, destructive actions.
- Admin: toàn bộ content, publish, media và leads; không đổi owner.
- Editor: draft, preview và media; không publish/restore/xóa vĩnh viễn.
- Optimistic concurrency bằng `version`; stale edit trả conflict thay vì ghi đè.
- Autosave debounce 1-2 giây, flush khi rời block/page.
- Audit log cho create/update/publish/restore/delete/login-sensitive actions.

### Preview security

- Route preview yêu cầu admin session hoặc short-lived signed token.
- Response có `noindex, nofollow` và `Cache-Control: private, no-store`.
- Preview đọc draft; public route không nhận flag query để né authorization.
- Preview iframe và editor dùng cùng renderer với public để tránh hai giao diện
  lệch nhau.

## 9. SEO, forms và vận hành

### SEO

- Per-page title, description, canonical, OG image và robots flags.
- Slug đổi sau publish phải đề nghị tạo redirect.
- Sitemap chỉ chứa published content canonical.
- Structured data do theme định nghĩa, lấy dữ liệu đã validate từ CMS.
- Preview/draft/admin luôn noindex.

### Forms/leads

- Một submission service chung thay cho endpoint form rời rạc.
- Honeypot + rate limit; thêm Turnstile khi site có traffic/spam thật.
- Notification adapter: email là chuẩn, Telegram là optional.
- Admin inbox: new/contacted/closed/spam, note nội bộ, CSV export.
- Có retention policy và action xóa dữ liệu cá nhân.

### Media delivery

- R2 giữ original object và immutable key.
- Metadata/alt text ở D1.
- Giữ compatibility URL hiện có trong suốt migration.
- Chỉ thêm image transform service sau khi đo được nhu cầu; không tự xây pipeline
  resize phức tạp trong CMS core.

### Backup và restore

- Backup D1 định kỳ và trước migration production.
- R2 object không bị overwrite theo URL cũ.
- Mỗi release candidate phải thực hiện restore drill trên staging.
- Runbook ghi rõ người làm, command, artifact và thời gian phục hồi.

## 10. White-label và provisioning

### Site manifest

Các giá trị đang hard-code phải đi qua một manifest typed:

```ts
type SiteManifest = {
  id: string;
  name: string;
  kit: {
    version: string;
    template: string;
    provider: "cloudflare" | string;
    contentSchemaVersion: number;
  };
  defaultLocale: string;
  locales: string[];
  preset: string;
  brand: {
    logo: string;
    colors: Record<string, string>;
    fonts: string[];
  };
  features: Record<string, boolean>;
  infrastructure: {
    adapter: "alchemy-cloudflare" | string;
    alchemyApp: string;
    workerName: string;
    d1Name: string;
    r2BucketName: string;
    backupBucketName: string;
  };
};
```

### Provisioning commands đích

```bash
bun run site:init --id=acme --preset=showcase
bun run site:seed --site=acme
bun run site:verify --site=acme
bun run deploy --stage=staging
```

Các `site:*` script hiện tại tiếp tục phục vụ Track A. Trong Track B, logic phải
được chuyển dần vào `cms-cli` và được thử bằng package tarball/registry install;
không chờ external receipt của Rèm Việt mới bắt đầu extraction an toàn. CLI phải:

- Validate slug/resource names.
- Không ghi đè file hoặc Cloudflare resource đang tồn tại.
- Sinh manifest/env example/seed từ template.
- In checklist secrets còn thiếu.
- Có dry-run.
- Chạy lại được mà không tạo dữ liệu trùng.

### Chiến lược reuse

1. Rèm Việt tiếp tục là reference implementation nhưng phải dần trở thành một
   consumer bình thường của public package API.
2. Extract boundary đã được chứng minh ngay bây giờ theo strangler pattern;
   không big-bang move và không đợi hai paid client mới bắt đầu package hóa.
3. `acme-demo` là conformance/runtime fixture, không được tính một mình là bằng
   chứng market reuse hoặc independent consumer.
4. Tạo một clean consumer repository/fixture chỉ cài package artifact, không có
   quyền import source path từ monorepo và không copy Rèm Việt components.
5. Release private `0.x` sau clean-consumer proof; dùng ít nhất một dự án khách
   thật để tìm boundary sai trước khi freeze `1.0`.
6. Stable `1.0` cần ít nhất hai independent/paid site, một upgrade N → N+1 có
   migration/rollback evidence và không có critical API chỉ hoạt động cho Rèm Việt.
7. Core release dùng semantic version, compatibility matrix và migration notes;
   client theme có upgrade window riêng nhưng không được fork core vô thời hạn.

## 11. Roadmap — core product and release evidence

Không dùng cùng một version hoặc Definition of Done cho core CMS capability,
reference-site release readiness và commercial validation.
`v1.0.0-client-ready` chứng minh một site có thể bàn giao an toàn; nó không tự
động biến monorepo thành `Agency CMS Platform Kit v1.0`. Ngược lại, thiếu một
receipt vận hành không biến capability core đã implement/test thành chưa xây.

### Track C — Core CMS competitiveness (active)

Track này là critical path hiện tại. Track A/B bên dưới tiếp tục giữ lịch sử và
release evidence nhưng không được chen các receipt bên ngoài vào backlog build
core.

| Milestone                       | Kết quả                                                                                       | Trạng thái      |
| ------------------------------- | --------------------------------------------------------------------------------------------- | --------------- |
| C0 — Premium authoring baseline | Visual canvas, composition, preview, workflow, revisions, media, roles and audit              | Implemented     |
| C1 — Content model registry     | Code-first collections, fields, relationships and schema versions                             | **In progress** |
| C2 — Generated collection admin | List/create/edit/filter forms generated from the registry and extensible by template field UX | Next            |
| C3 — Extension surface          | Typed hooks and feature modules without modifying core switches                               | Planned         |
| C4 — Locale and portability     | Locale-aware lifecycle, typed content API and schema-aware import/export                      | Planned         |

Track C exits when a new collection with a relationship can be registered in a
consumer, persisted by the reference provider, edited in generated admin UI,
queried through the public SDK and migrated without editing a core switch.

### Track A — Reference implementation/client-ready

M0-M6 và phần kỹ thuật M7 đã được triển khai. Bảng effort dưới đây là baseline
lịch sử của công việc đã tạo ra capability hiện có; status/evidence mới nhất ở
`docs/cms/v1-completion-audit.md`.

| Milestone                     | Kết quả                                          | Trạng thái hiện tại               |
| ----------------------------- | ------------------------------------------------ | --------------------------------- |
| M0 — Lock baseline            | Contract, test harness, ADR và content inventory | Implemented                       |
| M1 — Safe content core        | Revisions, roles, audit, public/draft separation | Implemented                       |
| M2 — Flagship content-driven  | Toàn bộ landing đọc typed CMS data               | Implemented                       |
| M3 — Human editor             | Block forms, media picker, reorder, autosave     | Implemented; human pilot pending  |
| M4 — Preview/publish workflow | Preview, publish, schedule, restore, conflicts   | Implemented                       |
| M5 — Client operations        | SEO, redirects, leads, backup, monitoring        | Technical complete; receipts open |
| M6 — White-label              | Manifest, presets, seed, init/verify scripts     | Implemented; clean proof pending  |
| M7 — Hardening/pilot          | E2E, a11y, performance, docs, staging pilot      | Technical complete; external open |

> **M5 backup activation evidence, 2026-08-17:**
> `site:backup:github:audit` now verifies the byte-identical default-branch
> workflow, redacted repository configuration, run-bound restore/archive JSON,
> manifest bucket, 365-day immutability and manual→weekly ordering. Its first
> live read-only run remains correctly red: the workflow is not on remote
> `main`, all three variables plus the dedicated secret are absent, and neither
> qualifying Actions receipt exists. No push, secret write or dispatch is
> inferred from the local verifier.
> The same sanitized audit is now a mandatory sixth live input to
> `release:readiness`: both live prerequisites and final readiness stay red if
> the current default-branch workflow/configuration/manual→weekly evidence is
> missing or has drifted, even when an older schema-v3 release file is valid.
>
> **M7 tag-gate activation evidence, 2026-08-17:**
> A separate read-only `release:github:audit` now verifies that
> `.github/workflows/client-ready-release.yml` exists byte-identically on the
> repository default branch and is registered as an active GitHub Actions
> workflow. The same result is a mandatory seventh input to live
> `release:readiness`; a valid evidence file and clean deployment can no longer
> report ready while the actual tag gate is absent, drifted, unregistered or
> disabled. The first live audit correctly reports that both default-branch
> content and registration are missing on remote `main`. No push, workflow
> enablement or tag action is inferred from the local contract.
>
> **M7 readiness-scope evidence, 2026-08-17:**
> The aggregate release command now rejects a non-staging target before reading
> repository state or spawning any provider/GitHub audit. Its exported scope
> contract requires a safe site slug and an origin-only HTTPS URL with no
> credentials, path, query or hash. A production-scope invocation now returns the
> explicit `--stage=staging` requirement instead of a generic nested-audit error;
> the correct Rèm Việt staging invocation still returns the sanitized 10/10 D1,
> missing alert/notification receipts, CLS 0/75, LCP 1/75, INP 0/75, dirty
> provenance, absent GitHub activation and absent release-record report. No
> external gate is inferred from this operator-safety improvement.
>
> **Release-candidate boundary re-audit, 2026-08-17:**
> Read-only GitHub audits at `2026-08-17T00:08:36Z` still find both release
> workflows absent from remote default branch `main` at
> `8af868cec3f805411376939c8bf3685864428020`; the four scheduled-backup
> repository settings and both manual/weekly receipts are also absent. The local
> worktree is based on `4cc3cbd8246fba098a9e78baa0dd4f6e4129072e`, two commits
> ahead, with the workflow contracts present and uncommitted candidate changes.
> The exact root `bun run quality` then
> passed end to end after its first run exposed and drove fixes for dark-theme
> dashboard contrast plus two stale/ambiguous authenticated E2E selectors. This
> proves a locally verified release candidate, not remote activation: no commit,
> push, secret/configuration write, workflow dispatch or receipt was created.
>
> **M7 publication activation evidence, 2026-08-17:**
> With explicit owner authorization, the candidate was committed and published
> to remote `main`. Pre-push object inspection found a 203 MB local VS Code
> installer and generated Alchemy/Miniflare backup databases in the older,
> unpublished local range; the transfer was stopped before any remote mutation,
> the exact state was preserved on local branch
> `codex/pre-publication-cms-c8f9224`, and `main` was rebuilt as a safe
> fast-forward with those artifacts ignored and untracked. Remote `main` then
> reached `41fbd7eb4493342eef3b8946d255f9845e043b03`. At
> `2026-08-17T02:06:10Z`, `release:github:audit` reports the exact client-ready
> workflow present, registered and active. The scheduled-backup workflow is also
> exact on the default branch, but its four repository settings and both
> manual/weekly receipts remain absent, so that gate correctly exits `2`. The
> first push also surfaced 22 GitHub alerts, all from one unused source-less
> legacy `packages/shared-config` manifest; removing it closed all 22 alerts.
> Frozen install made no lockfile change, Bun's high-severity audit and the
> client-secret audit pass. Publication closes workflow registration, not the
> provider configuration, staging, RUM, pilot or receipt gates.
>
> **M3 stable visual identity evidence, 2026-08-17:**
> Standard-page blocks now persist bounded stable IDs through the flattened app
> schema, provider draft codec and immutable revisions. Legacy rows without an
> ID upgrade deterministically; duplicate legacy IDs are re-keyed, while add and
> duplicate operations create collision-safe identities. Forty-four focused
> core/template/API tests pass. The refreshed isolated production-Worker
> lifecycle passed in 25.6 seconds and proves the original CTA ID differs from
> its duplicate and survives rendered drag/reorder, autosave and reload before
> the full workflow cleanup. This removes the earlier position/type-derived
> canvas limitation without relaxing bounded composition or inventing an
> external pilot receipt.
>
> **M3 shared focus-workspace evidence, 2026-08-17:**
> The desktop canvas-plus-inspector mode is now a reusable
> `@agency/cms-admin` behavior adopted by homepage, standard-page and post
> authoring. The package owns breakpoint exit, body scroll lock, Escape, focus
> containment and trigger restoration; each route keeps its own labelled
> dialog layout around the real renderer and mounted inspector/form. Standard
> pages and posts pass independent focused axe scans, their complete isolated
> production-Worker lifecycles pass together in 52.1 seconds including a real
> below-1280px exit, and the extracted homepage workflow passes again in 15.4
> seconds. This closes the remaining local authoring-space asymmetry without
> treating automation as the non-developer pilot.
>
> **M3 template-owned standard-block discovery evidence, 2026-08-17:**
> The Rèm Việt template now publishes one immutable, exhaustive authoring
> catalog for every standard-page block type, including label, description,
> category and bilingual search keywords. Both the structure sidebar and the
> contextual canvas composer consume that contract through the shared
> accent-insensitive catalog filter; the app and preview no longer maintain
> competing label lists. Thirteen template-package tests pass. The refreshed
> isolated production-Worker lifecycle passed in 29.4 seconds, searching
> `keu goi` in the parent editor and `van ban` in the canvas, proving filtered
> discovery, an accessible contextual dialog, neutral insertion, and the full
> immutable draft/publish/cleanup lifecycle. This closes the local component-
> discovery gap. A fresh signed-in Browser check also showed all three
> descriptive cards and reduced `keu goi` to CTA alone without persisting data;
> neither receipt is treated as a hosted comparison or human pilot.
>
> **M3 structured-body discovery evidence, 2026-08-17:**
> The template now owns a second immutable, exhaustive catalog for all seven
> rich-text block types used inside standard pages and posts. A compact
> disclosure replaces the duplicated toolbar with label, purpose, category and
> bilingual keyword search, while post revision summaries resolve those same
> labels and direct plus canvas insertion share the schema's 500-block ceiling.
> Fourteen template-package tests pass. The isolated production-Worker post
> lifecycle passed in 24.6 seconds after finding `Tiêu đề` with unaccented
> `tieu de`, excluding unrelated choices and passing axe with the catalog open.
> That proof caught a broad content-focus fallback selecting the new search
> input; the fallback now scopes itself to real rendered block controls and the
> same run re-proves exact canvas click-to-edit through immutable workflow and
> cleanup. The shared standard-page lifecycle passes again in 29.7 seconds.
> This improves nested component discovery without changing any external gate.
>
> **M3 persistent structured-body identity evidence, 2026-08-17:**
> Every valid rich-text block now has a bounded persistent ID. Legacy structured
> bodies with missing or duplicate identities are upgraded deterministically,
> existing unique IDs survive unchanged, and direct add, canvas insert and
> duplicate operations mint collision-safe identities. Post input normalization
> and nested standard-page provider encoding persist the canonical document
> before any write. Preview selection and composition require the exact rendered
> content snapshot and matching block IDs as well as indices; mismatched pairs
> fail closed, while React keys and rendered annotations follow the same ID.
> Forty-two CMS tests, twenty-four API authorization tests and seven focused web
> protocol tests pass. The refreshed production-Worker post lifecycle passed in
> 24.9 seconds, proving four distinct rendered IDs and the original heading ID
> through drag/reorder, autosave and reload before the full immutable workflow
> and cleanup. The independent standard-page lifecycle passed in 29.3 seconds
> and proves a nested rich-text ID survives its provider/autosave/reload path.
> This closes the local position-derived structured-body identity gap without
> changing any external release gate.
>
> **M3 deterministic canvas-navigation evidence, 2026-08-17:**
> A signed-in Browser comparison found that selecting the fixed footer could
> leave the homepage canvas at Hero, while selecting an already-active section
> emitted no new state for the preview to observe. The preview now owns a
> non-visual footer scroll target at the real document end, applies
> reduced-motion-aware section alignment, and receives a bounded
> `selectionRevision` in the validated visual-state envelope so every explicit
> selection can retrigger navigation. The same pass exposed a cross-frame focus
> race during animated canvas reconciliation; the inspector now performs one
> guarded settled-focus retry only when focus fell to the document body, preview
> frame or intended control, so it cannot steal a user's move to another field.
> Twenty `cms-admin` protocol tests pass with 85 expectations. The strict
> isolated production-Worker homepage lifecycle passed in 16.4 seconds and
> requires CTA selection at the exact document bottom, Hero at the exact top,
> repeat selection from a displaced canvas, exact FAQ field focus and the full
> autosave/review/cleanup path. A final live Browser receipt measured
> `scrollY=16442` and `fromBottom=0` after selecting `10. CTA cuối trang`. This
> closes a local canvas-orientation defect; it is not a pilot, hosted or release
> receipt.
>
> **M3 canvas-first focus-workspace evidence, 2026-08-17:**
> A subsequent signed-in Browser comparison found that the nominal focus mode
> still left the live homepage in a roughly 200px-tall strip at 36% scale because
> status and revision cards consumed most of the canvas column. Focus mode now
> dedicates that column to the live preview and inspector: the supporting cards
> are hidden only while focused and return on exit, so no workflow or draft state
> is duplicated or removed from the normal editor. The live Browser measured an
> 814×670 preview shell, an 813×580 authoring canvas and 53% desktop-page scale,
> with both supporting panels absent from layout. The refreshed isolated
> production-Worker lifecycle passed in 16.4 seconds and enforces a 640px preview
> shell, 520px canvas floor, focused-workspace accessibility, Escape/trigger
> restoration, panel return and the complete existing mutation/review/cleanup
> path. This closes a local presentation-quality gap against canvas-first hosted
> editors; it does not replace the external usability pilot.
>
> **M3 zero-save standard-page canvas evidence, 2026-08-17:**
> A cross-editor review found one remaining create-flow break: posts and saved
> standard pages exposed the real responsive canvas immediately, while a new
> standard page showed a save-first placeholder. New standard pages now open
> the same authenticated renderer through a reserved in-memory preview scope;
> that scope disables the page query, has no standalone-preview link and keeps
> the existing private/no-store/noindex boundary. The parent streams its single
> working copy through the existing validated visual protocol, so Desktop,
> Tablet and Mobile previews, block composition and exact canvas-to-inspector
> selection work before any record exists. First publish replaces the reserved
> URL with the persisted page ID without changing renderer or editor state. The
> focused production-Worker lifecycle passed in 33.0 seconds, including an
> independent signed-in context proving the unsaved title was absent from the
> page list, CTA-title selection focusing the real parent control and the full
> publish/revision/redirect/unpublish/delete path. A signed-in Browser receipt
> then rendered an unsaved two-block sample at 776×485 and 54% scale in focus
> mode with the CTA inspector beside it; the list remained empty and no save or
> publish action was taken. This closes a local zero-save parity gap, not the
> external usability, hosted-provider or release gates.
>
> **M3 whole-document recovery evidence, 2026-08-17:**
> The zero-save Browser exercise exposed that standard-page history covered
> blocks but not title, slug or SEO metadata, and manually returning every field
> to its original value could still leave a false dirty/navigation guard. The
> editor now keeps title, slug, identified blocks, SEO title/description,
> canonical URL, social image and robots controls in one bounded, coalesced and
> branch-safe history against the exact installed/saved baseline. Undo/redo is
> chronological across that complete working document; returning to the
> baseline clears dirty state and navigation blocking, while a successful save
> advances the baseline only to the generation actually persisted so edits made
> during the request remain dirty. The focused production-Worker lifecycle
> passed in 32.0 seconds, including metadata undo/redo, exact clean-baseline
> restoration, immediate clean navigation, zero persistence and the established
> publish/revision/conflict/cleanup path. A signed-in Browser receipt independently
> changed the page and SEO titles: the first undo removed only SEO, the second
> restored both fields and the synchronized state with undo disabled and redo
> available; navigation to Posts then completed and no temporary page row
> existed. This closes a local recovery-trust defect, not any external gate.
>
> **M3 cross-editor post recovery evidence, 2026-08-17:**
> The recovery audit then found the same asymmetry in posts: rich-text content
> entered history, but title, slug, description, cover, tags, publish date and
> SEO/social/robots fields only toggled an event-based dirty flag. Posts now
> commit the complete normalized form document to the same bounded,
> branch-safe history with semantic per-field coalescing and an exact
> installed/saved baseline. Undo/redo restores the full form snapshot while
> preserving the live preview and selected rich-text bounds; save completion
> advances the baseline only to the submitted generation. The focused
> production-Worker post lifecycle passed in 26.0 seconds with title/SEO
> chronology and exact clean restoration added to its existing composition,
> autosave, conflict, publish, revision, redirect and cleanup proof. A signed-in
> Browser check changed the seeded post title then SEO title, undid SEO first
> and title second, returned to synchronized v2 with undo disabled and redo
> available, navigated immediately to the post list, and reopened the original
> values unchanged. This closes the matching post recovery defect without
> changing any hosted, pilot or release gate.
>
> **M3 global-content recovery evidence, 2026-08-17:**
> The same audit found that the mandatory site-settings/navigation screen still
> used isolated submit-only state: owner edits had no chronological recovery,
> exact dirty baseline or save-before-navigation protection even though server
> revisions existed. Information, socials, compatibility flags, header
> navigation and footer navigation now share one bounded, coalesced and
> branch-safe working history against the exact installed/persisted baseline.
> Undo/redo crosses both forms in true edit order; returning to the baseline
> clears the navigation guard. Internal navigation flushes only dirty regions,
> while header/footer writes advance their baselines independently so a partial
> two-request failure remains truthful and retryable. The focused
> production-Worker lifecycle passed in 8.5 seconds, including a zero-violation
> accessibility scan, cross-form reverse chronology, exact clean restoration,
> save-before-navigation, immutable revision restore, public navigation
> propagation and cleanup. That scan also exposed and fixed the screen's
> pre-existing h1→h3 heading jump. A signed-in Browser check changed address
> then header label, undid the label first and address second, returned to the
> synchronized state with undo disabled and redo available, navigated away and
> reopened the unchanged originals. This closes the remaining local global-
> content recovery asymmetry, not any hosted, pilot or release gate.
>
> **M3 global-content live-preview evidence, 2026-08-17:**
> Recovery parity exposed one final authoring asymmetry: owners could preview
> homepage, standard-page and post working copies on rendered surfaces, but
> still edited global identity and header/footer navigation blind. The settings
> screen now includes a responsive sticky canvas backed by an authenticated,
> private/no-store/no-index route that mounts the production `Header` and
> `SiteFooter` components. The entire unsaved global working copy streams over a
> typed, recursively validated, same-origin/source-checked protocol; a retryable
> handshake removes fast-iframe races, and preview-only initial data cannot be
> overwritten by background server queries. Desktop/mobile controls scale the
> real 1280×820 or 390×844 viewport without saving. Two protocol tests pass, and
> the extended production-Worker lifecycle passed in 12.1 seconds with canvas
> connection, responsive switching, unsaved phone/menu propagation, undo-driven
> rendered restoration, accessibility, revision/public propagation and exact
> cleanup. A signed-in Browser check independently changed the first header
> label, observed it immediately inside the production Header, then used global
> Undo to restore both form and canvas to the synchronized original. No Browser
> save occurred. This closes local global-content visual-authoring parity, not
> any hosted, pilot or release gate.

### Track B — CMS Platform Kit productization

Ước lượng dưới đây dành cho một developer tập trung và chỉ bắt đầu sau khi
package graph/ADR được chốt. Đây là effort range, không phải lời hứa calendar.

| Milestone                           | Kết quả                                                            |     Effort |
| ----------------------------------- | ------------------------------------------------------------------ | ---------: |
| PK0 — Boundary lock                 | Package graph, ports, import rules, version policy, golden tests   |   3-5 ngày |
| PK1 — Core/template split           | Neutral core + Rèm Việt template + typed registry                  |   5-8 ngày |
| PK2 — Native provider/runtime       | D1/R2 provider + workflow ports + conformance suite                |  7-11 ngày |
| PK3 — React/admin extraction        | Renderer registry + reusable workflow shell + template editors     |  8-12 ngày |
| PK4 — CLI and clean consumer        | Pack/install/plan-init/init/migrate/verify từ repository độc lập   |  6-10 ngày |
| PK5 — Upgrade/distribution contract | Private release, semver, migrations, rollback và N → N+1 proof     |   5-8 ngày |
| PK6 — Commercial validation         | Hai independent paid sites, support/runbook/SLA và margin evidence | 7-12 ngày* |
| PK7 — Optional provider validation  | Time-boxed Sanity adapter cho 1 page/2 blocks                      |   3-5 ngày |

`*` Không gồm thời gian chờ khách hàng, sales hoặc thu thập external evidence.

First usable internal `0.x` target là sau PK4; stable `1.0` chỉ sau PK6. Local
implementation hiện đã hoàn thành PK0-PK5 và structural PK7; không chuyển kết quả
này thành phần trăm “hoàn thành sản phẩm”. PK6, private publication, independent
deployed receipts và hosted-provider receipt vẫn là các gate nhị phân chưa pass.

Exit gates của Track B:

- Rèm Việt build/run hoàn toàn qua package API, không dùng privileged deep import.
- Clean consumer chỉ cài artifact đã pack/publish; xóa monorepo source vẫn build.
- Add một block mới có contract, editor, renderer, seed và migration path rõ ràng.
- Cloudflare provider pass cùng conformance suite ở local và staging.
- Upgrade N → N+1 giữ content/revisions/media và có rollback rehearsal.
- Một core fix được release rồi áp dụng vào ít nhất hai consumer không copy patch.
- Stable release không chứa `rem-viet` import, default copy hoặc resource name
  trong package neutral.

### Contract lịch sử M0-M7

Các mục M0-M7 dưới đây được giữ để trace acceptance contract đã dẫn đến Track A;
không phải backlog hiện tại của Platform Kit.

### M0 — Lock baseline

Deliverables:

- ADR cho published revision, roles, preview security và per-client isolation.
- Inventory toàn bộ hard-coded content của landing.
- Golden screenshots desktop/mobile cho từng section.
- Test runner và test database strategy được chốt.
- Migration backup/restore dry run trên local hoặc staging.

Exit criteria:

- Có test chứng minh public service không trả draft.
- Có mapping field-by-field từ landing hiện tại sang CMS schema.
- Không còn quyết định kiến trúc P0 chưa được chốt.

### M1 — Safe content core

Deliverables:

- Revision tables và publish/restore services.
- `staff_roles` và middleware capability-based.
- Audit events cho content mutations.
- Backfill revision cho dữ liệu published hiện có.
- Public API đọc published snapshot; admin đọc working draft.

Exit criteria:

- Edit một published page không đổi public response.
- Publish đổi public response atomically.
- Restore tạo draft đúng snapshot và không tự public.
- Editor gọi publish API nhận `FORBIDDEN` ở server.

### M2 — Flagship content-driven

Deliverables:

- Typed schema/defaults cho 10 landing blocks.
- Seed `home` từ nội dung hard-code hiện tại.
- Home loader đọc published revision.
- Tất cả landing component nhận content bằng props.
- Fallback chỉ dùng trong migration và có telemetry/log rõ ràng.

Exit criteria:

- Visual regression không vượt ngưỡng đã chốt.
- Sửa seeded content trong DB và publish phản ánh trên homepage không deploy.
- Không còn user-facing copy/asset URL hard-code trong landing component, ngoại
  trừ nhãn kỹ thuật/accessibility có chủ đích được document.

### M3 — Human editor

Deliverables:

- Home/page block editor theo registry.
- Array item editor cho FAQ/gallery/process/benefits.
- Add/duplicate/reorder/enable/disable.
- Media picker tích hợp và alt validation.
- Autosave, dirty state và conflict response.
- Raw JSON debug panel chỉ hiện trong dev/owner advanced mode.
- Version-bound review request panel shared by home, page and post editors;
  Editors can hand off a saved draft without receiving publish authority.

Exit criteria:

- Một người không biết code hoàn thành kịch bản sửa hero, thay ảnh, thêm FAQ và
  reorder gallery mà không mở JSON.
- Refresh browser không mất thay đổi đã autosave.
- Hai tab sửa cùng document không silently overwrite nhau.

### M4 — Preview/publish workflow

Deliverables:

- Secure preview route và responsive iframe.
- Publish confirmation và summary validation.
- Schedule/unschedule qua Cloudflare cron hoặc cơ chế tương đương.
- Revision list, human-readable diff metadata và restore flow.
- Slug-change redirect prompt.
- Admin/Owner review queue with approve/request-changes decisions, stale-version
  detection and immutable audit provenance; approval never auto-publishes.

Exit criteria:

- Draft preview khớp renderer public.
- Preview URL không truy cập được sau logout/token expiry.
- Scheduled content không xuất hiện sớm và được publish trong SLA đã chốt.
- Restore drill pass.

### M5 — Client operations

Deliverables:

- SEO form đầy đủ, redirects CRUD, sitemap validation.
- Unified lead submissions và admin inbox.
- Rate limit/spam protection.
- Backup scripts/runbook và health checks.
- Error tracking/alerts cho publish, upload, notification và migrations.

Exit criteria:

- Lead test đi từ public form đến admin + notification đúng một lần.
- Broken redirect loop bị validation chặn.
- Backup production-like data và restore sang staging thành công.

### M6 — White-label

Deliverables:

- Typed `site.manifest`.
- Feature flags/presets đầu tiên.
- Idempotent init/seed/verify scripts với dry-run.
- Tên Alchemy/D1/R2/Worker lấy từ manifest/stage.
- Checklist domain, secrets, admin bootstrap và handover.

Exit criteria:

- Tạo staging site mới từ clean checkout trong <= 2 giờ.
- Không còn resource production dùng tên `rem-viet` khi manifest là khách khác.
- Site mới có demo content, admin login, media upload và publish smoke pass.

### M7 — Hardening và pilot

Deliverables:

- E2E critical workflows.
- Accessibility và keyboard pass cho admin/public.
- Performance budgets và image audit.
- Security review cho auth/upload/preview/forms.
- Client manual tiếng Việt và agency operations manual.
- Một staging pilot do người khác ngoài developer sử dụng.

Exit criteria:

- Tất cả quality gates phần 12 pass.
- Pilot user hoàn thành handover script không cần developer can thiệp.
- Không còn P0/P1 bug mở.
- Product được tag `v1.0.0-client-ready`.

## 12. Quality gates

### Mỗi pull request

```bash
bun --cwd packages/cms run check-types
bun --cwd packages/db run check-types
bun --cwd packages/api run check-types
bun --cwd apps/web run check-types
bun --cwd apps/web run build
```

Thêm formatter/lint/test command vào root khi test harness được chốt ở M0.

### Automated tests bắt buộc trước Track A client-ready

- Schema tests cho mọi block và invalid payload.
- Service tests cho slug uniqueness, roles, draft/public filtering.
- Publish/restore integration test trên D1-compatible test database.
- Media upload validation và delete-reference behavior.
- E2E: login, edit home, preview, publish, restore.
- E2E: editor không publish được.
- E2E: upload/select image và alt text.
- E2E: lead submission và status update.
- E2E: sitemap không chứa draft/preview.

### Core competitive gates

- Collection/field/relationship contracts are React-, database- and
  provider-neutral in `cms-core`.
- A consumer adds a collection without modifying a core route, renderer or
  provider type switch.
- The same definition drives validation, generated admin controls, provider
  persistence tests and typed SDK output.
- Relationship targets are explicit; invalid or dangling required references
  fail closed.
- Generated authoring UI remains keyboard accessible and permits a template to
  replace individual field controls without forking the workflow shell.
- Extension hooks are ordered, typed, bounded and covered by failure-isolation
  tests; editors cannot install or execute arbitrary code.
- Locale-aware drafts and published snapshots cannot leak across locales.
- Import/export validates kit/schema versions and produces a reviewable plan
  before writes.

These gates define whether the core CMS is competitive. The release gates below
define whether a particular deployment is ready to hand over or operate; they
do not block Track C implementation status.

### Release gates

- Typecheck/build/tests pass từ clean checkout.
- Migrations apply trên empty DB và upgraded fixture DB.
- Backup được tạo trước production migration.
- No P0/P1 issue.
- Public draft leak tests pass.
- Keyboard navigation cho editor critical path pass.
- Không có horizontal overflow ngoài gallery có chủ đích.
- Core Web Vitals target trên representative production build: LCP <= 2.5s,
  CLS <= 0.1, INP <= 200ms ở p75 khi có dữ liệu thực để đo.
- Smoke test desktop + mobile sau deploy.

### Platform Kit package gates

- Mỗi package có explicit exports; consumer test không dùng source/deep import.
- Dependency graph và forbidden-import rules pass.
- `cms-core` chạy typecheck/tests mà không cài React, Drizzle hoặc Cloudflare SDK.
- Provider conformance tests chạy cho empty state, draft isolation, publish,
  conflict, revision restore, media lifecycle và migration fixture.
- `bun pack`/private-registry artifact được cài vào clean consumer và build/deploy.
- Package artifact không chứa source map/secret/test fixture/private brand data
  ngoài publish allowlist.
- Compatibility matrix ghi rõ kit, schema, provider, TanStack/Bun/Alchemy versions.
- Breaking contract có schema migration, release note và rollback path.
- Rèm Việt và clean consumer chạy cùng released package version trước stable tag.
- Platform Kit release provenance tách khỏi client-site release provenance.

## 13. Security checklist

- Không public sign-up cho admin.
- Role/capability kiểm tra ở server cho từng mutation.
- Session cookie, trusted origins và production HTTPS được verify.
- Preview dùng session hoặc signed token ngắn hạn; không dùng secret dài hạn trong URL.
- Upload kiểm tra extension, MIME, magic bytes, file size và batch size.
- Object key do server sinh; không dùng filename làm path trực tiếp.
- Rich text/embeds được allowlist và sanitize.
- Form endpoint có rate limit, honeypot và size limit.
- Destructive action yêu cầu confirm và ghi audit.
- Secrets không đi vào manifest/client bundle/log.
- Admin/preview responses không cache public.
- Dependency/security review trước mỗi client launch.

## 14. Extraction strategy từ Rèm Việt sang Platform Kit

Content migration của flagship và typed editor đã hoàn thành về mặt kỹ thuật;
evidence nằm trong completion audit. Giai đoạn tiếp theo không rewrite CMS và
không di chuyển tất cả file trong một PR. Dùng strangler extraction:

1. Freeze golden content fixtures, public snapshots, admin workflows và visual
   regression trước khi đổi boundary.
2. Tạo `cms-core` neutral song song; adapter tạm chuyển current Rèm Việt types
   sang envelope mới để behavior chưa đổi.
3. Chuyển mười block schema/default sang `cms-template-rem-viet`; thêm
   `schemaVersion` và migration registry cho từng block.
4. Thay duplicated renderer/editor switches bằng typed registry, từng block một.
5. Tạo runtime ports quanh services hiện có trước khi move Drizzle code; không
   expose table/schema qua public package API.
6. Implement `cms-provider-cloudflare` bằng current D1/R2 behavior và chạy lại
   toàn bộ draft/publish/revision/media tests dưới provider conformance suite.
7. Extract admin workflow shell sau khi runtime API ổn định; giữ concrete field
   forms trong Rèm Việt template cho đến khi có block thứ hai chứng minh reuse.
8. Chuyển Alchemy/site scripts thành callable libraries rồi đặt CLI mỏng phía
   trên; giữ command cũ làm compatibility wrapper trong một deprecation window.
9. Pack artifact và cài vào clean consumer không có monorepo path alias. Consumer
   phải provision, seed, login, edit, preview, publish, restore và upload media.
10. Chuyển chính Rèm Việt sang released private package version; xóa compatibility
    bridge chỉ sau khi Rèm Việt và clean consumer cùng pass.

Migrations phải additive trước; không drop current exports, columns hoặc command
wrappers trong cùng release với lần đầu consumer chuyển sang package. Mỗi bước
phải rollback được và không phụ thuộc external Track A receipts để test local.

## 15. Risk register

| Risk                               | Xác suất / tác động | Giảm thiểu                                                 |
| ---------------------------------- | ------------------- | ---------------------------------------------------------- |
| Scope phình thành WordPress clone  | Cao / Cao           | Giữ out-of-scope, chỉ mở feature từ nhu cầu khách thật     |
| Editor phá animation/layout        | Cao / Cao           | Structured blocks, limit/reorder rules, preview validation |
| Draft leak                         | Trung / Rất cao     | Published revisions, public service riêng, automated tests |
| Xóa media đang được dùng           | Cao / Cao           | Reference scan, block delete, immutable keys               |
| Hai editor ghi đè                  | Trung / Cao         | Version field và optimistic concurrency                    |
| D1 migration làm mất data          | Thấp / Rất cao      | Additive migration, fixture upgrade, backup/restore drill  |
| Generalize package sai boundary    | Cao / Cao           | Extract proven behavior; giữ API `0.x` đến clean consumer  |
| Mỗi client fork quá xa core        | Cao / Cao           | Versioned core, upgrade notes, thin theme boundary         |
| Admin đẹp nhưng khó dùng           | Trung / Cao         | Usability script và pilot user ngoài developer             |
| Cloudflare resource name collision | Trung / Cao         | Manifest validation, stage suffix, init dry-run            |
| R2/notification partial failure    | Trung / Trung       | Idempotency, retry policy, explicit failure states         |
| Rèm Việt concept lọt vào core      | Cao / Cao           | Forbidden imports, package API review, clean consumer      |
| Provider abstraction giả tạo       | Trung / Cao         | Small ports + capability flags + conformance semantics     |
| Package/client version drift       | Cao / Cao           | Compatibility matrix, upgrade SLA, automated migration     |
| Support làm mất margin             | Trung / Cao         | Product tiers, support scope, telemetry và recurring fee   |
| Public library quá sớm             | Trung / Trung       | Private distribution trước; public chỉ từ business case    |

## 16. Definition of Done

### Core CMS competitive baseline

The core product is competitive for the agency's WordPress/Payload use case
when all of the following are true:

- A developer defines a versioned collection and its fields through public,
  code-first package APIs.
- Text, rich text, media, select, date, blocks and relationship fields share
  validation between writes, migrations and authoring UI.
- To-one and to-many relationships have typed targets, usable pickers and
  provider-enforced integrity behavior.
- The admin shell generates collection list/create/edit/filter experiences and
  still allows template-owned field components for premium UX.
- Draft, preview, schedule, publish, revision, restore, permissions and audit
  behavior apply to registered collections through capability negotiation.
- A typed extension module can register fields, collection behavior and
  lifecycle hooks without patching the core package.
- Locale-aware content and schema-aware import/export are proven on at least one
  non-Rèm Việt consumer fixture.
- Adding the feature requires no application-brand import and no duplicated
  provider/admin switch.

Operations receipts and paid-site adoption are not part of this core baseline;
they belong to the deployment and commercial definitions below.

### Track A — một client site sẵn sàng bàn giao

Không gọi một site là `client-ready` nếu thiếu bất kỳ điều kiện nào sau đây:

- Khách sửa toàn bộ homepage flagship mà không chạm JSON/code.
- Draft, preview, publish, schedule, revision và restore hoạt động end-to-end.
- Owner/Admin/Editor được enforce ở server.
- Media library quản lý alt và chặn unsafe delete.
- SEO, redirects, sitemap và leads hoạt động.
- New-site init/seed/deploy/verify chạy từ clean checkout.
- Backup và restore đã được diễn tập.
- Automated critical-path tests pass.
- Có manual cho client và runbook cho agency.
- Một pilot user không phải developer hoàn thành bài test bàn giao.

### Track B — Agency CMS Platform Kit v1.0

Không gọi Platform Kit là stable/reusable chỉ vì Rèm Việt hoặc `acme-demo` chạy:

- Package graph neutral được enforce và document; core không import app/template/provider.
- Rèm Việt dùng released package artifact qua public API như consumer bình thường.
- Một repository độc lập cài kit, add template, provision và deploy mà không copy
  source hoặc dùng monorepo path alias.
- Cloudflare D1/R2 provider pass conformance suite và production-like restore drill.
- Block registry hỗ trợ add/version/migrate editor+renderer mà không sửa core switch.
- Admin shell tái sử dụng workflow; template vẫn được phép cung cấp field UX riêng.
- CLI có plan-init/init/migrate/verify/dry-run/idempotency và fail-safe
  destructive behavior.
- Package semver, schema version, compatibility matrix, changelog và migration
  notes được kiểm tra trong release pipeline.
- Upgrade N → N+1 và rollback được diễn tập trên ít nhất một non-Rèm Việt consumer.
- Ít nhất hai independent paid sites chạy cùng versioned core và nhận được một
  core fix qua upgrade thay vì copy/paste.
- Agency có installation, template authoring, upgrade, incident và client
  handover documentation; support boundary gắn với commercial offering.

## 17. Backlog hiện tại — core competitiveness

Only this first list is active product work. Operational receipts, notification
providers, production monitoring and paid-site evidence stay in their audits
and release tracks; they are not allowed to displace these items.

1. `CMP-001` — Define provider-neutral collection, field and schema-version
   contracts in `@agency/cms-core`.
2. `CMP-002` — Add typed scalar, rich-text, media, blocks and select fields with
   defaults, validation metadata and conditional visibility.
3. `CMP-003` — Add explicit to-one/to-many relationship contracts, target
   validation and reference-integrity conformance fixtures.
4. `CMP-004` — Extend runtime/provider ports for generic collection CRUD,
   draft/publish/version lifecycle and filtered/paginated queries.
5. `CMP-005` — Generate accessible list/create/edit/filter admin surfaces from
   the collection registry with per-field component overrides.
6. `CMP-006` — Move one real Rèm Việt content type through the complete generic
   path without changing its public behavior; prove the same path in Acme.
7. `CMP-007` — Add ordered, typed lifecycle hooks and installable feature-module
   registration with isolation and permission tests.
8. `CMP-008` — Add locale-aware field/document lifecycle and independent
   preview/publish state.
9. `CMP-009` — Add typed server SDK, bounded REST resources and schema-aware,
   dry-run-first import/export.

Priority is strict: `CMP-001` through `CMP-006` are P0 and must produce one
working vertical slice before hooks, localization or additional APIs expand the
surface.

| Milestone | Status                    | Execution evidence                                                                |
| --------- | ------------------------- | --------------------------------------------------------------------------------- |
| `CMP-001` | **Complete — 2026-08-17** | `docs/cms/core-competitiveness.md#cmp-001--collection-contracts`                  |
| `CMP-002` | **Complete — 2026-08-17** | `docs/cms/core-competitiveness.md#cmp-002--typed-fields-and-shared-validation`    |
| `CMP-003` | **Complete — 2026-08-17** | `docs/cms/core-competitiveness.md#cmp-003--relationships-and-integrity-contracts` |
| `CMP-004` | In progress               | Generic provider lifecycle                                                        |
| `CMP-005` | Pending                   | Registry-generated admin                                                          |
| `CMP-006` | Pending                   | Rèm Việt plus independent Acme proof                                              |

### Historical 14-day productization backlog

Technical status on 2026-08-16: `KIT-001` through `KIT-014` pass for the
Hero/FAQ vertical slice. Evidence and the conditional go/no-go decision are in
`docs/cms/platform-kit-v0.1-slice.md` and
`docs/cms/platform-kit-v0.1-week2.md`. The approved continuation has also moved
all ten flagship contracts and both block dispatch paths behind typed
registries; see `docs/cms/platform-kit-v0.1-all-blocks.md` and ADR 0010. This
completes the first productization backlog and its all-block continuation, not
the Platform Kit v1.0 definition of done.

Backlog CMS-001 đến CMS-014 cũ đã trở thành lịch sử Track A và được evidence
trong completion audit. Backlog hiện tại bắt đầu ở boundary, không viết lại
capability đã có. Thứ tự sau là bắt buộc để tránh move code trước khi contract ổn.

### Tuần 1: lock boundary và tạo vertical package slice

1. `KIT-001` — ADR chốt product boundary, package graph, dependency direction,
   distribution private-first và tiêu chí stable `1.0`.
2. `KIT-002` — Inventory public symbols/coupling của `packages/cms`, content
   services, DB schema, admin routes, renderer, infra và `site:*` scripts.
3. `KIT-003` — Định nghĩa neutral document/block envelope, `schemaVersion`,
   capabilities và error contract; viết architecture/forbidden-import tests.
4. `KIT-004` — Tạo `cms-core` song song và compatibility adapter cho current
   `@rem-viet/cms`; chưa xóa export cũ.
5. `KIT-005` — Tạo `cms-template-rem-viet`; chuyển Hero + FAQ schema/defaults
   làm first extraction slice với golden parse/serialize fixtures.
6. `KIT-006` — Tạo typed registry API trong `cms-react`; chuyển Hero + FAQ khỏi
   duplicated switch mà không đổi markup/GSAP behavior.
7. `KIT-007` — Pack hai package slice, cài vào một minimal clean consumer fixture
   không có source alias và prove typecheck/build.

### Tuần 2: native provider slice và consumer proof

8. `KIT-008` — Định nghĩa small runtime ports cho published/draft read, save,
   publish và optimistic conflict; không expose Drizzle types.
9. `KIT-009` — Wrap current D1 page/revision behavior thành Cloudflare provider
   adapter cho vertical slice; giữ API route compatibility.
10. `KIT-010` — Tạo provider conformance fixtures cho draft isolation, publish,
    stale version, revision restore và migration empty/upgraded DB.
11. `KIT-011` — Tách generic renderer/unknown-block policy và prove SSR/public
    output parity trên Rèm Việt.
12. `KIT-012` — Chuyển `site:verify` core logic thành callable CLI library; command
    cũ trở thành thin wrapper và vẫn pass current quality gates.
13. `KIT-013` — Clean consumer dùng package artifact + Cloudflare provider để
    seed, edit draft, publish, restore và render Hero/FAQ end-to-end.
14. `KIT-014` — Ghi compatibility matrix `0.1`, extraction lessons, remaining
    coupling và quyết định go/no-go trước khi chuyển tám block còn lại.

### Demo bắt buộc cuối ngày 14

Từ một clean consumer không import source Rèm Việt, cài package artifact, đăng ký
Hero/FAQ template, chạy isolated D1, edit draft, xác nhận public isolation,
publish, restore và render đúng. Cùng test suite phải tiếp tục pass trên Rèm Việt.

Nếu demo này chưa pass, không mass-move tám block còn lại và không bắt đầu Sanity
adapter. Sửa contract/boundary trên vertical slice trước.

## 18. Decision log cần duy trì

Mọi thay đổi lớn phải có ADR ngắn trong `docs/adr/`:

- Storage shape và revision semantics.
- Rich-text format/editor choice.
- Preview authentication.
- Role/capability matrix.
- Scheduler mechanism.
- Test database strategy.
- Package graph, naming/scope và forbidden dependency direction.
- Core versus template schema ownership.
- Provider port semantics và capability negotiation.
- Private registry/package artifact provenance và release signing.
- Semantic version, content schema version và compatibility policy.
- Migration/codemod/rollback contract cho client upgrades.
- Tiêu chí mở thêm Sanity/Payload/Storyblok adapter.
- Commercial support boundary, maintenance SLA và deprecation window.

Master plan này là source of truth cho **Agency CMS Platform Kit**. `GOAL.md` cũ
vẫn là lịch sử của CMS lite V1; `docs/cms/v1-completion-audit.md` là source of
truth cho Track A release evidence, không thay thế Track B productization gates.
