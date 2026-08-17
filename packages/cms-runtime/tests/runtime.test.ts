import { describe, expect, test } from "bun:test";
import { type CmsBlock } from "@agency/cms-core";

import {
  assertCmsCollectionAccess,
  createCmsPageRuntime,
  deriveCmsEditorialReviewState,
  type CmsPageContent,
  type CmsPageProvider,
} from "../src";

describe("CMS page runtime", () => {
  test("exposes one provider through small workflow ports", () => {
    type Content = CmsPageContent<CmsBlock<"text", { text: string }>>;
    const provider = {
      capabilities: { supported: ["content.readDraft"] },
    } as unknown as CmsPageProvider<Content>;
    const runtime = createCmsPageRuntime(provider);

    expect(runtime.content).toBe(provider);
    expect(runtime.drafts).toBe(provider);
    expect(runtime.publishing).toBe(provider);
    expect(runtime.reviews).toBeNull();
    expect(runtime.capabilities.supported).toEqual(["content.readDraft"]);
    expect(Object.isFrozen(runtime)).toBe(true);
  });

  test("keeps review decisions bound to the exact saved version", () => {
    const target = { documentId: "home", documentType: "page" };
    const approved = {
      ...target,
      action: "approved" as const,
      actorId: "reviewer-1",
      note: "Ready",
      occurredAt: "2026-08-17T00:00:01.000Z",
      version: 3,
    };

    expect(
      deriveCmsEditorialReviewState(
        {
          ...target,
          publishedRevisionId: null,
          status: "draft",
          version: 4,
        },
        [approved],
      ),
    ).toMatchObject({ status: "approved", stale: true, published: false });

    expect(
      deriveCmsEditorialReviewState(
        {
          ...target,
          publishedRevisionId: "revision-4",
          status: "published",
          version: 4,
        },
        [
          {
            ...target,
            action: "published",
            actorId: "publisher-1",
            note: "",
            occurredAt: "2026-08-17T00:00:02.000Z",
            version: 3,
          },
          approved,
        ],
      ),
    ).toMatchObject({ status: "approved", stale: false, published: true });
  });
});

describe("CMS collection runtime contracts", () => {
  test("enforces collection capability metadata without role coupling", () => {
    const collection = {
      slug: "articles",
      access: {
        read: [],
        create: ["content.write"],
        update: ["content.write"],
        delete: ["content.delete"],
        publish: ["content.publish"],
      },
    } as Parameters<typeof assertCmsCollectionAccess>[0];

    expect(() =>
      assertCmsCollectionAccess(collection, "read", []),
    ).not.toThrow();
    expect(() =>
      assertCmsCollectionAccess(collection, "publish", ["content.write"]),
    ).toThrowError(/Missing capabilities/);
    expect(() =>
      assertCmsCollectionAccess(collection, "publish", ["content.publish"]),
    ).not.toThrow();
  });
});
