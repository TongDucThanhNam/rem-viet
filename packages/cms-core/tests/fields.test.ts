import { describe, expect, test } from "bun:test";

import {
  blocksField,
  booleanField,
  CmsError,
  dateField,
  defineCollection,
  isCmsFieldVisible,
  mediaField,
  numberField,
  parseCmsCollectionData,
  richTextField,
  selectField,
  textField,
  type CmsCollectionData,
} from "../src";

const access = {
  read: [] as const,
  create: ["content.write"] as const,
  update: ["content.write"] as const,
  delete: ["content.delete"] as const,
  publish: ["content.publish"] as const,
};

const articles = defineCollection({
  slug: "typed-articles",
  labels: { singular: "Article", plural: "Articles" },
  schemaVersion: 1,
  lifecycle: { drafts: true, revisions: true, scheduling: true },
  access,
  fields: [
    textField({
      name: "title",
      label: "Title",
      required: true,
      validation: { minLength: 3, maxLength: 80 },
    }),
    numberField({
      name: "priority",
      label: "Priority",
      defaultValue: 0,
      validation: { integer: true, min: 0, max: 10 },
    }),
    booleanField({
      name: "featured",
      label: "Featured",
      defaultValue: false,
    }),
    dateField({
      name: "eventDate",
      label: "Event date",
      mode: "date",
    }),
    richTextField({
      name: "body",
      label: "Body",
      required: true,
      validation: { minBlocks: 1, allowedBlocks: ["paragraph", "heading"] },
    }),
    mediaField({
      name: "gallery",
      label: "Gallery",
      multiple: true,
      defaultValue: [],
      validation: { maxItems: 3 },
      acceptedMimeTypes: ["image/*"],
    }),
    blocksField({
      name: "sections",
      label: "Sections",
      allowedBlocks: ["hero", "cta"],
      defaultValue: [],
    }),
    selectField({
      name: "audience",
      label: "Audience",
      multiple: false,
      required: true,
      options: [
        { label: "Public", value: "public" },
        { label: "Members", value: "members" },
      ] as const,
      defaultValue: "public",
    }),
    textField({
      name: "memberNote",
      label: "Member note",
      required: true,
      visibleWhen: { field: "audience", equals: "members" },
    }),
  ],
});

describe("typed CMS fields", () => {
  test("infers and validates every built-in field through one parser", () => {
    const input: CmsCollectionData<typeof articles> = {
      title: "Launch story",
      body: {
        version: 1,
        blocks: [{ type: "paragraph", children: [{ text: "Hello" }] }],
      },
      audience: "public",
      eventDate: "2026-08-17",
    };
    expect(parseCmsCollectionData(articles, input)).toEqual({
      title: "Launch story",
      priority: 0,
      featured: false,
      eventDate: "2026-08-17",
      body: input.body,
      gallery: [],
      sections: [],
      audience: "public",
    });
  });

  test("shares constraints, defaults, strict keys, and conditional requiredness", () => {
    expect(() =>
      parseCmsCollectionData(articles, {
        title: "No",
        body: { version: 1, blocks: [{ type: "script" }] },
        audience: "members",
        priority: 1.5,
        unknown: true,
      }),
    ).toThrow(CmsError);

    try {
      parseCmsCollectionData(articles, {
        title: "No",
        body: { version: 1, blocks: [{ type: "script" }] },
        audience: "members",
        priority: 1.5,
        unknown: true,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(CmsError);
      const issues = (error as CmsError).details?.issues as Array<{
        path: string[];
      }>;
      expect(issues.map((issue) => issue.path[0])).toEqual(
        expect.arrayContaining([
          "unknown",
          "title",
          "body",
          "priority",
          "memberNote",
        ]),
      );
    }
  });

  test("exposes deterministic visibility metadata for generated admin UI", () => {
    const note = articles.fields.find((field) => field.name === "memberNote")!;
    expect(isCmsFieldVisible(note, { audience: "public" })).toBe(false);
    expect(isCmsFieldVisible(note, { audience: "members" })).toBe(true);
  });

  test("rejects invalid defaults, duplicate options, and visibility targets", () => {
    expect(() =>
      numberField({
        name: "rank",
        label: "Rank",
        defaultValue: 11,
        validation: { max: 10 },
      }),
    ).toThrow("Invalid default value");
    expect(() =>
      selectField({
        name: "status",
        label: "Status",
        multiple: false,
        options: [
          { label: "One", value: "same" },
          { label: "Two", value: "same" },
        ] as const,
      }),
    ).toThrow("unique options");
    expect(() =>
      defineCollection({
        ...articles,
        fields: [
          textField({
            name: "orphan",
            label: "Orphan",
            visibleWhen: { field: "missing", equals: true },
          }),
        ],
      }),
    ).toThrow("invalid visibility dependency");
  });
});
