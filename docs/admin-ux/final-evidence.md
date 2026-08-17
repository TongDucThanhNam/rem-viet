# CMS admin UX final evidence

Date: 2026-08-16

## Acceptance summary

The approved CMS admin UX goal is implemented across `apps/web` and the shared
`packages/ui` primitives used by `/admin`. The original contradictory page
context, dark-surface contrast, fixed-sidebar clipping, route-local status
colors, native confirmations, inconsistent async states, and English-heavy
editor copy are no longer reproducible in the accepted scope.

The implementation preserves the existing TanStack Start/Router/Query/Form,
tRPC, Drizzle/D1, R2, authentication, route, role, and CMS domain boundaries.
Server authorization remains authoritative.

## Responsive and theme evidence

The authenticated viewport test renders the dashboard in both themes at every
acceptance width, asserts that the desktop navigation is present only at 768 px
and above, and asserts zero page-level horizontal overflow. It also runs axe
checks on the representative narrow and desktop widths.

| Theme | 360                               | 768                               | 1024                               | 1440                               | 1920                               |
| ----- | --------------------------------- | --------------------------------- | ---------------------------------- | ---------------------------------- | ---------------------------------- |
| Light | [capture](evidence/light-360.png) | [capture](evidence/light-768.png) | [capture](evidence/light-1024.png) | [capture](evidence/light-1440.png) | [capture](evidence/light-1920.png) |
| Dark  | [capture](evidence/dark-360.png)  | [capture](evidence/dark-768.png)  | [capture](evidence/dark-1024.png)  | [capture](evidence/dark-1440.png)  | [capture](evidence/dark-1920.png)  |

These captures come from the production-like Vite SSR and Wrangler runtime,
not a static mock. The adjacent `evidence/README.md` records the reproducible
capture command. The PNGs are review aids; the browser assertions remain the
acceptance source.

## State and workflow matrix

| Concern                         | Accepted evidence                                                                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Populated and empty collections | Seeded authenticated workflows plus explicit empty-state rendering on dashboard and collection surfaces                                                                   |
| Loading and error               | Shared skeleton, retry, alert/status semantics; dashboard models orders and products independently so partial failures remain honest                                      |
| Permission                      | Owner/admin/editor navigation and action visibility; browser tests verify editor publish/restore restrictions and staff role lifecycle                                    |
| Conflict and dirty state        | Homepage stale-tab conflict, autosave refresh, save-before-navigation, post revision, preview, publish, restore, and schedule workflows                                   |
| Destructive actions             | Named modal confirmation for product/post/category/media/page/redirect/revision operations; no native `window.confirm` remains in admin routes                            |
| Long and narrow content         | Responsive product cards below `md`, contained desktop tables, truncation where disclosure remains available, and zero-overflow checks at all acceptance widths           |
| Keyboard and touch              | Modal-sheet focus trap and restoration, keyboard-only homepage critical path, explicit labels, and mobile Chrome workflow coverage                                        |
| Accessibility                   | Axe WCAG/best-practice scans on representative dashboard, list, create/editor, desktop/mobile, and theme scenarios; no serious or critical violations in the tested scope |

## Component ownership

| Layer                  | Owner and responsibility                                                                                                                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared UI primitives   | `packages/ui/src/components`: local shadcn-style Button, Badge, Table, Sheet, Alert Dialog, Textarea, and existing form/menu/card primitives. These own reusable semantics and variants, not CMS policy. |
| Semantic design tokens | `packages/ui/src/styles/globals.css`: reusable state foreground/background pairs and shared theme tokens.                                                                                                |
| Admin theme boundary   | `apps/web/src/index.css`: admin-only surface ownership and theme integration; the public landing `data-theme` engine remains separate.                                                                   |
| Admin compositions     | `apps/web/src/components/admin-ui.tsx`: page headers, metrics, list toolbars, async states, status badges, form sections, sticky actions, and named destructive confirmation.                            |
| Shell layout           | `apps/web/src/components/admin-shell.tsx`: responsive navigation, focus behavior, account utilities, and layout only.                                                                                    |
| Route metadata         | `apps/web/src/lib/admin-routes.ts`: typed title, description, breadcrumb, navigation, active-match, and capability metadata.                                                                             |
| Feature routes         | `apps/web/src/routes/admin`: queries, mutations, domain validation, workflow-specific copy, and specialized interactions.                                                                                |

## Extension rules

1. Register new admin destinations in the typed route metadata instead of
   duplicating titles, breadcrumbs, or capability checks in the shell.
2. Build simple route layout with Tailwind utilities and use semantic state
   tokens; do not introduce raw red/green/amber/blue status utilities.
3. Use shared admin compositions for headers, query states, status, form
   sections, sticky actions, and destructive confirmation.
4. Every query surface must distinguish loading, error, empty, stale/partial,
   and populated data when those states are possible.
5. Use responsive cards or a deliberately contained table below desktop
   widths. A page-level `overflow-x` escape hatch is not acceptance.
6. Use Vietnamese-first product copy, named destructive actions, accessible
   control names, and status text that does not depend on color.
7. Treat client capability filtering as orientation only; enforce permissions
   again at the server boundary.
8. Preserve route, API, calculation, and stored-data compatibility unless a
   separate change is explicitly approved.

## Verification record

- `bun run check-types` in `packages/ui` — pass
- `bun run check-types` in `apps/web` — pass
- `bun run build` in `apps/web` — pass
- `bun run test:unit` in `apps/web` — 10 pass, 0 fail
- `bun test apps/web/src/components/cms-post-form.test.ts` — 3 pass, 0 fail
- `bun scripts/test-e2e-local.ts` — 40 pass, 10 intentional skips, 0 fail
  across desktop Chrome and Pixel 7
- Focused visual-evidence run — 1 pass and 1 intentional project skip; ten
  light/dark viewport captures generated
- Scoped Prettier, changed-path whitespace, and static admin raw-style/native-
  confirmation audits — pass
- Root `bun run format:check` — expected boundary failure on eight unrelated
  files: six JSON files under `.alchemy-reset-backup-20260815-182120`,
  `packages/infra/.alchemy-reset-backup-20260815-182242/version-check.json`,
  and `docs/deep-research-report.md`. No in-scope UX file was reported.

## Remaining limitations

- The repository-wide formatter scans the eight unrelated backup and
  deep-research files listed above. Those files predate or sit outside this UX
  tranche and were not rewritten.
- Vite still reports an existing large-chunk advisory during production build;
  it is a warning, not a build failure, and no new numeric performance budget
  or dependency-heavy visualization was introduced by this goal.
- The 10 visual captures are dashboard shell/layout references, not pixel-diff
  golden files for every workflow state. State acceptance comes from semantic
  and behavioral browser assertions.
- The ten skipped full-suite cases are deliberate project or unavailable-
  fixture/credential branches. No executed acceptance scenario failed.
