import { describe, expect, test } from "bun:test";

import {
  arrayField,
  blocksField,
  booleanField,
  codeField,
  colorField,
  composeCmsFieldGroups,
  computedField,
  CmsError,
  dateField,
  defineCollection,
  defineCmsFieldGroup,
  emailField,
  extendCmsFieldGroup,
  groupField,
  isCmsFieldVisible,
  jsonField,
  mediaField,
  migrateCollectionData,
  numberField,
  parseCmsCollectionData,
  parseCmsCollectionDataAsync,
  pointField,
  richTextField,
  selectField,
  slugField,
  serializeCmsCollectionDataForRead,
  textField,
  toCmsCanonicalCollectionData,
  urlField,
  virtualField,
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

const fieldV2Records = defineCollection({
  slug: "field-v2-records",
  labels: { singular: "Field record", plural: "Field records" },
  schemaVersion: 1,
  lifecycle: { drafts: true, revisions: true, scheduling: false },
  access,
  fields: [
    emailField({ name: "email", label: "Email", required: true }),
    urlField({ name: "website", label: "Website", required: true }),
    slugField({ name: "slug", label: "Slug", required: true }),
    codeField({
      name: "snippet",
      label: "Snippet",
      language: "typescript",
      required: true,
      validation: { maxLength: 100 },
    }),
    jsonField({ name: "metadata", label: "Metadata", required: true }),
    colorField({ name: "brandColor", label: "Brand color", required: true }),
    colorField({
      name: "overlayColor",
      label: "Overlay color",
      alpha: true,
      required: true,
    }),
    pointField({ name: "location", label: "Location", required: true }),
  ],
});

const structuredRecords = defineCollection({
  slug: "structured-records",
  labels: { singular: "Structured record", plural: "Structured records" },
  schemaVersion: 1,
  lifecycle: { drafts: true, revisions: true, scheduling: false },
  access,
  fields: [
    groupField({
      name: "address",
      label: "Address",
      required: true,
      fields: [
        textField({ name: "street", label: "Street", required: true }),
        colorField({
          name: "markerColor",
          label: "Marker color",
          defaultValue: "#000000",
        }),
      ],
    }),
    arrayField({
      name: "contributors",
      label: "Contributors",
      required: true,
      validation: { minItems: 1, maxItems: 3 },
      fields: [
        selectField({
          name: "kind",
          label: "Kind",
          multiple: false,
          required: true,
          options: [
            { label: "Staff", value: "staff" },
            { label: "Guest", value: "guest" },
          ] as const,
        }),
        textField({ name: "name", label: "Name", required: true }),
        textField({
          name: "organization",
          label: "Organization",
          required: true,
          visibleWhen: { field: "kind", equals: "guest" },
        }),
      ],
    }),
  ],
});

describe("typed CMS fields", () => {
  test("composes reusable typed field groups without duplicate schema keys", () => {
    const identity = defineCmsFieldGroup({
      id: "identity",
      fields: [
        textField({ name: "title", label: "Title", required: true }),
        slugField({ name: "slug", label: "Slug", required: true }),
      ],
    });
    const seo = extendCmsFieldGroup(identity, {
      id: "identity-seo",
      fields: [
        textField({ name: "seoTitle", label: "SEO title", required: true }),
      ],
    });
    const flags = defineCmsFieldGroup({
      id: "flags",
      fields: [
        booleanField({
          name: "featured",
          label: "Featured",
          defaultValue: false,
        }),
      ],
    });
    const composed = defineCollection({
      slug: "composed-records",
      labels: { singular: "Composed record", plural: "Composed records" },
      schemaVersion: 1,
      lifecycle: { drafts: true, revisions: true, scheduling: false },
      access,
      fields: composeCmsFieldGroups(seo, flags),
    });
    const typed: CmsCollectionData<typeof composed> = {
      title: "Reusable",
      slug: "reusable",
      seoTitle: "Reusable fields",
    };
    expect(parseCmsCollectionData(composed, typed)).toEqual({
      ...typed,
      featured: false,
    });
    expect(() =>
      composeCmsFieldGroups(
        identity,
        defineCmsFieldGroup({
          id: "duplicate-title",
          fields: [textField({ name: "title", label: "Duplicate" })],
        }),
      ),
    ).toThrow('duplicate field "title"');
  });

  test("computes stored fields and resolves virtual fields without trusting input", async () => {
    const derived = defineCollection({
      slug: "derived-records",
      labels: { singular: "Derived record", plural: "Derived records" },
      schemaVersion: 1,
      lifecycle: { drafts: true, revisions: true, scheduling: false },
      access,
      fields: [
        textField({ name: "title", label: "Title", required: true }),
        numberField({ name: "wordCount", label: "Word count", required: true }),
        computedField({
          name: "searchLabel",
          label: "Search label",
          valueKind: "text",
          compute: async ({ data }) =>
            `${String(data.title).trim()} (${String(data.wordCount)} words)`,
        }),
        virtualField({
          name: "readingMinutes",
          label: "Reading minutes",
          valueKind: "number",
          resolve: async ({ data }) =>
            Math.max(1, Math.ceil(Number(data.wordCount) / 200)),
        }),
      ],
    });
    const parsed = await parseCmsCollectionDataAsync(
      derived,
      {
        title: " Launch ",
        wordCount: 401,
        searchLabel: "spoofed",
        readingMinutes: 999,
      },
      { operation: "create", actorId: "editor" },
    );
    expect(parsed).toEqual({
      title: " Launch ",
      wordCount: 401,
      searchLabel: "Launch (401 words)",
    });
    const readable = await serializeCmsCollectionDataForRead(derived, parsed, {
      actorId: "editor",
    });
    expect(readable).toEqual({ ...parsed, readingMinutes: 3 });
    expect(toCmsCanonicalCollectionData(derived, readable)).toEqual(parsed);
  });

  test("runs field access, hooks, and async validation with redacted paths", async () => {
    const calls: string[] = [];
    const secured = defineCollection({
      slug: "secured-records",
      labels: { singular: "Secured record", plural: "Secured records" },
      schemaVersion: 1,
      lifecycle: { drafts: true, revisions: true, scheduling: false },
      access,
      fields: [
        slugField({
          name: "slug",
          label: "Slug",
          required: true,
          hooks: {
            beforeValidate: async (value) => {
              calls.push("before");
              return String(value).trim().toLowerCase();
            },
            afterValidate: async (value, context) => {
              calls.push(`after:${value}:${context.path.join(".")}`);
            },
          },
          validateAsync: async (value) =>
            value === "reserved" ? "This slug is reserved." : true,
        }),
        textField({
          name: "privateNote",
          label: "Private note",
          access: {
            read: ({ actorId }) => actorId === "administrator",
            create: ({ actorId }) => actorId === "administrator",
            update: ({ actorId }) => actorId === "administrator",
          },
        }),
        groupField({
          name: "profile",
          label: "Profile",
          required: true,
          fields: [
            textField({
              name: "handle",
              label: "Handle",
              required: true,
              validateAsync: async (value) =>
                value.length >= 3 ? true : "Handle is too short.",
            }),
          ],
        }),
      ],
    });

    const parsed = await parseCmsCollectionDataAsync(
      secured,
      { slug: " Launch ", profile: { handle: "valid" } },
      { operation: "create", actorId: "editor", documentId: "record-1" },
    );
    expect(parsed).toEqual({ slug: "launch", profile: { handle: "valid" } });
    expect(calls).toEqual(["before", "after:launch:slug"]);

    await expect(
      parseCmsCollectionDataAsync(
        secured,
        { slug: "reserved", profile: { handle: "x" } },
        { operation: "create", actorId: "editor" },
      ),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      details: {
        issues: expect.arrayContaining([
          { path: ["slug"], message: "This slug is reserved." },
          { path: ["profile", "handle"], message: "Handle is too short." },
        ]),
      },
    });
    await expect(
      parseCmsCollectionDataAsync(
        secured,
        {
          slug: "launch",
          privateNote: "changed",
          profile: { handle: "valid" },
        },
        {
          operation: "update",
          actorId: "editor",
          previousData: {
            slug: "launch",
            privateNote: "original",
            profile: { handle: "valid" },
          },
        },
      ),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      details: { path: ["privateNote"] },
    });
    expect(
      await parseCmsCollectionDataAsync(
        secured,
        { slug: "launch", profile: { handle: "valid" } },
        {
          operation: "update",
          actorId: "editor",
          previousData: {
            slug: "launch",
            privateNote: "original",
            profile: { handle: "valid" },
          },
        },
      ),
    ).toEqual({
      slug: "launch",
      privateNote: "original",
      profile: { handle: "valid" },
    });

    const stored = {
      slug: "launch",
      privateNote: "server-only",
      profile: { handle: "valid" },
    };
    expect(
      await serializeCmsCollectionDataForRead(secured, stored, {
        actorId: "editor",
      }),
    ).toEqual({ slug: "launch", profile: { handle: "valid" } });
    expect(
      await serializeCmsCollectionDataForRead(secured, stored, {
        actorId: "administrator",
      }),
    ).toEqual(stored);
  });

  test("infers nested groups and arrays and applies nested defaults", () => {
    const input: CmsCollectionData<typeof structuredRecords> = {
      address: { street: "1 Nguyễn Huệ" },
      contributors: [{ kind: "staff", name: "Nam" }],
    };
    expect(parseCmsCollectionData(structuredRecords, input)).toEqual({
      address: { street: "1 Nguyễn Huệ", markerColor: "#000000" },
      contributors: [{ kind: "staff", name: "Nam" }],
    });
  });

  test("reports nested paths, bounds, strict keys, and conditional requirements", () => {
    try {
      parseCmsCollectionData(structuredRecords, {
        address: { street: "Valid", unknown: true },
        contributors: [{ kind: "guest", name: "Ada" }],
      });
      throw new Error("Expected validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(CmsError);
      const issues = (error as CmsError).details?.issues as Array<{
        path: Array<string | number>;
      }>;
      expect(issues.map((issue) => issue.path)).toEqual(
        expect.arrayContaining([
          ["address", "unknown"],
          ["contributors", 0, "organization"],
        ]),
      );
    }
  });

  test("parses portable scalar field v2 values", () => {
    const input: CmsCollectionData<typeof fieldV2Records> = {
      email: "editor@example.com",
      website: "https://example.com/articles/launch",
      slug: "launch-story",
      snippet: "export const launched = true;",
      metadata: { campaign: "launch", channels: ["web", "email"] },
      brandColor: "#c8a96b",
      overlayColor: "#00000080",
      location: { latitude: 10.7769, longitude: 106.7009 },
    };
    expect(parseCmsCollectionData(fieldV2Records, input)).toEqual(input);
  });

  test("migrates a v1 record into a validated Field v2 schema", () => {
    const migratedRecords = defineCollection({
      slug: "migrated-field-v2-records",
      labels: { singular: "Migrated record", plural: "Migrated records" },
      schemaVersion: 2,
      lifecycle: { drafts: true, revisions: true, scheduling: false },
      access,
      fields: [
        emailField({ name: "email", label: "Email", required: true }),
        urlField({ name: "website", label: "Website", required: true }),
        slugField({ name: "slug", label: "Slug", required: true }),
        jsonField({ name: "metadata", label: "Metadata", required: true }),
        pointField({ name: "location", label: "Location", required: true }),
      ],
      migrations: [
        {
          from: 1,
          to: 2,
          migrate: (value) => {
            const legacy = value as {
              contact: string;
              homepage: string;
              path: string;
              latitude: number;
              longitude: number;
            };
            return {
              email: legacy.contact,
              website: legacy.homepage,
              slug: legacy.path.replace(/^\/+|\/+$/g, ""),
              metadata: { migratedFrom: 1 },
              location: {
                latitude: legacy.latitude,
                longitude: legacy.longitude,
              },
            };
          },
        },
      ],
    });
    const migrated = migrateCollectionData(
      migratedRecords,
      {
        contact: "legacy@example.com",
        homepage: "https://example.com/legacy",
        path: "/legacy-record/",
        latitude: 10.7769,
        longitude: 106.7009,
      },
      1,
    );
    expect(parseCmsCollectionData(migratedRecords, migrated)).toEqual({
      email: "legacy@example.com",
      website: "https://example.com/legacy",
      slug: "legacy-record",
      metadata: { migratedFrom: 1 },
      location: { latitude: 10.7769, longitude: 106.7009 },
    });
  });

  test("rejects unsafe or malformed scalar field v2 values", () => {
    expect(() =>
      parseCmsCollectionData(fieldV2Records, {
        email: "not-an-email",
        website: "javascript:alert(1)",
        slug: "Not A Slug",
        snippet: "x".repeat(101),
        metadata: { invalid: undefined },
        brandColor: "red",
        overlayColor: "#000000",
        location: { latitude: 91, longitude: 181 },
      }),
    ).toThrow(CmsError);
  });

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
