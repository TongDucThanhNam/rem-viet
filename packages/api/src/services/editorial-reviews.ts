import { createDb } from "@rem-viet/db";
import { pages, posts } from "@rem-viet/db/schema/content";
import { auditEvents } from "@rem-viet/db/schema/governance";
import {
  deriveCmsEditorialReviewState,
  type CmsEditorialReviewEvent,
} from "@agency/cms-runtime";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import {
  ContentWorkflowError,
  recordContentAudit,
  type CmsActor,
} from "./content-revisions";

export const editorialDocumentTypeSchema = z.enum(["page", "post"]);
export const editorialReviewDecisionSchema = z.enum([
  "approved",
  "changes_requested",
]);

const editorialReviewNoteSchema = z.string().trim().max(500).default("");

export const editorialReviewTargetSchema = z.object({
  documentType: editorialDocumentTypeSchema,
  documentId: z.string().min(1),
});

export const requestEditorialReviewInputSchema =
  editorialReviewTargetSchema.extend({
    expectedVersion: z.coerce.number().int().positive(),
    note: editorialReviewNoteSchema,
  });

export const decideEditorialReviewInputSchema = editorialReviewTargetSchema
  .extend({
    decision: editorialReviewDecisionSchema,
    expectedVersion: z.coerce.number().int().positive(),
    note: editorialReviewNoteSchema,
  })
  .superRefine((value, context) => {
    if (value.decision === "changes_requested" && !value.note) {
      context.addIssue({
        code: "custom",
        message: "A note is required when requesting changes",
        path: ["note"],
      });
    }
  });

export type EditorialDocumentType = z.infer<typeof editorialDocumentTypeSchema>;
export type EditorialReviewStatus =
  "none" | "requested" | "changes_requested" | "approved";

type EditorialDocument = {
  documentId: string;
  documentType: EditorialDocumentType;
  publishedRevisionId: string | null;
  slug: string;
  status: "draft" | "published";
  title: string;
  version: number;
};

type EditorialReviewEvent = {
  action: string;
  actorRole: "owner" | "admin" | "editor" | "system";
  after: unknown | null;
  createdAt: Date;
  id: string;
};

const reviewPayloadSchema = z.object({
  note: z.string().max(500).catch(""),
  version: z.number().int().positive(),
});
const publicationPayloadSchema = z.object({
  version: z.number().int().positive(),
});

const reviewActions = [
  "page.review_requested",
  "page.review_changes_requested",
  "page.review_approved",
  "post.review_requested",
  "post.review_changes_requested",
  "post.review_approved",
] as const;

const publishActions = ["page.publish", "post.publish"] as const;

function reviewStatusFromAction(action: string): EditorialReviewStatus {
  if (action.endsWith(".review_requested")) return "requested";
  if (action.endsWith(".review_changes_requested")) return "changes_requested";
  if (action.endsWith(".review_approved")) return "approved";
  return "none";
}

export type EditorialReviewState = {
  actorRole: EditorialReviewEvent["actorRole"] | null;
  currentVersion: number;
  documentId: string;
  documentType: EditorialDocumentType;
  note: string;
  published: boolean;
  requestedAt: Date | null;
  reviewVersion: number | null;
  stale: boolean;
  status: EditorialReviewStatus;
};

export function deriveEditorialReviewState(
  document: EditorialDocument,
  events: EditorialReviewEvent[],
): EditorialReviewState {
  const normalizedEvents = events.flatMap<CmsEditorialReviewEvent>((event) => {
    if (
      reviewActions.includes(event.action as (typeof reviewActions)[number])
    ) {
      const payload = reviewPayloadSchema.safeParse(event.after);
      const action = reviewStatusFromAction(event.action);
      if (!payload.success || action === "none") return [];
      return [
        {
          action,
          actorId: event.actorRole,
          documentId: document.documentId,
          documentType: document.documentType,
          note: payload.data.note,
          occurredAt: event.createdAt.toISOString(),
          version: payload.data.version,
        },
      ];
    }
    if (
      publishActions.includes(event.action as (typeof publishActions)[number])
    ) {
      const payload = publicationPayloadSchema.safeParse(event.after);
      if (!payload.success) return [];
      return [
        {
          action: "published",
          actorId: event.actorRole,
          documentId: document.documentId,
          documentType: document.documentType,
          note: "",
          occurredAt: event.createdAt.toISOString(),
          version: payload.data.version - 1,
        },
      ];
    }
    return [];
  });
  const state = deriveCmsEditorialReviewState(
    {
      documentId: document.documentId,
      documentType: document.documentType,
      publishedRevisionId: document.publishedRevisionId,
      status: document.status,
      version: document.version,
    },
    normalizedEvents,
  );

  return {
    actorRole: state.actorId as EditorialReviewEvent["actorRole"] | null,
    currentVersion: state.currentVersion,
    documentId: document.documentId,
    documentType: document.documentType,
    note: state.note,
    published: state.published,
    requestedAt: state.occurredAt ? new Date(state.occurredAt) : null,
    reviewVersion: state.reviewVersion,
    stale: state.stale,
    status: state.status,
  };
}

async function loadEditorialDocument(
  documentType: EditorialDocumentType,
  documentId: string,
): Promise<EditorialDocument> {
  const db = createDb();
  const document =
    documentType === "page"
      ? await db.query.pages.findFirst({ where: eq(pages.id, documentId) })
      : await db.query.posts.findFirst({ where: eq(posts.id, documentId) });

  if (!document) {
    throw new ContentWorkflowError("NOT_FOUND", "Content not found");
  }

  return {
    documentId: document.id,
    documentType,
    publishedRevisionId: document.publishedRevisionId,
    slug: document.slug,
    status: document.status,
    title: document.title,
    version: document.version,
  };
}

async function listEditorialReviewEvents(
  documentType: EditorialDocumentType,
  documentId: string,
) {
  const db = createDb();
  return db
    .select({
      action: auditEvents.action,
      actorRole: auditEvents.actorRole,
      after: auditEvents.after,
      createdAt: auditEvents.createdAt,
      id: auditEvents.id,
    })
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.entityType, documentType),
        eq(auditEvents.entityId, documentId),
        inArray(auditEvents.action, [...reviewActions, ...publishActions]),
      ),
    )
    .orderBy(desc(auditEvents.createdAt), sql`rowid desc`)
    .limit(50);
}

function assertExpectedVersion(actual: number, expected: number) {
  if (actual !== expected) {
    throw new ContentWorkflowError(
      "CONFLICT",
      `Content changed since it was loaded (expected version ${expected}, found ${actual})`,
    );
  }
}

export async function getEditorialReviewState(
  input: z.infer<typeof editorialReviewTargetSchema>,
) {
  const document = await loadEditorialDocument(
    input.documentType,
    input.documentId,
  );
  const events = await listEditorialReviewEvents(
    input.documentType,
    input.documentId,
  );
  return deriveEditorialReviewState(document, events);
}

export async function requestEditorialReview(
  input: z.infer<typeof requestEditorialReviewInputSchema>,
  actor: CmsActor,
) {
  const document = await loadEditorialDocument(
    input.documentType,
    input.documentId,
  );
  assertExpectedVersion(document.version, input.expectedVersion);
  const current = deriveEditorialReviewState(
    document,
    await listEditorialReviewEvents(input.documentType, input.documentId),
  );

  if (
    current.reviewVersion === document.version &&
    current.status === "requested"
  ) {
    return current;
  }
  if (current.reviewVersion === document.version && current.status !== "none") {
    throw new ContentWorkflowError(
      "CONFLICT",
      current.status === "approved"
        ? "This version is already approved"
        : "Save a new version before requesting review again",
    );
  }

  await recordContentAudit({
    action: `${input.documentType}.review_requested`,
    actor,
    after: { note: input.note, version: document.version },
    entityId: document.documentId,
    entityType: document.documentType,
  });

  return getEditorialReviewState(input);
}

export async function decideEditorialReview(
  input: z.infer<typeof decideEditorialReviewInputSchema>,
  actor: CmsActor,
) {
  const document = await loadEditorialDocument(
    input.documentType,
    input.documentId,
  );
  assertExpectedVersion(document.version, input.expectedVersion);
  const current = deriveEditorialReviewState(
    document,
    await listEditorialReviewEvents(input.documentType, input.documentId),
  );

  if (
    current.status !== "requested" ||
    current.reviewVersion !== document.version ||
    current.stale
  ) {
    throw new ContentWorkflowError(
      "CONFLICT",
      "Only the current requested version can be reviewed",
    );
  }

  await recordContentAudit({
    action: `${input.documentType}.review_${input.decision}`,
    actor,
    after: { note: input.note, version: document.version },
    before: { status: current.status, version: current.reviewVersion },
    entityId: document.documentId,
    entityType: document.documentType,
  });

  return getEditorialReviewState(input);
}

export async function listEditorialReviewQueue() {
  const db = createDb();
  const rankedReviewEvents = db
    .select({
      action: auditEvents.action,
      actorRole: auditEvents.actorRole,
      after: auditEvents.after,
      createdAt: auditEvents.createdAt,
      entityId: auditEvents.entityId,
      entityType: auditEvents.entityType,
      id: auditEvents.id,
      rank: sql<number>`row_number() over (
        partition by ${auditEvents.entityType}, ${auditEvents.entityId}
        order by ${auditEvents.createdAt} desc, rowid desc
      )`.as("review_rank"),
    })
    .from(auditEvents)
    .where(inArray(auditEvents.action, [...reviewActions]))
    .as("ranked_review_events");
  const events = await db
    .select({
      action: rankedReviewEvents.action,
      actorRole: rankedReviewEvents.actorRole,
      after: rankedReviewEvents.after,
      createdAt: rankedReviewEvents.createdAt,
      entityId: rankedReviewEvents.entityId,
      entityType: rankedReviewEvents.entityType,
      id: rankedReviewEvents.id,
    })
    .from(rankedReviewEvents)
    .where(
      and(
        eq(rankedReviewEvents.rank, 1),
        inArray(rankedReviewEvents.action, [
          "page.review_requested",
          "post.review_requested",
        ]),
      ),
    )
    .orderBy(desc(rankedReviewEvents.createdAt))
    .limit(50);
  const documents = await Promise.all(
    events.map(async (event) => {
      const documentType = editorialDocumentTypeSchema.safeParse(
        event.entityType,
      );
      if (!documentType.success) return null;
      try {
        const document = await loadEditorialDocument(
          documentType.data,
          event.entityId,
        );
        const payload = reviewPayloadSchema.safeParse(event.after);
        if (!payload.success) return null;
        return {
          ...deriveEditorialReviewState(document, [event]),
          slug: document.slug,
          title: document.title,
        };
      } catch (error) {
        if (error instanceof ContentWorkflowError && error.code === "NOT_FOUND")
          return null;
        throw error;
      }
    }),
  );

  return documents.filter(
    (document) =>
      document !== null && document.status === "requested" && !document.stale,
  );
}
