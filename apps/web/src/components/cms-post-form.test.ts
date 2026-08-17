import { describe, expect, test } from "bun:test";

import {
  type CmsPostFormValues,
  validateCmsPostFormValues,
} from "./cms-post-form";

function values(patch: Partial<CmsPostFormValues> = {}): CmsPostFormValues {
  return {
    canonicalUrl: "",
    content: JSON.stringify({
      version: 1,
      blocks: [{ type: "paragraph", children: [{ text: "Nội dung" }] }],
    }),
    coverImage: "",
    description: "",
    ogImage: "",
    publishDate: "",
    robotsFollow: true,
    robotsIndex: true,
    seoDescription: "",
    seoTitle: "",
    tags: [],
    title: "Bài viết",
    ...patch,
  };
}

describe("CMS post form validation", () => {
  test("requires a title before save", () => {
    expect(validateCmsPostFormValues(values({ title: "" }))).toBe(
      "Tiêu đề là bắt buộc.",
    );
  });

  test("rejects malformed structured content", () => {
    expect(
      validateCmsPostFormValues(values({ content: "<p>unsafe</p>" })),
    ).toBe(
      "Nội dung có cấu trúc chưa hợp lệ. Kiểm tra văn bản thay thế của ảnh và địa chỉ video.",
    );
  });

  test("accepts a valid structured draft", () => {
    expect(validateCmsPostFormValues(values())).toBeNull();
  });
});
