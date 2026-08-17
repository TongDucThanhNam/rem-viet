import { defineArrayMember, defineField, defineType } from "sanity";

export const agencyPageContent = defineType({
  name: "agencyPageContent",
  title: "Nội dung trang",
  type: "object",
  fields: [
    defineField({
      name: "title",
      title: "Tên trang",
      type: "string",
      validation: (rule) => rule.required().max(120),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "string",
      readOnly: true,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "template",
      title: "Template",
      type: "string",
      hidden: true,
      readOnly: true,
    }),
    defineField({ name: "seo", title: "SEO", type: "agencySeo" }),
    defineField({
      name: "blocks",
      title: "Sections",
      description:
        "Vertical slice giới hạn Hero + FAQ. ID và schemaVersion do provider quản lý.",
      type: "array",
      of: [
        defineArrayMember({ type: "agencyHeroBlock" }),
        defineArrayMember({ type: "agencyFaqBlock" }),
      ],
      options: { sortable: true },
      validation: (rule) =>
        rule
          .required()
          .length(2)
          .custom((blocks) => {
            if (!Array.isArray(blocks)) return true;
            const types = blocks.map((block) =>
              block && typeof block === "object" && "_type" in block
                ? String(block._type)
                : "",
            );
            return types[0] === "agencyHeroBlock" &&
              types[1] === "agencyFaqBlock"
              ? true
              : "Vertical slice phải giữ Hero đầu tiên và FAQ thứ hai.";
          }),
    }),
  ],
});

export const agencyPage = defineType({
  name: "agencyPage",
  title: "Trang visual editing",
  type: "document",
  groups: [
    { name: "content", title: "Nội dung", default: true },
    { name: "system", title: "System" },
  ],
  fields: [
    defineField({
      name: "agencyId",
      title: "Agency ID",
      type: "string",
      group: "system",
      readOnly: true,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "content",
      title: "Nội dung",
      type: "agencyPageContent",
      group: "content",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "schemaVersion",
      title: "Schema version",
      type: "number",
      group: "system",
      readOnly: true,
      validation: (rule) => rule.required().integer().min(1),
    }),
    defineField({
      name: "version",
      title: "Portable version",
      type: "number",
      group: "system",
      readOnly: true,
      validation: (rule) => rule.required().integer().min(1),
    }),
    defineField({
      name: "updatedBy",
      title: "Last actor",
      type: "string",
      group: "system",
      readOnly: true,
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: {
      title: "content.title",
      subtitle: "content.slug",
    },
  },
});
