import { describe, expect, test } from "bun:test";
import {
  cmsCollaborationChannel,
  cmsCollaborationExtensionManifest,
  cmsCollaborationModule,
  createMemoryCmsCollaborationActivityFeed,
  createMemoryCmsCollaborationRealtimeTransport,
  createMemoryCmsCommentStore,
  createMemoryCmsPresenceStore,
  createMemoryCmsSoftLockStore,
  diffCmsCollaborationFieldBlocks,
  mergeCmsCollaborationFields,
} from "../src";

const document = {
  collection: "pages",
  documentId: "home",
  locale: "vi-VN",
} as const;

describe("CMS collaboration", () => {
  test("declares lifecycle, permissions, migration, admin, and uninstall policy", () => {
    expect(cmsCollaborationExtensionManifest).toMatchObject({
      id: "official/collaboration",
      data: { uninstall: { policy: "export-then-delete" } },
    });
    expect(cmsCollaborationModule).toMatchObject({
      id: "official-collaboration",
      manifest: { packageName: "@agency/cms-collaboration" },
    });
    expect(cmsCollaborationModule.permissions).toHaveLength(1);
    expect(cmsCollaborationModule.migrations).toHaveLength(1);
    expect(cmsCollaborationModule.admin).toHaveLength(2);
  });

  test("expires presence and safely reclaims soft locks", () => {
    let time = new Date("2026-08-21T01:00:00.000Z");
    const now = () => time;
    const presence = createMemoryCmsPresenceStore({ now, ttlMs: 1_000 });
    expect(
      presence.heartbeat({
        sessionId: "session-a",
        actorId: "ada",
        displayName: "Ada",
        target: { ...document, fieldPath: "hero.title" },
      }),
    ).toMatchObject({ editing: "field" });
    expect(presence.list(document)).toHaveLength(1);
    expect(() =>
      presence.heartbeat({
        sessionId: "session-a",
        actorId: "mallory",
        displayName: "Mallory",
        target: document,
      }),
    ).toThrow(/cannot change actors/);
    time = new Date("2026-08-21T01:00:01.001Z");
    expect(presence.list(document)).toHaveLength(0);

    time = new Date("2026-08-21T01:00:00.000Z");
    const locks = createMemoryCmsSoftLockStore({ now, defaultLeaseMs: 1_000 });
    const target = { ...document, fieldPath: "hero.title" };
    expect(
      locks.claim({ actorId: "ada", sessionId: "session-a", target }).status,
    ).toBe("acquired");
    expect(
      locks.claim({ actorId: "lin", sessionId: "session-b", target }).status,
    ).toBe("blocked");
    time = new Date("2026-08-21T01:00:01.001Z");
    expect(
      locks.claim({ actorId: "lin", sessionId: "session-b", target }).status,
    ).toBe("acquired");
    expect(
      locks.release({ actorId: "ada", sessionId: "session-a", target }),
    ).toBe(false);
  });

  test("anchors comments and explicit mentions, then resolves threads", () => {
    let id = 0;
    const comments = createMemoryCmsCommentStore({
      now: () => new Date("2026-08-21T02:00:00.000Z"),
      createId: (kind) => `${kind}-${++id}`,
    });
    const thread = comments.create({
      target: { ...document, fieldPath: "blocks", blockId: "hero-1" },
      authorId: "ada",
      body: "Please verify this claim.",
      mentions: ["lin", "lin"],
    });
    expect(thread.mentions).toEqual(["lin"]);
    expect(
      comments.reply({
        threadId: thread.id,
        authorId: "lin",
        body: "Verified against the source.",
        mentions: ["ada"],
      }).replies,
    ).toHaveLength(1);
    comments.setResolved({
      threadId: thread.id,
      actorId: "ada",
      resolved: true,
    });
    expect(
      comments.list({ status: "resolved", mentionedActorId: "ada" }),
    ).toHaveLength(1);
    expect(() =>
      comments.reply({
        threadId: thread.id,
        authorId: "lin",
        body: "Late reply",
      }),
    ).toThrow(/Resolved/);
  });

  test("merges independent fields and exposes field/block conflicts visually", () => {
    const merge = mergeCmsCollaborationFields({
      base: { title: "Old", summary: "Base", stable: true },
      current: { title: "Current", summary: "Base", stable: true },
      incoming: { title: "Incoming", summary: "Changed", stable: true },
    });
    expect(merge.merged).toEqual({
      title: "Current",
      summary: "Changed",
      stable: true,
    });
    expect(merge.conflicts.map((entry) => entry.field)).toEqual(["title"]);
    expect(
      mergeCmsCollaborationFields({
        base: { obsolete: true, stable: "value" },
        current: { obsolete: true, stable: "value" },
        incoming: { stable: "value" },
      }),
    ).toMatchObject({ clean: true, merged: { stable: "value" } });

    const diff = diffCmsCollaborationFieldBlocks({
      before: {
        title: "Before",
        blocks: [
          { id: "a", text: "A" },
          { id: "b", text: "B" },
        ],
      },
      after: {
        title: "After",
        blocks: [
          { id: "b", text: "B2" },
          { id: "c", text: "C" },
        ],
      },
    });
    expect(diff.fields).toMatchObject([{ field: "title", kind: "changed" }]);
    expect(diff.blocks.map(({ blockId, kind }) => [blockId, kind])).toEqual([
      ["a", "removed"],
      ["b", "changed"],
      ["c", "added"],
    ]);
  });

  test("filters activity and keeps realtime delivery behind an adapter", () => {
    const feed = createMemoryCmsCollaborationActivityFeed();
    const activity = feed.append({
      id: "activity-1",
      type: "comment.create",
      actorId: "ada",
      target: document,
      occurredAt: "2026-08-21T03:00:00.000Z",
      summary: "Created an inline comment.",
    });
    feed.append({
      id: "activity-2",
      type: "lock.acquire",
      actorId: "lin",
      target: document,
      occurredAt: "2026-08-21T03:01:00.000Z",
      summary: "Acquired a soft lock.",
    });
    expect(feed.list({ actorId: "ada", types: ["comment.create"] })).toEqual([
      activity,
    ]);

    const transport = createMemoryCmsCollaborationRealtimeTransport();
    const channel = cmsCollaborationChannel(document);
    const received: unknown[] = [];
    const unsubscribe = transport.subscribe(channel, (event) =>
      received.push(event),
    );
    transport.publish({ channel, activity });
    unsubscribe();
    transport.publish({ channel, activity });
    expect(received).toHaveLength(1);
  });
});
