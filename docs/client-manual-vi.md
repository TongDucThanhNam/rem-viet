# Hướng dẫn CMS cho khách hàng

## Đăng nhập và vai trò

Mở `/dang-nhap`. Không có đăng ký công khai. Owner quản lý toàn bộ; Admin được
publish và vận hành nội dung; Editor chỉ sửa draft, preview và media.

Đăng nhập bằng email/mật khẩu do Owner hoặc đơn vị triển khai cấp. Nút đăng ký và
OAuth không xuất hiện vì hệ thống cố ý đóng đăng ký công khai. Nếu quên mật khẩu,
mở **Quên mật khẩu** rồi liên hệ Owner/đơn vị triển khai để xác minh và khôi phục;
hệ thống hiện chưa tự gửi email reset.

## Sửa trang chủ

1. Mở **Nội dung → Trang chủ CMS**.
2. Chọn block bên trái, sửa form ở giữa. Có thể bật/tắt và đổi thứ tự trong giới
   hạn template.
3. Trạng thái `Đang lưu` chuyển thành `Đã lưu`; không đóng tab khi còn `Chưa lưu`.
4. Chọn desktop/tablet/mobile ở preview. Nút **Xem draft** mở renderer thật.
5. Admin/Owner bấm **Publish** và xác nhận. Draft không lên public trước bước này.
6. Muốn hẹn giờ, chọn thời gian địa phương rồi bấm **Lên lịch**. Website cũ vẫn
   hoạt động cho đến đúng giờ.

Nếu có “Xung đột phiên bản”, một tab/người khác đã lưu trước. Sao chép phần cần
giữ, bấm **Tải bản server**, rồi nhập lại thay đổi; CMS không tự ghi đè.

## Pages và bài viết

- Pages dùng block Rich text, Product grid và CTA; không cần JSON.
- Bài viết dùng block heading, paragraph, list, quote, image, video và code.
- `Lưu draft` không đổi public. Publish là nút riêng, có xác nhận.
- Khi đổi slug của nội dung đã publish, chọn tạo redirect 301 để giữ link cũ.
- Revision cũ có thể **Restore draft**; restore không tự publish.

## Media

- Chỉ AVIF/GIF/JPEG/PNG/WebP, tối đa 5 MB/file, 12 file và 30 MB/lần.
- CMS kiểm tra MIME lẫn chữ ký file. Mỗi file có tiến độ và có thể thử lại.
- Điền alt mô tả nội dung ảnh. Ảnh public quan trọng không lưu được nếu thiếu alt.
- Media đang được dùng bị chặn xóa. Chỉ Owner có thể force-delete sau cảnh báo.

## SEO, redirects và leads

- Mỗi page/post có SEO title, description, canonical, OG image, index/follow.
- **Redirects** chặn URL ngoài site, self redirect và vòng lặp.
- **Leads** cho phép đổi new/contacted/closed/spam, ghi note và export CSV.
- Xóa lead là xóa vĩnh viễn dữ liệu cá nhân; hệ thống cũng purge theo retention.

## Kịch bản bàn giao 30 phút

Đổi một dòng Hero, thay ảnh có alt, thêm FAQ, reorder gallery, xem mobile preview,
publish, restore revision; sau đó tạo một page, một bài viết và xử lý một lead.
