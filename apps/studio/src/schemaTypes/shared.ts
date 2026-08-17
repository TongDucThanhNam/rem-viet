import { defineArrayMember, defineField, defineType } from "sanity";

function safePublicLink(value: string | undefined) {
  if (!value) return true;
  if (
    (value.startsWith("/") && !value.startsWith("//")) ||
    (value.startsWith("#") && value.length > 1)
  ) {
    return true;
  }
  try {
    return ["http:", "https:", "mailto:", "tel:"].includes(
      new URL(value).protocol,
    );
  } catch {
    return false;
  }
}

export function safeMediaSource(value: string | undefined) {
  if (!value) return true;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function hasSanityImageAsset(value: unknown) {
  if (!value || typeof value !== "object" || !("asset" in value)) return false;
  const asset = value.asset;
  return (
    !!asset &&
    typeof asset === "object" &&
    "_ref" in asset &&
    typeof asset._ref === "string" &&
    asset._ref.startsWith("image-")
  );
}

export function hasPortableOrSanityImage(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { nativeAsset?: unknown; src?: unknown };
  return (
    hasSanityImageAsset(candidate.nativeAsset) ||
    (typeof candidate.src === "string" &&
      candidate.src.trim().length > 0 &&
      safeMediaSource(candidate.src))
  );
}

export const agencyLink = defineType({
  name: "agencyLink",
  title: "Liên kết",
  type: "object",
  fields: [
    defineField({
      name: "label",
      title: "Nhãn",
      type: "string",
      validation: (rule) => rule.required().max(48),
    }),
    defineField({
      name: "href",
      title: "Đường dẫn",
      type: "string",
      validation: (rule) =>
        rule
          .required()
          .custom((value) =>
            safePublicLink(value)
              ? true
              : "Chỉ dùng đường dẫn nội bộ, anchor, HTTP(S), mailto hoặc tel.",
          ),
    }),
    defineField({
      name: "cursorLabel",
      title: "Nhãn con trỏ",
      type: "string",
      validation: (rule) => rule.required().max(24),
    }),
  ],
});

export const agencyImageSource = defineType({
  name: "agencyImageSource",
  title: "Hình ảnh",
  type: "object",
  validation: (rule) =>
    rule.custom((value) =>
      hasPortableOrSanityImage(value)
        ? true
        : "Chọn ảnh từ thư viện Sanity hoặc nhập URL/đường dẫn hợp lệ.",
    ),
  fields: [
    defineField({
      name: "nativeAsset",
      title: "Ảnh từ thư viện Sanity",
      type: "image",
      options: { hotspot: true },
      description:
        "Ưu tiên ảnh này khi đã chọn. Crop và hotspot được giữ trong Sanity.",
    }),
    defineField({
      name: "mediaId",
      title: "Media ID",
      type: "string",
      hidden: true,
      readOnly: true,
    }),
    defineField({
      name: "src",
      title: "URL hoặc đường dẫn dự phòng",
      description:
        "Dùng cho asset do provider hiện tại quản lý; có thể để trống khi đã chọn ảnh Sanity.",
      type: "string",
      validation: (rule) =>
        rule.custom((value) =>
          safeMediaSource(value)
            ? true
            : "Ảnh phải là đường dẫn nội bộ hoặc URL HTTP(S).",
        ),
    }),
    defineField({
      name: "alt",
      title: "Mô tả thay thế",
      description: "Bắt buộc với ảnh có nội dung; để trống với ảnh trang trí.",
      type: "string",
      validation: (rule) => rule.max(180),
    }),
  ],
});

export const agencySeo = defineType({
  name: "agencySeo",
  title: "SEO",
  type: "object",
  options: { collapsible: true, collapsed: true },
  validation: (rule) =>
    rule.custom((value) => {
      if (!value || typeof value !== "object") return true;
      const candidate = value as { ogImage?: unknown; ogImageAsset?: unknown };
      if (hasSanityImageAsset(candidate.ogImageAsset)) return true;
      return typeof candidate.ogImage === "string" &&
        candidate.ogImage.trim().length > 0 &&
        safeMediaSource(candidate.ogImage)
        ? true
        : "Chọn Open Graph image từ Sanity hoặc nhập URL/đường dẫn hợp lệ.";
    }),
  fields: [
    defineField({
      name: "title",
      title: "Tiêu đề SEO",
      type: "string",
      validation: (rule) => rule.required().max(120),
    }),
    defineField({
      name: "description",
      title: "Mô tả",
      type: "text",
      rows: 3,
      validation: (rule) => rule.required().max(320),
    }),
    defineField({
      name: "canonicalUrl",
      title: "Canonical URL",
      type: "url",
      validation: (rule) => rule.required().uri({ scheme: ["http", "https"] }),
    }),
    defineField({
      name: "ogImageAsset",
      title: "Open Graph image từ Sanity",
      type: "image",
      options: { hotspot: true },
    }),
    defineField({
      name: "ogImage",
      title: "Open Graph image dự phòng",
      type: "string",
      validation: (rule) =>
        rule.custom((value) =>
          safeMediaSource(value)
            ? true
            : "OG image phải là đường dẫn nội bộ hoặc URL HTTP(S).",
        ),
    }),
    defineField({
      name: "robotsIndex",
      title: "Cho phép index",
      type: "boolean",
      initialValue: false,
    }),
    defineField({
      name: "robotsFollow",
      title: "Cho phép follow",
      type: "boolean",
      initialValue: false,
    }),
  ],
});

export const agencyStringList = defineType({
  name: "agencyStringList",
  title: "Danh sách chuỗi",
  type: "array",
  of: [defineArrayMember({ type: "string" })],
});
