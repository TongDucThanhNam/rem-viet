import { describe, expect, test } from "bun:test";

import {
  arrayField,
  computedField,
  createCollectionRegistry,
  defineCollection,
  groupField,
  polymorphicRelationshipField,
  relationshipField,
  textField,
  virtualField,
} from "@agency/cms-core";
import {
  importCmsContent,
  runCollectionProviderConformance,
} from "@agency/cms-runtime";

import {
  applyLocalCmsMigrations,
  createLocalCmsCollectionProvider,
  createLocalCmsDatabase,
} from "../src";

const pages = defineCollection({
  slug: "pages",
  labels: { singular: "Page", plural: "Pages" },
  schemaVersion: 1,
  fields: [
    textField({ name: "title", label: "Title", required: true }),
    textField({
      name: "slug",
      label: "Slug",
      required: true,
      unique: true,
      indexed: true,
    }),
  ],
  lifecycle: { drafts: true, revisions: true, scheduling: true },
  access: {
    read: ["content.readDraft"],
    create: ["content.write"],
    update: ["content.write"],
    delete: ["content.delete"],
    publish: ["content.publish"],
  },
});
const registry = createCollectionRegistry([pages]);

const relatedAuthors = defineCollection({
  ...pages,
  slug: "related-authors",
  labels: { singular: "Author", plural: "Authors" },
  lifecycle: { ...pages.lifecycle, scheduling: false },
  fields: [textField({ name: "name", label: "Name", required: true })],
});
const relatedTopics = defineCollection({
  ...relatedAuthors,
  slug: "related-topics",
  labels: { singular: "Topic", plural: "Topics" },
});
const relationalPages = defineCollection({
  ...pages,
  slug: "relational-pages",
  lifecycle: { ...pages.lifecycle, scheduling: false },
  fields: [
    textField({ name: "title", label: "Title", required: true }),
    groupField({
      name: "metadata",
      label: "Metadata",
      required: true,
      fields: [
        relationshipField({
          name: "owner",
          label: "Owner",
          relationTo: relatedAuthors.slug,
          hasMany: false,
          required: true,
          onDelete: "restrict",
        }),
      ],
    }),
    arrayField({
      name: "credits",
      label: "Credits",
      defaultValue: [],
      fields: [
        polymorphicRelationshipField({
          name: "subject",
          label: "Subject",
          relationTo: [relatedAuthors.slug, relatedTopics.slug],
          hasMany: false,
          onDelete: "nullify",
        }),
      ],
    }),
  ],
});
const relationalRegistry = createCollectionRegistry([
  relatedAuthors,
  relatedTopics,
  relationalPages,
]);

function temporaryDatabase() {
  return createLocalCmsDatabase({ url: "file::memory:?cache=shared" });
}

describe("local SQLite/libSQL collection provider", () => {
  test("enforces nested relationship integrity, deletion policy, restore safety, and atomic imports", async () => {
    const database = temporaryDatabase();
    await applyLocalCmsMigrations(database);
    let sequence = 0;
    const provider = createLocalCmsCollectionProvider({
      database,
      registry: relationalRegistry,
      createId: () => `relation-${++sequence}`,
      now: () => new Date("2026-08-21T00:00:00.000Z"),
    });
    const relatedData = {
      title: "Relational page",
      metadata: { owner: "author-1" },
      credits: [
        {
          subject: { relationTo: relatedTopics.slug, id: "topic-1" },
        },
      ],
    };

    await expect(
      provider.createDraft({
        collection: relationalPages.slug,
        id: "dangling-page",
        data: relatedData,
        actorId: "editor",
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      details: {
        dangling: [
          expect.objectContaining({ sourceField: "metadata.owner" }),
          expect.objectContaining({ sourceField: "credits[0].subject" }),
        ],
      },
    });
    await provider.createDraft({
      collection: relatedAuthors.slug,
      id: "author-1",
      data: { name: "Ada" },
      actorId: "editor",
    });
    const topic = await provider.createDraft({
      collection: relatedTopics.slug,
      id: "topic-1",
      data: { name: "Architecture" },
      actorId: "editor",
    });
    const page = await provider.createDraft({
      collection: relationalPages.slug,
      id: "page-1",
      data: relatedData,
      actorId: "editor",
    });
    await expect(
      provider.saveDraft({
        collection: relationalPages.slug,
        id: page.id,
        expectedVersion: page.version,
        data: {
          ...relatedData,
          metadata: { owner: "missing-author" },
        },
        actorId: "editor",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });

    const published = await provider.publish({
      collection: relationalPages.slug,
      id: page.id,
      expectedVersion: page.version,
      actorId: "publisher",
    });
    const unpublished = await provider.unpublish({
      collection: relationalPages.slug,
      id: page.id,
      expectedVersion: published.document.version,
      actorId: "publisher",
    });
    await provider.delete({
      collection: relatedTopics.slug,
      id: topic.id,
      expectedVersion: topic.version,
      actorId: "editor",
    });
    const nullified = await provider.getDraft({
      collection: relationalPages.slug,
      id: page.id,
    });
    expect(nullified).toMatchObject({
      version: unpublished.version + 1,
      data: { credits: [{}] },
    });
    await expect(
      provider.restore({
        collection: relationalPages.slug,
        id: page.id,
        expectedVersion: nullified!.version,
        revisionId: published.revision.id,
        actorId: "editor",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    const author = await provider.getDraft({
      collection: relatedAuthors.slug,
      id: "author-1",
    });
    await expect(
      provider.delete({
        collection: relatedAuthors.slug,
        id: "author-1",
        expectedVersion: author!.version,
        actorId: "editor",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    database.close();

    const importDatabase = temporaryDatabase();
    await applyLocalCmsMigrations(importDatabase);
    const importProvider = createLocalCmsCollectionProvider({
      database: importDatabase,
      registry: relationalRegistry,
      createId: () => `import-${++sequence}`,
      now: () => new Date("2026-08-21T01:00:00.000Z"),
    });
    const imported = await importCmsContent({
      provider: importProvider,
      actorId: "importer",
      bundle: {
        schemaVersion: 1,
        registry: [relatedAuthors, relatedTopics, relationalPages].map(
          (collection) => ({
            slug: collection.slug,
            schemaVersion: collection.schemaVersion,
            locales: [],
            defaultLocale: null,
          }),
        ),
        documents: [
          {
            collection: relationalPages.slug,
            id: "imported-page",
            locale: null,
            schemaVersion: 1,
            expectedVersion: null,
            data: {
              title: "Forward references",
              metadata: { owner: "imported-author" },
              credits: [
                {
                  subject: {
                    relationTo: relatedTopics.slug,
                    id: "imported-topic",
                  },
                },
              ],
            },
            publishedData: null,
            scheduledAt: null,
          },
          {
            collection: relatedAuthors.slug,
            id: "imported-author",
            locale: null,
            schemaVersion: 1,
            expectedVersion: null,
            data: { name: "Imported author" },
            publishedData: null,
            scheduledAt: null,
          },
          {
            collection: relatedTopics.slug,
            id: "imported-topic",
            locale: null,
            schemaVersion: 1,
            expectedVersion: null,
            data: { name: "Imported topic" },
            publishedData: null,
            scheduledAt: null,
          },
        ],
      },
    });
    expect(imported).toMatchObject({ applied: true, conflicts: [] });
    await expect(
      importProvider.getDraft({
        collection: relationalPages.slug,
        id: "imported-page",
      }),
    ).resolves.toMatchObject({ data: { title: "Forward references" } });
    importDatabase.close();
  });

  test("enforces async field lifecycle and read access at the provider boundary", async () => {
    const securedPages = defineCollection({
      ...pages,
      slug: "secured-pages",
      fields: [
        textField({
          name: "title",
          label: "Title",
          required: true,
          hooks: {
            beforeValidate: async (value) => String(value).trim(),
          },
          validateAsync: async (value) =>
            value === "Rejected" ? "Title is reserved." : true,
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
        computedField({
          name: "titleLength",
          label: "Title length",
          valueKind: "number",
          compute: async ({ data }) => String(data.title ?? "").trim().length,
        }),
        virtualField({
          name: "viewer",
          label: "Viewer",
          valueKind: "text",
          resolve: async ({ actorId }) => actorId ?? "anonymous",
        }),
      ],
    });
    const database = temporaryDatabase();
    await applyLocalCmsMigrations(database);
    const provider = createLocalCmsCollectionProvider({
      database,
      registry: createCollectionRegistry([securedPages]),
    });

    await expect(
      provider.createDraft({
        collection: securedPages.slug,
        id: "rejected",
        data: { title: "Rejected" },
        actorId: "administrator",
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      details: { issues: [{ path: ["title"], message: "Title is reserved." }] },
    });
    await expect(
      provider.createDraft({
        collection: securedPages.slug,
        id: "forbidden",
        data: { title: "Valid", privateNote: "secret" },
        actorId: "editor",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const created = await provider.createDraft({
      collection: securedPages.slug,
      id: "home",
      data: { title: "  Home  ", privateNote: "secret" },
      actorId: "administrator",
    });
    expect(created.data).toEqual({
      title: "Home",
      privateNote: "secret",
      titleLength: 4,
      viewer: "administrator",
    });
    expect(
      (
        await provider.getDraft({
          collection: securedPages.slug,
          id: "home",
          actorId: "editor",
        })
      )?.data,
    ).toEqual({ title: "Home", titleLength: 4, viewer: "editor" });
    await expect(
      provider.list({
        collection: securedPages.slug,
        actorId: "editor",
        filters: [
          { field: "privateNote", operator: "equals", value: "secret" },
        ],
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const saved = await provider.saveDraft({
      collection: securedPages.slug,
      id: "home",
      expectedVersion: created.version,
      data: { title: "Updated" },
      actorId: "editor",
    });
    expect(saved.data).toEqual({
      title: "Updated",
      titleLength: 7,
      viewer: "editor",
    });
    expect(
      (
        await provider.getDraft({
          collection: securedPages.slug,
          id: "home",
          actorId: "administrator",
        })
      )?.data,
    ).toEqual({
      title: "Updated",
      privateNote: "secret",
      titleLength: 7,
      viewer: "administrator",
    });
    database.close();
  });

  test("passes the provider-neutral lifecycle conformance suite and persists", async () => {
    const database = temporaryDatabase();
    await applyLocalCmsMigrations(database);
    let id = 0;
    const provider = createLocalCmsCollectionProvider({
      database,
      registry,
      createId: () => `local-${++id}`,
      now: () => new Date("2026-08-20T00:00:00.000Z"),
    });
    const evidence = await runCollectionProviderConformance({
      provider,
      collection: "pages",
      documentId: "home",
      initial: { title: "Home", slug: "home" },
      changed: { title: "Changed", slug: "home" },
      filter: { field: "slug", operator: "equals", value: "home" },
    });
    expect(evidence).toEqual({
      draftIsolation: true,
      filteredPagination: true,
      optimisticConflict: true,
      publish: true,
      revisionRestore: true,
      scheduling: true,
    });
    const expected = await provider.getDraft({
      collection: "pages",
      id: "home",
    });
    const persisted = await createLocalCmsCollectionProvider({
      database,
      registry,
    }).getDraft({ collection: "pages", id: "home" });
    expect(persisted).toEqual(expected);
    database.close();
  });

  test("keeps uniqueness and bearer-independent provider authorization fail closed", async () => {
    const database = temporaryDatabase();
    await applyLocalCmsMigrations(database);
    const provider = createLocalCmsCollectionProvider({
      database,
      registry,
      authorize: ({ actorId }) => {
        if (actorId !== "allowed") throw new Error("denied");
      },
    });
    await expect(
      provider.createDraft({
        collection: "pages",
        id: "one",
        data: { title: "One", slug: "same" },
        actorId: "denied",
      }),
    ).rejects.toThrow("denied");
    await provider.createDraft({
      collection: "pages",
      id: "one",
      data: { title: "One", slug: "same" },
      actorId: "allowed",
    });
    await expect(
      provider.createDraft({
        collection: "pages",
        id: "two",
        data: { title: "Two", slug: "same" },
        actorId: "allowed",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    database.close();
  });
});
