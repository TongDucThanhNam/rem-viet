# GOAL.md

> File này được tạo tự động bởi create-goal skill.
> Agent thực thi: đọc toàn bộ file này trước khi làm bất kỳ thứ gì.

---

## Objective

Tích hợp một CMS lite nội bộ cho Rem Viet trên stack hiện tại TanStack Start + tRPC + Drizzle/D1 + Cloudflare R2, để admin quản lý được posts, pages, media, navigation và site settings, trong khi giữ nguyên public blog/product/media contracts hiện có và KHÔNG publish CMS package/plugin ra ngoài monorepo.

---

## Context

- **Lý do**: repo đã có nền tảng admin shell, Better Auth admin guard, tRPC protected procedure, Drizzle/D1 schema, R2 upload flow và product CRUD. Phần còn thiếu không phải "xây CMS từ zero", mà là chuẩn hóa content model + admin UI + media metadata.
- **Ưu tiên**: correctness > speed. Content/admin/media chạm database, public URL và R2 object storage; backward compatibility quan trọng hơn làm nhanh.
- **Người thực hiện**: AI Agent, không có human review từng bước.
- **Ngày tạo**: 2026-06-27 (Asia/Saigon).

---

## Current State

| Item | Giá trị |
|------|---------|
| Framework / Runtime | TanStack Start `@tanstack/react-start@1.167.41`, TanStack Router `@tanstack/react-router@1.168.22`, Vite `8.0.8`, React `19.2.5`, Cloudflare Workers via Wrangler/Alchemy |
| Language | TypeScript |
| Package manager | Bun `1.3.12` |
| Dependencies chính | tRPC `11.16.0`, TanStack Query `5.99.0`, Drizzle ORM `0.45.1`, Drizzle Kit `0.31.8`, Better Auth `1.6.9`, Tailwind CSS v4 |
| Routes / modules | `[ước lượng]` 65 route files trong `apps/web/src/routes`; 6 API routers trong `packages/api/src/routers`; 6 DB schema modules trong `packages/db/src/schema` |
| Entry points | `apps/web/src/router.tsx`, `apps/web/src/routes/api/trpc/$.ts`, `packages/api/src/routers/index.ts`, `packages/db/src/schema/index.ts` |
| Config files | `apps/web/vite.config.ts`, `apps/web/wrangler.jsonc`, `packages/db/drizzle.config.ts`, `packages/infra/alchemy.run.ts`, `turbo.json` |
| DB state | `packages/db/src/schema/content.ts` hiện chỉ có `posts`; migrations đã tạo bảng posts và thêm `url`, `table_of_contents` |
| Posts API state | `packages/api/src/routers/posts.ts` chỉ có public `list` và `bySlug`; service `packages/api/src/services/posts.ts` map row sang legacy post shape |
| Public blog state | `/bai-viet`, `/bai-viet/$slug`, `/api/posts`, `/api/posts/$slug` đang đọc từ posts service và chỉ hiển thị `published` trên public page |
| Admin state | Product/category/order/inventory/log admin routes đã có; `AdminShell` mục "Bài viết" hiện trỏ ra public `/bai-viet`, chưa có CMS admin route |
| Media state | R2 flow hard-code product images: `apps/web/src/lib/product-images.ts`, `POST /api/uploads/product-images`, `GET /api/product-images/$key`, binding `PRODUCT_IMAGES`; product form đã upload file qua endpoint này |
| Test setup | Không thấy script test chuyên dụng trong package scripts. Verification hiện dựa vào `check-types`, `build`, migration generation và manual admin smoke |

---

## Target State

| Item | Giá trị |
|------|---------|
| Internal CMS module | Tạo `packages/cms` tên package `@rem-viet/cms` nếu cần shared CMS schemas/types/helpers. Package này là module nội bộ trong workspace, không publish. Runtime DB/API vẫn sống trong `packages/db`, `packages/api`, `apps/web`. |
| DB schema | `packages/db/src/schema/content.ts` chứa posts mở rộng SEO, pages, media, menus, site settings. Có migration Drizzle tương ứng trong `packages/db/src/migrations`. |
| API routing | Thêm `packages/api/src/routers/content.ts` và wire vào `appRouter` dưới `content`. Có nested procedures: `content.posts.*`, `content.pages.*`, `content.media.*`, `content.menus.*`, `content.siteSettings.*`. Giữ hoặc alias router `posts` cũ nếu cần để không phá tRPC consumers hiện hữu. |
| Posts | Admin-manageable: `list`, `bySlug`, `adminList`, `byId`, `create`, `update`, `delete`. Public list/detail chỉ trả `published` trừ khi procedure/service explicitly là admin. |
| Pages | CRUD admin cho pages với `blocks` JSON V1, `status`, SEO metadata. Public serving page content chỉ nếu `published`. |
| Media | Generic media upload/list/update/delete trên R2 + D1 metadata. Product image upload route cũ vẫn hoạt động trong giai đoạn compatibility. |
| Navigation | Header/footer menu quản lý được qua admin, lưu dưới dạng JSON items hoặc schema tương đương rõ ràng. |
| Site settings | Admin chỉnh logo, phone, address, socials, homepage sections. Có singleton settings row hoặc key-value model rõ ràng. |
| Admin UI | Thêm routes: `/admin/posts`, `/admin/posts/new`, `/admin/posts/$postId/edit`, `/admin/pages`, `/admin/settings`; thêm `/admin/media` nếu media list/delete/alt text không được nhúng đầy đủ trong settings/pages UI. Sidebar `AdminShell` có nhóm Content/System đúng route admin, không trỏ "Bài viết" về public blog. |
| Editor V1 | Không build block editor nặng. Posts dùng Markdown/plain textarea hoặc existing Notion-block JSON textarea. Pages dùng JSON blocks đơn giản có validation. |
| Không thay đổi | Public routes `/bai-viet`, `/bai-viet/$slug`, REST `/api/posts`, `/api/posts/$slug`, legacy product routes, product CRUD behavior, Better Auth admin guard. |

---

## Required Content Model

### Posts

- `id`
- `title`
- `slug` unique
- `description`
- `coverImage`
- `tags` JSON string array
- `content`
- `status`: `draft | published`
- `publishDate`
- `seoTitle`
- `seoDescription`
- Keep existing compatibility fields where already present: `url`, `tableOfContents`, timestamps.

### Pages

- `id`
- `title`
- `slug` unique
- `blocks` JSON
- `status`: `draft | published`
- `seoTitle`
- `seoDescription`
- timestamps

Suggested V1 block type:

```ts
type PageBlock =
  | { type: "hero"; title: string; subtitle?: string; image?: string }
  | { type: "richText"; content: string }
  | { type: "productGrid"; categoryId?: string; limit?: number }
  | { type: "cta"; title: string; href: string };
```

### Media

- `id`
- `key`
- `url`
- `altText`
- `size`
- `mimeType`
- `width` / `height` if cheaply available; otherwise `[cần xác nhận]`
- `createdAt`
- `updatedAt`

Important route/key constraint: if route remains one segment like `/api/media/$key`, object keys must not contain raw `/`. Either keep keys as `uuid.ext`, or implement a splat route before storing keys with prefixes.

### Navigation

- Header menu
- Footer menu
- Menu item fields: `label`, `href`, `order`, optional `children`
- V1 may store `items` as JSON on `menus` table. Do not overbuild drag/drop nested editor unless needed for MVP.

### Site Settings

- `logo`
- `phone`
- `address`
- `socials` JSON
- `homepageSections` JSON
- Use singleton row or key-value table. Pick one and document it in code comments or service naming.

---

## Constraints

> Đây là phần quan trọng nhất. Agent PHẢI tuân theo.

- [ ] CHỈ implement CMS lite MVP trong monorepo. KHÔNG publish package, KHÔNG tạo `bun create ...`, KHÔNG biến thành external plugin/generator.
- [ ] Nếu tạo `@rem-viet/cms`, giữ nó là internal workspace package cho shared schemas/types/helpers; không nhét Cloudflare runtime hoặc database connection vào package này nếu làm vậy khiến dependency graph khó deploy.
- [ ] KHÔNG rewrite landing page CSS/animation hoặc các component marketing page ngoài nhu cầu đọc site settings.
- [ ] KHÔNG phá public blog URL: `/bai-viet`, `/bai-viet/$slug`, `.html` slug compatibility, `/api/posts`, `/api/posts/$slug`.
- [ ] KHÔNG phá product image URLs hiện có: `/api/product-images/:key` vẫn phải serve được object cũ.
- [ ] KHÔNG move/delete R2 objects hiện có trong V1. Nếu rename binding sang `MEDIA`, bind cùng bucket hoặc giữ compatibility binding `PRODUCT_IMAGES` cho đến khi có migration dữ liệu riêng.
- [ ] KHÔNG upgrade dependencies không liên quan.
- [ ] KHÔNG refactor product CRUD, order CRUD, auth, landing animation, or theme system ngoài integration points bắt buộc.
- [ ] KHÔNG build block editor nặng ở V1. Chọn Markdown/plain textarea hoặc JSON blocks có validation.
- [ ] Public procedures/services không được leak `draft` content. Draft content chỉ qua protected admin procedure hoặc server path có admin guard.
- [ ] Media upload phải validate file type, per-file size, batch size và admin session như product image flow hiện tại.
- [ ] Media delete phải xử lý cả DB metadata và R2 object. Nếu một bước fail, trả error rõ ràng; không silently report success.
- [ ] Nếu gặp schema/data migration ambiguity có thể mất dữ liệu: DỪNG và mô tả blocker, KHÔNG tự workaround.

---

## Success Criteria

> `/goal` chỉ mark complete khi evidence dưới đây chứng minh completion.

### Required Evidence per Criterion

| # | Tiêu chí | Verification Command | Expected Output / Signal |
|---|----------|----------------------|--------------------------|
| 1 | DB schema có posts SEO, pages, media, menus, site settings và migration tương ứng | `rg "seo_title|seo_description|pages|media|menus|site_settings|siteSettings" packages/db/src/schema/content.ts packages/db/src/migrations` | Có match trong schema và migration; không chỉ có type/interface ở UI |
| 2 | API có CMS router protected/public đúng scope | `rg "contentRouter|adminList|create|update|delete|pages|media|siteSettings|menus" packages/api/src/routers packages/api/src/services` | Có `contentRouter` hoặc tương đương wired vào `appRouter`; admin mutations dùng `protectedProcedure` |
| 3 | Admin routes required tồn tại | `Test-Path -LiteralPath 'apps/web/src/routes/admin/posts.tsx'; Test-Path -LiteralPath 'apps/web/src/routes/admin/posts/new.tsx'; Test-Path -LiteralPath 'apps/web/src/routes/admin/posts/$postId/edit.tsx'; Test-Path -LiteralPath 'apps/web/src/routes/admin/pages.tsx'; Test-Path -LiteralPath 'apps/web/src/routes/admin/settings.tsx'` | Tất cả trả `True`. Nếu media có route riêng, `apps/web/src/routes/admin/media.tsx` cũng tồn tại |
| 4 | Generic media endpoint tồn tại và product endpoint cũ vẫn tồn tại | `Test-Path -LiteralPath 'apps/web/src/routes/api/uploads/media.ts'; Test-Path -LiteralPath 'apps/web/src/routes/api/media/$key.ts'; Test-Path -LiteralPath 'apps/web/src/routes/api/uploads/product-images.ts'; Test-Path -LiteralPath 'apps/web/src/routes/api/product-images/$key.ts'` | Tất cả trả `True`, hoặc có documented compatibility route equivalent |
| 5 | Product form không còn hard-code upload mới vào product-only endpoint | `rg "/api/uploads/product-images|product-images" apps/web/src/components/product-form.tsx apps/web/src/lib` | Không còn usage trong product form cho upload mới, trừ compatibility helper/comment rõ ràng |
| 6 | Typecheck DB/API/Web pass | `bun --cwd packages/db run check-types; bun --cwd packages/api run check-types; bun --cwd apps/web run check-types` | Exit code 0 cho cả ba |
| 7 | Web build pass | `bun --cwd apps/web run build` | Exit code 0; Vite build hoàn tất |
| 8 | Migration có thể apply local | `bun run db:migrate:local` | Exit code 0 trên local D1/miniflare |
| 9 | Admin smoke pass | Manual browser smoke khi dev server chạy | Admin tạo draft post không xuất hiện ở `/bai-viet`; publish thì xuất hiện; edit/delete phản ánh đúng; upload media trả URL public; delete media khiến URL đó 404 hoặc không còn list |

### Reference Artifacts

- `GOAL.md` này là source of truth cho completion.
- `AGENTS.md` ở repo root: verification command và landing/admin conventions.
- `packages/db/src/schema/content.ts`: source of truth cho content tables.
- `packages/api/src/services/posts.ts`: source of truth cho legacy post shape cần giữ.
- `apps/web/src/routes/api/uploads/product-images.ts` và `apps/web/src/routes/api/product-images/$key.ts`: source of truth cho R2 flow cần extract.
- `apps/web/src/components/product-form.tsx`: source of truth cho upload UX hiện có.
- `apps/web/src/components/admin-shell.tsx`: source of truth cho sidebar/navigation admin.

### Completion Condition

Agent kết thúc khi và chỉ khi:

- [ ] Tất cả verification commands pass với expected output.
- [ ] Manual admin smoke ở criterion 9 được báo cáo rõ từng item.
- [ ] Không có regression với public blog, product image URLs, product CRUD, Better Auth admin guard.
- [ ] Mọi route/admin/API/schema trong Target State được implement hoặc được đánh dấu `[cần xác nhận]` với blocker thật sự.

---

## Execution Plan

> Thực hiện theo thứ tự. Báo cáo sau mỗi bước trước khi tiếp tục.

1. **Lock current contracts**
   - Đọc lại các files trong Reference Artifacts.
   - Ghi nhanh current public/admin/media contracts vào implementation notes hoặc PR summary.
   - Không edit landing page hoặc unrelated modified files.

2. **Scaffold internal CMS shared layer**
   - Nếu cần shared types/schema across db/api/web, tạo `packages/cms` với package name `@rem-viet/cms`.
   - Export Zod schemas/types cho `PostStatus`, `PageBlock`, media validation constants, menu item/settings payload.
   - Add workspace entry nếu tạo package.

3. **Extend Drizzle content schema**
   - Update `packages/db/src/schema/content.ts`:
     - Extend `posts` with SEO fields while preserving current columns.
     - Add `pages`, `media`, `menus`, `siteSettings` or equivalent explicit tables.
     - Add indexes for slug/status/media key/menu location.
   - Run Drizzle generation to create migration.
   - Inspect generated SQL; make sure it is additive and does not drop existing posts data.

4. **Build content services**
   - Add/extend services in `packages/api/src/services/content.ts` or keep split files if clearer.
   - Implement posts `adminList/byId/create/update/delete`, preserving existing `listPosts/getPostBySlug` public behavior.
   - Implement pages CRUD and public bySlug.
   - Implement media metadata create/list/update/delete.
   - Implement menus/settings get/update.
   - Use Zod input schemas, slug normalization, duplicate slug handling and status filtering.

5. **Wire tRPC content router**
   - Add `packages/api/src/routers/content.ts`.
   - Wire `content` into `packages/api/src/routers/index.ts`.
   - Keep old `posts` router path if any current consumer expects `trpc.posts.*`.
   - Public reads use `publicProcedure`; admin list/mutations use `protectedProcedure`.

6. **Extract generic media R2 flow**
   - Create generic media helper, e.g. `apps/web/src/lib/media.ts`.
   - Add `POST /api/uploads/media` for multipart upload:
     - admin session required,
     - validate mime/size/batch,
     - write to R2,
     - write metadata row to D1,
     - return `{ key, url, size, mimeType, altText? }`.
   - Add `GET /api/media/$key` with immutable cache headers.
   - Add delete path via tRPC `content.media.delete` or server route, deleting both R2 object and DB metadata.
   - Preserve `/api/uploads/product-images` and `/api/product-images/$key` as compatibility wrappers or unchanged routes.
   - Update product form to upload new files through generic `/api/uploads/media`, while accepting old image URLs.

7. **Build admin posts UI**
   - Add `/admin/posts`, `/admin/posts/new`, `/admin/posts/$postId/edit`.
   - Reuse product admin patterns: `AdminShell`, TanStack Query, tRPC mutations, invalidate query filters, `useNavigate`.
   - Fields: title, slug, description, cover image/media URL, tags, content textarea, status, publish date, SEO title/description.
   - Ensure draft/published filter and delete action exist.

8. **Build pages/settings/navigation/media UI**
   - Add `/admin/pages` with list + create/update/delete. Inline editor or modal is acceptable if ergonomic.
   - Add `/admin/settings` for logo, phone, address, socials, homepage sections and header/footer menus.
   - Add `/admin/media` if media list/delete/alt text cannot be managed naturally from settings/pages.
   - Update `AdminShell` sidebar to expose Content routes.

9. **Preserve public behavior**
   - Keep `/bai-viet` and `/bai-viet/$slug` reading only published posts.
   - Keep REST `/api/posts` and `/api/posts/$slug` behavior, including `.html` slug compatibility.
   - Do not change product pages except upload endpoint switch.

10. **Verify**
    - Run all commands in Success Criteria.
    - Run manual admin smoke:
      - create draft post,
      - verify absent from public list,
      - publish and verify public list/detail,
      - edit and delete,
      - upload/list/update alt/delete media,
      - verify legacy `/api/product-images/:key` still serves old objects if test object exists.
    - Report exact commands and results.

---

## Out of Scope

- Publishing `@rem-viet/cms` to npm or turning it into `@your-agency/tanstack-cms-kit`.
- Building `bun create tanstack-cloudflare-site`.
- Full visual block editor, drag/drop page builder, collaborative editing, version history, preview workflows.
- Reworking landing page design/GSAP animation.
- Replacing Better Auth or changing auth model.
- Changing product/order/inventory domain behavior except media upload endpoint integration.
- Migrating existing R2 objects to a new bucket. V1 must use compatibility binding/routes instead.
- Adding rich asset transforms/CDN image resizing unless already available.

---

## References

- Local: `packages/db/src/schema/content.ts`
- Local: `packages/api/src/routers/posts.ts`
- Local: `packages/api/src/services/posts.ts`
- Local: `packages/api/src/routers/products.ts`
- Local: `apps/web/src/routes/admin/products.tsx`
- Local: `apps/web/src/routes/admin/products/new.tsx`
- Local: `apps/web/src/routes/admin/products/$productId/edit.tsx`
- Local: `apps/web/src/routes/api/uploads/product-images.ts`
- Local: `apps/web/src/routes/api/product-images/$key.ts`
- Local: `apps/web/src/lib/product-images.ts`
- Local: `apps/web/src/components/product-form.tsx`
- Official TanStack Start Server Routes: https://tanstack.com/start/v0/docs/framework/react/guide/server-routes
- Official TanStack Start Server Functions: https://tanstack.com/start/v0/docs/framework/react/guide/server-functions
- Official tRPC Context/Authorization/Procedures: https://trpc.io/docs/server/context, https://trpc.io/docs/server/authorization, https://trpc.io/docs/server/procedures
- Official Drizzle D1 docs: https://orm.drizzle.team/docs/connect-cloudflare-d1
- Official Drizzle migrations docs: https://orm.drizzle.team/docs/migrations
- Official Cloudflare R2 Workers API docs: https://developers.cloudflare.com/r2/api/workers/workers-api-usage/
- Official Cloudflare R2 bindings reference: https://developers.cloudflare.com/r2/api/workers/workers-api-reference/

---

## Agent Instructions

### Execution

1. Đọc toàn bộ file này trước khi làm bất kỳ thứ gì.
2. Tuân theo Constraints tuyệt đối.
3. Thực hiện Execution Plan theo thứ tự, từng bước một.
4. Sau mỗi bước: báo cáo ngắn gọn kết quả trước khi tiếp tục.
5. Nếu phát hiện conflict giữa Constraints và Execution Plan: ưu tiên Constraints.
6. Nếu gặp thứ gì không có trong GOAL.md và có risk phá data/public contract: DỪNG và hỏi, không tự assume.
7. Khi xong: verify toàn bộ Success Criteria và báo cáo từng item.

### Anti-bias Instructions

**Chống Scope Shrink**

- KHÔNG redefine "done" thành chỉ posts CRUD nếu media/pages/settings/navigation chưa xong.
- KHÔNG bỏ legacy product image compatibility vì "generic media đã có".
- KHÔNG coi typecheck pass là đủ nếu manual admin smoke chưa chạy.

**Chống Uncertainty Stop**

- Nếu không chắc một route/procedure đã wired chưa, inspect routeTree/generated types/router exports.
- Nếu không chắc migration có destructive không, đọc generated SQL.
- Nếu không chắc media delete xử lý R2 chưa, test hoặc inspect exact code path.

**Chống Memory Trust**

- Không assume đã tạo migration/schema/procedure vì nhớ đã edit. Dùng `rg`, `Test-Path`, typecheck/build output thật.
- Previous conversation context chỉ là hint; current worktree là authoritative.
