import { CmsError, type CmsBlock } from "@agency/cms-core";
import {
  runGlobalContentProviderConformance,
  type CmsPageContent,
} from "@agency/cms-runtime";
import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { encodeSignatureHeader } from "@sanity/webhook";

import {
  addSanityArrayKeys,
  createSanityCmsGlobalContentProvider,
  createSanityCmsPageProvider,
  createSanityPresentationConfig,
  createSanityPreviewClientOverlay,
  createSanityPublishedClientOverlay,
  createSanityVisualEditingCapabilities,
  sanityCmsCapabilities,
  sanityGlobalContentCapabilities,
  sanityVisualEditingCapabilities,
  stripSanityArrayKeys,
  type SanityClientPort,
  type SanityGlobalRecord,
  type SanityGlobalRevisionRecord,
  type SanityPageRecord,
} from "../src";
import {
  parseSanityHostedConformanceReceipt,
  requiredSanityHostedConfirmation,
  runSanityHostedConformance,
} from "../src/hosted-conformance";
import {
  createSanityPresentationReceipt,
  parseSanityPresentationObservation,
  parseSanityPresentationReceipt,
  requiredSanityPresentationConfirmation,
  sanityPresentationBrowserCheckNames,
} from "../src/presentation-conformance";
import {
  createSanityPromotionReceipt,
  parseSanityPromotionReceipt,
  requiredSanityPromotionConfirmation,
} from "../src/promotion-conformance";
import {
  receiveSanityWebhook,
  SANITY_WEBHOOK_FILTER,
  SANITY_WEBHOOK_PROJECTION,
  SanityWebhookRequestError,
  sanityWebhookHeaderNames,
  type SanityWebhookDeliveryStore,
} from "../src/webhook";

type Content = CmsPageContent<CmsBlock>;

const content = (title: string): Content => ({
  title,
  slug: "home",
  template: "landing",
  seo: {
    title,
    description: "Description",
    canonicalUrl: "https://example.com/",
    ogImage: "https://example.com/og.jpg",
    robotsIndex: true,
    robotsFollow: true,
  },
  blocks: [
    {
      id: "hero",
      type: "hero",
      schemaVersion: 1,
      enabled: true,
      data: { title: "Hero" },
    },
    {
      id: "faq",
      type: "faq",
      schemaVersion: 1,
      enabled: true,
      data: { items: [{ id: "question-one", question: "Why?" }] },
    },
  ],
});

function parseContent(value: unknown): Content {
  if (!value || typeof value !== "object" || !("blocks" in value)) {
    throw new Error("invalid content");
  }
  return value as Content;
}

class FakeSanityClient implements SanityClientPort {
  readonly queries: string[] = [];
  readonly records = new Map<
    string,
    SanityPageRecord | SanityGlobalRecord | SanityGlobalRevisionRecord
  >();
  emptySourceMap = false;
  failCleanup = false;
  failGlobalCleanup = false;
  failNextRequest409 = false;
  #revision = 0;

  config() {
    return { dataset: "test", projectId: "project-test" };
  }

  async fetch<T>(
    query: string,
    params: Record<string, unknown> = {},
    options: {
      filterResponse?: boolean;
      perspective?: "drafts" | "published" | "raw";
      resultSourceMap?: "withKeyArraySelector";
      useCdn?: boolean;
    } = {},
  ): Promise<T> {
    this.queries.push(query);
    if (query.includes("_id == $id")) {
      return (this.records.get(String(params.id)) ?? null) as T;
    }
    if (query.includes("globalKey == $key")) {
      const globalRecords = [...this.records.values()].filter(
        (record): record is SanityGlobalRecord | SanityGlobalRevisionRecord =>
          "globalKey" in record && record.globalKey === params.key,
      );
      if (query.includes("{_id}")) {
        return globalRecords.map(({ _id }) => ({ _id })) as T;
      }
      return globalRecords
        .filter(
          (record): record is SanityGlobalRevisionRecord =>
            "snapshot" in record && record._type === params.revisionType,
        )
        .sort((left, right) => right.version - left.version) as T;
    }
    const candidates = [...this.records.values()].filter(
      (record): record is SanityPageRecord =>
        "agencyId" in record && record._type === params.documentType,
    );
    const matches = candidates.filter((record) =>
      query.includes("agencyId")
        ? record.agencyId === (params.value ?? params.agencyId)
        : (record.content as Content).slug === params.value,
    );
    const published = matches.find(
      (record) => !record._id.startsWith("drafts."),
    );
    const draft = matches.find((record) => record._id.startsWith("drafts."));
    if (options.filterResponse === false) {
      return {
        result: draft ?? published ?? null,
        resultSourceMap: this.emptySourceMap
          ? { mappings: {}, paths: [] }
          : {
              documents: [
                {
                  _id: draft?._id ?? published?._id,
                  _type: draft?._type ?? published?._type,
                },
              ],
              mappings: { "$['content']['title']": {} },
              paths: [
                "$['content']['blocks'][_key==\"hero\"]['data']['title']",
                "$['content']['blocks'][_key==\"faq\"]['data']['items'][_key==\"question-one\"]['question']",
              ],
            },
      } as T;
    }
    return (
      options.perspective === "published"
        ? (published ?? null)
        : (draft ?? published ?? null)
    ) as T;
  }

  async request<T>(input: {
    uri: string;
    method: "POST";
    body: unknown;
  }): Promise<T> {
    if (this.failNextRequest409) {
      this.failNextRequest409 = false;
      throw { statusCode: 409 };
    }
    const body = input.body as {
      actions?: Array<Record<string, unknown>>;
      mutations?: Array<Record<string, unknown>>;
    };
    if (
      this.failCleanup &&
      (body.actions?.some(
        (action) => action.actionType === "sanity.action.document.delete",
      ) ||
        body.mutations?.some((mutation) => "delete" in mutation))
    ) {
      throw new Error("cleanup failed");
    }
    if (
      this.failGlobalCleanup &&
      body.mutations?.some((mutation) => "delete" in mutation)
    ) {
      throw new Error("global cleanup failed");
    }
    for (const mutation of body.mutations ?? []) this.#mutation(mutation);
    for (const action of body.actions ?? []) this.#action(action);
    return { ok: true } as T;
  }

  #action(action: Record<string, unknown>) {
    const actionType = String(action.actionType);
    const publishedId = String(action.publishedId ?? "");
    if (actionType === "sanity.action.document.create") {
      const document = action.document as Partial<SanityPageRecord>;
      if (this.records.has(String(document._id))) throw { statusCode: 409 };
      this.#write(document as SanityPageRecord);
      return;
    }
    if (actionType === "sanity.action.document.edit") {
      const draft = String(action.draftId);
      const base = this.records.get(draft) ?? this.records.get(publishedId);
      if (!base) throw new Error("missing edit base");
      const set = (action.patch as { set: Record<string, unknown> }).set;
      this.#write({ ...base, ...set, _id: draft });
      return;
    }
    if (actionType === "sanity.action.document.publish") {
      const draft = String(action.draftId);
      const source = this.records.get(draft);
      if (!source) throw new Error("missing draft");
      this.#write({ ...source, _id: publishedId });
      this.records.delete(draft);
      return;
    }
    if (actionType === "sanity.action.document.unpublish") {
      this.records.delete(publishedId);
      return;
    }
    if (actionType === "sanity.action.document.delete") {
      this.records.delete(publishedId);
      for (const id of (action.includeVersions as string[]) ?? []) {
        this.records.delete(id);
      }
    }
  }

  #mutation(mutation: Record<string, unknown>) {
    if (mutation.create) {
      const record = mutation.create as
        SanityPageRecord | SanityGlobalRecord | SanityGlobalRevisionRecord;
      if (this.records.has(record._id)) throw { statusCode: 409 };
      this.#write(record);
      return;
    }
    if (mutation.delete) {
      this.records.delete(String((mutation.delete as { id: string }).id));
      return;
    }
    const patch = mutation.patch as {
      id: string;
      ifRevisionID: string;
      set: Record<string, unknown>;
    };
    const current = this.records.get(patch.id);
    if (!current || current._rev !== patch.ifRevisionID) {
      throw { statusCode: 409 };
    }
    this.#write({ ...current, ...patch.set });
  }

  #write(
    record: SanityPageRecord | SanityGlobalRecord | SanityGlobalRevisionRecord,
  ) {
    const timestamp = `2026-08-16T00:00:0${this.#revision}.000Z`;
    const existing = this.records.get(record._id);
    this.#revision += 1;
    this.records.set(record._id, {
      ...record,
      _createdAt: existing?._createdAt ?? record._createdAt ?? timestamp,
      _rev: `rev-${this.#revision}`,
      _updatedAt: timestamp,
    });
  }
}

type GlobalContent = {
  kind: "site-settings" | "navigation";
  title: string;
  items: Array<{ id: string; label: string }>;
};

type FakeGlobalRecord = SanityGlobalRecord | SanityGlobalRevisionRecord;

function parseGlobalContent(value: unknown): GlobalContent {
  if (
    !value ||
    typeof value !== "object" ||
    !("kind" in value) ||
    !("title" in value) ||
    !("items" in value)
  ) {
    throw new Error("invalid global content");
  }
  return value as GlobalContent;
}

class FakeGlobalSanityClient implements SanityClientPort {
  readonly records = new Map<string, FakeGlobalRecord>();
  failNextRequest409 = false;
  #revision = 0;

  config() {
    return { dataset: "test", projectId: "project-test" };
  }

  async fetch<T>(
    query: string,
    params: Record<string, unknown> = {},
  ): Promise<T> {
    if (query.includes("_id == $id")) {
      return (this.records.get(String(params.id)) ?? null) as T;
    }
    if (query.includes("globalKey == $key")) {
      return [...this.records.values()]
        .filter(
          (record): record is SanityGlobalRevisionRecord =>
            "snapshot" in record &&
            record._type === params.revisionType &&
            record.globalKey === params.key,
        )
        .sort((left, right) => right.version - left.version) as T;
    }
    throw new Error(`Unsupported fake Sanity query: ${query}`);
  }

  async request<T>(input: {
    uri: string;
    method: "POST";
    body: unknown;
  }): Promise<T> {
    if (this.failNextRequest409) {
      this.failNextRequest409 = false;
      throw { statusCode: 409 };
    }
    const mutations = (
      input.body as { mutations?: Array<Record<string, unknown>> }
    ).mutations;
    if (!mutations) throw new Error("Expected Sanity mutations");

    const createdIds = new Set<string>();
    for (const mutation of mutations) {
      if (mutation.create) {
        const id = String(
          (mutation.create as Partial<FakeGlobalRecord>)._id ?? "",
        );
        if (!id || this.records.has(id) || createdIds.has(id)) {
          throw { statusCode: 409 };
        }
        createdIds.add(id);
        continue;
      }
      const patch = mutation.patch as {
        id: string;
        ifRevisionID: string;
      };
      const current = this.records.get(patch.id);
      if (!current || current._rev !== patch.ifRevisionID) {
        throw { statusCode: 409 };
      }
    }

    for (const mutation of mutations) {
      if (mutation.create) {
        this.#write(mutation.create as FakeGlobalRecord);
        continue;
      }
      const patch = mutation.patch as {
        id: string;
        set: Record<string, unknown>;
      };
      const current = this.records.get(patch.id)!;
      this.#write({ ...current, ...patch.set });
    }
    return { ok: true } as T;
  }

  #write(record: FakeGlobalRecord) {
    const timestamp = `2026-08-16T00:01:${String(this.#revision).padStart(2, "0")}.000Z`;
    const existing = this.records.get(record._id);
    this.#revision += 1;
    this.records.set(record._id, {
      ...record,
      _createdAt: existing?._createdAt ?? record._createdAt ?? timestamp,
      _rev: `global-rev-${this.#revision}`,
      _updatedAt: timestamp,
    });
  }
}

describe("Sanity provider vertical slice", () => {
  test("publishes honest storage and visual capability sets", () => {
    expect(sanityCmsCapabilities.supported).toEqual([
      "content.readDraft",
      "content.write",
      "content.publish",
      "content.delete",
    ]);
    expect(sanityVisualEditingCapabilities).toMatchObject({
      draftMode: true,
      livePreview: true,
      clickToEdit: true,
      webhooks: false,
      localization: false,
    });
    expect(createSanityVisualEditingCapabilities({ webhooks: true })).toEqual({
      ...sanityVisualEditingCapabilities,
      webhooks: true,
    });
  });

  test("verifies, deduplicates, and revalidates signed Sanity webhooks", async () => {
    const now = new Date("2026-08-16T08:00:00.000Z");
    const secret = "webhook-secret-with-at-least-32-characters";
    const rawBody = JSON.stringify({ _type: "agencyPage", agencyId: "home" });
    const signature = await encodeSignatureHeader(
      rawBody,
      now.getTime(),
      secret,
    );
    const headers = new Headers({
      "content-type": "application/json",
      [sanityWebhookHeaderNames.signature]: signature,
      [sanityWebhookHeaderNames.idempotencyKey]: "delivery-1",
      [sanityWebhookHeaderNames.projectId]: "project-test",
      [sanityWebhookHeaderNames.dataset]: "staging",
      [sanityWebhookHeaderNames.documentId]: "agency-page-home",
      [sanityWebhookHeaderNames.operation]: "update",
      [sanityWebhookHeaderNames.transactionId]: "transaction-1",
      [sanityWebhookHeaderNames.transactionTime]: now.toISOString(),
      [sanityWebhookHeaderNames.webhookId]: "webhook-1",
    });
    let claimed = false;
    let completed = 0;
    let revalidated = 0;
    const deliveries: SanityWebhookDeliveryStore = {
      async claim() {
        if (claimed) return "duplicate";
        claimed = true;
        return "claimed";
      },
      async complete() {
        completed += 1;
      },
      async release() {
        claimed = false;
      },
    };
    const receive = () =>
      receiveSanityWebhook(
        new Request("https://preview.example.com/api/sanity/webhook", {
          method: "POST",
          headers,
          body: rawBody,
        }),
        {
          projectId: "project-test",
          dataset: "staging",
          secret,
          deliveries,
          now: () => now,
          async revalidate(event) {
            revalidated += 1;
            return {
              paths: [`/sanity-page/${event.agencyId}`, "/"],
              tags: [`sanity:agencyPage:${event.agencyId}`],
            };
          },
        },
      );

    expect(SANITY_WEBHOOK_FILTER).toContain("defined(agencyId)");
    expect(SANITY_WEBHOOK_PROJECTION).toContain("before().agencyId");
    expect(await receive()).toMatchObject({
      status: "accepted",
      event: {
        agencyId: "home",
        documentId: "agency-page-home",
        operation: "update",
      },
      revalidation: {
        paths: ["/sanity-page/home", "/"],
        tags: ["sanity:agencyPage:home"],
      },
    });
    expect(await receive()).toMatchObject({ status: "duplicate" });
    expect({ completed, revalidated }).toEqual({
      completed: 1,
      revalidated: 1,
    });
  });

  test("rejects stale, forged, and scope-mismatched webhook deliveries", async () => {
    const now = new Date("2026-08-16T08:00:00.000Z");
    const secret = "webhook-secret-with-at-least-32-characters";
    const rawBody = JSON.stringify({ _type: "agencyPage", agencyId: "home" });
    const request = async (input?: {
      age?: number;
      body?: string;
      forge?: boolean;
      projectId?: string;
    }) => {
      const body = input?.body ?? rawBody;
      const signature = await encodeSignatureHeader(
        input?.forge ? rawBody : body,
        now.getTime() - (input?.age ?? 0),
        secret,
      );
      return new Request("https://preview.example.com/api/sanity/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [sanityWebhookHeaderNames.signature]: signature,
          [sanityWebhookHeaderNames.idempotencyKey]: "delivery-2",
          [sanityWebhookHeaderNames.projectId]:
            input?.projectId ?? "project-test",
          [sanityWebhookHeaderNames.dataset]: "staging",
          [sanityWebhookHeaderNames.documentId]: "agency-page-home",
          [sanityWebhookHeaderNames.operation]: "update",
          [sanityWebhookHeaderNames.transactionId]: "transaction-2",
          [sanityWebhookHeaderNames.transactionTime]: now.toISOString(),
          [sanityWebhookHeaderNames.webhookId]: "webhook-1",
        },
        body,
      });
    };
    const options = {
      projectId: "project-test",
      dataset: "staging",
      secret,
      deliveries: {
        async claim() {
          return "claimed" as const;
        },
        async complete() {},
        async release() {},
      },
      now: () => now,
      async revalidate() {
        return { paths: ["/"] };
      },
    };

    await expect(
      receiveSanityWebhook(
        await request({ body: `${rawBody} `, forge: true }),
        options,
      ),
    ).rejects.toMatchObject<Partial<SanityWebhookRequestError>>({
      code: "INVALID_SIGNATURE",
      status: 401,
    });
    await expect(
      receiveSanityWebhook(await request({ projectId: "other" }), options),
    ).rejects.toMatchObject<Partial<SanityWebhookRequestError>>({
      code: "PROJECT_MISMATCH",
      status: 403,
    });
    await expect(
      receiveSanityWebhook(
        await request({ age: 24 * 60 * 60 * 1000 + 1 }),
        options,
      ),
    ).rejects.toMatchObject<Partial<SanityWebhookRequestError>>({
      code: "STALE_SIGNATURE",
      status: 401,
    });
    await expect(
      receiveSanityWebhook(
        await request({
          body: JSON.stringify({
            _type: "agencyPage",
            agencyId: "unsafe/path",
          }),
        }),
        options,
      ),
    ).rejects.toMatchObject<Partial<SanityWebhookRequestError>>({
      code: "INVALID_AGENCY_ID",
      status: 422,
    });
  });

  test("keeps stable item ids as Sanity array keys without leaking them back", () => {
    const encoded = addSanityArrayKeys(content("Original")) as {
      blocks: Array<{
        _key: string;
        data: { items?: Array<{ _key: string }> };
      }>;
    };
    expect(encoded.blocks.map(({ _key }) => _key)).toEqual(["hero", "faq"]);
    expect(encoded.blocks[1]?.data.items?.[0]?._key).toBe("question-one");
    expect(stripSanityArrayKeys(encoded)).toEqual(content("Original"));
    expect(
      stripSanityArrayKeys({
        blocks: [
          {
            _key: "studio-generated-key",
            _type: "agencyFaqItem",
            question: "Studio-created item",
          },
        ],
      }),
    ).toEqual({
      blocks: [{ id: "studio-generated-key", question: "Studio-created item" }],
    });
  });

  test("creates, saves, publishes, unpublishes and deletes through native semantics", async () => {
    const client = new FakeSanityClient();
    const provider = createSanityCmsPageProvider({
      client,
      parseContent,
      createId: () => "home",
      now: () => new Date("2026-08-16T00:00:00.000Z"),
    });

    const created = await provider.createDraft({
      content: content("Original"),
      actorId: "editor",
    });
    expect(created).toMatchObject({ id: "home", status: "draft", version: 1 });
    expect(await provider.getPublished({ id: "home" })).toBeNull();

    const saved = await provider.saveDraft({
      id: "home",
      expectedVersion: 1,
      content: content("Updated"),
      actorId: "editor",
    });
    expect(saved.version).toBe(2);
    expect(saved.content.title).toBe("Updated");

    await expect(
      provider.saveDraft({
        id: "home",
        expectedVersion: 1,
        content: content("Stale"),
        actorId: "editor",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT", retryable: true });

    const publication = await provider.publish({
      id: "home",
      expectedVersion: 2,
      actorId: "publisher",
      note: "Launch",
    });
    expect(publication.document).toMatchObject({
      status: "published",
      version: 3,
      updatedBy: "publisher",
    });
    expect(publication.revision).toMatchObject({
      documentId: "home",
      version: 3,
      note: "Launch",
    });

    const unpublished = await provider.unpublish({
      id: "home",
      expectedVersion: 3,
      actorId: "publisher",
    });
    expect(unpublished).toMatchObject({ status: "draft", version: 4 });
    expect(await provider.getPublished({ id: "home" })).toBeNull();

    const deleted = await provider.delete({
      id: "home",
      expectedVersion: 4,
      actorId: "owner",
    });
    expect(deleted.version).toBe(5);
    expect(await provider.getDraft({ id: "home" })).toBeNull();
  });

  test("maps Sanity revision conflicts and fails closed for unproven ports", async () => {
    const client = new FakeSanityClient();
    const provider = createSanityCmsPageProvider({ client, parseContent });
    const created = await provider.createDraft({
      id: "conflict",
      content: content("Original"),
      actorId: "editor",
    });
    client.failNextRequest409 = true;
    await expect(
      provider.saveDraft({
        id: "conflict",
        expectedVersion: created.version,
        content: content("Changed"),
        actorId: "editor",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT", retryable: true });
    await expect(
      provider.schedule({
        id: "conflict",
        expectedVersion: 1,
        scheduledAt: "2026-09-01T00:00:00.000Z",
        actorId: "editor",
      }),
    ).rejects.toBeInstanceOf(CmsError);
    await expect(provider.listRevisions("conflict")).rejects.toMatchObject({
      code: "CAPABILITY_UNAVAILABLE",
    });
  });

  test("uses a code-owned content projection for provider-specific asset resolution", async () => {
    const client = new FakeSanityClient();
    const provider = createSanityCmsPageProvider({
      client,
      parseContent,
      contentProjection:
        'content{...,seo{...,"ogImage":coalesce(ogImageAsset.asset->url,ogImage)}}',
    });
    await provider.createDraft({
      id: "projected",
      content: content("Projected"),
      actorId: "editor",
    });
    await provider.getDraft({ id: "projected" });
    expect(
      client.queries.some((query) =>
        query.includes('"ogImage":coalesce(ogImageAsset.asset->url,ogImage)'),
      ),
    ).toBe(true);
    expect(() =>
      createSanityCmsPageProvider({
        client,
        parseContent,
        contentProjection: '*[_type == "secret"]',
      }),
    ).toThrow(/contentProjection/i);
  });
});

describe("Sanity global-content provider", () => {
  test("publishes only the global capabilities it proves", () => {
    expect(sanityGlobalContentCapabilities.supported).toEqual([
      "content.readDraft",
      "content.write",
      "content.restore",
    ]);
  });

  test("passes the neutral version, history, conflict, and restore conformance", async () => {
    const client = new FakeGlobalSanityClient();
    const provider = createSanityCmsGlobalContentProvider({
      client,
      parseContent: parseGlobalContent,
    });
    const initial: GlobalContent = {
      kind: "site-settings",
      title: "Initial",
      items: [{ id: "phone", label: "Original phone" }],
    };
    const changed: GlobalContent = {
      kind: "site-settings",
      title: "Changed",
      items: [{ id: "phone", label: "Changed phone" }],
    };

    await expect(
      runGlobalContentProviderConformance({
        provider,
        initial,
        changed,
        key: "site:settings/vi-VN",
      }),
    ).resolves.toEqual({
      create: true,
      optimisticConflict: true,
      revisionHistory: true,
      restore: true,
      update: true,
    });
    const current = await provider.get({ key: "site:settings/vi-VN" });
    expect(current).toMatchObject({ content: initial, version: 3 });
    expect(JSON.stringify(current)).not.toContain("_key");
    expect(await provider.listRevisions("site:settings/vi-VN")).toHaveLength(3);
  });

  test("maps native revision conflicts and isolates revision keys", async () => {
    const client = new FakeGlobalSanityClient();
    const provider = createSanityCmsGlobalContentProvider({
      client,
      parseContent: parseGlobalContent,
    });
    const first = await provider.save({
      key: "navigation:header",
      expectedVersion: null,
      content: { kind: "navigation", title: "Header", items: [] },
      actorId: "editor",
    });
    await provider.save({
      key: "navigation:footer",
      expectedVersion: null,
      content: { kind: "navigation", title: "Footer", items: [] },
      actorId: "editor",
    });
    const foreignRevision = (
      await provider.listRevisions("navigation:footer")
    )[0]!;
    await expect(
      provider.restore({
        key: "navigation:header",
        revisionId: foreignRevision.id,
        expectedVersion: first.version,
        actorId: "editor",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    client.failNextRequest409 = true;
    await expect(
      provider.save({
        key: "navigation:header",
        expectedVersion: first.version,
        content: { kind: "navigation", title: "Changed", items: [] },
        actorId: "editor",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT", retryable: true });
  });
});

describe("Sanity visual integration helpers", () => {
  test("separates cacheable published reads from secure stega draft reads", () => {
    expect(createSanityPublishedClientOverlay()).toEqual({
      apiVersion: "2026-07-01",
      perspective: "published",
      useCdn: true,
      stega: { enabled: false },
    });
    expect(
      createSanityPreviewClientOverlay("https://studio.example.com/"),
    ).toEqual({
      apiVersion: "2026-07-01",
      perspective: "drafts",
      useCdn: false,
      stega: {
        enabled: true,
        studioUrl: "https://studio.example.com",
      },
    });
  });

  test("normalizes Presentation Tool origins and keeps draft endpoints same-origin", () => {
    expect(
      createSanityPresentationConfig({
        previewUrl: "https://www.example.com/",
        allowOrigins: ["https://www.example.com/path", "http://localhost:3000"],
      }),
    ).toEqual({
      allowOrigins: ["https://www.example.com", "http://localhost:3000"],
      previewUrl: {
        initial: "https://www.example.com",
        previewMode: {
          enable: "/api/draft-mode/enable",
          disable: "/api/draft-mode/disable",
        },
      },
    });
    expect(() =>
      createSanityPresentationConfig({
        previewUrl: "https://www.example.com",
        allowOrigins: [
          "https://www.example.com",
          "https://www.example.com/path",
        ],
      }),
    ).toThrow(/origins must be unique/i);
    expect(() =>
      createSanityPresentationConfig({
        previewUrl: "https://www.example.com",
        allowOrigins: ["https://www.example.com"],
        enablePath: "https://attacker.example/enable",
      }),
    ).toThrow(/same-origin paths/i);
  });
});

describe("Sanity hosted conformance", () => {
  const hostedInput = (client: FakeSanityClient) => ({
    client,
    projectId: "project-test",
    dataset: "test",
    documentId: "hosted-proof",
    actorId: "conformance",
    confirmation: "VERIFY SANITY project-test/test hosted-proof",
    content: content("Hosted proof"),
    parseContent,
    studioUrl: "https://studio.example.com/",
    previewUrl: "https://preview.example.com/",
    allowOrigins: ["https://preview.example.com"],
    gitCommit: "a".repeat(40),
    now: () => new Date("2026-08-16T00:00:00.000Z"),
  });

  test("requires an exact scope confirmation before touching a hosted dataset", async () => {
    const client = new FakeSanityClient();
    await expect(
      runSanityHostedConformance({
        ...hostedInput(client),
        confirmation: "VERIFY SANITY something-else",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(client.records.size).toBe(0);
    expect(
      requiredSanityHostedConfirmation({
        projectId: "project-test",
        dataset: "test",
        documentId: "hosted-proof",
      }),
    ).toBe("VERIFY SANITY project-test/test hosted-proof");
  });

  test("proves lifecycle, source maps and cleanup without leaking credentials", async () => {
    const client = new FakeSanityClient();
    const receipt = await runSanityHostedConformance(hostedInput(client));
    expect(receipt).toMatchObject({
      schemaVersion: 3,
      status: "complete",
      provider: "sanity",
      gitCommit: "a".repeat(40),
      globalKey: "hosted-conformance/hosted-proof",
      checks: {
        stableKeySourceMap: true,
        staleWriteRejected: true,
        globalCreate: true,
        globalOptimisticConflict: true,
        globalRevisionHistory: true,
        globalRestore: true,
        globalUpdate: true,
        cleanup: true,
      },
      globalStorageCapabilities: sanityGlobalContentCapabilities,
    });
    expect(client.records.size).toBe(0);
    expect(JSON.stringify(receipt)).not.toContain("token");
    expect(parseSanityHostedConformanceReceipt(receipt)).toEqual(receipt);
    expect(() =>
      parseSanityHostedConformanceReceipt({
        ...receipt,
        checks: { ...receipt.checks, cleanup: false },
      }),
    ).toThrow(/cleanup/i);
  });

  test("cleans up a partial proof and emits no receipt when source maps fail", async () => {
    const client = new FakeSanityClient();
    client.emptySourceMap = true;
    await expect(
      runSanityHostedConformance(hostedInput(client)),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(client.records.size).toBe(0);
  });

  test("fails closed with a manual-cleanup warning when automatic cleanup fails", async () => {
    const client = new FakeSanityClient();
    client.emptySourceMap = true;
    client.failCleanup = true;
    await expect(
      runSanityHostedConformance(hostedInput(client)),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      message: expect.stringMatching(/remove the proof document manually/i),
    });
    expect(client.records.size).toBe(1);
  });

  test("withholds the receipt when immutable global proof revisions cannot be cleaned", async () => {
    const client = new FakeSanityClient();
    client.failGlobalCleanup = true;
    await expect(
      runSanityHostedConformance(hostedInput(client)),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      message: expect.stringMatching(/remove the proof document manually/i),
      details: {
        globalKey: "hosted-conformance/hosted-proof",
      },
    });
    expect(client.records.size).toBe(4);
    expect(
      [...client.records.values()].every(
        (record) =>
          "globalKey" in record &&
          record.globalKey === "hosted-conformance/hosted-proof",
      ),
    ).toBe(true);
  });

  test("keeps production fail-closed unless it is named explicitly", () => {
    expect(() =>
      requiredSanityHostedConfirmation({
        projectId: "project-test",
        dataset: "production",
        documentId: "hosted-proof",
      }),
    ).toThrow(/staging-only/i);
    expect(
      requiredSanityHostedConfirmation({
        projectId: "project-test",
        dataset: "production",
        documentId: "hosted-proof",
        allowProduction: true,
      }),
    ).toBe("VERIFY SANITY project-test/production hosted-proof PRODUCTION");
  });
});

describe("Sanity Presentation receipt", () => {
  const observation = () => ({
    schemaVersion: 1 as const,
    status: "complete" as const,
    projectId: "project-test",
    dataset: "staging",
    documentId: "presentation-proof",
    startedAt: "2026-08-16T00:00:00.000Z",
    completedAt: "2026-08-16T00:02:00.000Z",
    studioOrigin: "https://studio.example.com",
    previewOrigin: "https://preview.example.com",
    browserProject: "desktop-chrome" as const,
    checks: Object.fromEntries(
      sanityPresentationBrowserCheckNames.map((name) => [name, true]),
    ) as Record<(typeof sanityPresentationBrowserCheckNames)[number], true>,
  });

  test("requires an exact staging or explicit production confirmation", () => {
    expect(
      requiredSanityPresentationConfirmation({
        projectId: "project-test",
        dataset: "staging",
        documentId: "presentation-proof",
      }),
    ).toBe(
      "VERIFY SANITY PRESENTATION project-test/staging presentation-proof",
    );
    expect(() =>
      requiredSanityPresentationConfirmation({
        projectId: "project-test",
        dataset: "production",
        documentId: "presentation-proof",
      }),
    ).toThrow(/staging-only/i);
    expect(
      requiredSanityPresentationConfirmation({
        projectId: "project-test",
        dataset: "production",
        documentId: "presentation-proof",
        allowProduction: true,
      }),
    ).toEndWith(" PRODUCTION");
  });

  test("keeps the browser workflow network-free and non-mutating in dry-run", () => {
    const result = Bun.spawnSync(
      [
        process.execPath,
        "scripts/verify-presentation.ts",
        "--id=presentation-proof",
        "--hosted-receipt=docs/releases/evidence/sanity-hosted-proof.json",
      ],
      {
        cwd: fileURLToPath(new URL("..", import.meta.url)),
        env: {
          ...process.env,
          SANITY_PROJECT_ID: "project-test",
          SANITY_DATASET: "staging",
          SANITY_STUDIO_URL: "https://studio.example.com",
          SANITY_PREVIEW_URL: "https://preview.example.com",
          SANITY_API_TOKEN: "",
        },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout.toString())).toMatchObject({
      status: "dry-run",
      mutatesDataset: false,
      launchesAuthenticatedBrowser: false,
      writesReceipt: false,
      requiredConfirmation:
        "VERIFY SANITY PRESENTATION project-test/staging presentation-proof",
    });
  });

  test("accepts only the exact browser observation scope and checks", () => {
    expect(
      parseSanityPresentationObservation(observation(), {
        projectId: "project-test",
        dataset: "staging",
        documentId: "presentation-proof",
        studioUrl: "https://studio.example.com/presentation",
        previewUrl: "https://preview.example.com/sanity-preview/home",
      }),
    ).toEqual(observation());
    expect(() =>
      parseSanityPresentationObservation(
        {
          ...observation(),
          checks: {
            ...observation().checks,
            clickToEdit: false,
          },
        },
        {
          projectId: "project-test",
          dataset: "staging",
          documentId: "presentation-proof",
          studioUrl: "https://studio.example.com",
          previewUrl: "https://preview.example.com",
        },
      ),
    ).toThrow(/clickToEdit/i);
  });

  test("binds clean provenance, hosted evidence, artifacts and cleanup", () => {
    const receipt = createSanityPresentationReceipt({
      observation: observation(),
      gitCommit: "a".repeat(40),
      hostedReceiptPath:
        "docs/releases/evidence/sanity-hosted-presentation-proof.json",
      hostedReceiptSha256: "b".repeat(64),
      hostedReceiptGitCommit: "e".repeat(40),
      artifacts: [
        {
          kind: "playwright-report",
          path: "docs/releases/evidence/sanity-presentation-proof/report.json",
          sha256: "c".repeat(64),
        },
        {
          kind: "screenshot",
          path: "docs/releases/evidence/sanity-presentation-proof/studio.png",
          sha256: "d".repeat(64),
        },
      ],
    });
    expect(receipt).toMatchObject({
      schemaVersion: 1,
      status: "complete",
      provider: "sanity",
      proof: "presentation",
      checks: {
        clickToEdit: true,
        sourceDocumentsCleaned: true,
        previewSecretsCleaned: true,
      },
    });
    expect(parseSanityPresentationReceipt(receipt)).toEqual(receipt);
    expect(() =>
      parseSanityPresentationReceipt({ ...receipt, forged: true }),
    ).toThrow(/unknown fields/i);
    expect(() =>
      parseSanityPresentationReceipt({
        ...receipt,
        artifacts: receipt.artifacts.map((artifact) => ({
          ...artifact,
          kind: "screenshot",
        })),
      }),
    ).toThrow(/one report and one screenshot/i);
    expect(() =>
      createSanityPresentationReceipt({
        observation: observation(),
        gitCommit: "a".repeat(40),
        hostedReceiptPath: "../forged.json",
        hostedReceiptSha256: "b".repeat(64),
        hostedReceiptGitCommit: "e".repeat(40),
        artifacts: [],
      }),
    ).toThrow(/path|artifacts/i);
  });
});

describe("Sanity promotion receipt", () => {
  test("keeps promotion dry-run read-only and exact-confirmation gated", () => {
    const result = Bun.spawnSync(
      [
        process.execPath,
        "scripts/verify-promotion.ts",
        "--hosted-id=hosted-proof",
        "--presentation-id=presentation-proof",
        "--hosted-receipt=docs/releases/evidence/hosted.json",
        "--presentation-receipt=docs/releases/evidence/presentation.json",
      ],
      {
        cwd: fileURLToPath(new URL("..", import.meta.url)),
        env: {
          ...process.env,
          SANITY_PROJECT_ID: "project-test",
          SANITY_DATASET: "staging",
        },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout.toString())).toMatchObject({
      status: "dry-run",
      networkAccess: false,
      writesReceipt: false,
      requiredConfirmation:
        "VERIFY SANITY PROMOTION project-test/staging hosted-proof presentation-proof",
    });
    expect(
      requiredSanityPromotionConfirmation({
        projectId: "project-test",
        dataset: "staging",
        hostedDocumentId: "hosted-proof",
        presentationDocumentId: "presentation-proof",
      }),
    ).toBe(
      "VERIFY SANITY PROMOTION project-test/staging hosted-proof presentation-proof",
    );
  });

  test("binds both proof receipts, immutable commits and all evidence", async () => {
    const hosted = await runSanityHostedConformance({
      client: new FakeSanityClient(),
      projectId: "project-test",
      dataset: "test",
      documentId: "hosted-proof",
      actorId: "promotion-test",
      confirmation: "VERIFY SANITY project-test/test hosted-proof",
      content: content("Hosted promotion proof"),
      parseContent,
      studioUrl: "https://studio.example.com",
      previewUrl: "https://preview.example.com",
      allowOrigins: ["https://preview.example.com"],
      gitCommit: "a".repeat(40),
      now: () => new Date("2026-08-16T00:00:00.000Z"),
    });
    const presentation = createSanityPresentationReceipt({
      observation: {
        schemaVersion: 1,
        status: "complete",
        projectId: "project-test",
        dataset: "test",
        documentId: "presentation-proof",
        startedAt: "2026-08-16T00:01:00.000Z",
        completedAt: "2026-08-16T00:02:00.000Z",
        studioOrigin: "https://studio.example.com",
        previewOrigin: "https://preview.example.com",
        browserProject: "desktop-chrome",
        checks: Object.fromEntries(
          sanityPresentationBrowserCheckNames.map((name) => [name, true]),
        ) as Record<(typeof sanityPresentationBrowserCheckNames)[number], true>,
      },
      gitCommit: "b".repeat(40),
      hostedReceiptPath: "docs/releases/evidence/hosted.json",
      hostedReceiptSha256: "c".repeat(64),
      hostedReceiptGitCommit: hosted.gitCommit,
      artifacts: [
        {
          kind: "playwright-report",
          path: "docs/releases/evidence/presentation/report.json",
          sha256: "d".repeat(64),
        },
        {
          kind: "screenshot",
          path: "docs/releases/evidence/presentation/studio.png",
          sha256: "e".repeat(64),
        },
      ],
    });
    const receipt = createSanityPromotionReceipt({
      hostedReceipt: hosted,
      presentationReceipt: presentation,
      generatedAt: "2026-08-16T00:03:00.000Z",
      gitCommit: "f".repeat(40),
      provenance: {
        cleanCheckout: true,
        proofCommitsReachable: true,
        evidenceOnlySincePresentationProof: true,
      },
      evidence: [
        {
          kind: "hosted-receipt",
          path: "docs/releases/evidence/hosted.json",
          sha256: "c".repeat(64),
        },
        {
          kind: "presentation-receipt",
          path: "docs/releases/evidence/presentation.json",
          sha256: "1".repeat(64),
        },
        {
          kind: "playwright-report",
          path: "docs/releases/evidence/presentation/report.json",
          sha256: "d".repeat(64),
        },
        {
          kind: "screenshot",
          path: "docs/releases/evidence/presentation/studio.png",
          sha256: "e".repeat(64),
        },
      ],
    });
    expect(receipt).toMatchObject({
      schemaVersion: 1,
      proof: "promotion-readiness",
      gitCommit: "f".repeat(40),
      checks: {
        cleanCheckout: true,
        hostedBindingMatches: true,
        artifactDigestsMatch: true,
        evidenceOnlySincePresentationProof: true,
      },
    });
    expect(parseSanityPromotionReceipt(receipt)).toEqual(receipt);
    expect(() =>
      parseSanityPromotionReceipt({ ...receipt, forged: true }),
    ).toThrow(/unknown fields/i);
    expect(() =>
      createSanityPromotionReceipt({
        hostedReceipt: hosted,
        presentationReceipt: presentation,
        generatedAt: "2026-08-16T00:03:00.000Z",
        gitCommit: "f".repeat(40),
        provenance: {
          cleanCheckout: true,
          proofCommitsReachable: true,
          evidenceOnlySincePresentationProof: true,
        },
        evidence: receipt.evidence.map((item) =>
          item.kind === "hosted-receipt"
            ? { ...item, sha256: "9".repeat(64) }
            : item,
        ),
      }),
    ).toThrow(/hosted receipt binding/i);
  });
});
