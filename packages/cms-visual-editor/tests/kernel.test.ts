import { describe, expect, test } from "bun:test";
import {
  applyCmsVisualCommand,
  assertCmsVisualAdapterRoundTrip,
  canCmsVisualAction,
  commitCmsDraftHistory,
  createCmsDraftHistory,
  createCmsVisualComponentRegistry,
  createCmsVisualEditorSelectionMessage,
  createCmsVisualMigrationRegistry,
  createCmsVisualPreviewEnvelope,
  createCmsVisualPreviewResponseHeaders,
  defineCmsVisualComponent,
  initialCmsVisualPreviewReplayState,
  isCmsVisualEditorMessage,
  migrateCmsVisualDocument,
  normalizeCmsVisualSelection,
  parseCmsVisualDocument,
  redoCmsDraftHistory,
  undoCmsDraftHistory,
  validateCmsVisualPreviewEnvelope,
  type CmsVisualDocument,
  type CmsVisualEditorAdapter,
  type CmsVisualNode,
  type CmsVisualPreviewIdentity,
} from "../src";

type TextData = { text: string };
const parseText = (value: unknown): TextData => {
  if (
    !value ||
    typeof value !== "object" ||
    typeof (value as { text?: unknown }).text !== "string"
  ) {
    throw new Error("text required");
  }
  return value as TextData;
};

const registry = createCmsVisualComponentRegistry([
  defineCmsVisualComponent({
    type: "hero",
    schemaVersion: 1,
    fields: [
      {
        path: "text",
        label: "Heading",
        kind: "text",
        editCapabilities: ["visual.field.edit"],
      },
    ],
    defaults: () => ({ text: "Hero" }),
    validate: parseText,
    renderer: "hero-renderer",
    editor: "hero-editor",
    constraints: { min: 1, max: 1, pinned: "start" },
    actionCapabilities: {
      edit: ["visual.component.edit"],
      move: ["visual.component.move"],
      remove: ["visual.component.remove"],
    },
  }),
  defineCmsVisualComponent({
    type: "layout",
    schemaVersion: 1,
    fields: [],
    defaults: () => ({}),
    validate: (value) => {
      if (!value || typeof value !== "object")
        throw new Error("layout data required");
      return value;
    },
    renderer: "layout-renderer",
    editor: "layout-editor",
    constraints: { allowedChildren: ["textBlock"], max: 2 },
  }),
  defineCmsVisualComponent({
    type: "textBlock",
    schemaVersion: 1,
    fields: [{ path: "text", label: "Text", kind: "text" }],
    defaults: () => ({ text: "Text" }),
    validate: parseText,
    renderer: "text-renderer",
    editor: "text-editor",
    constraints: { allowedParents: ["layout"] },
  }),
]);

const document = (): CmsVisualDocument => ({
  id: "page-1",
  siteId: "site-1",
  schemaVersion: 1,
  version: 2,
  nodes: [
    {
      id: "hero-1",
      type: "hero",
      schemaVersion: 1,
      enabled: true,
      data: { text: "Hero" },
    },
    {
      id: "layout-1",
      type: "layout",
      schemaVersion: 1,
      enabled: true,
      data: {},
      slots: {
        content: [
          {
            id: "text-1",
            type: "textBlock",
            schemaVersion: 1,
            enabled: true,
            data: { text: "One" },
          },
        ],
      },
    },
  ],
});

describe("visual component registry", () => {
  test("validates canonical IDs, nested constraints, and cardinality", () => {
    expect(parseCmsVisualDocument(document(), registry)).toEqual(document());
    expect(() =>
      parseCmsVisualDocument(
        {
          ...document(),
          nodes: [...document().nodes, document().nodes[0] as CmsVisualNode],
        },
        registry,
      ),
    ).toThrow("Duplicate visual node ID");
  });

  test("rejects duplicate fields and unknown child registrations", () => {
    expect(() =>
      defineCmsVisualComponent({
        type: "bad",
        schemaVersion: 1,
        fields: [
          { path: "title", label: "A", kind: "text" },
          { path: "title", label: "B", kind: "text" },
        ],
        defaults: () => ({}),
        validate: () => ({}),
        renderer: "r",
        editor: "e",
      }),
    ).toThrow("Duplicate visual field path");
  });

  test("normalizes stale selections without coupling to a UI library", () => {
    expect(
      normalizeCmsVisualSelection({
        selection: { nodeId: "hero-1", fieldPath: "text" },
        nodeIds: new Set(["hero-1"]),
      }),
    ).toEqual({ nodeId: "hero-1", fieldPath: "text" });
    expect(
      normalizeCmsVisualSelection({
        selection: { nodeId: "deleted-node", fieldPath: "text" },
        nodeIds: new Set(["hero-1"]),
      }),
    ).toEqual({ nodeId: null });
  });
});

describe("permissions and commands", () => {
  const grants = new Set(["visual.component.edit", "visual.field.edit"]);

  test("fails closed for missing component and field capabilities", () => {
    expect(
      canCmsVisualAction({
        registry,
        nodeType: "hero",
        action: "edit",
        grants,
        fieldPath: "text",
      }),
    ).toBe(true);
    expect(
      canCmsVisualAction({
        registry,
        nodeType: "hero",
        action: "remove",
        grants,
      }),
    ).toBe(false);
    expect(
      canCmsVisualAction({
        registry,
        nodeType: "hero",
        action: "edit",
        grants,
        fieldPath: "missing",
      }),
    ).toBe(false);
  });

  test("updates fields and composes nested slots without bypassing validation", () => {
    const updated = applyCmsVisualCommand({
      document: document(),
      registry,
      grants,
      command: {
        type: "update-field",
        nodeId: "hero-1",
        fieldPath: "text",
        value: "Updated",
      },
    });
    expect((updated.nodes[0]?.data as TextData).text).toBe("Updated");
    expect(updated.version).toBe(3);

    const inserted = applyCmsVisualCommand({
      document: updated,
      registry,
      grants,
      command: {
        type: "insert",
        location: { parentId: "layout-1", slot: "content", index: 1 },
        node: {
          id: "text-2",
          type: "textBlock",
          schemaVersion: 1,
          enabled: true,
          data: { text: "Two" },
        },
      },
    });
    expect(inserted.nodes[1]?.slots?.content).toHaveLength(2);
  });

  test("rejects a forbidden remove before mutation", () => {
    expect(() =>
      applyCmsVisualCommand({
        document: document(),
        registry,
        grants,
        command: { type: "remove", nodeId: "hero-1" },
      }),
    ).toThrow("permission denied");
  });
});

describe("history, migrations, and adapters", () => {
  test("keeps bounded branch-safe undo and redo", () => {
    let history = createCmsDraftHistory("a");
    history = commitCmsDraftHistory(history, "b", { group: "title", now: 1 });
    history = commitCmsDraftHistory(history, "c", { group: "title", now: 2 });
    expect(history.past).toEqual(["a"]);
    history = undoCmsDraftHistory(history);
    expect(history.present).toBe("a");
    history = redoCmsDraftHistory(history);
    expect(history.present).toBe("c");
    history = commitCmsDraftHistory(history, "d");
    expect(history.future).toEqual([]);
  });

  test("runs contiguous document migrations and rejects identity drift", () => {
    const migrations = createCmsVisualMigrationRegistry({
      currentVersion: 2,
      migrations: [
        {
          id: "document-v2",
          from: 1,
          to: 2,
          migrate: (value) => ({ ...value, schemaVersion: 2 }),
        },
      ],
    });
    expect(
      migrateCmsVisualDocument({
        document: document(),
        migrations,
        components: registry,
      }).schemaVersion,
    ).toBe(2);
  });

  test("keeps editor-library state behind a canonical round-trip adapter", () => {
    type State = { value: CmsVisualDocument };
    const adapter: CmsVisualEditorAdapter<State> = {
      id: "custom",
      version: "1",
      capabilities: {
        clickToEdit: true,
        dragAndDrop: true,
        nestedSlots: true,
        responsivePreview: true,
        keyboardComposition: true,
      },
      fromCanonical: (value) => ({ value }),
      toCanonical: (state) => state.value,
    };
    expect(() =>
      assertCmsVisualAdapterRoundTrip({ adapter, document: document() }),
    ).not.toThrow();
  });
});

describe("preview security", () => {
  const identity: CmsVisualPreviewIdentity = {
    siteId: "site-1",
    documentId: "page-1",
    documentType: "standardPage",
    sessionId: "session-1234",
    sessionBinding: "binding-1234",
    documentVersion: 4,
    conflictToken: "conflict-1234",
  };

  test("binds messages to origin, session, document, version, and monotonic sequence", () => {
    const envelope = createCmsVisualPreviewEnvelope({
      source: "preview",
      messageId: "message-0001",
      sequence: 1,
      issuedAt: 10_000,
      identity,
      payload: { type: "ready" },
    });
    const accepted = validateCmsVisualPreviewEnvelope({
      value: envelope,
      origin: "https://admin.example.test",
      allowedOrigins: new Set(["https://admin.example.test"]),
      expectedSource: "preview",
      expectedIdentity: identity,
      replay: initialCmsVisualPreviewReplayState(),
      now: 10_100,
    });
    expect(accepted.accepted).toBe(true);
    if (!accepted.accepted) throw new Error("expected accepted envelope");
    expect(
      validateCmsVisualPreviewEnvelope({
        value: envelope,
        origin: "https://admin.example.test",
        allowedOrigins: new Set(["https://admin.example.test"]),
        expectedSource: "preview",
        expectedIdentity: identity,
        replay: accepted.replay,
        now: 10_200,
      }),
    ).toMatchObject({ accepted: false, reason: "replay" });

    expect(
      validateCmsVisualPreviewEnvelope({
        value: {
          ...envelope,
          identity: {
            conflictToken: identity.conflictToken,
            documentVersion: identity.documentVersion,
            sessionBinding: identity.sessionBinding,
            sessionId: identity.sessionId,
            documentType: identity.documentType,
            documentId: identity.documentId,
            siteId: identity.siteId,
          },
          messageId: "message-0003",
          sequence: 2,
        },
        origin: "https://admin.example.test",
        allowedOrigins: new Set(["https://admin.example.test"]),
        expectedSource: "preview",
        expectedIdentity: identity,
        replay: initialCmsVisualPreviewReplayState(),
        now: 10_200,
      }),
    ).toMatchObject({ accepted: true });
  });

  test("rejects foreign origins, stale messages, and identity mismatches", () => {
    const envelope = createCmsVisualPreviewEnvelope({
      source: "preview",
      messageId: "message-0002",
      sequence: 2,
      issuedAt: 1_000,
      identity,
      payload: { type: "ready" },
    });
    const common = {
      value: envelope,
      allowedOrigins: new Set(["https://admin.example.test"]),
      expectedSource: "preview" as const,
      expectedIdentity: identity,
      replay: initialCmsVisualPreviewReplayState(),
      now: 50_000,
    };
    expect(
      validateCmsVisualPreviewEnvelope({
        ...common,
        origin: "https://evil.test",
      }),
    ).toMatchObject({ reason: "origin" });
    expect(
      validateCmsVisualPreviewEnvelope({
        ...common,
        origin: "https://admin.example.test",
      }),
    ).toMatchObject({ reason: "stale" });
    expect(
      validateCmsVisualPreviewEnvelope({
        ...common,
        origin: "https://admin.example.test",
        now: 1_100,
        expectedIdentity: { ...identity, documentVersion: 5 },
      }),
    ).toMatchObject({ reason: "identity" });
  });

  test("generates private no-store noindex preview headers", () => {
    expect(
      createCmsVisualPreviewResponseHeaders({
        frameAncestors: ["https://admin.example.test"],
      }),
    ).toEqual({
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Security-Policy": "frame-ancestors https://admin.example.test",
      "Referrer-Policy": "same-origin",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    });
  });

  test("keeps the established v1 protocol available through the compatibility export", () => {
    expect(
      isCmsVisualEditorMessage(
        createCmsVisualEditorSelectionMessage("hero-1", "title.prefix"),
      ),
    ).toBe(true);
  });
});
