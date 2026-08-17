# Staging pilot script

Pilot phải do người không viết code thực hiện; agency chỉ quan sát và ghi thời
gian/lỗi, không hướng dẫn ngoài manual. Trước khi bắt đầu, mở `/api/health` và
copy chính xác `deployment.commit` + `deployment.inputSha256` vào
`pilot.deployment`. Chỉ chạy khi `deployment.sourceState` là `clean`, site/stage
đúng và origin chính xác. Không dùng SHA của working tree nếu staging chưa deploy
commit đó.

- [ ] Đăng nhập và xác định đúng vai trò.
- [ ] Sửa Hero, thay ảnh có alt, thêm FAQ, reorder gallery.
- [ ] Xem draft desktop/mobile; xác nhận public chưa đổi.
- [ ] Publish và thấy public đổi; restore revision rồi publish lại.
- [ ] Tạo standard page bằng blocks, đổi slug và tạo redirect.
- [ ] Tạo bài rich text có heading/list/link/image/video.
- [ ] Gửi form `/lien-he`, xử lý lead, note và export CSV.
- [ ] Thử xóa media đang dùng và thấy bị chặn.
- [ ] Hoàn thành trong 30 phút, không mở JSON/code.

Pass khi không cần developer can thiệp và không có P0/P1. Observer ghi thời gian
từng bước, browser/device, confusion points và issue ids; tester là người tự xác
nhận kết quả sau khi hoàn thành.

## Workspace hỗ trợ trong CMS

Owner/Admin có `audit.read` có thể mở `/admin/handover`. Workspace này đọc trực
tiếp deployment provenance, chỉ cho bắt đầu khi runtime là `staging`, source
`clean`, full Git SHA và deploy-input SHA-256 đều có mặt. Tám bước có timer độc
lập; một timer đang chạy được lưu trong session storage theo user nên vẫn tiếp
tục khi tester mở canvas, preview, page, post, lead hoặc media rồi quay lại nhưng
không tồn tại sang browser session hoặc admin khác. Observer có thể ghi confusion
point, issue ID, browser/device và KPI thực tế ngay trong cùng màn hình.

Nút export chỉ tạo draft cùng shape với template và cố ý để trống
`testerApproval.approvedAt` cùng `recordedAt`. Đây là worksheet giúp giảm lỗi ghi
chép, không phải receipt và không được dùng để tự xác nhận pilot. Tester vẫn phải
xác nhận sau khi hoàn tất, observer điền hai timestamp theo thứ tự thật và chạy
verifier bên dưới trên đúng clean deployment. Nếu provenance đổi hoặc runtime
không còn là staging, workspace khóa hành động/export thay vì dựa vào state cũ.

## Ghi và kiểm tra evidence

1. Copy `docs/releases/pilot-evidence.template.json` thành một record mới và chỉ
   điền kết quả thật. Tổng `taskMinutes` phải khớp `durationMinutes` trong sai số
   một phút; `recordedAt` phải sau xác nhận của tester.
2. Không đưa nội dung form, email, số điện thoại hoặc payload cá nhân vào
   `confusionPoints`/`issueIds`.
3. Chạy verifier với đúng SHA đã deploy:

```bash
bun run release:pilot:verify \
  --evidence=docs/releases/pilot-evidence.json \
  --site=rem-viet \
  --origin=https://rem-viet-web-staging.terasumi.workers.dev \
  --commit=<full-deployed-git-sha>
```

Command tự đọc live `/api/health` và fail closed nếu thiếu task, vượt KPI, cần
developer can thiệp, timestamp không nhất quán, tester approval không đúng người,
origin/site/stage sai, commit không tồn tại/không khớp, source dirty hoặc
deploy-input hash khác record. Tool không tự tick task và không tự ký thay tester.

Sau khi pass, copy đúng `releaseEvidence.pilot` và
`releaseEvidence.approvals.pilotTester` vào bản release cuối. Giữ record gốc
cùng release artifacts. Tag chỉ được tạo sau khi `bun run release:verify` pass
trên chính clean commit phát hành.
