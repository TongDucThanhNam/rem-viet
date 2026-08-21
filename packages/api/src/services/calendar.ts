import { REM_VIET_STANDARD_PAGES_COLLECTION } from "@agency/cms-template-rem-viet";
import { createDb } from "@rem-viet/db";
import {
  cmsCollectionDocuments,
  pages,
  posts,
} from "@rem-viet/db/schema/content";
import { cmsReleases } from "@rem-viet/db/schema/automation";
import { and, asc, gte, isNotNull, lt } from "drizzle-orm";
import { z } from "zod";

import { listEditorialReviewQueue } from "./editorial-reviews";

const dayMs = 24 * 60 * 60 * 1_000;

export const cmsCalendarEntryKindSchema = z.enum([
  "content_schedule",
  "release_schedule",
  "review_due",
]);

const allCalendarEntryKinds = cmsCalendarEntryKindSchema.options;

export const listCmsCalendarInputSchema = z
  .object({
    from: z.string().datetime({ offset: true }),
    to: z.string().datetime({ offset: true }),
    kinds: z
      .array(cmsCalendarEntryKindSchema)
      .min(1)
      .max(allCalendarEntryKinds.length)
      .default([...allCalendarEntryKinds])
      .transform((values) => [...new Set(values)].sort()),
    limit: z.number().int().min(1).max(500).default(300),
  })
  .superRefine((value, context) => {
    const from = new Date(value.from).getTime();
    const to = new Date(value.to).getTime();
    if (from >= to) {
      context.addIssue({
        code: "custom",
        message: "Calendar end must be after its start",
        path: ["to"],
      });
    }
    if (to - from > 366 * dayMs) {
      context.addIssue({
        code: "custom",
        message: "Calendar ranges are limited to 366 days",
        path: ["to"],
      });
    }
  });

type CmsCalendarEntryKind = z.infer<typeof cmsCalendarEntryKindSchema>;

export type CmsCalendarEntry = Readonly<{
  id: string;
  kind: CmsCalendarEntryKind;
  startsAt: string;
  title: string;
  status: string;
  entityType: "collection" | "page" | "post" | "release";
  entityId: string;
  collection: string | null;
  locale: string;
  overdue: boolean;
}>;

type CmsCalendarSourceEntry = Omit<CmsCalendarEntry, "overdue" | "startsAt"> & {
  startsAt: Date | string;
};

export type CmsCalendarRuntime = Readonly<{
  db?: ReturnType<typeof createDb>;
  now?: () => Date;
  reviewQueue?: typeof listEditorialReviewQueue;
}>;

function runtimeDb(runtime?: CmsCalendarRuntime) {
  return runtime?.db ?? createDb();
}

function runtimeNow(runtime?: CmsCalendarRuntime) {
  return runtime?.now?.() ?? new Date();
}

function collectionTitle(input: {
  collectionSlug: string;
  id: string;
  data: Record<string, unknown>;
}) {
  for (const key of ["title", "name", "label", "slug"] as const) {
    const value = input.data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return `${input.collectionSlug}/${input.id}`;
}

export function buildCmsCalendarEntries(
  sourceEntries: readonly CmsCalendarSourceEntry[],
  input: z.input<typeof listCmsCalendarInputSchema>,
  now = new Date(),
) {
  const parsed = listCmsCalendarInputSchema.parse(input);
  const from = new Date(parsed.from).getTime();
  const to = new Date(parsed.to).getTime();
  const kinds = new Set(parsed.kinds);
  const seen = new Set<string>();

  return sourceEntries
    .flatMap((entry) => {
      const startsAt = new Date(entry.startsAt);
      const timestamp = startsAt.getTime();
      if (
        !Number.isFinite(timestamp) ||
        timestamp < from ||
        timestamp >= to ||
        !kinds.has(entry.kind) ||
        seen.has(entry.id)
      ) {
        return [];
      }
      seen.add(entry.id);
      return [
        {
          ...entry,
          startsAt: startsAt.toISOString(),
          overdue:
            timestamp < now.getTime() &&
            (entry.kind === "review_due" || entry.status === "scheduled"),
        } satisfies CmsCalendarEntry,
      ];
    })
    .sort((left, right) => {
      const byDate = left.startsAt.localeCompare(right.startsAt);
      if (byDate !== 0) return byDate;
      const byKind = left.kind.localeCompare(right.kind);
      if (byKind !== 0) return byKind;
      const byTitle = left.title.localeCompare(right.title);
      return byTitle !== 0 ? byTitle : left.id.localeCompare(right.id);
    })
    .slice(0, parsed.limit);
}

export async function listCmsCalendar(
  input: z.input<typeof listCmsCalendarInputSchema>,
  runtime?: CmsCalendarRuntime,
) {
  const parsed = listCmsCalendarInputSchema.parse(input);
  const db = runtimeDb(runtime);
  const from = new Date(parsed.from);
  const to = new Date(parsed.to);

  const [pageRows, postRows, collectionRows, releaseRows, reviewRows] =
    await Promise.all([
      db
        .select({
          id: pages.id,
          scheduledAt: pages.scheduledAt,
          title: pages.title,
        })
        .from(pages)
        .where(
          and(
            isNotNull(pages.scheduledAt),
            gte(pages.scheduledAt, from),
            lt(pages.scheduledAt, to),
          ),
        )
        .orderBy(asc(pages.scheduledAt), asc(pages.id))
        .limit(parsed.limit),
      db
        .select({
          id: posts.id,
          scheduledAt: posts.scheduledAt,
          title: posts.title,
        })
        .from(posts)
        .where(
          and(
            isNotNull(posts.scheduledAt),
            gte(posts.scheduledAt, from),
            lt(posts.scheduledAt, to),
          ),
        )
        .orderBy(asc(posts.scheduledAt), asc(posts.id))
        .limit(parsed.limit),
      db
        .select({
          collectionSlug: cmsCollectionDocuments.collectionSlug,
          data: cmsCollectionDocuments.data,
          id: cmsCollectionDocuments.id,
          locale: cmsCollectionDocuments.locale,
          scheduledAt: cmsCollectionDocuments.scheduledAt,
        })
        .from(cmsCollectionDocuments)
        .where(
          and(
            isNotNull(cmsCollectionDocuments.scheduledAt),
            gte(cmsCollectionDocuments.scheduledAt, from),
            lt(cmsCollectionDocuments.scheduledAt, to),
          ),
        )
        .orderBy(
          asc(cmsCollectionDocuments.scheduledAt),
          asc(cmsCollectionDocuments.collectionSlug),
          asc(cmsCollectionDocuments.id),
          asc(cmsCollectionDocuments.locale),
        )
        .limit(parsed.limit),
      db
        .select({
          id: cmsReleases.id,
          name: cmsReleases.name,
          scheduledAt: cmsReleases.scheduledAt,
          status: cmsReleases.status,
        })
        .from(cmsReleases)
        .where(
          and(
            isNotNull(cmsReleases.scheduledAt),
            gte(cmsReleases.scheduledAt, from),
            lt(cmsReleases.scheduledAt, to),
          ),
        )
        .orderBy(asc(cmsReleases.scheduledAt), asc(cmsReleases.id))
        .limit(parsed.limit),
      (runtime?.reviewQueue ?? listEditorialReviewQueue)({
        dueFrom: parsed.from,
        dueTo: parsed.to,
        limit: Math.min(parsed.limit, 100),
      }),
    ]);

  return buildCmsCalendarEntries(
    [
      ...pageRows.flatMap((row) =>
        row.scheduledAt
          ? [
              {
                id: `content:page:${row.id}`,
                kind: "content_schedule" as const,
                startsAt: row.scheduledAt,
                title: row.title,
                status: "scheduled",
                entityType: "page" as const,
                entityId: row.id,
                collection: null,
                locale: "",
              },
            ]
          : [],
      ),
      ...postRows.flatMap((row) =>
        row.scheduledAt
          ? [
              {
                id: `content:post:${row.id}`,
                kind: "content_schedule" as const,
                startsAt: row.scheduledAt,
                title: row.title,
                status: "scheduled",
                entityType: "post" as const,
                entityId: row.id,
                collection: null,
                locale: "",
              },
            ]
          : [],
      ),
      ...collectionRows.flatMap((row) =>
        row.scheduledAt &&
        row.collectionSlug !== REM_VIET_STANDARD_PAGES_COLLECTION
          ? [
              {
                id: `content:collection:${row.collectionSlug}:${row.id}:${row.locale}`,
                kind: "content_schedule" as const,
                startsAt: row.scheduledAt,
                title: collectionTitle(row),
                status: "scheduled",
                entityType: "collection" as const,
                entityId: row.id,
                collection: row.collectionSlug,
                locale: row.locale,
              },
            ]
          : [],
      ),
      ...releaseRows.flatMap((row) =>
        row.scheduledAt
          ? [
              {
                id: `release:${row.id}`,
                kind: "release_schedule" as const,
                startsAt: row.scheduledAt,
                title: row.name,
                status: row.status,
                entityType: "release" as const,
                entityId: row.id,
                collection: null,
                locale: "",
              },
            ]
          : [],
      ),
      ...reviewRows.flatMap((row) =>
        row.dueAt
          ? [
              {
                id: [
                  "review",
                  row.documentType,
                  row.collection ?? "",
                  row.documentId,
                  row.locale ?? "",
                ].join(":"),
                kind: "review_due" as const,
                startsAt: row.dueAt,
                title: row.title,
                status: "requested",
                entityType: row.documentType,
                entityId: row.documentId,
                collection: row.collection ?? null,
                locale: row.locale ?? "",
              },
            ]
          : [],
      ),
    ],
    parsed,
    runtimeNow(runtime),
  );
}
