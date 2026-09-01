# Inventory task archetype cho Admin V2

Tài liệu này là contract code cho information architecture của Admin. Nguồn
runtime nằm trong `apps/web/src/lib/admin-routes.ts`; `AdminPage` dùng archetype
để chọn content-width mặc định thay vì mỗi route tự đặt geometry.

## Archetype và geometry

| Archetype    | Ý định chính                                 | Width mặc định |
| ------------ | -------------------------------------------- | -------------- |
| `overview`   | đọc tín hiệu, metric và trạng thái tổng quan | `full`         |
| `collection` | tìm, lọc, duyệt và chọn record               | `table`        |
| `editor`     | tạo/sửa một document hoặc entity             | `workspace`    |
| `workflow`   | xử lý hàng đợi và chuyển trạng thái          | `table`        |
| `settings`   | cấu hình có phạm vi rõ ràng                  | `form`         |
| `operations` | theo dõi hoặc thực thi tác vụ vận hành       | `table`        |

## Route inventory

| Route                      | Archetype    | Primary task                        |
| -------------------------- | ------------ | ----------------------------------- |
| `/admin/dashboard`         | `overview`   | đọc tình trạng kinh doanh           |
| `/admin/products`          | `collection` | tìm và quản lý sản phẩm             |
| `/admin/products/new`      | `editor`     | tạo sản phẩm                        |
| `/admin/products/:id`      | `overview`   | xem một sản phẩm                    |
| `/admin/products/:id/edit` | `editor`     | sửa sản phẩm                        |
| `/admin/categories`        | `collection` | quản lý taxonomy sản phẩm           |
| `/admin/orders`            | `workflow`   | xử lý hàng đợi đơn hàng             |
| `/admin/orders/new`        | `editor`     | tạo đơn thủ công                    |
| `/admin/inventory`         | `operations` | theo dõi tồn và biến động kho       |
| `/admin/inventory/new`     | `editor`     | tạo điều chỉnh kho                  |
| `/admin/home`              | `editor`     | biên tập canvas trang chủ           |
| `/admin/posts`             | `collection` | tìm và quản lý bài viết             |
| `/admin/posts/new`         | `editor`     | viết bài mới                        |
| `/admin/posts/:id/edit`    | `editor`     | viết và cập nhật bài                |
| `/admin/pages`             | `collection` | quản lý trang có cấu trúc           |
| `/admin/campaigns`         | `workflow`   | biên tập collection đa ngôn ngữ     |
| `/admin/media`             | `collection` | tìm và quản lý asset                |
| `/admin/leads`             | `workflow`   | xử lý lead                          |
| `/admin/redirects`         | `operations` | vận hành redirect và SEO continuity |
| `/admin/settings`          | `settings`   | cấu hình website                    |
| `/admin/operations`        | `operations` | theo dõi job, release và webhook    |
| `/admin/performance`       | `overview`   | đọc Web Vitals thực tế              |
| `/admin/handover`          | `workflow`   | hoàn tất quy trình bàn giao         |
| `/admin/audit`             | `operations` | tra cứu audit trail                 |
| `/admin/security`          | `settings`   | cấu hình bảo mật tài khoản          |
| `/admin/staff`             | `settings`   | quản lý nhân sự và quyền            |
| `/admin/logs`              | `operations` | tra cứu log kỹ thuật                |

## Route ngoài Admin chrome

Các route preview (`home-preview`, `settings-preview`, post/page/campaign
preview) cố ý bypass `AdminPage` và `AdminShell`. Chúng vẫn đi qua auth context
của parent `/admin` nhưng không tham gia inventory geometry vì nhiệm vụ của chúng
là render output, không phải thao tác Admin.

Các legacy alias như `/admin/add-product`, `/admin/edit-product/:id` và
`/admin/view-product/:id` chỉ redirect sang route canonical và không sở hữu UI.
