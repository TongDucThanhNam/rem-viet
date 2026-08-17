import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  applyCloudflareCmsMigrations,
  createCloudflareCmsMediaProvider,
  createCloudflareCmsPageProvider,
  type CloudflareR2MediaBucket,
} from "@agency/cms-provider-cloudflare";
import type { CmsPageContent } from "@agency/cms-runtime";

import { LocalD1 } from "./libsql-d1";

export type UpgradeBlock = {
  type: "text";
  schemaVersion: 1;
  data: { body: string };
};
export type UpgradeContent = CmsPageContent<UpgradeBlock>;

function databaseUrl() {
  return `file:${resolve(import.meta.dir, "provider.sqlite").replaceAll("\\", "/")}`;
}

export function parseContent(value: unknown): UpgradeContent {
  const content = value as UpgradeContent;
  if (
    !content ||
    typeof content.title !== "string" ||
    typeof content.slug !== "string" ||
    !Array.isArray(content.blocks) ||
    !content.seo
  ) {
    throw new Error("Invalid upgrade fixture content.");
  }
  return content;
}

export function page(title: string, body: string): UpgradeContent {
  return {
    title,
    slug: "upgrade-page",
    template: "standard",
    blocks: [
      { type: "text", schemaVersion: 1, data: { body } },
    ] as UpgradeBlock[],
    seo: {
      title,
      description: body,
      canonicalUrl: "",
      ogImage: "",
      robotsIndex: true,
      robotsFollow: true,
    },
  };
}

function objectPath(key: string) {
  if (!/^media\/[a-z0-9.-]+$/i.test(key)) {
    throw new Error("Unsafe upgrade fixture object key.");
  }
  return resolve(import.meta.dir, "media-objects", key);
}

export const bucket: CloudflareR2MediaBucket = {
  async put(key, value) {
    const target = objectPath(key);
    await mkdir(dirname(target), { recursive: true });
    const bytes =
      value instanceof Uint8Array
        ? value
        : new TextEncoder().encode(String(value));
    await writeFile(target, bytes);
  },
  async delete(key) {
    await rm(objectPath(key), { force: true });
  },
};

export async function openProviders() {
  const database = new LocalD1(databaseUrl());
  await applyCloudflareCmsMigrations(database);
  let sequence = 0;
  return {
    database,
    pageProvider: createCloudflareCmsPageProvider({
      database,
      parseContent,
      createId: () => `upgrade-generated-${++sequence}`,
      now: () => new Date("2026-08-16T00:00:00.000Z"),
    }),
    mediaProvider: createCloudflareCmsMediaProvider({
      database,
      bucket,
      now: () => new Date("2026-08-16T00:00:00.000Z"),
    }),
  };
}

export const mediaObjectPath = () => objectPath("media/upgrade.png");
