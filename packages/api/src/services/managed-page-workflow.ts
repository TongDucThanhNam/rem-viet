import type { CmsActor } from "./content-revisions";
import {
  publishPage,
  restorePageRevision,
  unpublishPage,
} from "./content-revisions";
import {
  isRemVietHomePage,
  publishRemVietHomePage,
  restoreRemVietHomeRevision,
  unpublishRemVietHomePage,
} from "./home-page-runtime";
import {
  isRemVietStandardPage,
  publishRemVietStandardPage,
  restoreRemVietStandardPageRevision,
  unpublishRemVietStandardPage,
} from "./standard-page-runtime";
import { assertCmsWorkflowPublishAllowed } from "./workflow-policies";

export async function publishManagedPage(
  input: { pageId: string; expectedVersion?: number; note?: string },
  actor: CmsActor,
) {
  const expectedVersion =
    input.expectedVersion ??
    (
      await createDb().query.pages.findFirst({
        where: eq(pages.id, input.pageId),
      })
    )?.version;
  if (expectedVersion === undefined) throw new Error("Page not found");
  await assertCmsWorkflowPublishAllowed({
    documentType: "page",
    documentId: input.pageId,
    version: expectedVersion,
  });
  if (await isRemVietHomePage(input.pageId)) {
    return publishRemVietHomePage(input, actor);
  }
  return (await isRemVietStandardPage(input.pageId))
    ? publishRemVietStandardPage(input, actor)
    : publishPage(input, actor);
}

export async function unpublishManagedPage(
  input: { pageId: string; expectedVersion?: number },
  actor: CmsActor,
) {
  if (await isRemVietHomePage(input.pageId)) {
    return unpublishRemVietHomePage(input, actor);
  }
  return (await isRemVietStandardPage(input.pageId))
    ? unpublishRemVietStandardPage(input, actor)
    : unpublishPage(input, actor);
}

export async function restoreManagedPageRevision(
  input: {
    pageId: string;
    revisionId: string;
    expectedVersion?: number;
  },
  actor: CmsActor,
) {
  if (await isRemVietHomePage(input.pageId)) {
    return restoreRemVietHomeRevision(input, actor);
  }
  return (await isRemVietStandardPage(input.pageId))
    ? restoreRemVietStandardPageRevision(input, actor)
    : restorePageRevision(input, actor);
}
import { createDb } from "@rem-viet/db";
import { pages } from "@rem-viet/db/schema/content";
import { eq } from "drizzle-orm";
