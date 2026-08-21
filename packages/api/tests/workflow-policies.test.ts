import { describe, expect, mock, test } from "bun:test";
import { Database } from "bun:sqlite";
import * as automationSchema from "@rem-viet/db/schema/automation";
import * as governanceSchema from "@rem-viet/db/schema/governance";
import { drizzle } from "drizzle-orm/bun-sqlite";

mock.module("cloudflare:workers", () => ({
  env: {
    BETTER_AUTH_SECRET: "test-secret-that-is-long-enough-for-better-auth",
    BETTER_AUTH_URL: "http://localhost:3000",
    CORS_ORIGIN: "http://localhost:3000",
  },
}));

const {
  assertCmsWorkflowInitialPublishAllowed,
  assertCmsWorkflowPublishAllowed,
  assertCmsWorkflowReviewerAllowed,
  cmsWorkflowAuditTarget,
  getCmsWorkflowApprovalProgress,
  resolveCmsWorkflowPolicy,
  upsertCmsWorkflowPolicy,
} = await import("../src/services/workflow-policies");
type WorkflowRuntime =
  import("../src/services/workflow-policies").WorkflowRuntime;

function createRuntime() {
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    CREATE TABLE cms_workflow_policies (
      id text PRIMARY KEY NOT NULL,
      collection text NOT NULL,
      folder text DEFAULT '' NOT NULL,
      locale text DEFAULT '' NOT NULL,
      stages text NOT NULL,
      active integer DEFAULT true NOT NULL,
      created_by text DEFAULT '' NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL,
      UNIQUE(collection, folder, locale)
    );
    CREATE TABLE audit_events (
      id text PRIMARY KEY NOT NULL,
      actor_user_id text DEFAULT '' NOT NULL,
      actor_email text DEFAULT '' NOT NULL,
      actor_role text DEFAULT 'system' NOT NULL,
      action text NOT NULL,
      entity_type text NOT NULL,
      entity_id text NOT NULL,
      before text,
      after text,
      request_id text DEFAULT '' NOT NULL,
      created_at integer NOT NULL
    );
  `);
  const database = drizzle(sqlite, {
    schema: { ...automationSchema, ...governanceSchema },
  });
  Object.assign(database, {
    batch: async (queries: PromiseLike<unknown>[]) => {
      const results = [];
      for (const query of queries) results.push(await query);
      return results;
    },
  });
  const now = new Date("2026-08-21T00:00:00.000Z");
  return {
    runtime: {
      db: database as unknown as WorkflowRuntime["db"],
      now: () => now,
    } satisfies WorkflowRuntime,
    sqlite,
    now,
  };
}

const owner = {
  userId: "owner-1",
  email: "owner@example.com",
  role: "owner" as const,
  requestId: "request-1",
};

function stage(id: string) {
  return {
    id,
    label: id.replaceAll("-", " "),
    approvalsRequired: 1,
    reviewerRoles: ["owner" as const],
    allowSelfApproval: false,
  };
}

function insertReviewEvent(
  sqlite: Database,
  input: {
    id: string;
    action: string;
    actorUserId: string;
    documentId: string;
    entityType?: string;
    after: unknown;
    createdAt: number;
  },
) {
  sqlite.run(
    `insert into audit_events (
      id, actor_user_id, actor_email, actor_role, action, entity_type,
      entity_id, before, after, request_id, created_at
    ) values (?, ?, '', 'admin', ?, ?, ?, null, ?, '', ?)`,
    [
      input.id,
      input.actorUserId,
      input.action,
      input.entityType ?? "page",
      input.documentId,
      JSON.stringify(input.after),
      input.createdAt,
    ],
  );
}

describe("configurable CMS workflow policies", () => {
  test("requires policy-bound documents to be created as drafts", async () => {
    const { runtime } = createRuntime();
    await upsertCmsWorkflowPolicy(
      {
        collection: "post",
        locale: "",
        stages: [
          {
            id: "editorial",
            label: "Editorial review",
            approvalsRequired: 1,
            reviewerRoles: ["owner"],
            allowSelfApproval: false,
          },
        ],
        active: true,
      },
      owner,
      runtime,
    );

    await expect(
      assertCmsWorkflowInitialPublishAllowed({ collection: "post" }, runtime),
    ).rejects.toThrow("Create this document as a draft");
    await expect(
      assertCmsWorkflowInitialPublishAllowed({ collection: "page" }, runtime),
    ).resolves.toBeUndefined();
  });

  test("requires distinct approvals per stage before publication", async () => {
    const { runtime, sqlite, now } = createRuntime();
    await upsertCmsWorkflowPolicy(
      {
        collection: "page",
        locale: "",
        active: true,
        stages: [
          {
            id: "legal",
            label: "Legal approval",
            approvalsRequired: 2,
            reviewerRoles: ["owner", "admin"],
            allowSelfApproval: false,
          },
          {
            id: "launch",
            label: "Launch approval",
            approvalsRequired: 1,
            reviewerRoles: ["owner"],
            allowSelfApproval: false,
          },
        ],
      },
      owner,
      runtime,
    );
    await expect(
      assertCmsWorkflowPublishAllowed(
        { collection: "page", documentId: "page-1", version: 4 },
        runtime,
      ),
    ).rejects.toThrow("Legal approval (0/2)");

    for (const [index, actorUserId] of ["admin-1", "admin-2"].entries()) {
      insertReviewEvent(sqlite, {
        id: `approval-legal-${index}`,
        action: "page.review_approved",
        actorUserId,
        documentId: "page-1",
        after: { version: 4, stageId: "legal" },
        createdAt: now.getTime() + index,
      });
    }
    insertReviewEvent(sqlite, {
      id: "approval-launch",
      action: "page.review_approved",
      actorUserId: "owner-2",
      documentId: "page-1",
      after: { version: 4, stageId: "launch" },
      createdAt: now.getTime() + 3,
    });

    await expect(
      assertCmsWorkflowPublishAllowed(
        { collection: "page", documentId: "page-1", version: 4 },
        runtime,
      ),
    ).resolves.toMatchObject({ complete: true });
    expect(
      await getCmsWorkflowApprovalProgress(
        { collection: "page", documentId: "page-1", version: 4 },
        runtime,
      ),
    ).toMatchObject({
      stages: [
        { id: "legal", approvals: 2, complete: true },
        { id: "launch", approvals: 1, complete: true },
      ],
    });
  });

  test("uses an exact locale policy before the collection fallback", async () => {
    const { runtime } = createRuntime();
    await upsertCmsWorkflowPolicy(
      {
        collection: "post",
        locale: "",
        stages: [
          {
            id: "default-review",
            label: "Default review",
            approvalsRequired: 1,
            reviewerRoles: ["owner"],
            allowSelfApproval: false,
          },
        ],
        active: true,
      },
      owner,
      runtime,
    );
    await upsertCmsWorkflowPolicy(
      {
        collection: "post",
        locale: "vi-VN",
        stages: [
          {
            id: "vietnam-review",
            label: "Vietnam review",
            approvalsRequired: 1,
            reviewerRoles: ["owner", "admin"],
            allowSelfApproval: true,
          },
        ],
        active: true,
      },
      owner,
      runtime,
    );

    expect(
      await resolveCmsWorkflowPolicy(
        { collection: "post", locale: "vi-VN" },
        runtime,
      ),
    ).toMatchObject({
      locale: "vi-VN",
      stages: [{ id: "vietnam-review" }],
    });
    expect(
      await resolveCmsWorkflowPolicy(
        { collection: "post", locale: "en-US" },
        runtime,
      ),
    ).toMatchObject({
      locale: "",
      stages: [{ id: "default-review" }],
    });
  });

  test("uses the nearest folder before locale and collection fallbacks", async () => {
    const { runtime } = createRuntime();
    await upsertCmsWorkflowPolicy(
      {
        collection: "page",
        locale: "vi-VN",
        stages: [stage("locale-review")],
      },
      owner,
      runtime,
    );
    await upsertCmsWorkflowPolicy(
      {
        collection: "page",
        folder: "campaigns",
        stages: [stage("campaign-review")],
      },
      owner,
      runtime,
    );
    await upsertCmsWorkflowPolicy(
      {
        collection: "page",
        folder: "campaigns/summer",
        locale: "vi-VN",
        stages: [stage("summer-review")],
      },
      owner,
      runtime,
    );

    await expect(
      resolveCmsWorkflowPolicy(
        {
          collection: "page",
          folder: "Campaigns\\Summer/Launch/",
          locale: "vi-VN",
        },
        runtime,
      ),
    ).resolves.toMatchObject({
      folder: "campaigns/summer",
      locale: "vi-VN",
      stages: [{ id: "summer-review" }],
    });
    await expect(
      resolveCmsWorkflowPolicy(
        {
          collection: "page",
          folder: "campaigns/spring",
          locale: "vi-VN",
        },
        runtime,
      ),
    ).resolves.toMatchObject({
      folder: "campaigns",
      locale: "",
      stages: [{ id: "campaign-review" }],
    });
    await expect(
      assertCmsWorkflowPublishAllowed(
        {
          collection: "page",
          documentId: "spring-launch",
          folder: "campaigns/spring",
          locale: "vi-VN",
          version: 1,
        },
        runtime,
      ),
    ).rejects.toThrow("campaign review (0/1)");
    await expect(
      resolveCmsWorkflowPolicy(
        { collection: "page", folder: "news", locale: "vi-VN" },
        runtime,
      ),
    ).resolves.toMatchObject({
      folder: "",
      locale: "vi-VN",
      stages: [{ id: "locale-review" }],
    });
  });

  test("isolates arbitrary-collection approvals by document locale", async () => {
    const { runtime, sqlite, now } = createRuntime();
    const collection = "rem-viet-localized-campaigns";
    await upsertCmsWorkflowPolicy(
      {
        collection,
        stages: [stage("campaign-approval")],
      },
      owner,
      runtime,
    );
    const viTarget = {
      collection,
      documentId: "summer-launch",
      locale: "vi-VN",
      version: 3,
    };
    const enTarget = { ...viTarget, locale: "en-US" };

    await expect(
      assertCmsWorkflowPublishAllowed(viTarget, runtime),
    ).rejects.toThrow("campaign approval (0/1)");
    await expect(
      assertCmsWorkflowPublishAllowed(enTarget, runtime),
    ).rejects.toThrow("campaign approval (0/1)");

    const auditTarget = cmsWorkflowAuditTarget(viTarget);
    insertReviewEvent(sqlite, {
      id: "localized-approval-vi",
      action: `${auditTarget.actionPrefix}.review_approved`,
      actorUserId: "admin-vi",
      documentId: auditTarget.entityId,
      entityType: auditTarget.entityType,
      after: { version: 3, stageId: "campaign-approval" },
      createdAt: now.getTime(),
    });

    await expect(
      assertCmsWorkflowPublishAllowed(viTarget, runtime),
    ).resolves.toMatchObject({ complete: true });
    await expect(
      assertCmsWorkflowPublishAllowed(enTarget, runtime),
    ).rejects.toThrow("campaign approval (0/1)");
  });

  test("blocks self-approval when the configured stage requires separation", async () => {
    const { runtime, sqlite, now } = createRuntime();
    await upsertCmsWorkflowPolicy(
      {
        collection: "page",
        locale: "",
        stages: [
          {
            id: "approval",
            label: "Approval",
            approvalsRequired: 1,
            reviewerRoles: ["owner", "admin"],
            allowSelfApproval: false,
          },
        ],
        active: true,
      },
      owner,
      runtime,
    );
    insertReviewEvent(sqlite, {
      id: "request-1",
      action: "page.review_requested",
      actorUserId: owner.userId,
      documentId: "page-1",
      after: { version: 2, note: "Review" },
      createdAt: now.getTime(),
    });

    await expect(
      assertCmsWorkflowReviewerAllowed(
        { collection: "page", documentId: "page-1", version: 2 },
        owner,
        runtime,
      ),
    ).rejects.toThrow("requester cannot approve");
  });

  test("enforces configured stage order", async () => {
    const { runtime } = createRuntime();
    await upsertCmsWorkflowPolicy(
      {
        collection: "page",
        locale: "",
        stages: [
          {
            id: "legal",
            label: "Legal review",
            approvalsRequired: 1,
            reviewerRoles: ["owner"],
            allowSelfApproval: true,
          },
          {
            id: "launch",
            label: "Launch review",
            approvalsRequired: 1,
            reviewerRoles: ["owner"],
            allowSelfApproval: true,
          },
        ],
        active: true,
      },
      owner,
      runtime,
    );

    await expect(
      assertCmsWorkflowReviewerAllowed(
        {
          collection: "page",
          documentId: "page-1",
          version: 2,
          stageId: "launch",
        },
        owner,
        runtime,
      ),
    ).rejects.toThrow("Complete Legal review before approving Launch review");
  });
});
