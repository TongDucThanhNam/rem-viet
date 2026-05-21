# Migration Notes

This repo is being migrated into `apps/web` as the only active app. The old
`apps/frontend`, `apps/home`, `apps/admin`, and `apps/backend` folders remain
as reference source until parity is verified.
Root workspaces and default scripts only target `apps/web` plus the new shared
packages; old Next/Astro/Express app scripts are intentionally not part of the
active Turbo pipeline.
Admin access is now allowlisted through `ADMIN_EMAILS`. Better Auth public
email/password sign-up is disabled, `/dang-ky` only points users back to
sign-in, and admin routes plus D1 write APIs require an allowlisted admin
session rather than any logged-in user.
The admin shell keeps the old layout chrome more closely: the top header stays
focused on the `Nội dung` title/toggle, and `Trang chủ` is part of the sidebar
navigation instead of an extra header/footer shortcut. The sidebar now keeps
the legacy 72-width panel, hide-by-translate animation, nested product/order/
inventory groups, 44px nav rows, `bg-default-100` selected state, and the old
avatar/name/admin context while still routing to the migrated TanStack/D1 admin
pages.

## Local D1 schema

```bash
bun run db:migrate:local
```

This applies Drizzle migrations to the local Wrangler D1 state used by
TanStack Start and Alchemy/Miniflare.

## Mongo collections to D1 SQL

Required env:

```bash
MONGODB_URI=
MONGODB_DB_NAME=
D1_IMPORT_SQL_PATH=../../packages/db/mongo-d1-import.sql
```

The exporter loads env from root `.env`, `apps/web/.env`, and `packages/db/.env`.

Generate SQL:

```bash
bun run db:mongo-to-d1:sql
```

The Mongo exporter fails before writing SQL if the source database contains
non-empty collections that do not have a D1 mapping. This is deliberate: the
current storefront/admin migration maps `categories`, `products`, `variants`,
`promotions`, `carts`, `orders`, and `logs`; any additional production
collections must either get their own Drizzle/import slice or be explicitly
acknowledged for a storefront-only export:

```bash
D1_ALLOW_UNMAPPED_COLLECTIONS=true bun run db:mongo-to-d1:sql
```

After generating both Mongo and Notion SQL exports, run:

```bash
bun run db:migration:summary
```

This prints `INSERT OR REPLACE` counts per D1 table across the split export
files, which gives a quick parity checkpoint before importing into D1.

Before importing into D1, run:

```bash
bun run db:migration:verify
```

The verifier also has an isolated fixture gate that does not require production
Mongo or Notion credentials:

```bash
bun run db:migration:verify:fixture
```

That fixture writes temporary Mongo/Notion-style import SQL, applies the
Drizzle migrations into in-memory SQLite, and checks the same direct and JSON
product references as the real import verifier. It is intended as the fast CI
proof that the import verifier itself still works while real export files are
not available locally.

Treat these commands as cutover evidence, not just optional diagnostics:

- `bun run db:migration:summary` output saved with expected source collection counts.
- `bun run db:migration:verify` output saved against the generated Mongo/Notion SQL.
- `bun run db:migration:verify:fixture` output saved to prove the verifier still catches D1 import integrity.
- `SMOKE_STRICT=true bun run smoke:migration` output saved against a seeded D1 with at least one active product, deleted/inactive product, variant, category, order, cart, and post.

This applies the Drizzle migration SQL to an in-memory SQLite database, executes
the generated Mongo/Notion import SQL, then checks SQLite foreign keys plus
important JSON/text references that D1 cannot enforce directly, including
product category IDs, promotion product IDs, order item product IDs, and cart
product IDs. The verifier also fails on invalid JSON arrays and unsupported
product reference shapes instead of silently treating them as empty data. By
default the summary and verification commands require both Mongo and Notion SQL
exports. For a deliberate partial import, set
`D1_ALLOW_MISSING_MONGO_SQL=true` or `D1_ALLOW_MISSING_NOTION_SQL=true`
explicitly.

Import locally:

```bash
bun --cwd apps/web wrangler d1 execute rem-viet-local --local --file ../../packages/db/mongo-d1-import.sql --config wrangler.jsonc
```

The exporter maps legacy Mongo product, variant, category, promotion, cart,
order, and log documents into Drizzle/D1 tables while preserving legacy fields
such as `orders.products`, `orders.shipping`, `orders.payment`, and
`orders.cart_id`. Order `type`/`status` values are kept when present, contact
fields are recovered from top-level, `info`, `contact`, or `shipping` legacy
shapes, and missing log timestamps stay `NULL` instead of being replaced with
the import time.

Carts without a legacy `userId` are assigned `legacy-anonymous-{cartId}` during
export so D1's non-null `carts.user_id` constraint cannot abort the import
transaction. Legacy variants must reference products that exist in the migrated
product export; missing or unresolved product references fail the export before
SQL is written. Legacy order items without a resolvable product reference still
receive a marker instead of an empty string so the order payload remains
auditable after import. Order product arrays that store direct ObjectId/string
product references are mapped as those product ids instead of being treated as
unresolved object-shaped items. The order shipping JSON keeps the flattened
contact fields used by the new admin pages and also retains the original
`info`, `contact`, and `shipping` sub-objects as `legacyInfo`, `legacyContact`,
and `legacyShipping` for audit cleanup.

### Mongoose to Drizzle parity

The active Express routes in `apps/backend/Api/Routes` have been ported into
TanStack Start routes under `apps/web/src/routes/api`:

- `GET /api/products`, `GET /api/product/:productId`, `GET /api/product/:productId/variant`
- `POST /api/product`, `PUT /api/product/:productId`, `DELETE /api/product/:productId`
- `GET /api/posts`, `GET /api/posts/:slug`
- `POST /api/send-newletter`, `POST /api/send-newsletter`, `POST /api/send-product-order`, `POST /api/send-cart-order`

Additional admin/API surface now lives on TanStack Start + D1 instead of the
old Express process:

- `GET /api/orders`, `POST /api/orders`
- `GET /api/orders/:orderId`, `PATCH /api/orders/:orderId`, `PUT /api/orders/:orderId`
- `GET /api/categories`, `POST /api/categories`
- `PUT /api/categories/:categoryId`, `DELETE /api/categories/:categoryId`
- `GET /api/logs`, `POST /api/logs`
- `GET /api/logs/:logId`, `PUT /api/logs/:logId`, `DELETE /api/logs/:logId`
- tRPC queries/mutations for active storefront/admin workflows

Category deletes now return `409` when products still reference the category,
which avoids orphaned product category ids until a later schema migration adds
an explicit product/category foreign-key policy.

The active Mongoose collections used by those routes map to these D1 tables:

- `products` -> `products`
- `variants` -> `variants`
- `promotions` -> `promotions`
- `carts` -> `carts`
- `orders` -> `orders`
- `logs` -> `logs`
- Notion posts -> `posts`

Legacy request logging parity is intentionally conservative. The old Express
entrypoint only mounted `morgan("dev")` for console request logs; its Mongo log
repository/service existed but was not mounted as an active Express route.
TanStack Start therefore keeps `logs` as an admin-protected D1 CRUD/import
surface instead of adding automatic request-log writes that could create noisy
or recursive records.

The old backend also contains repository/entity files for company, certificate,
role, user, job, CV, application, and notification domains. They are not mounted
by the old API routes used by the current storefront/admin migration, so they
are kept as reference code instead of being introduced into the active D1 schema.
If one of those domains becomes product surface again, add a dedicated Drizzle
schema and route slice before deleting the legacy backend.

Current active app audit: `apps/web` and `packages/api` do not import Mongoose
or connect to Mongo at runtime. The only `mongodb` dependency left in the new
workspace is a dev dependency for `packages/db/src/scripts/mongo-to-d1-sql.ts`,
which is an offline export tool for converting the old Mongo/Mongoose data into
D1 import SQL. Mongo/Notion export env examples live in `packages/db/env.example`
instead of the active web runtime env file.

## Route parity

The active app is `apps/web`. Legacy URLs are kept as TanStack redirects where
the old admin/sidebar linked directly to them:

- `/dashboard` -> `/admin/dashboard`
- `/san-pham` renders the same migrated TanStack product listing as
  `/danh-sach-san-pham`, so the old storefront product path remains a real
  page instead of a dead URL.
- The storefront header keeps the legacy nav item set: `Trang chủ`,
  `Giới thiệu`, and `Bài viết`. The old separate home-site `Giới thiệu` link
  now resolves inside `apps/web` at `/gioi-thieu` because admin, frontend, home,
  and backend are being consolidated into the single TanStack Start app.
- `/gioi-thieu` preserves the old `apps/home` landing content inside TanStack Start
  including the hero, active côn trùng/window guard section, FAQ, newsletter,
  and additional storefront sections that were present in the legacy home code.
  Section ordering and anchors follow `apps/home/src/pages/index.astro`: hero,
  video, côn trùng guard, window estimator, feature, our-strength,
  customer-review, guide, material, FAQ, newsletter, footer.
  The TanStack route also restores the old homepage scroll container behavior:
  desktop viewports use smooth vertical snap scrolling, and each migrated
  section snaps at roughly one viewport below the site header.
  The newsletter section keeps the old dark rounded subscription panel, legacy
  Vietnamese heading/copy, phone placeholder, and `Đăng ký` submit label while
  posting through the new tRPC/D1 newsletter mutation.
- `/products` -> `/admin/products`
- `/orders` -> `/admin/orders`
- `/add-order` -> `/admin/orders/new`
- `/inventory` -> `/admin/inventory`
- `/add-inventory` -> `/admin/inventory/new`
- `/add-product` and `/admin/add-product` -> `/admin/products/new`
- `/view-product/:productId` and `/admin/view-product/:productId` -> `/admin/products/:productId`
- `/edit-product/:productId` and `/admin/edit-product/:productId` -> `/admin/products/:productId/edit`

SEO/PWA routes are also preserved:

- `/sitemap.xml`
- `/robots.txt`
- `/manifest.webmanifest`

- `/favicon.ico`

Backend docs parity is preserved with `/api-docs`. The old Express app mounted
Swagger UI there; the TanStack Start app now serves a lightweight API reference
for the migrated server routes, including legacy aliases and the new
Drizzle/D1 admin endpoints.

Blog links keep the old `.html` suffix used by the legacy storefront sitemap
and post cards. TanStack Start serves `/bai-viet/:slug.html`, while the Drizzle
post service normalizes the suffix before querying D1. The D1 post response
preserves legacy Notion fields including `url`, JSON block `content`, and
`table_of_contents`. The `/bai-viet` listing also preserves the legacy visual
treatment for post cards, including the dark image overlay, tag chips, update
timestamp, and WobbleCard-style hover/noise interaction.
The post detail page preserves the legacy Notion renderer semantics for
paragraph/inline colors, heading levels, media blocks, bookmark previews, and
long-form Vietnamese publish/update dates. Notion image blocks also keep the
legacy file/external split: signed `file` URLs render directly, while external
image URLs are routed through Cloudflare Image Resizing.

Public assets from the old storefront/home apps have been copied into
`apps/web/public`, including PWA icons, `favicon.ico`, `noise.webp`,
`luoichongmuoi.avif`, the admin `avatar.webp`/`150x150.png`, and the
`HeroImage-*` landing assets.

The merged storefront keeps the old homepage/footer anchor behavior: the home
carousel section exposes `#hero`, and the footer `Đầu trang` link scrolls back
to that anchor. The PWA manifest keeps the legacy app name, long description,
icons, categories, language, and theme color.

The root document head now carries the old Next storefront metadata parity:
title, description, robots, OpenGraph website metadata, and Twitter card fields
use the migrated `siteConfig` values and brand image, with the canonical link
pointing at the production site URL.

The old storefront global error screen has been ported to the TanStack root
route as a shared `ErrorState`, so loader/render failures still show a retry
path instead of the framework default error surface.

The product detail gallery keeps carousel navigation and now uses horizontally
scrollable thumbnails so migrated products with more than four images do not
overflow the fixed thumbnail rail.

Product cards, product detail ratings, and the review summary now read
`rating` and `reviews_count` from the migrated D1 product rows instead of
showing fixed 5-star or 100-review placeholder values. The old static review
layout is still preserved as a visual shell until a real reviews table is added.
On product detail, products without migrated review counts keep the old visual
fallback of five stars and `5 lượt đánh giá`. The separate review summary below
the detail view can still show a true empty state until a real reviews table is
added.

The legacy product API response shape is preserved for `/api/product/:id` and
product updates: D1 now returns the full product row with `_id`, `imageUrls`,
`rating`, `reviewsCount`, active/deleted flags, and timestamps instead of a
reduced detail object.

Legacy product-with-variants REST aliases (`/api/product/:id/variant` and
`/api/products/:id`) stringify `variant.values` in the response to match the old
admin/frontend proxy contract. The TanStack/tRPC product services keep variant
values as objects for the migrated `apps/web` UI.

Legacy product REST detail/update/delete routes now map service `statusCode`
values onto the HTTP response status as well as keeping the wrapper body, so
missing products no longer look like successful HTTP 200 responses to older
clients.

The product listing API keeps legacy default behavior: omitting `limit` no
longer truncates `/api/products` to 100 rows. Paginated callers can still pass
`page` and `limit`, while storefront pages keep their explicit page-size
behavior. The merged homepage and product listing page also follow the old
storefront fetch pattern by loading the full product set without artificial
24-row or 200-row caps before applying client-side paging.

The merged homepage and product listing now match the legacy storefront product
fetch more closely: the old Next pages called `/api/products` without
`isActive`/`isDeleted` filters, so the TanStack pages and sitemap no longer add
those filters implicitly. The homepage layout also keeps the old storefront
grid background, centered banner, wide breadcrumb offset, disabled filter
button group, eight-products-per-page grid, and cover-style product images.
The TanStack homepage now also mounts the previously ported `apps/home`
content sections after the product grid: mosquito guard, video, feature grid,
strengths, customer reviews, order guide, size estimator, material notes, FAQ,
and newsletter capture. This moves the first screen beyond a bare product list
and closer to the old public homepage flow while still keeping the D1-backed
product grid from the old Next storefront.
The grid background is intentionally limited to the old root/product-list
surface. Legacy ecommerce child routes such as product detail, cart, and blog
listing inherited the plain ecommerce layout, so the TanStack product detail
and blog listing routes do not add the homepage grid background.
The shared product pagination stays compact with controls and page-window
ellipsis, so large D1 imports do not render an unbounded row of page buttons on
the storefront.

The product detail quick-order form keeps the old field labels and placeholders
from the Next storefront modal, including the legacy `Specific address` label.
API docs now also list `/api/products/:productId`, the old frontend alias for
fetching a product with variants.

The TanStack product detail page now uses the public product lookup, so
inactive/deleted rows imported into D1 stay hidden from storefront product
detail just like the legacy `/api/product/:id/variant` contract. Admin product
detail/edit routes still use `includeInactive` so staff can inspect disabled or
soft-deleted records. Product detail also requires an exact migrated variant
match before opening quick-order or adding the item to cart, so invalid
cross-product option combinations cannot fall back to the base price. Until a
real reviews table is migrated, the review section keeps the old static review
shell as the fallback visual state for valid products only.

The cart checkout page is now a TanStack Start route backed by the migrated
tRPC order mutation instead of the old Next API proxy. It keeps the legacy
checkout fields, validates the cart is not empty before submit, writes the
order into D1, clears the local cart on success, and uses Vietnamese labels for
the customer address fields except where the old UI explicitly used English
copy, such as `Specific address`. The `specificAddress` field remains required
at both the form and API schema layers, matching the old checkout flow instead
of allowing incomplete shipping addresses through server-side writes.
Customer order totals are calculated server-side from submitted line items; the
legacy/client `total` field is accepted for compatibility but is no longer
trusted for persisted D1 totals.
Product quick-order accepts missing `specificAddress` in legacy API payloads and
stores an empty string, while the active UI still renders the same field as
required.
Product quick-order Telegram messages are generated from the D1-priced order
item and persisted total instead of trusting client-supplied product name or
price fields.
Cart storage reads the old Zustand `cart-storage` shape during migration and
the active cart merge behavior now follows the legacy store: adding the same
product again increments quantity by product id instead of creating separate
lines per variant. The header cart badge also follows the old navbar by showing
the number of cart lines, not the total quantity. The cart review panel keeps
the old `rounded-medium bg-content2` summary surface, the plain `Đặt hàng`
submit button, and the duplicated product-name title treatment from the legacy
cart card while still submitting through the D1/tRPC order mutation.
The shared UI globals expose the legacy NextUI token aliases used by migrated
screens, including `content2`, `default-*`, and `rounded-medium`, so ported
classes render instead of being ignored by Tailwind.
Price parsing is normalized at storefront, admin, API, and export boundaries:
legacy Mongo prices can be plain strings, dotted VND strings, or ranges such as
`120.000 - 150.000`. Display paths format these ranges correctly, and order
write paths use the first numeric price unless a concrete variant price is
selected. Product creation from variant-only legacy bodies keeps the old
controller's `min - max` price shape, including equal ranges such as
`42000 - 42000`, instead of collapsing them to a single number.
Variant values are also normalized at the migration boundaries. The Drizzle/D1
runtime stores variant `values` as JSON objects, while legacy REST compatibility
routes still stringify them for old clients that call `JSON.parse`. API writes,
admin product edit/detail, storefront product detail, and the Mongo exporter all
accept either object values or legacy JSON-string values.
Product and variant create/update writes now run inside a D1 transaction, so a
failed variant replacement cannot leave a partially updated product state.
Partial product updates no longer inherit create-time defaults. Inventory-only
updates such as `{ productId, quantity }` leave existing variants untouched,
and variants are replaced only when the request explicitly includes the
`variants` field.
Public product list/detail APIs now enforce `is_active = true` and
`is_deleted = false` in the shared product service. Admin screens use protected
`adminList`/`adminWithVariants` tRPC procedures when they need to inspect
disabled or soft-deleted migrated products, so storefront callers cannot opt
into inactive rows through query params or `includeInactive`.
Blank `categoryId` values are normalized away before product writes, and
non-empty category ids are still checked before the D1 transaction writes the
product row.

The merged storefront header keeps the old NextUI navbar structure: brand,
navigation, search, theme switch, cart dropdown, and GitHub action. Extra CTA
buttons that were not in the legacy navbar are kept out of the header so the
first viewport stays visually aligned with the old storefront. Routes are
TanStack links where the old app now lives inside `apps/web`, but visual
affordances such as the Github icon and mobile menu treatment are preserved.
Opening the mobile menu also restores the old translucent `bg-default-200/50` /
dark `bg-default-100/50` navbar state from NextUI.
The floating contact widget also follows the old storefront `FABButton`
contract: only phone and Zalo round buttons are rendered, both keep the bounce
and hover/focus scale treatment, and the Zalo link sends the legacy
`Hello Zalo` message. The Zalo button uses the legacy custom Zalo SVG instead
of a generic chat icon because lucide does not provide a branded Zalo glyph.
Product cards keep the old storefront fallback rating display: migrated
products without real rating data still render `5` next to the star, matching
the legacy `CardItem` component until a real review/rating import is available,
and the star uses the old outline Solar icon for closer visual parity.
Storefront product cards also keep the legacy scale-down/catalog image behavior
instead of cropping product images inside the square card frame.
The product detail accordion now follows the old `ProductItem` layout more
closely: sections are collapsed initially and the description section keeps a
short preview under the title, matching the legacy NextUI accordion subtitle
behavior. The accordion shell also keeps a bordered, rounded, icon-led
treatment close to the old NextUI `variant="bordered"` component while staying
native to TanStack/React.
Variant option controls on the product detail page keep the compact old
`SizeRadioItem` treatment: small rounded buttons, 8px height scale, 12px group
gap, selected primary background, and pressed feedback.

The global web shell clamps horizontal overflow at the document level. This
keeps the migrated carousel, floating contact buttons, and mobile header from
creating a sideways scrollbar on narrow viewports while preserving the old
single-column mobile storefront flow.

The shared site footer is restricted to the landing/home surfaces (`/` and
`/gioi-thieu`) to match the old storefront split: the legacy root page rendered
`Footer`, while ecommerce detail/cart/blog pages inherited only Navbar plus the
floating contact buttons. Admin, auth, and legacy redirect routes still
suppress public chrome.

The sitemap product feed also omits `limit`, matching the old Next sitemap
behavior so imported product URLs are not capped. `/robots.txt` is preserved as
a public asset with the old allow-all rules, sitemap URL, and host value.

Admin product-dependent screens also avoid artificial 200-row caps: dashboard
metrics, product table, inventory views, and manual order creation all query
the full migrated product set unless a caller explicitly requests pagination.
The shared D1 order list service also returns the full order set for admin
dashboard, admin order management, and `/api/orders`, ordered by newest first.
The admin product table keeps the legacy four-row page size while using compact
page-window pagination, so large D1 product imports do not render an unbounded
row of page buttons inside the admin table footer.

## Notion posts to D1 SQL

Required env:

```bash
NOTION_API_KEY=
NOTION_DATABASE_ID=
NOTION_VERSION=2022-06-28
D1_NOTION_IMPORT_SQL_PATH=../../packages/db/notion-d1-import.sql
```

The exporter loads env from root `.env`, `apps/web/.env`, and `packages/db/.env`.

Generate SQL:

```bash
bun run db:notion-to-d1:sql
```

Import locally:

```bash
bun --cwd apps/web wrangler d1 execute rem-viet-local --local --file ../../packages/db/notion-d1-import.sql --config wrangler.jsonc
```

The exporter writes Notion pages into `posts`, including slug, Notion page URL,
cover image, tags, status, publish date, page blocks as JSON content, and any
`table_of_contents` blocks for the TanStack Start post renderer.

## Admin product media

The merged product form keeps the old URL-based image workflow and now also
uploads selected local image files to the Cloudflare R2 `PRODUCT_IMAGES` binding
before creating/updating the D1 product row. Uploaded objects are served through
the TanStack Start `/api/product-images/:key` route, while
`/api/uploads/product-images` is admin-only and validates image type plus the
5MB legacy helper limit. The file-picker helper text and empty variant table
state are localized to match the Vietnamese legacy add/edit product forms.

Inventory is canonical under `/admin/inventory` and `/admin/inventory/new`;
the old root-level admin URLs redirect there. Product detail/edit inside admin
uses the same D1 service with `includeInactive` enabled so disabled or soft
deleted records from the admin table can still be inspected and edited.
The migrated admin product detail route also keeps the old view-product visual
treatment: image URLs, name, description, and prices render in snippet-like
copy fields using legacy `default-100`/`rounded-large` tokens, variant values
render as rounded chips, and the variant combination table keeps the old
`Values`/`Price` column labels.

The admin dashboard preserves the old card/chart/recent-order layout but no
longer uses placeholder revenue, customer avatars, or static order counts. The
metrics are now derived from D1 orders/products: total and completed revenue,
average order value, status counts, unique customers, low-stock products, top
customers, and recent orders. Empty chart states are shown explicitly instead
of rendering fake chart bars. The migrated product analysis selector is now
localized as `Loại phân tích` while keeping the same price/stock/sales modes as
the old admin chart. The chart itself keeps the old Recharts affordances at the
UI level: dashed grid lines, Y-axis values, X-axis labels, a legend chip, and a
hover/focus tooltip, without reintroducing Recharts as a dependency.

The old admin sidebar item `Thêm đơn hàng` now has a real TanStack Start page at
`/admin/orders/new` instead of landing on the order list. It creates manual D1
orders from active migrated products, computes totals, invalidates the admin
order list, and keeps `/add-order` as the legacy redirect. Manual orders now
load active product variants per selected row, require an exact active variant
combination when a product has variants, and send the selected variant values to
the shared D1 order service so manual admin orders use the same repricing and
availability checks as cart/quick-order checkout.
The migrated admin product form keeps the legacy add/edit product labels and
placeholders for image URL, product name/description, variant name, and base
price fields. D1-only metadata such as category and size is still editable, but
it is grouped under a collapsed `Thông tin mở rộng` section so the default
admin product form shape stays close to the old add/edit product UI. Manual
admin order contact fields also use the Vietnamese address labels used by the
migrated checkout flow.

Admin order management is intentionally more complete than the old admin app:
the legacy menu exposed order links, but the old `(admin)` tree did not include
real order-management pages and the old Express server only exposed Telegram
order notification endpoints. In the TanStack Start port, those notifications
now persist D1 order rows first, and admin order pages read/update those rows.

Admin authentication is also a deliberate migration boundary. The old admin
login used a client-written `isLoggedIn=true` cookie with hard-coded test
credentials, while the TanStack Start app uses Better Auth server-side guards
on each admin route. Existing old admin cookies do not grant access to the new
admin routes; operators must sign in through the migrated auth flow. The auth
screens still keep the old textured, right-aligned admin layout. The sign-up
route renders the legacy registration form shape in a disabled state so the old
UI remains recognizable without reopening public admin account creation.

## Telegram notifications

The old Express backend sent Telegram messages from `/api/send-newletter`,
`/api/send-product-order`, and `/api/send-cart-order`. The TanStack Start API now
keeps the same routes, writes the order/newsletter data into D1 first, then sends
Telegram via the Bot API when these env vars are configured:

```bash
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

If either value is empty, D1 writes still succeed and the Telegram step is
skipped.
The migrated product-order and cart-order paths share the same contact-line
formatter while keeping their separate input schemas, so the product order route
no longer depends on cart-only fields just to render the legacy Telegram
message. Legacy wrappers still return `{ statusCode: 200 }` on success.

Order pricing is now canonical on the server. Cart and quick-order payloads may
still send the old client-side `price`, `productPrice`, and `total` fields for
legacy shape compatibility, but D1 order rows are priced from active,
non-deleted products and exact active variant matches. Deleted products,
inactive products, and unknown variant combinations are rejected before an order
is persisted. Order creation also rejects quantities above the product's D1
`quantity`, so migrated inventory is enforced before a row is written. The
public product detail route uses the same active/not-deleted filter; admin
product detail remains the only route that opts into inactive records for
inspection.

Product/category integrity is also guarded before writing D1 rows. Product
create/update validates `categoryId` in the product transaction, and category
delete checks usage and deletes in one transaction so active write paths cannot
create orphan category references. REST order/newsletter aliases now return
structured JSON `400` responses for validation or availability failures instead
of bubbling unhandled server errors.
The legacy product write endpoints and admin aliases (`/api/product`,
`/api/product/:productId`, `/api/add-product`, and
`/api/edit-product/:productId`) now use the same structured error wrapper after
the admin auth gate, so schema or service failures do not escape as unshaped
route errors during the Mongoose-to-D1 cutover.

The migration exporters now fail early on data that would be unsafe to import:
Notion post slugs are de-duplicated deterministically before hitting the unique
`posts.slug` constraint, and Mongo variants must reference an existing migrated
product instead of being assigned synthetic product ids. The SQL verification
script also checks product references stored inside JSON order/cart payloads,
which SQLite foreign keys cannot cover directly.

Run the migration-critical HTTP smoke checks against a local dev server with:

```bash
bun run smoke:migration
```

Run the static migration parity audit with:

```bash
bun run audit:migration-parity
```

This checks the old frontend/admin/backend routes against `apps/web`, verifies
legacy API aliases, confirms only `apps/web` is an active app workspace, asserts
Cloudflare D1/R2 and Drizzle migration surfaces are present, blocks Mongo or
Mongoose runtime imports outside offline export tooling, and verifies admin REST
surfaces include the Better Auth session guard. It also checks that D1 schemas
cover the mapped Mongo/Notion domains, import verification covers relational and
JSON product references, product/order services keep public/admin and server
pricing guards, and key UI parity markers for product detail, dashboard chart,
product upload, SEO, and smoke coverage remain present. It is a structural
check; it does not replace the HTTP smoke test or the SQL import verifier.

The smoke script verifies the legacy product list, admin write auth gates across
product, order, category, log, and upload APIs, legacy admin URL redirects,
unauthenticated admin redirects, newsletter validation, product image
upload/read guard rails, `/robots.txt`, bookmark API validation, and
deleted-product public/order guards. It also asserts that
public `/api/products` does not leak inactive or soft-deleted rows even if a
caller passes legacy `isDeleted` or `isActive` query parameters. Legacy dynamic admin product URLs
(`/view-product/:id`, `/edit-product/:id`, `/admin/view-product/:id`,
`/admin/edit-product/:id`) and the old admin product API aliases
(`/api/add-product`, `/api/edit-product/:id`) are smoke-tested when local D1 has
products. It is intentionally non-destructive; if the local D1 database does
not contain an inactive or soft-deleted product, the direct deleted-row
detail/order guard is reported as skipped instead of creating test data.
For CI or a seeded staging D1 database, run strict smoke mode so skipped
migration checks fail the command:

```bash
SMOKE_STRICT=true bun run smoke:migration
```

To force the full deleted-row guard against a known migrated product id:

```bash
SMOKE_DELETED_PRODUCT_ID=<deleted-product-id> bun run smoke:migration
```
