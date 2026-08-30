# INDEX — Verification hậu kỳ cho Perfect CMS Plugin

> Ngày tách khỏi code goal: 2026-08-30
> Trạng thái: deferred verification backlog
> Code goal: [`perfect-cms-plugin-goal.vi.md`](./perfect-cms-plugin-goal.vi.md)
> Nguyên tắc: document này không block `/goal resume`, code implementation,
> commit/merge hoặc completion của code-only goal

## 1. Ranh giới

Document này giữ toàn bộ phần testing, E2E, fixture verification, user
acceptance, human pilot, independent walkthrough, KPI measurement, staging
provenance và external receipt đã được tách khỏi code goal.

Các mục ở đây chỉ chạy sau khi cần đánh giá một implementation-freeze candidate
hoặc chuẩn bị release/client handover. Chúng không phải source-code deliverable
và không được dùng để giữ active code goal ở trạng thái blocked. Một failure ở
đây tạo bug/follow-up code cụ thể; chỉ bug đó mới được đưa lại vào code goal.

Historical pass từ commit cũ không tự động áp dụng cho candidate mới. Khi bắt
đầu một verification cycle mới, bind mọi receipt vào exact clean commit của
cycle đó.

## 2. Document điều phối

| Phạm vi                                           | Document authoritative                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Thứ tự final quality, staging, pilot, walkthrough | [`final-acceptance-plan.md`](./final-acceptance-plan.md)                             |
| Full implementation history                       | [`perfect-cms-plugin-completion-audit.md`](./perfect-cms-plugin-completion-audit.md) |
| Execution ledger chi tiết                         | [`execution-ledger.md`](./execution-ledger.md)                                       |
| Non-developer pilot                               | [`../pilot-handover-script.md`](../pilot-handover-script.md)                         |
| Client handover                                   | [`../client-handover-checklist.md`](../client-handover-checklist.md)                 |
| Independent docs walkthrough                      | [`documentation-walkthrough.md`](./documentation-walkthrough.md)                     |
| Release evidence schemas/commands                 | [`../releases/README.md`](../releases/README.md)                                     |
| Paid/commercial verification                      | [`deferred-paid-upgrades.md`](./deferred-paid-upgrades.md)                           |

## 3. Feature verification index

### CMS-P0-01 — One-command integration

- fixture TanStack Start trắng;
- fixture app đã có auth/routes/styles;
- packed tarball install, dev, build, create draft, preview, publish và uninstall;
- Windows/Linux execution;
- public bundle không chứa admin/editor/provider không được chọn;
- dry-run, repeated add, remove dry-run, remove và rollback không overwrite code
  người dùng.

### CMS-P0-02 — Provider isolation

- clean fixture không có `SANITY_*` vẫn dev/build thành công;
- metafile audit không có `@sanity/*` trong default client/server graph;
- Cloudflare/local/Postgres chạy cùng provider conformance suite;
- unsupported capability fail closed;
- optional Sanity install/remove không đổi canonical content contract.

### CMS-P0-03 — Unified visual editor

- authenticated browser flow cho homepage, page, post và generic collection;
- desktop/mobile responsive authoring;
- forged origin/session/site/document/version/replay bị reject;
- keyboard-only create/edit/reorder/save/preview/recover;
- axe và overflow audit cho generated/custom controls;
- mọi rendered editable surface map đúng mounted control;
- Rèm và Atelier dùng cùng packaged shell, không copy route-level algorithm.

### CMS-P0-04 — Auth và onboarding

- happy path invite/verify/reset/MFA/session/API key;
- revoked/expired/replayed token bị reject;
- secret không xuất hiện trong client bundle, log hoặc audit export;
- Owner không thể xóa admin cuối cùng;
- capability result giống nhau trên Admin, REST và server SDK.

### CMS-P0-05 — Durable jobs và event outbox

- publish + enqueue/outbox atomic;
- crash giữa step resume không duplicate side effect;
- poison job đi vào dead-letter theo policy;
- webhook signature, rotation, replay protection và SSRF allowlist;
- admin status, redacted error và permissioned retry;
- scheduled multi-document campaign publish exactly once và rollback đúng.

### CMS-P1/P2 package surfaces

- mọi Field v2 có parser, migration, generated control, REST serialization,
  localization, import/export và accessibility coverage;
- Admin v2 có desktop/mobile, keyboard, axe, overflow và bulk/tree/search flows;
- Content Release có preview, stale/conflict detection, atomic outcome hoặc
  compensating rollback receipt;
- DAM có R2 và mock/free/self-hosted external transform path, protected delete,
  variant, trash, restore, usage và replace;
- mỗi official module có packed install/remove, compatibility range, migration
  và uninstall data-policy coverage;
- extension lifecycle có install/enable/disable/uninstall, compatibility,
  migration và rollback coverage;
- agency control-plane command không mutate production ngoài explicit apply;
- privacy export/erase/retention/audit output không lộ PII ngoài contract.

## 4. Roadmap exit criteria

Các phase code nằm ở Section 8 của code goal. Verification tương ứng:

1. **Phase A** — clone app bất kỳ, cài CMS, tạo/publish page và gỡ integration
   mà không sửa tay core files.
2. **Phase B** — một editor không biết code hoàn thành 10 tác vụ authoring trên
   desktop/mobile mà không cần developer can thiệp.
3. **Phase C** — scheduled campaign nhiều document publish đúng một lần, có
   audit, retry và rollback result.
4. **Phase D** — hai website độc lập dùng module packages mà không copy source.
5. **Phase E** — ít nhất ba site/fixture khác ngành, hai provider, một upgrade
   N→N+1→rollback và một non-developer pilot có receipt.

## 5. KPI cần đo sau cùng

| KPI                               | Mục tiêu                                                |
| --------------------------------- | ------------------------------------------------------- |
| Add CMS vào app TanStack hiện hữu | ≤ 15 phút, không sửa core thủ công                      |
| Tạo collection mới đầy đủ         | ≤ 20 phút, có schema/admin/API                          |
| Tạo block production-ready        | ≤ 30 phút bằng generator + bounded template edits       |
| Editor onboarding                 | 10 tác vụ chuẩn, ≥ 90% hoàn thành không trợ giúp        |
| Autosave loss                     | 0 dữ liệu mất trong crash/reload scenario               |
| Publish conflict                  | 100% stale writes bị chặn hoặc merge rõ ràng            |
| Preview parity                    | mọi editable component dùng production renderer         |
| Job duplicate side effect         | 0 trong crash/retry/idempotency suite                   |
| Webhook delivery                  | retry + dead-letter + replay có audit đầy đủ            |
| Restore revision                  | ≤ 2 phút trong browser workflow                         |
| Backup restore site               | ≤ 15 phút cho fixture chuẩn                             |
| Provider conformance              | 100% required; capability thiếu fail closed             |
| Accessibility                     | WCAG 2.2 AA, axe 0 serious/critical, keyboard task pass |
| Public bundle isolation           | 0 admin/editor/unused-provider module                   |
| Upgrade                           | N→N+1→rollback không mất canonical content              |

## 6. Final automated verification — chạy sau implementation freeze

- [ ] Chốt exact clean Git commit cho candidate.
- [ ] `bun install --frozen-lockfile` trên isolated clean checkout.
- [ ] `bun run quality` pass toàn bộ package, app, security, migration,
      packed-consumer và clean-checkout matrix.
- [ ] Admin desktop + mobile keyboard/axe/overflow/task E2E pass.
- [ ] Deploy exact candidate lên staging với `sourceState=clean`, matching commit
      và deploy-input SHA-256.
- [ ] Flagship staging smoke pass và cleanup synthetic fixture về zero.
- [ ] Independent second-site staging smoke pass trên resource/provider độc lập.
- [ ] Backup hiện tại restore trong isolated target và provider plan converges
      về noop.

Nếu source code hoặc checked-in documentation đổi sau freeze, tạo candidate mới
và chạy lại Section 6. Việc đó không đổi trạng thái code-only goal; nó chỉ reset
verification cycle này.

## 7. Human verification — chạy sau cùng

### 7.1 Non-developer pilot

- [ ] Người không viết implementation chạy toàn bộ
      [`pilot-handover-script.md`](../pilot-handover-script.md).
- [ ] Không dùng AI/project owner/local automation thay human run.
- [ ] Tổng thời gian ≤ 30 phút; revision restore ≤ 5 phút; zero developer
      intervention; không dùng JSON/code.
- [ ] Tester approve receipt sau khi hoàn tất.
- [ ] `release:pilot:verify` accept exact site/origin/commit receipt.

### 7.2 Independent documentation walkthrough

- [ ] Operator khác project owner dùng fresh clone/isolated clean checkout.
- [ ] Chỉ dùng checked-in docs cho install, schema/template, editor, provider,
      extension, migration/rollback, backup/restore, incident và handover.
- [ ] Zero undocumented developer intervention và zero open P0/P1.
- [ ] Operator approve receipt sau khi hoàn tất.
- [ ] `release:docs:verify` accept exact repository/documentation commit receipt.

Human receipt phải là dữ liệu thật. Nếu chưa có người thực hiện thì giữ Section
7 pending tại document này; không block code goal.

## 8. Release/client-ready verification ngoài code goal

Các mục sau chỉ block tag/release hoặc commercial claim tương ứng, không block
code goal:

- operational alert delivery receipt;
- representative field-performance sample window;
- weekly immutable scheduled-backup receipt sau manual run;
- final release-evidence JSON và agency-owner approval;
- managed registry publication;
- paid provider entitlement/dispatch;
- independent paid-site adoption/upgrade receipts.

Chi tiết paid/commercial nằm tại
[`deferred-paid-upgrades.md`](./deferred-paid-upgrades.md); client-ready schema và
commands nằm tại [`../releases/README.md`](../releases/README.md).

## 9. Rule để resume và close code goal

- `/goal resume` đọc code scope từ
  [`perfect-cms-plugin-goal.vi.md`](./perfect-cms-plugin-goal.vi.md), không đọc
  checkbox pending trong document này như code blocker.
- Code goal complete khi Section 9 của code goal không còn code item mở và
  repository không còn implementation gap thuộc scope đó.
- Verification chạy sau cùng. Nếu tìm ra bug, mở lại đúng bug/code requirement,
  implement fix rồi tạo verification candidate mới.
- Không tự điền human receipt, không đổi pending thành pass chỉ để đóng release.
