# Worker report — hero-ux-ui-20260910 (revision 1)

**Status: COMPLETE** — hero UX/UI materially improved, all checks pass, browser-verified at 4 viewports plus keyboard/reduced-motion. Focused diff: 2 files (`apps/web/src/components/landing/hero.tsx`, `apps/web/src/landing.css`). No commit/push/deploy; nothing outside scope touched (`.mavis`/`.opencode` state untouched).

## Changes

All in `C:\Users\terasumi\Documents\source_code\rem-viet\apps\web\src\components\landing\hero.tsx` and hero-specific rules in `C:\Users\terasumi\Documents\source_code\rem-viet\apps\web\src\landing.css`. CMS `HeroBlockData` bindings, hrefs, `data-cursor` labels, `isLoaded` gate, GSAP imports/scope/cleanup, loader timings, static/reduced-motion/coarse paths, and the feature-bar initial `translateY(0) scale(1)` are all preserved.

1. **Legibility scrim** (landing.css `.hero-new-bg::after`, static, never animated): controlled left + bottom darkening so white type holds on the bright interior photo; separate steeper bottom-weighted variant under 640px. The right/top of the photograph stays clear, preserving the premium curtain imagery.
2. **Type & accent colors** (hero.tsx): kicker and title accent word switched `text-white/78` / `text-brand` → `text-brand-soft` (champagne brass, robust on the dark scrim in both data-themes); description `white/78 → white/88`. Vietnamese diacritics verified unclipped in screenshots.
3. **CTA hierarchy & affordances** (hero.tsx): primary keeps solid brass, adds hover lift + arrow micro-nudge + deeper shadow; secondary rebuilt from near-invisible `bg-white/12` glass to readable dark glass (`bg-black/50` + blur, lighter border, brass icon). Both 48px tall (44px on small screens), with visible keyboard focus.
4. **Feature strip contrast** (hero.tsx + landing.css): darker glass bar `rgba(15,12,9,0.4)` (was `white/12`), brass icons, labels `white/62 → white/80`. Per-tile `bg-black/18` removed (bar provides the glass).
5. **Compact landscape layout** (landing.css, new `@media (min-width: 641px) and (max-height: 500px)` block, placed after the 1024px block so it wins the cascade): at 844×390 the previously broken layout (kicker colliding with the fixed nav, absolute 2-col feature bar overlapping CTAs/description) now stacks content + a single-row 4-column static feature strip from the bottom with zero overlap and nothing hidden. Section top padding now `max(14vh,76px)` to always clear the nav.
6. **Fixed broken hero CTA navigation** (pre-existing bug, hero-local fix): hero CTAs were plain anchors; `#order` is the `position:fixed` curtain footer, and `scrollIntoView` is a no-op for fixed elements (and a native hash jump snaps back under Lenis), so "Tư vấn kích thước" never navigated. New `handleAnchorClick` (same contract as `navigation.tsx`) scrolls flow targets via `scrollIntoView` and travels to the document bottom for fixed targets. Verified: Enter on the focused CTA scrolls to the fully revealed curtain footer (`scrollY 16443`, `nearBottom: true`).
   - Note (out of scope, pre-existing): nav "Tư Vấn" and FAQ CTA also point at `#order` and likely share this no-op; left untouched per scope.

## Checks (exact)

- `cd apps/web && bun run check-types` → **exit 0** (log: `.zcode-dispatch/run-hero-ux-ui-20260910/check-types.log`)
- `cd apps/web && bun run build` → **exit 0**, built in ~4s (log: `.zcode-dispatch/run-hero-ux-ui-20260910/build.log`)
- No baseline failures encountered in either.

## Browser verification (Playwright + Chrome 152, headless, against `http://127.0.0.1:4313/`)

- Screenshots at 1440×900, 390×844, 375×667, 844×390 — before and after:
  `.zcode-dispatch/run-hero-ux-ui-20260910/screenshots/before/` and `.../after/` (`desktop-1440x900.png`, `mobile-390x844.png`, `mobile-375x667.png`, `landscape-844x390.png`).
- Horizontal overflow: `scrollWidth === innerWidth` at all four viewports (measured, not eyeballed).
- Keyboard: real Tab presses reach the primary CTA; visible white focus outline verified via computed style (`outline: ... solid 2px`) and close-up `screenshots/verify/focus-primary.png`.
- CTA navigation: `screenshots/verify/after-primary-click.png` shows the revealed `#order` curtain footer after Enter.
- Reduced motion (`prefers-reduced-motion: reduce`): kicker/title/description/CTAs/features all visible immediately, underline drawn (`--kicker-underline-w: 1`); `screenshots/verify/reduced-motion.png`.
- Tap targets: 48px desktop, 44px mobile (`min-h-12` / 44px), measured 167×44 on 390 width.

## Local preview repair (dev-only state, no source changes)

The supervisor's preview returned 500 for two stacked reasons; both were repaired in local dev D1 only (`apps/web/.wrangler/state/v3/...`, gitignored):

1. Applied 3 pending migrations (0023–0025) — cleared `D1_ERROR: no such column: published_revision_id`.
2. The stored published homepage revision was stale: missing per-block `id/enabled/cursorLabel` **and** the snapshot-level `template: "landing"` key that `parseRemVietHomeContent` requires → `Invalid Rèm Việt homepage content.`. Repaired via `json_set` (scripts kept: `repair-all-blocks.ts/.sql`, `repair-gallery-block.ts/.sql` in the dispatch dir). The repo seed does not repair this case (it only upgrades a hero-only fixture).

**Limitation for supervisor:** the 4312 server (PID 12808) was serving the stale error and then got its SSR wedged (health endpoint fine, `/` hangs) — same behavior my own instance showed before restart. It needs a restart to serve the repaired DB; I did not kill the supervisor's process. My isolated instance on **port 4313** (background task `exec_49322437-8f76-40e1-b56f-02adf9ca0524`, log `preview-4313.log`) serves the fixed content and was used for all verification above.

## Remaining limitations

- Verification used Playwright/Chromium only (Browser Use session unavailable); no Safari/Firefox or real-device checks.
- Exact contrast ratios were tuned by scrim math + screenshot inspection, not an automated WCAG audit (axe is available in the repo if the supervisor wants a pass).
- The `focus-visible:ring-*` utilities were replaced with `outline-*` because ring layers did not paint on this stack (Tailwind 4.2.2 + Chrome 152) despite the var being set; recorded for future work.
- The short-landscape bucket triggers at ≤500px height; viewports between 500–667px height in landscape use the existing 1024px-breakpoint layout (verified non-overlapping at 800×600 geometry by measurement math, not screenshotted).
