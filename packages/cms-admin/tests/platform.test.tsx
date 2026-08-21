import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { defineCollection, textField } from "@agency/cms-core";

import {
  CmsAdminBulkToolbar,
  CmsAdminCommandPalette,
  CmsAdminDashboard,
  CmsAdminDocumentTree,
  CmsAdminListPreferences,
  CmsAdminSlot,
  CmsAdminTaxonomyManager,
  cmsAdminBreadcrumbs,
  cmsAdminLocalePacks,
  createCmsAdminDocumentTree,
  decodeCmsAdminListState,
  encodeCmsAdminListState,
  normalizeCmsAdminListState,
  resolveCmsAdminMessages,
  type CmsAdminTreeRecord,
} from "../src";

const pages = defineCollection({
  slug: "platform-pages",
  labels: { singular: "Page", plural: "Pages" },
  schemaVersion: 1,
  lifecycle: { drafts: true, revisions: true, scheduling: true },
  access: { read: [], create: [], update: [], delete: [], publish: [] },
  fields: [
    textField({ name: "title", label: "Title", required: true }),
    textField({ name: "slug", label: "Slug", required: true }),
  ],
  admin: { useAsTitle: "title", defaultColumns: ["title", "slug"] },
});

const treeRecords: readonly CmsAdminTreeRecord[] = [
  { id: "root", label: "Home", href: "/root", parentId: null, order: 0 },
  { id: "about", label: "About", href: "/about", parentId: "root", order: 2 },
  { id: "team", label: "Team", href: "/team", parentId: "about", order: 0 },
  {
    id: "services",
    label: "Services",
    href: "/services",
    parentId: "root",
    order: 1,
  },
];

describe("CMS admin platform v2", () => {
  test("ships complete English and Vietnamese locale packs", () => {
    expect(Object.keys(cmsAdminLocalePacks.vi).sort()).toEqual(
      Object.keys(cmsAdminLocalePacks.en).sort(),
    );
    expect(resolveCmsAdminMessages("vi")).toMatchObject({
      publish: "Xuất bản",
      savedViews: "Chế độ xem đã lưu",
      globalSearch: "Tìm kiếm toàn cục",
    });
    expect(resolveCmsAdminMessages("en", { publish: "Release" }).publish).toBe(
      "Release",
    );
  });

  test("round-trips safe configurable columns, filters, sorting, and pagination state", () => {
    const state = normalizeCmsAdminListState(pages, {
      columns: ["title", "missing", "status", "title"],
      filters: [
        { field: "slug", operator: "contains", value: "launch" },
        { field: "secret", operator: "equals", value: "hidden" },
      ],
      sort: { field: "title", direction: "asc" },
      page: 3,
      pageSize: 50,
    });
    expect(state).toEqual({
      columns: ["title", "status"],
      filters: [{ field: "slug", operator: "contains", value: "launch" }],
      sort: { field: "title", direction: "asc" },
      page: 3,
      pageSize: 50,
    });
    expect(
      decodeCmsAdminListState(pages, encodeCmsAdminListState(state)),
    ).toEqual(state);
    expect(
      decodeCmsAdminListState(
        pages,
        "columns=unknown&filters=not-json&sort=secret:asc&page=-1&pageSize=999",
      ),
    ).toMatchObject({
      columns: ["updatedAt"],
      filters: [],
      sort: { field: "updatedAt", direction: "asc" },
      page: 1,
      pageSize: 25,
    });
  });

  test("renders accessible bulk, saved-view, column, sorting, and pagination controls", () => {
    const state = normalizeCmsAdminListState(pages, {
      page: 2,
      pageSize: 10,
    });
    const html = renderToStaticMarkup(
      <>
        <CmsAdminBulkToolbar
          selectedIds={["one", "two"]}
          locale="vi"
          onAction={() => undefined}
        />
        <CmsAdminListPreferences
          collection={pages}
          state={state}
          savedViews={[{ id: "launches", label: "Launches", state }]}
          activeViewId="launches"
          total={31}
          onStateChange={() => undefined}
          onViewChange={() => undefined}
          onSaveView={() => undefined}
          onDeleteView={() => undefined}
        />
      </>,
    );
    expect(html).toContain('role="toolbar"');
    expect(html).toContain("2 đã chọn");
    expect(html).toContain('data-cms-bulk-action="publish"');
    expect(html).toContain('data-cms-bulk-action="archive"');
    expect(html).toContain('data-cms-bulk-action="delete"');
    expect(html).toContain("Saved views");
    expect(html).toContain("Launches");
    expect(html).toContain("Columns");
    expect(html).toContain("Sorting");
    expect(html).toContain('aria-label="Page 2"');
    expect(html).toContain("Page 2 / 4");
  });

  test("builds deterministic nested trees and breadcrumbs and rejects invalid hierarchy", () => {
    const tree = createCmsAdminDocumentTree(treeRecords);
    expect(tree[0]?.children.map(({ id }) => id)).toEqual([
      "services",
      "about",
    ]);
    expect(
      cmsAdminBreadcrumbs(treeRecords, "team").map(({ id }) => id),
    ).toEqual(["root", "about", "team"]);
    expect(() =>
      createCmsAdminDocumentTree([
        { id: "orphan", label: "Orphan", href: "/", parentId: "missing" },
      ]),
    ).toThrow("Missing CMS tree parent");
    expect(() =>
      createCmsAdminDocumentTree([
        { id: "a", label: "A", href: "/a", parentId: "b" },
        { id: "b", label: "B", href: "/b", parentId: "a" },
      ]),
    ).toThrow("CMS tree cycle");

    const html = renderToStaticMarkup(
      <>
        <CmsAdminDocumentTree
          records={treeRecords}
          currentId="team"
          locale="vi"
        />
        <CmsAdminTaxonomyManager
          terms={treeRecords}
          selectedIds={["services"]}
          locale="vi"
          onSelectionChange={() => undefined}
          onMove={() => undefined}
        />
      </>,
    );
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain('aria-label="Cây tài liệu"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('data-cms-taxonomy-manager=""');
    expect(html).toContain("Phân loại");
    expect(html).toContain('aria-label="Di chuyển lên: Services"');
  });

  test("composes dashboard widgets, extension slots, global search, and recent documents", () => {
    const html = renderToStaticMarkup(
      <>
        <CmsAdminSlot
          name="root.before"
          slots={{ "root.before": [<p key="notice">Notice</p>] }}
        />
        <CmsAdminDashboard
          widgets={[
            { id: "recent", title: "Recent", content: <p>One</p>, order: 2 },
            { id: "health", title: "Health", content: <p>Good</p>, order: 1 },
          ]}
        />
        <CmsAdminCommandPalette
          open
          query=""
          results={[]}
          recentDocuments={[
            { id: "page-1", label: "Home", href: "/pages/page-1" },
          ]}
          onQueryChange={() => undefined}
          onClose={() => undefined}
        />
      </>,
    );
    expect(html.indexOf("Health")).toBeLessThan(html.indexOf("Recent"));
    expect(html).toContain("Notice");
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("Recent documents");
    expect(html).toContain('href="/pages/page-1"');
  });
});
