import { describe, expect, test } from "bun:test";
import { type CmsBlock } from "@agency/cms-core";

import {
  assertCmsCollectionAccess,
  createCmsPageRuntime,
  deriveCmsEditorialReviewState,
  isCmsEditorialReviewActorAssigned,
  missingRequiredCmsEditorialReviewChecklistItems,
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

  test("preserves request task metadata and accumulates checklist evidence", () => {
    const target = { documentId: "home", documentType: "page" };
    const state = deriveCmsEditorialReviewState(
      {
        ...target,
        publishedRevisionId: null,
        status: "draft",
        version: 3,
      },
      [
        {
          ...target,
          action: "approved",
          actorId: "reviewer-1",
          completedChecklistItemIds: ["brand"],
          note: "Legal approved",
          occurredAt: "2026-08-21T03:00:00.000Z",
          version: 3,
        },
        {
          ...target,
          action: "requested",
          actorId: "editor-1",
          note: "Please review",
          occurredAt: "2026-08-21T01:00:00.000Z",
          task: {
            assigneeIds: ["reviewer-1"],
            assigneeRoles: ["legal"],
            mentionIds: ["owner-1"],
            dueAt: "2026-08-22T01:00:00.000Z",
            checklist: [
              { id: "brand", label: "Brand", required: true },
              { id: "seo", label: "SEO", required: true },
            ],
            notify: true,
          },
          version: 3,
        },
      ],
    );

    expect(state).toMatchObject({
      assigneeIds: ["reviewer-1"],
      assigneeRoles: ["legal"],
      mentionIds: ["owner-1"],
      requestedAt: "2026-08-21T01:00:00.000Z",
      checklist: [
        { id: "brand", completed: true },
        { id: "seo", completed: false },
      ],
    });
    expect(isCmsEditorialReviewActorAssigned(state, "other", "legal")).toBe(
      true,
    );
    expect(isCmsEditorialReviewActorAssigned(state, "other", "design")).toBe(
      false,
    );
    expect(
      missingRequiredCmsEditorialReviewChecklistItems(state, []),
    ).toMatchObject([{ id: "seo" }]);
    expect(
      missingRequiredCmsEditorialReviewChecklistItems(state, ["seo"]),
    ).toEqual([]);
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
