# GOAL — CMS Plugin hoàn chỉnh cho website TanStack Start

> Ngày nghiên cứu: 2026-08-20  
> Trạng thái: Code-only implementation goal
> Đối tượng: Senior Web Developer/Freelancer xây website bằng TanStack Start + React  
> Phạm vi: chỉ code CMS code-first, self-hosted, visual authoring và reusable packages
> Testing, E2E, user verification, pilot, receipt và release gate được tách khỏi
> goal này tại [`perfect-cms-plugin-verification-index.vi.md`](./perfect-cms-plugin-verification-index.vi.md)

## 1. Kết luận ngắn

Repository hiện tại đã implement code scope của một **CMS application framework
cho TanStack Start**, không còn là CRUD hoặc kernel rời rạc:

- collection/field schema có type, validation và migration;
- draft, publish, schedule, revision, restore và optimistic conflict;
- quan hệ, localization, quyền theo capability và lifecycle hooks;
- generated Admin Platform v2, Field v2, DAM và official feature modules;
- unified visual authoring, secure preview v2, template factory và reusable content;
- durable jobs, transactional outbox/webhooks và multi-document releases;
- local, Cloudflare và PostgreSQL/S3-compatible provider contracts;
- extension SDK, agency control plane, upgrade/rollback và handover paths;
- Rèm Việt + Atelier dùng chung packaged kernel/editor mà không copy core source.

Các khoảng trống implementation ban đầu đã được đóng trong Section 9. Full E2E,
user verification, human acceptance và release receipts là công việc downstream
được tách khỏi goal này.

**Định vị nên chọn:**

> CMS application framework dành cho TanStack Start: code-first như Payload,
> visual-first như Storyblok/Sanity, edge-native như Cloudflare, nhưng vẫn giữ
> component React và dữ liệu của developer làm source of truth.

Không nên cố trở thành “WordPress viết lại bằng React”. WordPress thắng bằng hệ
sinh thái hơn 69.000 plugin, theme, hosting và thói quen người dùng. Sản phẩm này
nên thắng ở phân khúc agency/freelancer cần **một codebase TypeScript, UI React
thật, triển khai tách biệt theo khách hàng, không lock-in SaaS và không phá thiết
kế khi giao quyền sửa nội dung**.

## 2. Định nghĩa “hoàn chỉnh”

CMS được xem là hoàn chỉnh cho use case này khi một developer có thể:

1. cài vào một app TanStack Start hiện hữu bằng một command;
2. khai báo collection/block một lần và nhận được schema, admin, API, validation,
   migration, preview và renderer contract;
3. chọn provider mà không sửa domain model;
4. giao cho khách hàng sửa page, post, global content, media và SEO mà không
   đụng JSON/code;
5. kiểm soát chính xác phần nào được sửa, di chuyển, thêm hoặc xóa;
6. preview đúng component production trên desktop/tablet/mobile;
7. review, schedule, publish, rollback và audit an toàn;
8. nâng cấp package/template có migration và đường rollback;
9. backup/export toàn bộ content để rời provider;
10. vận hành được jobs, webhook, cache invalidation, email và media processing;
11. có tài liệu, diagnostics và compatibility toolkit đủ để một repo độc lập
    tích hợp đúng;
12. không cần Sanity, Payload hoặc dịch vụ trả phí nào để chạy core product.

### 2.1 Ranh giới code-only

Goal này chỉ mô tả source code, package, schema, runtime, adapter, CLI, Admin UI
và documentation phải tồn tại trong repository. Completion của goal được xác
định bằng checklist code tại Section 9, không phụ thuộc staging, full E2E,
browser matrix, user verification, human pilot, operator walkthrough, paid
entitlement hoặc external receipt.

Toàn bộ validation chạy sau cùng được index tại
[`perfect-cms-plugin-verification-index.vi.md`](./perfect-cms-plugin-verification-index.vi.md).
Document đó là downstream verification backlog và không được block `/goal
resume`, code implementation, commit/merge hoặc trạng thái hoàn thành của goal
code-only này. Paid/commercial work tiếp tục được defer riêng tại
[`deferred-paid-upgrades.md`](./deferred-paid-upgrades.md).

## 3. Baseline implementation trong repository

| Năng lực                      | Trạng thái code   | Code/contract chính                                                              |
| ----------------------------- | ----------------- | -------------------------------------------------------------------------------- |
| Collection schema + migration | Hoàn chỉnh        | `@agency/cms-core`, contiguous migration và registry validation                  |
| Field system                  | Hoàn chỉnh        | Field v2 scalar/nested/relationship/virtual catalog và generated controls        |
| Draft/publish/version/restore | Hoàn chỉnh        | runtime contract, immutable revision và provider adapters                        |
| Localization                  | Hoàn chỉnh        | lifecycle độc lập theo locale và fallback metadata                               |
| Relationship integrity        | Hoàn chỉnh        | to-one/to-many, restrict/nullify và atomic provider checks                       |
| Access control                | Hoàn chỉnh        | server authorization, field/component permission và Better Auth roles            |
| Generated admin               | Hoàn chỉnh        | Admin Platform v2 list/form/bulk/tree/search/dashboard primitives                |
| Visual authoring              | Hoàn chỉnh        | secure preview v2 và shared shell cho homepage/page/post/collection              |
| Media/DAM                     | Hoàn chỉnh        | metadata, folder/tag, variant, usage, safe delete, private delivery và retention |
| Workflow                      | Hoàn chỉnh        | scoped policies, assignment, checklist, comments, notifications và calendar      |
| API                           | Hoàn chỉnh        | typed server SDK, bounded REST/OpenAPI, scoped API keys và webhooks              |
| Hooks/extensions              | Hoàn chỉnh        | signed manifest, ordered hooks, lifecycle, compatibility và catalog              |
| Portability                   | Hoàn chỉnh        | deterministic import/export, dry-run, backup/restore và rollback contracts       |
| Template reuse                | Hoàn chỉnh        | packaged shell cùng adapters Rèm Việt + Atelier                                  |
| Provider                      | Hoàn chỉnh        | local, Cloudflare và PostgreSQL/S3-compatible adapters                           |
| Jobs/queue                    | Hoàn chỉnh        | durable task/workflow/queue, retry, cancellation và dead-letter                  |
| Multi-document releases       | Hoàn chỉnh        | preview, validation, schedule và atomic/compensating publish                     |
| Ecosystem                     | Hoàn chỉnh cho v1 | official modules, extension SDK, signed catalog và provenance                    |
| Agency control plane          | Hoàn chỉnh cho v1 | isolated-stack fleet inventory, drift/health và guarded operations plans         |

Baseline chi tiết nằm ở:

- `docs/cms/core-competitiveness.md`
- `docs/cms/visual-authoring-architecture.md`
- `docs/cms/platform-kit-v1-completion-audit.md`
- `docs/cms/v1-completion-audit.md`

## 4. Benchmark đối thủ và bài học cần lấy

### 4.1 WordPress

WordPress không phải chuẩn tốt nhất về kiến trúc TypeScript, nhưng là chuẩn về
**khả năng giao cho khách hàng và mở rộng bằng ecosystem**:

- block có thể insert, move, duplicate, transform, nest và reuse;
- pattern/template cung cấp starter layouts;
- block/template locking giữ thiết kế, có content-only editing;
- roles/capabilities, revisions, REST API, media library và multisite có sẵn;
- plugin có activation/deactivation/uninstall lifecycle, hooks, settings,
  metadata, custom post types, taxonomies, cron và public directory;
- thư mục chính thức có hơn 69.000 plugin miễn phí.

Bài học: client không mua “kernel đẹp”; client mua **workflow quen thuộc, cài
thêm được, không mất dữ liệu, có người hỗ trợ và có cách giải quyết 80% yêu cầu
phổ biến mà không cần code mới**.

### 4.2 Payload CMS

Payload là đối thủ kỹ thuật gần nhất:

- schema code-first sinh Admin UI, REST, GraphQL và Local API;
- field catalog rộng: array, group, tabs, code, JSON, email, point, virtual/join,
  blocks, rich text, upload và presentational fields;
- access control ở collection/global/field/document và phản chiếu vào admin;
- auth có session, JWT, API key, verify email, forgot password và custom strategy;
- versions/drafts/autosave/diff/restore/scheduled publish;
- jobs queue có typed tasks, workflows, queues, schedule, retry, cancellation,
  concurrency và admin visibility;
- uploads có crop, focal point, image variants, format/resize và storage adapter;
- Postgres, SQLite và MongoDB là official database adapters;
- official plugins có form builder, SEO, search, redirects, multi-tenant, nested
  docs, import/export, Sentry và MCP;
- admin có custom views/components và user-configurable dashboard widgets.

Bài học: để cạnh tranh thực sự, sản phẩm phải là **application framework**, không
chỉ là content repository + một editor riêng cho homepage.

### 4.3 Sanity và Storyblok

Hai sản phẩm này đặt chuẩn cao cho editor experience:

- click-to-edit trên preview production;
- cập nhật preview realtime khi gõ;
- drag/drop trực tiếp trên canvas;
- responsive preview;
- workflow có stage, assignee, due date, comment và permission;
- release gom nhiều document, preview, validate, schedule và publish cùng nhau;
- DAM có folder/tag/search, focal point, image transform, metadata tùy biến,
  reference tracking, shared library và localized metadata;
- localization hỗ trợ field/document/folder/space tùy mô hình tổ chức.

Bài học: visual editing không chỉ là iframe + reorder block. Nó phải giảm thời
gian tìm field, phối hợp campaign và tránh việc editor phải hiểu content schema.

### 4.4 Directus và Strapi

Directus/Strapi nhấn mạnh những điểm một CMS framework cần có:

- visual data-model builder hoặc content-type builder;
- instant REST/GraphQL APIs;
- content versions/history và live preview;
- event-driven flows/automation;
- app/API/hybrid extensions;
- audit log, i18n, role/permission và marketplace.

Bài học: code-first là lợi thế cho developer, nhưng cần **schema explorer,
diagnostics và generated UI đủ rõ** để khách hàng/agency vận hành mà không đọc
TypeScript.

## 5. Code status matrix

`IMPLEMENTED` nghĩa là source code và public contract của CMS Platform v1 đã có
trong repository. Verification outcome không được ghi vào bảng này.

| Capability                        | Code status | Implementation hiện có                                                               |
| --------------------------------- | ----------- | ------------------------------------------------------------------------------------ |
| Cài vào app TanStack Start có sẵn | IMPLEMENTED | add/remove/diagnose CLI, generated config, migration và rollback-safe host ownership |
| Local development                 | IMPLEMENTED | local provider chạy không cần SaaS/Sanity credential                                 |
| Field catalog                     | IMPLEMENTED | Field v2 gồm nested/group/tabs và scalar/virtual/relationship catalog                |
| Generated admin                   | IMPLEMENTED | bulk, saved views, columns, tree, dashboard và extension slots                       |
| Visual editor                     | IMPLEMENTED | secure preview v2, inline text, patterns, clipboard và shared outline                |
| Reusable content                  | IMPLEMENTED | synced/pinned refs, override, detach và usage graph                                  |
| Layout governance                 | IMPLEMENTED | role/instance capability, pin, min/max, slot và total-node constraints               |
| Editorial collaboration           | IMPLEMENTED | scoped workflow, assignee, due date, checklist, comments và mentions                 |
| Multi-document releases           | IMPLEMENTED | preview, validation, schedule, conflict detection và atomic/compensating outcome     |
| Durable jobs                      | IMPLEMENTED | task/workflow/queue, retry, idempotency, cancellation, dead-letter và monitoring     |
| Generic events/webhooks           | IMPLEMENTED | transactional outbox, signature, retry/dedup/replay và delivery log                  |
| Media/DAM                         | IMPLEMENTED | folders/tags, focal/variants, dedup, private asset, trash, retention và replace      |
| Content hierarchy/taxonomy        | IMPLEMENTED | nested-doc/taxonomy module, tree, breadcrumbs và reorder contracts                   |
| Search                            | IMPLEMENTED | official search module, index/reindex, filters và public/Admin surfaces              |
| SEO                               | IMPLEMENTED | official SEO/sitemap/schema.org/social preview và redirects modules                  |
| Forms/leads                       | IMPLEMENTED | schema form module, validation, rate limit, consent, notification và export          |
| API ecosystem                     | IMPLEMENTED | typed server SDK, bounded REST/OpenAPI, webhooks và scoped API keys                  |
| Authentication                    | IMPLEMENTED | invite, verify/reset, MFA, sessions, recovery và API-key lifecycle                   |
| Database/storage providers        | IMPLEMENTED | local SQLite/libSQL, Cloudflare D1/R2 và PostgreSQL/S3-compatible adapters           |
| Admin UI localization             | IMPLEMENTED | complete `vi`/`en` platform packs với template overrides                             |
| Import/migration UX               | IMPLEMENTED | CSV/JSON/WordPress mapping, dry-run, progress/report và rollback contracts           |
| Trash/retention                   | IMPLEMENTED | soft delete, restore, purge, retention và legal-hold precedence                      |
| Extension SDK                     | IMPLEMENTED | signed manifest, capability, lifecycle, migration, compatibility và catalog          |
| Plugin ecosystem                  | IMPLEMENTED | official module catalog, provenance/SBOM và security/deprecation policy              |
| Multisite/agency operations       | IMPLEMENTED | isolated-stack fleet inventory, drift, health, backup/upgrade/handover plans         |
| Observability                     | IMPLEMENTED | audit, metrics, health, redaction và job/webhook traces                              |
| Accessibility                     | IMPLEMENTED | shared accessible primitives, keyboard paths và screen-reader semantics              |
| Privacy/compliance                | IMPLEMENTED | PII, consent, export/erase, retention/legal hold và redacted audit module            |
| Realtime collaboration            | IMPLEMENTED | presence, soft locks, comments, merge/diff, activity và transport adapter            |

## 6. Product goals theo độ ưu tiên

### P0 — Biến kernel thành plugin thực sự dùng được

#### CMS-P0-01 — One-command integration cho app TanStack Start hiện hữu

Tạo command dạng:

```bash
bunx agency-cms add --framework=tanstack-start --provider=cloudflare
```

Command phải:

- inspect repo trước khi ghi;
- tạo config/route/admin mount/migration/env example tối thiểu;
- không overwrite code người dùng;
- có `--dry-run`, idempotency, receipt và `remove --dry-run`;
- không bắt cài Sanity Studio hoặc biến môi trường `SANITY_*`;
- cung cấp diagnostics khi router, auth, DB binding hoặc migration thiếu.

#### CMS-P0-02 — Provider isolation tuyệt đối

- Core mặc định chạy với local/reference provider mà không cần SaaS.
- Sanity chỉ tồn tại dưới optional package/feature, không được khởi động bởi
  `bun run dev`, không được nằm trong default app dependency graph.
- Provider manifest phải công bố capability thật: schedule, media, webhook,
  release, localization, transaction, search.
- Unsupported capability phải fail closed và admin phải ẩn/giải thích action.

#### CMS-P0-03 — Một visual editor contract cho mọi content type

- Migrate homepage, standard page, post và generic collection blocks sang secure
  preview v2.
- Dùng chung selection, outline, field focus, insert/move/duplicate/delete,
  undo/redo, copy/paste, autosave, conflict recovery và responsive profiles.
- Bổ sung inline text editing khi component cho phép.
- Có component patterns/presets và empty-state tốt.
- Permission/constraint phải hiển thị đúng nhưng server vẫn là authority.

Code hiện tại đã có shared pattern registry, permissioned inline text,
structured clipboard, nested visual outline và adapter cho homepage, standard
page, post, generic collection, Rèm Việt và Atelier. Lịch sử implementation chi
tiết nằm tại
[`perfect-cms-plugin-completion-audit.md`](./perfect-cms-plugin-completion-audit.md).

Implementation invariants:

- secure preview protocol reject forged origin/session/site/document/version/replay;
- mọi authoring action có keyboard path và permission fail closed;
- mọi rendered editable surface map tới đúng mounted control;
- Rèm và Atelier dùng cùng packaged editor shell, không copy route-level algorithm.

#### CMS-P0-04 — Auth và operator onboarding hoàn chỉnh

- invite user, accept invite, verify email, forgot/reset password;
- MFA/TOTP hoặc WebAuthn cho Owner/Admin;
- session/device list và revoke;
- service account/API key có scope, expiry, rotation và audit;
- rate limit, lockout và recovery codes;
- permission matrix nhìn được trong admin.

Implementation invariants:

- revoked/expired/replayed token luôn bị reject;
- secrets không xuất hiện trong client bundle/log/audit export;
- Owner không thể tự xóa admin cuối cùng;
- capability checks giống nhau trên Admin, REST và server SDK.

#### CMS-P0-05 — Durable jobs + event outbox

Xây provider-neutral contracts cho:

- typed task, multi-step workflow và named queue;
- schedule/waitUntil, retry với backoff, timeout và idempotency key;
- concurrency limit, cancellation, dead-letter và retention;
- transactional outbox cho content events;
- signed outbound webhook, retry/dedup, replay thủ công và delivery log;
- Cloudflare implementation bằng Workflows/Queues/Cron phù hợp capability.

Implementation invariants:

- publish + enqueue/outbox atomic;
- crash giữa các step có thể resume mà không duplicate side effect;
- poison job vào dead-letter sau policy;
- webhook signature, rotation, replay protection và SSRF allowlist là shared contracts;
- admin xem được trạng thái, lỗi đã redact và retry action có quyền.

### P1 — Đạt product parity thực dụng với Payload/Storyblok

#### CMS-P1-01 — Field system v2

Bổ sung:

- array, group/object, tabs, collapsible/row UI;
- email, URL, slug, code, JSON, color, geo point;
- computed/virtual/join field;
- polymorphic relationship;
- field-level hooks/access/validation async;
- reusable field groups và schema composition;
- generated TypeScript types + JSON Schema/OpenAPI artifacts.

Mọi field phải có parser, migration, accessible generated admin control, REST
serialization, localization semantics và import/export contract.

#### CMS-P1-02 — Admin platform v2

- bulk edit/publish/archive/delete;
- saved filters/views, configurable columns, sorting và pagination state;
- nested-doc tree, taxonomy manager và breadcrumbs;
- customizable dashboard widgets;
- extension slots cho list/edit/document/root views;
- command palette, global search và recent documents;
- complete UI locale packs, bắt đầu bằng `vi` và `en`;
- mobile admin phải dùng được, không chỉ “không overflow”.

#### CMS-P1-03 — Workflow và Content Releases

- workflow stages cấu hình được theo collection/folder/locale;
- assignee/role, due date, comment, mention và notification;
- review checklist/validation gate;
- release chứa nhiều document/global/locale;
- release preview và conflict/outdated detection;
- atomic publish hoặc compensating rollback có receipt;
- calendar cho scheduled content/releases.

#### CMS-P1-04 — DAM v2

- folders, tags, saved filters, bulk metadata;
- image crop, focal point, resize/format variants;
- content hash duplicate detection;
- private/public asset policy và signed delivery;
- asset trash/restore/retention;
- custom/localized metadata, copyright/license/expiry;
- usage graph và global replace;
- async processing qua jobs, không block upload request;
- storage/transform adapters cho R2 và ít nhất một external CDN contract, có thể
  chạy bằng mock/free/self-hosted implementation.

#### CMS-P1-05 — Official feature modules

Phát hành dưới dạng optional packages độc lập:

1. SEO + sitemap + schema.org + social/SERP preview;
2. redirects với loop detection/import/export;
3. search + reindex jobs;
4. form builder + leads + spam/rate-limit/consent;
5. nested docs/taxonomy;
6. import/export CSV/JSON/WordPress;
7. Sentry/OpenTelemetry adapter;
8. Cloudflare cache invalidation/webhook module.

Mỗi module phải có manifest, permissions, migrations, admin contributions,
compatibility range, public install/remove contract và uninstall data policy.

#### CMS-P1-06 — Provider matrix thực dụng

Tối thiểu:

- local SQLite/libSQL provider cho development và isolated execution;
- Cloudflare D1/R2 provider làm edge-native reference;
- Postgres + S3-compatible provider cho khách không dùng Cloudflare.

GraphQL là optional adapter, không cần làm core dependency. Tuy nhiên phải có
OpenAPI hoặc generated typed HTTP client để REST không thua về DX.

### P2 — Agency scale và ecosystem

#### CMS-P2-01 — Agency control plane

- liệt kê site/stage/version/provider/health từ receipt đã ký;
- phát hiện version drift và migration pending;
- trigger plan/backup/upgrade theo từng site, không auto mutate production;
- tập trung audit/alerts nhưng không gom content/secret khách hàng vào một DB;
- handover/export/rotate owner có checklist.

Giữ mô hình **isolated stack per client** làm mặc định. Shared-database
multi-tenancy chỉ là optional provider/plugin, không được làm yếu isolation.

#### CMS-P2-02 — Extension SDK công khai

- versioned extension manifest;
- declared capabilities/permissions/secrets/routes/admin slots;
- lifecycle install/enable/disable/uninstall;
- migration và rollback contract;
- compatibility checker;
- sandbox/boundary rules cho client code;
- signed package provenance/SBOM/security policy;
- official registry/catalog contract trước, marketplace cộng đồng sau.

#### CMS-P2-03 — Collaboration

- presence và đang-edit field/document;
- inline comments/mentions;
- soft locks hoặc conflict-aware merge;
- visual diff theo field/block;
- activity feed có filter;
- realtime transport là adapter, core vẫn deterministic và offline-runnable.

#### CMS-P2-04 — Privacy/compliance module

- PII field classification;
- consent records;
- user data export/erase;
- retention/legal hold;
- audit export đã redact;
- asset license expiry;
- policy templates cho client handover.

### P3 — Không chặn v1 nhưng tạo lợi thế sau này

- AI assist qua adapter: rewrite, translate, alt text, semantic search;
- personalization/experiments;
- content federation từ external APIs;
- MCP tools với permission giống server SDK;
- analytics widgets;
- shared asset library giữa nhiều isolated site;
- native mobile editorial companion;
- ecommerce module riêng chỉ khi discovery xác nhận nhu cầu vận hành.

AI không được ghi/publish trực tiếp nếu không qua validation, permission, review,
audit và exact-version conflict check.

## 7. Những thứ không nên làm ngay

1. Không clone toàn bộ WordPress hoặc theo đuổi số lượng plugin.
2. Không đưa arbitrary runtime code do editor upload vào production.
3. Không lưu Puck/Craft/Sanity state làm canonical database contract.
4. Không làm shared multi-tenant SaaS trước khi isolated agency model có nhiều
   site độc lập và vận hành ổn định.
5. Không làm GraphQL chỉ để tick checkbox nếu typed REST/OpenAPI đủ tốt cho use
   case thực tế.
6. Không đưa commerce, CRM, email marketing và analytics vào core.
7. Không bắt project mặc định cài hoặc cấu hình Sanity. Sanity chỉ là optional
   provider/benchmark; self-hosted core phải hoạt động độc lập.
8. Không tuyên bố “Payload/WordPress parity” khi source code còn thiếu product
   slice hoặc public contract tương ứng.

## 8. Roadmap đề xuất cho một Senior Freelancer

Roadmap này chỉ liệt kê code slice. Exit gate, timing, KPI và acceptance của từng
phase nằm trong verification index tách biệt.

### Phase A — Plugin installability (2–3 tuần)

- CMS-P0-01, CMS-P0-02;
- clean TanStack fixture và existing-app fixture;
- local provider/dev command;
- diagnostics và public-bundle boundary.

### Phase B — Unified editor + auth (3–4 tuần)

- CMS-P0-03, CMS-P0-04;
- migrate page/post preview v2;
- editor shell dùng chung Rèm + Atelier;
- invite/reset/MFA/session/API key.

### Phase C — Jobs/events/releases (3–4 tuần)

- CMS-P0-05;
- generic webhook/outbox;
- configurable workflow cơ bản;
- multi-document release MVP.

### Phase D — Admin/DAM/modules (4–6 tuần)

- field system v2;
- admin bulk/saved views/tree;
- DAM v2;
- SEO/search/redirect/form official modules.

### Phase E — Provider + agency scale (4–6 tuần)

- Postgres/S3 provider;
- extension SDK;
- agency fleet read-only dashboard;
- handover/export/upgrade orchestration.

Tổng thời gian hợp lý để đạt **client-ready mạnh**: 8–12 tuần.  
Để đạt **framework cạnh tranh rộng với Payload**: 16–24 tuần và tiếp tục duy trì
ecosystem sau đó. “Hoàn hảo” không phải milestone một lần; nó là compatibility,
security, migration và support discipline lâu dài.

## 9. Code completion checklist cho CMS Platform v1

- [x] Cài bằng packed package vào hai repo TanStack Start độc lập, trong đó một
      repo đã có auth/routes/styles.
- [x] Core chạy hoàn toàn không có Sanity dependency/configuration.
- [x] Homepage, page, post và generic collection dùng secure preview v2.
- [x] Rèm và Atelier dùng chung editor shell đã package hóa.
- [x] Local + Cloudflare + Postgres provider implement cùng required contract.
- [x] Durable jobs/outbox/webhook implement crash recovery, retry,
      idempotency và dead-letter lifecycle.
- [x] Release nhiều document có preview, validation, schedule và atomic outcome.
- [x] Field v2 và generated controls có parser, migration, accessible UI và API.
- [x] DAM có folder/tag/focal/variant/trash/usage/replace.
- [x] SEO/search/redirect/form modules cài và gỡ độc lập.
- [x] Auth có invite/reset/MFA/session revoke/API key rotation.
- [x] Import/export/backup/restore/upgrade/rollback có CLI và public contracts.
- [x] Security boundaries implement CSRF/XSS/SSRF protection, preview
      origin/session/replay validation, upload magic-byte checks, rate limits và
      secret isolation.

Checklist này là boundary hoàn thành của goal code-only. Test execution,
staging, final E2E, human acceptance và release receipts không nằm trong Section
9; chúng được theo dõi độc lập trong verification index.

## 10. Nguồn nghiên cứu chính thức

### WordPress

- [Plugin Handbook](https://developer.wordpress.org/plugins/)
- [Hooks](https://developer.wordpress.org/plugins/hooks/)
- [Block API](https://developer.wordpress.org/block-editor/reference-guides/block-api/)
- [Block Locking API](https://developer.wordpress.org/block-editor/how-to-guides/curating-the-editor-experience/block-locking/)
- [Block Templates](https://developer.wordpress.org/block-editor/reference-guides/block-api/block-templates/)
- [REST API Handbook](https://developer.wordpress.org/rest-api/)
- [Roles and Capabilities](https://wordpress.org/documentation/article/roles-and-capabilities/)
- [Media Library](https://wordpress.org/documentation/article/media-library-screen/)
- [Multisite](https://developer.wordpress.org/advanced-administration/multisite/create-network/)
- [Official Plugin Directory](https://wordpress.org/plugins/)

### Payload CMS

- [Fields](https://payloadcms.com/docs/fields/overview)
- [Admin Panel](https://payloadcms.com/docs/admin/overview)
- [Access Control](https://payloadcms.com/docs/access-control/overview)
- [Authentication](https://payloadcms.com/docs/authentication/overview)
- [Versions](https://payloadcms.com/docs/versions/overview)
- [Drafts](https://payloadcms.com/docs/versions/drafts)
- [Live Preview](https://payloadcms.com/docs/live-preview)
- [Jobs Queue](https://payloadcms.com/docs/jobs-queue/overview)
- [Uploads](https://payloadcms.com/docs/upload/overview)
- [Database Adapters](https://payloadcms.com/docs/database/overview)
- [REST API](https://payloadcms.com/docs/rest-api/overview)
- [GraphQL](https://payloadcms.com/docs/graphql/overview)
- [Plugins](https://payloadcms.com/docs/plugins/overview)
- [Multi-Tenant Plugin](https://payloadcms.com/docs/plugins/multi-tenant)

### Visual editing, workflow và DAM

- [Sanity Visual Editing](https://www.sanity.io/docs/visual-editing/introduction-to-visual-editing)
- [Sanity Content Releases](https://www.sanity.io/docs/studio/content-releases)
- [Sanity Media Library](https://www.sanity.io/docs/media-library/introduction)
- [Storyblok Visual Editor](https://www.storyblok.com/docs/concepts/visual-editor)
- [Storyblok Workflows](https://www.storyblok.com/docs/manuals/workflows)
- [Storyblok Releases](https://www.storyblok.com/docs/api/management/releases)
- [Storyblok Assets](https://www.storyblok.com/docs/manuals/assets)
- [Storyblok Internationalization](https://www.storyblok.com/docs/concepts/internationalization)
- [Directus Content Versioning](https://docs.directus.io/guides/headless-cms/content-versioning)
- [Directus Flows](https://docs.directus.io/app/flows)
- [Directus Extensions](https://docs.directus.io/extensions/introduction)
- [Strapi 5 Documentation](https://docs.strapi.io/)
- [Puck editor API](https://puckeditor.com/docs/api-reference/components/puck)
- [Puck permissions](https://puckeditor.com/docs/api-reference/permissions)
- [Puck plugins](https://puckeditor.com/docs/extending-puck/plugins)

## 11. Quyết định sản phẩm cuối cùng

Không thay CMS hiện tại bằng Payload, WordPress hay Sanity. Tiếp tục giữ kernel
provider-neutral và canonical schema của mình, nhưng thay đổi tiêu chuẩn thành
**installable product**, không phải “monorepo đã có nhiều feature”.

Thứ tự đúng là:

1. cài được vào app khác;
2. chạy được không cần Sanity;
3. editor thống nhất và khách hàng dùng được;
4. jobs/events/releases đáng tin cậy;
5. DAM/admin/modules đủ rộng;
6. provider/extension ecosystem;
7. code path handover và upgrade cho repo/site độc lập.

Nếu source code chưa vượt qua một bước thì không được dùng số lượng package
hoặc độ phức tạp kiến trúc để thay thế product slice và public contract tương
ứng.
