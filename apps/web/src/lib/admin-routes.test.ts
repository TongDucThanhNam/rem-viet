import { describe, expect, test } from "bun:test";

import { adminNavigationSections, getAdminRouteMeta } from "./admin-routes";

describe("admin route metadata", () => {
  test("keeps navigation destinations unique and fully described", () => {
    const items = adminNavigationSections.flatMap((section) =>
      "items" in section ? section.items : [section],
    );
    const destinations = items.map((item) => item.to);

    expect(new Set(destinations).size).toBe(destinations.length);
    for (const item of items) {
      expect(item.label.trim()).not.toBe("");
      expect(item.pageTitle.trim()).not.toBe("");
      expect(item.description.trim()).not.toBe("");
    }
  });

  test("resolves static pages from the same source used by navigation", () => {
    expect(getAdminRouteMeta("/admin/media/")).toEqual({
      description: "Tải lên, mô tả và quản lý tài nguyên hình ảnh.",
      navTo: "/admin/media",
      sectionKey: "content",
      sectionLabel: "Nội dung",
      title: "Thư viện media",
    });
  });

  test("maps dynamic editors back to their parent navigation item", () => {
    expect(getAdminRouteMeta("/admin/products/product-123/edit")).toMatchObject(
      {
        navTo: "/admin/products",
        sectionKey: "products",
        sectionLabel: "Sản phẩm",
        title: "Sửa sản phẩm",
      },
    );
    expect(getAdminRouteMeta("/admin/posts/post-123/edit")).toMatchObject({
      navTo: "/admin/posts",
      sectionKey: "content",
      sectionLabel: "Nội dung",
      title: "Sửa bài viết",
    });
  });

  test("uses an explicit fallback for unknown admin routes", () => {
    expect(getAdminRouteMeta("/admin/not-yet-defined")).toEqual({
      description: "Quản lý nội dung và vận hành website.",
      navTo: "/admin/not-yet-defined",
      sectionKey: "content",
      sectionLabel: "Quản trị",
      title: "Quản trị",
    });
  });
});
