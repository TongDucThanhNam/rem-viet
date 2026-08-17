import { describe, expect, test } from "bun:test";

import {
  assertCmsRelationshipIntegrity,
  collectCmsRelationshipReferences,
  createCollectionRegistry,
  defineCollection,
  parseCmsCollectionData,
  nullifyCmsRelationshipTarget,
  relationshipField,
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

describe("collection relationships", () => {
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
      },
      {
        sourceCollection: "related-articles",
        sourceField: "contributors",
        targetCollection: "authors",
        targetId: "author-1",
        onDelete: "nullify",
      },
      {
        sourceCollection: "related-articles",
        sourceField: "contributors",
        targetCollection: "authors",
        targetId: "author-2",
        onDelete: "nullify",
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
});
