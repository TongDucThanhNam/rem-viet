import { defaultFaqBlock } from "@agency/cms-template-rem-viet";
import { defineArrayMember, defineField, defineType } from "sanity";

export const agencyFaqItem = defineType({
  name: "agencyFaqItem",
  title: "Câu hỏi",
  type: "object",
  fields: [
    defineField({ name: "id", type: "string", hidden: true, readOnly: true }),
    defineField({
      name: "question",
      title: "Câu hỏi",
      type: "string",
      validation: (rule) => rule.required().max(180),
    }),
    defineField({
      name: "answer",
      title: "Câu trả lời",
      type: "text",
      rows: 5,
      validation: (rule) => rule.required().max(600),
    }),
  ],
  preview: { select: { title: "question", subtitle: "answer" } },
});

export const agencyFaqBlock = defineType({
  name: "agencyFaqBlock",
  title: "Câu hỏi thường gặp",
  type: "object",
  initialValue: defaultFaqBlock,
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
          name: "eyebrow",
          title: "Eyebrow",
          type: "string",
          validation: (rule) => rule.required().max(120),
        }),
        defineField({
          name: "backdropLabel",
          title: "Chữ nền",
          type: "string",
          validation: (rule) => rule.required().max(120),
        }),
        defineField({
          name: "title",
          title: "Tiêu đề",
          type: "string",
          validation: (rule) => rule.required().max(120),
        }),
        defineField({
          name: "intro",
          title: "Giới thiệu",
          type: "text",
          rows: 4,
          validation: (rule) => rule.required().max(600),
        }),
        defineField({ name: "cta", title: "CTA", type: "agencyLink" }),
        defineField({
          name: "items",
          title: "Câu hỏi",
          type: "array",
          of: [defineArrayMember({ type: "agencyFaqItem" })],
          validation: (rule) => rule.required().min(1).max(20),
        }),
      ],
    }),
  ],
  preview: { select: { title: "data.title", subtitle: "data.intro" } },
});
