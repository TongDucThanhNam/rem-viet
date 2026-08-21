import {
  defineCmsExtensionPackageManifest,
  defineCmsFeatureModuleManifest,
  defineFeatureModule,
} from "@agency/cms-core";

export const cmsCollaborationExtensionManifest =
  defineCmsExtensionPackageManifest({
    schemaVersion: 1,
    id: "official/collaboration",
    packageName: "@agency/cms-collaboration",
    version: "0.1.0",
    classification: "official",
    cmsCompatibility: { minimum: "0.1.0", maximumExclusive: "1.0.0" },
    permissions: [
      {
        id: "official/collaboration/edit",
        capability: "content.write",
        description:
          "Publish presence, hold soft locks, and create or resolve editorial comments.",
      },
      {
        id: "official/collaboration/activity",
        capability: "audit.read",
        description: "Read the filtered editorial collaboration activity feed.",
      },
    ],
    secrets: [],
    routes: [],
    admin: [
      {
        id: "official/collaboration/document",
        slot: "document",
        label: "Collaboration",
        requiredCapability: "content.write",
      },
      {
        id: "official/collaboration/activity",
        slot: "dashboard",
        label: "Editorial activity",
        requiredCapability: "audit.read",
      },
    ],
    entrypoints: [
      {
        id: "official/collaboration/shared",
        export: ".",
        runtime: "shared",
        capabilities: [],
      },
    ],
    data: {
      schemaVersion: 1,
      migrations: [
        {
          id: "official/collaboration/v1",
          from: 0,
          to: 1,
          reversible: false,
        },
      ],
      uninstall: {
        policy: "export-then-delete",
        description:
          "Export comments and editorial activity, then delete them with ephemeral presence and locks.",
      },
    },
  });

export const cmsCollaborationModule = defineFeatureModule({
  id: "official-collaboration",
  manifest: defineCmsFeatureModuleManifest({
    schemaVersion: 1,
    packageName: "@agency/cms-collaboration",
    version: "0.1.0",
    cmsCompatibility: { minimum: "0.1.0", maximumExclusive: "1.0.0" },
    uninstall: {
      dataPolicy: "export-then-delete",
      description:
        "Export comments and editorial activity, then delete all collaboration data.",
    },
  }),
  permissions: [
    {
      id: "official-collaboration/edit",
      capability: "content.write",
      operations: ["create", "update", "delete"],
      description: "Use editorial presence, locks, and inline comments.",
    },
  ],
  migrations: [
    {
      id: "official-collaboration/v1",
      from: 0,
      to: 1,
      migrate: (state) =>
        state ?? { comments: [], activity: [], presence: [], locks: [] },
    },
  ],
  admin: [
    {
      id: "official-collaboration/document",
      placement: "document",
      label: "Collaboration",
    },
    {
      id: "official-collaboration/activity",
      placement: "dashboard",
      label: "Editorial activity",
    },
  ],
});

export type CmsCollaborationTarget = Readonly<{
  collection: string;
  documentId: string;
  locale?: string | null;
  fieldPath?: string | null;
  blockId?: string | null;
}>;

const collectionPattern = /^[a-z][a-z0-9-]{1,63}$/;
const identityPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const localePattern = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
const fieldPathPattern =
  /^[A-Za-z_][A-Za-z0-9_-]*(?:\.[A-Za-z_][A-Za-z0-9_-]*)*$/;

function requiredText(value: string, label: string, maximum = 256) {
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) {
    throw new Error(`${label} must contain 1-${maximum} characters.`);
  }
  return normalized;
}

function identity(value: string, label: string) {
  const normalized = requiredText(value, label, 128);
  if (!identityPattern.test(normalized)) {
    throw new Error(`${label} has an invalid format.`);
  }
  return normalized;
}

function instant(value: string | Date, label: string) {
  const date =
    value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime()))
    throw new Error(`${label} must be valid.`);
  return date;
}

export function normalizeCmsCollaborationTarget(
  input: CmsCollaborationTarget,
): CmsCollaborationTarget {
  const collection = requiredText(input.collection, "Collection", 64);
  if (!collectionPattern.test(collection)) {
    throw new Error("Collection must be a valid CMS collection slug.");
  }
  const documentId = identity(input.documentId, "Document ID");
  const locale = input.locale?.trim() || null;
  if (locale && !localePattern.test(locale))
    throw new Error("Locale is invalid.");
  const fieldPath = input.fieldPath?.trim() || null;
  if (fieldPath && !fieldPathPattern.test(fieldPath)) {
    throw new Error("Field path is invalid.");
  }
  const blockId = input.blockId?.trim() || null;
  if (blockId) identity(blockId, "Block ID");
  if (blockId && !fieldPath) {
    throw new Error("A block anchor requires a field path.");
  }
  return Object.freeze({ collection, documentId, locale, fieldPath, blockId });
}

export function cmsCollaborationTargetKey(input: CmsCollaborationTarget) {
  const target = normalizeCmsCollaborationTarget(input);
  return [
    target.collection,
    target.documentId,
    target.locale ?? "*",
    target.fieldPath ?? "*",
    target.blockId ?? "*",
  ]
    .map(encodeURIComponent)
    .join("/");
}

function targetMatches(
  value: CmsCollaborationTarget,
  filter: Partial<CmsCollaborationTarget> | undefined,
) {
  if (!filter) return true;
  return (Object.keys(filter) as Array<keyof CmsCollaborationTarget>).every(
    (key) => filter[key] === undefined || value[key] === filter[key],
  );
}

export type CmsPresence = Readonly<{
  sessionId: string;
  actorId: string;
  displayName: string;
  target: CmsCollaborationTarget;
  editing: "document" | "field" | "block";
  lastSeenAt: string;
  expiresAt: string;
}>;

export function createMemoryCmsPresenceStore(input?: {
  now?: () => Date;
  ttlMs?: number;
  maximumEntries?: number;
}) {
  const now = input?.now ?? (() => new Date());
  const ttlMs = input?.ttlMs ?? 30_000;
  const maximumEntries = input?.maximumEntries ?? 1_000;
  if (!Number.isInteger(ttlMs) || ttlMs < 1_000 || ttlMs > 300_000) {
    throw new Error("Presence TTL must be 1-300 seconds.");
  }
  if (
    !Number.isInteger(maximumEntries) ||
    maximumEntries < 1 ||
    maximumEntries > 10_000
  ) {
    throw new Error("Presence entry limit must be 1-10,000.");
  }
  const entries = new Map<string, CmsPresence>();

  const prune = (at: Date) => {
    for (const [sessionId, entry] of entries) {
      if (instant(entry.expiresAt, "Presence expiry") <= at)
        entries.delete(sessionId);
    }
  };

  return Object.freeze({
    heartbeat(value: {
      sessionId: string;
      actorId: string;
      displayName: string;
      target: CmsCollaborationTarget;
    }): CmsPresence {
      const at = instant(now(), "Current time");
      prune(at);
      const sessionId = identity(value.sessionId, "Session ID");
      const actorId = identity(value.actorId, "Actor ID");
      const current = entries.get(sessionId);
      if (current && current.actorId !== actorId) {
        throw new Error("A presence session cannot change actors.");
      }
      if (!entries.has(sessionId) && entries.size >= maximumEntries) {
        throw new Error("Presence entry limit exceeded.");
      }
      const target = normalizeCmsCollaborationTarget(value.target);
      const editing = target.blockId
        ? "block"
        : target.fieldPath
          ? "field"
          : "document";
      const entry: CmsPresence = Object.freeze({
        sessionId,
        actorId,
        displayName: requiredText(value.displayName, "Display name", 160),
        target,
        editing,
        lastSeenAt: at.toISOString(),
        expiresAt: new Date(at.getTime() + ttlMs).toISOString(),
      });
      entries.set(sessionId, entry);
      return entry;
    },
    leave(sessionId: string) {
      return entries.delete(identity(sessionId, "Session ID"));
    },
    list(filter?: Partial<CmsCollaborationTarget>) {
      const at = instant(now(), "Current time");
      prune(at);
      return Object.freeze(
        [...entries.values()]
          .filter((entry) => targetMatches(entry.target, filter))
          .sort(
            (left, right) =>
              left.actorId.localeCompare(right.actorId) ||
              left.sessionId.localeCompare(right.sessionId),
          ),
      );
    },
  });
}

export type CmsSoftLock = Readonly<{
  key: string;
  ownerActorId: string;
  ownerSessionId: string;
  target: CmsCollaborationTarget;
  acquiredAt: string;
  expiresAt: string;
}>;

export type CmsSoftLockClaim = Readonly<{
  status: "acquired" | "renewed" | "blocked";
  lock: CmsSoftLock;
}>;

export function createMemoryCmsSoftLockStore(input?: {
  now?: () => Date;
  defaultLeaseMs?: number;
  maximumEntries?: number;
}) {
  const now = input?.now ?? (() => new Date());
  const defaultLeaseMs = input?.defaultLeaseMs ?? 60_000;
  const maximumEntries = input?.maximumEntries ?? 5_000;
  if (
    !Number.isInteger(defaultLeaseMs) ||
    defaultLeaseMs < 1_000 ||
    defaultLeaseMs > 600_000
  ) {
    throw new Error("Default lock lease must be 1-600 seconds.");
  }
  if (
    !Number.isInteger(maximumEntries) ||
    maximumEntries < 1 ||
    maximumEntries > 50_000
  ) {
    throw new Error("Soft-lock entry limit must be 1-50,000.");
  }
  const entries = new Map<string, CmsSoftLock>();

  const prune = (at: Date) => {
    for (const [key, lock] of entries) {
      if (instant(lock.expiresAt, "Lock expiry") <= at) entries.delete(key);
    }
  };

  return Object.freeze({
    claim(value: {
      actorId: string;
      sessionId: string;
      target: CmsCollaborationTarget;
      leaseMs?: number;
    }): CmsSoftLockClaim {
      const at = instant(now(), "Current time");
      prune(at);
      const target = normalizeCmsCollaborationTarget(value.target);
      const key = cmsCollaborationTargetKey(target);
      const actorId = identity(value.actorId, "Actor ID");
      const sessionId = identity(value.sessionId, "Session ID");
      const leaseMs = value.leaseMs ?? defaultLeaseMs;
      if (!Number.isInteger(leaseMs) || leaseMs < 1_000 || leaseMs > 600_000) {
        throw new Error("Lock lease must be 1-600 seconds.");
      }
      const current = entries.get(key);
      if (
        current &&
        (current.ownerActorId !== actorId ||
          current.ownerSessionId !== sessionId)
      ) {
        return Object.freeze({ status: "blocked" as const, lock: current });
      }
      if (!current && entries.size >= maximumEntries) {
        throw new Error("Soft-lock entry limit exceeded.");
      }
      const lock: CmsSoftLock = Object.freeze({
        key,
        ownerActorId: actorId,
        ownerSessionId: sessionId,
        target,
        acquiredAt: current?.acquiredAt ?? at.toISOString(),
        expiresAt: new Date(at.getTime() + leaseMs).toISOString(),
      });
      entries.set(key, lock);
      return Object.freeze({
        status: current ? ("renewed" as const) : ("acquired" as const),
        lock,
      });
    },
    release(value: {
      actorId: string;
      sessionId: string;
      target: CmsCollaborationTarget;
    }) {
      const key = cmsCollaborationTargetKey(value.target);
      const current = entries.get(key);
      if (!current) return false;
      if (
        current.ownerActorId !== identity(value.actorId, "Actor ID") ||
        current.ownerSessionId !== identity(value.sessionId, "Session ID")
      ) {
        return false;
      }
      return entries.delete(key);
    },
    list(filter?: Partial<CmsCollaborationTarget>) {
      const at = instant(now(), "Current time");
      prune(at);
      return Object.freeze(
        [...entries.values()]
          .filter((entry) => targetMatches(entry.target, filter))
          .sort((left, right) => left.key.localeCompare(right.key)),
      );
    },
  });
}

export type CmsCommentReply = Readonly<{
  id: string;
  authorId: string;
  body: string;
  mentions: readonly string[];
  createdAt: string;
}>;

export type CmsCommentThread = Readonly<{
  id: string;
  target: CmsCollaborationTarget;
  authorId: string;
  body: string;
  mentions: readonly string[];
  createdAt: string;
  status: "open" | "resolved";
  resolvedAt: string | null;
  resolvedBy: string | null;
  replies: readonly CmsCommentReply[];
}>;

function mentions(values: readonly string[] | undefined) {
  if ((values?.length ?? 0) > 50)
    throw new Error("A comment may mention at most 50 actors.");
  return Object.freeze(
    [
      ...new Set(
        (values ?? []).map((value) => identity(value, "Mention actor ID")),
      ),
    ].sort(),
  );
}

export function createMemoryCmsCommentStore(input?: {
  now?: () => Date;
  createId?: (kind: "thread" | "reply") => string;
  maximumThreads?: number;
}) {
  const now = input?.now ?? (() => new Date());
  const createId = input?.createId ?? (() => crypto.randomUUID());
  const maximumThreads = input?.maximumThreads ?? 10_000;
  if (
    !Number.isInteger(maximumThreads) ||
    maximumThreads < 1 ||
    maximumThreads > 100_000
  ) {
    throw new Error("Comment thread limit must be 1-100,000.");
  }
  const entries = new Map<string, CmsCommentThread>();

  const existing = (id: string) => {
    const thread = entries.get(identity(id, "Thread ID"));
    if (!thread) throw new Error("Comment thread was not found.");
    return thread;
  };

  return Object.freeze({
    create(value: {
      target: CmsCollaborationTarget;
      authorId: string;
      body: string;
      mentions?: readonly string[];
    }) {
      if (entries.size >= maximumThreads)
        throw new Error("Comment thread limit exceeded.");
      const id = identity(createId("thread"), "Thread ID");
      if (entries.has(id))
        throw new Error(`Duplicate comment thread ID "${id}".`);
      const thread: CmsCommentThread = Object.freeze({
        id,
        target: normalizeCmsCollaborationTarget(value.target),
        authorId: identity(value.authorId, "Author ID"),
        body: requiredText(value.body, "Comment body", 5_000),
        mentions: mentions(value.mentions),
        createdAt: instant(now(), "Current time").toISOString(),
        status: "open",
        resolvedAt: null,
        resolvedBy: null,
        replies: Object.freeze([]),
      });
      entries.set(id, thread);
      return thread;
    },
    reply(value: {
      threadId: string;
      authorId: string;
      body: string;
      mentions?: readonly string[];
    }) {
      const thread = existing(value.threadId);
      if (thread.status === "resolved")
        throw new Error("Resolved threads cannot receive replies.");
      if (thread.replies.length >= 1_000)
        throw new Error("Comment reply limit exceeded.");
      const reply: CmsCommentReply = Object.freeze({
        id: identity(createId("reply"), "Reply ID"),
        authorId: identity(value.authorId, "Author ID"),
        body: requiredText(value.body, "Reply body", 5_000),
        mentions: mentions(value.mentions),
        createdAt: instant(now(), "Current time").toISOString(),
      });
      if (thread.replies.some((entry) => entry.id === reply.id)) {
        throw new Error(`Duplicate comment reply ID "${reply.id}".`);
      }
      const updated = Object.freeze({
        ...thread,
        replies: Object.freeze([...thread.replies, reply]),
      });
      entries.set(thread.id, updated);
      return updated;
    },
    setResolved(value: {
      threadId: string;
      actorId: string;
      resolved: boolean;
    }) {
      const thread = existing(value.threadId);
      const at = instant(now(), "Current time").toISOString();
      const updated: CmsCommentThread = Object.freeze({
        ...thread,
        status: value.resolved ? "resolved" : "open",
        resolvedAt: value.resolved ? at : null,
        resolvedBy: value.resolved ? identity(value.actorId, "Actor ID") : null,
      });
      entries.set(thread.id, updated);
      return updated;
    },
    list(filter?: {
      target?: Partial<CmsCollaborationTarget>;
      status?: "open" | "resolved";
      mentionedActorId?: string;
    }) {
      const mentionedActorId = filter?.mentionedActorId
        ? identity(filter.mentionedActorId, "Mention actor ID")
        : null;
      return Object.freeze(
        [...entries.values()]
          .filter(
            (thread) =>
              targetMatches(thread.target, filter?.target) &&
              (!filter?.status || thread.status === filter.status) &&
              (!mentionedActorId ||
                thread.mentions.includes(mentionedActorId) ||
                thread.replies.some((reply) =>
                  reply.mentions.includes(mentionedActorId),
                )),
          )
          .sort(
            (left, right) =>
              left.createdAt.localeCompare(right.createdAt) ||
              left.id.localeCompare(right.id),
          ),
      );
    },
  });
}

type CmsJsonPrimitive = string | number | boolean | null;
export type CmsJsonValue =
  | CmsJsonPrimitive
  | readonly CmsJsonValue[]
  | Readonly<{ [key: string]: CmsJsonValue }>;

function normalizeJson(
  value: unknown,
  state = { nodes: 0 },
  depth = 0,
): CmsJsonValue {
  state.nodes += 1;
  if (state.nodes > 5_000 || depth > 12)
    throw new Error("Collaboration value is too complex.");
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new Error("Collaboration values require finite numbers.");
    return value;
  }
  if (Array.isArray(value)) {
    return Object.freeze(
      value.map((entry) => normalizeJson(entry, state, depth + 1)),
    );
  }
  if (
    typeof value !== "object" ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new Error("Collaboration values must contain plain JSON data.");
  }
  const output: Record<string, CmsJsonValue> = {};
  for (const [key, entry] of Object.entries(
    value as Record<string, unknown>,
  ).sort(([a], [b]) => a.localeCompare(b))) {
    if (!key || key.length > 128)
      throw new Error("Collaboration object key is invalid.");
    output[key] = normalizeJson(entry, state, depth + 1);
  }
  return Object.freeze(output);
}

function canonical(value: unknown) {
  return value === undefined
    ? "__cms_collaboration_undefined__"
    : JSON.stringify(normalizeJson(value));
}

export type CmsFieldMergeConflict = Readonly<{
  field: string;
  base: CmsJsonValue | undefined;
  current: CmsJsonValue | undefined;
  incoming: CmsJsonValue | undefined;
}>;

export function mergeCmsCollaborationFields(input: {
  base: Readonly<Record<string, unknown>>;
  current: Readonly<Record<string, unknown>>;
  incoming: Readonly<Record<string, unknown>>;
}) {
  const base = normalizeJson(input.base) as Readonly<
    Record<string, CmsJsonValue>
  >;
  const current = normalizeJson(input.current) as Readonly<
    Record<string, CmsJsonValue>
  >;
  const incoming = normalizeJson(input.incoming) as Readonly<
    Record<string, CmsJsonValue>
  >;
  const merged: Record<string, CmsJsonValue> = {};
  const conflicts: CmsFieldMergeConflict[] = [];
  const fields = [
    ...new Set([
      ...Object.keys(base),
      ...Object.keys(current),
      ...Object.keys(incoming),
    ]),
  ].sort();
  for (const field of fields) {
    const before = base[field];
    const present = current[field];
    const proposed = incoming[field];
    if (canonical(present) === canonical(proposed)) {
      if (present !== undefined) merged[field] = present;
    } else if (canonical(present) === canonical(before)) {
      if (proposed !== undefined) merged[field] = proposed;
    } else if (canonical(proposed) === canonical(before)) {
      if (present !== undefined) merged[field] = present;
    } else {
      if (present !== undefined) merged[field] = present;
      conflicts.push(
        Object.freeze({
          field,
          base: before,
          current: present,
          incoming: proposed,
        }),
      );
    }
  }
  return Object.freeze({
    merged: Object.freeze(merged),
    conflicts: Object.freeze(conflicts),
    clean: conflicts.length === 0,
  });
}

export type CmsFieldVisualDiff = Readonly<{
  field: string;
  kind: "added" | "removed" | "changed";
  before?: CmsJsonValue;
  after?: CmsJsonValue;
}>;

export type CmsBlockVisualDiff = Readonly<{
  blockId: string;
  kind: "added" | "removed" | "changed" | "moved";
  beforeIndex: number | null;
  afterIndex: number | null;
  before?: CmsJsonValue;
  after?: CmsJsonValue;
}>;

function blockMap(value: CmsJsonValue | undefined, field: string) {
  if (value === undefined)
    return new Map<string, { index: number; value: CmsJsonValue }>();
  if (!Array.isArray(value))
    throw new Error(`Block field "${field}" must be an array.`);
  const output = new Map<string, { index: number; value: CmsJsonValue }>();
  value.forEach((entry, index) => {
    if (!entry || Array.isArray(entry) || typeof entry !== "object") {
      throw new Error(`Block ${index} in "${field}" must be an object.`);
    }
    const id = (entry as Readonly<Record<string, CmsJsonValue>>).id;
    if (typeof id !== "string")
      throw new Error(`Block ${index} in "${field}" needs an ID.`);
    identity(id, "Block ID");
    if (output.has(id)) throw new Error(`Duplicate block ID "${id}".`);
    output.set(id, { index, value: entry });
  });
  return output;
}

export function diffCmsCollaborationFieldBlocks(input: {
  before: Readonly<Record<string, unknown>>;
  after: Readonly<Record<string, unknown>>;
  blockFields?: readonly string[];
}) {
  const before = normalizeJson(input.before) as Readonly<
    Record<string, CmsJsonValue>
  >;
  const after = normalizeJson(input.after) as Readonly<
    Record<string, CmsJsonValue>
  >;
  const blockFields = new Set(
    (input.blockFields ?? ["blocks"]).map((field) =>
      requiredText(field, "Block field", 128),
    ),
  );
  const fields: CmsFieldVisualDiff[] = [];
  const blocks: CmsBlockVisualDiff[] = [];
  for (const field of [
    ...new Set([...Object.keys(before), ...Object.keys(after)]),
  ].sort()) {
    if (!blockFields.has(field)) {
      if (canonical(before[field]) === canonical(after[field])) continue;
      fields.push(
        Object.freeze({
          field,
          kind:
            before[field] === undefined
              ? "added"
              : after[field] === undefined
                ? "removed"
                : "changed",
          ...(before[field] === undefined ? {} : { before: before[field] }),
          ...(after[field] === undefined ? {} : { after: after[field] }),
        }),
      );
      continue;
    }
    const left = blockMap(before[field], field);
    const right = blockMap(after[field], field);
    for (const id of [...new Set([...left.keys(), ...right.keys()])].sort()) {
      const oldBlock = left.get(id);
      const newBlock = right.get(id);
      if (!oldBlock) {
        blocks.push(
          Object.freeze({
            blockId: id,
            kind: "added",
            beforeIndex: null,
            afterIndex: newBlock!.index,
            after: newBlock!.value,
          }),
        );
      } else if (!newBlock) {
        blocks.push(
          Object.freeze({
            blockId: id,
            kind: "removed",
            beforeIndex: oldBlock.index,
            afterIndex: null,
            before: oldBlock.value,
          }),
        );
      } else if (canonical(oldBlock.value) !== canonical(newBlock.value)) {
        blocks.push(
          Object.freeze({
            blockId: id,
            kind: "changed",
            beforeIndex: oldBlock.index,
            afterIndex: newBlock.index,
            before: oldBlock.value,
            after: newBlock.value,
          }),
        );
      } else if (oldBlock.index !== newBlock.index) {
        blocks.push(
          Object.freeze({
            blockId: id,
            kind: "moved",
            beforeIndex: oldBlock.index,
            afterIndex: newBlock.index,
          }),
        );
      }
    }
  }
  return Object.freeze({
    fields: Object.freeze(fields),
    blocks: Object.freeze(blocks),
  });
}

export const cmsCollaborationActivityTypes = Object.freeze([
  "presence.heartbeat",
  "presence.leave",
  "lock.acquire",
  "lock.release",
  "comment.create",
  "comment.reply",
  "comment.resolve",
  "comment.reopen",
  "document.merge",
] as const);
export type CmsCollaborationActivityType =
  (typeof cmsCollaborationActivityTypes)[number];

export type CmsCollaborationActivity = Readonly<{
  id: string;
  type: CmsCollaborationActivityType;
  actorId: string;
  target: CmsCollaborationTarget;
  occurredAt: string;
  summary: string;
}>;

export function createMemoryCmsCollaborationActivityFeed(input?: {
  maximumEntries?: number;
}) {
  const maximumEntries = input?.maximumEntries ?? 5_000;
  if (
    !Number.isInteger(maximumEntries) ||
    maximumEntries < 1 ||
    maximumEntries > 50_000
  ) {
    throw new Error("Activity entry limit must be 1-50,000.");
  }
  const entries: CmsCollaborationActivity[] = [];
  return Object.freeze({
    append(value: CmsCollaborationActivity) {
      if (!cmsCollaborationActivityTypes.includes(value.type))
        throw new Error("Activity type is invalid.");
      const entry: CmsCollaborationActivity = Object.freeze({
        id: identity(value.id, "Activity ID"),
        type: value.type,
        actorId: identity(value.actorId, "Actor ID"),
        target: normalizeCmsCollaborationTarget(value.target),
        occurredAt: instant(value.occurredAt, "Activity time").toISOString(),
        summary: requiredText(value.summary, "Activity summary", 300),
      });
      if (entries.some((current) => current.id === entry.id))
        throw new Error(`Duplicate activity ID "${entry.id}".`);
      entries.push(entry);
      if (entries.length > maximumEntries)
        entries.splice(0, entries.length - maximumEntries);
      return entry;
    },
    list(filter?: {
      types?: readonly CmsCollaborationActivityType[];
      actorId?: string;
      target?: Partial<CmsCollaborationTarget>;
      since?: string;
      until?: string;
      limit?: number;
    }) {
      const actorId = filter?.actorId
        ? identity(filter.actorId, "Actor ID")
        : null;
      const since = filter?.since
        ? instant(filter.since, "Activity start").toISOString()
        : null;
      const until = filter?.until
        ? instant(filter.until, "Activity end").toISOString()
        : null;
      const limit = filter?.limit ?? 100;
      if (!Number.isInteger(limit) || limit < 1 || limit > 500)
        throw new Error("Activity limit must be 1-500.");
      if (since && until && since > until)
        throw new Error("Activity start must not exceed end.");
      return Object.freeze(
        entries
          .filter(
            (entry) =>
              (!filter?.types || filter.types.includes(entry.type)) &&
              (!actorId || entry.actorId === actorId) &&
              targetMatches(entry.target, filter?.target) &&
              (!since || entry.occurredAt >= since) &&
              (!until || entry.occurredAt <= until),
          )
          .sort(
            (left, right) =>
              right.occurredAt.localeCompare(left.occurredAt) ||
              left.id.localeCompare(right.id),
          )
          .slice(0, limit),
      );
    },
  });
}

export type CmsCollaborationRealtimeEvent = Readonly<{
  channel: string;
  activity: CmsCollaborationActivity;
}>;

export interface CmsCollaborationRealtimeTransport {
  publish(event: CmsCollaborationRealtimeEvent): void | Promise<void>;
  subscribe(
    channel: string,
    listener: (event: CmsCollaborationRealtimeEvent) => void,
  ): () => void;
}

export function cmsCollaborationChannel(target: CmsCollaborationTarget) {
  const normalized = normalizeCmsCollaborationTarget(target);
  return `cms-collaboration/${encodeURIComponent(normalized.collection)}/${encodeURIComponent(normalized.documentId)}/${encodeURIComponent(normalized.locale ?? "*")}`;
}

export function createMemoryCmsCollaborationRealtimeTransport(): CmsCollaborationRealtimeTransport {
  const listeners = new Map<
    string,
    Set<(event: CmsCollaborationRealtimeEvent) => void>
  >();
  return Object.freeze({
    publish(event: CmsCollaborationRealtimeEvent) {
      const expected = cmsCollaborationChannel(event.activity.target);
      if (event.channel !== expected)
        throw new Error("Realtime event channel does not match its target.");
      for (const listener of [...(listeners.get(event.channel) ?? [])])
        listener(event);
    },
    subscribe(
      channel: string,
      listener: (event: CmsCollaborationRealtimeEvent) => void,
    ) {
      requiredText(channel, "Realtime channel", 512);
      const channelListeners = listeners.get(channel) ?? new Set();
      channelListeners.add(listener);
      listeners.set(channel, channelListeners);
      return () => {
        channelListeners.delete(listener);
        if (!channelListeners.size) listeners.delete(channel);
      };
    },
  });
}
