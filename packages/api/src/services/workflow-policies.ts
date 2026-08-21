import { createDb } from "@rem-viet/db";
import { cmsWorkflowPolicies } from "@rem-viet/db/schema/automation";
import { auditEvents } from "@rem-viet/db/schema/governance";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import type { CmsActor } from "./content-revisions";
import { ContentWorkflowError } from "./content-workflow-error";
import type { GovernanceActor } from "./governance";

export const cmsWorkflowStageSchema = z.object({
  id: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z][a-z0-9-]*$/),
  label: z.string().trim().min(2).max(120),
  approvalsRequired: z.number().int().min(1).max(5).default(1),
  reviewerRoles: z
    .array(z.enum(["owner", "admin"]))
    .min(1)
    .default(["owner", "admin"]),
  allowSelfApproval: z.boolean().default(false),
});

export const upsertCmsWorkflowPolicyInputSchema = z
  .object({
    collection: z.enum(["page", "post"]),
    locale: z.string().trim().max(35).default(""),
    stages: z.array(cmsWorkflowStageSchema).min(1).max(5),
    active: z.boolean().default(true),
  })
  .superRefine((value, context) => {
    const ids = value.stages.map((stage) => stage.id);
    const duplicate = ids.find((id, index) => ids.indexOf(id) !== index);
    if (duplicate) {
      context.addIssue({
        code: "custom",
        message: `Duplicate workflow stage: ${duplicate}`,
        path: ["stages"],
      });
    }
  });

export const cmsWorkflowPolicyTargetSchema = z.object({
  collection: z.enum(["page", "post"]),
  locale: z.string().trim().max(35).default(""),
});

export type WorkflowRuntime = Readonly<{
  db?: ReturnType<typeof createDb>;
  now?: () => Date;
}>;

function runtimeDb(runtime?: WorkflowRuntime) {
  return runtime?.db ?? createDb();
}

function runtimeNow(runtime?: WorkflowRuntime) {
  return runtime?.now?.() ?? new Date();
}

function parsePolicy(row: typeof cmsWorkflowPolicies.$inferSelect) {
  return {
    ...row,
    stages: z.array(cmsWorkflowStageSchema).parse(row.stages),
  };
}

function auditValues(input: {
  actor: GovernanceActor;
  action: string;
  policyId: string;
  before?: unknown;
  after?: unknown;
  now: Date;
}) {
  return {
    id: crypto.randomUUID(),
    actorUserId: input.actor.userId,
    actorEmail: input.actor.email,
    actorRole: input.actor.role,
    action: input.action,
    entityType: "cms_workflow_policy",
    entityId: input.policyId,
    before: input.before ?? null,
    after: input.after ?? null,
    requestId: input.actor.requestId,
    createdAt: input.now,
  } satisfies typeof auditEvents.$inferInsert;
}

export async function listCmsWorkflowPolicies(runtime?: WorkflowRuntime) {
  const rows = await runtimeDb(runtime)
    .select()
    .from(cmsWorkflowPolicies)
    .orderBy(
      asc(cmsWorkflowPolicies.collection),
      asc(cmsWorkflowPolicies.locale),
    );
  return rows.map(parsePolicy);
}

export async function resolveCmsWorkflowPolicy(
  collection: "page" | "post",
  locale = "",
  runtime?: WorkflowRuntime,
) {
  const rows = await runtimeDb(runtime)
    .select()
    .from(cmsWorkflowPolicies)
    .where(
      and(
        eq(cmsWorkflowPolicies.collection, collection),
        eq(cmsWorkflowPolicies.active, true),
        inArray(cmsWorkflowPolicies.locale, locale ? [locale, ""] : [""]),
      ),
    )
    .orderBy(desc(cmsWorkflowPolicies.locale));
  const exact = rows.find((row) => row.locale === locale) ?? rows[0];
  return exact ? parsePolicy(exact) : null;
}

/** A newly-created document cannot already satisfy a review policy because it
 * has no review request or approvals yet. Reject before persisting the draft so
 * callers do not observe a failed create that nevertheless left content behind. */
export async function assertCmsWorkflowInitialPublishAllowed(
  documentType: "page" | "post",
  locale = "",
  runtime?: WorkflowRuntime,
) {
  const policy = await resolveCmsWorkflowPolicy(documentType, locale, runtime);
  if (policy) {
    throw new ContentWorkflowError(
      "CONFLICT",
      "Create this document as a draft, complete its configured workflow, then publish it",
    );
  }
}

export async function upsertCmsWorkflowPolicy(
  input: z.infer<typeof upsertCmsWorkflowPolicyInputSchema>,
  actor: GovernanceActor,
  runtime?: WorkflowRuntime,
) {
  const parsed = upsertCmsWorkflowPolicyInputSchema.parse(input);
  const db = runtimeDb(runtime);
  const now = runtimeNow(runtime);
  const existing = await db.query.cmsWorkflowPolicies.findFirst({
    where: and(
      eq(cmsWorkflowPolicies.collection, parsed.collection),
      eq(cmsWorkflowPolicies.locale, parsed.locale),
    ),
  });
  const id = existing?.id ?? crypto.randomUUID();
  await db.batch([
    db
      .insert(cmsWorkflowPolicies)
      .values({
        id,
        collection: parsed.collection,
        locale: parsed.locale,
        stages: parsed.stages,
        active: parsed.active,
        createdBy: existing?.createdBy ?? actor.userId,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [cmsWorkflowPolicies.collection, cmsWorkflowPolicies.locale],
        set: {
          stages: parsed.stages,
          active: parsed.active,
          updatedAt: now,
        },
      }),
    db.insert(auditEvents).values(
      auditValues({
        actor,
        action: existing
          ? "cms_workflow_policy.update"
          : "cms_workflow_policy.create",
        policyId: id,
        before: existing
          ? { active: existing.active, stages: existing.stages }
          : null,
        after: parsed,
        now,
      }),
    ),
  ]);
  return resolveCmsWorkflowPolicy(parsed.collection, parsed.locale, runtime);
}

export async function deactivateCmsWorkflowPolicy(
  input: z.infer<typeof cmsWorkflowPolicyTargetSchema>,
  actor: GovernanceActor,
  runtime?: WorkflowRuntime,
) {
  const db = runtimeDb(runtime);
  const existing = await db.query.cmsWorkflowPolicies.findFirst({
    where: and(
      eq(cmsWorkflowPolicies.collection, input.collection),
      eq(cmsWorkflowPolicies.locale, input.locale),
    ),
  });
  if (!existing) return { deactivated: false as const };
  const now = runtimeNow(runtime);
  await db.batch([
    db
      .update(cmsWorkflowPolicies)
      .set({ active: false, updatedAt: now })
      .where(eq(cmsWorkflowPolicies.id, existing.id)),
    db.insert(auditEvents).values(
      auditValues({
        actor,
        action: "cms_workflow_policy.deactivate",
        policyId: existing.id,
        before: { active: existing.active },
        after: { active: false },
        now,
      }),
    ),
  ]);
  return { deactivated: true as const };
}

const approvalPayloadSchema = z.object({
  version: z.number().int().positive(),
  stageId: z.string().optional().default("approval"),
});
const requestPayloadSchema = z.object({
  version: z.number().int().positive(),
});

export async function getCmsWorkflowApprovalProgress(
  input: {
    documentType: "page" | "post";
    documentId: string;
    version: number;
    locale?: string;
  },
  runtime?: WorkflowRuntime,
) {
  const policy = await resolveCmsWorkflowPolicy(
    input.documentType,
    input.locale,
    runtime,
  );
  if (!policy) {
    return {
      policy: null,
      complete: true,
      stages: [],
      nextStageId: null,
    } as const;
  }
  const events = await runtimeDb(runtime)
    .select({
      actorUserId: auditEvents.actorUserId,
      after: auditEvents.after,
    })
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.entityType, input.documentType),
        eq(auditEvents.entityId, input.documentId),
        eq(auditEvents.action, `${input.documentType}.review_approved`),
      ),
    );
  const approvals = events.flatMap((event) => {
    const payload = approvalPayloadSchema.safeParse(event.after);
    return payload.success && payload.data.version === input.version
      ? [{ actorUserId: event.actorUserId, stageId: payload.data.stageId }]
      : [];
  });
  const stages = policy.stages.map((stage) => {
    const actorIds = [
      ...new Set(
        approvals
          .filter((approval) => approval.stageId === stage.id)
          .map((approval) => approval.actorUserId),
      ),
    ];
    return {
      ...stage,
      approvals: actorIds.length,
      actorIds,
      complete: actorIds.length >= stage.approvalsRequired,
    };
  });
  return {
    policy: {
      id: policy.id,
      collection: policy.collection,
      locale: policy.locale,
    },
    complete: stages.every((stage) => stage.complete),
    stages,
    nextStageId: stages.find((stage) => !stage.complete)?.id ?? null,
  };
}

export async function assertCmsWorkflowPublishAllowed(
  input: {
    documentType: "page" | "post";
    documentId: string;
    version: number;
    locale?: string;
  },
  runtime?: WorkflowRuntime,
) {
  const progress = await getCmsWorkflowApprovalProgress(input, runtime);
  if (!progress.complete) {
    const next = progress.stages.find((stage) => !stage.complete);
    throw new ContentWorkflowError(
      "CONFLICT",
      `Workflow approval is incomplete${next ? `: ${next.label} (${next.approvals}/${next.approvalsRequired})` : ""}`,
    );
  }
  return progress;
}

export async function assertCmsWorkflowReviewerAllowed(
  input: {
    documentType: "page" | "post";
    documentId: string;
    version: number;
    stageId?: string;
  },
  actor: CmsActor,
  runtime?: WorkflowRuntime,
) {
  const progress = await getCmsWorkflowApprovalProgress(input, runtime);
  if (!progress.policy) return { stageId: "approval", progress };
  const nextStage = progress.stages.find((candidate) => !candidate.complete);
  const requestedStage = input.stageId
    ? progress.stages.find((candidate) => candidate.id === input.stageId)
    : nextStage;
  if (input.stageId && requestedStage && requestedStage.id !== nextStage?.id) {
    throw new ContentWorkflowError(
      "CONFLICT",
      nextStage
        ? `Complete ${nextStage.label} before approving ${requestedStage.label}`
        : "Workflow is already approved",
    );
  }
  const stage = requestedStage;
  if (!stage) {
    throw new ContentWorkflowError("CONFLICT", "Workflow is already approved");
  }
  if (!stage.reviewerRoles.includes(actor.role as "owner" | "admin")) {
    throw new ContentWorkflowError(
      "FORBIDDEN",
      `Role ${actor.role} cannot approve ${stage.label}`,
    );
  }
  if (stage.actorIds.includes(actor.userId)) {
    return { stageId: stage.id, progress };
  }
  if (!stage.allowSelfApproval) {
    const request = await runtimeDb(runtime)
      .select({
        actorUserId: auditEvents.actorUserId,
        after: auditEvents.after,
      })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.entityType, input.documentType),
          eq(auditEvents.entityId, input.documentId),
          eq(auditEvents.action, `${input.documentType}.review_requested`),
        ),
      )
      .orderBy(desc(auditEvents.createdAt))
      .limit(1);
    const requestPayload = requestPayloadSchema.safeParse(request[0]?.after);
    if (
      request[0]?.actorUserId === actor.userId &&
      requestPayload.success &&
      requestPayload.data.version === input.version
    ) {
      throw new ContentWorkflowError(
        "FORBIDDEN",
        "The review requester cannot approve this workflow stage",
      );
    }
  }
  return { stageId: stage.id, progress };
}
