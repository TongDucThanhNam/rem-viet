import { writeFile } from "node:fs/promises";

import "./load-env";

type SqlValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Date
  | Record<string, unknown>
  | unknown[];

type NotionPage = {
  id: string;
  created_time?: string;
  last_edited_time?: string;
  cover?: {
    type?: "external" | "file";
    external?: { url?: string };
    file?: { url?: string };
  } | null;
  properties?: Record<string, unknown>;
  url?: string;
};

const outputPath =
  process.env.D1_NOTION_IMPORT_SQL_PATH ?? "notion-d1-import.sql";
const notionApiKey = process.env.NOTION_API_KEY;
const notionDatabaseId = process.env.NOTION_DATABASE_ID;
const notionVersion = process.env.NOTION_VERSION ?? "2022-06-28";

if (!notionApiKey) {
  throw new Error("Missing NOTION_API_KEY.");
}

if (!notionDatabaseId) {
  throw new Error("Missing NOTION_DATABASE_ID.");
}

function jsonValue(value: unknown) {
  return JSON.stringify(value);
}

function sql(value: SqlValue) {
  if (value === undefined || value === null) {
    return "NULL";
  }

  if (value instanceof Date) {
    return String(value.getTime());
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "NULL";
  }

  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }

  if (Array.isArray(value) || typeof value === "object") {
    return sql(jsonValue(value));
  }

  return `'${value.replaceAll("'", "''")}'`;
}

function insert(table: string, columns: string[], values: SqlValue[]) {
  return `INSERT OR REPLACE INTO ${table} (${columns.join(", ")}) VALUES (${values.map(sql).join(", ")});`;
}

function dateMs(value: unknown, fallback = new Date()) {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getTime();
    }
  }

  return fallback.getTime();
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[*+~.()'"!:@?]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function uniqueSlug(
  rawSlug: string,
  pageId: string,
  seenSlugs: Map<string, number>,
) {
  const fallbackSlug = pageId.replaceAll("-", "").slice(0, 12) || "post";
  const baseSlug = rawSlug || fallbackSlug;
  const existingCount = seenSlugs.get(baseSlug) ?? 0;
  seenSlugs.set(baseSlug, existingCount + 1);

  if (existingCount === 0) {
    return baseSlug;
  }

  return `${baseSlug}-${existingCount + 1}`;
}

function property(page: NotionPage, name: string) {
  return page.properties?.[name] as Record<string, unknown> | undefined;
}

function richTextPlain(value: unknown) {
  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .map((item) => {
      if (item && typeof item === "object" && "plain_text" in item) {
        return String((item as { plain_text?: unknown }).plain_text ?? "");
      }

      return "";
    })
    .join("");
}

function title(page: NotionPage) {
  return richTextPlain(property(page, "title")?.title) || "Untitled";
}

function description(page: NotionPage) {
  return richTextPlain(property(page, "description")?.rich_text);
}

function tags(page: NotionPage) {
  const multiSelect = property(page, "tags")?.multi_select;

  if (!Array.isArray(multiSelect)) {
    return [];
  }

  return multiSelect
    .map((tag) =>
      tag && typeof tag === "object" && "name" in tag
        ? String((tag as { name?: unknown }).name ?? "")
        : "",
    )
    .filter(Boolean);
}

function status(page: NotionPage) {
  const select = property(page, "status")?.select;

  if (select && typeof select === "object" && "name" in select) {
    return String(
      (select as { name?: unknown }).name ?? "draft",
    ).toLowerCase() === "published"
      ? "published"
      : "draft";
  }

  return "draft";
}

function publishDate(page: NotionPage) {
  const date = property(page, "publish_date")?.date;

  if (date && typeof date === "object" && "start" in date) {
    return String((date as { start?: unknown }).start ?? "");
  }

  return "";
}

function coverImage(page: NotionPage) {
  return page.cover?.external?.url ?? page.cover?.file?.url ?? "";
}

function tableOfContents(blocks: unknown[]) {
  const tocBlocks = blocks.filter((block) => {
    if (!block || typeof block !== "object") {
      return false;
    }

    return (block as { type?: unknown }).type === "table_of_contents";
  });

  return tocBlocks.length ? tocBlocks : null;
}

async function notionFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${notionApiKey}`,
      "Content-Type": "application/json",
      "Notion-Version": notionVersion,
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Notion request failed ${response.status}: ${await response.text()}`,
    );
  }

  return (await response.json()) as T;
}

async function listDatabasePages() {
  const pages: NotionPage[] = [];
  let startCursor: string | undefined;

  do {
    const response = await notionFetch<{
      results: NotionPage[];
      has_more: boolean;
      next_cursor?: string;
    }>(`/databases/${notionDatabaseId}/query`, {
      method: "POST",
      body: JSON.stringify(startCursor ? { start_cursor: startCursor } : {}),
    });

    pages.push(...response.results);
    startCursor = response.has_more ? response.next_cursor : undefined;
  } while (startCursor);

  return pages;
}

async function listBlocks(pageId: string) {
  const blocks: unknown[] = [];
  let startCursor: string | undefined;

  do {
    const query = startCursor
      ? `?start_cursor=${encodeURIComponent(startCursor)}`
      : "";
    const response = await notionFetch<{
      results: unknown[];
      has_more: boolean;
      next_cursor?: string;
    }>(`/blocks/${pageId}/children${query}`);

    blocks.push(...response.results);
    startCursor = response.has_more ? response.next_cursor : undefined;
  } while (startCursor);

  return blocks;
}

async function main() {
  const now = new Date();
  const statements = ["PRAGMA foreign_keys = OFF;", "BEGIN TRANSACTION;"];
  const pages = await listDatabasePages();
  const seenSlugs = new Map<string, number>();

  for (const page of pages) {
    const pageTitle = title(page);
    const pageSlug = uniqueSlug(slugify(pageTitle), page.id, seenSlugs);
    const blocks = await listBlocks(page.id);

    statements.push(
      insert(
        "posts",
        [
          "id",
          "slug",
          "title",
          "description",
          "cover_image",
          "tags",
          "status",
          "url",
          "content",
          "table_of_contents",
          "publish_date",
          "created_at",
          "updated_at",
        ],
        [
          page.id,
          pageSlug,
          pageTitle,
          description(page),
          coverImage(page),
          tags(page),
          status(page),
          page.url ?? "",
          blocks,
          tableOfContents(blocks),
          publishDate(page),
          dateMs(page.created_time, now),
          dateMs(page.last_edited_time, now),
        ],
      ),
    );
  }

  statements.push("COMMIT;", "PRAGMA foreign_keys = ON;");
  await writeFile(outputPath, `${statements.join("\n")}\n`);
  console.log(`Wrote ${pages.length} Notion posts to ${outputPath}`);
}

await main();
