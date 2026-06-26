# AGENTS.md — rem-viet

Quick, verified facts for agents working in this monorepo. Detailed conventions live in `MIGRATION.md` and per-package READMEs.

## Verification commands

- **Typecheck in `apps/web`**: the script is `check-types` (not `typecheck`).
  ```bash
  cd apps/web && bun run check-types   # tsc --noEmit
  ```
- Build: `cd apps/web && bun run build` (vite build; covers CSS validation).

## Landing page migration (`apps/web/src/landing.css` + `components/landing/`)

The landing page is being migrated from `draft/index.html` + `draft/style.css` to React.
`landing.css` is the canonical CSS — do **not** rewrite it from scratch; extend it section by section.

## Animation stack (GSAP) — as of 2026-06-14, full migration

The landing page animation stack is **GSAP + Lenis**. `framer-motion` was removed entirely
(`package.json` no longer lists it; zero imports remain in `src/`). Foundations:

- **`apps/web/src/lib/gsap.ts`** registers plugins once at module load and re-exports
  `gsap`, `ScrollTrigger`, `SplitText`, `CustomEase`, `useGSAP`, and `prefersReducedMotion`.
  Import GSAP from `@/lib/gsap` everywhere — never register plugins per-component.
- **Lenis ↔ ScrollTrigger sync** (`<GsapScrollSync />` in `routes/index.tsx`, rendered as
  the first child inside `<ReactLenis>`): wires `lenis.on("scroll", ScrollTrigger.update)`
  so every scrubbed/pinned animation stays in lock-step with Lenis's eased scroll, plus a
  debounced `ScrollTrigger.refresh()` after load.
- **`useGSAP()` from `@gsap/react`** is used in every animated component (auto-cleanup of
  tweens + ScrollTriggers + SplitText DOM). Pass `{ scope: ref }` and a `dependencies` array
  when the animation must re-run on a prop change (e.g. Hero re-runs on `isLoaded`).
- **`useSplitReveal()`** (`apps/web/src/hooks/use-split-reveal.ts`) is the shared masked
  word/char/line heading reveal — used by every section `<h2>`. It creates a `SplitText`
  inside `useGSAP` (auto-reverted), respects `prefers-reduced-motion`, and returns a ref.
- **Reduced motion**: all heavy animations short-circuit via `prefersReducedMotion()`.
- **Shared `<RevealImage>`** (`components/landing/reveal-image.tsx`) consolidates the
  cinematic clip-path + scale + parallax image reveal used by Threat, Craft (was duplicated).

Known state (as of 2026-06-12, bento-details + horizontal-gallery + FAQ tracks):
- `.bento-box` has `position: relative; overflow: hidden;` (added when bento-bg landed). Do not remove.
- `.bento-large` = `grid-column: span 2; grid-row: span 2;` (the 2x2 left box).
- `.bento-wide` = `grid-column: span 2;` (the wide bottom-right box).
- `.bento-box:has(.bento-bg)::after` provides the gradient overlay on image-backed boxes.
- Gallery captions use `.gallery-item` (with `position: relative; overflow: hidden;`) and a `.gallery-caption` absolutely positioned child.
- FAQ accordion uses `.faq-item / .faq-head / .faq-icon / .faq-body / .faq-body-inner` and rotates the `+` icon to 45° via `.faq-item.active .faq-icon`.
- `#smooth-wrapper` keeps a `margin-bottom: 100vh` (70vh on mobile) to make room for the fixed `<CurtainFooter />` which lives **outside** `<main>` in `routes/index.tsx`.
- `.curtain-footer` is `position: fixed; bottom: 0; left: 0; width: 100%; height: 100vh; z-index: 1;` (full-screen, behind `#smooth-wrapper` whose `z-index: 2` keeps page content above the footer during scroll). `.curtain-footer .footer-cta { margin: 0; text-align: center; }` centers the "Bắt đầu / dự án của bạn." + `mailto:` block.
- AWWWARDS loader (`apps/web/src/components/loading-screen-raw.tsx`): markup must be `.loader > .loader-counter + .loader-overlay.loader-overlay-top + .loader-overlay.loader-overlay-bottom` (matches `draft/index.html` line 22-26). The CSS in `landing.css` line 86-118 already styles every piece. While the loader is up, the effect is two full-width black panels covering the top and bottom halves; the counter sits at `z-index: 9001` between them. On reveal: a single **GSAP timeline** counts `0% → 100%` in 2s with the `loader-load` CustomEase (`[0.76, 0, 0.24, 1]`), fade+lifts the counter (`loader-reveal` = `[0.19, 1, 0.22, 1]`), then `scaleY: 0` both panels (1s, `loader-load` ease) with `transform-origin: top` / `transform-origin: bottom` so the top slides up and the bottom slides down. On the bottom panel's `onComplete`: remove `body.is-loading` (CSS line 33-35 is `overflow: hidden`), set `display: none` on the loader, call the parent `onComplete` so `routes/index.tsx` flips `isLoaded = true` and `Hero` starts animating.

Known state (as of 2026-06-12, hero track):
- Hero uses **`.hero-new`** (full-bleed bg, overlay content left) — NOT the old `.hero` 6/4 grid.
  Old `.hero` / `.hero-grid` / `.btn-explore` rules are kept in `landing.css` (zero JSX
  hit) for easy rollback. Don't re-enable them when touching hero.
- Hero background: `/assets/7c9323bc-888a-4cba-b876-f0aa79b35158.png` (copied from
  `draft/assets/`). All draft assets must be copied to `apps/web/public/assets/`
  before referencing them.
- Hero feature bar (`.hero-features-bar`) is glassmorphism 4-column at the bottom of
  `.hero-new`. CSS uses `@supports (animation-timeline: view())` for scroll-driven
  `featureBarReveal` (exit 0% → 50%). `transform: translateY(0) scale(1)` is the
  initial state — do NOT pre-apply scale(0.95) or the entrance will look wrong.
- Hero is gated by `isLoaded` prop (parent `<LoadingScreenRaw>` sets it to `true` on
  `onComplete`). Entrance is a single **GSAP timeline** keyed on `isLoaded`
  (`useGSAP({ dependencies: [isLoaded], revertOnUpdate: true })`). The title lines
  (`.hero-title-line` = `overflow: hidden` masks) are split into chars via `SplitText`
  and revealed with a staggered `yPercent` + blur-to-sharp. The original stagger
  positions are preserved: kicker 0.10 → Rèm 0.18 → Vina 0.30 → desc 0.58 → CTA 0.76
  → feature bar 0.90.
  Do NOT remove `isLoaded` from the signature — Loader contract depends on it.
- Native CSS scroll parallax on `.hero-new-bg img` uses
  `@supports (animation-timeline: view())` with `@keyframes heroParallax`
  (`translateY(0) → translateY(150px)`, range `entry 0% exit 100%`). Works only
  in modern Chromium; Safari/Firefox fall back to no parallax (acceptable).

Magnetic effect on `.hover-target`:
- **Two implementations coexist**, by design (both now GSAP-based):
  1. **Per-link** `useMagnetic` hook in `apps/web/src/hooks/use-magnetic.ts`
     (GSAP `quickTo` per axis + mouse listener). Smooth trailing follow,
     used by `<Navigation>`'s `<MagneticLink>` wrapper (a plain `<a>` now —
     the hook applies the transform directly, no MotionValues returned).
  2. **Scope-based** `useMagneticScope` hook in `apps/web/src/hooks/use-magnetic-scope.ts`
     (MutationObserver + GSAP `quickTo` follow on move, `elastic.out` return on leave).
     Bouncier AWWWARDS-style, applied to all other `.hover-target` elements page-wide.
- The scope **excludes `.nav`** (to not fight with the per-link `x,y` on the
  same element's transform). It also **excludes `#cursor`** (custom cursor).
  Both exclusions are required — do not remove them.
- Both hooks skip `(pointer: coarse)` devices (no magnetic on touch).
- Scope is mounted once in `routes/index.tsx` via `useMagneticScope()` and uses
  a `__magneticScopeBound` marker on the element to prevent double-binding when
  the MutationObserver re-runs.

Custom cursor label (`apps/web/src/components/custom-cursor-raw.tsx`):
- The cursor already supports `data-cursor="..."` labels via a `mouseover`/
  `closest('.hover-target, a, button, ...')` chain. There is also an
  explicit `querySelectorAll('[data-cursor]')` binding with
  `mouseenter`/`mouseleave` (gated by `__cursorLabelBound`) plus a
  `MutationObserver` that re-binds new label targets as they're inserted.
  The explicit layer is the source of truth for `mouseleave` semantics on
  nested DOM trees; the `mouseover` chain is kept for cheap dynamic
  discovery. Don't drop either.
- The label span has `font-vietnam` (Be Vietnam Pro) so the typography
  matches the rest of the site. The visual styling (10px, uppercase,
  `tracking-widest`, contrast color via parent's `mix-blend-mode: difference`)
  lives in `landing.css` lines 57-84. Do not re-style inside TSX.

Scroll progress bar (`apps/web/src/components/scroll-progress.tsx`):
- Uses GSAP `ScrollTrigger.create({ start: 0, end: "max" })` + `gsap.quickTo(bar, "scaleX", …)`
  for a smooth, slightly-trailing follow (replaces the old framer-motion `useScroll` +
  `useSpring`). The bar is `position: fixed; top: 0; height: 3px;` with `z-index: 9999`
  and `background-color: var(--accent-color)` so it re-tints automatically
  when `useThemeBySection` flips `<html data-theme="...">`.
- Z-index layering convention on this page: cursor 10000 > progress 9999
  > loader 9000. DOM order is irrelevant for visual layering as long as
  the z-index ladder holds.
- Mounted in `routes/index.tsx` immediately after `<LoadingScreenRaw />`.

Navigation anchors (`apps/web/src/components/landing/navigation.tsx`):
- Section ids that exist: `home` (hero), `threat`, `details` (bento),
  `craft`, `lifestyle` (horizontal gallery), `measure`, `faq`, `order`
  (curtain footer). **`#vision` does NOT exist** — the nav "Tầm Nhìn"
  link was remapped to `#threat` (label kept). If you add new sections
  in the future, add the id to the section element AND update the nav
  `href` AND add a `data-cursor` label here.
- Anchor clicks use `element.scrollIntoView({ behavior: 'smooth' })`
  (intercepted by `<ReactLenis root>` which runs the eased scroll
  engine). Do NOT switch to `window.scrollTo` — Lenis only intercepts
  the native API, not the imperative window scroll.
- Nav `data-cursor` labels (AWWWARDS convention — driven by
  `custom-cursor-raw.tsx`): "Tầm Nhìn"/"Chi Tiết"/"Cách Đo" → "Xem",
  "Tư Vấn" CTA → "Liên hệ". Curtain footer mailto link → "Đặt may".

## Design system + AWWWARDS upgrades — as of 2026-06-14

A visual-quality pass layered on top of the GSAP migration. Foundations in
`landing.css`; behavior in the landing components.

### Design tokens (`landing.css` top)
- A fluid **type scale** is now a real ladder, not hardcoded px: `--fs-display`
  (`clamp(64px,13vw,200px)`), `--fs-h1`, `--fs-h2`, `--fs-h3`, `--fs-lead`,
  `--fs-body`, `--fs-small`, `--fs-eyebrow`, `--fs-label`. Section titles, hero
  title, `.massive-text`, measure/craft/threat titles all reference these.
- **Spacing**: `--space-section` (`clamp(96px,16vh,200px)`), `--space-block`,
  `--space-gutter` (4vw). Section padding uses these instead of raw `vh`.
- **Accent per theme**: new `--accent` / `--accent-soft` tokens; light keeps
  brass `#B58A43`, dark brightens to champagne `#D6BB82`. The old
  `--accent-color` still exists (legacy alias) but selectors now use `--accent`.
- **Theme-aware muted text + hairlines**: `--text-muted`, `--text-faint`,
  `--hairline`, `--hairline-strong` — all `color-mix` on `--text-color` so they
  work on cream AND black. **All** old hardcoded `#999/#777/#666/#555` and
  `rgba(17,17,17,0.1)` borders were replaced with these (fixes the dark-section
  invisible-border bug). The bento image gradient uses `var(--bg-color)` too.

### Texture
- `.noise-overlay` upgraded: opacity 0.04→0.06 + `mix-blend-mode: overlay`
  (film-stock grain that reacts to luminance).
- New `.vignette-overlay` (fixed, z-9998) renders a subtle radial edge
  darkening for cinematic depth. Mounted in `routes/index.tsx` next to the
  noise overlay.
- Hero gets its OWN heavier `.hero-grain` (opacity 0.12, finer `baseFrequency`
  0.9) + `.hero-vignette` (radial focused bottom-left) — both parallax layers.

### Signature eases (`lib/gsap.ts`)
Two CustomEases created at module load, shared site-wide (import nothing extra;
just use the string name):
- `"cinematic"` (`0.16,1,0.3,1`) — gentle overshoot for entrances/hero title.
- `"settle"` (`0.34,1.56,0.64,1`) — quick-build-then-settle for count-ups.

### Hero signature moment (`components/landing/hero.tsx`)
- DOM gained `.hero-grain`, `.hero-vignette`, `.hero-scroll-cue` (+ inner
  `.hero-scroll-cue-line`) layers. The bg `<img>` now has its own ref.
- **3-layer scrubbed parallax** (separate `useGSAP`, mount-only): bg img
  `yPercent 0→18`, grain `0→8`, content `-8` (+opacity fade), feature bar
  exits over the first half. Depth on scroll.
- Entrance timeline uses `"cinematic"` ease; kicker gains a `::after`
  underline that draws via the `--kicker-underline-w` CSS var (0→1).
- Scroll cue bounces on an infinite yoyo (`scaleY 1→0.6`, sine.inOut). Hidden
  on `(pointer: coarse)` / `max-width:768px`.

### Threat — now a PINNED narrative (`components/landing/threat.tsx`)
- Rewritten from a flat scroll-thru into a ScrollTrigger **pin** (`start:"top
  top"`, `end:"+=200%"`, `scrub:1`, `pin:true`). Three `.threat-step` blocks
  cross-fade in sequence (eyebrow→title→desc each), stacked absolutely in a
  `.threat-stage`; first step takes the flow for intrinsic height.
- `<RevealImage>` is the backdrop (absolute, full-bleed) with a
  `.threat-backdrop-veil` darkening gradient. The old `.container`/
  `.threat-content` markup is hidden when `.pinned` is on the section.
- CSS: `.threat.pinned` rules in `landing.css` (search "Threat pinned
  narrative"). The plain `.threat/.threat-content/.threat-title` rules remain
  as a non-pinned fallback.

### RevealImage direction prop (`components/landing/reveal-image.tsx`)
- New `direction?: "center" | "left" | "right" | "top"` (default `"center"`).
  Changes the closed clip-path the mask opens FROM, so each section can reveal
  differently. **Threat**=center, **Craft**=left, **Measure** keeps its own
  top-down `ParallaxImage`. Don't make two adjacent sections use the same one.

### BentoDetails glare + count-up (`components/landing/bento-details.tsx`)
- `BentoBox` now renders a `.bento-glare` `<span>` (z-4) — a radial highlight
  positioned by `--glare-x/--glare-y` (0–1) GSAP `quickTo` writes on mousemove,
  opacity fades in on hover. Drop-shadow deepens on hover (CSS). Coarse
  pointers / reduced motion skip it.
- Count-up uses the `"settle"` CustomEase (was `power4.out`).

### HorizontalGallery directional captions (`components/landing/horizontal-gallery.tsx`)
- Captions reveal via **clip-path from a different direction per slide**
  (left→right, right→left, top→bottom, repeat) scrubbed across the horizontal
  pass. Gallery images also scale `1.08→1` as they cross center.

### Marquee velocity (`components/landing/marquee.tsx`)
- Beyond the 30s→12s speed mapping, the marquee now **skews** briefly in the
  scroll direction on fast scroll (`getVelocity()` → `skewX` ±6° clamped) then
  settles to 0 via a `quickTo`. Reduced motion keeps speed-mapping only.
- `.marquee-inner` got `transform-origin:center; will-change:transform`.

### Magnetic feedback (`hooks/use-magnetic.ts`)
- Nav links (`<MagneticLink>`) now scale to `1.04` on enter and return with an
  `elastic.out(1,0.5)` settle (was a plain power3 return). More tactile.

### Benefit card hover (`landing.css`)
- `.benefit-card::before` is an accent-colored top line that scales in
  (`scaleX 0→1`) on hover; the icon lifts `-4px`; opacity →1. Pure CSS.

### Full-viewport sections use `dvh` (not `vh`/`svh`)
- As of the dvh pass, every **full-viewport container** uses `dvh` so it
  tracks the mobile dynamic viewport (no content hidden under the
  address bar). Converted: `.hero-new` (3 breakpoints), `.threat.pinned`,
  `.sticky-wrapper` (gallery pin), `.curtain-footer` (+ mobile 70dvh),
  `#smooth-wrapper` `margin-bottom` (100dvh desktop / 70dvh mobile — these
  two MUST match), `.loader` + `.loader-overlay` (100dvh / 50dvh),
  `.noise-overlay`.
- **`.hero-new` uses `height: 100dvh` (exact, NOT `min-height`)** + the
  existing `overflow: hidden`. `min-height` let the content block + feature
  bar push the section past the viewport (≈17px overflow, feature bar half-
  cut). Exact `height` + `overflow:hidden` forces hero to fit one screen
  exactly. Same at both responsive breakpoints.
- **Left as `vh` deliberately**: `.horizontal-scroll` `300vh` (the
  intentional scroll distance for the gallery pin), `.details-visual` /
  `.portrait-mask` / `.gallery-track` (image/region heights, not
  full-viewport), and the old `.hero` / `.hero-visual` legacy fallback
  rules (zero JSX hit). Don't "clean up" these without checking intent.

## Tailwind v4 migration — as of 2026-06-15

The landing page now uses **Tailwind v4.2.2 utilities** in component markup
(`.tsx` classNames) for most layout/typography/color. `landing.css` shrank
from 1844 → 860 lines (the "CSS tail" — see below for what stayed).

### Tailwind config location
- **No JS config file.** All config is CSS-driven in
  `packages/ui/src/styles/globals.css` (`@theme inline`, `@source`, `@custom-variant`).
- The web app loads it via `apps/web/src/index.css` → `@import "@rem-viet/ui/globals.css"`.

### Custom tokens (auto-generate utilities)
Added to the `@theme inline` block in globals.css — these create utilities you
can use directly in any `.tsx`:
- **Type scale**: `text-display`, `text-h1`, `text-h2`, `text-h3`, `text-lead`,
  `text-body`, `text-small`, `text-eyebrow`, `text-label` (fluid `clamp()`).
- **Spacing**: `p-section`, `gap-block`, `m-section` etc. (via `--spacing-section`/`--spacing-block`).
- **Brand colors**: `text-brand`, `bg-brand`, `text-brand-soft`,
  `text-ink`, `bg-canvas`, `text-muted-ink`, `border-hairline`,
  `border-hairline-strong`. These resolve through the landing theme vars
  (`--accent`, `--text-color`, `--bg-color`) so they **flip with `data-theme`**.
- **Animations**: `animate-marquee`, `animate-hero-parallax`,
  `animate-feature-bar-reveal` (registered via `--animate-*`).

### Custom variants
- `hoverable:` — `@media (hover: hover)` (fine-pointer only; use for hover
  styles that must NOT apply on touch tap).
- `coarse:` — `@media (pointer: coarse)`.

### What's in the CSS tail (`landing.css`, ~860 lines)
These **cannot be Tailwind utilities** and stay as plain CSS:
1. `:root` token blocks + `:root[data-theme="dark|light"]` theme engine (the
   `data-theme` switching is **separate** from Tailwind's `.dark` class — don't
   merge them).
2. `@keyframes` (7 remain: marquee, heroParallax, featureBarReveal, fm-fade-in,
   fm-reveal-up, fm-clip-reveal-down, fm-clip-reveal-center).
3. `@supports (animation-timeline: view())` block (scroll-driven CSS — zero
   Tailwind support).
4. `body:not(.is-loading)` SSR fallback animations (ancestor class + `:nth-child` delays).
5. Pseudo-element multi-stop gradients: `.hero-new-bg::after`,
   `.hero-new-kicker::after`, `.hero-grain`, `.hero-vignette`,
   `.gallery-item::after`, `.benefit-card::before`,
   `.bento-box:has(.bento-bg)::after`.
6. State-class hooks + descendant combos: `.cursor.hovering/.has-text`,
   `.faq-item.active .faq-icon`, `.faq-item:last-child`,
   `.acc-item.is-open .acc-icon/.acc-body`,
   `.benefit-card:hover` (`@media hover:hover`), `.bento-glare` opacity.
7. `.bento-grid`, `.bento-box`, `.bento-large/wide/small/stat`, `.bento-bg`,
   `.bento-content`, `.stat-item/num/lbl` — complex grid + `:has()` overlay.
8. `.threat.pinned` context rules + `.threat-backdrop .reveal-*`.
9. `.reveal-container[data-aspect] .reveal-mask` (attribute selector).
10. GSAP-tweened custom props: `.hero-new-kicker { --kicker-underline-w }`.
11. Shared utility classes still used across components: `.container`,
    `.grid-12`, `.col-4/5/6/8`, `.col-start-8`, `.align-center`,
    `.section-eyebrow`, `.massive-text`, `.img-mask`, `.portrait-mask`,
    `#smooth-wrapper`, `.noise-overlay`, `.vignette-overlay`, `.dark-theme`.

### Convention going forward
- **New components / simple layout**: write Tailwind utilities in className.
- **Animations, pseudo-elements, scroll-driven, theme switching**: keep in
  `landing.css` (or add `@utility` blocks in globals.css for reusable ones).
- When adding a new section title, use the tokens: `text-h1`/`text-display`,
  `text-brand`, `border-hairline` — not raw `clamp()`/`color-mix()`.
- The legacy `.hero` / `.hero-grid` / `.hero-heading` / `.hero-desc` /
  `.btn-explore` / `.hero-visual` / `.details*` rules were **deleted** (zero
  JSX refs after migration). Don't re-add them.

## Public assets

All landing images live in `apps/web/public/assets/` and are referenced as `/assets/<name>`.
If a draft asset is missing, copy it from `draft/assets/` first (verify with `ls public/assets/`).
