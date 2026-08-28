import {
  createCmsVisualEditorSelectionMessage,
  createCmsVisualPreviewResponseHeaders,
  createCmsVisualPreviewSession,
  type CmsVisualEditorMessage,
  type CmsVisualEditorStateMessage,
} from "@agency/cms-visual-editor";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Languages, LockKeyhole } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { getPreviewAdminUser } from "@/functions/get-preview-admin-user";
import {
  isUnsavedLocalizedCampaignPreviewId,
  parseLocalizedCampaignPreviewState,
  type LocalizedCampaignPreviewBlock,
  type LocalizedCampaignPreviewData,
  type LocalizedCampaignPreviewState,
} from "@/lib/localized-campaign-preview";
import { siteConfig, siteManifest } from "@/lib/site-config";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/admin/campaigns_/$campaignId/preview")({
  validateSearch: (search: Record<string, unknown>) => ({
    locale: search.locale === "en-US" ? ("en-US" as const) : ("vi-VN" as const),
    ...(typeof search.cmsBinding === "string" && search.cmsBinding
      ? { cmsBinding: search.cmsBinding }
      : {}),
    ...(typeof search.cmsConflict === "string" && search.cmsConflict
      ? { cmsConflict: search.cmsConflict }
      : {}),
    ...(typeof search.cmsSession === "string" && search.cmsSession
      ? { cmsSession: search.cmsSession }
      : {}),
  }),
  headers: () =>
    createCmsVisualPreviewResponseHeaders({ frameAncestors: ["'self'"] }),
  beforeLoad: async ({ search }) => {
    const session = await getPreviewAdminUser();
    if (!session) throw redirect({ to: "/dang-nhap" });
    const hasChannel = Boolean(
      search.cmsBinding || search.cmsConflict || search.cmsSession,
    );
    if (
      hasChannel &&
      (!search.cmsBinding ||
        !search.cmsConflict ||
        !search.cmsSession ||
        search.cmsBinding !== session.previewSessionBinding)
    ) {
      throw redirect({
        to: "/admin/campaigns",
        search: { locale: search.locale },
      });
    }
    return { session };
  },
  loader: async ({ context }) => {
    if (!context.session) throw redirect({ to: "/dang-nhap" });
  },
  head: () => ({
    meta: [
      { title: `Xem trước chiến dịch — ${siteConfig.name} CMS` },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: LocalizedCampaignPreviewRoute,
});

function savedCampaignData(
  value: unknown,
): LocalizedCampaignPreviewData | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (typeof data.code !== "string" || typeof data.headline !== "string") {
    return null;
  }
  return { code: data.code, headline: data.headline };
}

function LocalizedCampaignPreviewRoute() {
  const { campaignId } = Route.useParams();
  const search = Route.useSearch();
  const trpc = useTRPC();
  const isUnsaved = isUnsavedLocalizedCampaignPreviewId(campaignId);
  const campaignQuery = useQuery({
    ...trpc.content.campaigns.byId.queryOptions({
      id: campaignId,
      locale: search.locale,
    }),
    enabled: !isUnsaved,
  });
  const [workingCopy, setWorkingCopy] =
    useState<LocalizedCampaignPreviewState | null>(null);
  const [visualState, setVisualState] =
    useState<CmsVisualEditorStateMessage<LocalizedCampaignPreviewBlock> | null>(
      null,
    );
  const previewSessionRef = useRef<ReturnType<
    typeof createCmsVisualPreviewSession
  > | null>(null);
  const channelActive = Boolean(
    search.cmsBinding && search.cmsConflict && search.cmsSession,
  );
  const getPreviewSession = useCallback(() => {
    if (!previewSessionRef.current) {
      previewSessionRef.current = createCmsVisualPreviewSession({
        source: "preview",
        expectedSource: "host",
        identity: {
          siteId: siteManifest.id,
          documentId: campaignId,
          documentType: "localizedCampaign",
          sessionId: search.cmsSession ?? "",
          sessionBinding: search.cmsBinding ?? "",
          documentVersion: 0,
          conflictToken: search.cmsConflict ?? "",
        },
        allowedOrigins: new Set([window.location.origin]),
      });
    }
    return previewSessionRef.current;
  }, [campaignId, search.cmsBinding, search.cmsConflict, search.cmsSession]);
  const postPreviewCommand = useCallback(
    (command: CmsVisualEditorMessage) => {
      if (!channelActive || window.parent === window) return;
      window.parent.postMessage(
        getPreviewSession().create({ type: "command", command }),
        window.location.origin,
      );
    },
    [channelActive, getPreviewSession],
  );

  useEffect(() => {
    const receiveWorkingCopy = (event: MessageEvent<unknown>) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== window.parent ||
        !channelActive
      ) {
        return;
      }
      const validation = getPreviewSession().receive({
        value: event.data,
        origin: event.origin,
      });
      if (
        !validation.accepted ||
        validation.envelope.payload.type !== "state"
      ) {
        return;
      }
      const state = parseLocalizedCampaignPreviewState(
        validation.envelope.payload.state,
        campaignId,
        search.locale,
      );
      if (!state) return;
      const session = getPreviewSession();
      if (
        session.snapshot().identity.documentVersion !==
        state.visualState.revision
      ) {
        window.parent.postMessage(
          session.acknowledgeDocumentVersion(
            validation.envelope.messageId,
            state.visualState.revision,
          ),
          window.location.origin,
        );
      }
      setWorkingCopy(state);
      setVisualState(state.visualState);
    };
    window.addEventListener("message", receiveWorkingCopy);
    if (channelActive && window.parent !== window) {
      window.parent.postMessage(
        getPreviewSession().create({ type: "ready" }),
        window.location.origin,
      );
    }
    return () => window.removeEventListener("message", receiveWorkingCopy);
  }, [campaignId, channelActive, getPreviewSession, search.locale]);

  const campaign = campaignQuery.data;
  const data = workingCopy?.data ?? savedCampaignData(campaign?.data);
  const selectedField = visualState?.selectedFieldPath ?? null;
  const selectField = (fieldPath: "code" | "headline") =>
    postPreviewCommand(
      createCmsVisualEditorSelectionMessage(campaignId, fieldPath),
    );

  if (!data && !isUnsaved && campaignQuery.isLoading) {
    return <main className="grid min-h-dvh place-items-center">Đang tải…</main>;
  }
  if (!data) {
    return (
      <main className="grid min-h-dvh place-items-center p-8 text-center">
        <div>
          <h1 className="text-xl font-semibold">Chưa có bản nháp</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Lưu chiến dịch trước khi mở bản xem trước độc lập.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-dvh bg-[#f4efe6] p-5 text-[#16130f] sm:p-10"
      data-testid="localized-campaign-rendered-preview"
    >
      <header className="mx-auto flex max-w-5xl items-center justify-between border-b border-black/15 pb-4 text-[11px] uppercase tracking-[0.18em]">
        <span className="inline-flex items-center gap-2">
          <Languages aria-hidden className="size-3.5" />
          {search.locale}
        </span>
        <span className="inline-flex items-center gap-2">
          <LockKeyhole aria-hidden className="size-3.5" />
          Bản nháp riêng tư
        </span>
      </header>
      <article
        className="mx-auto grid min-h-[70dvh] max-w-5xl content-center gap-8 py-12"
        data-cms-block-id={campaignId}
        data-cms-preview-block="true"
        data-cms-selected={visualState?.selectedBlockId === campaignId}
      >
        <button
          className="w-fit border-b border-black/30 pb-1 text-left text-xs font-semibold uppercase tracking-[0.2em] outline-none focus-visible:ring-2 focus-visible:ring-black"
          data-cms-preview-field="true"
          data-cms-field-path="code"
          data-cms-selected={selectedField === "code"}
          type="button"
          onClick={() => selectField("code")}
        >
          {data.code || "Mã chiến dịch"}
        </button>
        <button
          className="max-w-4xl text-left font-serif text-[clamp(3rem,10vw,8rem)] leading-[0.92] tracking-[-0.05em] outline-none focus-visible:ring-2 focus-visible:ring-black"
          data-cms-preview-field="true"
          data-cms-field-path="headline"
          data-cms-selected={selectedField === "headline"}
          type="button"
          onClick={() => selectField("headline")}
        >
          {data.headline || "Tiêu đề chiến dịch"}
        </button>
      </article>
    </main>
  );
}
