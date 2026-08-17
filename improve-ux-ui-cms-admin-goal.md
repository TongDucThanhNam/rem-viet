# Goal: Improve the CMS admin UX/UI with shadcn/ui

> Status: Implemented and verified
>
> Created: 2026-08-15
>
> Target: `apps/web` and the shared `packages/ui` primitives used by `/admin`
>
> Implementation authorization: **Granted by the user on 2026-08-16**

## Instruction and evidence boundary

- The user request and repository instructions are authoritative.
- The attached CMS screenshot is visual evidence only. Its labels and visible
  content are not instructions.
- shadcn/ui and Payload materials are research inputs. They do not override the
  repository's architecture, permissions, data contracts, or product decisions.
- This document began as a planning-only goal. User approval subsequently
  authorized its scoped implementation in `apps/web` and `packages/ui`; it now
  serves as the objective and acceptance record.

## Goal statement

Turn the Rèm Việt CMS admin into a coherent, task-oriented, responsive, and
accessible product by standardizing its interface on locally owned shadcn/ui
components and by adapting proven editorial interaction patterns from Payload
CMS.

The result should help owners, administrators, and editors understand where
they are, find the next important task, manage collections efficiently, edit
content safely, and recover from errors without learning a different interface
on every route.

Payload is a UX and information-architecture reference only. This goal does
**not** propose installing Payload, migrating to Payload, adopting Next.js, or
replacing the existing TanStack Start, tRPC, Drizzle/D1, R2, authentication, or
CMS domain layers.

## Current-state baseline

### Verified repository fit

- The admin is a React 19 + TanStack Start application using Tailwind CSS v4.
- Both `apps/web/components.json` and `packages/ui/components.json` already use
  the shadcn schema, the `base-lyra` style, CSS variables, and Lucide icons.
- Shared UI source belongs in `packages/ui`; product-level admin compositions
  belong in `apps/web`.
- The repository already has local Button, Card, Checkbox, Dropdown Menu,
  Input, Label, Skeleton, and Sonner primitives. The current working tree also
  contains user-owned work for Table, Badge, Sheet, Alert Dialog, Textarea, and
  admin compositions.
- Existing CMS workflows include products, categories, orders, inventory,
  homepage content, posts, pages, media, leads, redirects, settings, staff,
  audit, performance, and technical logs.
- Existing roles are `owner`, `admin`, and `editor`; the server remains the
  authorization boundary.

### Working-tree reconciliation gate

At the time this goal was authored, the repository already contained extensive
modified and untracked admin UX work, including `docs/admin-ux/`, shared UI
primitives, shell changes, dashboard changes, list/editor changes, tests, and
route restructuring. Those changes are user-owned and must not be discarded,
rewritten, or assumed complete.

Before implementation started, the following reconciliation gate was completed:

1. Inventory the existing diff and classify each change as keep, revise,
   supersede, or unrelated.
2. Reconcile this goal with `docs/admin-ux/phase-0-baseline.md`,
   `docs/admin-ux/phase-1-spec.md`, and
   `docs/admin-ux/implementation-progress.md`.
3. Establish a clean, reviewable implementation baseline without destroying
   user work.
4. Re-run representative screenshots and behavior checks so the plan reflects
   the actual accepted baseline rather than either the old screenshot or an
   unverified work-in-progress state.

### UX problems evidenced by the screenshot and repository audit

- Page context is contradictory: the active “Báo cáo” destination can coexist
  with a header labelled “Nội dung”.
- Near-black headings on dark surfaces fail basic legibility expectations.
- Saturated blue, beige, gray, and raw status colors compete without a stable
  semantic meaning.
- The dashboard emphasizes oversized containers and empty space instead of
  operational decisions and next actions.
- Metric cards, panels, tables, toolbars, forms, empty states, and destructive
  actions do not consistently share one interaction grammar.
- Several routes implement their own state and table patterns, increasing
  cognitive load and regression risk.
- The historical desktop sidebar behavior causes severe mobile clipping when
  it remains in document flow.
- Loading, refresh, empty, zero-result, partial-data, error, permission, stale,
  and conflict states are not represented consistently.
- Important state is sometimes communicated by color or symbols alone.

## Intended outcomes

1. A user can identify the current section, page, and available primary action
   from a consistent shell and page header.
2. Daily operational work—new/cancelled orders and low stock—has priority over
   decorative reporting.
3. Collection lists share a predictable search, filter, sort, pagination,
   column, row-action, and state model while retaining domain-specific columns.
4. Long edit flows keep validation, dirty state, save state, preview, publish,
   scheduling, revision, restore, and conflict recovery visible and safe.
5. Light and dark themes use the same semantic token system with restrained
   Rèm Việt branding and verified contrast.
6. The complete admin is usable with keyboard, touch, screen readers, and
   viewports from 360 px through large desktop widths.
7. Existing routes, permissions, calculations, API contracts, and stored data
   remain behaviorally compatible unless a separate backend goal is approved.
8. Future admin routes can be assembled from documented primitives and
   compositions instead of inventing a new visual system.

## Product and design principles

- **Task first:** surface decisions, exceptions, and next actions before
  decorative analytics.
- **One grammar, domain-specific content:** share layout and behavior without
  forcing every list or editor into one over-generalized component.
- **Semantic color:** neutral surfaces by default; brand and state colors are
  reserved for emphasis with paired foreground tokens.
- **Progressive disclosure:** keep common actions visible and place secondary
  or dangerous actions behind clearly labelled menus or confirmations.
- **State is part of the design:** loading, refresh, empty, error, permission,
  and conflict states receive the same care as populated screens.
- **URL as shareable list state:** high-value search, filter, sort, and page
  state should survive refresh and back/forward navigation.
- **Permissions are reflected, not enforced, by UI:** hide or disable actions
  that are unavailable to the current role while retaining server checks.
- **Vietnamese-first product copy:** keep labels concise, consistent, and
  natural in Vietnamese; format currency, dates, and numbers appropriately.
- **Accessible by construction:** prefer proven primitives and semantic HTML;
  do not bolt accessibility on after visual migration.
- **Motion is functional and restrained:** use motion only for orientation,
  state change, or continuity, and respect reduced-motion preferences.

## shadcn/ui adoption strategy

### Ownership model

Use shadcn/ui as open, locally owned source code rather than as a second opaque
component framework:

1. `packages/ui/src/components/` owns low-level, reusable primitives.
2. `apps/web/src/components/` owns admin compositions such as page headers,
   collection toolbars, metric cards, state panels, and editor action bars.
3. `apps/web/src/routes/admin/` owns domain data, permissions, mutations,
   route/search state, and screen composition.

Do not copy API/domain behavior into shared visual primitives. Do not place
route-specific product assumptions in `packages/ui`.

### Component policy

- Audit and normalize existing primitives before adding new ones.
- Add only components required by an approved screen; do not bulk-install the
  shadcn catalog.
- Preserve the existing `base-lyra`, Tailwind v4, CSS-variable, Lucide, and
  monorepo configuration unless an explicit design-system decision changes it.
- Prefer shadcn composition and variants over route-local hard-coded colors,
  radii, shadows, focus styles, or disabled states.
- Candidate primitives include Sidebar/Sheet, Breadcrumb, Field, Select,
  Tabs, Separator, Tooltip, Empty, Alert, Pagination, Table, Badge,
  Alert Dialog, Textarea, and Command. Each candidate still requires a real
  use case and accessibility review.
- Use the shadcn Table primitive for presentation. Follow shadcn's guidance
  that data tables are domain-specific; introduce TanStack Table only when
  shared sorting/filtering/selection complexity demonstrates a need.
- Use the shadcn Field pattern with the already-present TanStack Form and Zod
  only where it improves state and validation. Do not rewrite stable forms
  merely to standardize on a form library.

### Token and theme contract

- One semantic admin token source must control `background`, `foreground`,
  `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`,
  `border`, `input`, `ring`, chart colors, and sidebar colors.
- Add paired `success`, `warning`, and `info` background/foreground tokens for
  both light and dark modes.
- Use neutral card surfaces. The Rèm Việt brass/gold should be a restrained
  brand accent, not a full-card status color.
- Use Be Vietnam Pro for the admin interface unless a later brand decision
  changes it.
- Keep the landing page's `data-theme` engine isolated from the admin `.dark`
  theme contract so one cannot override the other's body or surface colors.
- No feature route may introduce raw hex/status/chart colors when an approved
  semantic token exists.

## Payload patterns to adapt

The Payload source tree separates Dashboard, List, Edit, Version, and other
views, with reusable elements for list controls, document controls, autosave,
preview, stale/locked documents, column selection, filters, pagination,
confirmations, and navigation. Adapt the interaction ideas below without
copying Payload code or adopting Payload runtime assumptions.

| Payload pattern                           | Adaptation for Rèm Việt                                                                                                               | Guardrail                                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Collection/global groups and descriptions | Derive navigation, labels, descriptions, breadcrumbs, and capabilities from one typed admin route manifest                            | Do not replace TanStack Router or server authorization                                    |
| Configurable list views                   | Standard toolbar with search, relevant filters, sorting, visible columns, result count, pagination, per-page choice, and row actions  | Keep columns and filters domain-specific; bulk actions require an existing safe operation |
| Document header and controls              | Stable title/status area with save, preview, publish, schedule, restore, and destructive actions according to role and document state | Preserve existing mutation and workflow semantics                                         |
| Drafts, autosave, and versions            | Make dirty/saving/saved time, draft/published state, revision history, diff context, and restore consequences explicit                | Do not add storage/version behavior without a separate backend contract                   |
| Preview and live-preview device controls  | Improve the existing preview experience with clear entry/exit and desktop/tablet/mobile sizes                                         | Real-time cross-window synchronization is a later capability, not assumed scope           |
| Access-aware admin UI                     | Reflect the active role in navigation, fields, actions, and explanatory denied states                                                 | UI visibility never becomes the security boundary                                         |
| Stale/locked document recovery            | Standardize conflict/stale warnings, recovery choices, and leave-without-saving protection                                            | Multi-user locking needs a separately approved data/API design                            |
| Composable view slots                     | Expose small, typed composition points around headers, toolbars, list content, editor sections, and actions                           | Avoid a premature schema-driven page generator                                            |
| Modular dashboard widgets                 | Use a curated, role-aware operational dashboard first                                                                                 | Drag, resize, user personalization, and saved layouts are deferred                        |
| I18n versus content localization          | Keep interface language and localized content concerns distinct                                                                       | Do not add multilingual content modeling under this visual goal                           |

## Scope and priorities

| Priority      | Surface                                 | Required outcome                                                                                                                                                                          |
| ------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0            | Shared `/admin` shell                   | Correct route-derived title/breadcrumb, active navigation, role-aware links, expanded/icon-collapsed desktop sidebar, accessible mobile sheet, stable account/theme/help/sign-out regions |
| P0            | `/admin/dashboard`                      | Operational hierarchy for orders and stock, trustworthy metrics, compact actionable empty states, loading/error/partial-data handling, recent orders and customer summaries               |
| P0            | Products, categories, inventory         | Shared collection grammar; fast search and filtering; clear stock/status meaning; safe create/edit/delete flows                                                                           |
| P0            | Orders                                  | Search/filter/status triage, clear customer/order context, safe status changes, and a coherent create-order flow                                                                          |
| P0            | Homepage and posts                      | Preserve draft, preview, publish, schedule, revision, restore, validation, dirty, and conflict workflows inside the new editor grammar                                                    |
| P1            | Pages and media                         | Consistent list/editor states plus purpose-built media upload, metadata, preview, and deletion interactions                                                                               |
| P1            | Settings and navigation                 | Grouped settings, explicit save scope/status, validation, and safe menu editing                                                                                                           |
| P1            | Leads and redirects                     | Operational list grammar, clear status/actions, and named destructive confirmation                                                                                                        |
| P2            | Performance, audit, staff, logs         | Dense but readable operational tables, role-aware actions, filtering, and clear technical states                                                                                          |
| Compatibility | Existing legacy admin aliases/redirects | Preserve deep links or replace them only through intentional redirects and tests                                                                                                          |

## Shared interaction contracts

### Shell and navigation

- The URL, active navigation item, breadcrumb, document title, and visible page
  heading must describe the same destination.
- Desktop supports an expanded and icon-collapsed sidebar without obscuring
  content. Mobile uses an off-canvas modal sheet and contributes no persistent
  sidebar width to document layout.
- Mobile navigation traps focus, closes on Escape, restores focus to its
  trigger, and closes after navigation.
- Navigation visibility reflects existing capabilities, with server-side route
  and procedure checks unchanged.
- The page, not individual arbitrary panels, owns normal vertical scrolling.
  No route creates page-level horizontal overflow.

### Dashboard

- Priority order: new/cancelled orders, low stock, revenue/order trend, then
  content and secondary operations.
- Values derived from client-side data must retain their current meaning. Do
  not imply freshness, completeness, or server aggregation that does not exist.
- Distinguish a valid zero from unavailable, loading, error, stale, and partial
  data.
- Empty panels stay compact, explain why they are empty, and offer the next
  valid action where one exists.
- Charts include text summaries, accessible labels, semantic tokens, and a
  useful fallback when there is insufficient data.

### Collection lists

- Page header contains a plain-language description, result count, and one
  clear primary create action when permitted.
- Search, meaningful filters, sort, and page are URL-backed. Reset behavior is
  predictable and zero search results are distinct from an empty collection.
- Column controls expose only useful domain fields. Row actions have accessible
  names and do not rely on icon recognition alone.
- Pagination reports the current result range and offers only supported page
  sizes.
- Tables remain contained at narrow widths. A responsive card/list alternative
  may be used when horizontal comparison is not essential.
- Destructive actions use a named confirmation that states the affected record
  and consequence. Toasts are supplementary feedback, not the sole result.

### Editors and forms

- Group fields into understandable sections with concise descriptions; use
  progressive disclosure for advanced or infrequent options.
- Labels, descriptions, validation messages, and controls are programmatically
  associated. Required and optional expectations are explicit.
- Invalid submission provides a form-level summary and moves focus to the first
  invalid region without losing entered data.
- Long forms retain visible save/status controls and clearly distinguish dirty,
  saving, saved, failed, stale, conflict, draft, scheduled, and published
  states when applicable.
- Preview, publish, unpublish, schedule, revision restore, and destructive
  actions explain their effect and reflect current permissions.
- Navigating away with unsaved work requires an intentional choice.

### State contract

Every migrated surface must deliberately support the states that can occur:

| State                      | Minimum UX behavior                                                                |
| -------------------------- | ---------------------------------------------------------------------------------- |
| Initial loading            | Geometry-matched skeleton or labelled progress; no misleading zero values          |
| Background refresh         | Keep usable data visible and show non-blocking refresh status                      |
| Empty collection           | Explain the absence and offer a permitted first action                             |
| Zero search/filter results | Preserve controls and offer clear/reset guidance                                   |
| Partial dashboard data     | Identify unavailable sections without invalidating valid sections                  |
| Query failure              | Explain the failed scope, retain safe stale data when available, and provide retry |
| Mutation pending           | Prevent duplicate submission and identify the action in progress                   |
| Mutation success/failure   | Show durable in-context state plus concise toast feedback where useful             |
| Validation failure         | Summary, field association, focus management, and preserved input                  |
| Permission limit           | Hide impossible actions or explain why a visible action is unavailable             |
| Destructive action         | Named modal confirmation, consequence, pending state, and recoverability note      |
| Stale/conflict             | Explain the competing state and provide safe reload/reconcile choices              |
| Offline/network loss       | Preserve unsaved work where possible and make retry/recovery explicit              |

## Responsive, accessibility, and quality targets

- Acceptance widths: 360, 768, 1024, 1440, and 1920 CSS pixels, with tests in
  both light and dark themes.
- Target WCAG 2.2 AA for contrast, focus visibility, names/roles/values,
  keyboard operation, status announcements, error identification, and target
  usability.
- Heading order is logical; landmarks, tables, dialogs, sheets, menus, and
  form controls use appropriate semantics.
- All icon-only controls have accessible names and visible tooltips where the
  icon is not universally clear.
- Status never depends on color alone.
- Reduced motion is respected, and touch interfaces do not depend on hover.
- No critical action is hidden solely because the viewport is narrow.
- Avoid layout shifts, unnecessary client work, and heavyweight dependencies.
  Establish an admin performance baseline before setting numeric budgets, then
  reject material regressions on representative routes.

## Approved execution plan

### Phase 0 — Reconcile and freeze the baseline

- Review the current dirty worktree and existing `docs/admin-ux` artifacts.
- Confirm which current changes are accepted as the new baseline.
- Capture representative populated, loading, empty, error, permission,
  conflict, and long-content fixtures in light/dark desktop/mobile views.
- Record the route, capability, query/mutation, and current component inventory.

**Gate:** no implementation continues until user-owned changes are protected
and the accepted baseline is explicit.

### Phase 1 — Foundation and visual contract

- Normalize semantic tokens and theme ownership.
- Audit, add, and test the minimum shadcn primitives.
- Define typed admin route metadata and shared page/state/form/list
  compositions.
- Create low-fidelity shell, dashboard, representative list, and representative
  editor specifications before broad rollout.

### Phase 2 — Shell and operational dashboard

- Migrate the responsive, role-aware shell.
- Establish the page-header/breadcrumb grammar.
- Rebuild the dashboard around actionable operations and reliable states.

### Phase 3 — Representative list workflow

- Use products as the reference list.
- Prove URL state, columns, actions, responsive behavior, named confirmation,
  and all list states.
- Roll the proven grammar through orders, posts, categories, and inventory.

### Phase 4 — Representative editor workflow

- Use the strongest existing post/home editor behavior as the reference.
- Prove sections, validation summary, sticky actions, dirty/save/conflict state,
  preview/publish/schedule/revision behavior, and leave protection.
- Apply the grammar to product and order create/edit flows without changing
  mutation contracts.

### Phase 5 — Remaining specialized surfaces

- Migrate pages, media, settings, leads, redirects, performance, audit, staff,
  and logs.
- Use specialized interaction patterns where a table or generic form would
  reduce usability.

### Phase 6 — Hardening and cleanup

- Complete keyboard, screen-reader, axe, theme, viewport, and state matrices.
- Run full workflow regression and visual comparison.
- Remove superseded route-local presentation only after reference searches and
  tests prove it unused.
- Document the final primitive/composition ownership and extension rules.

## Definition of done

- All in-scope admin routes use the accepted shell, semantic token contract,
  and shared interaction grammar.
- The screenshot's contrast, hierarchy, orientation, empty-space, and mobile
  clipping failures are no longer reproducible.
- Dashboard, one representative collection list, and one representative editor
  pass every state before the same pattern is considered reusable.
- Existing product/content workflows, data meanings, routes, permissions, API
  inputs/outputs, and stored data remain compatible.
- Light and dark mode pass the viewport and accessibility matrices.
- Core workflows are fully operable with keyboard and touch; automated axe
  checks report no serious or critical violations in tested scope.
- No page-level horizontal overflow occurs at the acceptance widths.
- No feature route introduces an undocumented visual system or avoidable raw
  state colors.
- Tests cover shell navigation, deep links, list URL state, create/edit/delete,
  order state changes, content draft/preview/publish/revision/conflict behavior,
  permission differences, and responsive mobile navigation.
- Documentation records accepted design decisions, component ownership,
  remaining limitations, and evidence for each gate.

## Verification contract

At minimum, run:

```powershell
bun run check-types # from packages/ui
bun run check-types # from apps/web
bun run build       # from apps/web
bun run test:unit   # from apps/web
bun scripts/test-e2e-local.ts
bun run format:check
git diff --check -- <changed-paths>
```

Also require focused authenticated Playwright coverage in desktop and mobile
projects, automated accessibility scans, and visual captures for the approved
theme/viewport/state matrix. Use the repository's supported production-like
E2E build and Wrangler runtime for SSR validation.

## Explicit non-goals

- Work outside the approved `apps/web` and `packages/ui` UX scope, except for
  separately and explicitly authorized compatibility work.
- Installing or migrating the application to Payload CMS.
- Replacing TanStack Start/Router/Query/Form, tRPC, Drizzle/D1, R2, or the
  current authentication/CMS packages.
- Changing backend calculations, persistence, schemas, permissions, or API
  contracts without a separately approved goal.
- Copying Payload source code or visual styling.
- Building a generic schema-generated CMS admin, WordPress clone, or new CMS
  platform extraction in this goal.
- Dashboard drag/drop, resize, saved personal layouts, or widget marketplace in
  the first release.
- Adding behavioral analytics without a separate privacy/product decision.
- Reworking the public landing page.
- Introducing TanStack Table, a chart library, or a form rewrite without a
  demonstrated requirement.

## Risks and mitigations

| Risk                                                         | Mitigation                                                                                                               |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Existing uncommitted admin work is overwritten or duplicated | Make reconciliation the first blocking gate; preserve user changes and review diffs before editing                       |
| Landing and admin theme engines conflict                     | Scope theme ownership explicitly and test the public site plus admin in both modes                                       |
| “Use shadcn” becomes a cosmetic component swap               | Gate work on task flows, state handling, accessibility, and behavior, not component count                                |
| Payload research expands into a platform migration           | Keep Payload in the pattern-reference boundary and require a separate architecture decision for runtime adoption         |
| Shared components become over-generalized                    | Prove one list/editor, extract only stable repetition, and keep domain logic in routes                                   |
| Visual migration breaks mature content workflows             | Characterize draft/preview/publish/schedule/revision/conflict behavior before refactoring and add regression tests first |
| Mobile fixes hide data or actions                            | Validate real workflows at each acceptance width, not screenshot appearance alone                                        |
| Client-derived metrics imply unsupported freshness           | Preserve verified meanings and label unavailable/partial data honestly                                                   |

## Recommended defaults pending implementation approval

- Keep both light and dark admin themes.
- Prioritize orders and stock on the dashboard.
- Use a curated role-aware dashboard; defer personalization.
- Persist only high-value list state in the URL first.
- Keep Be Vietnam Pro and use Rèm Việt brass/gold as a restrained accent.
- Preserve all existing content lifecycle and conflict behavior.
- Use 360, 768, 1024, 1440, and 1920 px as acceptance widths.
- Add no analytics and no backend capability under this UX/UI goal.

## Research snapshot and primary sources

Research was reviewed on 2026-08-15. Payload source observations were made
against `main` at commit
[`76091c0d3ae30a91e872d9ee6e1a2a8a620bf986`](https://github.com/payloadcms/payload/commit/76091c0d3ae30a91e872d9ee6e1a2a8a620bf986).

### shadcn/ui

- [LLM documentation index](https://ui.shadcn.com/llms.txt)
- [Core principles and documentation](https://ui.shadcn.com/docs)
- [Theming and semantic tokens](https://ui.shadcn.com/docs/theming)
- [Monorepo guidance](https://ui.shadcn.com/docs/monorepo)
- [Sidebar composition](https://ui.shadcn.com/docs/components/sidebar)
- [Data table guidance](https://ui.shadcn.com/docs/components/data-table)
- [TanStack Form integration](https://ui.shadcn.com/docs/forms/tanstack-form)
- [Empty-state composition](https://ui.shadcn.com/docs/components/empty)

### Payload CMS

- [Payload repository](https://github.com/payloadcms/payload)
- [Payload UI source tree](https://github.com/payloadcms/payload/tree/main/packages/ui/src)
- [List view source](https://github.com/payloadcms/payload/tree/main/packages/ui/src/views/List)
- [Edit view source](https://github.com/payloadcms/payload/tree/main/packages/ui/src/views/Edit)
- [Reusable admin elements](https://github.com/payloadcms/payload/tree/main/packages/ui/src/elements)
- [Admin panel overview](https://payloadcms.com/docs/admin/overview)
- [Collection list configuration](https://payloadcms.com/docs/configuration/collections)
- [Custom views](https://payloadcms.com/docs/custom-components/custom-views)
- [Edit view](https://payloadcms.com/docs/custom-components/edit-view)
- [Dashboard widgets](https://payloadcms.com/docs/custom-components/dashboard)
- [Access-aware admin behavior](https://payloadcms.com/docs/access-control/overview)
- [Autosave](https://payloadcms.com/docs/versions/autosave)
- [Versions and drafts](https://payloadcms.com/docs/versions/overview)
- [Preview](https://payloadcms.com/docs/admin/preview)
- [Live preview](https://payloadcms.com/docs/live-preview)
