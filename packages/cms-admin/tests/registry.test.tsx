import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import {
  CMS_VISUAL_EDITOR_CHANNEL,
  CmsBlockEditor,
  CmsDraftStatusSlots,
  CmsRevisionList,
  CmsWorkflowActionSlots,
  applyCmsPlainTextPaste,
  commitCmsDraftHistory,
  compareCmsBlockRevisions,
  compareCmsRevisionFieldDetails,
  compareCmsRevisionFields,
  createBlockEditorRegistry,
  createCmsDraftHistory,
  createCmsVisualEditorDuplicateMessage,
  createCmsVisualEditorInsertMessage,
  createCmsVisualEditorReadyMessage,
  createCmsVisualEditorMoveMessage,
  createCmsVisualEditorRemoveMessage,
  createCmsVisualEditorSelectionMessage,
  createCmsVisualEditorStateMessage,
  filterCmsBlockAuthoringCatalog,
  flushCmsDraft,
  openCmsPreviewAfterSave,
  reduceCmsPreviewConnection,
  redoCmsDraftHistory,
  isCmsVisualEditorMessage,
  resolveCmsAdminWorkflow,
  resolveCmsEditorialReviewPresentation,
  resolveCmsMediaSelection,
  runCmsWorkflowCommand,
  shouldScheduleCmsAutosave,
  undoCmsDraftHistory,
} from "../src";

describe("preview connection contract", () => {
  test("does not claim a live connection from iframe load alone", () => {
    const loaded = reduceCmsPreviewConnection(
      { cycle: 0, reloadKey: 0, status: "connecting" },
      { type: "frame-loaded" },
    );
    expect(loaded).toEqual({
      cycle: 1,
      reloadKey: 0,
      status: "connecting",
    });
    expect(reduceCmsPreviewConnection(loaded, { type: "timeout" }).status).toBe(
      "delayed",
    );
  });

  test("accepts an explicit ready handshake and never times it out", () => {
    const connected = reduceCmsPreviewConnection(
      { cycle: 1, reloadKey: 0, status: "connecting" },
      { type: "ready" },
    );
    expect(connected.status).toBe("connected");
    expect(reduceCmsPreviewConnection(connected, { type: "timeout" })).toEqual(
      connected,
    );
  });

  test("retry creates a new connecting frame attempt", () => {
    expect(
      reduceCmsPreviewConnection(
        { cycle: 3, reloadKey: 2, status: "delayed" },
        { type: "retry" },
      ),
    ).toEqual({ cycle: 4, reloadKey: 3, status: "connecting" });
  });
});

type TextBlock = { type: "text"; text: string };

describe("typed admin editor registry", () => {
  test("dispatches a registered editor without a type switch", () => {
    const registry = createBlockEditorRegistry<TextBlock, { prefix: string }>({
      text: {
        label: "Text",
        Editor: ({ block, context }) => (
          <label>{`${context.prefix}${block.text}`}</label>
        ),
      },
    });

    expect(
      renderToStaticMarkup(
        <CmsBlockEditor
          block={{ type: "text", text: "Editor" }}
          context={{ prefix: "CMS " }}
          registry={registry}
          onChange={() => undefined}
        />,
      ),
    ).toBe("<label>CMS Editor</label>");
  });

  test("flushes edits made during an active save before navigation", async () => {
    let dirty = true;
    let saving = true;
    let saves = 0;

    const result = await flushCmsDraft({
      getState: () => ({ dirty, saving }),
      waitForActiveSave: async () => {
        saving = false;
      },
      save: async () => {
        saves += 1;
        dirty = false;
        return { version: 2 };
      },
      settle: async () => undefined,
    });

    expect(result).toBe(true);
    expect(saves).toBe(1);
  });

  test("keeps preview URLs private until the draft flush succeeds", async () => {
    const events: string[] = [];
    const openPlaceholder = () => ({
      close: () => events.push("close"),
      navigate: (url: string) => events.push(`navigate:${url}`),
    });

    expect(
      await openCmsPreviewAfterSave({
        flushDraft: async () => false,
        openPlaceholder,
        url: "/preview/private",
      }),
    ).toBe("save-blocked");
    expect(events).toEqual(["close"]);

    events.length = 0;
    expect(
      await openCmsPreviewAfterSave({
        flushDraft: async () => true,
        openPlaceholder,
        url: "/preview/private",
      }),
    ).toBe("opened");
    expect(events).toEqual(["navigate:/preview/private"]);
  });

  test("autosaves only a dirty, idle, conflict-free draft", () => {
    expect(
      shouldScheduleCmsAutosave({
        dirty: true,
        saving: false,
        conflicted: false,
      }),
    ).toBe(true);
    expect(
      shouldScheduleCmsAutosave({
        dirty: false,
        saving: false,
        conflicted: false,
      }),
    ).toBe(false);
    expect(
      shouldScheduleCmsAutosave({
        dirty: true,
        saving: true,
        conflicted: false,
      }),
    ).toBe(false);
    expect(
      shouldScheduleCmsAutosave({
        dirty: true,
        saving: false,
        conflicted: true,
      }),
    ).toBe(false);
  });

  test("resolves workflow actions from provider support and server grants", () => {
    const editor = resolveCmsAdminWorkflow({
      providerCapabilities: {
        supported: [
          "content.readDraft",
          "content.write",
          "content.publish",
          "content.schedule",
          "content.restore",
        ],
      },
      grantedCapabilities: ["content.readDraft", "content.write"],
      documentExists: true,
      published: true,
      scheduled: false,
    });

    expect(editor.save.available).toBe(true);
    expect(editor.preview.available).toBe(true);
    expect(editor.publish.reason).toBe("permission-denied");
    expect(editor.unschedule.reason).toBe("permission-denied");

    const owner = resolveCmsAdminWorkflow({
      providerCapabilities: {
        supported: [
          "content.readDraft",
          "content.write",
          "content.publish",
          "content.schedule",
          "content.restore",
        ],
      },
      grantedCapabilities: [
        "content.readDraft",
        "content.write",
        "content.publish",
        "content.schedule",
        "content.restore",
      ],
      documentExists: false,
      published: false,
      scheduled: false,
    });
    expect(owner.publish.available).toBe(true);
    expect(owner.revisions.reason).toBe("document-required");
    expect(owner.unschedule.reason).toBe("schedule-required");
    expect(owner.unpublish.reason).toBe("publication-required");

    const unsupported = resolveCmsAdminWorkflow({
      providerCapabilities: { supported: ["content.readDraft"] },
      grantedCapabilities: ["content.readDraft", "content.publish"],
      documentExists: true,
      published: true,
      scheduled: false,
    });
    expect(unsupported.publish.reason).toBe("provider-unsupported");
  });

  test("saves before a command and renders only available action slots", async () => {
    const events: string[] = [];
    await expect(
      runCmsWorkflowCommand({
        current: { id: "home", version: 1 },
        dirty: true,
        save: async () => {
          events.push("save");
          return { id: "home", version: 2 };
        },
        command: async (target) => {
          events.push(`publish:${target.version}`);
          return target.version;
        },
      }),
    ).resolves.toBe(2);
    expect(events).toEqual(["save", "publish:2"]);

    const model = resolveCmsAdminWorkflow({
      providerCapabilities: {
        supported: ["content.readDraft", "content.write", "content.publish"],
      },
      grantedCapabilities: ["content.readDraft", "content.write"],
      documentExists: true,
      published: false,
      scheduled: false,
    });
    expect(
      renderToStaticMarkup(
        <CmsWorkflowActionSlots
          model={model}
          slots={{
            preview: <span>Preview</span>,
            publish: <span>Publish</span>,
            save: <span>Save</span>,
          }}
        />,
      ),
    ).toBe("<span>Save</span><span>Preview</span>");
  });

  test("composes localized draft status and keyed revision rows", () => {
    expect(
      renderToStaticMarkup(
        <CmsDraftStatusSlots
          state="conflict"
          slots={{
            clean: <span>Clean</span>,
            conflict: <span>Resolve conflict</span>,
          }}
        />,
      ),
    ).toBe("<span>Resolve conflict</span>");
    expect(
      renderToStaticMarkup(
        <CmsRevisionList
          empty={<p>No revisions</p>}
          renderRevision={(revision) => <p>v{revision.version}</p>}
          revisions={[
            { id: "revision-2", version: 2 },
            { id: "revision-1", version: 1 },
          ]}
        />,
      ),
    ).toBe("<p>v2</p><p>v1</p>");
    expect(
      renderToStaticMarkup(
        <CmsRevisionList
          empty={<p>No revisions</p>}
          renderRevision={() => null}
          revisions={[]}
        />,
      ),
    ).toBe("<p>No revisions</p>");
  });

  test("never presents unsaved or stale content as reviewed", () => {
    const requested = {
      published: false,
      reviewVersion: 4,
      stale: false,
      status: "requested" as const,
    };
    expect(
      resolveCmsEditorialReviewPresentation({
        currentVersion: 4,
        decisionGranted: true,
        dirty: false,
        requestGranted: true,
        state: requested,
      }),
    ).toMatchObject({
      kind: "requested",
      actions: { approve: true, request: false, requestChanges: true },
    });
    expect(
      resolveCmsEditorialReviewPresentation({
        currentVersion: 4,
        decisionGranted: true,
        dirty: true,
        requestGranted: true,
        state: requested,
      }),
    ).toMatchObject({
      kind: "dirty",
      actions: { approve: false, request: true, requestChanges: false },
    });
    expect(
      resolveCmsEditorialReviewPresentation({
        currentVersion: 5,
        decisionGranted: true,
        dirty: false,
        requestGranted: true,
        state: requested,
      }),
    ).toMatchObject({
      kind: "stale",
      actions: { approve: false, request: true, requestChanges: false },
    });
    expect(
      resolveCmsEditorialReviewPresentation({
        currentVersion: 5,
        decisionGranted: false,
        dirty: false,
        requestGranted: false,
        state: requested,
      }),
    ).toMatchObject({
      kind: "stale",
      actions: { approve: false, request: false, requestChanges: false },
    });
  });

  test("keeps a bounded, coalesced and branch-safe draft command history", () => {
    const initial = createCmsDraftHistory({ text: "A" });
    const typedOnce = commitCmsDraftHistory(
      initial,
      { text: "AB" },
      {
        group: "hero:title",
        limit: 2,
        now: 100,
      },
    );
    const typedTwice = commitCmsDraftHistory(
      typedOnce,
      { text: "ABC" },
      {
        group: "hero:title",
        limit: 2,
        now: 400,
      },
    );
    expect(typedTwice.past).toEqual([{ text: "A" }]);

    const separate = commitCmsDraftHistory(
      typedTwice,
      { text: "ABCD" },
      {
        group: "hero:description",
        limit: 2,
        now: 500,
      },
    );
    const another = commitCmsDraftHistory(
      separate,
      { text: "ABCDE" },
      {
        limit: 2,
        now: 1_500,
      },
    );
    expect(another.past).toEqual([{ text: "ABC" }, { text: "ABCD" }]);

    const undone = undoCmsDraftHistory(another);
    expect(undone.present).toEqual({ text: "ABCD" });
    expect(undone.future).toEqual([{ text: "ABCDE" }]);

    const redone = redoCmsDraftHistory(undone);
    expect(redone.present).toEqual({ text: "ABCDE" });
    expect(redone.future).toEqual([]);

    const branched = commitCmsDraftHistory(undone, { text: "ABCD!" });
    expect(branched.future).toEqual([]);
    expect(undoCmsDraftHistory(createCmsDraftHistory("stable"))).toEqual(
      createCmsDraftHistory("stable"),
    );
    const optional = commitCmsDraftHistory(
      createCmsDraftHistory<string | undefined>(undefined),
      "value",
    );
    expect(undoCmsDraftHistory(optional).present).toBeUndefined();
    expect(redoCmsDraftHistory(undoCmsDraftHistory(optional)).present).toBe(
      "value",
    );
  });

  test("normalizes and bounds plain-text paste without importing document styles", () => {
    const pasted = applyCmsPlainTextPaste({
      currentText: "Before AFTER",
      clipboardText: "Cha\u0300o\u00a0Docs\u200b\r\nDòng\u0000",
      selectionStart: 7,
      selectionEnd: 12,
    });
    expect(pasted).toEqual({
      text: "Before Chào Docs\nDòng",
      insertedText: "Chào Docs\nDòng",
      selectionStart: 21,
      selectionEnd: 21,
      truncated: false,
    });
    expect(pasted.text).not.toMatch(/[\u0000\u00a0\u200b\r]/);

    const bounded = applyCmsPlainTextPaste({
      currentText: "12345",
      clipboardText: "😀AB",
      selectionStart: 4,
      selectionEnd: 2,
      maxLength: 6,
    });
    expect(bounded).toEqual({
      text: "12😀A5",
      insertedText: "😀A",
      selectionStart: 5,
      selectionEnd: 5,
      truncated: true,
    });
    expect(() =>
      applyCmsPlainTextPaste({
        currentText: "already too long",
        clipboardText: "x",
        selectionStart: 0,
        selectionEnd: 0,
        maxLength: 4,
      }),
    ).toThrow(/already exceeds/);
  });

  test("filters template authoring metadata across accents and keywords", () => {
    const catalog = [
      {
        type: "hero",
        label: "Mở đầu",
        description: "Ảnh lớn và lời kêu gọi hành động",
        category: "Nền tảng",
        keywords: ["banner", "cta"],
      },
      {
        type: "faq",
        label: "Câu hỏi thường gặp",
        description: "Danh sách giải đáp dạng accordion",
        category: "Hướng dẫn",
        keywords: ["support"],
      },
    ] as const;

    expect(filterCmsBlockAuthoringCatalog(catalog, "mo dau")).toEqual([
      catalog[0],
    ]);
    expect(
      filterCmsBlockAuthoringCatalog(catalog, "accordion support"),
    ).toEqual([catalog[1]]);
    expect(filterCmsBlockAuthoringCatalog(catalog, "không có")).toEqual([]);
    expect(filterCmsBlockAuthoringCatalog(catalog, "")).toBe(catalog);
  });

  test("adopts reviewed media metadata without retaining stale image alt text", () => {
    const asset = {
      key: "library/mesh.webp",
      url: "/api/media/library/mesh.webp",
      altText: "  Lưới chống muỗi trên khung cửa  ",
    };

    expect(
      resolveCmsMediaSelection({
        asset,
        currentAlt: "Mô tả của ảnh trước",
      }),
    ).toEqual({
      src: asset.url,
      alt: "Lưới chống muỗi trên khung cửa",
    });
    expect(
      resolveCmsMediaSelection({
        asset: { ...asset, altText: "" },
        currentAlt: "Mô tả không còn đúng",
      }),
    ).toEqual({ src: asset.url, alt: "" });
    expect(
      resolveCmsMediaSelection({
        asset,
        currentAlt: "Ảnh trang trí theo ngữ cảnh",
        altPolicy: "preserve",
      }),
    ).toEqual({
      src: asset.url,
      alt: "Ảnh trang trí theo ngữ cảnh",
    });
  });

  test("summarizes stable-ID revision changes without false neighbour moves", () => {
    const hero = {
      id: "hero-1",
      type: "hero",
      data: { title: "Original", settings: { contrast: "high", tone: 2 } },
    };
    const faq = { id: "faq-1", type: "faq", data: { items: ["A"] } };
    const footer = {
      id: "footer-1",
      type: "footer",
      data: { title: "Contact" },
    };
    const diff = compareCmsBlockRevisions(
      [hero, faq, footer],
      [
        {
          ...hero,
          data: { settings: { tone: 2, contrast: "high" }, title: "Changed" },
        },
        footer,
        { id: "benefits-1", type: "benefits", data: { items: [] } },
      ],
    );

    expect(diff.summary).toEqual({
      added: 1,
      removed: 1,
      modified: 1,
      moved: 0,
      unchanged: 1,
      totalChanges: 3,
    });
    expect(diff.changes.map(({ id, status }) => [id, status])).toEqual([
      ["hero-1", "modified"],
      ["benefits-1", "added"],
      ["faq-1", "removed"],
    ]);

    const reordered = compareCmsBlockRevisions(
      [hero, faq, footer],
      [faq, hero, footer],
    );
    expect(reordered.summary.moved).toBe(2);
    expect(reordered.summary.totalChanges).toBe(2);
  });

  test("reports selected revision fields without exposing their values", () => {
    const fields = [
      {
        key: "title",
        label: "Tiêu đề SEO",
        read: (value: { title: string; index: boolean }) => value.title,
      },
      {
        key: "index",
        label: "Cho phép lập chỉ mục",
        read: (value: { title: string; index: boolean }) => value.index,
      },
    ] as const;
    expect(
      compareCmsRevisionFields(
        { title: "Old", index: true },
        { title: "New", index: true },
        fields,
      ),
    ).toEqual([{ key: "title", label: "Tiêu đề SEO" }]);
    expect(() =>
      compareCmsBlockRevisions(
        [
          { id: "duplicate", type: "hero" },
          { id: "duplicate", type: "faq" },
        ],
        [],
      ),
    ).toThrow("Duplicate CMS revision block id on before: duplicate");
  });

  test("exposes only explicit bounded revision summaries", () => {
    const fields = [
      {
        key: "title",
        label: "Title",
        read: (value: { title: string; payload: object }) => value.title,
        summarize: (value: { title: string }) => value.title,
      },
      {
        key: "payload",
        label: "Structured payload",
        read: (value: { title: string; payload: object }) => value.payload,
      },
    ] as const;
    const details = compareCmsRevisionFieldDetails(
      {
        title: `  Before\u0000  ${"a".repeat(200)}`,
        payload: { secret: "before" },
      },
      {
        title: "After\nvalue",
        payload: { secret: "after" },
      },
      fields,
    );

    expect(details[0]).toEqual({
      key: "title",
      label: "Title",
      beforeSummary: `Before ${"a".repeat(152)}…`,
      afterSummary: "After value",
    });
    expect([...details[0]!.beforeSummary!].length).toBe(160);
    expect(details[1]).toEqual({
      key: "payload",
      label: "Structured payload",
      beforeSummary: null,
      afterSummary: null,
    });
    expect(JSON.stringify(details)).not.toContain("secret");
  });
});

describe("CMS visual editor protocol", () => {
  test("creates versioned ready, selection, and immutable state messages", () => {
    expect(createCmsVisualEditorReadyMessage()).toEqual({
      channel: CMS_VISUAL_EDITOR_CHANNEL,
      type: "ready",
    });
    expect(
      createCmsVisualEditorSelectionMessage("hero-1", "title.prefix"),
    ).toMatchObject({
      type: "select",
      blockId: "hero-1",
      fieldPath: "title.prefix",
    });
    expect(
      createCmsVisualEditorMoveMessage("benefits-1", "craft-1", "after"),
    ).toEqual({
      channel: CMS_VISUAL_EDITOR_CHANNEL,
      type: "move",
      blockId: "benefits-1",
      targetBlockId: "craft-1",
      placement: "after",
    });
    expect(
      createCmsVisualEditorInsertMessage("benefits", "craft-1", "before"),
    ).toMatchObject({
      type: "insert",
      blockType: "benefits",
      targetBlockId: "craft-1",
      placement: "before",
    });
    expect(createCmsVisualEditorDuplicateMessage("benefits-1")).toMatchObject({
      type: "duplicate",
      blockId: "benefits-1",
    });
    expect(createCmsVisualEditorRemoveMessage("benefits-1")).toMatchObject({
      type: "remove",
      blockId: "benefits-1",
    });
    const state = createCmsVisualEditorStateMessage({
      blocks: [{ id: "hero-1" }],
      selectedBlockId: "hero-1",
      selectedFieldPath: "title.prefix",
      selectionRevision: 4,
      revision: 3,
    });
    expect(state).toMatchObject({
      type: "state",
      selectionRevision: 4,
      revision: 3,
    });
    expect(Object.isFrozen(state.blocks)).toBe(true);
    expect(isCmsVisualEditorMessage(state)).toBe(true);
  });

  test("rejects malformed or cross-channel messages", () => {
    expect(
      isCmsVisualEditorMessage({ channel: "foreign", type: "ready" }),
    ).toBe(false);
    expect(
      isCmsVisualEditorMessage({
        channel: CMS_VISUAL_EDITOR_CHANNEL,
        type: "select",
        blockId: "",
      }),
    ).toBe(false);
    expect(() =>
      createCmsVisualEditorStateMessage({
        blocks: [],
        selectedBlockId: null,
        selectedFieldPath: null,
        selectionRevision: 0,
        revision: -1,
      }),
    ).toThrow(/non-negative integers/);
    expect(() =>
      createCmsVisualEditorStateMessage({
        blocks: [],
        selectedBlockId: null,
        selectedFieldPath: null,
        selectionRevision: -1,
        revision: 0,
      }),
    ).toThrow(/non-negative integers/);
    expect(
      isCmsVisualEditorMessage({
        channel: CMS_VISUAL_EDITOR_CHANNEL,
        type: "state",
        blocks: [],
        selectedBlockId: "hero-1",
        selectedFieldPath: null,
        selectionRevision: -1,
        revision: 0,
      }),
    ).toBe(false);
    expect(() =>
      createCmsVisualEditorSelectionMessage("hero-1", "\ninvalid"),
    ).toThrow(/field path/);
    expect(() =>
      createCmsVisualEditorMoveMessage("same", "same", "before"),
    ).toThrow(/relative to itself/);
    expect(
      isCmsVisualEditorMessage({
        channel: CMS_VISUAL_EDITOR_CHANNEL,
        type: "move",
        blockId: "benefits-1",
        targetBlockId: "craft-1",
        placement: "around",
      }),
    ).toBe(false);
    expect(() =>
      createCmsVisualEditorInsertMessage("invalid-type", "craft-1", "after"),
    ).toThrow(/block type/);
    expect(
      isCmsVisualEditorMessage({
        channel: CMS_VISUAL_EDITOR_CHANNEL,
        type: "remove",
        blockId: "\ninvalid",
      }),
    ).toBe(false);
  });
});
