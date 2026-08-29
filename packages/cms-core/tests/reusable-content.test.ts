import { describe, expect, test } from "bun:test";

import {
  CmsError,
  applyCmsReusableContentOverrides,
  buildCmsReusableContentUsageGraph,
  cmsReusableContentReferenceSchema,
  collectCmsReusableContentReferences,
  detachCmsReusableContent,
  resolveCmsReusableContent,
  type CmsReusableContentLoadedFragment,
} from "../src";

const reference = (
  fragmentId: string,
  overrides: readonly unknown[] = [],
  revisionId: string | null = null,
) =>
  cmsReusableContentReferenceSchema.parse({
    kind: "cms.reusable-reference",
    fragmentId,
    contentType: "standard-page-block",
    revisionId,
    overrides,
  });

function loader(
  fragments: Readonly<Record<string, CmsReusableContentLoadedFragment>>,
) {
  return async ({ fragmentId }: { fragmentId: string }) =>
    fragments[fragmentId] ?? null;
}

describe("reusable content", () => {
  test("applies immutable set/unset overrides using bounded JSON pointers", () => {
    const original = {
      type: "cta",
      title: "Original",
      metadata: { tone: "dark", internal: true },
      links: ["/one", "/two"],
    };
    const changed = applyCmsReusableContentOverrides(original, [
      { op: "set", path: "/title", value: "Campaign" },
      { op: "unset", path: "/metadata/internal" },
      { op: "set", path: "/links/1", value: "/changed" },
      { op: "set", path: "/links/-", value: "/three" },
    ]);

    expect(changed).toEqual({
      type: "cta",
      title: "Campaign",
      metadata: { tone: "dark" },
      links: ["/one", "/changed", "/three"],
    });
    expect(original).toEqual({
      type: "cta",
      title: "Original",
      metadata: { tone: "dark", internal: true },
      links: ["/one", "/two"],
    });
    expect(() =>
      applyCmsReusableContentOverrides(original, [
        { op: "set", path: "/__proto__/polluted", value: true },
      ]),
    ).toThrow("Unsafe reusable-content override path");
  });

  test("resolves synced and nested fragments with revision and usage receipts", async () => {
    const fragments = {
      child: {
        fragmentId: "child",
        contentType: "standard-page-block",
        revisionId: "child-r2",
        value: { type: "cta", title: "Child", href: "/child" },
      },
      parent: {
        fragmentId: "parent",
        contentType: "standard-page-block",
        revisionId: "parent-r4",
        value: {
          type: "group",
          heading: "Parent",
          child: reference("child"),
        },
      },
    } as const;

    const result = await resolveCmsReusableContent({
      value: {
        page: [
          reference("parent", [
            { op: "set", path: "/heading", value: "Overridden" },
          ]),
        ],
      },
      load: loader(fragments),
    });

    expect(result.value).toEqual({
      page: [
        {
          type: "group",
          heading: "Overridden",
          child: { type: "cta", title: "Child", href: "/child" },
        },
      ],
    });
    expect(result.usages).toEqual([
      {
        fragmentId: "parent",
        contentType: "standard-page-block",
        revisionId: "parent-r4",
        path: "/page/0",
        depth: 0,
        overrideCount: 1,
      },
      {
        fragmentId: "child",
        contentType: "standard-page-block",
        revisionId: "child-r2",
        path: "/page/0/child",
        depth: 1,
        overrideCount: 0,
      },
    ]);
  });

  test("fails closed for cycles, missing fragments, type drift, and stale pins", async () => {
    const fragments: Record<string, CmsReusableContentLoadedFragment> = {
      a: {
        fragmentId: "a",
        contentType: "standard-page-block",
        revisionId: "a-r1",
        value: reference("b"),
      },
      b: {
        fragmentId: "b",
        contentType: "standard-page-block",
        revisionId: "b-r1",
        value: reference("a"),
      },
      drifted: {
        fragmentId: "drifted",
        contentType: "seo-fields",
        revisionId: "drifted-r1",
        value: {},
      },
    };

    await expect(
      resolveCmsReusableContent({
        value: reference("a"),
        load: loader(fragments),
      }),
    ).rejects.toMatchObject<CmsError>({ code: "VALIDATION_FAILED" });
    await expect(
      resolveCmsReusableContent({
        value: reference("missing"),
        load: loader(fragments),
      }),
    ).rejects.toMatchObject<CmsError>({ code: "NOT_FOUND" });
    await expect(
      resolveCmsReusableContent({
        value: reference("drifted"),
        load: loader(fragments),
      }),
    ).rejects.toMatchObject<CmsError>({ code: "VALIDATION_FAILED" });
    await expect(
      resolveCmsReusableContent({
        value: reference("a", [], "a-r0"),
        load: loader(fragments),
      }),
    ).rejects.toMatchObject<CmsError>({ code: "CONFLICT" });
  });

  test("detaches a resolved snapshot with immutable source provenance", async () => {
    let loads = 0;
    const detached = await detachCmsReusableContent({
      reference: reference("cta", [
        { op: "set", path: "/title", value: "Local title" },
      ]),
      load: async (candidate) => {
        loads += 1;
        return candidate.fragmentId === "cta"
          ? {
              fragmentId: "cta",
              contentType: "standard-page-block",
              revisionId: "cta-r3",
              value: { type: "cta", title: "Shared", href: "/contact" },
            }
          : null;
      },
      now: () => new Date("2026-08-30T03:00:00.000Z"),
    });

    expect(detached).toEqual({
      kind: "cms.detached-content",
      source: {
        fragmentId: "cta",
        contentType: "standard-page-block",
        revisionId: "cta-r3",
        detachedAt: "2026-08-30T03:00:00.000Z",
      },
      value: { type: "cta", title: "Local title", href: "/contact" },
    });
    expect(loads).toBe(1);
  });

  test("discovers inbound usage and reports fragment dependency cycles", () => {
    const sources = [
      {
        sourceType: "standard-page",
        sourceId: "page-home",
        value: { blocks: [reference("header")] },
      },
      {
        sourceType: "reusable-fragment",
        sourceId: "header",
        value: { nested: reference("announcement") },
      },
      {
        sourceType: "reusable-fragment",
        sourceId: "announcement",
        value: { nested: reference("header") },
      },
    ] as const;
    const graph = buildCmsReusableContentUsageGraph(sources);

    expect(collectCmsReusableContentReferences(sources[0].value)).toEqual([
      {
        fragmentId: "header",
        contentType: "standard-page-block",
        revisionId: null,
        path: "/blocks/0",
        overrideCount: 0,
      },
    ]);
    expect(graph.byFragment.header).toHaveLength(2);
    expect(graph.byFragment.announcement).toHaveLength(1);
    expect(graph.cycles).toHaveLength(1);
    expect(new Set(graph.cycles[0])).toEqual(
      new Set(["header", "announcement"]),
    );
  });
});
