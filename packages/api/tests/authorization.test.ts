import { describe, expect, mock, spyOn, test } from "bun:test";

import type { Context } from "../src/context";
import { roleCapabilities } from "@rem-viet/cms";

let duplicateContentKind: "page" | "post" | null = null;

mock.module("@rem-viet/db", () => ({
  createDb: () => ({
    query: {
      pages: {
        findFirst: async () =>
          duplicateContentKind === "page" ? { id: "existing-page" } : undefined,
      },
      posts: {
        findFirst: async () =>
          duplicateContentKind === "post" ? { id: "existing-post" } : undefined,
      },
    },
  }),
}));

mock.module("cloudflare:workers", () => ({
  env: {
    ADMIN_EMAILS: "owner@example.com",
    BETTER_AUTH_SECRET: "test-secret-that-is-long-enough-for-better-auth",
    BETTER_AUTH_URL: "http://localhost:3000",
    CORS_ORIGIN: "http://localhost:3000",
  },
}));

const { capabilityProcedure, router } = await import("../src/index");
const { appRouter } = await import("../src/routers");
const {
  assertMediaDeletionAllowed,
  createPostInputSchema,
  mediaUsagesFromCorpus,
  updatePageInputSchema,
  updatePostInputSchema,
} = await import("../src/services/content");
const { ContentWorkflowError } =
  await import("../src/services/content-revisions");
const { deriveEditorialReviewState } =
  await import("../src/services/editorial-reviews");
const {
  encodeRemVietHomeBlocks,
  encodeRemVietHomeRevision,
  parseRemVietHomeContent,
} = await import("../src/services/home-page-runtime");
const { updateRedirectInputSchema } =
  await import("../src/services/operations");
const { encodeRemVietStandardPageRevision, parseRemVietStandardPageContent } =
  await import("../src/services/standard-page-runtime");
const { runCmsWorkflow } = await import("../src/workflow-error");
const { CmsError, defaultHomeBlocks } = await import("@rem-viet/cms");

function context(role: "owner" | "admin" | "editor" | null): Context {
  const session = role
    ? ({
        session: {
          id: "session-1",
          userId: "user-1",
          token: "test-token",
          expiresAt: new Date(Date.now() + 60_000),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        user: {
          id: "user-1",
          name: "Test Editor",
          email: "editor@example.com",
          emailVerified: true,
          twoFactorEnabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      } as Context["session"])
    : null;

  return {
    actor: role
      ? {
          userId: "user-1",
          email: "editor@example.com",
          role,
          requestId: "request-1",
        }
      : null,
    apiKeyPrincipal: null,
    authType: role ? "session" : null,
    auth: null,
    capabilities: role ? [...roleCapabilities[role]] : [],
    isAdmin: Boolean(role),
    requestId: "request-1",
    session,
    staffRole: role,
  };
}

function apiKeyContext(scopes: Context["capabilities"]): Context {
  return {
    ...context(null),
    actor: {
      userId: "service-account:sync",
      email: "api-key:Content sync",
      role: "system",
      requestId: "request-1",
    },
    apiKeyPrincipal: {
      apiKeyId: "key-1",
      serviceAccountId: "sync",
      serviceAccountName: "Content sync",
      capabilities: scopes,
    },
    authType: "apiKey",
    capabilities: scopes,
  };
}

describe("operations input schemas", () => {
  test("an active-only redirect update does not inject create defaults", () => {
    expect(
      updateRedirectInputSchema.parse({
        redirectId: "redirect-1",
        active: false,
      }),
    ).toEqual({ redirectId: "redirect-1", active: false });
  });
});

describe("content capability procedures", () => {
  const apiKeyProbe = router({
    readDraft: capabilityProcedure("content.readDraft").query(({ ctx }) => ({
      actor: ctx.actor,
      authType: ctx.authType,
    })),
  });

  test("an editor receives FORBIDDEN from the publish API", async () => {
    const caller = appRouter.createCaller(context("editor"));

    try {
      await caller.content.pages.publish({ pageId: "page-1" });
      throw new Error("Expected publish to be rejected");
    } catch (error) {
      expect(error).toMatchObject({ code: "FORBIDDEN" });
    }
  });

  test("an editor receives FORBIDDEN from the scheduling API", async () => {
    const caller = appRouter.createCaller(context("editor"));

    await expect(
      caller.content.pages.schedule({
        pageId: "page-1",
        scheduledAt: new Date(Date.now() + 60_000),
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  test("an editor can request review but cannot approve it", async () => {
    const caller = appRouter.createCaller(context("editor"));

    await expect(
      caller.content.reviews.request({
        documentId: "missing-page",
        documentType: "page",
        expectedVersion: 1,
        note: "Ready for review",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      caller.content.reviews.decide({
        decision: "approved",
        documentId: "page-1",
        documentType: "page",
        expectedVersion: 1,
        note: "",
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Missing capability: content.review.decide",
    });
    await expect(caller.content.reviews.queue()).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Missing capability: content.review.decide",
    });
    await expect(
      caller.content.comments.setResolved({
        expectedVersion: 1,
        operationId: "00000000-0000-4000-8000-000000000001",
        resolved: true,
        threadId: "00000000-0000-4000-8000-000000000002",
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Missing capability: content.review.decide",
    });
  });

  test("an unauthenticated draft read receives UNAUTHORIZED", async () => {
    const caller = appRouter.createCaller(context(null));

    try {
      await caller.content.pages.adminList({});
      throw new Error("Expected draft read to be rejected");
    } catch (error) {
      expect(error).toMatchObject({ code: "UNAUTHORIZED" });
    }
    await expect(
      caller.content.comments.list({
        documentId: "page-1",
        documentType: "page",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  test("an owner without MFA receives FORBIDDEN before CMS authority", async () => {
    const ownerContext = context("owner");
    if (!ownerContext.session) throw new Error("Expected owner session");
    ownerContext.session.user.twoFactorEnabled = false;
    const caller = appRouter.createCaller(ownerContext);

    await expect(caller.content.pages.adminList({})).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Two-factor authentication required",
    });
  });

  test("an editor is not forced to enroll MFA", async () => {
    const editorContext = context("editor");
    if (!editorContext.session) throw new Error("Expected editor session");
    editorContext.session.user.twoFactorEnabled = false;
    const caller = appRouter.createCaller(editorContext);

    await expect(caller.privateData()).resolves.toMatchObject({
      message: "This is private",
      user: { id: "user-1" },
    });
  });

  test("an API key receives only its explicit scope", async () => {
    const allowed = apiKeyProbe.createCaller(
      apiKeyContext(["content.readDraft"]),
    );
    await expect(allowed.readDraft()).resolves.toMatchObject({
      authType: "apiKey",
      actor: { role: "system", userId: "service-account:sync" },
    });

    const denied = apiKeyProbe.createCaller(apiKeyContext(["media.manage"]));
    await expect(denied.readDraft()).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Missing API key scope: content.readDraft",
    });
  });

  test("an API key cannot enter legacy session-only procedures", async () => {
    const caller = appRouter.createCaller(apiKeyContext(["content.readDraft"]));
    await expect(caller.privateData()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  test("an admin cannot manage owner/staff accounts", async () => {
    const caller = appRouter.createCaller(context("admin"));

    try {
      await caller.governance.staff.list();
      throw new Error("Expected staff management to be rejected");
    } catch (error) {
      expect(error).toMatchObject({ code: "FORBIDDEN" });
    }
  });

  test("an editor cannot read the audit trail", async () => {
    const caller = appRouter.createCaller(context("editor"));

    try {
      await caller.governance.audit.list({ limit: 10 });
      throw new Error("Expected audit access to be rejected");
    } catch (error) {
      expect(error).toMatchObject({ code: "FORBIDDEN" });
    }
  });

  test("an editor cannot read deployment and runtime release evidence", async () => {
    const caller = appRouter.createCaller(context("editor"));

    await expect(caller.operations.readiness.runtime()).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Missing capability: audit.read",
    });
  });

  test("an editor cannot inspect durable jobs or workflow policy", async () => {
    const caller = appRouter.createCaller(context("editor"));
    await expect(
      caller.operations.jobs.list({ limit: 10 }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Missing capability: audit.read",
    });
    await expect(caller.operations.workflows.list()).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Missing capability: audit.read",
    });
  });

  test("an audit-only API key cannot mutate webhook configuration", async () => {
    const caller = appRouter.createCaller(apiKeyContext(["audit.read"]));
    await expect(
      caller.operations.webhooks.createEndpoint({
        name: "Sink",
        url: "https://hooks.example.com/cms",
        topics: ["*"],
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Missing API key scope: settings.manage",
    });
  });
});

describe("editorial review state", () => {
  const document = {
    documentId: "page-1",
    documentType: "page" as const,
    publishedRevisionId: null,
    slug: "home",
    status: "draft" as const,
    title: "Home",
    version: 4,
  };
  const event = (
    action: string,
    version: number,
    createdAt = new Date("2026-08-17T04:00:00.000Z"),
  ) => ({
    action,
    actorRole: "editor" as const,
    after: { note: "Please review", version },
    createdAt,
    id: `${action}-${version}`,
  });

  test("a request becomes stale as soon as the document version changes", () => {
    const state = deriveEditorialReviewState(document, [
      event("page.review_requested", 3),
    ]);

    expect(state).toMatchObject({
      currentVersion: 4,
      reviewVersion: 3,
      stale: true,
      status: "requested",
    });
  });

  test("approval is resolved only by the immediately following publish", () => {
    const state = deriveEditorialReviewState(
      {
        ...document,
        publishedRevisionId: "revision-5",
        status: "published",
        version: 5,
      },
      [
        event("page.publish", 5, new Date("2026-08-17T04:02:00.000Z")),
        event("page.review_approved", 4, new Date("2026-08-17T04:01:00.000Z")),
      ],
    );

    expect(state).toMatchObject({
      published: true,
      reviewVersion: 4,
      stale: false,
      status: "approved",
    });
  });
});

describe("partial content updates", () => {
  test("omitted fields do not receive create-time defaults", () => {
    const page = updatePageInputSchema.parse({ pageId: "page-1" });
    const post = updatePostInputSchema.parse({ postId: "post-1" });

    expect(page).toEqual({ pageId: "page-1" });
    expect(post).toEqual({ postId: "post-1" });
  });

  test("normalizes legacy structured post blocks before persistence", () => {
    const post = createPostInputSchema.parse({
      title: "Legacy structured post",
      content: JSON.stringify({
        version: 1,
        blocks: [
          { type: "paragraph", children: [{ text: "Alpha" }] },
          { type: "heading", level: 2, children: [{ text: "Bravo" }] },
        ],
      }),
    });
    expect(JSON.parse(post.content).blocks).toEqual([
      {
        id: "rich-0-paragraph",
        type: "paragraph",
        children: [{ text: "Alpha" }],
      },
      {
        id: "rich-1-heading",
        type: "heading",
        level: 2,
        children: [{ text: "Bravo" }],
      },
    ]);
  });
});

describe("homepage runtime compatibility codec", () => {
  test("round-trips the established flattened page and revision shapes", () => {
    const content = parseRemVietHomeContent({
      title: "Trang chủ",
      slug: "home",
      template: "landing",
      blocks: defaultHomeBlocks,
      seoTitle: "Rèm Việt",
      seoDescription: "Description",
      canonicalUrl: "",
      ogImage: "",
      robotsIndex: true,
      robotsFollow: true,
    });

    expect(encodeRemVietHomeBlocks(content)).toEqual(defaultHomeBlocks);
    expect(encodeRemVietHomeRevision(content)).toMatchObject({
      title: "Trang chủ",
      slug: "home",
      blocks: defaultHomeBlocks,
      seoTitle: "Rèm Việt",
    });
  });
});

describe("standard page runtime compatibility codec", () => {
  test("round-trips legacy blocks through versioned template envelopes", () => {
    const content = parseRemVietStandardPageContent({
      title: "About",
      slug: "about",
      template: "standard",
      blocks: [
        { type: "richText", content: "About body" },
        { type: "cta", title: "Contact", href: "/lien-he" },
      ],
      seoTitle: "About",
      seoDescription: "About description",
      canonicalUrl: "",
      ogImage: "",
      robotsIndex: true,
      robotsFollow: true,
    });

    expect(content.blocks[0]).toMatchObject({
      id: "standard-0-richText",
      schemaVersion: 1,
      data: { content: "About body" },
    });
    const encoded = encodeRemVietStandardPageRevision(content).blocks;
    expect(encoded).toEqual([
      {
        id: "standard-0-richText",
        type: "richText",
        content: "About body",
      },
      {
        id: "standard-1-cta",
        type: "cta",
        title: "Contact",
        href: "/lien-he",
      },
    ]);

    const reparsed = parseRemVietStandardPageContent({
      ...encodeRemVietStandardPageRevision(content),
      template: "standard",
    });
    expect(reparsed.blocks.map((block) => block.id)).toEqual([
      "standard-0-richText",
      "standard-1-cta",
    ]);
  });

  test("normalizes nested structured body identities before provider writes", () => {
    const content = parseRemVietStandardPageContent({
      title: "Structured page",
      slug: "structured-page",
      template: "standard",
      blocks: [
        {
          type: "richText",
          content: JSON.stringify({
            version: 1,
            blocks: [{ type: "paragraph", children: [{ text: "Nested" }] }],
          }),
        },
      ],
      seoTitle: "",
      seoDescription: "",
      canonicalUrl: "",
      ogImage: "",
      robotsIndex: true,
      robotsFollow: true,
    });
    expect(content.blocks[0]?.type).toBe("richText");
    if (content.blocks[0]?.type !== "richText")
      throw new Error("Expected rich text");
    expect(JSON.parse(content.blocks[0].data.content).blocks[0].id).toBe(
      "rich-0-paragraph",
    );
  });
});

describe("content slug uniqueness", () => {
  test("page creation returns CONFLICT for a duplicate normalized slug", async () => {
    duplicateContentKind = "page";

    try {
      const caller = appRouter.createCaller(context("admin"));

      await expect(
        caller.content.pages.create({
          title: "Duplicate page",
          slug: "duplicate-page",
        }),
      ).rejects.toMatchObject({
        code: "CONFLICT",
        message: "Page slug already exists",
      });
    } finally {
      duplicateContentKind = null;
    }
  });

  test("post creation returns CONFLICT for a duplicate normalized slug", async () => {
    duplicateContentKind = "post";

    try {
      const caller = appRouter.createCaller(context("admin"));

      await expect(
        caller.content.posts.create({
          title: "Duplicate post",
          slug: "duplicate-post",
        }),
      ).rejects.toMatchObject({
        code: "CONFLICT",
        message: "Post slug already exists",
      });
    } finally {
      duplicateContentKind = null;
    }
  });
});

describe("workflow error mapping", () => {
  test("maps portable provider conflicts to the existing API contract", async () => {
    await expect(
      runCmsWorkflow(async () => {
        throw new CmsError({
          code: "CONFLICT",
          message: "portable stale version",
          retryable: false,
        });
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "portable stale version",
    });
  });

  test("returns an explicit CONFLICT response for stale versions", async () => {
    const log = spyOn(console, "error").mockImplementation(() => {});
    try {
      await runCmsWorkflow(
        async () => {
          throw new ContentWorkflowError("CONFLICT", "stale editor version");
        },
        {
          category: "publish",
          operation: "page.publish.interactive",
          source: "request",
        },
      );
      throw new Error("Expected conflict to be rejected");
    } catch (error) {
      expect(error).toMatchObject({
        code: "CONFLICT",
        message: "stale editor version",
      });
      expect(log).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  test("reports unexpected publish failures without swallowing them", async () => {
    const log = spyOn(console, "error").mockImplementation(() => {});
    const failure = new Error("D1 provider failed for owner@example.com");
    try {
      await runCmsWorkflow(
        async () => {
          throw failure;
        },
        {
          category: "publish",
          operation: "page.publish.interactive",
          source: "request",
          entityType: "page",
          entityId: "page-1",
          requestId: "request-1",
        },
      );
      throw new Error("Expected provider failure to be rethrown");
    } catch (error) {
      expect(error).toBe(failure);
      expect(log).toHaveBeenCalledWith(
        "[cms:incident]",
        expect.objectContaining({
          event: "cms.operational_incident",
          fingerprint: "publish:page.publish.interactive",
          error: expect.objectContaining({
            message: "D1 provider failed for [redacted-email]",
          }),
        }),
      );
    } finally {
      log.mockRestore();
    }
  });
});

describe("media deletion policy", () => {
  const usage = [{ type: "page" as const, id: "page-1" }];

  test("finds media in every supported content owner, including SEO images", () => {
    const key = "media-id/example.png";
    const url = `/api/media/${key}`;

    expect(
      mediaUsagesFromCorpus(
        {
          pageRows: [
            { id: "page-og", ogImage: url, value: [] },
            { id: "page-block", ogImage: "", value: { image: key } },
          ],
          postRows: [
            { id: "post-cover", cover: url, ogImage: "", value: "" },
            { id: "post-og", cover: "", ogImage: url, value: "" },
            { id: "post-body", cover: "", ogImage: "", value: { src: key } },
          ],
          pageRevisionRows: [{ id: "page-revision", value: { ogImage: url } }],
          postRevisionRows: [
            { id: "post-revision", value: { coverImage: key } },
          ],
          productRows: [{ id: "product", value: [url] }],
          settingsRows: [{ id: "settings", value: url }],
        },
        url,
        key,
      ),
    ).toEqual([
      { type: "page", id: "page-og" },
      { type: "page", id: "page-block" },
      { type: "post", id: "post-cover" },
      { type: "post", id: "post-og" },
      { type: "post", id: "post-body" },
      { type: "page_revision", id: "page-revision" },
      { type: "post_revision", id: "post-revision" },
      { type: "product", id: "product" },
      { type: "site_settings", id: "settings" },
    ]);
  });

  test("blocks deletion while media is referenced", () => {
    expect(() => assertMediaDeletionAllowed(usage, false, "admin")).toThrow(
      /Media đang được dùng/,
    );
  });

  test("allows only an owner to force-delete referenced media", () => {
    expect(() => assertMediaDeletionAllowed(usage, true, "admin")).toThrow(
      /Only owner/,
    );
    expect(() =>
      assertMediaDeletionAllowed(usage, true, "owner"),
    ).not.toThrow();
  });

  test("allows ordinary deletion when the media has no references", () => {
    expect(() => assertMediaDeletionAllowed([], false, "editor")).not.toThrow();
  });
});
