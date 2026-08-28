# Deferred paid upgrades and commercial evidence

> Ngày lập index: 2026-08-29  
> Trạng thái: Deferred backlog — không phải completion gate của
> `perfect-cms-plugin-goal.vi.md`

## 1. Mục đích

Tài liệu này giữ riêng những hạng mục chỉ có thể hoàn thành sau khi mua gói
dịch vụ, kích hoạt entitlement thương mại hoặc có engagement trả phí thật.
Chúng không được dùng để chặn việc tiếp tục implement và verify CMS core bằng
local, self-hosted, free-tier, fixture và các repository độc lập.

Việc defer không cho phép tuyên bố đã có commercial adoption, managed-provider
readiness hoặc paid production support. Các claim đó chỉ được mở lại khi receipt
thật bên dưới tồn tại.

## 2. Index

| ID       | Hạng mục defer                                                            | Lý do cần chi phí/sự kiện thương mại                                                                                                     | Điều kiện mở lại                                          | Evidence bắt buộc khi mở lại                                                                                                |
| -------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| PAID-001 | Cloudflare Pro cho standalone Health Checks và Health Check notifications | Zone hiện tại dùng Free plan; Cloudflare giới hạn standalone Health Checks/alerts cho Pro trở lên                                        | Owner chủ động duyệt chi phí nâng cấp zone                | Entitlement active, health check `/api/health`, enabled email policy, controlled state transition và inbox dispatch receipt |
| PAID-002 | Managed private package registry                                          | Packed tarball và independent-repo install đủ cho technical portability; managed private publication cần account/namespace/billing riêng | Chọn registry, namespace và subscription do agency sở hữu | Hai coordinated publication receipts, immutable package digests, restricted access và reinstall từ registry                 |
| PAID-003 | Paid-site adoption và commercial handover                                 | Không thể tạo paid engagement, support agreement hoặc client approval từ code/test                                                       | Có ít nhất một hợp đồng khách hàng thật                   | Paid-engagement fingerprint, signed handover, deployed origin và client-owner approval                                      |
| PAID-004 | Hai paid consumers nhận cùng một core fix qua upgrade                     | Đây là commercial adoption proof, không phải implementation proof                                                                        | Có hai paid sites trên cùng released core                 | Hai repository/site fingerprints độc lập, N→N+1 upgrade receipts và bằng chứng không copy patch                             |
| PAID-005 | Managed external CDN/transform activation                                 | Adapter contract có thể test bằng mock/free/self-hosted provider; paid vendor activation cần billing/credential thật                     | Chọn vendor sau khi nhu cầu production được duyệt         | Provider configuration receipt, transform/delivery conformance, cost/retention review và rollback/disable proof             |
| PAID-006 | Ecommerce module theo nhu cầu thương mại                                  | Product scope chỉ nên mở khi có nhu cầu vận hành được xác nhận; không phải core CMS gate                                                 | Có discovery và budget riêng                              | Approved scope, data/payment boundary review và module-specific acceptance plan                                             |

Cloudflare entitlement tham chiếu:

- [Health Checks availability](https://developers.cloudflare.com/health-checks/)
- [Health Checks notifications](https://developers.cloudflare.com/health-checks/how-to/health-checks-notifications/)

## 3. Những gì vẫn thuộc active goal

Các hạng mục sau không cần paid upgrade nên vẫn là completion gate:

- toàn bộ implementation, security, migration và conformance của CMS core;
- packed install/remove trong các repo TanStack Start độc lập;
- Local, Cloudflare free-tier/reference và Postgres conformance;
- scheduled backup receipt khi workflow thật chạy;
- representative RUM đủ sample;
- non-developer pilot và independent documentation walkthrough;
- provider-neutral alerts/health contracts và local/hosted evidence nào thực
  hiện được không cần entitlement trả phí;
- registry/extension manifest, provenance, compatibility và lifecycle ở cấp
  implementation, không yêu cầu managed private-registry publication.

## 4. Quy tắc quay lại

1. Không tự mua hoặc nâng gói dịch vụ từ active goal.
2. Mỗi hạng mục chỉ quay lại sau khi owner duyệt rõ vendor, phạm vi và chi phí.
3. Receipt phải là dữ liệu thật; không dùng fixture hoặc unit test thay cho
   dispatch, publication, contract hay client approval.
4. Khi một hạng mục được mở lại, thêm nó vào release/commercial-readiness gate
   phù hợp; không âm thầm đưa ngược vào technical Definition of Done.

## 5. Ranh giới với verifier hiện có

- `bun run cms:kit:v1:verify` vẫn giữ nguyên contract registry + paid-adoption
  để dùng cho commercial release sau này; expected failure của command này không
  chặn active technical goal.
- `bun run release:readiness` vẫn là client-ready operations gate. Các sub-gate
  không cần chi phí như scheduled backup và RUM vẫn có giá trị; riêng dispatch
  cần paid entitlement được theo dõi tại PAID-001.
- Không xóa schema, test hoặc verifier commercial hiện có. Việc defer chỉ thay
  đổi phạm vi completion hiện tại, không làm mất khả năng mở lại bằng receipt
  thật sau này.
