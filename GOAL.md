# Trạng Thái Migration TanStack Start + D1

  ## Hiện Tại Đã Làm Được

  - Repo đã chuyển hướng sang một app active duy nhất: apps/web. Root workspace chỉ trỏ tới apps/web và các package mới; apps/frontend, apps/admin, apps/backend, apps/home vẫn còn nguyên để làm nguồn đối chiếu.
  - apps/web đã là TanStack Start app, gom storefront, admin, home/landing và API vào cùng một runtime.
  - Backend Express/Mongoose cũ đã được port thành TanStack Start API routes + tRPC trong apps/web/packages/api.
  - Database runtime đã chuyển sang Drizzle + Cloudflare D1. Active runtime không import mongoose/mongodb; mongodb chỉ còn trong offline exporter ở packages/db.
  - Đã có schema/migration D1 cho catalog, orders/carts/newsletter, posts, logs và auth.
  - Better Auth đã thay admin cookie cũ; admin/write APIs có guard bằng ADMIN_EMAILS.
  - Đã có exporter Mongo -> D1 SQL, Notion -> D1 SQL, migration summary, import verifier, fixture verifier.
  - Nhiều route legacy đã được giữ bằng redirect hoặc route tương đương:
    storefront, sản phẩm, bài viết, giỏ hàng, admin dashboard/products/orders/
    inventory/categories/logs, API aliases.
  - Một phần UI parity đã được migrate: header/footer, product card/detail, cart,
    blog detail Notion renderer, admin shell, dashboard chart, product form
    upload, product detail admin.

  ## Verification Vừa Chạy

  - bun run audit:migration-parity: pass, 89 checks.
  - bun run check-types: pass, 7/7 package tasks.
  - bun run db:migration:verify:fixture: pass, fixture import đủ categories/
    products/variants/promotions/carts/orders/logs/posts.
  - Build web đã pass ở lượt trước; smoke migration cũng đã pass ở lượt trước
    nhưng còn skip vài case vì D1 local chưa có seed đầy đủ.

  ## Việc Còn Thiếu Để Gọi Là Hoàn Thành

  - Chạy migration bằng dữ liệu thật: export Mongo thật, export Notion thật, chạy
    db:migration:summary, db:migration:verify, rồi import vào local/staging D1.
  - Seed D1 đầy đủ rồi chạy strict smoke: cần active product, deleted/inactive
    product, variant, category, order, cart, post; sau đó chạy SMOKE_STRICT=true
    bun run smoke:migration.
  - Verify deploy Cloudflare thật: D1 database id, R2 bucket, Better Auth URL/
    secret, ADMIN_EMAILS, Telegram env, JSONLink key, Alchemy/Wrangler deploy.
  - Làm visual/manual parity cuối cho các flow quan trọng: storefront product/
    cart với data thật, admin add/edit/view product, order management, auth
    screens.
  - Quyết định scope các domain legacy không mounted trong API cũ: company, role,
    user, job, CV, certificate, application, notification. Hiện tại chúng được
    giữ làm reference, chưa đưa vào D1 vì không nằm trong route active đã
    migrate.
  - Dọn repo trước khi chốt: review untracked tree, xác nhận .antigravitycli/ có
    giữ không, rồi commit migration theo từng phần rõ ràng.

  ## Assumptions

  - Không xóa legacy apps cho tới khi dữ liệu thật + strict smoke + visual parity
    pass.
  - apps/web là app duy nhất active sau migration.
  - Mongoose/Mongo chỉ được phép tồn tại trong legacy reference và offline migration tooling, không nằm trong runtime mới.