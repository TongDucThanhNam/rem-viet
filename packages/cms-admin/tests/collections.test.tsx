import { describe, expect, test } from "bun:test";
import {
  createCollectionRegistry,
  defineCollection,
  relationshipField,
  selectField,
  textField,
} from "@agency/cms-core";
import { renderToStaticMarkup } from "react-dom/server";

import {
  CmsCollectionAdminShell,
  createCollectionFieldControlRegistry,
  validateCmsCollectionAdminData,
  type CmsCollectionFieldControlProps,
} from "../src";

const access = {
  read: [] as const,
  create: ["content.write"] as const,
  update: ["content.write"] as const,
  delete: ["content.delete"] as const,
  publish: ["content.publish"] as const,
};
const lifecycle = { drafts: true, revisions: true, scheduling: true } as const;
const authors = defineCollection({
  slug: "admin-authors",
  labels: { singular: "Author", plural: "Authors" },
  schemaVersion: 1,
  lifecycle,
  access,
  fields: [textField({ name: "name", label: "Name", required: true })],
  admin: { useAsTitle: "name", defaultColumns: ["name"] },
});
const articles = defineCollection({
  slug: "admin-articles",
  labels: { singular: "Article", plural: "Articles" },
  schemaVersion: 1,
  lifecycle,
  access,
  fields: [
    textField({
      name: "title",
      label: "Title",
      required: true,
      indexed: true,
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
    }),
    textField({
      name: "memberNote",
      label: "Member note",
      required: true,
      visibleWhen: { field: "audience", equals: "members" },
    }),
    relationshipField({
      name: "author",
      label: "Author",
      relationTo: "admin-authors",
      hasMany: false,
      required: true,
      onDelete: "restrict",
    }),
  ],
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "audience", "author"],
  },
});
const registry = createCollectionRegistry([authors, articles] as const);

const localizedArticles = defineCollection({
  ...articles,
  slug: "localized-admin-articles",
  labels: { singular: "Localized article", plural: "Localized articles" },
  localization: {
    locales: ["vi-VN", "en-US"],
    defaultLocale: "vi-VN",
  },
  fields: [
    textField({ name: "slug", label: "Slug", required: true }),
    textField({
      name: "title",
      label: "Title",
      required: true,
      localized: true,
    }),
  ],
  admin: { useAsTitle: "title", defaultColumns: ["title", "slug"] },
});
const localizedRegistry = createCollectionRegistry([localizedArticles]);

const shellBase = {
  registry,
  collection: articles.slug,
  collectionHref: (slug: string) => `/admin/collections/${slug}`,
  createHref: "/admin/collections/admin-articles/create",
  editHref: (id: string) => `/admin/collections/admin-articles/${id}`,
  cancelHref: "/admin/collections/admin-articles",
} as const;

describe("generated collection admin", () => {
  test("renders semantic navigation, filters, list columns, and edit links", () => {
    const html = renderToStaticMarkup(
      <CmsCollectionAdminShell
        {...shellBase}
        mode="list"
        filter={{ field: "title", operator: "contains", value: "launch" }}
        documents={[
          {
            id: "article-1",
            version: 2,
            status: "published",
            data: {
              title: "Launch",
              audience: "public",
              author: "author-1",
            },
            updatedAt: "2026-08-17T00:00:00.000Z",
          },
        ]}
      />,
    );

    expect(html).toContain('<nav aria-label="Collections">');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('role="search"');
    expect(html).toContain("Filter Articles");
    expect(html).toContain("<caption>Articles collection</caption>");
    expect(html).toContain('<th scope="col">Title</th>');
    expect(html).toContain('aria-label="Edit Launch"');
    expect(html).toContain("Create Article");
  });

  test("generates create/edit controls, relationships, errors, and visibility", () => {
    const publicHtml = renderToStaticMarkup(
      <CmsCollectionAdminShell
        {...shellBase}
        mode="create"
        data={{ title: "Draft", audience: "public", author: "author-1" }}
        relationshipOptions={{
          "admin-authors": [{ id: "author-1", label: "Ada" }],
        }}
        errors={{ title: "Title is required" }}
      />,
    );
    expect(publicHtml).toContain("Create Article");
    expect(publicHtml).toContain('for="cms-admin-articles-title"');
    expect(publicHtml).toContain('role="alert"');
    expect(publicHtml).toContain('aria-invalid="true"');
    expect(publicHtml).toContain(
      '<option value="author-1" selected="">Ada</option>',
    );
    expect(publicHtml).not.toContain("Member note");

    const memberHtml = renderToStaticMarkup(
      <CmsCollectionAdminShell
        {...shellBase}
        mode="edit"
        data={{ audience: "members", author: "author-1" }}
      />,
    );
    expect(memberHtml).toContain("Edit Article");
    expect(memberHtml).toContain("Member note");
    expect(memberHtml).toContain("Save changes");
  });

  test("allows a template to replace one field without forking the shell", () => {
    function PremiumTitle({ controlId }: CmsCollectionFieldControlProps) {
      return <input id={controlId} aria-label="Premium title editor" />;
    }
    const controls = createCollectionFieldControlRegistry({
      byField: { "admin-articles.title": PremiumTitle },
    });
    const html = renderToStaticMarkup(
      <CmsCollectionAdminShell
        {...shellBase}
        mode="edit"
        data={{ title: "Premium", audience: "public", author: "author-1" }}
        controls={controls}
      />,
    );
    expect(html).toContain('aria-label="Premium title editor"');
    expect(html).toContain("Audience");
    expect(html).toContain("Author");
  });

  test("maps the shared collection validator to accessible field errors", () => {
    expect(
      validateCmsCollectionAdminData(articles, {
        title: "",
        audience: "members",
        author: "author-1",
      }),
    ).toEqual({
      success: false,
      data: null,
      errors: {
        memberNote: "Required field is missing.",
      },
    });

    expect(
      validateCmsCollectionAdminData(articles, {
        title: "Valid",
        audience: "public",
        author: "author-1",
      }),
    ).toMatchObject({ success: true });
  });

  test("exposes accessible locale list, create, edit, status, and preview state", () => {
    const common = {
      registry: localizedRegistry,
      collection: localizedArticles.slug,
      collectionHref: (slug: string) => `/admin/collections/${slug}`,
      createHref:
        "/admin/collections/localized-admin-articles/create?locale=en-US",
      editHref: (id: string, locale?: string) =>
        `/admin/collections/localized-admin-articles/${id}?locale=${locale}`,
      previewHref: (id: string, locale?: string) =>
        `/preview/${id}?locale=${locale}`,
      cancelHref: "/admin/collections/localized-admin-articles?locale=en-US",
      locale: "en-US",
    } as const;
    const list = renderToStaticMarkup(
      <CmsCollectionAdminShell
        {...common}
        mode="list"
        documents={[
          {
            id: "localized-1",
            locale: "en-US",
            fallbackFrom: null,
            version: 2,
            status: "published",
            data: { slug: "shared", title: "English" },
            updatedAt: "2026-08-18T00:00:00.000Z",
          },
        ]}
      />,
    );
    expect(list).toContain("Showing en-US locale");
    expect(list).toContain("published");
    expect(list).toContain("Preview English in en-US");
    expect(list).toContain("?locale=en-US");

    const form = renderToStaticMarkup(
      <CmsCollectionAdminShell
        {...common}
        mode="edit"
        documentId="localized-1"
        data={{ slug: "shared", title: "English" }}
      />,
    );
    expect(form).toContain("Editing locale");
    expect(form).toContain("Title (localized)");
    expect(form).toContain("Slug (shared)");
    expect(form).toContain("Preview this locale");
    expect(form).toContain("/preview/localized-1?locale=en-US");
  });
});
