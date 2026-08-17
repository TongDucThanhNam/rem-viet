import { describe, expect, test } from "bun:test";

import {
  isPostPreviewCompositionMessage,
  isPostPreviewMessage,
  isPostPreviewSelectMessage,
  postPreviewFields,
} from "./post-preview";

const validValues = {
  canonicalUrl: "",
  content: '{"version":1,"blocks":[]}',
  coverImage: "",
  description: "Mô tả",
  ogImage: "",
  publishDate: "",
  robotsFollow: true,
  robotsIndex: true,
  seoDescription: "",
  seoTitle: "",
  slug: "bai-viet",
  tags: ["rèm"],
  title: "Bài viết",
};

describe("post working-copy preview protocol", () => {
  test("accepts the complete typed working copy for the matching post", () => {
    expect(
      isPostPreviewMessage(
        {
          type: "cms:post-preview",
          postId: "post-1",
          selectedField: "title",
          selectedBlockIndex: null,
          values: validValues,
        },
        "post-1",
      ),
    ).toBe(true);
  });

  test("rejects cross-post, malformed and unknown-field working copies", () => {
    expect(
      isPostPreviewMessage(
        {
          type: "cms:post-preview",
          postId: "post-2",
          selectedField: null,
          selectedBlockIndex: null,
          values: validValues,
        },
        "post-1",
      ),
    ).toBe(false);
    expect(
      isPostPreviewMessage(
        {
          type: "cms:post-preview",
          postId: "post-1",
          selectedField: "slug",
          selectedBlockIndex: null,
          values: validValues,
        },
        "post-1",
      ),
    ).toBe(false);
    expect(
      isPostPreviewMessage(
        {
          type: "cms:post-preview",
          postId: "post-1",
          selectedField: null,
          selectedBlockIndex: null,
          values: { ...validValues, tags: "rèm" },
        },
        "post-1",
      ),
    ).toBe(false);
    expect(
      isPostPreviewMessage(
        {
          type: "cms:post-preview",
          postId: "post-1",
          selectedField: "title",
          selectedBlockIndex: 0,
          values: validValues,
        },
        "post-1",
      ),
    ).toBe(false);
  });

  test("allows selection only for the exact post field catalog", () => {
    for (const field of postPreviewFields) {
      expect(
        isPostPreviewSelectMessage(
          { type: "cms:post-preview-select", postId: "post-1", field },
          "post-1",
        ),
      ).toBe(true);
    }
    expect(
      isPostPreviewSelectMessage(
        {
          type: "cms:post-preview-select",
          postId: "post-1",
          field: "seoTitle",
        },
        "post-1",
      ),
    ).toBe(false);
    expect(
      isPostPreviewSelectMessage(
        {
          type: "cms:post-preview-select",
          postId: "post-1",
          field: "content",
          blockIndex: 1,
          content: validValues.content,
        },
        "post-1",
      ),
    ).toBe(false);
    expect(
      isPostPreviewSelectMessage(
        {
          type: "cms:post-preview-select",
          postId: "post-1",
          field: "content",
          blockId: "rich-bravo",
          blockIndex: 1,
          content: validValues.content,
        },
        "post-1",
      ),
    ).toBe(true);
    expect(
      isPostPreviewSelectMessage(
        {
          type: "cms:post-preview-select",
          postId: "post-1",
          field: "title",
          blockId: "rich-bravo",
          blockIndex: 1,
          content: validValues.content,
        },
        "post-1",
      ),
    ).toBe(false);
  });

  test("accepts only bounded matching-post composition envelopes", () => {
    expect(
      isPostPreviewCompositionMessage(
        {
          type: "cms:post-preview-compose",
          postId: "post-1",
          content: validValues.content,
          command: {
            type: "move",
            sourceId: "rich-alpha",
            sourceIndex: 0,
            targetId: "rich-bravo",
            targetIndex: 1,
            placement: "after",
          },
        },
        "post-1",
      ),
    ).toBe(true);
    expect(
      isPostPreviewCompositionMessage(
        {
          type: "cms:post-preview-compose",
          postId: "post-2",
          content: validValues.content,
          command: {
            type: "remove",
            targetId: "rich-alpha",
            targetIndex: 0,
          },
        },
        "post-1",
      ),
    ).toBe(false);
    expect(
      isPostPreviewCompositionMessage(
        {
          type: "cms:post-preview-compose",
          postId: "post-1",
          content: validValues.content,
          command: {
            type: "remove",
            targetId: "rich-alpha",
            targetIndex: -1,
          },
        },
        "post-1",
      ),
    ).toBe(false);
    expect(
      isPostPreviewCompositionMessage(
        {
          type: "cms:post-preview-compose",
          postId: "post-1",
          content: validValues.content,
          command: { type: "remove", targetIndex: 0 },
        },
        "post-1",
      ),
    ).toBe(false);
  });
});
