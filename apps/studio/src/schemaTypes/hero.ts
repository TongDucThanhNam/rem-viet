import { defaultHeroBlock } from "@agency/cms-template-rem-viet";
import { defineArrayMember, defineField, defineType } from "sanity";

import { hasPortableOrSanityImage, safeMediaSource } from "./shared";

export const agencyHeroFeature = defineType({
  name: "agencyHeroFeature",
  title: "Điểm nổi bật",
  type: "object",
  fields: [
    defineField({ name: "id", type: "string", hidden: true, readOnly: true }),
    defineField({
      name: "iconKey",
      title: "Biểu tượng",
      type: "string",
      options: {
        list: [
          { title: "Bảo vệ", value: "shield" },
          { title: "May đo", value: "ruler" },
          { title: "Thông thoáng", value: "wind" },
          { title: "Thẩm mỹ", value: "sparkles" },
        ],
        layout: "radio",
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "label",
      title: "Nhãn",
      type: "string",
      validation: (rule) => rule.required().max(32),
    }),
    defineField({
      name: "value",
      title: "Giá trị",
      type: "string",
      validation: (rule) => rule.required().max(64),
    }),
  ],
  preview: { select: { title: "label", subtitle: "value" } },
});

export const agencyHeroBackground = defineType({
  name: "agencyHeroBackground",
  title: "Ảnh nền Hero",
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
        "Ưu tiên ảnh này khi đã chọn. Hotspot giữ chủ thể trong các khung responsive.",
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
      type: "string",
      validation: (rule) => rule.max(180),
    }),
    defineField({
      name: "position",
      title: "Vị trí ảnh",
      type: "string",
      options: { list: ["center", "left", "right", "top", "bottom"] },
      validation: (rule) => rule.required(),
    }),
  ],
});

export const agencyHeroBlock = defineType({
  name: "agencyHeroBlock",
  title: "Hero mở đầu",
  type: "object",
  initialValue: defaultHeroBlock,
  fields: [
    defineField({ name: "id", type: "string", hidden: true, readOnly: true }),
    defineField({ name: "type", type: "string", hidden: true, readOnly: true }),
    defineField({
      name: "schemaVersion",
      type: "number",
      hidden: true,
      readOnly: true,
    }),
    defineField({
      name: "enabled",
      title: "Hiển thị",
      type: "boolean",
      initialValue: true,
    }),
    defineField({
      name: "data",
      title: "Nội dung",
      type: "object",
      fields: [
        defineField({
          name: "kicker",
          title: "Eyebrow",
          type: "string",
          validation: (rule) => rule.required().max(80),
        }),
        defineField({
          name: "title",
          title: "Tiêu đề",
          type: "object",
          fields: [
            defineField({
              name: "prefix",
              title: "Phần đầu",
              type: "string",
              validation: (rule) => rule.required().max(48),
            }),
            defineField({
              name: "accent",
              title: "Phần nhấn",
              type: "string",
              validation: (rule) => rule.max(48),
            }),
          ],
        }),
        defineField({
          name: "description",
          title: "Mô tả",
          type: "text",
          rows: 4,
          validation: (rule) => rule.required().max(360),
        }),
        defineField({
          name: "background",
          title: "Ảnh nền",
          type: "agencyHeroBackground",
        }),
        defineField({
          name: "primaryCta",
          title: "CTA chính",
          type: "agencyLink",
        }),
        defineField({
          name: "secondaryCta",
          title: "CTA phụ",
          type: "agencyLink",
        }),
        defineField({
          name: "features",
          title: "Bốn điểm nổi bật",
          type: "array",
          of: [defineArrayMember({ type: "agencyHeroFeature" })],
          validation: (rule) => rule.required().length(4),
        }),
        defineField({
          name: "scrollLabel",
          title: "Nhãn cuộn",
          type: "string",
          validation: (rule) => rule.required().max(24),
        }),
      ],
    }),
  ],
  preview: {
    select: { title: "data.title.prefix", subtitle: "data.description" },
    prepare: ({ title, subtitle }) => ({
      title: `Hero · ${String(title ?? "Chưa có tiêu đề")}`,
      subtitle,
    }),
  },
});
