-- Seed is intentionally non-destructive. Re-running it must not replace an
-- edited post or cascade-delete its revision history.
INSERT INTO posts (
  id,
  slug,
  title,
  description,
  cover_image,
  tags,
  status,
  url,
  content,
  table_of_contents,
  publish_date,
  seo_title,
  seo_description,
  created_at,
  updated_at
) VALUES
(
  'seed-post-luoi-chong-muoi-may-do',
  'luoi-chong-muoi-may-do-la-gi',
  'Lưới chống muỗi may đo là gì? Khi nào nên dùng cho cửa sổ và cửa đi',
  'Hiểu đúng lưới chống muỗi may đo, điểm khác với lưới bán sẵn và những trường hợp nên chọn giải pháp làm theo từng khung cửa.',
  '/assets/window-mosquito-net-hero.webp',
  '["lưới chống muỗi","may đo","cửa sổ","cửa đi"]',
  'published',
  '/bai-viet/luoi-chong-muoi-may-do-la-gi.html',
  'Lưới chống muỗi may đo là giải pháp làm theo kích thước thực tế của từng ô cửa, thay vì dùng một bộ khung cố định rồi cố gắng lắp vừa. Với nhà ở Việt Nam, đây là khác biệt quan trọng vì mỗi căn hộ, mỗi loại cửa nhôm, cửa gỗ, cửa lùa hoặc cửa mở quay thường có sai lệch vài milimet đến vài centimet.

Vì sao cần may đo?

Muỗi không cần một khe lớn để lọt vào nhà. Chỉ một khoảng hở nhỏ ở mép khung, ray trượt hoặc điểm tiếp giáp giữa lưới và tường cũng đủ làm hệ thống mất tác dụng. May đo giúp khung lưới bám đúng biên dạng cửa, giảm khe hở và giữ được độ căng của mặt lưới.

Khi nào nên dùng lưới chống muỗi may đo?

Nên dùng khi cửa có kích thước không chuẩn, cửa lùa ban công, cửa sổ phòng ngủ, khu vực bếp, logia hoặc nhà có trẻ nhỏ. Những vị trí này cần vừa chống muỗi, vừa giữ thông gió và ánh sáng tự nhiên.

Điểm cần kiểm tra trước khi đặt làm

Bạn nên kiểm tra hướng mở cửa, độ sâu khung, vị trí tay nắm, khoảng trống để ray hoặc bản lề hoạt động. Nếu chỉ đo chiều ngang và chiều cao mà bỏ qua cơ chế mở, lưới có thể vừa kích thước nhưng vướng khi sử dụng.

Một bộ lưới tốt không chỉ là miếng lưới căng đẹp. Nó là tổ hợp của khung, ray, phụ kiện, độ căng lưới và cách xử lý mép tiếp giáp. Khi các phần này khớp với nhau, cửa vẫn thoáng, ánh sáng vẫn vào nhà, còn muỗi bị chặn ở đúng nơi cần chặn.',
  NULL,
  '2026-06-20T08:00:00+07:00',
  'Lưới chống muỗi may đo là gì? Khi nào nên dùng',
  'Tìm hiểu lưới chống muỗi may đo, lợi ích, trường hợp nên dùng và các điểm cần kiểm tra trước khi lắp cho cửa sổ, cửa đi.',
  cast(strftime('%s', '2026-06-20T01:00:00Z') as integer) * 1000,
  cast(strftime('%s', '2026-06-20T01:00:00Z') as integer) * 1000
),
(
  'seed-post-cach-do-kich-thuoc',
  'cach-do-kich-thuoc-cua-de-dat-luoi-chong-muoi',
  'Cách đo kích thước cửa để đặt lưới chống muỗi vừa khít',
  'Hướng dẫn đo cửa sổ, cửa đi và cửa lùa trước khi đặt lưới chống muỗi, giúp hạn chế sai số và tránh vướng tay nắm hoặc ray trượt.',
  '/assets/measurement-guide.png',
  '["hướng dẫn đo","kích thước","lắp đặt","lưới chống muỗi"]',
  'published',
  '/bai-viet/cach-do-kich-thuoc-cua-de-dat-luoi-chong-muoi.html',
  'Đo đúng là bước quyết định để lưới chống muỗi vừa khít. Một bộ lưới đẹp nhưng sai kích thước sẽ tạo khe hở, cấn tay nắm hoặc không chạy mượt trên ray.

Chuẩn bị trước khi đo

Bạn cần thước kéo cứng, giấy ghi chú và ảnh chụp toàn cảnh cửa. Nếu có thể, hãy chụp thêm mép trên, mép dưới, hai cạnh bên và vị trí tay nắm. Ảnh giúp thợ hiểu cấu tạo cửa, không chỉ hiểu con số.

Cách đo chiều ngang

Đo ngang ở ba vị trí: phía trên, giữa và phía dưới. Ghi cả ba số. Nếu lắp lọt lòng trong khung, thường cần lấy số nhỏ nhất làm cơ sở để tránh bị cấn. Nếu lắp phủ ngoài khung, cần ghi rõ bề rộng vùng có thể bắt vít hoặc dán khung.

Cách đo chiều cao

Đo cao ở bên trái, giữa và bên phải. Cửa thực tế có thể lệch do tường, sàn hoặc khung nhôm không vuông tuyệt đối. Ghi đủ ba số giúp xử lý sai số khi sản xuất.

Đừng quên chiều sâu và vật cản

Nhiều lỗi lắp đặt không đến từ chiều ngang hay chiều cao, mà đến từ chiều sâu khung. Tay nắm, khóa, rèm, thanh chắn, ray cửa lùa hoặc cục chặn đều có thể làm lưới bị vướng. Hãy đo khoảng trống từ mặt khung đến vật cản gần nhất.

Checklist gửi cho đơn vị tư vấn

Gửi chiều ngang ba điểm, chiều cao ba điểm, ảnh tổng thể cửa, ảnh chi tiết ray hoặc bản lề, hướng mở cửa và nhu cầu sử dụng: cố định, mở quay, mở lùa hay dạng cuốn. Càng rõ ngay từ đầu, sản phẩm càng ít phải chỉnh sửa sau khi lắp.',
  NULL,
  '2026-06-22T08:00:00+07:00',
  'Cách đo kích thước cửa để đặt lưới chống muỗi',
  'Hướng dẫn đo ngang, cao, chiều sâu khung và vật cản trước khi đặt lưới chống muỗi cho cửa sổ, cửa đi, cửa lùa.',
  cast(strftime('%s', '2026-06-22T01:00:00Z') as integer) * 1000,
  cast(strftime('%s', '2026-06-22T01:00:00Z') as integer) * 1000
),
(
  'seed-post-chon-vat-lieu-luoi',
  'chon-vat-lieu-luoi-chong-muoi-fiberglass-inox-polyester',
  'Fiberglass, inox hay polyester: chọn vật liệu lưới chống muỗi thế nào?',
  'So sánh các vật liệu lưới chống muỗi phổ biến theo độ thoáng, độ bền, thẩm mỹ và môi trường sử dụng trong nhà ở.',
  '/assets/fiberglass-mesh.webp',
  '["vật liệu","fiberglass","inox","polyester"]',
  'published',
  '/bai-viet/chon-vat-lieu-luoi-chong-muoi-fiberglass-inox-polyester.html',
  'Không có một loại vật liệu lưới chống muỗi tốt nhất cho mọi nhà. Lựa chọn đúng phụ thuộc vào vị trí lắp, mức độ nắng mưa, nhu cầu thẩm mỹ và tần suất sử dụng.

Fiberglass

Fiberglass là lựa chọn phổ biến cho cửa sổ và cửa đi trong căn hộ vì nhẹ, thoáng và nhìn mềm mắt. Bề mặt thường được phủ nhựa để tăng độ bền và giảm cảm giác thô. Điểm mạnh là thẩm mỹ tốt, giá hợp lý, phù hợp nhu cầu sinh hoạt hằng ngày.

Inox

Lưới inox phù hợp nơi cần độ bền cao hơn, khu vực dễ va chạm hoặc cần cảm giác chắc chắn. Inox chịu lực tốt nhưng nhìn có thể cứng hơn, độ thoáng và cảm giác nhẹ nhàng thường không bằng fiberglass. Nếu dùng inox, cần chú ý chất lượng inox và môi trường gần biển hoặc nơi ẩm kéo dài.

Polyester

Polyester thường mềm, nhẹ và dễ thi công trong một số hệ lưới nhất định. Vật liệu này hợp với các nhu cầu linh hoạt, nhưng cần kiểm tra độ căng, khả năng chịu nắng và độ ổn định khi dùng lâu dài.

Cách chọn thực tế

Với phòng ngủ, phòng khách và cửa ban công căn hộ, ưu tiên độ thoáng, ánh sáng và thẩm mỹ. Với khu vực dễ va đập, nhà có thú cưng hoặc vị trí ngoài trời nhiều gió, ưu tiên độ bền và khung chắc. Với cửa bếp, cần thêm yếu tố dễ vệ sinh vì bụi dầu bám nhanh hơn.

Đừng chỉ hỏi vật liệu lưới

Một bộ lưới bền còn phụ thuộc vào khung, phụ kiện, ray, cách căng mặt lưới và cách xử lý mép. Vật liệu tốt nhưng khung yếu hoặc lắp sai vẫn có thể nhanh xệ, hở mép hoặc khó đóng mở.',
  NULL,
  '2026-06-24T08:00:00+07:00',
  'Chọn vật liệu lưới chống muỗi: fiberglass, inox hay polyester',
  'So sánh fiberglass, inox và polyester khi chọn lưới chống muỗi cho cửa sổ, cửa đi, ban công và khu vực bếp.',
  cast(strftime('%s', '2026-06-24T01:00:00Z') as integer) * 1000,
  cast(strftime('%s', '2026-06-24T01:00:00Z') as integer) * 1000
),
(
  'seed-post-bao-tri-luoi-chong-muoi',
  'bao-tri-luoi-chong-muoi-trong-can-ho',
  'Bảo trì lưới chống muỗi trong căn hộ: sạch, thoáng và bền hơn',
  'Các bước vệ sinh và kiểm tra lưới chống muỗi định kỳ để giữ độ thoáng, tránh xệ lưới và kéo dài tuổi thọ bộ khung.',
  '/assets/lifestyle_breeze.webp',
  '["bảo trì","vệ sinh","căn hộ","độ bền"]',
  'published',
  '/bai-viet/bao-tri-luoi-chong-muoi-trong-can-ho.html',
  'Lưới chống muỗi làm việc âm thầm mỗi ngày. Nó giữ muỗi và côn trùng bên ngoài, nhưng đồng thời cũng giữ lại bụi mịn, lông thú cưng và hơi dầu từ sinh hoạt. Nếu không vệ sinh định kỳ, lưới sẽ giảm độ thoáng và nhìn tối hơn.

Bao lâu nên vệ sinh một lần?

Với phòng ngủ hoặc phòng khách, nên vệ sinh nhẹ mỗi một đến hai tháng. Với khu vực bếp, logia hoặc nơi gần đường nhiều bụi, nên kiểm tra thường xuyên hơn. Dấu hiệu cần vệ sinh là lưới ngả màu, gió vào yếu hơn hoặc bề mặt có bụi bám thành lớp.

Cách vệ sinh cơ bản

Dùng chổi mềm hoặc máy hút bụi lực nhẹ để lấy bụi khô trước. Sau đó lau bằng khăn ẩm vắt kỹ. Nếu có vết bẩn bám, dùng nước pha loãng với xà phòng nhẹ, tránh hóa chất mạnh vì có thể làm bạc màu hoặc ảnh hưởng lớp phủ của sợi lưới.

Kiểm tra khung và ray

Ngoài mặt lưới, hãy kiểm tra khung, ray, bản lề, nam châm hoặc chốt khóa. Bụi trong ray làm cửa lùa nặng hơn và dễ tạo cảm giác kẹt. Nếu khung bị lệch hoặc mặt lưới bị xệ, nên xử lý sớm trước khi khe hở lớn dần.

Những việc nên tránh

Không dùng bàn chải cứng chà mạnh, không xịt nước áp lực cao trực tiếp vào mép khung, không tự kéo căng lại mặt lưới khi chưa biết kết cấu giữ lưới. Những thao tác này có thể làm bung mép hoặc méo khung.

Bảo trì tốt giúp bộ lưới giữ được ba thứ quan trọng: chống muỗi hiệu quả, không gian vẫn thoáng và cửa nhìn gọn trong kiến trúc tổng thể của nhà.',
  NULL,
  '2026-06-26T08:00:00+07:00',
  'Bảo trì lưới chống muỗi trong căn hộ',
  'Hướng dẫn vệ sinh, kiểm tra khung ray và bảo trì lưới chống muỗi định kỳ để giữ độ thoáng và độ bền.',
  cast(strftime('%s', '2026-06-26T01:00:00Z') as integer) * 1000,
  cast(strftime('%s', '2026-06-26T01:00:00Z') as integer) * 1000
)
ON CONFLICT(id) DO NOTHING;

-- Empty databases run migrations before this import in some deployment paths,
-- so create the initial immutable snapshot here as well as in migration 0006's
-- legacy backfill. Existing documents with a published pointer are untouched.
INSERT OR IGNORE INTO post_revisions (
  id,
  post_id,
  version,
  snapshot,
  note,
  created_by,
  created_at
)
SELECT
  'seed-revision-' || id,
  id,
  version,
  json_object(
    'title', title,
    'slug', slug,
    'description', description,
    'coverImage', cover_image,
    'tags', json(tags),
    'content', content,
    'publishDate', publish_date,
    'seoTitle', seo_title,
    'seoDescription', seo_description,
    'url', url,
    'tableOfContents', CASE
      WHEN table_of_contents IS NULL THEN NULL
      ELSE json(table_of_contents)
    END
  ),
  'Initial published seed',
  'seed',
  updated_at
FROM posts
WHERE id LIKE 'seed-post-%' AND published_revision_id IS NULL;

UPDATE posts
SET
  published_revision_id = 'seed-revision-' || id,
  published_at = COALESCE(published_at, updated_at),
  updated_by = CASE WHEN updated_by = '' THEN 'seed' ELSE updated_by END
WHERE id LIKE 'seed-post-%' AND published_revision_id IS NULL;
