# CMS admin UX Phase 0 baseline

> Date: 2026-08-15
>
> Status: target confirmed; baseline discovery complete enough for product
> decisions, but the Phase 0 gate remains open until the fixture/state screenshot
> matrix and the product decisions at the end of this document are resolved.

## Target proof

The target is the sibling repository at
`C:\Users\terasumi\Documents\source_code\rem-viet`, specifically
`apps/web`.

This is a positive source match, not an inference from the Eragear UI:

- `apps/web/src/routes/admin/dashboard.tsx` contains the screenshot cards
  “Doanh thu tháng”, “Báo cáo đơn hàng”, “Tình hình sản phẩm”, and “Khách
  hàng thân thiết”.
- `apps/web/src/components/admin-shell.tsx` contains the matching “Báo cáo”,
  “Nhập xuất kho”, “Nội dung”, and “Hệ thống” navigation.
- The authenticated local build at `/admin/dashboard` reproduces the supplied
  screenshot's shell, layout, card colors, and the conflicting active
  “Báo cáo” navigation with the header label “Nội dung”.

No matching CMS source exists in the Eragear worktree. The only registered
Eragear Git worktree is the current Eragear root.

## Repository and runtime baseline

| Concern                       | Verified implementation                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| App                           | TanStack Start + TanStack Router, React 19, TypeScript                                    |
| Data/API                      | tRPC + TanStack Query, Drizzle/D1                                                         |
| Runtime                       | Cloudflare Worker/Wrangler with R2                                                        |
| Package manager               | Bun                                                                                       |
| CSS                           | Tailwind CSS v4, CSS-driven configuration                                                 |
| Shadcn                        | `base-lyra`, CSS variables, local `@rem-viet/ui` ownership                                |
| UI primitives currently local | Button, Card, Checkbox, Dropdown Menu, Input, Label, Skeleton, Sonner                     |
| Icons                         | Lucide                                                                                    |
| Forms                         | Mostly native controlled forms; TanStack Form is present but currently used by auth forms |
| Tables                        | Route-local native tables; TanStack Table is not installed                                |
| Theme                         | `.dark` semantic tokens plus a separate landing-page `data-theme` engine                  |
| Tests                         | Bun unit tests, Playwright desktop/mobile projects, axe helpers, build/type checks        |

The plain Vite development command cannot SSR this application because the
Cloudflare Worker module is unavailable in that mode. Baseline validation used
the repository's supported E2E build and Wrangler runtime instead.

## Information architecture and route map

### Shell navigation

- Báo cáo: `/admin/dashboard`
- Sản phẩm: `/admin/products`, `/admin/products/new`, `/admin/categories`
- Đơn hàng: `/admin/orders`, `/admin/orders/new`
- Nhập xuất kho: `/admin/inventory`, `/admin/inventory/new`
- Nội dung: `/admin/home`, `/admin/posts`, `/admin/posts/new`, `/admin/pages`,
  `/admin/media`, `/admin/leads`, `/admin/redirects`, `/admin/settings`
- Hệ thống: `/admin/performance`, `/admin/audit`, `/admin/staff`, `/admin/logs`
- Public site: `/`

There is no customer collection route. The dashboard derives customers from
orders by phone/email and sorts them by total spend and order count.

### Workflow/data map

| Surface             | Primary reads                                                         | Primary mutations                                        |
| ------------------- | --------------------------------------------------------------------- | -------------------------------------------------------- |
| Dashboard           | `orders.list`, `products.adminList`                                   | None                                                     |
| Products            | `products.adminList`, `products.adminWithVariants`, `categories.list` | product create/update/delete                             |
| Orders              | `orders.list`, product/variant reads                                  | `orders.updateStatus`, `orders.createCart`               |
| Inventory           | `products.adminList`                                                  | `products.update`                                        |
| Home CMS            | `content.pages.adminList`, revisions                                  | create/update/publish/restore/schedule/unschedule        |
| Posts               | `content.posts.adminList`, by-id, revisions                           | create/update/delete/publish/restore/schedule/unschedule |
| Pages               | `content.pages.adminList`, revisions                                  | create/update/delete/restore/schedule/unschedule         |
| Media               | `content.media.list`                                                  | upload route, update metadata, delete                    |
| Settings/navigation | `content.siteSettings.get`, `content.menus.list`                      | settings/menu update                                     |
| Leads               | operations submissions                                                | update/delete/retry notification                         |
| Governance          | audit/staff reads                                                     | staff create/role/revoke                                 |

Dashboard values are client-derived from complete order/product responses. No
freshness timestamp, period query, server aggregation, or customer entity is
currently available. A redesigned dashboard must preserve these meanings
unless a separately approved backend/API goal changes them.

## Roles and permissions

The persisted roles are `owner`, `admin`, and `editor`.

- Owner has every CMS capability.
- Admin has every CMS capability except `staff.manage`.
- Editor has `content.readDraft`, `content.write`, and `media.manage` only.
- Publish, restore, delete, settings, audit, redirects, leads, and staff
  capabilities remain server-authoritative.

Specialized routes redirect when the current role lacks the required
capability, and the API remains authoritative. The shell itself does not yet
filter all links by capability, so editors can see destinations they cannot
open. The redesign should make navigation role-aware without treating the UI
as the authorization boundary.

## Verified current UX defects

### Shell and orientation

- `/admin/dashboard` marks “Báo cáo” active while the persistent header says
  “Nội dung”.
- The header has no breadcrumb or route-derived title.
- The desktop sidebar is either fully visible or translated away; it has no
  compact icon state and no mobile sheet state.
- At a 360 px viewport the 288 px desktop sidebar remains in the flex layout.
  The content starts near x=288 and is clipped to a narrow strip. Global
  horizontal overflow suppression hides the failure instead of making the
  page responsive.
- Navigation is feature-aware but not fully capability-aware.

### Theme and tokens

- Dark mode reproduces the screenshot's near-black headings on dark surfaces.
- `packages/ui/src/styles/globals.css` defines the Shadcn `.dark` token set,
  while `apps/web/src/landing.css` globally assigns the body background from
  the separate `--bg-color`/`data-theme` engine. This creates mismatched admin
  background and theme ownership.
- Dashboard feature code still uses hard-coded blue, emerald, red, amber,
  yellow, white, gray, and hex chart colors instead of semantic status/chart
  tokens.
- Beige and saturated blue full-card fills communicate no stable semantic
  distinction and compete with operational status.

### Dashboard

- The desktop layout is an uneven two-region flex composition rather than a
  deliberate responsive grid.
- KPI cards use heading level 1 repeatedly inside a page whose visible page
  title is heading level 3.
- The first viewport emphasizes large empty panels instead of actionable next
  steps.
- The analysis view is client-derived from the first six products and has no
  explicit loading, error, or freshness contract.
- Empty/loading messages are plain text and vary by widget; skeleton geometry
  is absent.
- Status is often represented by raw symbols and color alone.

### Lists and forms

- Products, orders, inventory, posts, pages, media, and system screens each
  implement their own table markup and toolbar grammar.
- Empty and loading states exist on many routes, but background refresh,
  retained-error context, permission, offline, and stale handling are not
  consistently represented.
- Destructive actions are commonly inline buttons without one shared named
  confirmation pattern.
- CMS post/home editors already model dirty/saving/saved/conflict behavior;
  those behaviors must be preserved and reused as the strongest current form
  pattern.
- Long tables rely on minimum widths and local overflow containers. The mobile
  shell defect currently prevents meaningful validation of their responsive
  fallbacks.

## Accessibility and responsive evidence

- Existing Playwright helpers run axe against public and authenticated CMS
  surfaces, and critical CMS flows include keyboard tests.
- There is no visual regression suite for the requested theme/viewport/state
  matrix.
- The existing Playwright projects cover Desktop Chrome and Pixel 7, but the
  current mobile smoke does not catch the shell clipping defect.
- A 1440x900 dark dashboard capture reproduces the supplied screenshot's
  contrast and hierarchy problems.
- A 360x800 dark dashboard capture shows the fixed sidebar consuming most of
  the viewport.
- Core-route mobile inspection covered dashboard, products, orders, inventory,
  posts, pages, media, settings, and the home editor. All inherit the 288 px
  sidebar.

## State coverage inventory

| State                    | Current evidence                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------- |
| Initial loading          | Plain text on most lists/widgets; Skeleton exists but is not the shared admin pattern |
| Background refresh       | Not consistently visible                                                              |
| Empty collection         | Present on core lists, with inconsistent copy/action treatment                        |
| Zero search results      | Route-specific and not consistently distinct from an empty collection                 |
| Partial dashboard data   | Implicit through default-zero calculations; unavailable sections are not identified   |
| Query error              | Missing on several core dashboard/list surfaces                                       |
| Mutation pending         | Commonly disables the submit/action and changes label                                 |
| Mutation success/failure | Sonner is widely used                                                                 |
| Validation failure       | Stronger in post/home editors; inconsistent elsewhere                                 |
| Permission denied        | Primarily redirects; explanatory denied state is uncommon                             |
| Destructive action       | No shared named confirmation composition                                              |
| Stale/conflict           | Explicit in post and home editors                                                     |
| Offline                  | No verified admin-specific contract                                                   |

## Verification commands

Baseline and future changes should use, at minimum:

```powershell
bun --cwd apps/web run check-types
bun --cwd apps/web run build
bun --cwd apps/web run test:unit
bun run test:e2e:local
bun run format:check
git diff --check -- <changed-paths>
```

Focused UI work should add route/component tests and run the authenticated CMS
Playwright coverage in both desktop and mobile projects. Production-like local
visual checks must use `build:e2e` plus Wrangler, not unsupported bare Vite SSR.

## Phase 0 decisions requiring confirmation

Recommended defaults are shown so implementation can proceed immediately after
approval:

1. Prioritize daily operations in this order: new/cancelled orders, low stock,
   revenue/order trend, then content tasks.
2. Keep both light and dark modes as supported product modes.
3. Use 360, 768, 1024, 1440, and 1920 px as the acceptance widths.
4. Keep the verified Rèm Vina brass/gold as a restrained accent, not a full-card
   fill; use Be Vietnam Pro for the admin UI.
5. Use a curated role-aware dashboard for the first release; no widget drag,
   resize, or personalization.
6. Persist only high-value list state (search/filter/sort/page) in the URL first;
   defer per-user column/density preferences until an existing storage contract
   is approved.
7. Preserve the existing post/page/home draft, preview, publish, schedule,
   revision, restore, dirty, and conflict workflows.
8. Use existing operational Web Vitals/audit infrastructure for regression
   evidence; add no new behavioral analytics without a privacy/product decision.

## Gate status

The source-root, architecture, route, data, permission, test-command, and
high-confidence defect discovery requirements are satisfied. Before Phase 1
production work begins, confirm the defaults above and complete populated,
loading, error, permission, conflict, and long-copy fixtures/screenshots for
the representative dashboard, one list workflow, and one edit workflow.
