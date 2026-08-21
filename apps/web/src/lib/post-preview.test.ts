import { describe, expect, test } from "bun:test";

import {
  isPostPreviewCompositionCommand,
  isPostPreviewSelectCommand,
  isPostPreviewState,
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
      isPostPreviewState(
        {
          postId: "post-1",
          revision: 3,
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
      isPostPreviewState(
        {
          postId: "post-2",
          revision: 3,
          selectedField: null,
          selectedBlockIndex: null,
          values: validValues,
        },
        "post-1",
      ),
    ).toBe(false);
    expect(
      isPostPreviewState(
        {
          postId: "post-1",
          revision: 3,
          selectedField: "slug",
          selectedBlockIndex: null,
          values: validValues,
        },
        "post-1",
      ),
    ).toBe(false);
    expect(
      isPostPreviewState(
        {
          postId: "post-1",
          revision: 3,
          selectedField: null,
          selectedBlockIndex: null,
          values: { ...validValues, tags: "rèm" },
        },
        "post-1",
      ),
    ).toBe(false);
    expect(
      isPostPreviewState(
        {
          postId: "post-1",
          revision: 3,
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
      expect(isPostPreviewSelectCommand({ type: "select", field })).toBe(true);
    }
    expect(
      isPostPreviewSelectCommand({
        type: "select",
        field: "seoTitle",
      }),
    ).toBe(false);
    expect(
      isPostPreviewSelectCommand({
        type: "select",
        field: "content",
        blockIndex: 1,
        content: validValues.content,
      }),
    ).toBe(false);
    expect(
      isPostPreviewSelectCommand({
        type: "select",
        field: "content",
        blockId: "rich-bravo",
        blockIndex: 1,
        content: validValues.content,
      }),
    ).toBe(true);
    expect(
      isPostPreviewSelectCommand({
        type: "select",
        field: "title",
        blockId: "rich-bravo",
        blockIndex: 1,
        content: validValues.content,
      }),
    ).toBe(false);
  });

  test("accepts only bounded matching-post composition envelopes", () => {
    expect(
      isPostPreviewCompositionCommand({
        type: "compose",
        content: validValues.content,
        command: {
          type: "move",
          sourceId: "rich-alpha",
          sourceIndex: 0,
          targetId: "rich-bravo",
          targetIndex: 1,
          placement: "after",
        },
      }),
    ).toBe(true);
    expect(
      isPostPreviewCompositionCommand({
        type: "compose",
        content: validValues.content,
        command: {
          type: "remove",
          targetId: "rich-alpha",
          targetIndex: 0,
        },
      }),
    ).toBe(true);
    expect(
      isPostPreviewCompositionCommand({
        type: "compose",
        content: validValues.content,
        command: {
          type: "remove",
          targetId: "rich-alpha",
          targetIndex: -1,
        },
      }),
    ).toBe(false);
    expect(
      isPostPreviewCompositionCommand({
        type: "compose",
        content: validValues.content,
        command: { type: "remove", targetIndex: 0 },
      }),
    ).toBe(false);
  });
});
