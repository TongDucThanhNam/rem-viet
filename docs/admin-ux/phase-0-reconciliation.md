# CMS admin UX Phase 0 reconciliation

> Date: 2026-08-15
>
> Status: historical reconciliation complete; implementation gate resolved
>
> Authority at capture: `improve-ux-ui-cms-admin-goal.md` permitted planning
> and approval work only. The user subsequently approved implementation.

## Approval resolution

On 2026-08-16 the user explicitly approved implementation of the CMS admin UX
goal in `apps/web` and `packages/ui`. The work proceeded with the dirty
worktree preserved and with `README.md`, `apps/web/wrangler.jsonc`, `bun.lock`,
`packages/api/src/services/products.ts`, and both Alchemy backup trees excluded
from this UX tranche. The separately authorized D1 compatibility work is
described in `implementation-progress.md`.

This document remains the historical pre-implementation audit. The gaps below
were implementation inputs, not unresolved final acceptance findings; final
results are recorded in `final-evidence.md`.

## Historical decision

The current dirty worktree is a useful candidate baseline, not an accepted or
completed implementation. Preserve it in place, but do not continue production
changes until the user explicitly approves implementation.

This conclusion reconciles three conflicting facts:

1. `phase-0-baseline.md` says the Phase 0 gate remains open.
2. `implementation-progress.md` says Phases 0–3 are complete and product
   defaults were approved.
3. The current goal brief explicitly says implementation authorization was not
   granted and requires reconciliation before implementation.

The goal brief is the current authority. Existing source changes therefore
remain user-owned work in progress, regardless of the stronger completion
language in `implementation-progress.md`.

## Worktree snapshot

- Git base: `f585cbb` (`main`, "Refine landing page design system and
  animations")
- Staged changes: none
- Tracked modified files: 24
- Relevant untracked UX/planning files: 15
- Untracked Alchemy/Miniflare backup files: 55, approximately 98 MB decimal
- Test/build artifacts are ignored and did not add a tracked source change

The classifications below are preservation decisions, not permission to edit,
delete, stage, commit, or publish the files.

### Tracked files

| Path                                                     | Classification     | Reconciliation decision                                                                                                                  |
| -------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`                                              | Unrelated          | Admin allowlist example changed to a real email; isolate from the UX tranche and confirm separately.                                     |
| `apps/web/e2e/authenticated-cms.spec.ts`                 | Revise             | Keep the new coverage, correct the failing accessibility case, strengthen responsive assertions, and update recorded counts.             |
| `apps/web/src/components/admin-inventory.tsx`            | Revise             | Preserve the migrated composition; it still needs state, theme, viewport, and workflow evidence.                                         |
| `apps/web/src/components/admin-shell.tsx`                | Revise             | Preserve the responsive shell; finish manifest-derived page metadata and remove or migrate unused legacy exports after reference checks. |
| `apps/web/src/components/cms-post-form.tsx`              | Revise             | Preserve validation focus and sections; normalize Vietnamese-first copy and complete editor-state evidence.                              |
| `apps/web/src/components/product-form.tsx`               | Revise             | Preserve the section/sticky-action work; normalize labels and verify create/edit states and narrow layouts.                              |
| `apps/web/src/index.css`                                 | Keep               | The scoped admin theme ownership is aligned with the goal and leaves the landing `data-theme` engine intact.                             |
| `apps/web/src/routeTree.gen.ts`                          | Keep conditionally | Generated companion to the accepted route split; retain only with the paired route files.                                                |
| `apps/web/src/routes/admin/categories.tsx`               | Revise             | Preserve the shared grammar migration; complete workflow and responsive evidence.                                                        |
| `apps/web/src/routes/admin/dashboard.tsx`                | Revise             | Preserve the operational hierarchy; implement honest partial/loading/error states before acceptance.                                     |
| `apps/web/src/routes/admin/inventory.tsx`                | Supersede          | The previous screen body becomes a layout route; accept only atomically with `inventory/index.tsx`.                                      |
| `apps/web/src/routes/admin/orders.tsx`                   | Supersede          | The previous screen body becomes a layout route; accept only atomically with `orders/index.tsx`.                                         |
| `apps/web/src/routes/admin/orders/new.tsx`               | Revise             | Preserve deep-link and shell integration; complete form-state and responsive verification.                                               |
| `apps/web/src/routes/admin/posts/$postId/edit.tsx`       | Revise             | Preserve confirmation and sticky-state work; replace raw state colors and verify the full lifecycle/conflict contract.                   |
| `apps/web/src/routes/admin/posts/index.tsx`              | Revise             | Preserve URL-backed list and named deletion; complete sorting/pagination/state and viewport coverage.                                    |
| `apps/web/src/routes/admin/products.tsx`                 | Supersede          | The previous screen body becomes a layout route; accept only atomically with `products/index.tsx`.                                       |
| `apps/web/src/routes/admin/products/$productId.tsx`      | Supersede          | The previous detail body becomes a layout route; accept only atomically with `$productId/index.tsx`.                                     |
| `apps/web/src/routes/admin/products/$productId/edit.tsx` | Revise             | Preserve query/error integration; verify the complete edit workflow and copy.                                                            |
| `apps/web/src/routes/admin/products/new.tsx`             | Revise             | Preserve the routed create flow; verify validation, pending, failure, and narrow layouts.                                                |
| `apps/web/wrangler.jsonc`                                | Unrelated          | Admin allowlist changed to a real email; keep outside the UX tranche and confirm environment intent separately.                          |
| `bun.lock`                                               | Unrelated          | Optional-peer metadata changed without a matching UX dependency change; isolate and determine provenance.                                |
| `packages/api/src/services/products.ts`                  | Unrelated          | D1 batch compatibility is a backend change. Preserve it, but require separate approval/provenance and tests.                             |
| `packages/ui/src/components/button.tsx`                  | Keep               | The default hover treatment is a small shared primitive correction aligned with the local shadcn ownership model.                        |
| `packages/ui/src/styles/globals.css`                     | Revise             | Preserve new semantic state tokens, then verify every foreground/background pair in both themes.                                         |

### Relevant untracked files

| Path                                                      | Classification | Reconciliation decision                                                                                                               |
| --------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/components/admin-ui.tsx`                    | Revise         | Preserve the initial admin compositions; harden async, confirmation, and state semantics through representative routes.               |
| `apps/web/src/components/cms-post-form.test.ts`           | Revise         | Keep the focused validation tests; format the file and add behavior coverage at the component/browser boundary.                       |
| `apps/web/src/routes/admin/inventory/index.tsx`           | Supersede      | New index screen paired with the inventory layout route.                                                                              |
| `apps/web/src/routes/admin/orders/index.tsx`              | Supersede      | New index screen paired with the orders layout route.                                                                                 |
| `apps/web/src/routes/admin/products/index.tsx`            | Supersede      | New index screen paired with the products layout route; mobile presentation and destructive contrast must be fixed.                   |
| `apps/web/src/routes/admin/products/$productId/index.tsx` | Supersede      | New detail screen paired with the product layout route; needs responsive/copy verification.                                           |
| `docs/admin-ux/implementation-progress.md`                | Revise         | Recorded completion and test claims no longer match current evidence. Do not use as acceptance proof until corrected.                 |
| `docs/admin-ux/phase-0-baseline.md`                       | Revise         | Keep the architecture audit; append or link the accepted fixture/evidence matrix when it exists.                                      |
| `docs/admin-ux/phase-1-spec.md`                           | Revise         | Keep the proposed grammar; its "Approved direction" label requires explicit user approval evidence.                                   |
| `improve-ux-ui-cms-admin-goal.md`                         | Keep           | Current authoritative objective and scope boundary. Correct the unsupported `bun --cwd ... run` command form before final acceptance. |
| `packages/ui/src/components/alert-dialog.tsx`             | Keep           | Candidate local shadcn primitive; focused dialog behavior passed the create/delete browser flow.                                      |
| `packages/ui/src/components/badge.tsx`                    | Revise         | The destructive variant fails WCAG contrast in the current mobile product fixture.                                                    |
| `packages/ui/src/components/sheet.tsx`                    | Keep           | Candidate local shadcn primitive; mobile focus trap, Escape dismissal, and trigger focus restoration passed.                          |
| `packages/ui/src/components/table.tsx`                    | Keep           | Presentation primitive is aligned; responsive behavior remains the responsibility of each list composition.                           |
| `packages/ui/src/components/textarea.tsx`                 | Keep           | Candidate local shadcn primitive used by the representative forms.                                                                    |

### Operational artifacts

| Path group                                                | Classification | Reconciliation decision                                                                     |
| --------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------- |
| `.alchemy-reset-backup-20260815-182120/**`                | Unrelated      | Preserve until the user decides retention; exclude from UX review, formatting, and commits. |
| `packages/infra/.alchemy-reset-backup-20260815-182242/**` | Unrelated      | Preserve until the user decides retention; exclude from UX review, formatting, and commits. |

## Verification rerun

The following checks were run against the unchanged candidate worktree.

| Check                                                              | Result | Evidence                                                                                                             |
| ------------------------------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------- |
| `bun run check-types` in `packages/ui`                             | Pass   | TypeScript completed with exit code 0.                                                                               |
| `bun run check-types` in `apps/web`                                | Pass   | TypeScript completed with exit code 0.                                                                               |
| `bun run build` in `apps/web`                                      | Pass   | Client and SSR production builds completed; the existing large-chunk warning remains.                                |
| `bun run test:unit` in `apps/web`                                  | Pass   | 6 tests passed.                                                                                                      |
| `bun test apps/web/src/components/cms-post-form.test.ts`           | Pass   | 3 tests passed.                                                                                                      |
| `git diff --check`                                                 | Pass   | No whitespace errors in the tracked diff.                                                                            |
| `bun run format:check`                                             | Fail   | The new post-form test is unformatted; generated backup JSON and unrelated `docs/deep-research-report.md` also fail. |
| `bun scripts/test-e2e-local.ts --grep "admin shell\|admin create"` | Fail   | 4 passed, 1 failed, 1 skipped. The isolated harness removed its temporary D1/R2 state.                               |

### Browser failure

The mobile product-list accessibility scan reports one serious
`color-contrast` violation:

- Element: destructive status badge, text `Đã xóa`
- Foreground: `#df2225`
- Background: `#f9e2e0`
- Measured ratio: 3.86:1
- Required ratio for 11 px normal text: 4.5:1

The failure screenshot also shows a separate responsive defect not detected by
the page-overflow assertion: the seven-column product table compresses into the
viewport, causing headers, status, date, and row actions to overlap. The page
has no global horizontal overflow, but the table is not usable at the tested
mobile width. A responsive card/list presentation or an explicit contained
minimum-width table is still required.

## Contract gaps before baseline acceptance

1. **Responsive product list:** fix the overlapping mobile table and assert
   readable cell/action geometry, not only document overflow.
2. **Semantic contrast:** correct the destructive badge and verify all success,
   warning, info, destructive, chart, focus, and disabled pairs in light/dark.
3. **Dashboard partial data:** one failed or loading query currently suppresses
   valid data or permits misleading zero values. Model orders and products
   independently and label partial/unavailable sections.
4. **Route metadata:** navigation groups are centralized, but page titles remain
   caller-provided. A typed route manifest must own title, breadcrumb,
   description, active matching, and capability metadata to prevent drift.
5. **Vietnamese-first copy:** representative routes still expose labels such as
   `Administrator`, `UpdateAt`, `Actions`, `Active`, `Publish date`,
   `Save Product`, and `Product Price`.
6. **Editor visual tokens:** the representative post editor still uses raw amber
   and emerald utility colors for conflict/save states rather than the approved
   semantic tokens.
7. **Evidence matrix:** no durable populated/loading/error/permission/conflict/
   long-copy screenshot set or low-fidelity wireframe artifact was found in the
   repository or the task visualization workspace.
8. **Remaining route rollout:** pages, media, settings, leads, redirects,
   performance, audit, staff, logs, and the complete home editor have not been
   migrated to or verified against the final grammar.
9. **Formatting boundary:** the repository-wide formatter includes generated
   backup trees and unrelated pre-existing failures. Define exclusions or an
   accepted cleanup scope before using the full command as a release gate.
10. **Performance baseline:** the goal requires one before numeric budgets, but
    no accepted admin baseline artifact exists yet.

## Implementation approval boundary

Recommended approval text:

> Approve implementation of the CMS admin UX goal in `apps/web` and
> `packages/ui`, preserving the existing dirty worktree and correcting the
> reconciliation gaps first. Exclude `README.md`, `apps/web/wrangler.jsonc`,
> `bun.lock`, `packages/api/src/services/products.ts`, and both Alchemy backup
> trees from the UX tranche unless separately approved. Preserve routes, API
> contracts, authorization, calculations, and stored data.

The user supplied equivalent explicit approval on 2026-08-16. This boundary is
therefore resolved for the scoped implementation; it continues to exclude the
unrelated files and backup trees listed above.
