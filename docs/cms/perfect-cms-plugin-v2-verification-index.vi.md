# INDEX — Verification hậu kỳ cho CMS Goal V2

> Ngày tạo: 2026-09-01  
> Trạng thái: Downstream backlog — không block code goal  
> Code goal: [`perfect-cms-plugin-goal-v2.vi.md`](./perfect-cms-plugin-goal-v2.vi.md)

## 1. Ranh giới

Document này chứa toàn bộ testing, browser verification, human verification,
measurement và release work của V2. Các checkbox ở đây được chạy **sau khi code
scope freeze** và không được dùng để block:

- `/goal resume`;
- implementation/commit/merge của code V2;
- trạng thái hoàn thành code-only goal;
- công việc không cần paid entitlement.

## 2. Automated route/layout verification

- [ ] Navigate liên tục giữa dashboard, inventory, posts, homepage, media và
      performance bằng browser E2E; document không reload.
- [ ] `AdminShell`, sidebar, header và command center mount đúng một lần trong
      một Admin navigation session.
- [ ] Sidebar collapsed state, open group, scroll và command state không reset
      khi đổi child route.
- [ ] Back/forward, deep link, query/search params và pending/error boundary đúng.
- [ ] Standalone preview không render Admin chrome.
- [ ] Không có internal raw anchor ngoài allowlist download/external/preview.

## 3. Homepage authoring verification

- [ ] Đổi hero text bằng click-to-edit trên canvas.
- [ ] Đổi ảnh bằng canvas quick action + DAM picker.
- [ ] Insert, move, duplicate, hide và delete block trên canvas/outline đồng bộ.
- [ ] Undo/redo giữ selection và preview đúng.
- [ ] Desktop/tablet/mobile controls ghi đúng scoped variant.
- [ ] SEO, revisions và workflow không xuất hiện trong default canvas hierarchy.
- [ ] Autosave/conflict/reconnect/replay không mất draft hoặc selection.
- [ ] Keyboard-only path và axe scan cho canvas, outline, inspector, dialogs.

## 4. Post authoring verification

- [ ] Viết title, paragraph, heading, list, quote, link và inline format liên tục.
- [ ] Markdown shortcuts và paste/import/export round-trip supported schema.
- [ ] Upload/chọn/thay ảnh giữ cursor; alt/caption/usage metadata đúng.
- [ ] Slash command insert đúng block và tôn trọng permission/template constraint.
- [ ] Preview split view mở/đóng không mất selection hoặc scroll.
- [ ] SEO, schedule, review, publish và revisions disclose đúng intent.
- [ ] Legacy document render/edit/migrate không mất dữ liệu.
- [ ] Arbitrary HTML/JSX/script payload bị reject hoặc normalize an toàn.
- [ ] Keyboard-only path và axe scan cho editor, toolbar, slash menu, media sheet.

## 5. Visual hierarchy regression

- [ ] Sinh UI map trước/sau cho Admin shell, homepage và post editor.
- [ ] Browser screenshot desktop/tablet/mobile cho từng task archetype.
- [ ] Kiểm tra primary action, reading order, focus order và sticky layers.
- [ ] Kiểm tra overflow, zoom 200%, long Vietnamese strings và empty/error states.
- [ ] Dark/light theme giữ contrast và semantic hierarchy.
- [ ] Visual regression chỉ fail trên thay đổi đã review, không snapshot noise.

## 6. Human usability pilot

Chạy với người không tham gia implementation và không hướng dẫn ngoài prompt:

- [ ] Đổi hero title và ảnh, xem tablet, lưu/publish.
- [ ] Tạo bài viết có heading/list/link/ảnh, đặt SEO, schedule và preview.
- [ ] Khôi phục một revision homepage và một revision post.
- [ ] Tester giải thích được draft/published/scheduled state bằng UI đang thấy.
- [ ] Ghi task completion time, misclick, backtrack, help request và điểm mơ hồ.
- [ ] Không cần mở JSON, DevTools hoặc nhờ developer tìm field.

Mục tiêu đo sau cùng, không phải code blocker:

- task phổ biến đầu tiên hoàn thành không cần training;
- đổi text/ảnh homepage trong tối đa 3 interaction chính;
- bắt đầu viết body post trong tối đa 10 giây sau khi route ready;
- zero accidental publish/destructive action;
- zero full page reload trong Admin SPA navigation.

## 7. Performance và release verification

- [ ] Đo route transition, editor input latency, preview sync và bundle delta.
- [ ] Không load editor engine ở Admin route không cần authoring.
- [ ] Production build, typecheck, unit/integration/E2E và security suite pass trên
      exact clean commit.
- [ ] Deploy staging exact commit; database/source state clean.
- [ ] Smoke homepage/post draft-preview-publish-restore trên staging.
- [ ] Human acceptance receipt và release receipt trỏ đúng commit/site/origin.

## 8. Rule để close verification backlog

Chỉ close document này khi automated, browser, human và release sections có
evidence cho exact candidate commit. Việc document này còn checkbox mở không làm
code goal V2 bị blocked hoặc ngăn `/goal resume` trong giai đoạn implementation.
