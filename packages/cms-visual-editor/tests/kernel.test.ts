import { describe, expect, test } from "bun:test";
import {
  applyCmsVisualClipboardPaste,
  applyCmsVisualPattern,
  applyCmsVisualCommand,
  applyCmsVisualInlineTextUpdate,
  assertCmsVisualAdapterRoundTrip,
  canCmsVisualAction,
  commitCmsDraftHistory,
  createCmsVisualClipboardPayload,
  createCmsDraftHistory,
  createCmsVisualComponentRegistry,
  createCmsVisualEditorCopyMessage,
  createCmsVisualEditorSelectionMessage,
  createCmsVisualEditorInlineTextMessage,
  createCmsVisualEditorPasteMessage,
  createCmsVisualEditorStateMessage,
  createCmsVisualMigrationRegistry,
  createCmsVisualOutline,
  createCmsVisualPatternRegistry,
  createCmsVisualPreviewEnvelope,
  createCmsVisualPreviewResponseHeaders,
  createCmsVisualPreviewSession,
  defineCmsVisualComponent,
  defineCmsVisualPattern,
  filterCmsVisualPatterns,
  flattenCmsVisualOutline,
  getCmsVisualOutlineExpandableNodeIds,
  getCmsVisualInlineTextTargets,
  initialCmsVisualPreviewReplayState,
  isCmsVisualEditorMessage,
  migrateCmsVisualDocument,
  normalizeCmsVisualSelection,
  parseCmsVisualClipboardText,
  parseCmsVisualDocument,
  redoCmsDraftHistory,
  reduceCmsVisualOutlineKeyboard,
  serializeCmsVisualClipboardPayload,
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
        required: true,
        editCapabilities: ["visual.field.edit"],
        inlineText: { maxLength: 80 },
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
    constraints: {
      max: 2,
      slots: {
        content: { min: 1, max: 2, allowedChildren: ["textBlock"] },
      },
    },
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

  test("fails closed for unknown slots and slot cardinality", () => {
    const layout = document().nodes[1] as CmsVisualNode;
    expect(() =>
      parseCmsVisualDocument(
        {
          ...document(),
          nodes: [
            document().nodes[0] as CmsVisualNode,
            { ...layout, slots: { sidebar: [] } },
          ],
        },
        registry,
      ),
    ).toThrow("unknown slot");
    expect(() =>
      parseCmsVisualDocument(
        {
          ...document(),
          nodes: [
            document().nodes[0] as CmsVisualNode,
            { ...layout, slots: { content: [] } },
          ],
        },
        registry,
      ),
    ).toThrow("requires 1-2 children");
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

  test("builds a nested permission-aware outline with deterministic keyboard navigation", () => {
    const outline = createCmsVisualOutline({
      document: document(),
      registry,
      grants: new Set(["visual.component.edit", "visual.component.move"]),
      selection: { nodeId: "text-1", fieldPath: "text" },
      label: (node) => ` ${node.type} label `,
    });
    expect(outline[0]).toMatchObject({
      id: "hero-1",
      label: "hero label",
      depth: 0,
      actions: {
        insert: false,
        edit: true,
        move: false,
        duplicate: false,
        remove: false,
      },
    });
    expect(outline[1]?.children[0]).toMatchObject({
      id: "text-1",
      parentId: "layout-1",
      slot: "content",
      depth: 1,
      selected: true,
      actions: {
        insert: true,
        edit: true,
        move: false,
        duplicate: true,
        remove: false,
      },
    });
    expect(getCmsVisualOutlineExpandableNodeIds(outline)).toEqual(["layout-1"]);
    expect(
      flattenCmsVisualOutline(outline, new Set()).map(({ id }) => id),
    ).toEqual(["hero-1", "layout-1"]);

    const expanded = reduceCmsVisualOutlineKeyboard({
      items: outline,
      focusedNodeId: "layout-1",
      expandedNodeIds: new Set(),
      key: "ArrowRight",
    });
    expect(expanded).toEqual({
      focusNodeId: "layout-1",
      expandedNodeIds: ["layout-1"],
      activateNodeId: null,
    });
    expect(
      reduceCmsVisualOutlineKeyboard({
        items: outline,
        focusedNodeId: "layout-1",
        expandedNodeIds: new Set(expanded.expandedNodeIds),
        key: "ArrowRight",
      }).focusNodeId,
    ).toBe("text-1");
    expect(
      reduceCmsVisualOutlineKeyboard({
        items: outline,
        focusedNodeId: "text-1",
        expandedNodeIds: new Set(expanded.expandedNodeIds),
        key: "ArrowLeft",
      }).focusNodeId,
    ).toBe("layout-1");
    expect(
      reduceCmsVisualOutlineKeyboard({
        items: outline,
        focusedNodeId: "text-1",
        expandedNodeIds: new Set(expanded.expandedNodeIds),
        key: "Enter",
      }).activateNodeId,
    ).toBe("text-1");

    const fullSlotOutline = createCmsVisualOutline({
      document: {
        ...document(),
        nodes: [
          document().nodes[0] as CmsVisualNode,
          {
            ...(document().nodes[1] as CmsVisualNode),
            slots: {
              content: [
                (document().nodes[1] as CmsVisualNode).slots
                  ?.content?.[0] as CmsVisualNode,
                {
                  id: "text-2",
                  type: "textBlock",
                  schemaVersion: 1,
                  enabled: true,
                  data: { text: "Two" },
                },
              ],
            },
          },
        ],
      },
      registry,
      grants: new Set(["visual.component.edit", "visual.component.move"]),
      selection: { nodeId: null },
    });
    expect(fullSlotOutline[1]?.children[0]?.actions).toEqual({
      insert: false,
      edit: true,
      move: true,
      duplicate: false,
      remove: true,
    });

    const nodeLimitedOutline = createCmsVisualOutline({
      document: document(),
      registry,
      grants: new Set(["visual.component.edit", "visual.component.move"]),
      selection: { nodeId: null },
      maxNodes: 3,
    });
    expect(nodeLimitedOutline[1]?.actions).toMatchObject({
      insert: false,
      duplicate: false,
    });
    expect(nodeLimitedOutline[1]?.children[0]?.actions).toMatchObject({
      insert: false,
      duplicate: false,
    });
    expect(() =>
      createCmsVisualOutline({
        document: document(),
        registry,
        grants: new Set(),
        selection: { nodeId: null },
        maxNodes: 2,
      }),
    ).toThrow("maxNodes");
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

describe("inline text editing", () => {
  const editGrants = new Set(["visual.component.edit", "visual.field.edit"]);

  test("discovers only permission-granted inline targets and updates atomically", () => {
    expect(
      getCmsVisualInlineTextTargets({
        nodes: document().nodes,
        registry,
        grants: new Set(),
      }),
    ).toEqual([]);
    expect(
      getCmsVisualInlineTextTargets({
        nodes: document().nodes,
        registry,
        grants: editGrants,
      }),
    ).toEqual([
      {
        blockId: "hero-1",
        fieldPath: "text",
        label: "Heading",
        maxLength: 80,
        multiline: false,
      },
    ]);

    const updated = applyCmsVisualInlineTextUpdate({
      document: document(),
      registry,
      nodeId: "hero-1",
      fieldPath: "text",
      value: "  Inline heading  ",
      grants: editGrants,
    });
    expect(updated.version).toBe(3);
    expect(updated.nodes[0]?.data).toEqual({ text: "Inline heading" });
  });

  test("rejects undeclared, multiline, oversized, and unauthorized updates", () => {
    expect(() =>
      applyCmsVisualInlineTextUpdate({
        document: document(),
        registry,
        nodeId: "hero-1",
        fieldPath: "missing",
        value: "Text",
        grants: editGrants,
      }),
    ).toThrow("does not allow inline text editing");
    for (const value of ["Line one\nLine two", "x".repeat(81)]) {
      expect(() =>
        applyCmsVisualInlineTextUpdate({
          document: document(),
          registry,
          nodeId: "hero-1",
          fieldPath: "text",
          value,
          grants: editGrants,
        }),
      ).toThrow("Visual inline text field");
    }
    expect(() =>
      applyCmsVisualInlineTextUpdate({
        document: document(),
        registry,
        nodeId: "hero-1",
        fieldPath: "text",
        value: "Denied",
        grants: new Set(),
      }),
    ).toThrow("permission denied");
    expect(() =>
      defineCmsVisualComponent({
        type: "invalidInline",
        schemaVersion: 1,
        fields: [
          {
            path: "count",
            label: "Count",
            kind: "number",
            inlineText: { maxLength: 20 },
          },
        ],
        defaults: () => ({ count: 1 }),
        validate: (value) => value,
        renderer: "invalid-renderer",
        editor: "invalid-editor",
      }),
    ).toThrow("requires a text field");
    expect(() =>
      defineCmsVisualComponent({
        type: "invalidMultiline",
        schemaVersion: 1,
        fields: [
          {
            path: "text",
            label: "Text",
            kind: "text",
            inlineText: { multiline: "yes" } as never,
          },
        ],
        defaults: () => ({ text: "Copy" }),
        validate: (value) => value,
        renderer: "invalid-renderer",
        editor: "invalid-editor",
      }),
    ).toThrow("optional boolean multiline flag");
  });
});

describe("visual clipboard", () => {
  test("serializes and pastes a nested-compatible node as one version", () => {
    const payload = createCmsVisualClipboardPayload({
      document: document(),
      registry,
      nodeIds: ["text-1"],
    });
    const parsed = parseCmsVisualClipboardText(
      serializeCmsVisualClipboardPayload(payload),
    );
    expect(parsed.nodes).toHaveLength(1);
    expect(parsed.nodes[0]).toMatchObject({
      id: "text-1",
      type: "textBlock",
      data: { text: "One" },
    });

    const pasted = applyCmsVisualClipboardPaste({
      document: document(),
      registry,
      payload: parsed,
      location: { parentId: "layout-1", slot: "content", index: 1 },
      createId: ({ id }) => `pasted-${id}`,
      grants: new Set(),
    });
    expect(pasted.rootNodeIds).toEqual(["pasted-text-1"]);
    expect(pasted.document.version).toBe(3);
    expect(pasted.document.nodes[1]?.slots?.content).toEqual([
      expect.objectContaining({ id: "text-1", data: { text: "One" } }),
      expect.objectContaining({
        id: "pasted-text-1",
        data: { text: "One" },
      }),
    ]);
  });

  test("rejects malformed, unauthorized, incompatible, and colliding paste", () => {
    expect(() => parseCmsVisualClipboardText("not-json")).toThrow(
      "not valid JSON",
    );
    expect(() =>
      parseCmsVisualClipboardText(
        JSON.stringify({
          channel: "foreign",
          schemaVersion: 1,
          nodes: [],
        }),
      ),
    ).toThrow("channel or schema version");

    const payload = createCmsVisualClipboardPayload({
      document: document(),
      registry,
      nodeIds: ["text-1"],
    });
    expect(() =>
      applyCmsVisualClipboardPaste({
        document: document(),
        registry,
        payload,
        location: { parentId: "layout-1", slot: "content", index: 1 },
        createId: () => "hero-1",
        grants: new Set(),
      }),
    ).toThrow("invalid or duplicate ID");

    const restricted = createCmsVisualComponentRegistry(
      registry.definitions.map((definition) =>
        definition.type === "textBlock"
          ? defineCmsVisualComponent({
              ...definition,
              actionCapabilities: {
                ...definition.actionCapabilities,
                insert: ["visual.clipboard.paste"],
              },
            })
          : definition,
      ),
    );
    expect(() =>
      applyCmsVisualClipboardPaste({
        document: document(),
        registry: restricted,
        payload,
        location: { parentId: "layout-1", slot: "content", index: 1 },
        createId: ({ id }) => `restricted-${id}`,
        grants: new Set(),
      }),
    ).toThrow("permission denied for insert on textBlock");

    const incompatible = parseCmsVisualClipboardText(
      serializeCmsVisualClipboardPayload({
        ...payload,
        nodes: [{ ...payload.nodes[0]!, type: "foreignBlock" }],
      }),
    );
    expect(() =>
      applyCmsVisualClipboardPaste({
        document: document(),
        registry,
        payload: incompatible,
        location: { parentId: "layout-1", slot: "content", index: 1 },
        createId: ({ id }) => `foreign-${id}`,
        grants: new Set(),
      }),
    ).toThrow("permission denied for insert on foreignBlock");
  });
});

describe("component patterns", () => {
  const patterns = createCmsVisualPatternRegistry([
    defineCmsVisualPattern({
      id: "editorial-callout",
      label: "Lời kêu gọi biên tập",
      description: "Bố cục lồng ghép cho một điểm nhấn nội dung.",
      category: "Bố cục",
      keywords: ["editorial", "noi dung"],
      createNodes: ({ createId }) => [
        {
          id: createId("layout"),
          type: "layout",
          schemaVersion: 1,
          enabled: true,
          data: {},
          slots: {
            content: [
              {
                id: createId("textBlock"),
                type: "textBlock",
                schemaVersion: 1,
                enabled: true,
                data: { text: "Pattern copy" },
              },
            ],
          },
        },
      ],
    }),
  ]);

  test("finds patterns accent-insensitively and inserts one atomic history step", () => {
    expect(filterCmsVisualPatterns(patterns.patterns, "bo cuc")).toHaveLength(
      1,
    );
    let serial = 1;
    const applied = applyCmsVisualPattern({
      document: document(),
      registry,
      patterns,
      patternId: "editorial-callout",
      location: { parentId: null, index: 2 },
      createId: (type) => `${type}-${++serial}`,
      grants: new Set(),
    });
    expect(applied.version).toBe(3);
    expect(applied.nodes).toHaveLength(3);
    expect(applied.nodes[2]?.slots?.content?.[0]?.data).toEqual({
      text: "Pattern copy",
    });

    const history = commitCmsDraftHistory(
      createCmsDraftHistory(document()),
      applied,
    );
    expect(undoCmsDraftHistory(history).present).toEqual(document());
  });

  test("fails closed when a nested pattern node lacks insert permission", () => {
    const restricted = createCmsVisualComponentRegistry(
      registry.definitions.map((definition) =>
        definition.type === "textBlock"
          ? defineCmsVisualComponent({
              ...definition,
              actionCapabilities: {
                ...definition.actionCapabilities,
                insert: ["visual.child.insert"],
              },
            })
          : definition,
      ),
    );
    expect(() =>
      applyCmsVisualPattern({
        document: document(),
        registry: restricted,
        patterns,
        patternId: "editorial-callout",
        location: { parentId: null, index: 2 },
        createId: (type) => `${type}-pattern`,
        grants: new Set(),
      }),
    ).toThrow("permission denied for insert on textBlock");
  });

  test("rejects duplicate registrations and empty pattern output", () => {
    expect(() =>
      createCmsVisualPatternRegistry([
        patterns.patterns[0]!,
        patterns.patterns[0]!,
      ]),
    ).toThrow("Duplicate visual pattern id");
    const empty = createCmsVisualPatternRegistry([
      {
        id: "empty-pattern",
        label: "Empty",
        description: "Invalid empty pattern output.",
        category: "Test",
        createNodes: () => [],
      },
    ]);
    expect(() =>
      applyCmsVisualPattern({
        document: document(),
        registry,
        patterns: empty,
        patternId: "empty-pattern",
        location: { parentId: null, index: 2 },
        createId: (type) => `${type}-empty`,
        grants: new Set(),
      }),
    ).toThrow("must create 1-32 roots");
    expect(() =>
      applyCmsVisualCommand({
        document: document(),
        registry,
        grants: new Set(),
        command: {
          type: "insert-pattern",
          location: { parentId: null, index: 2 },
          nodes: Array.from({ length: 33 }, (_, index) => ({
            id: `oversized-${index}`,
            type: "textBlock",
            schemaVersion: 1,
            enabled: true,
            data: { text: "Oversized" },
          })),
        },
      }),
    ).toThrow("must create 1-32 roots");
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

  test("rejects forged source and every bound identity dimension", () => {
    const common = {
      origin: "https://admin.example.test",
      allowedOrigins: new Set(["https://admin.example.test"]),
      expectedSource: "preview" as const,
      expectedIdentity: identity,
      replay: initialCmsVisualPreviewReplayState(),
      now: 20_100,
    };
    expect(
      validateCmsVisualPreviewEnvelope({
        ...common,
        value: createCmsVisualPreviewEnvelope({
          source: "host",
          messageId: "forged-source",
          sequence: 1,
          issuedAt: 20_000,
          identity,
          payload: { type: "ready" },
        }),
      }),
    ).toMatchObject({ accepted: false, reason: "source" });

    const mismatches: Array<Partial<CmsVisualPreviewIdentity>> = [
      { siteId: "site-2" },
      { documentId: "page-2" },
      { documentType: "post" },
      { sessionId: "session-5678" },
      { sessionBinding: "binding-5678" },
      { documentVersion: 5 },
      { conflictToken: "conflict-5678" },
    ];
    for (const [index, mismatch] of mismatches.entries()) {
      const forgedIdentity = { ...identity, ...mismatch };
      expect(
        validateCmsVisualPreviewEnvelope({
          ...common,
          value: createCmsVisualPreviewEnvelope({
            source: "preview",
            messageId: `forged-identity-${index}`,
            sequence: index + 1,
            issuedAt: 20_000,
            identity: forgedIdentity,
            payload: { type: "ready" },
          }),
        }),
      ).toMatchObject({ accepted: false, reason: "identity" });
    }
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
    expect(
      createCmsVisualPreviewResponseHeaders({ frameAncestors: ["'self'"] }),
    ).toMatchObject({
      "Content-Security-Policy": "frame-ancestors 'self'",
    });
    expect(() =>
      createCmsVisualPreviewResponseHeaders({
        frameAncestors: ["http://admin.example.test"],
      }),
    ).toThrow(/explicit HTTPS/);
  });

  test("keeps the established v1 protocol available through the compatibility export", () => {
    expect(
      isCmsVisualEditorMessage(
        createCmsVisualEditorSelectionMessage("hero-1", "title.prefix"),
      ),
    ).toBe(true);
    const inline = createCmsVisualEditorInlineTextMessage({
      blockId: "hero-1",
      fieldPath: "text",
      value: "Edited on canvas",
    });
    expect(isCmsVisualEditorMessage(inline)).toBe(true);
    expect(inline).toMatchObject({
      type: "inline-text",
      value: "Edited on canvas",
    });
    expect(() =>
      createCmsVisualEditorInlineTextMessage({
        blockId: "hero-1",
        fieldPath: "text",
        value: "x".repeat(10_001),
      }),
    ).toThrow("too large");

    const currentState = createCmsVisualEditorStateMessage({
      blocks: [],
      selectedBlockId: null,
      selectedFieldPath: null,
      selectionRevision: 0,
      revision: 0,
    });
    expect(currentState.inlineTextTargets).toEqual([]);
    const legacyState: Record<string, unknown> = { ...currentState };
    delete legacyState.inlineTextTargets;
    expect(isCmsVisualEditorMessage(legacyState)).toBe(true);
    const copy = createCmsVisualEditorCopyMessage("hero-1");
    const paste = createCmsVisualEditorPasteMessage("hero-1", "after");
    expect(isCmsVisualEditorMessage(copy)).toBe(true);
    expect(isCmsVisualEditorMessage(paste)).toBe(true);
    expect(paste).toMatchObject({
      type: "paste",
      targetBlockId: "hero-1",
      placement: "after",
    });
  });

  test("keeps replay and document-version state inside a preview peer session", () => {
    let hostMessage = 0;
    let previewMessage = 0;
    const allowedOrigins = new Set(["https://admin.example.test"]);
    const host = createCmsVisualPreviewSession({
      source: "host",
      expectedSource: "preview",
      identity,
      allowedOrigins,
      messageIdFactory: () => `host-message-${++hostMessage}`,
    });
    const preview = createCmsVisualPreviewSession({
      source: "preview",
      expectedSource: "host",
      identity,
      allowedOrigins,
      messageIdFactory: () => `preview-message-${++previewMessage}`,
    });
    const ready = preview.create({ type: "ready" }, 10_000);

    expect(
      host.receive({
        value: ready,
        origin: "https://admin.example.test",
        now: 10_100,
      }),
    ).toMatchObject({ accepted: true });
    expect(
      host.receive({
        value: ready,
        origin: "https://admin.example.test",
        now: 10_200,
      }),
    ).toMatchObject({ accepted: false, reason: "replay" });

    host.setDocumentVersion(5);
    expect(
      host.receive({
        value: preview.create({ type: "ready" }, 10_300),
        origin: "https://admin.example.test",
        now: 10_400,
      }),
    ).toMatchObject({ accepted: false, reason: "identity" });

    preview.setDocumentVersion(5);
    expect(
      host.receive({
        value: preview.create({ type: "ready" }, 10_500),
        origin: "https://admin.example.test",
        now: 10_600,
      }),
    ).toMatchObject({ accepted: true });
    expect(host.snapshot()).toMatchObject({
      identity: { documentVersion: 5 },
      outgoingSequence: 0,
      replay: { lastSequence: 3 },
    });

    host.reset();
    expect(host.snapshot()).toMatchObject({
      identity: { documentVersion: 5 },
      outgoingSequence: 0,
      pendingDocumentVersion: null,
      replay: { lastSequence: 0, messageIds: [] },
    });
  });

  test("changes document versions only after the preview acknowledges the exact state", () => {
    let hostMessage = 0;
    let previewMessage = 0;
    const allowedOrigins = new Set(["https://admin.example.test"]);
    const host = createCmsVisualPreviewSession({
      source: "host",
      expectedSource: "preview",
      identity,
      allowedOrigins,
      messageIdFactory: () => `host-transition-${++hostMessage}`,
    });
    const preview = createCmsVisualPreviewSession({
      source: "preview",
      expectedSource: "host",
      identity,
      allowedOrigins,
      messageIdFactory: () => `preview-transition-${++previewMessage}`,
    });
    const state = host.createVersionedState({ revision: 5 }, 5, 20_000);

    expect(state).not.toBeNull();
    expect(host.snapshot()).toMatchObject({
      identity: { documentVersion: 4 },
      pendingDocumentVersion: {
        messageId: state!.messageId,
        documentVersion: 5,
      },
    });
    expect(host.createVersionedState({ revision: 6 }, 6, 20_010)).toBeNull();

    const oldVersionCommand = preview.create(
      { type: "command", command: { type: "select" } },
      20_020,
    );
    expect(
      host.receive({
        value: oldVersionCommand,
        origin: "https://admin.example.test",
        now: 20_030,
      }),
    ).toMatchObject({ accepted: true });
    expect(
      preview.receive({
        value: state,
        origin: "https://admin.example.test",
        now: 20_040,
      }),
    ).toMatchObject({ accepted: true });

    const wrongAck = preview.acknowledgeDocumentVersion(
      "different-state-message",
      5,
      20_050,
    );
    expect(
      host.receive({
        value: wrongAck,
        origin: "https://admin.example.test",
        now: 20_060,
      }),
    ).toMatchObject({ accepted: false, reason: "identity" });

    const exactAck = preview.create(
      { type: "ack", acknowledgedMessageId: state!.messageId },
      20_070,
    );
    expect(
      host.receive({
        value: exactAck,
        origin: "https://admin.example.test",
        now: 20_080,
      }),
    ).toMatchObject({ accepted: true });
    expect(host.snapshot()).toMatchObject({
      identity: { documentVersion: 5 },
      pendingDocumentVersion: null,
      replay: { lastSequence: 3 },
    });
    expect(
      host.createVersionedState({ revision: 5, selected: "hero" }, 5, 20_090),
    ).not.toBeNull();
  });
});
