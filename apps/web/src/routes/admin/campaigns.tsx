import {
  CmsCollectionAdminShell,
  useCmsPreviewConnection,
  type CmsCollectionFilterValue,
} from "@agency/cms-admin";
import { createCollectionRegistry } from "@agency/cms-core";
import {
  createCmsVisualEditorStateMessage,
  createCmsVisualPreviewSession,
  isCmsVisualEditorMessage,
} from "@agency/cms-visual-editor";
import {
  REM_VIET_LOCALIZED_CAMPAIGNS_COLLECTION,
  remVietLocalizedCampaignsCollection,
} from "@agency/cms-template-rem-viet";
import { Button } from "@rem-viet/ui/components/button";
import { Card, CardContent } from "@rem-viet/ui/components/card";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { ExternalLink, Languages, Send, Undo2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
} from "react";
import { toast } from "sonner";

import AdminShell from "@/components/admin-shell";
import { ConfirmDestructiveAction } from "@/components/admin-ui";
import {
  CmsPreviewConnectionIndicator,
  CmsPreviewConnectionLabel,
  CmsPreviewConnectionRecovery,
} from "@/components/cms-preview-connection";
import { getAdminUser } from "@/functions/get-admin-user";
import {
  createLocalizedCampaignPreviewBlock,
  unsavedLocalizedCampaignPreviewId,
  type LocalizedCampaignPreviewData,
} from "@/lib/localized-campaign-preview";
import { siteManifest } from "@/lib/site-config";
import { useTRPC } from "@/utils/trpc";

type CampaignLocale = "vi-VN" | "en-US";

const campaignRegistry = createCollectionRegistry([
  remVietLocalizedCampaignsCollection,
] as const);

export const Route = createFileRoute("/admin/campaigns")({
  validateSearch: (search: Record<string, unknown>) => ({
    locale: search.locale === "en-US" ? ("en-US" as const) : ("vi-VN" as const),
    ...(search.mode === "create" ? { mode: "create" as const } : {}),
    ...(typeof search.campaignId === "string" && search.campaignId
      ? { campaignId: search.campaignId }
      : {}),
  }),
  component: AdminCampaignsRoute,
  beforeLoad: async () => {
    const session = await getAdminUser();
    return { session };
  },
  loader: async ({ context }) => {
    if (!context.session) throw redirect({ to: "/dang-nhap" });
  },
});

function campaignData(value: unknown): LocalizedCampaignPreviewData {
  if (!value || typeof value !== "object") return { code: "", headline: "" };
  const record = value as Record<string, unknown>;
  return {
    code: typeof record.code === "string" ? record.code : "",
    headline: typeof record.headline === "string" ? record.headline : "",
  };
}

function campaignHref(input: {
  campaignId?: string;
  locale: CampaignLocale;
  mode?: "create";
}) {
  const search = new URLSearchParams({ locale: input.locale });
  if (input.campaignId) search.set("campaignId", input.campaignId);
  if (input.mode) search.set("mode", input.mode);
  return `/admin/campaigns?${search}`;
}

function campaignPreviewHref(id: string, locale: string) {
  return `/admin/campaigns/${encodeURIComponent(id)}/preview?${new URLSearchParams(
    { locale },
  )}`;
}

function LocalizedCampaignVisualPreview({
  campaignId,
  data,
  locale,
  onSelectField,
  previewChannel,
  selectedField,
  version,
}: {
  campaignId: string;
  data: LocalizedCampaignPreviewData;
  locale: CampaignLocale;
  onSelectField: (field: "code" | "headline") => void;
  previewChannel: Readonly<{
    conflictToken: string;
    sessionBinding: string;
    sessionId: string;
  }>;
  selectedField: "code" | "headline" | null;
  version: number;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const channelReadyRef = useRef(false);
  const previewSessionRef = useRef<{
    key: string;
    session: ReturnType<typeof createCmsVisualPreviewSession>;
  } | null>(null);
  const {
    markConnected,
    markFrameLoaded,
    markFrameLoading,
    reloadKey,
    retry,
    status,
  } = useCmsPreviewConnection();
  const previewUrl = `${campaignPreviewHref(campaignId, locale)}&${new URLSearchParams(
    {
      cmsBinding: previewChannel.sessionBinding,
      cmsConflict: previewChannel.conflictToken,
      cmsSession: previewChannel.sessionId,
    },
  )}`;
  const getPreviewSession = useCallback(() => {
    const key = [
      campaignId,
      locale,
      previewChannel.sessionId,
      previewChannel.sessionBinding,
      previewChannel.conflictToken,
      reloadKey,
    ].join(":");
    if (previewSessionRef.current?.key !== key) {
      previewSessionRef.current = {
        key,
        session: createCmsVisualPreviewSession({
          source: "host",
          expectedSource: "preview",
          identity: {
            siteId: siteManifest.id,
            documentId: campaignId,
            documentType: "localizedCampaign",
            sessionId: previewChannel.sessionId,
            sessionBinding: previewChannel.sessionBinding,
            documentVersion: 0,
            conflictToken: previewChannel.conflictToken,
          },
          allowedOrigins: new Set([window.location.origin]),
        }),
      };
    }
    return previewSessionRef.current.session;
  }, [
    campaignId,
    locale,
    previewChannel.conflictToken,
    previewChannel.sessionBinding,
    previewChannel.sessionId,
    reloadKey,
  ]);
  const sendWorkingCopy = useCallback(() => {
    if (!channelReadyRef.current || !frameRef.current?.contentWindow) return;
    const visualState = createCmsVisualEditorStateMessage({
      blocks: [createLocalizedCampaignPreviewBlock({ campaignId, data })],
      selectedBlockId: selectedField ? campaignId : null,
      selectedFieldPath: selectedField,
      selectionRevision: 0,
      revision: version,
    });
    const envelope = getPreviewSession().createVersionedState(
      { campaignId, locale, data, visualState },
      version,
    );
    if (envelope) {
      frameRef.current.contentWindow.postMessage(
        envelope,
        window.location.origin,
      );
    }
  }, [campaignId, data, getPreviewSession, locale, selectedField, version]);
  const runtimeRef = useRef({ onSelectField, sendWorkingCopy });
  runtimeRef.current = { onSelectField, sendWorkingCopy };

  useEffect(() => {
    channelReadyRef.current = false;
    markFrameLoading();
  }, [getPreviewSession, markFrameLoading]);
  useEffect(() => sendWorkingCopy(), [sendWorkingCopy]);
  useEffect(() => {
    const receivePreviewMessage = (event: MessageEvent<unknown>) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== frameRef.current?.contentWindow
      ) {
        return;
      }
      const validation = getPreviewSession().receive({
        value: event.data,
        origin: event.origin,
      });
      if (!validation.accepted) return;
      const payload = validation.envelope.payload;
      if (payload.type === "ready") {
        channelReadyRef.current = true;
        markConnected();
        runtimeRef.current.sendWorkingCopy();
        return;
      }
      if (payload.type === "ack") {
        runtimeRef.current.sendWorkingCopy();
        return;
      }
      if (
        payload.type !== "command" ||
        !isCmsVisualEditorMessage(payload.command) ||
        payload.command.type !== "select" ||
        payload.command.blockId !== campaignId ||
        (payload.command.fieldPath !== "code" &&
          payload.command.fieldPath !== "headline")
      ) {
        return;
      }
      runtimeRef.current.onSelectField(payload.command.fieldPath);
    };
    window.addEventListener("message", receivePreviewMessage);
    return () => window.removeEventListener("message", receivePreviewMessage);
  }, [campaignId, getPreviewSession, markConnected]);

  return (
    <Card
      className="overflow-hidden rounded-md"
      data-cms-preview-connection={status}
      id="localized-campaign-preview"
    >
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-zinc-950 px-3 py-2.5 text-white">
          <CmsPreviewConnectionIndicator
            connectedText="Secure preview v2 · chưa cần lưu"
            status={status}
            title={
              <h2 className="truncate text-xs font-semibold">
                Bản xem trước collection
              </h2>
            }
          />
          {campaignId !== unsavedLocalizedCampaignPreviewId ? (
            <a
              aria-label="Mở bản nháp chiến dịch trong tab riêng"
              className="grid size-8 place-items-center rounded text-zinc-400 hover:bg-white/10 hover:text-white"
              href={campaignPreviewHref(campaignId, locale)}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink aria-hidden className="size-4" />
            </a>
          ) : null}
        </div>
        <div className="relative min-h-[34rem] bg-zinc-100 p-3 sm:p-5">
          <CmsPreviewConnectionRecovery onRetry={retry} status={status} />
          <iframe
            className="h-[34rem] w-full border-0 bg-white shadow-sm"
            key={reloadKey}
            onLoad={() => {
              markFrameLoaded();
              sendWorkingCopy();
            }}
            ref={frameRef}
            src={previewUrl}
            title="Xem trước chiến dịch được bản địa hóa"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/40 px-3 py-2 text-[10px] text-muted-foreground">
          <span>
            {locale} · v{version}
          </span>
          <CmsPreviewConnectionLabel
            connectedLabel={<>Bản nháp riêng tư · trực tiếp</>}
            status={status}
            tone="light"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function AdminCampaignsRoute() {
  const { session } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const locale = search.locale;
  const mode = search.campaignId
    ? ("edit" as const)
    : search.mode === "create"
      ? ("create" as const)
      : ("list" as const);
  const [filter, setFilter] = useState<CmsCollectionFilterValue>({
    field: "headline",
    operator: "contains",
    value: "",
  });
  const [data, setData] = useState<LocalizedCampaignPreviewData>({
    code: "",
    headline: "",
  });
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [selectedField, setSelectedField] = useState<
    "code" | "headline" | null
  >(null);
  const listQuery = useQuery(
    trpc.content.campaigns.list.queryOptions({
      locale,
      ...(filter.value.trim()
        ? {
            filterField: filter.field as "code" | "headline",
            filterOperator: filter.operator,
            filterValue: filter.value,
          }
        : {}),
    }),
  );
  const campaignQuery = useQuery({
    ...trpc.content.campaigns.byId.queryOptions({
      id: search.campaignId ?? unsavedLocalizedCampaignPreviewId,
      locale,
    }),
    enabled: Boolean(search.campaignId),
  });
  const campaign = campaignQuery.data;
  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries(trpc.content.campaigns.list.queryFilter()),
      queryClient.invalidateQueries(trpc.content.campaigns.byId.queryFilter()),
    ]);
  };
  const createCampaign = useMutation(
    trpc.content.campaigns.create.mutationOptions(),
  );
  const saveCampaign = useMutation(
    trpc.content.campaigns.save.mutationOptions(),
  );
  const publishCampaign = useMutation(
    trpc.content.campaigns.publish.mutationOptions(),
  );
  const unpublishCampaign = useMutation(
    trpc.content.campaigns.unpublish.mutationOptions(),
  );
  const deleteCampaign = useMutation(
    trpc.content.campaigns.delete.mutationOptions(),
  );
  const saving = createCampaign.isPending || saveCampaign.isPending;
  const canPublish = session?.capabilities.includes("content.publish");
  const canDelete = session?.capabilities.includes("content.delete");

  useEffect(() => {
    if (campaign) setData(campaignData(campaign.data));
    if (mode === "create") setData({ code: "", headline: "" });
  }, [campaign, locale, mode]);

  const setRoute = (input: {
    campaignId?: string;
    locale: CampaignLocale;
    mode?: "create";
  }) =>
    navigate({
      search: {
        locale: input.locale,
        ...(input.campaignId ? { campaignId: input.campaignId } : {}),
        ...(input.mode ? { mode: input.mode } : {}),
      },
    });

  const selectField = useCallback((field: "code" | "headline") => {
    setSelectedField(field);
    requestAnimationFrame(() =>
      document
        .getElementById(
          `cms-${REM_VIET_LOCALIZED_CAMPAIGNS_COLLECTION}-${field}`,
        )
        ?.focus(),
    );
  }, []);

  const handleFocus = (event: FocusEvent<HTMLDivElement>) => {
    const name = (event.target as HTMLInputElement).name;
    if (name === "code" || name === "headline") setSelectedField(name);
  };

  const submit = async (value: Readonly<Record<string, unknown>>) => {
    try {
      const nextData = campaignData(value);
      if (campaign && search.campaignId) {
        const updated = await saveCampaign.mutateAsync({
          id: search.campaignId,
          locale,
          expectedVersion: campaign.version,
          data: nextData,
        });
        setData(campaignData(updated.data));
        toast.success("Đã lưu bản nháp chiến dịch.");
      } else {
        const created = await createCampaign.mutateAsync({
          locale,
          data: nextData,
        });
        toast.success("Đã tạo chiến dịch.");
        await setRoute({ campaignId: created.id, locale });
      }
      setErrors({});
      await invalidate();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không thể lưu chiến dịch.",
      );
    }
  };

  const publish = async () => {
    if (!campaign || !search.campaignId) return;
    try {
      await publishCampaign.mutateAsync({
        id: search.campaignId,
        locale,
        expectedVersion: campaign.version,
        note: "Publish from localized campaign editor",
      });
      toast.success("Đã xuất bản chiến dịch.");
      await invalidate();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không thể xuất bản.",
      );
    }
  };

  const unpublish = async () => {
    if (!campaign || !search.campaignId) return;
    try {
      await unpublishCampaign.mutateAsync({
        id: search.campaignId,
        locale,
        expectedVersion: campaign.version,
        note: "Unpublish from localized campaign editor",
      });
      toast.success("Đã gỡ xuất bản chiến dịch.");
      await invalidate();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không thể gỡ xuất bản.",
      );
    }
  };

  const remove = async () => {
    if (!campaign || !search.campaignId) return;
    await deleteCampaign.mutateAsync({
      id: search.campaignId,
      locale,
      expectedVersion: campaign.version,
      note: "Delete from localized campaign editor",
    });
    toast.success("Đã xóa chiến dịch.");
    await invalidate();
    await setRoute({ locale });
  };

  const campaignId = search.campaignId ?? unsavedLocalizedCampaignPreviewId;
  const actions =
    mode === "edit" && campaign ? (
      <>
        {canPublish ? (
          campaign.status === "published" ? (
            <Button
              disabled={unpublishCampaign.isPending}
              size="sm"
              type="button"
              variant="outline"
              onClick={() => void unpublish()}
            >
              <Undo2 aria-hidden />
              Gỡ xuất bản
            </Button>
          ) : (
            <Button
              disabled={publishCampaign.isPending}
              size="sm"
              type="button"
              onClick={() => void publish()}
            >
              <Send aria-hidden />
              Xuất bản
            </Button>
          )
        ) : null}
        {canDelete ? (
          <ConfirmDestructiveAction
            description="Xóa locale chiến dịch này và lịch sử bản nháp liên quan."
            pending={deleteCampaign.isPending}
            title={`Xóa ${data.headline || "chiến dịch"}?`}
            trigger={
              <Button size="sm" type="button" variant="destructive">
                Xóa
              </Button>
            }
            onConfirm={() => void remove()}
          />
        ) : null}
      </>
    ) : undefined;

  const documents = useMemo(
    () => listQuery.data?.documents ?? [],
    [listQuery.data?.documents],
  );

  if (mode === "edit" && campaignQuery.isLoading) {
    return (
      <AdminShell>
        <p aria-live="polite" className="text-sm text-muted-foreground">
          Đang tải bản nháp chiến dịch…
        </p>
      </AdminShell>
    );
  }

  if (mode === "edit" && !campaign) {
    return (
      <AdminShell>
        <div role="alert" className="grid gap-3 text-sm">
          <p>Không tìm thấy bản nháp chiến dịch cho locale {locale}.</p>
          <a className="text-primary underline" href={campaignHref({ locale })}>
            Quay lại danh sách
          </a>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell actions={actions}>
      <div className="grid gap-6" onFocusCapture={handleFocus}>
        {mode !== "list" ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Languages aria-hidden className="size-4" />
            <span>{locale}</span>
            {campaign ? (
              <span className="border px-2 py-1 font-medium text-foreground">
                {campaign.status} · v{campaign.version}
              </span>
            ) : (
              <span>Chưa lưu</span>
            )}
          </div>
        ) : null}
        <div
          className="grid min-w-0 gap-6 xl:grid-cols-[minmax(22rem,0.78fr)_minmax(32rem,1.22fr)] [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline [&_button]:min-h-9 [&_button]:rounded-md [&_button]:border [&_button]:px-3 [&_button]:text-sm [&_form]:grid [&_form]:gap-3 [&_header]:flex [&_header]:flex-wrap [&_header]:items-center [&_header]:justify-between [&_header]:gap-3 [&_input]:min-h-10 [&_input]:w-full [&_input]:rounded-md [&_input]:border [&_input]:bg-background [&_input]:px-3 [&_label]:text-sm [&_nav_ul]:flex [&_nav_ul]:list-none [&_nav_ul]:gap-2 [&_p]:text-xs [&_select]:min-h-10 [&_select]:rounded-md [&_select]:border [&_select]:bg-background [&_select]:px-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border-b [&_td]:p-3 [&_th]:border-b [&_th]:p-3 [&_th]:text-left"
          data-testid="localized-campaign-admin"
        >
          <section className="min-w-0 overflow-x-auto">
            <CmsCollectionAdminShell
              cancelHref={campaignHref({ locale })}
              collection={REM_VIET_LOCALIZED_CAMPAIGNS_COLLECTION}
              collectionHref={() => campaignHref({ locale })}
              createHref={campaignHref({ locale, mode: "create" })}
              data={data}
              documentId={search.campaignId}
              documents={documents}
              editHref={(id, documentLocale) =>
                campaignHref({
                  campaignId: id,
                  locale: (documentLocale as CampaignLocale) ?? locale,
                })
              }
              errors={errors}
              filter={filter}
              locale={locale}
              mode={mode}
              previewHref={(id, documentLocale) =>
                campaignPreviewHref(id, documentLocale ?? locale)
              }
              registry={campaignRegistry}
              saving={saving}
              total={listQuery.data?.total}
              onChange={(value) => setData(campaignData(value))}
              onFilterChange={setFilter}
              onLocaleChange={(nextLocale) =>
                void setRoute({
                  ...(search.campaignId
                    ? { campaignId: search.campaignId }
                    : mode === "create"
                      ? { mode: "create" as const }
                      : {}),
                  locale: nextLocale as CampaignLocale,
                })
              }
              onSubmit={submit}
              onValidationError={setErrors}
            />
          </section>
          {mode !== "list" ? (
            <LocalizedCampaignVisualPreview
              campaignId={campaignId}
              data={data}
              locale={locale}
              onSelectField={selectField}
              previewChannel={session!.previewChannel}
              selectedField={selectedField}
              version={campaign?.version ?? 0}
            />
          ) : null}
        </div>
      </div>
    </AdminShell>
  );
}
