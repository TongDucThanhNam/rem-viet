import type { CmsBlockAuthoringDefinition } from "@agency/cms-admin";

export const remVietRichTextBlockTypes = [
  "paragraph",
  "heading",
  "list",
  "quote",
  "image",
  "video",
  "code",
] as const;

export type RemVietRichTextBlockType =
  (typeof remVietRichTextBlockTypes)[number];

const remVietRichTextAuthoringCatalogSource = [
  {
    type: "paragraph",
    label: "Đoạn văn",
    description: "Nội dung chính với liên kết và định dạng nhấn mạnh an toàn.",
    category: "Nội dung",
    keywords: ["text", "body", "copy", "noi dung", "van ban"],
  },
  {
    type: "heading",
    label: "Tiêu đề",
    description: "Chia bài viết thành các phần dễ đọc bằng tiêu đề cấp 2–4.",
    category: "Cấu trúc",
    keywords: ["heading", "title", "section", "tieu de"],
  },
  {
    type: "list",
    label: "Danh sách",
    description: "Nhóm các ý theo danh sách dấu đầu dòng hoặc đánh số.",
    category: "Cấu trúc",
    keywords: ["list", "bullets", "numbered", "danh sach", "liet ke"],
  },
  {
    type: "quote",
    label: "Trích dẫn",
    description:
      "Làm nổi bật lời chứng thực, nhận định hoặc câu nói quan trọng.",
    category: "Nhấn mạnh",
    keywords: ["quote", "testimonial", "citation", "trich dan"],
  },
  {
    type: "image",
    label: "Ảnh",
    description: "Chèn hình ảnh từ thư viện kèm alt và chú thích có cấu trúc.",
    category: "Media",
    keywords: ["image", "photo", "media", "anh", "hinh"],
  },
  {
    type: "video",
    label: "Video",
    description: "Nhúng video HTTPS với tiêu đề truy cập bắt buộc.",
    category: "Media",
    keywords: ["video", "youtube", "embed", "clip"],
  },
  {
    type: "code",
    label: "Code",
    description: "Hiển thị đoạn mã nguyên khối với ngôn ngữ tùy chọn.",
    category: "Kỹ thuật",
    keywords: ["code", "snippet", "source", "ma nguon"],
  },
] as const satisfies readonly CmsBlockAuthoringDefinition<RemVietRichTextBlockType>[];

/**
 * Template-owned discovery metadata for the structured body editor shared by
 * standard pages and posts. The content schema stays provider-neutral while
 * this template owns its Vietnamese labels and search vocabulary.
 */
export const remVietRichTextAuthoringCatalog = Object.freeze(
  remVietRichTextAuthoringCatalogSource.map((definition) =>
    Object.freeze({
      ...definition,
      keywords: Object.freeze([...definition.keywords]),
    }),
  ),
);

export const remVietRichTextAuthoringByType = Object.freeze(
  Object.fromEntries(
    remVietRichTextAuthoringCatalog.map((definition) => [
      definition.type,
      definition,
    ]),
  ) as Record<
    RemVietRichTextBlockType,
    (typeof remVietRichTextAuthoringCatalog)[number]
  >,
);

export const remVietRichTextBlockLabels = Object.freeze(
  Object.fromEntries(
    remVietRichTextAuthoringCatalog.map(({ type, label }) => [type, label]),
  ) as Record<RemVietRichTextBlockType, string>,
);
