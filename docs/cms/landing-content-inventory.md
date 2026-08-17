# Landing content inventory

Baseline: 2026-08-13. This is the field-by-field migration contract for turning
the current Rèm Việt homepage into the first typed CMS document. Presentation,
responsive rules and GSAP behavior remain in React.

## Global document

| Field                           | Source today                 | CMS ownership          |
| ------------------------------- | ---------------------------- | ---------------------- |
| Section order/enabled           | `routes/index.tsx` JSX order | `home.blocks[]`        |
| Navigation labels/links/cursors | `landing/navigation.tsx`     | navigation/settings    |
| Logo, phone, address, socials   | settings with fallbacks      | existing site settings |
| Theme assignment by section id  | `use-theme-by-section.ts`    | code-only              |
| Animation timing/eases/triggers | landing components           | code-only              |

Every repeatable item receives a stable `id`. Reorder is allowed only where the
renderer does not rely on a fixed narrative order; limits below are enforced by
the schema/editor.

## Block contracts

### `hero`

Source: `landing/hero.tsx`

- `kicker`
- `title.prefix`, `title.accent`
- `description`
- `background.mediaId|src`, `background.alt`, `background.position`
- `primaryCta.label`, `primaryCta.href`, `primaryCta.cursorLabel`
- `secondaryCta.label`, `secondaryCta.href`, `secondaryCta.cursorLabel`
- `features[]` (exactly 4): `id`, `iconKey`, `label`, `value`
- `scrollLabel`

Code-only: SplitText line structure, entrance ordering, parallax depths, icon
component registry and feature-bar layout.

### `threatNarrative`

Source: `landing/threat.tsx`

- `steps[]` (exactly 3): `id`, `eyebrow`, `title`, `description`
- Per step image: `mediaId|src`, `alt`, `position`, `mobilePosition`, `tone`

Code-only: pin duration, crossfade sequence, progress indicator and tone grade.

### `marquee`

Source: `landing/marquee.tsx`

- `text`
- `ariaLabel` if required by the final semantics

Code-only: repeated spans, velocity mapping, skew and animation duration range.

### `benefits`

Source: `landing/benefits.tsx`

- `eyebrow`, `intro`, `title`, `cardKicker`
- `items[]` (2-6, seeded 4): `id`, `title`, `description`, `image`, `imageAlt`,
  `iconKey`

Code-only: generated numbering, wide-card pattern, directional hover reveal.

### `craftProcess`

Source: `landing/craft.tsx`

- `eyebrow`, `title`, `intro`
- `steps[]` (2-5, seeded 3): `id`, `eyebrow`, `title`, `description`, `image`,
  `alt`

Code-only: generated numbering, sticky panel stack and scroll triggers.

### `bentoDetails`

Source: `landing/bento-details.tsx`

- `eyebrow`, `title`
- Large material card: image/alt, title, description and statistic values/labels
- Small feature cards: stable id, title, optional description/icon
- Wide standards card: image/alt, title, optional description

Code-only: bento placement variants (`large`, `small`, `wide`), glare math,
count-up formatting and grid geometry. Editor cannot select arbitrary grid spans.

### `horizontalGallery`

Source: `landing/horizontal-gallery.tsx`

- `eyebrow`, `title`
- `items[]` (3-8, seeded 4): `id`, `title`, `meta`, `image`, `alt`

Code-only: item numbering, desktop pin distance, caption reveal direction cycle
and mobile fallback.

### `measurementGuide`

Source: `landing/measure-guide.tsx`

- `eyebrow`, `title`, `intro`
- Main image/alt
- `steps[]` (exactly 3 initially): `id`, `title`, `description`, overlay/diagram
  fields currently consumed by the visual guide
- Help/CTA copy and target when present

Code-only: measurement overlay geometry, active accordion state and parallax.

### `faq`

Source: `landing/faq.tsx`

- `eyebrow`, `title`, `intro`
- `cta.label`, `cta.href`, `cta.cursorLabel`
- `items[]` (1-20, seeded 4): `id`, `question`, `answer`

Code-only: generated indices, accordion ids, transition and reveal timing.

### `footerCta`

Source: `landing/curtain-footer.tsx`

- `title.prefix`, `title.accent`
- `email`, `emailLabel`, `cursorLabel`
- Optional copyright/brand label

Social destinations, phone and address continue to come from global settings.
Code-only: curtain reveal, magnetic behavior and back-to-top control.

## Migration order and evidence

1. Hero
2. FAQ
3. Horizontal gallery
4. Benefits
5. Craft process
6. Threat narrative
7. Measurement guide
8. Bento details
9. Marquee
10. Footer CTA

For each block, capture desktop and mobile before/after screenshots, verify
reduced motion, keyboard access and the existing GSAP cleanup contract. A block
is not migrated merely because it renders; content changes must survive draft,
preview, publish and revision restore.
