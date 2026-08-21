import { describe, expect, test } from "bun:test";

import {
  arrayField,
  assertCmsRelationshipIntegrity,
  collectCmsRelationshipReferences,
  createCollectionRegistry,
  defineCollection,
  groupField,
  joinField,
  parseCmsCollectionData,
  nullifyCmsRelationshipTarget,
  polymorphicRelationshipField,
  relationshipField,
  serializeCmsCollectionDataForRead,
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
const lifecycle = { drafts: true, revisions: true, scheduling: false } as const;

const authors = defineCollection({
  slug: "authors",
  labels: { singular: "Author", plural: "Authors" },
  schemaVersion: 1,
  lifecycle,
  access,
  fields: [textField({ name: "name", label: "Name", required: true })],
});

const articles = defineCollection({
  slug: "related-articles",
  labels: { singular: "Article", plural: "Articles" },
  schemaVersion: 1,
  lifecycle,
  access,
  fields: [
    textField({ name: "title", label: "Title", required: true }),
    relationshipField({
      name: "primaryAuthor",
      label: "Primary author",
      relationTo: "authors",
      hasMany: false,
      onDelete: "restrict",
      required: true,
    }),
    relationshipField({
      name: "contributors",
      label: "Contributors",
      relationTo: "authors",
      hasMany: true,
      onDelete: "nullify",
      defaultValue: [],
      validation: { maxItems: 4 },
    }),
  ],
});

const topics = defineCollection({
  ...authors,
  slug: "topics",
  labels: { singular: "Topic", plural: "Topics" },
});

const curatedPages = defineCollection({
  ...articles,
  slug: "curated-pages",
  labels: { singular: "Curated page", plural: "Curated pages" },
  fields: [
    textField({ name: "title", label: "Title", required: true }),
    polymorphicRelationshipField({
      name: "featuredContent",
      label: "Featured content",
      relationTo: [authors.slug, topics.slug],
      hasMany: true,
      onDelete: "nullify",
      defaultValue: [],
    }),
  ],
});

const joinedAuthors = defineCollection({
  ...authors,
  slug: "joined-authors",
  fields: [
    textField({ name: "name", label: "Name", required: true }),
    joinField({
      name: "articles",
      label: "Articles",
      relationTo: "joined-articles",
      foreignField: "author",
      hasMany: true,
      resolve: async ({ documentId }) =>
        documentId === "author-1" ? ["article-1", "article-2"] : [],
    }),
  ],
});

const joinedArticles = defineCollection({
  ...articles,
  slug: "joined-articles",
  fields: [
    textField({ name: "title", label: "Title", required: true }),
    relationshipField({
      name: "author",
      label: "Author",
      relationTo: "joined-authors",
      hasMany: false,
      onDelete: "restrict",
      required: true,
    }),
  ],
});

describe("collection relationships", () => {
  test("tracks and nullifies relationships nested in groups and arrays", () => {
    const nested = defineCollection({
      ...articles,
      slug: "nested-related-records",
      fields: [
        groupField({
          name: "metadata",
          label: "Metadata",
          fields: [
            relationshipField({
              name: "owner",
              label: "Owner",
              relationTo: authors.slug,
              hasMany: false,
              onDelete: "nullify",
            }),
          ],
        }),
        arrayField({
          name: "credits",
          label: "Credits",
          fields: [
            relationshipField({
              name: "author",
              label: "Author",
              relationTo: authors.slug,
              hasMany: false,
              onDelete: "nullify",
            }),
          ],
        }),
      ],
    });
    expect(() => createCollectionRegistry([authors, nested])).not.toThrow();
    const data = {
      metadata: { owner: "author-1" },
      credits: [{ author: "author-1" }, { author: "author-2" }],
    };
    expect(
      collectCmsRelationshipReferences(nested, data).map(
        ({ sourceField }) => sourceField,
      ),
    ).toEqual(["metadata.owner", "credits[0].author", "credits[1].author"]);
    expect(
      nullifyCmsRelationshipTarget({
        collection: nested,
        data,
        targetCollection: authors.slug,
        targetId: "author-1",
      }),
    ).toEqual({
      data: {
        metadata: {},
        credits: [{}, { author: "author-2" }],
      },
      changedFields: ["metadata.owner", "credits[0].author"],
    });
  });

  test("resolves validated reverse joins without storing them", async () => {
    expect(() =>
      createCollectionRegistry([joinedAuthors, joinedArticles]),
    ).not.toThrow();
    expect(
      await serializeCmsCollectionDataForRead(
        joinedAuthors,
        { name: "Ada" },
        { actorId: "editor", documentId: "author-1" },
      ),
    ).toEqual({ name: "Ada", articles: ["article-1", "article-2"] });
    expect(() =>
      createCollectionRegistry([
        {
          ...joinedAuthors,
          fields: [
            textField({ name: "name", label: "Name", required: true }),
            joinField({
              name: "broken",
              label: "Broken",
              relationTo: "joined-articles",
              foreignField: "title",
              hasMany: true,
              resolve: async () => [],
            }),
          ],
        },
        joinedArticles,
      ]),
    ).toThrow("requires relationship");
  });

  test("parses, validates, and nullifies polymorphic targets", async () => {
    const registry = createCollectionRegistry([
      authors,
      topics,
      curatedPages,
    ] as const);
    const value: CmsCollectionData<typeof curatedPages> = {
      title: "Mixed references",
      featuredContent: [
        { relationTo: "authors", id: "author-1" },
        { relationTo: "topics", id: "topic-1" },
      ],
    };
    expect(parseCmsCollectionData(curatedPages, value)).toEqual(value);
    expect(collectCmsRelationshipReferences(curatedPages, value)).toEqual([
      expect.objectContaining({
        targetCollection: "authors",
        targetId: "author-1",
      }),
      expect.objectContaining({
        targetCollection: "topics",
        targetId: "topic-1",
      }),
    ]);
    await expect(
      assertCmsRelationshipIntegrity({
        registry,
        collection: curatedPages,
        data: value,
        targetExists: ({ collection, id }) =>
          `${collection}/${id}` !== "topics/topic-1",
      }),
    ).rejects.toThrow("dangling relationship references");
    expect(
      nullifyCmsRelationshipTarget({
        collection: curatedPages,
        data: value,
        targetCollection: "authors",
        targetId: "author-1",
      }),
    ).toEqual({
      data: {
        title: "Mixed references",
        featuredContent: [{ relationTo: "topics", id: "topic-1" }],
      },
      changedFields: ["featuredContent"],
    });
    expect(() => createCollectionRegistry([authors, curatedPages])).toThrow(
      "targets an unregistered collection",
    );
    expect(() =>
      parseCmsCollectionData(curatedPages, {
        title: "Invalid",
        featuredContent: [{ relationTo: "missing", id: "one" }],
      }),
    ).toThrow("failed validation");
  });

  test("types and parses explicit to-one and to-many targets", () => {
    const value: CmsCollectionData<typeof articles> = {
      title: "Relationships",
      primaryAuthor: "author-1",
      contributors: ["author-1", "author-2"],
    };
    expect(parseCmsCollectionData(articles, value)).toEqual(value);
    expect(collectCmsRelationshipReferences(articles, value)).toEqual([
      {
        sourceCollection: "related-articles",
        sourceField: "primaryAuthor",
        targetCollection: "authors",
        targetId: "author-1",
        onDelete: "restrict",
        localeBehavior: "any",
      },
      {
        sourceCollection: "related-articles",
        sourceField: "contributors",
        targetCollection: "authors",
        targetId: "author-1",
        onDelete: "nullify",
        localeBehavior: "any",
      },
      {
        sourceCollection: "related-articles",
        sourceField: "contributors",
        targetCollection: "authors",
        targetId: "author-2",
        onDelete: "nullify",
        localeBehavior: "any",
      },
    ]);
  });

  test("validates every relationship target through a provider-neutral lookup", async () => {
    const registry = createCollectionRegistry([authors, articles] as const);
    const references = await assertCmsRelationshipIntegrity({
      registry,
      collection: articles,
      data: {
        title: "Valid",
        primaryAuthor: "author-1",
        contributors: ["author-2"],
      },
      targetExists: ({ id }) => ["author-1", "author-2"].includes(id),
    });
    expect(references).toHaveLength(2);

    await expect(
      assertCmsRelationshipIntegrity({
        registry,
        collection: articles,
        data: { title: "Dangling", primaryAuthor: "missing" },
        targetExists: () => false,
      }),
    ).rejects.toThrow("dangling relationship references");
  });

  test("provides deterministic nullification for provider delete transactions", () => {
    expect(
      nullifyCmsRelationshipTarget({
        collection: articles,
        data: {
          title: "Clean references",
          primaryAuthor: "author-1",
          contributors: ["author-1", "author-2"],
        },
        targetCollection: "authors",
        targetId: "author-2",
      }),
    ).toEqual({
      data: {
        title: "Clean references",
        primaryAuthor: "author-1",
        contributors: ["author-1"],
      },
      changedFields: ["contributors"],
    });
  });

  test("rejects unregistered targets and unsafe nullification contracts", () => {
    expect(() => createCollectionRegistry([articles])).toThrow(
      "targets an unregistered collection",
    );
    expect(() =>
      relationshipField({
        name: "owner",
        label: "Owner",
        relationTo: "authors",
        hasMany: false,
        onDelete: "nullify",
        required: true,
      }),
    ).toThrow("cannot use nullify");
  });

  test("requires valid locale behavior for localized relationship targets", () => {
    const localizedAuthors = defineCollection({
      ...authors,
      slug: "localized-authors",
      localization: {
        locales: ["vi-VN", "en-US"],
        defaultLocale: "vi-VN",
      },
      fields: [
        textField({
          name: "name",
          label: "Name",
          required: true,
          localized: true,
        }),
      ],
    });
    const localizedArticles = defineCollection({
      ...articles,
      slug: "localized-related-articles",
      localization: localizedAuthors.localization,
      fields: [
        textField({
          name: "title",
          label: "Title",
          required: true,
          localized: true,
        }),
        relationshipField({
          name: "author",
          label: "Author",
          relationTo: localizedAuthors.slug,
          hasMany: false,
          required: true,
          onDelete: "restrict",
          localeBehavior: "same",
        }),
      ],
    });
    expect(() =>
      createCollectionRegistry([localizedAuthors, localizedArticles]),
    ).not.toThrow();
    const implicit = defineCollection({
      ...localizedArticles,
      slug: "implicit-locale-articles",
      fields: [
        relationshipField({
          name: "author",
          label: "Author",
          relationTo: localizedAuthors.slug,
          hasMany: false,
          required: true,
          onDelete: "restrict",
        }),
      ],
    });
    expect(() =>
      createCollectionRegistry([localizedAuthors, implicit]),
    ).toThrow("must declare locale behavior");
  });
});
