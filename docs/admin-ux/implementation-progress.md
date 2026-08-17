# CMS admin UX implementation record

Date completed: 2026-08-16

## Status

Phases 0–6 are complete for the approved `apps/web` and `packages/ui` scope.
The existing CMS data contracts, routes, roles, and server authorization model
remain in place. Unrelated worktree changes were preserved and excluded.

## Completed phases

### Phase 0 — reconciliation and baseline

- Confirmed `apps/web` as the Rèm Vina CMS represented by the supplied UI.
- Recorded route, data, permission, framework, theme, test, and command maps in
  `phase-0-baseline.md`.
- Classified the dirty worktree before implementation and protected unrelated
  changes and Alchemy backup artifacts.
- Captured desktop and 360 px dark-theme baselines and verified that the fixed
  288 px sidebar caused the original mobile clipping.

### Phase 1 — specification and foundation

- Recorded product defaults and interaction grammar in `phase-1-spec.md`.
- Added semantic success, warning, and info token pairs for both themes.
- Added local shadcn-style Badge, Table, Sheet, Alert Dialog, and Textarea
  primitives and the shared product-level admin compositions.
- Established typed route metadata as the source of page titles, breadcrumbs,
  navigation labels, and capability visibility.

### Phase 2 — shell and navigation

- Rebuilt the shell with expanded, icon-collapsed, and mobile modal-sheet
  navigation.
- Fixed full-viewport dark-theme ownership and narrow-screen clipping.
- Kept account, theme, help, and sign-out actions in stable regions.
- Filtered capability-protected links in the client while preserving server
  authorization as the security boundary.

### Phase 3 — dashboard

- Rebuilt the dashboard around the existing order and product queries.
- Added operational metrics, exceptions, recent orders, customer summaries,
  skeletons, retry, refresh, and actionable empty states.
- Made partial failures honest: one failed query no longer erases successful
  data from the other dashboard panels.

### Phase 4 — collection workflows

- Made Products the reference URL-backed list for search, filter, sort,
  columns, pagination, semantic status, async states, responsive presentation,
  and named deletion confirmation.
- Applied the grammar to orders, posts, categories, and inventory.
- Preserved deep-link behavior with explicit layout-route `Outlet` boundaries.
- Removed native confirmation prompts and raw route-local state colors from
  the admin route surface.

### Phase 5 — editor and specialized surfaces

- Applied compact semantic sections and sticky actions to product, order,
  post, and homepage workflows without changing mutation inputs.
- Preserved draft, preview, publish, schedule, revision, conflict, and
  save-before-navigation behavior while normalizing Vietnamese-first copy.
- Migrated pages, media, settings, leads, redirects, performance, audit,
  staff, and technical logs to the same page/state/status grammar.
- Kept permission-specific navigation and action visibility aligned with the
  existing owner, admin, and editor capabilities.

### Phase 6 — hardening and documentation

- Added the supported light/dark viewport matrix at 360, 768, 1024, 1440, and
  1920 px, with overflow and responsive-shell assertions.
- Added automated accessibility scans to representative desktop/mobile,
  editor, dashboard, collection, and theme scenarios.
- Exercised authenticated create, edit, delete, state-change, preview,
  publish, revision, conflict, redirect, media, staff, permission, and public
  compatibility workflows in the production-like local runtime.
- Recorded final component ownership, extension rules, evidence, and known
  limitations in `final-evidence.md`.

## Final verification

- `packages/ui`: `bun run check-types` — pass
- `apps/web`: `bun run check-types` — pass
- `apps/web`: `bun run build` — pass
- `apps/web`: `bun run test:unit` — 10 pass, 0 fail
- `bun test apps/web/src/components/cms-post-form.test.ts` — 3 pass, 0 fail
- `bun scripts/test-e2e-local.ts` — 40 pass, 10 intentional skips, 0 fail
  across desktop Chrome and Pixel 7 (2.4 minutes)
- The E2E harness completed its production-like Vite build and Wrangler/D1/R2
  runtime and included axe WCAG/best-practice checks.
- Scoped formatting, static raw-style/native-confirm audit, and changed-path
  whitespace checks — pass

The root `bun run format:check` result and its unrelated-file boundary are
recorded in `final-evidence.md`; no unrelated files were reformatted.

## Compatibility note

A separately approved backend compatibility fix changed the local D1 product
create/update transaction implementation to atomic batch operations. It
preserves the existing tRPC inputs, response shapes, schema, authorization,
and soft-delete behavior. The full browser suite verifies the resulting
create, edit, and delete workflows in both browser profiles.
