import { describe, expect, test } from "bun:test";

import {
  createRichTextBlockId,
  ensureRichTextBlockIds,
  parseRichTextDocument,
  publicFormSubmissionSchema,
  redirectSchema,
  richTextDocumentSchema,
  safeMediaSourceSchema,
  safePublicLinkSchema,
  siteManifestSchema,
  wouldCreateRedirectLoop,
} from "../src";

describe("client operations contracts", () => {
  test("redirects are internal and reject protocol-relative targets", () => {
    expect(
      redirectSchema.safeParse({ id: "1", oldPath: "/old", newPath: "/new" })
        .success,
    ).toBe(true);
    expect(
      redirectSchema.safeParse({
        id: "1",
        oldPath: "/old",
        newPath: "//evil.example",
      }).success,
    ).toBe(false);
  });

  test("redirect graph rejects direct and multi-hop loops", () => {
    const graph = [
      { id: "1", oldPath: "/a", newPath: "/b", active: true },
      { id: "2", oldPath: "/b", newPath: "/c", active: true },
    ];
    expect(
      wouldCreateRedirectLoop(graph, { oldPath: "/c", newPath: "/a" }),
    ).toBe(true);
    expect(
      wouldCreateRedirectLoop(graph, { oldPath: "/c", newPath: "/done" }),
    ).toBe(false);
    expect(
      wouldCreateRedirectLoop(graph, { oldPath: "/same", newPath: "/same" }),
    ).toBe(true);
  });

  test("lead payload is bounded and honeypot is typed", () => {
    const valid = publicFormSubmissionSchema.safeParse({
      formKey: "contact",
      payload: { email: "a@example.com" },
      sourcePage: "/lien-he",
      website: "",
    });
    const invalid = publicFormSubmissionSchema.safeParse({
      formKey: "contact",
      payload: Object.fromEntries(
        Array.from({ length: 31 }, (_, index) => [`field${index}`, "x"]),
      ),
    });
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });
});

describe("safe rich text", () => {
  test("accepts structured blocks and requires image alt", () => {
    const valid = richTextDocumentSchema.safeParse({
      version: 1,
      blocks: [{ type: "heading", level: 2, children: [{ text: "Xin chào" }] }],
    });
    const invalid = richTextDocumentSchema.safeParse({
      version: 1,
      blocks: [{ type: "image", src: "/image.webp", alt: "", caption: "" }],
    });
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
    expect(parseRichTextDocument("<script>alert(1)</script>")).toBeNull();
  });

  test("upgrades and preserves document-scoped block identities", () => {
    const normalized = richTextDocumentSchema.parse({
      version: 1,
      blocks: [
        { type: "paragraph", children: [{ text: "Legacy" }] },
        {
          id: "rich-kept",
          type: "heading",
          level: 2,
          children: [{ text: "Kept" }],
        },
        {
          id: "rich-kept",
          type: "quote",
          children: [{ text: "Duplicate" }],
        },
      ],
    });
    expect(normalized.blocks.map((block) => block.id)).toEqual([
      "rich-0-paragraph",
      "rich-kept",
      "rich-2-quote",
    ]);
    expect(ensureRichTextBlockIds(normalized.blocks)).toEqual(
      normalized.blocks,
    );
    expect(
      createRichTextBlockId(
        "paragraph",
        normalized.blocks.map((block) => block.id),
        "fixed",
      ),
    ).toBe("rich-paragraph-fixed");
    expect(
      createRichTextBlockId("paragraph", ["rich-paragraph-fixed"], "fixed"),
    ).toBe("rich-paragraph-fixed-2");
  });

  test("rejects script/data protocols in links, media and embeds", () => {
    expect(safePublicLinkSchema.safeParse("javascript:alert(1)").success).toBe(
      false,
    );
    expect(safePublicLinkSchema.safeParse("//evil.example/path").success).toBe(
      false,
    );
    expect(safePublicLinkSchema.safeParse("/lien-he").success).toBe(true);
    expect(
      safePublicLinkSchema.safeParse("mailto:hello@example.com").success,
    ).toBe(true);
    expect(safeMediaSourceSchema.safeParse("data:text/html,bad").success).toBe(
      false,
    );
    expect(
      richTextDocumentSchema.safeParse({
        version: 1,
        blocks: [{ type: "video", url: "javascript:alert(1)", title: "Bad" }],
      }).success,
    ).toBe(false);
  });
});

describe("white-label manifest", () => {
  test("rejects unsafe Cloudflare resource names", () => {
    const result = siteManifestSchema.safeParse({
      id: "Bad_Name",
      name: "Bad",
      siteUrl: "https://example.com",
      description: "Example",
      locale: "vi-VN",
      preset: "showcase",
      brand: { logo: "/logo.svg", colors: {}, fonts: ["sans"] },
      contact: {},
      features: { blog: true, catalog: false, orders: false, leads: true },
      infrastructure: {
        alchemyApp: "bad",
        workerName: "bad",
        d1Name: "bad",
        r2BucketName: "bad",
        backupBucketName: "bad",
      },
    });
    expect(result.success).toBe(false);
  });

  test("requires siteUrl to be an HTTPS origin", () => {
    const base = {
      id: "safe-site",
      name: "Safe Site",
      siteUrl: "https://example.com",
      description: "Example",
      locale: "vi-VN" as const,
      preset: "showcase" as const,
      brand: { logo: "/logo.svg", colors: {}, fonts: ["sans"] },
      contact: {},
      features: { blog: true, catalog: false, orders: false, leads: true },
      infrastructure: {
        alchemyApp: "safe-site",
        workerName: "safe-site-web",
        d1Name: "safe-site-db",
        r2BucketName: "safe-site-media",
        backupBucketName: "safe-site-backups",
      },
    };

    expect(siteManifestSchema.parse(base).siteUrl).toBe("https://example.com");
    for (const siteUrl of [
      "http://example.com",
      "https://example.com/client",
      "https://example.com?preview=1",
      "https://user:password@example.com",
    ])
      expect(siteManifestSchema.safeParse({ ...base, siteUrl }).success).toBe(
        false,
      );
  });
});
