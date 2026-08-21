import { describe, expect, test } from "bun:test";
import {
  cmsSearchExtensionManifest,
  cmsSearchModule,
  createCmsSearchReindexTask,
  createMemoryCmsSearchIndex,
} from "../src";

const documents = [
  {
    id: "curtain",
    collection: "products",
    locale: "vi",
    title: "Rèm cửa đẹp",
    body: "Vải linen cho phòng khách",
    path: "/rem-cua",
    facets: { category: "curtain", color: ["cream", "gold"] },
  },
  {
    id: "blind",
    collection: "products",
    locale: "vi",
    title: "Mành sáo",
    body: "Thiết kế tối giản",
    path: "/manh-sao",
    facets: { category: "blind", color: "cream" },
  },
] as const;

describe("official search module", () => {
  test("owns lifecycle metadata and provides bounded full-text facets", async () => {
    expect(cmsSearchModule.manifest).toMatchObject({
      packageName: "@agency/cms-module-search",
      uninstall: { dataPolicy: "delete" },
    });
    expect(cmsSearchExtensionManifest).toMatchObject({
      id: "official/search",
      entrypoints: [{ runtime: "server" }],
      data: { uninstall: { policy: "delete" } },
    });
    const index = createMemoryCmsSearchIndex();
    await index.replaceAll(documents, {
      idempotencyKey: "seed",
      signal: new AbortController().signal,
    });
    const result = await index.search({
      query: "rem cua",
      filters: { category: "curtain" },
      facets: ["color"],
      limit: 10,
    });
    expect(result.total).toBe(1);
    expect(result.hits[0]?.document.id).toBe("curtain");
    expect(result.facets.color).toEqual({ cream: 1, gold: 1 });
    await expect(index.search({ query: "x", limit: 101 })).rejects.toThrow(
      "limit",
    );
  });

  test("reindexes through an idempotent durable task contract", async () => {
    const index = createMemoryCmsSearchIndex();
    const task = createCmsSearchReindexTask({
      index,
      loadDocuments: async () => documents,
    });
    const payload = task.parsePayload({
      collections: ["products", "products"],
      locales: ["vi"],
    });
    const result = await task.execute(payload, {
      jobId: "job-1",
      attempt: 1,
      idempotencyKey: "reindex-1",
      signal: new AbortController().signal,
    });
    expect(result).toEqual({ indexed: 2 });
    expect((await index.search({ query: "linen" })).total).toBe(1);
  });
});
