# Platform Kit v0.1 all-block continuation evidence

Date: 2026-08-16

## Outcome

The conditional KIT-014 go decision has been exercised. All ten Rèm Việt
homepage block contracts now live in `@agency/cms-template-rem-viet`, while the
legacy `@rem-viet/cms` API and stored flattened payloads remain compatible.
Both application block switches have been replaced by typed registries.

## Evidence

| Concern              | Verified result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Template contracts   | Hero, threat narrative, marquee, benefits, craft process, bento details, horizontal gallery, measurement guide, FAQ, and footer CTA have canonical version-1 envelopes, defaults, legacy adapters, and migration lists.                                                                                                                                                                                                                                                                                                                                                                                                     |
| Golden compatibility | All ten records extracted from `packages/db/seeds/home.sql` parse and round-trip losslessly; schema-version drift is rejected per block.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Legacy facade        | `packages/cms/src/landing.ts` re-exports compatibility types/schemas/defaults and contains no duplicate Zod contract definitions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Public dispatch      | The Rèm Việt renderer validates and dispatches all ten blocks through `@agency/cms-react`; no block switch remains. Concrete components and GSAP behavior are unchanged and injected by the app.                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Admin dispatch       | `@agency/cms-admin` supplies a neutral typed editor registry; the app registers all ten existing field editors and contains no block switch.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Admin workflow       | A headless resolver combines provider support, grants, and state; shared action/status/revision slots plus a save-before-command runner compose injected app controls. Homepage, pages, and post editors adopt the relevant primitives.                                                                                                                                                                                                                                                                                                                                                                                     |
| Infrastructure       | `@agency/cms-alchemy` validates per-client names, stages, origins, required bindings, D1/R2/Worker plans, and injected resource composition. The live Alchemy stack consumes the plan.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| CLI                  | `@agency/cms-cli` supplies idempotent file plans, safe block scaffolds, contiguous value migrations, artifact/resource verification, and exact-confirmation backup/apply/verify/rollback orchestration. Existing commands remain thin adapters.                                                                                                                                                                                                                                                                                                                                                                             |
| Upgrade/rollback     | A non-Rèm consumer installs all eight `0.1.0` tarballs, upgrades to staged `0.2.0-rehearsal.1`, persists a backup-bound migration receipt for content v1→v2, then reinstalls N and verifies the backup bytes before restoring v1. D1 draft, two revisions, media metadata, and object bytes survive both transitions.                                                                                                                                                                                                                                                                                                       |
| Release distribution | A coordinated eight-artifact bundle validates version-bound compatibility, changelog, and migration notes, then records their digests with package SHA-256/size, artifact-policy counts, Git state, and lockfile. Publishable artifacts are isolated from workspace-private manifests and lifecycle hooks. A separate exact-confirmation publisher canonically validates the plan, rebuilds artifacts from the clean source, publishes restricted packages with scripts disabled, verifies exact versions, and writes complete or partial receipts. Dirty/unknown sources are non-publishable; preparation never publishes. |
| Draft workflow       | Homepage and post editors share neutral trailing-autosave, bounded draft-flush, and save-before-preview primitives; router blocking and localized popup UI remain app adapters.                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Route adoption       | Homepage and standard-page create/read/draft/publish/schedule/unpublish/delete/revision/restore select the packaged D1 provider through compatibility adapters; isolated Acme browser workflows pass these transitions.                                                                                                                                                                                                                                                                                                                                                                                                     |
| Media provider       | Portable upload/metadata/usage/safe-delete conformance passes; live list/upload/alt/delete paths use D1/R2 provider with legacy audit and cross-domain usage adapters.                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Global content       | A generic keyed runtime contract passes identical Cloudflare D1 and structural Sanity conformance for versioned site settings plus navigation. Optimistic saves, immutable history, restore-as-new-version, legacy bootstrap, public reads, and admin recovery are proven without exporting app schemas from neutral packages. Sanity hosted receipt schema v3 now requires the same global scenario, exact proof-document cleanup, and a clean full Git commit; its real-dataset receipt remains external.                                                                                                                 |
| Standard pages       | Rich-text, product-grid, and CTA blocks have versioned template contracts and adapters; public rendering is registry-dispatched; safe draft/publish/read/revision/restore/schedule paths use the packaged page provider.                                                                                                                                                                                                                                                                                                                                                                                                    |
| Slug transaction     | Published standard-page slug changes validate the redirect graph, then batch page update, page audit, 301 redirect, and redirect audit atomically through the provider hook; Acme proves the old path redirects.                                                                                                                                                                                                                                                                                                                                                                                                            |
| Packed consumer      | Eight `0.1.0` package tarballs install without workspace/source aliases, typecheck, build, execute provider conformance, render all ten published blocks, and exercise admin, Alchemy, init, migration, and verification composition.                                                                                                                                                                                                                                                                                                                                                                                       |
| Boundaries           | Neutral package tests forbid Rèm Việt, app, DB-schema, Drizzle, and Cloudflare coupling where those dependencies do not belong.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Operator contract    | `platform-kit-operator-guide.md` defines installation, template authoring, receipt-bound upgrade/rollback, incident handling, client handover, commercial support scope, response targets, and deprecation policy. Paid-site proof remains external.                                                                                                                                                                                                                                                                                                                                                                        |

## Compatibility matrix 0.1 continuation

| Layer                | Contract                                                                                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Packages             | `cms-core`, `cms-runtime`, `cms-provider-cloudflare`, `cms-react`, `cms-admin`, `cms-alchemy`, `cms-cli`, and `cms-template-rem-viet` at `0.1.0`         |
| Content              | Ten flagship and three standard-page block schemas at version 1 plus flattened compatibility adapters                                                    |
| Renderer/editor APIs | Generic typed registries with explicit unknown-type policy; neutral autosave/flush/preview, workflow command, and capability-filtered action composition |
| React                | Peer `>=18`; clean consumer verified on React 19                                                                                                         |
| Persistence          | D1 pages/revisions plus keyed `cms_globals`/`cms_global_revisions` through neutral provider ports                                                        |
| Distribution proof   | Eight packed artifacts only; no monorepo TypeScript alias or source import                                                                               |

## Remaining coupling and next gate

- Concrete landing components, CSS, assets, and GSAP hooks remain app-owned.
- Concrete Rèm Việt field controls, publish/revision copy, conflict presentation,
  outer page-shell layout, and tRPC transport bindings remain app-owned. Editor
  dispatch, autosave, bounded flush, preview gating, provider-capability workflow
  resolution, save-before-command execution, and action/status/revision
  composition are neutral primitives.
- Homepage and standard-page create, public read, draft save, publish,
  revision list, restore, schedule, unschedule, unpublish, and delete use the
  packaged provider. Published standard-page slug changes also batch their 301
  redirect and both audit events through the provider transaction hook.
- Site settings and header/footer navigation now read, save, list immutable
  revisions, and restore through the packaged keyed global-content provider.
  Concrete schemas, localized forms, and public chrome mapping remain app-owned.
- The metadata-only `content.media.create` compatibility mutation still uses
  the legacy service because it has no R2 object body; UI upload/list/update/
  delete paths are provider-backed.
- Authenticated preview, scheduler execution, audit, and full page-shell
  transport are not extracted. The migration orchestrator is neutral and
  packaged; provider-specific D1 backup/apply/restore command drivers and their
  deployed receipts remain client adapters. Alchemy SDK factories remain a
  pinned consumer adapter around the neutral resource plan.
- The repeatable local N to N+1 package/content upgrade-and-rollback receipt is
  complete. Local release preparation and the guarded publication executor are
  fail-closed. An actual private registry publication receipt, independent
  staging consumer, and two-paid-site evidence remain open.

The next external gate is a private registry publication and independent staging
install. Reusable admin transport bindings and a fuller page-shell layout remain
explicit consumer adapters rather than blockers to the headless package contract.
Stable 1.0 remains a no-go until the master-plan release, operations, and
multi-site gates are evidenced.

Agency operation and support procedures are consolidated in
`docs/cms/platform-kit-operator-guide.md`.

## Repeatable verification

```bash
bun run cms:kit:boundaries
bun --cwd packages/cms-admin check-types
bun --cwd packages/cms-admin test
bun --cwd packages/cms-alchemy check-types
bun --cwd packages/cms-alchemy test
bun --cwd packages/cms-cli check-types
bun --cwd packages/cms-cli test
bun --cwd packages/cms-template-rem-viet check-types
bun --cwd packages/cms-template-rem-viet test
bun --cwd packages/cms-provider-cloudflare test
bun run cms:kit:consumer
bun run cms:kit:upgrade
bun run cms:kit:release:prepare --version=0.1.0
# Authorized release environment only:
bun run cms:kit:release:publish --bundle=<prepared-bundle> --confirm=<exact-confirmation>
bun --cwd apps/web run check-types
bun --cwd apps/web run build
```
