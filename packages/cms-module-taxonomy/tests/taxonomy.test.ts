import { describe, expect, test } from "bun:test";

import {
  cmsTaxonomyExtensionManifest,
  cmsTaxonomyModule,
  createCmsTaxonomyIndex,
  moveCmsTaxonomyNode,
  normalizeCmsTaxonomyTree,
  type CmsTaxonomyNode,
} from "../src";

const nodes = [
  {
    id: "home",
    taxonomy: "pages",
    label: "Home",
    slug: "home",
    parentId: null,
    order: 0,
  },
  {
    id: "products",
    taxonomy: "pages",
    label: "Products",
    slug: "products",
    parentId: null,
    order: 1,
  },
  {
    id: "curtains",
    taxonomy: "pages",
    label: "Curtains",
    slug: "curtains",
    parentId: "products",
    order: 0,
  },
  {
    id: "linen",
    taxonomy: "pages",
    label: "Linen",
    slug: "linen",
    parentId: "curtains",
    order: 0,
  },
] as const satisfies readonly CmsTaxonomyNode[];

describe("official taxonomy module", () => {
  test("owns lifecycle metadata and builds deterministic hierarchy navigation", () => {
    expect(cmsTaxonomyModule.manifest).toMatchObject({
      packageName: "@agency/cms-module-taxonomy",
      uninstall: { dataPolicy: "retain" },
    });
    expect(cmsTaxonomyExtensionManifest).toMatchObject({
      id: "official/taxonomy",
      classification: "official",
      data: { uninstall: { policy: "retain" } },
    });
    const index = createCmsTaxonomyIndex(nodes);
    expect(index.roots("pages").map(({ id }) => id)).toEqual([
      "home",
      "products",
    ]);
    expect(index.breadcrumbs("linen").map(({ slug }) => slug)).toEqual([
      "products",
      "curtains",
      "linen",
    ]);
    expect(index.descendantIds("products")).toEqual(["curtains", "linen"]);
  });

  test("moves safely and rejects cycles, duplicate sibling slugs, and missing parents", () => {
    const moved = moveCmsTaxonomyNode(nodes, {
      id: "curtains",
      parentId: null,
      index: 1,
    });
    expect(
      createCmsTaxonomyIndex(moved)
        .roots("pages")
        .map(({ id }) => id),
    ).toEqual(["home", "curtains", "products"]);
    expect(() =>
      moveCmsTaxonomyNode(nodes, {
        id: "products",
        parentId: "linen",
        index: 0,
      }),
    ).toThrow("cycle");
    expect(() =>
      normalizeCmsTaxonomyTree([
        ...nodes,
        {
          id: "duplicate",
          taxonomy: "pages",
          label: "Duplicate",
          slug: "curtains",
          parentId: "products",
          order: 1,
        },
      ]),
    ).toThrow("Duplicate sibling");
    expect(() =>
      normalizeCmsTaxonomyTree([
        {
          id: "orphan",
          taxonomy: "pages",
          label: "Orphan",
          slug: "orphan",
          parentId: "missing",
          order: 0,
        },
      ]),
    ).toThrow("Missing taxonomy parent");
  });
});
