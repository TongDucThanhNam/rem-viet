import { describe, expect, test } from "bun:test";
import {
  arrayField,
  codeField,
  colorField,
  computedField,
  createCollectionRegistry,
  defineCollection,
  emailField,
  groupField,
  jsonField,
  pointField,
  polymorphicRelationshipField,
  relationshipField,
  selectField,
  slugField,
  textField,
  urlField,
  virtualField,
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
const topics = defineCollection({
  ...authors,
  slug: "admin-topics",
  labels: { singular: "Topic", plural: "Topics" },
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
    polymorphicRelationshipField({
      name: "relatedContent",
      label: "Related content",
      relationTo: [authors.slug, topics.slug],
      hasMany: true,
      onDelete: "nullify",
      defaultValue: [],
    }),
  ],
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "audience", "author"],
  },
});
const registry = createCollectionRegistry([authors, topics, articles] as const);

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

const scalarRecords = defineCollection({
  slug: "scalar-records",
  labels: { singular: "Scalar record", plural: "Scalar records" },
  schemaVersion: 1,
  lifecycle,
  access,
  fields: [
    emailField({ name: "email", label: "Email", required: true }),
    urlField({ name: "website", label: "Website" }),
    slugField({ name: "slug", label: "Slug", required: true }),
    codeField({ name: "snippet", label: "Snippet", language: "typescript" }),
    jsonField({ name: "metadata", label: "Metadata" }),
    colorField({ name: "color", label: "Color" }),
    pointField({ name: "location", label: "Location" }),
    computedField({
      name: "displayLabel",
      label: "Display label",
      valueKind: "text",
      compute: async ({ data }) => String(data.slug ?? ""),
    }),
    virtualField({
      name: "liveStatus",
      label: "Live status",
      valueKind: "text",
      resolve: async () => "Ready",
    }),
  ],
  admin: {
    useAsTitle: "slug",
    defaultColumns: ["slug", "email"],
    layout: [
      {
        id: "identity",
        type: "tab",
        label: "Identity",
        fields: ["email", "website", "slug"],
      },
      {
        id: "data",
        type: "tab",
        label: "Structured data",
        fields: ["snippet", "metadata"],
      },
      {
        id: "coordinates",
        type: "row",
        label: "Coordinates",
        fields: ["location"],
      },
      {
        id: "appearance",
        type: "collapsible",
        label: "Appearance",
        fields: ["color"],
        collapsed: true,
      },
    ],
  },
});
const scalarRegistry = createCollectionRegistry([scalarRecords]);

const structuredRecords = defineCollection({
  slug: "structured-records",
  labels: { singular: "Structured record", plural: "Structured records" },
  schemaVersion: 1,
  lifecycle,
  access,
  fields: [
    groupField({
      name: "address",
      label: "Address",
      required: true,
      fields: [
        textField({ name: "street", label: "Street", required: true }),
        textField({ name: "city", label: "City", required: true }),
      ],
    }),
    arrayField({
      name: "contributors",
      label: "Contributors",
      validation: { maxItems: 3 },
      fields: [
        textField({ name: "name", label: "Name", required: true }),
        emailField({ name: "email", label: "Email" }),
      ],
    }),
  ],
  admin: { useAsTitle: "address", defaultColumns: ["address"] },
});
const structuredRegistry = createCollectionRegistry([structuredRecords]);

const shellBase = {
  registry,
  collection: articles.slug,
  collectionHref: (slug: string) => `/admin/collections/${slug}`,
  createHref: "/admin/collections/admin-articles/create",
  editHref: (id: string) => `/admin/collections/admin-articles/${id}`,
  cancelHref: "/admin/collections/admin-articles",
} as const;

describe("generated collection admin", () => {
  test("renders nested group and repeatable array controls with stable paths", () => {
    function StreetOverride({ controlId }: CmsCollectionFieldControlProps) {
      return <input id={controlId} aria-label="Street override" />;
    }
    const html = renderToStaticMarkup(
      <CmsCollectionAdminShell
        registry={structuredRegistry}
        collection={structuredRecords.slug}
        collectionHref={(slug) => `/admin/collections/${slug}`}
        createHref="/admin/collections/structured-records/create"
        editHref={(id) => `/admin/collections/structured-records/${id}`}
        cancelHref="/admin/collections/structured-records"
        mode="create"
        controls={createCollectionFieldControlRegistry({
          byField: {
            "structured-records.address.street": StreetOverride,
          },
        })}
        data={{
          address: { street: "1 Nguyễn Huệ", city: "Hồ Chí Minh" },
          contributors: [{ name: "Nam", email: "nam@example.com" }],
        }}
      />,
    );
    expect(html).toContain('data-cms-field-path="address.street"');
    expect(html).toContain('aria-label="Street override"');
    expect(html).toContain('for="cms-structured-records-address-city"');
    expect(html).toContain("<legend>Contributors 1</legend>");
    expect(html).toContain('data-cms-field-path="contributors.0.email"');
    expect(html).toContain('aria-label="Remove Contributors row 1"');
    expect(html).toContain("Add Contributors row");
  });

  test("renders accessible controls for scalar field v2", () => {
    const html = renderToStaticMarkup(
      <CmsCollectionAdminShell
        registry={scalarRegistry}
        collection={scalarRecords.slug}
        collectionHref={(slug) => `/admin/collections/${slug}`}
        createHref="/admin/collections/scalar-records/create"
        editHref={(id) => `/admin/collections/scalar-records/${id}`}
        cancelHref="/admin/collections/scalar-records"
        mode="create"
        data={{
          email: "editor@example.com",
          slug: "launch",
          color: "#c8a96b",
          location: { latitude: 10, longitude: 106 },
          displayLabel: "launch",
          liveStatus: "Ready",
        }}
      />,
    );
    expect(html).toContain('type="email"');
    expect(html).toContain('type="url"');
    expect(html).toContain('pattern="[a-z0-9]+(?:-[a-z0-9]+)*"');
    expect(html).toContain('data-language="typescript"');
    expect(html).toContain("Structured JSON value");
    expect(html).toContain('type="color"');
    expect(html).toContain("<legend>Location</legend>");
    expect(html).toContain('for="cms-scalar-records-location-latitude"');
    expect(html).toContain('for="cms-scalar-records-location-longitude"');
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain(
      'aria-labelledby="cms-scalar-records-tab-data" hidden=""',
    );
    expect(html).toContain('data-cms-layout="row"');
    expect(html).toContain('data-cms-layout="collapsible"');
    expect(html).toContain("<summary>Appearance</summary>");
    expect(html).toContain('data-cms-derived="computed">launch</output>');
    expect(html).toContain('data-cms-derived="virtual">Ready</output>');
  });

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
          "admin-topics": [{ id: "topic-1", label: "Launch" }],
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
    expect(publicHtml).toContain(
      '<option value="" disabled="">Select a related document</option>',
    );
    expect(publicHtml).toContain('<optgroup label="admin-authors">');
    expect(publicHtml).toContain(
      '<option value="admin-topics:topic-1">Launch</option>',
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

  test("localizes generated CRUD and passes the resolved pack to custom controls", () => {
    function LocaleAwareTitle({
      controlId,
      messages,
      uiLocale,
    }: CmsCollectionFieldControlProps) {
      return (
        <input
          id={controlId}
          aria-label={`${uiLocale}:${messages.saveChanges}`}
        />
      );
    }
    const list = renderToStaticMarkup(
      <CmsCollectionAdminShell
        {...shellBase}
        mode="list"
        uiLocale="vi"
        documents={[
          {
            id: "article-vi",
            version: 1,
            status: "published",
            data: {
              title: "Ra mắt",
              audience: "public",
              author: "author-1",
            },
            updatedAt: "2026-08-30T00:00:00.000Z",
          },
        ]}
      />,
    );
    expect(list).toContain('<nav aria-label="Bộ sưu tập">');
    expect(list).toContain("Lọc Articles");
    expect(list).toContain("Áp dụng bộ lọc");
    expect(list).toContain("Bộ sưu tập Articles");
    expect(list).toContain("Trạng thái");
    expect(list).toContain("đã xuất bản");
    expect(list).toContain('aria-label="Chỉnh sửa Ra mắt"');
    expect(list).toContain("Tạo Article");

    const form = renderToStaticMarkup(
      <CmsCollectionAdminShell
        {...shellBase}
        mode="edit"
        uiLocale="vi"
        messageOverrides={{ saveChanges: "Ghi lại" }}
        controls={createCollectionFieldControlRegistry({
          byField: { "admin-articles.title": LocaleAwareTitle },
        })}
        data={{ title: "Ra mắt", audience: "public" }}
      />,
    );
    expect(form).toContain("Chỉnh sửa Article");
    expect(form).toContain('aria-label="vi:Ghi lại"');
    expect(form).toContain("Chọn tài liệu liên quan");
    expect(form).toContain("Ghi lại");
    expect(form).toContain("Hủy");
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

    const vietnameseList = renderToStaticMarkup(
      <CmsCollectionAdminShell
        {...common}
        mode="list"
        uiLocale="vi"
        documents={[
          {
            id: "localized-1",
            locale: "en-US",
            fallbackFrom: "vi-VN",
            version: 2,
            status: "draft",
            data: { slug: "shared", title: "English" },
            updatedAt: "2026-08-18T00:00:00.000Z",
          },
        ]}
      />,
    );
    expect(vietnameseList).toContain("Đang hiển thị ngôn ngữ en-US");
    expect(vietnameseList).toContain("(dự phòng cho vi-VN)");
    expect(vietnameseList).toContain("bản nháp");
    expect(vietnameseList).toContain("Xem trước English bằng ngôn ngữ en-US");

    const vietnameseForm = renderToStaticMarkup(
      <CmsCollectionAdminShell
        {...common}
        mode="edit"
        uiLocale="vi"
        documentId="localized-1"
        data={{ slug: "shared", title: "English" }}
      />,
    );
    expect(vietnameseForm).toContain("Ngôn ngữ đang chỉnh sửa");
    expect(vietnameseForm).toContain("Title (theo ngôn ngữ)");
    expect(vietnameseForm).toContain("Slug (dùng chung)");
    expect(vietnameseForm).toContain("Xem trước ngôn ngữ này");
  });
});
