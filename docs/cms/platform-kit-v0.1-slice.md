# Agency CMS Platform Kit v0.1: Hero/FAQ vertical slice

Date: 2026-08-15

## Package APIs

### `@agency/cms-core` 0.1.0

- `CmsBlock`, `cmsBlockBaseSchema`, `createCmsBlockSchema`
- `CmsDocument`, `createCmsDocumentSchema`, document status/version schemas
- capability and provider-capability contracts
- portable error schema, codes, and `CmsError`
- safe public-link/media primitives
- sequential block migration contract and `migrateBlockData`

It has one runtime dependency (`zod`) and no React, Drizzle, Cloudflare, client,
asset, or template dependency.

### `@agency/cms-react` 0.1.0

- `createBlockRegistry`
- `CmsBlockRenderer`
- typed definition, renderer-prop, registry, and unknown-block policy types

The renderer validates through the registered schema and dispatches without a
block-type switch. It is neutral and has coordinated peers on core and React.

### `@agency/cms-template-rem-viet` 0.1.0

- canonical versioned Hero/FAQ data and block schemas
- canonical defaults and schema version constant
- golden legacy-to-envelope adapters and flattened compatibility schemas
- `RemVietTemplateBlock` union and safe parser
- `createRemVietBlockRegistry`, which binds supplied concrete renderers to the
  package-owned schemas/defaults

### `@rem-viet/cms` compatibility

Existing flattened `HeroBlock`, `FaqBlock`, schemas, defaults, unions, and all
other exports retain their names and behavior. Legacy generic Hero records are
still normalized. The facade additionally exposes neutral core contracts.

## Compatibility matrix

| Concern             | Supported in v0.1                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------- |
| Kit packages        | core/react/template `0.1.0` together                                                          |
| Block schema        | Hero 1, FAQ 1                                                                                 |
| Legacy stored shape | flattened Hero/FAQ and generic legacy Hero input                                              |
| Runtime             | Bun 1.3.x; browser bundler consuming TypeScript package exports                               |
| React               | peer `>=18`; verified with React 19.2                                                         |
| TypeScript          | repository version 6; clean consumer 6.0.3                                                    |
| Consumer build      | Vite 8.2; no monorepo alias/source path                                                       |
| Provider            | `@agency/cms-provider-cloudflare` 0.1 page slice; conformance passes on isolated Miniflare D1 |

## Verification and KIT evidence

| Ticket  | Concrete evidence                                                                                                                        |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| KIT-001 | ADR 0008 fixes scope, graph, dependency direction, private-first distribution, and 1.0 gates                                             |
| KIT-002 | `platform-kit-v0.1-inventory.md` records public symbols and CMS/API/DB/admin/renderer/infra/script coupling                              |
| KIT-003 | core envelopes, schema versions, capabilities, errors, migration tests, and `cms-kit-boundaries.test.ts`                                 |
| KIT-004 | additive `@rem-viet/cms` facade imports core/template while all legacy CMS tests pass                                                    |
| KIT-005 | template-owned Hero/FAQ schemas/defaults, version 1 fixtures, round-trip and legacy adapter tests                                        |
| KIT-006 | generic typed registry plus React SSR unit test; Rem Viet renderer routes Hero/FAQ through it while retaining component markup/GSAP code |
| KIT-007 | `verify-cms-kit-consumer.ts` packs three artifacts, installs them in a fresh temp consumer, then typechecks and builds                   |

Repeatable commands:

```bash
bun run cms:kit:boundaries
bun --cwd packages/cms-core test
bun --cwd packages/cms-react test
bun --cwd packages/cms-template-rem-viet test
bun --cwd packages/cms test
bun run cms:kit:consumer
bun --cwd apps/web check-types
bun --cwd apps/web build
```

The local production-Worker harness also passes the focused desktop scenarios
`home editor exposes human forms, preview and publish workflow` and
`home draft stays private through publish and restore` (2/2), including Hero
editing, FAQ block controls, public draft isolation, publish, and restore.

## Preserved behavior

- `Hero` keeps `isLoaded`, the two scoped `useGSAP` lifecycles, SplitText,
  ScrollTrigger parallax, selectors, refs, timeline positions, and markup.
- `Faq` keeps its scoped GSAP entrances, static/mobile path, accordion state,
  ResizeObserver measurement, accessibility attributes, and markup.
- Existing database/API/admin payloads stay flattened through the facade.
- This historical slice initially left eight block render branches and defaults
  unmigrated; the all-block continuation has since completed that extraction.

## Week 2 continuation

KIT-008 through KIT-014 are evidenced in
`docs/cms/platform-kit-v0.1-week2.md`. The subsequent continuation is evidenced
in `docs/cms/platform-kit-v0.1-all-blocks.md`: six packed artifacts now install
into the clean consumer and prove the page workflow, all-ten-block SSR, and
neutral editor dispatch.

## Remaining coupling after KIT-014

- All ten contracts now live in the template package and both app switches are
  registry-dispatched. The `@rem-viet/cms` package is a compatibility facade.
- Concrete React components and theme assets remain app-owned, bound
  into the template registry; extracting their asset/hook boundary is later
  template packaging work.
- Concrete admin field editors and the workflow shell remain app-owned, but
  editor dispatch now uses `@agency/cms-admin` rather than a type switch.
- R2 media, preview/scheduling ports, Alchemy composition, and the full CLI do
  not yet exist as packages.
- `site:verify` is callable behind a thin wrapper; other repository site scripts
  still use direct source imports.

These items belong to later productization milestones. They do not invalidate
the required Hero/FAQ day-14 demo or its completed all-block continuation.
