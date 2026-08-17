# Platform Kit v0.1 Week 2 evidence

Date: 2026-08-16

## Outcome

KIT-008 through KIT-014 are complete for the Hero/FAQ vertical slice. The demo
gate passes: a clean consumer installs packed artifacts without source aliases,
initializes an isolated page store, seeds Hero/FAQ, edits a working draft,
proves the public snapshot is unchanged, publishes, restores, and renders the
published blocks through the generic registry.

## Ticket evidence

| Ticket  | Evidence                                                                                                                                                                                     |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| KIT-008 | `@agency/cms-runtime` defines small read, draft-write, and publishing ports with normalized values and portable errors.                                                                      |
| KIT-009 | `@agency/cms-provider-cloudflare` implements those ports over the existing `pages`/`page_revisions` shape without exporting Drizzle or table types.                                          |
| KIT-010 | The shared conformance scenario covers empty state, isolation, publish, stale version, two revisions, and restore; provider tests cover empty/upgraded migrations and isolated Miniflare D1. |
| KIT-011 | Hero/FAQ remain registry-dispatched in the Rèm Việt renderer; the clean consumer proves published SSR through the same generic renderer and template registry.                               |
| KIT-012 | `verifySite()` contains callable verification logic; `site-verify.ts` is a thin compatibility wrapper, with Acme fixture tests.                                                              |
| KIT-013 | `cms:kit:consumer` packs five packages, installs them into a copied clean fixture, typechecks, builds, runs workflow conformance, and verifies Hero/FAQ SSR.                                 |
| KIT-014 | This matrix records compatibility, remaining coupling, and the go/no-go decision.                                                                                                            |

## Compatibility matrix 0.1

| Concern              | Verified contract                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Coordinated packages | `cms-core`, `cms-runtime`, `cms-provider-cloudflare`, `cms-react`, and `cms-template-rem-viet` at `0.1.0`         |
| Content schema       | Hero 1 and FAQ 1, including flattened legacy adapters                                                             |
| Runtime workflow     | Draft create/read/save, published read, optimistic conflict, publish, revision list, restore                      |
| Persistence          | Existing D1 `pages` + immutable `page_revisions`; schema migration 1 is idempotent on empty and upgraded fixtures |
| Cloudflare runtime   | Isolated Miniflare D1 using the Workers SDK version bundled with Wrangler 4.123                                   |
| Clean consumer       | Bun 1.3, TypeScript 6, Vite 8, React 19; only packed artifact paths, no monorepo alias                            |
| Renderer             | Generic typed registry with explicit unknown-block policy; Hero/FAQ SSR verified after provider publish/restore   |
| CLI compatibility    | Existing `site:verify` command preserved as a thin wrapper over callable logic                                    |

## Remaining coupling

- The subsequent all-block continuation is recorded in
  `platform-kit-v0.1-all-blocks.md`; all ten contracts and renderer/editor
  dispatch paths have now moved behind the package boundaries.
- Concrete visual components, CSS, assets, GSAP hooks, and field editors remain
  owned by the Rèm Việt app and are injected into the registries.
- The all-block continuation has since moved homepage draft-save,
  revision-list, publish, and restore routes onto the D1 provider through a
  compatibility codec. Other page routes remain on the additive workflow
  service.
- The reusable admin workflow shell is still app-owned even though editor
  dispatch is now registry-based.
- R2 media, scheduling, preview, audit, Alchemy composition, and full CLI init/
  migrate commands have not been extracted.
- The clean consumer is an independent fixture executed from packed artifacts,
  not yet a separately maintained paid-client repository or staging receipt.

## Go/no-go

**GO was granted and exercised for the remaining eight template block
contracts.** The result is evidenced in `platform-kit-v0.1-all-blocks.md`.

**NO-GO for stable 1.0, mass-moving workflow/runtime code, or starting a second
provider.** The remaining coupling above, an N to N+1 upgrade/rollback proof,
private release provenance, R2/media conformance, independent staging, and two
paid sites are still required by the master plan.

## Repeatable verification

```bash
bun run cms:kit:boundaries
bun --cwd packages/cms-runtime check-types
bun --cwd packages/cms-runtime test
bun --cwd packages/cms-provider-cloudflare check-types
bun --cwd packages/cms-provider-cloudflare test
bun test scripts/site-verify-lib.test.ts
bun run site:verify --site=acme-demo
bun run cms:kit:consumer
```
