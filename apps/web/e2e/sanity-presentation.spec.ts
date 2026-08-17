import { createClient } from "@sanity/client";
import { perspectiveCookieName } from "@sanity/preview-url-secret/constants";
import { expect, test, type Frame, type Page } from "@playwright/test";
import {
  defaultFaqBlock,
  defaultHeroBlock,
  encodeRemVietSanityPageContent,
} from "@agency/cms-template-rem-viet";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { sanityPreviewSignatureCookieName } from "../src/lib/sanity-preview-session";

const proofId = process.env.SANITY_PRESENTATION_PROOF_ID;
const enabled = Boolean(proofId);

test.describe("Sanity Presentation hosted proof", () => {
  test.skip(!enabled, "SANITY_PRESENTATION_PROOF_ID is not configured.");

  test("proves the authenticated visual-editing contract", async ({
    page,
    context,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chrome",
      "The receipt is bound to desktop-chrome.",
    );

    const scope = readScope(proofId!);
    const startedAt = new Date().toISOString();
    const publishedMarker = `Published FAQ ${scope.documentId}`;
    const draftMarker = `Draft FAQ ${scope.documentId}`;
    const updatedMarker = `Updated FAQ ${scope.documentId}`;
    const publishedId = `agency-presentation-${scope.documentId}`;
    const draftId = `drafts.${publishedId}`;
    const presentationUrl = scope.presentationUrlTemplate.replaceAll(
      "{id}",
      encodeURIComponent(scope.documentId),
    );
    const client = createClient({
      projectId: scope.projectId,
      dataset: scope.dataset,
      token: scope.token,
      apiVersion: "2026-07-01",
      perspective: "raw",
      useCdn: false,
    });
    const previewSecretIdsBefore = new Set(
      await presentationPreviewSecretIds(
        client,
        presentationUrl,
        scope.documentId,
      ),
    );

    try {
      const existing = await client.fetch<number>(`count(*[_id in $ids])`, {
        ids: [publishedId, draftId],
      });
      expect(existing, "Presentation proof IDs must be unused").toBe(0);

      await client
        .transaction()
        .create(
          proofDocument(
            publishedId,
            scope.documentId,
            publishedMarker,
            "presentation-proof-publisher",
          ),
        )
        .create(
          proofDocument(
            draftId,
            scope.documentId,
            draftMarker,
            "presentation-proof-editor",
          ),
        )
        .commit();

      await page.goto(presentationUrl, { waitUntil: "domcontentloaded" });
      expect(new URL(page.url()).origin).toBe(scope.studioOrigin);
      await expect(page).not.toHaveURL(/\/login(?:[/?#]|$)/i);

      const previewFrame = await waitForPreviewFrame(
        page,
        scope.previewOrigin,
        scope.documentId,
      );
      const draftText = previewFrame.getByText(draftMarker, { exact: false });
      await expect(draftText.first()).toBeVisible({ timeout: 45_000 });

      const previewCookies = await context.cookies(scope.previewOrigin);
      for (const name of [
        perspectiveCookieName,
        sanityPreviewSignatureCookieName,
      ]) {
        const cookie = previewCookies.find(
          (candidate) => candidate.name === name,
        );
        expect(cookie, `Missing secure preview cookie ${name}`).toBeDefined();
        expect(cookie?.httpOnly).toBe(true);
        expect(cookie?.secure).toBe(true);
        expect(cookie?.sameSite).toBe("None");
      }
      expect(
        await hasPartitionedPreviewCookies(
          page,
          new URL(scope.previewOrigin).hostname,
        ),
      ).toBe(true);

      await draftText.first().scrollIntoViewIfNeeded();
      await draftText.first().hover();
      const hoveredOverlay = previewFrame
        .locator("[data-hovered] [data-sanity-overlay-element]")
        .first();
      await expect(hoveredOverlay).toBeVisible({ timeout: 15_000 });
      await hoveredOverlay.click();
      await expect
        .poll(
          () =>
            page.evaluate((marker) => {
              const active = document.activeElement;
              if (
                active instanceof HTMLInputElement ||
                active instanceof HTMLTextAreaElement
              ) {
                return active.value === marker;
              }
              return active?.textContent?.trim() === marker;
            }, draftMarker),
          { timeout: 15_000 },
        )
        .toBe(true);

      let previewNavigations = 0;
      page.on("framenavigated", (frame) => {
        if (frame === previewFrame) previewNavigations += 1;
      });
      await client
        .patch(draftId)
        .set({
          'content.blocks[_key=="faq"].data.items[_key=="proof-question"].question':
            updatedMarker,
        })
        .inc({ version: 1 })
        .commit();
      await expect(
        previewFrame.getByText(updatedMarker, { exact: false }).first(),
      ).toBeVisible({ timeout: 30_000 });
      expect(previewNavigations).toBe(0);

      const publishedResult = await readPerspective(
        previewFrame,
        scope.documentId,
        "published",
      );
      expect(JSON.stringify(publishedResult)).toContain(publishedMarker);
      const draftResult = await readPerspective(
        previewFrame,
        scope.documentId,
        "drafts",
      );
      expect(JSON.stringify(draftResult)).toContain(updatedMarker);

      const frameElement = await previewFrame.frameElement();
      const desktopBox = await frameElement.boundingBox();
      expect(desktopBox).not.toBeNull();
      const mobileButton = page
        .getByRole("button", { name: /mobile/i })
        .or(page.locator('button[aria-label*="mobile" i]'))
        .first();
      await expect(mobileButton).toBeVisible({ timeout: 15_000 });
      await mobileButton.click();
      await expect
        .poll(async () => (await frameElement.boundingBox())?.width ?? Infinity)
        .toBeLessThan((desktopBox?.width ?? 0) - 100);

      await mkdir(dirname(scope.screenshotPath), { recursive: true });
      await page.screenshot({
        path: scope.screenshotPath,
        fullPage: true,
        animations: "disabled",
      });
      const observation = {
        schemaVersion: 1,
        status: "complete",
        projectId: scope.projectId,
        dataset: scope.dataset,
        documentId: scope.documentId,
        startedAt,
        completedAt: new Date().toISOString(),
        studioOrigin: scope.studioOrigin,
        previewOrigin: scope.previewOrigin,
        browserProject: "desktop-chrome",
        checks: {
          authenticatedStudio: true,
          previewSecretHandshake: true,
          secureIframeCookies: true,
          partitionedIframeCookies: true,
          embeddedPreview: true,
          stegaOverlay: true,
          clickToEdit: true,
          liveMutationNoReload: true,
          publishedPerspective: true,
          draftPerspective: true,
          responsiveViewport: true,
        },
      } as const;
      await mkdir(dirname(scope.observationPath), { recursive: true });
      await writeFile(
        scope.observationPath,
        `${JSON.stringify(observation, null, 2)}\n`,
        { encoding: "utf8", flag: "wx" },
      );
    } finally {
      const cleanupErrors: unknown[] = [];
      try {
        await cleanupDocuments(client, [draftId, publishedId]);
      } catch (error) {
        cleanupErrors.push(error);
      }
      try {
        const previewSecretIdsAfter = await presentationPreviewSecretIds(
          client,
          presentationUrl,
          scope.documentId,
        );
        await cleanupDocuments(
          client,
          previewSecretIdsAfter.filter((id) => !previewSecretIdsBefore.has(id)),
        );
      } catch (error) {
        cleanupErrors.push(error);
      }
      if (cleanupErrors.length > 0) {
        throw new AggregateError(
          cleanupErrors,
          "Sanity Presentation cleanup was incomplete.",
        );
      }
    }
  });
});

function readScope(documentId: string) {
  const projectId = requiredEnvironment("SANITY_PROJECT_ID");
  const dataset = requiredEnvironment("SANITY_DATASET");
  const token = requiredEnvironment("SANITY_API_TOKEN");
  const presentationUrlTemplate = requiredEnvironment(
    "SANITY_PRESENTATION_URL_TEMPLATE",
  );
  if (!presentationUrlTemplate.includes("{id}")) {
    throw new Error("SANITY_PRESENTATION_URL_TEMPLATE must include {id}.");
  }
  const studioOrigin = new URL(presentationUrlTemplate).origin;
  const previewOrigin = new URL(requiredEnvironment("SANITY_PREVIEW_URL"))
    .origin;
  if (new URL(studioOrigin).protocol !== "https:") {
    throw new Error("Sanity Presentation proof requires an HTTPS Studio.");
  }
  if (new URL(previewOrigin).protocol !== "https:") {
    throw new Error("Sanity Presentation proof requires an HTTPS preview.");
  }
  if (studioOrigin === previewOrigin) {
    throw new Error("Studio and preview origins must differ for CHIPS proof.");
  }
  return {
    projectId,
    dataset,
    token,
    documentId,
    presentationUrlTemplate,
    studioOrigin,
    previewOrigin,
    observationPath: requiredEnvironment(
      "SANITY_PRESENTATION_OBSERVATION_PATH",
    ),
    screenshotPath: requiredEnvironment("SANITY_PRESENTATION_SCREENSHOT_PATH"),
  };
}

function proofDocument(
  id: string,
  agencyId: string,
  question: string,
  updatedBy: string,
) {
  const faq = structuredClone(defaultFaqBlock);
  faq.data.items[0] = {
    id: "proof-question",
    question,
    answer: "Disposable Presentation receipt content.",
  };
  return {
    _id: id,
    _type: "agencyPage",
    agencyId,
    schemaVersion: 1,
    version: 1,
    updatedBy,
    content: encodeRemVietSanityPageContent({
      title: `Presentation proof ${agencyId}`,
      slug: `presentation-${agencyId}`,
      template: "landing",
      seo: {
        title: `Presentation proof ${agencyId}`,
        description: "Disposable browser-visible Sanity proof.",
        canonicalUrl: "https://preview.invalid/",
        ogImage: "/assets/rem-vina-hero.webp",
        robotsIndex: false,
        robotsFollow: false,
      },
      blocks: [structuredClone(defaultHeroBlock), faq],
    }),
  };
}

async function waitForPreviewFrame(
  page: Page,
  previewOrigin: string,
  documentId: string,
) {
  let found: Frame | undefined;
  await expect
    .poll(
      () => {
        found = page.frames().find((frame) => {
          try {
            const url = new URL(frame.url());
            return (
              url.origin === previewOrigin &&
              url.pathname === `/sanity-preview/${documentId}`
            );
          } catch {
            return false;
          }
        });
        return Boolean(found);
      },
      { timeout: 45_000 },
    )
    .toBe(true);
  return found!;
}

async function readPerspective(
  frame: Frame,
  documentId: string,
  perspective: "drafts" | "published",
) {
  return frame.evaluate(
    async ({ id, nextPerspective }) => {
      const changed = await fetch("/api/draft-mode/perspective", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          perspective: nextPerspective,
          partitioned: window.self !== window.top,
        }),
      });
      if (changed.status !== 200 && changed.status !== 204) {
        throw new Error(`Perspective switch failed (${changed.status}).`);
      }
      const response = await fetch(
        `/api/draft-mode/page/${encodeURIComponent(id)}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        throw new Error(`Perspective read failed (${response.status}).`);
      }
      return response.json();
    },
    { id: documentId, nextPerspective: perspective },
  );
}

async function hasPartitionedPreviewCookies(page: Page, hostname: string) {
  const session = await page.context().newCDPSession(page);
  const result = (await session.send("Network.getAllCookies")) as {
    cookies: Array<{
      name: string;
      domain: string;
      partitionKey?: unknown;
    }>;
  };
  return [perspectiveCookieName, sanityPreviewSignatureCookieName].every(
    (name) =>
      result.cookies.some(
        (cookie) =>
          cookie.name === name &&
          hostname.endsWith(cookie.domain.replace(/^\./, "")) &&
          Boolean(cookie.partitionKey),
      ),
  );
}

async function cleanupDocuments(
  client: ReturnType<typeof createClient>,
  ids: readonly string[],
) {
  if (ids.length === 0) return;
  const transaction = client.transaction();
  for (const id of ids) transaction.delete(id);
  await transaction.commit();
  const remaining = await client.fetch<number>(`count(*[_id in $ids])`, {
    ids,
  });
  if (remaining !== 0) throw new Error("Sanity Presentation cleanup failed.");
}

async function presentationPreviewSecretIds(
  client: ReturnType<typeof createClient>,
  presentationUrl: string,
  documentId: string,
) {
  const expectedOrigin = new URL(presentationUrl).origin;
  const records = await client.fetch<
    Array<{ _id: string; source?: string; studioUrl?: string }>
  >(
    `*[_type == "sanity.previewUrlSecret" && source == "sanity/presentation"]{_id, source, studioUrl}`,
  );
  return records
    .filter((record) =>
      isProofPresentationUrl(record.studioUrl, expectedOrigin, documentId),
    )
    .map((record) => record._id);
}

function isProofPresentationUrl(
  value: string | undefined,
  expectedOrigin: string,
  documentId: string,
) {
  if (!value) return false;
  try {
    const url = new URL(value);
    const route = decodeURIComponent(`${url.pathname}${url.search}${url.hash}`);
    return url.origin === expectedOrigin && route.includes(documentId);
  } catch {
    return false;
  }
}

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}
