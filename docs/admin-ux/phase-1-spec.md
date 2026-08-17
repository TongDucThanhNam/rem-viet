# CMS admin UX specification

Date: 2026-08-15

This specification follows the verified baseline in `phase-0-baseline.md`. It
does not change API contracts, authorization, calculations, or stored content.

## Approved direction

- Prioritize order handling and stock health on the dashboard.
- Support both light and dark themes.
- Verify 360, 768, 1024, 1440, and 1920 CSS-pixel widths.
- Use Be Vietnam Pro for admin UI text and a restrained brass/gold accent.
- Keep a curated role-aware dashboard; defer widget personalization.
- Store list search, filter, sort, and pagination state in the URL first.
- Preserve the existing draft, preview, publish, revisions, scheduling, and
  conflict behavior.
- Add no analytics until a separate privacy decision authorizes it.

## Information architecture

The verified routes remain stable. Navigation is grouped as:

1. Báo cáo
2. Sản phẩm
3. Đơn hàng
4. Nhập xuất kho
5. Nội dung
6. Hệ thống
7. Trang chủ

Capability-protected links are removed from navigation when the active route
context does not grant their existing CMS capability. The UI is supplemental;
server procedures remain the authorization boundary.

## Responsive shell

- Desktop: 288 px expanded sidebar, 64 px icon-collapsed sidebar, sticky to the
  viewport.
- Mobile: no sidebar width in the document layout; navigation opens in a modal
  sheet with focus trapping, Escape dismissal, and focus restoration.
- Content owns vertical scrolling. The page must not create horizontal scroll.
- Breadcrumb, page title, active navigation, and URL use the same route-derived
  label.
- Account identity stays above navigation; theme, help, and sign-out stay in a
  stable footer.

## Dashboard hierarchy

1. Data readiness, title, refresh, and create-order action.
2. Revenue, order, low-stock, and identified-customer metrics.
3. Product analysis beside an operational attention list.
4. Recent orders beside top customers.

Empty panels remain compact and always explain the next available action. The
dashboard reuses the existing order and product queries and retains their
existing calculations.

## List grammar

The products route is the reference implementation:

- visible result count and primary create action;
- accessible search field;
- status filter, sorting, and column visibility controls;
- URL-backed search, filter, sort, and page;
- local Shadcn Table primitives with domain columns;
- text plus semantic status badge;
- labelled view, edit, and destructive actions;
- named modal confirmation for deletion;
- separate loading, query error, empty collection, and zero-result states;
- horizontal table containment without page-level overflow.

The pattern is intentionally composed around the existing list model. TanStack
Table is not introduced until a collection proves it needs a more complex
shared data model.

## Edit grammar

The post editor is the reference content workflow:

- `FormSection` groups identity, structured content, and SEO settings;
- field labels stay programmatically associated with controls;
- invalid submission moves focus to a form-level summary linked to the first
  invalid area;
- save status and primary save action remain visible at the bottom of long
  forms;
- existing dirty, autosave, preview, scheduling, publish, revision restore, and
  conflict behavior remains owned by the route;
- destructive and publish confirmations migrate to named modal confirmations
  without weakening server checks.

## Semantic visual system

- Surfaces: `background`, `card`, `popover`, `muted`, and `sidebar`.
- Content: `foreground` and `muted-foreground`.
- Interaction: `primary`, `accent`, `border`, `input`, and `ring`.
- State: paired `success`, `warning`, `info`, and `destructive` colors with
  tested foreground tokens.
- Charts: existing semantic `chart-1` through `chart-5` tokens.
- Cards use neutral surfaces. Brand and state color are reserved for actions,
  selection, alerts, chart marks, and badges.
- Corners and shadows follow local Shadcn primitives; feature routes do not
  introduce another component system.

## State contract

Migrated surfaces must visibly handle initial loading, background refresh,
empty data, zero results, partial data, query failure, pending mutation,
success, validation failure, permission limits, named destructive action, and
stale/conflict recovery where those states exist in the current product.

## Verification contract

- `bun run --cwd packages/ui check-types`
- `bun run --cwd apps/web check-types`
- `bun run --cwd apps/web build:e2e`
- focused authenticated Playwright coverage for shell, dashboard, products, and
  content editing
- automated accessibility scans on migrated routes
- desktop and mobile screenshots in light and dark themes
- `git diff --check` for changed paths
