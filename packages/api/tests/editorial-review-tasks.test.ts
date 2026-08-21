import { describe, expect, mock, test } from "bun:test";

mock.module("cloudflare:workers", () => ({
  env: {
    BETTER_AUTH_SECRET: "test-secret-that-is-long-enough-for-better-auth",
    BETTER_AUTH_URL: "http://localhost:3000",
    CORS_ORIGIN: "http://localhost:3000",
  },
}));

const {
  deriveEditorialReviewState,
  editorialReviewQueueInputSchema,
  editorialReviewRequestedOutboxValues,
  filterAndSortEditorialReviewQueue,
  isEquivalentEditorialReviewRequest,
  requestEditorialReviewInputSchema,
} = await import("../src/services/editorial-reviews");

const taskRequest = requestEditorialReviewInputSchema.parse({
  documentType: "page",
  documentId: "home",
  expectedVersion: 3,
  note: "Check launch copy",
  assigneeIds: ["reviewer-2", "reviewer-1", "reviewer-2"],
  assigneeRoles: ["owner"],
  mentionIds: ["editor-1"],
  dueAt: "2026-08-22T02:00:00.000Z",
  checklist: [
    { id: "legal-copy", label: "Legal copy", required: true },
    { id: "seo-preview", label: "SEO preview", required: false },
  ],
});

const requestedEvent = {
  id: "event-1",
  action: "page.review_requested",
  actorUserId: "requester-1",
  actorRole: "editor" as const,
  after: {
    note: taskRequest.note,
    version: 3,
    assigneeIds: taskRequest.assigneeIds,
    assigneeRoles: taskRequest.assigneeRoles,
    mentionIds: taskRequest.mentionIds,
    dueAt: taskRequest.dueAt,
    checklist: taskRequest.checklist,
    notify: taskRequest.notify,
  },
  createdAt: new Date("2026-08-21T02:00:00.000Z"),
};

function state() {
  return deriveEditorialReviewState(
    {
      documentId: "home",
      documentType: "page",
      publishedRevisionId: null,
      slug: "home",
      status: "draft",
      title: "Home",
      version: 3,
    },
    [requestedEvent],
  );
}

describe("editorial review workflow tasks", () => {
  test("normalizes assignments and preserves calendar/checklist metadata", () => {
    expect(taskRequest).toMatchObject({
      assigneeIds: ["reviewer-1", "reviewer-2"],
      assigneeRoles: ["owner"],
      mentionIds: ["editor-1"],
      notify: true,
    });
    expect(state()).toMatchObject({
      actorUserId: "requester-1",
      assigneeIds: ["reviewer-1", "reviewer-2"],
      dueAt: "2026-08-22T02:00:00.000Z",
      checklist: [
        { id: "legal-copy", completed: false },
        { id: "seo-preview", completed: false },
      ],
    });
  });

  test("makes retries exact while rejecting a divergent same-version request", () => {
    expect(
      isEquivalentEditorialReviewRequest(state(), taskRequest, "requester-1"),
    ).toBe(true);
    expect(
      isEquivalentEditorialReviewRequest(
        state(),
        { ...taskRequest, note: "Different handoff" },
        "requester-1",
      ),
    ).toBe(false);
  });

  test("orders the calendar queue by due date before undated work", () => {
    const filters = editorialReviewQueueInputSchema.parse({ limit: 3 });
    const base = {
      assigneeIds: ["reviewer-1"],
      overdue: false,
      requestedAt: new Date("2026-08-21T00:00:00.000Z"),
    };
    const ordered = filterAndSortEditorialReviewQueue(
      [
        { ...base, id: "undated", dueAt: null },
        { ...base, id: "later", dueAt: "2026-08-24T00:00:00.000Z" },
        { ...base, id: "earlier", dueAt: "2026-08-22T00:00:00.000Z" },
      ],
      filters,
    );
    expect(ordered.map((item) => item.id)).toEqual([
      "earlier",
      "later",
      "undated",
    ]);
    expect(
      filterAndSortEditorialReviewQueue(
        ordered,
        editorialReviewQueueInputSchema.parse({
          assigneeId: "reviewer-2",
        }),
      ),
    ).toEqual([]);
  });

  test("creates a deduplicated reliable notification outbox command", () => {
    const event = editorialReviewRequestedOutboxValues({
      actorUserId: "requester-1",
      documentId: "home",
      documentType: "page",
      occurredAt: new Date("2026-08-21T02:00:00.000Z"),
      task: taskRequest,
      version: 3,
    });
    expect(event).toMatchObject({
      topic: "content.page.review_requested",
      idempotencyKey: "content.page.review_requested:home:v3",
      status: "pending",
      payload: {
        notificationRecipientIds: ["reviewer-1", "reviewer-2", "editor-1"],
      },
    });
  });
});
