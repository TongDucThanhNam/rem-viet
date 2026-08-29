# GOAL — CMS Plugin hoàn chỉnh cho website TanStack Start

> Ngày nghiên cứu: 2026-08-20  
> Trạng thái: Product goal mới, chưa phải tuyên bố hoàn thành  
> Đối tượng: Senior Web Developer/Freelancer xây website bằng TanStack Start + React  
> Phạm vi: CMS code-first, self-hosted, có visual authoring, tái sử dụng được cho nhiều website
> Paid upgrade/commercial evidence: defer riêng tại
> [`deferred-paid-upgrades.md`](./deferred-paid-upgrades.md), không chặn active goal
> Full E2E + human acceptance: chạy sau implementation freeze theo
> [`final-acceptance-plan.md`](./final-acceptance-plan.md), không chặn implementation đang tiếp tục

## 1. Kết luận ngắn

Repository hiện tại **đã có một CMS kernel tốt**, không còn là một CRUD thử nghiệm:

- collection/field schema có type, validation và migration;
- draft, publish, schedule, revision, restore và optimistic conflict;
- quan hệ, localization, quyền theo capability và lifecycle hooks;
- generated admin cơ bản, media trên R2, portable import/export;
- visual-authoring kernel độc lập editor, secure preview v2 và template factory;
- Rèm Việt + Atelier chứng minh hai template có thể dùng chung kernel.

Nhưng sản phẩm vẫn **chưa phải một CMS plugin hoàn chỉnh để cài vào mọi dự án
TanStack Start**. Khoảng trống lớn nhất không nằm ở schema nữa mà nằm ở:

1. trải nghiệm cài đặt và tích hợp vào một app có sẵn;
2. admin/editor đủ hoàn chỉnh để khách hàng không cần developer;
3. durable jobs, outbound events/webhooks và multi-document releases;
4. DAM thực thụ thay vì chỉ là media library tốt;
5. field types, content hierarchy, reusable content và API ecosystem;
6. provider adapters, extension SDK và khả năng nâng cấp dài hạn;
7. bằng chứng sử dụng thực tế từ freelancer, editor không biết code và nhiều
   website độc lập.

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
11. có tài liệu, diagnostics và test kit đủ để một repo độc lập tự chứng minh
    integration đúng;
12. không cần Sanity, Payload hoặc dịch vụ trả phí nào để chạy core product.

### 2.1 Ranh giới implementation, final acceptance và paid upgrade

Definition of Done của goal này chỉ yêu cầu evidence có thể tạo bằng code,
fixture, repository độc lập, local/self-hosted/free-tier và human pilot. Mọi
entitlement hoặc receipt chỉ có sau khi mua dịch vụ đã được loại khỏi active
goal và index tại [`deferred-paid-upgrades.md`](./deferred-paid-upgrades.md).

Việc defer không làm yếu implementation contract tương ứng: health/alert,
extension registry, package provenance, provider adapter và handover vẫn phải
được implement/test ở phạm vi provider-neutral. Chỉ managed-provider dispatch,
publication và commercial receipt được loại khỏi completion gate hiện tại.

Trong lúc implementation còn thay đổi, mỗi thay đổi vẫn phải chạy targeted
unit/integration test, typecheck và build tương xứng với rủi ro. Full browser E2E,
non-developer pilot và independent documentation walkthrough được gom vào final
acceptance sau khi chốt một exact clean commit; xem
[`final-acceptance-plan.md`](./final-acceptance-plan.md). Việc chưa có ba evidence
này không được block `/goal resume` hoặc công việc implementation. Chúng chỉ
được phép block tuyên bố hoàn thành sau khi implementation freeze đã được chốt.

## 3. Baseline đã được chứng minh trong repository

| Năng lực                      | Trạng thái hiện tại      | Bằng chứng chính                                                            |
| ----------------------------- | ------------------------ | --------------------------------------------------------------------------- |
| Collection schema + migration | Mạnh                     | `@agency/cms-core`, contiguous schema migration, registry validation        |
| Field validation dùng chung   | Mạnh nhưng hẹp           | text, number, boolean, date, rich text, media, blocks, select, relationship |
| Draft/publish/version/restore | Mạnh                     | runtime/provider conformance + authenticated E2E                            |
| Localization                  | Mạnh                     | lifecycle độc lập theo locale, fallback có metadata                         |
| Relationship integrity        | Mạnh                     | to-one/to-many, restrict/nullify, atomic provider checks                    |
| Access control                | Mạnh ở capability layer  | server authorization, field/component permission, Better Auth staff roles   |
| Generated admin               | Khá                      | list, filter, create/edit form, field override registry                     |
| Visual authoring              | Khá nhưng chưa đồng nhất | homepage dùng secure v2; page/post còn compatibility protocol               |
| Media                         | Khá                      | upload, metadata/alt, usage, safe delete, R2                                |
| Workflow                      | Khá nhưng cố định        | request review, approve/request changes, publish riêng quyền                |
| API                           | Khá                      | typed server SDK + bounded REST; chưa có GraphQL/realtime SDK               |
| Hooks/extensions              | Mạnh ở code-level        | instance-scoped modules, ordered hooks, transaction safety                  |
| Portability                   | Mạnh ở kernel            | deterministic export/import, dry-run, atomic apply                          |
| Template reuse                | Mạnh ở test              | Rèm Việt + Atelier + packed consumer/upgrade/rollback                       |
| Provider                      | Hẹp                      | Cloudflare là reference provider; Sanity là experimental optional slice     |
| Jobs/queue                    | Thiếu                    | chỉ có scheduled publishing, chưa có durable task/workflow queue            |
| Multi-document releases       | Thiếu                    | chưa group nhiều document vào một release atomic                            |
| Ecosystem                     | Thiếu                    | chưa có extension manifest, compatibility matrix, registry hay marketplace  |
| Agency control plane          | Thiếu                    | mỗi client một stack; chưa có dashboard quản lý nhiều site                  |

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

## 5. Ma trận khoảng trống

Quy ước:

- **PROVEN**: có executable evidence phù hợp với phạm vi claim.
- **PARTIAL**: có nền tảng nhưng thiếu product slice quan trọng.
- **OPEN**: chưa có implementation/evidence đủ mạnh.

| Capability                        | Hiện tại | Chuẩn cạnh tranh                                                                              | Khoảng trống thật                                                                                                           |
| --------------------------------- | -------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Cài vào app TanStack Start có sẵn | OPEN     | một command + generated config + rollback                                                     | CLI hiện thiên về bootstrap site/template, chưa chứng minh add/remove trong app bất kỳ                                      |
| Local development                 | PARTIAL  | chạy không cần SaaS/credential ngoài                                                          | core không cần Sanity nhưng workspace/provider thử nghiệm vẫn dễ làm người dùng hiểu nhầm; cần optional isolation tuyệt đối |
| Field catalog                     | PARTIAL  | nested array/group/tabs, JSON, email, URL, code, slug, color, point, computed/virtual         | core hiện chỉ có 9 nhóm field cơ bản                                                                                        |
| Generated admin                   | PARTIAL  | bulk actions, saved views, configurable columns, tree/hierarchy, custom views/dashboard       | shell hiện chỉ đủ CRUD/filter/form cơ bản                                                                                   |
| Visual editor                     | PARTIAL  | một protocol và UX cho mọi document type, inline edit, outline, patterns, copy/paste          | homepage/page/post chưa dùng cùng secure transport; Atelier chưa có full authenticated editor shell                         |
| Reusable content                  | OPEN     | synced block/global reference, detach/override, usage graph                                   | relationship có thể model nhưng chưa có first-class authoring UX                                                            |
| Layout governance                 | PARTIAL  | content-only mode, lock insert/move/delete/edit/style theo role/instance                      | kernel có permission/constraint nhưng UX và test matrix chưa đầy đủ trên mọi editor                                         |
| Editorial collaboration           | PARTIAL  | configurable stages, assignee, due date, comments, notifications                              | workflow hiện cố định request/decision, chưa có task/comment model                                                          |
| Multi-document releases           | OPEN     | group/preview/validate/schedule/publish atomic                                                | chỉ schedule từng document/locale                                                                                           |
| Durable jobs                      | OPEN     | typed task/workflow, retry/backoff, idempotency, dead-letter, cancellation, monitoring        | scheduled publish không thay thế queue                                                                                      |
| Generic events/webhooks           | OPEN     | signed outbound webhook + durable outbox + retry/dedup/replay UI                              | Sanity inbound webhook là provider-specific, không phải core event product                                                  |
| Media/DAM                         | PARTIAL  | folders/tags, crop/focal, variants, transforms, duplicate detection, private asset, trash     | hiện có upload/alt/usage/safe-delete nhưng chưa phải DAM                                                                    |
| Content hierarchy/taxonomy        | OPEN     | nested docs, tree reorder, breadcrumbs, taxonomy/tag UX                                       | có relationship primitive nhưng không có module hoàn chỉnh                                                                  |
| Search                            | PARTIAL  | full-text index, filters/facets, reindex jobs, admin/public APIs                              | Rèm có search surfaces; chưa thành portable core module                                                                     |
| SEO                               | PARTIAL  | reusable SEO plugin, SERP/social preview, canonical, sitemap, schema.org, redirects           | app có SEO/redirect; chưa đóng gói provider-neutral đầy đủ                                                                  |
| Forms/leads                       | PARTIAL  | schema-driven form builder, validation, spam/rate limit, notification/webhook, consent/export | Rèm có lead flow; chưa thành reusable CMS module                                                                            |
| API ecosystem                     | PARTIAL  | typed local/server SDK, REST, optional GraphQL, webhooks, API keys, generated client          | SDK/REST tốt nhưng query operators còn bounded và chưa có GraphQL/client generation                                         |
| Authentication                    | PARTIAL  | onboarding, reset/verify, MFA, session/device management, API keys, optional OAuth/SSO        | Better Auth có nền tảng nhưng CMS kit chưa chứng minh full operator UX                                                      |
| Database/storage providers        | PARTIAL  | ít nhất local SQLite + Cloudflare D1 + Postgres, provider conformance giống nhau              | mới có Cloudflare reference; Sanity không phải relational provider thay thế                                                 |
| Admin UI localization             | OPEN     | UI strings/theme/date/number/RTL locale packs                                                 | content localization đã tốt nhưng admin copy còn app-owned                                                                  |
| Import/migration UX               | PARTIAL  | CSV/JSON/WP importer, mapping UI, progress/resume/report                                      | kernel portability mạnh nhưng chưa có end-user importer UX                                                                  |
| Trash/retention                   | OPEN     | soft delete, restore, purge policy, legal hold                                                | delete lifecycle chưa phải recycle-bin product                                                                              |
| Extension SDK                     | PARTIAL  | versioned manifest, permissions, hooks, admin slots, migrations, compatibility test kit       | feature module mạnh nhưng chưa có install/discover/compatibility lifecycle                                                  |
| Plugin ecosystem                  | OPEN     | official modules + registry + security/deprecation policy                                     | marketplace không cần ngay nhưng official module catalog là bắt buộc                                                        |
| Multisite/agency operations       | PARTIAL  | fleet dashboard, version drift, backup/health/update orchestration                            | hiện cô lập mỗi client rất tốt nhưng quản lý từng stack riêng                                                               |
| Observability                     | PARTIAL  | audit, metrics, job/webhook traces, alerts, redaction, health                                 | unified tracing và provider-neutral evidence còn thiếu                                                                      |
| Accessibility                     | PARTIAL  | WCAG 2.2 AA cho admin/editor, keyboard DnD, screen-reader announcements                       | đã có axe/keyboard evidence nhưng phải gate mọi generated/custom control                                                    |
| Privacy/compliance                | OPEN     | data export/erase, retention, consent, PII audit, asset license metadata                      | chưa có reusable privacy module                                                                                             |
| Realtime collaboration            | OPEN     | presence, field locking hoặc CRDT, comments, conflict visualization                           | hiện có optimistic conflict/two-tab recovery, chưa phải co-editing                                                          |

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

Acceptance evidence:

1. fixture TanStack Start trắng;
2. fixture app đã có auth/routes/styles;
3. packed tarball install, dev, build, create draft, preview, publish, uninstall;
4. Windows/Linux CI;
5. public bundle không chứa admin/editor/provider không được chọn.

#### CMS-P0-02 — Provider isolation tuyệt đối

- Core mặc định chạy với local/reference provider mà không cần SaaS.
- Sanity chỉ tồn tại dưới optional package/feature, không được khởi động bởi
  `bun run dev`, không được nằm trong default app dependency graph.
- Provider manifest phải công bố capability thật: schedule, media, webhook,
  release, localization, transaction, search.
- Unsupported capability phải fail closed và admin phải ẩn/giải thích action.

Acceptance evidence:

- clean fixture không có một `SANITY_*` nào vẫn dev/build/test thành công;
- metafile audit không có `@sanity/*` trong default client/server graph;
- Cloudflare/local provider chạy cùng một conformance suite;
- optional Sanity install/remove không thay đổi canonical content contract.

#### CMS-P0-03 — Một visual editor contract cho mọi content type

- Migrate homepage, standard page, post và generic collection blocks sang secure
  preview v2.
- Dùng chung selection, outline, field focus, insert/move/duplicate/delete,
  undo/redo, copy/paste, autosave, conflict recovery và responsive profiles.
- Bổ sung inline text editing khi component cho phép.
- Có component patterns/presets và empty-state tốt.
- Permission/constraint phải hiển thị đúng nhưng server vẫn là authority.

Acceptance evidence:

- authenticated E2E cho mỗi document type trên desktop/mobile;
- forged origin/session/site/document/version/replay đều bị reject;
- keyboard-only hoàn thành create/edit/reorder/save/preview/recover;
- every rendered editable surface map tới đúng mounted control;
- Rèm và Atelier dùng cùng editor shell, không copy route-level algorithms.

#### CMS-P0-04 — Auth và operator onboarding hoàn chỉnh

- invite user, accept invite, verify email, forgot/reset password;
- MFA/TOTP hoặc WebAuthn cho Owner/Admin;
- session/device list và revoke;
- service account/API key có scope, expiry, rotation và audit;
- rate limit, lockout và recovery codes;
- permission matrix nhìn được trong admin.

Acceptance evidence:

- E2E cho happy path và revoked/expired/replayed token;
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

Acceptance evidence:

- publish + enqueue/outbox atomic;
- crash giữa các step có thể resume mà không duplicate side effect;
- poison job vào dead-letter sau policy;
- webhook signature, rotation, replay protection và SSRF allowlist có test;
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

Mọi field phải có parser, migration, generated admin control, REST serialization,
localization semantics, import/export và accessibility tests.

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
  verify bằng mock/free/self-hosted provider.

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
compatibility range, packed-consumer test và uninstall data policy.

#### CMS-P1-06 — Provider matrix thực dụng

Tối thiểu:

- local SQLite/libSQL provider cho development và test;
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
- realtime transport là adapter, core vẫn deterministic và offline-testable.

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
8. Không tuyên bố “Payload/WordPress parity” chỉ dựa trên unit tests.

## 8. Roadmap đề xuất cho một Senior Freelancer

### Phase A — Plugin installability (2–3 tuần)

- CMS-P0-01, CMS-P0-02;
- clean TanStack fixture và existing-app fixture;
- local provider/dev command;
- diagnostics và public-bundle audit.

Exit gate: clone app bất kỳ, cài CMS, tạo/publish page và gỡ integration mà không
sửa tay core files.

### Phase B — Unified editor + auth (3–4 tuần)

- CMS-P0-03, CMS-P0-04;
- migrate page/post preview v2;
- editor shell dùng chung Rèm + Atelier;
- invite/reset/MFA/session/API key.

Exit gate: một editor không biết code hoàn thành 10 tác vụ authoring trên desktop
và mobile mà không cần developer cứu.

### Phase C — Jobs/events/releases (3–4 tuần)

- CMS-P0-05;
- generic webhook/outbox;
- configurable workflow cơ bản;
- multi-document release MVP.

Exit gate: scheduled campaign nhiều document publish đúng một lần, có audit,
retry và rollback evidence.

### Phase D — Admin/DAM/modules (4–6 tuần)

- field system v2;
- admin bulk/saved views/tree;
- DAM v2;
- SEO/search/redirect/form official modules.

Exit gate: hai website độc lập dùng module packages mà không copy source.

### Phase E — Provider + agency scale (4–6 tuần)

- Postgres/S3 provider;
- extension SDK;
- agency fleet read-only dashboard;
- pilot/handover/upgrade receipts.

Exit gate: ít nhất ba site/fixture độc lập khác ngành, hai provider, một upgrade
N→N+1→rollback và một non-developer tự chỉnh content trong pilot có receipt.

Tổng thời gian hợp lý để đạt **client-ready mạnh**: 8–12 tuần.  
Để đạt **framework cạnh tranh rộng với Payload**: 16–24 tuần và tiếp tục duy trì
ecosystem sau đó. “Hoàn hảo” không phải milestone một lần; nó là compatibility,
security, migration và support discipline lâu dài.

## 9. KPI sản phẩm

| KPI                               | Mục tiêu                                                |
| --------------------------------- | ------------------------------------------------------- |
| Add CMS vào app TanStack hiện hữu | ≤ 15 phút, không sửa core thủ công                      |
| Tạo collection mới đầy đủ         | ≤ 20 phút, có schema/admin/API/test                     |
| Tạo block production-ready        | ≤ 30 phút bằng generator + template edits rõ ràng       |
| Editor onboarding                 | 10 tác vụ chuẩn, ≥ 90% hoàn thành không trợ giúp        |
| Autosave loss                     | 0 dữ liệu mất trong crash/reload test                   |
| Publish conflict                  | 100% stale writes bị chặn hoặc merge rõ ràng            |
| Preview parity                    | mọi editable component dùng production renderer         |
| Job duplicate side effect         | 0 trong crash/retry/idempotency suite                   |
| Webhook delivery                  | retry + dead-letter + replay có audit đầy đủ            |
| Restore revision                  | ≤ 2 phút trong browser workflow                         |
| Backup restore site               | ≤ 15 phút cho fixture chuẩn                             |
| Provider conformance              | 100% bắt buộc; capability thiếu phải fail closed        |
| Accessibility                     | WCAG 2.2 AA, axe 0 serious/critical, keyboard task pass |
| Public bundle isolation           | 0 admin/editor/unused-provider module                   |
| Upgrade                           | N→N+1→rollback không mất canonical content              |

## 10. Definition of Done cho CMS Platform v1 kế tiếp

Không dùng final acceptance để chặn implementation đang tiếp tục. Chỉ được gọi
là hoàn thành khi cả hai phase dưới đây có đủ bằng chứng trên cùng final
candidate.

### 10.1 Implementation gate

- [ ] Cài bằng packed package vào hai repo TanStack Start độc lập, trong đó một
      repo đã có auth/routes/styles.
- [ ] Core chạy hoàn toàn không có Sanity dependency/configuration.
- [ ] Homepage, page, post và generic collection dùng secure preview v2.
- [ ] Rèm và Atelier dùng chung editor shell đã package hóa.
- [ ] Local + Cloudflare + Postgres provider chạy cùng required conformance.
- [ ] Durable jobs/outbox/webhook có crash/retry/idempotency/dead-letter tests.
- [ ] Release nhiều document có preview, validation, schedule và atomic outcome.
- [ ] Field v2 và generated controls có parser/migration/a11y/API evidence.
- [ ] DAM có folder/tag/focal/variant/trash/usage/replace.
- [ ] SEO/search/redirect/form modules cài và gỡ độc lập.
- [ ] Auth có invite/reset/MFA/session revoke/API key rotation.
- [ ] Import/export/backup/restore/upgrade/rollback đều chạy từ clean checkout.
- [ ] Security review bao gồm CSRF/XSS/SSRF, preview origin/session/replay,
      upload magic bytes, rate limits, secret exposure và dependency audit.

Trong phase này chạy targeted verification cho code vừa đổi. Không yêu cầu full
browser matrix hoặc human receipt sau mỗi increment.

### 10.2 Final E2E và human acceptance — chạy sau implementation freeze

- [ ] Chốt exact clean Git commit, không còn implementation change dự kiến cho
      candidate; mọi evidence bên dưới bind đúng commit này.
- [ ] Chạy lại full quality và Admin desktop + mobile
      keyboard/axe/overflow/task E2E trên final candidate.
- [ ] Deploy chính final candidate lên staging với clean provenance.
- [ ] Một non-developer pilot trên site độc lập có signed handover receipt;
      không dùng local test/AI/project owner để thay human evidence.
- [ ] Tài liệu install, schema, editor, provider, extension, migration,
      backup/restore, incident và handover đã được người khác làm theo thành công;
      dùng receipt contract tại [`documentation-walkthrough.md`](./documentation-walkthrough.md),
      không tự xác nhận thay operator độc lập.

Thứ tự, command và stop condition của phase này nằm tại
[`final-acceptance-plan.md`](./final-acceptance-plan.md). Nếu implementation được
mở lại sau khi test, freeze cũ mất hiệu lực và final acceptance phải chạy lại
trên candidate mới.

## 11. Nguồn nghiên cứu chính thức

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

## 12. Quyết định sản phẩm cuối cùng

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
7. pilot thật và upgrade thật trên repo/site độc lập.

Nếu chưa vượt qua một bước thì không được dùng số lượng package, unit test hoặc
độ phức tạp kiến trúc để thay thế bằng chứng sản phẩm tương ứng.
