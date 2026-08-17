import {
  areCmsRevisionValuesEqual,
  CmsRevisionList,
  commitCmsDraftHistory,
  createCmsDraftHistory,
  redoCmsDraftHistory,
  undoCmsDraftHistory,
} from "@agency/cms-admin";
import {
  roleHasCapability,
  type HomepageSection,
  type MenuItem,
  type SiteSocials,
} from "@rem-viet/cms";
import { Button } from "@rem-viet/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@rem-viet/ui/components/card";
import { Input } from "@rem-viet/ui/components/input";
import { Label } from "@rem-viet/ui/components/label";
import { Skeleton } from "@rem-viet/ui/components/skeleton";
import { Textarea } from "@rem-viet/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  History,
  Monitor,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Smartphone,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import AdminShell from "@/components/admin-shell";
import { AsyncState, ConfirmDestructiveAction } from "@/components/admin-ui";
import MediaPickerField from "@/components/media-picker-field";
import { getAdminUser } from "@/functions/get-admin-user";
import { useSaveBeforeNavigation } from "@/hooks/use-save-before-navigation";
import {
  createGlobalSettingsPreviewMessage,
  globalSettingsPreviewReadyMessageType,
} from "@/lib/global-settings-preview";
import { getSiteChromeData, type SiteChromeData } from "@/lib/site-chrome";
import { siteConfig } from "@/lib/site-config";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettingsRoute,
  beforeLoad: async () => ({ session: await getAdminUser() }),
  loader: ({ context }) => {
    if (!context.session) throw redirect({ to: "/dang-nhap" });
    if (!roleHasCapability(context.session.staffRole, "settings.manage"))
      throw redirect({ to: "/admin/dashboard" });
  },
});

const defaultSocials: SiteSocials = {
  facebook: siteConfig.links.facebook,
  instagram: "",
  shopee: siteConfig.links.shopee,
  youtube: "",
  tiktok: "",
  zalo: siteConfig.links.zalo,
};
const primarySocialKeys = new Set(Object.keys(defaultSocials));
const defaultHomepageSections: HomepageSection[] = [
  { key: "hero", enabled: true, title: "Mở đầu" },
  { key: "benefits", enabled: true, title: "Lợi ích" },
  { key: "posts", enabled: true, title: "Bài viết" },
];
const defaultMenuItems: MenuItem[] = [
  { label: "Trang chủ", href: "/", order: 0 },
  { label: "Sản phẩm", href: "/danh-sach-san-pham", order: 1 },
  { label: "Bài viết", href: "/bai-viet", order: 2 },
];

type ExtraSocial = { id: string; key: string; url: string };

type SiteSettingsDraft = {
  logo: string;
  phone: string;
  address: string;
  socials: SiteSocials;
  extraSocials: ExtraSocial[];
  homepageSections: HomepageSection[];
};

type GlobalContentDraft = {
  settings: SiteSettingsDraft;
  headerMenu: MenuItem[];
  footerMenu: MenuItem[];
};

type InstalledGlobalVersions = {
  settings: number;
  headerMenu: number;
  footerMenu: number;
};

const socialLabels: Record<keyof SiteSocials, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  shopee: "Shopee",
  youtube: "YouTube",
  tiktok: "TikTok",
  zalo: "Zalo",
};

function itemId() {
  return crypto.randomUUID();
}

function moveItem<T>(items: T[], from: number, to: number) {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item === undefined) return items;
  next.splice(to, 0, item);
  return next;
}

function orderMenuItems(items: MenuItem[]) {
  return items.map((item, order) => ({
    ...item,
    order,
    children: item.children?.map((child, childOrder) => ({
      ...child,
      order: childOrder,
    })),
  }));
}

function emptyGlobalContentDraft(): GlobalContentDraft {
  return {
    settings: {
      logo: "",
      phone: "",
      address: "",
      socials: { ...defaultSocials },
      extraSocials: [],
      homepageSections: defaultHomepageSections.map((section) => ({
        ...section,
      })),
    },
    headerMenu: orderMenuItems(defaultMenuItems.map((item) => ({ ...item }))),
    footerMenu: orderMenuItems(defaultMenuItems.map((item) => ({ ...item }))),
  };
}

function primaryValue(value: string | undefined, fallback = "") {
  return value?.trim() || fallback;
}

function extrasFromSocials(
  socials: SiteSocials & Record<string, string>,
): ExtraSocial[] {
  return Object.entries(socials)
    .filter(([key, value]) => !primarySocialKeys.has(key) && value?.trim())
    .map(([key, url]) => ({ id: itemId(), key, url }));
}

function MenuEditor({
  idPrefix,
  items,
  label,
  onChange,
}: {
  idPrefix: string;
  items: MenuItem[];
  label: string;
  onChange: (items: MenuItem[], historyGroup?: string) => void;
}) {
  const update = (index: number, value: MenuItem, historyGroup: string) =>
    onChange(
      items.map((item, position) => (position === index ? value : item)),
      historyGroup,
    );

  return (
    <section className="grid gap-3 rounded-md border p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{label}</h3>
          <p className="text-xs text-muted-foreground">
            Nhập nhãn và đường dẫn trực tiếp trong từng trường.
          </p>
        </div>
        <Button
          size="sm"
          type="button"
          variant="outline"
          onClick={() =>
            onChange(
              [...items, { label: "Mục mới", href: "/", order: items.length }],
              `${idPrefix}:add`,
            )
          }
        >
          <Plus aria-hidden /> Thêm mục
        </Button>
      </div>
      {items.map((item, index) => (
        <article
          className="grid gap-3 rounded-md border bg-muted/20 p-3"
          key={index}
        >
          <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
            <div className="grid gap-2">
              <Label htmlFor={`${idPrefix}-label-${index}`}>Nhãn</Label>
              <Input
                id={`${idPrefix}-label-${index}`}
                required
                value={item.label}
                onChange={(event) =>
                  onChange(
                    items.map((entry, position) =>
                      position === index
                        ? { ...entry, label: event.target.value }
                        : entry,
                    ),
                    `${idPrefix}:${index}:label`,
                  )
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${idPrefix}-href-${index}`}>Đường dẫn</Label>
              <Input
                id={`${idPrefix}-href-${index}`}
                placeholder="/lien-he hoặc https://…"
                required
                value={item.href}
                onChange={(event) =>
                  onChange(
                    items.map((entry, position) =>
                      position === index
                        ? { ...entry, href: event.target.value }
                        : entry,
                    ),
                    `${idPrefix}:${index}:href`,
                  )
                }
              />
            </div>
            <div className="flex">
              <Button
                aria-label={`Đưa ${item.label} lên`}
                disabled={index === 0}
                size="icon-sm"
                type="button"
                variant="ghost"
                onClick={() =>
                  onChange(
                    moveItem(items, index, index - 1),
                    `${idPrefix}:move`,
                  )
                }
              >
                <ChevronUp aria-hidden />
              </Button>
              <Button
                aria-label={`Đưa ${item.label} xuống`}
                disabled={index === items.length - 1}
                size="icon-sm"
                type="button"
                variant="ghost"
                onClick={() =>
                  onChange(
                    moveItem(items, index, index + 1),
                    `${idPrefix}:move`,
                  )
                }
              >
                <ChevronDown aria-hidden />
              </Button>
              <Button
                aria-label={`Nhân bản ${item.label}`}
                size="icon-sm"
                type="button"
                variant="ghost"
                onClick={() => {
                  const next = [...items];
                  next.splice(index + 1, 0, {
                    ...item,
                    label: `${item.label} (bản sao)`,
                  });
                  onChange(next, `${idPrefix}:duplicate`);
                }}
              >
                <Copy aria-hidden />
              </Button>
              <Button
                aria-label={`Xóa ${item.label}`}
                size="icon-sm"
                type="button"
                variant="ghost"
                onClick={() =>
                  onChange(
                    items.filter((_, position) => position !== index),
                    `${idPrefix}:remove`,
                  )
                }
              >
                <Trash2 aria-hidden />
              </Button>
            </div>
          </div>
          <div className="grid gap-2 border-l-2 pl-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Menu con</span>
              <Button
                size="sm"
                type="button"
                variant="ghost"
                onClick={() =>
                  update(
                    index,
                    {
                      ...item,
                      children: [
                        ...(item.children ?? []),
                        {
                          label: "Mục con",
                          href: "/",
                          order: item.children?.length ?? 0,
                        },
                      ],
                    },
                    `${idPrefix}:${index}:child:add`,
                  )
                }
              >
                <Plus aria-hidden /> Thêm
              </Button>
            </div>
            {(item.children ?? []).map((child, childIndex) => (
              <div
                className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]"
                key={childIndex}
              >
                <Input
                  aria-label={`Nhãn mục con ${childIndex + 1} của ${item.label}`}
                  value={child.label}
                  onChange={(event) =>
                    update(
                      index,
                      {
                        ...item,
                        children: item.children?.map((entry, position) =>
                          position === childIndex
                            ? { ...entry, label: event.target.value }
                            : entry,
                        ),
                      },
                      `${idPrefix}:${index}:child:${childIndex}:label`,
                    )
                  }
                />
                <Input
                  aria-label={`Đường dẫn mục con ${childIndex + 1} của ${item.label}`}
                  value={child.href}
                  onChange={(event) =>
                    update(
                      index,
                      {
                        ...item,
                        children: item.children?.map((entry, position) =>
                          position === childIndex
                            ? { ...entry, href: event.target.value }
                            : entry,
                        ),
                      },
                      `${idPrefix}:${index}:child:${childIndex}:href`,
                    )
                  }
                />
                <Button
                  aria-label={`Xóa mục con ${child.label}`}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    update(
                      index,
                      {
                        ...item,
                        children: item.children?.filter(
                          (_, position) => position !== childIndex,
                        ),
                      },
                      `${idPrefix}:${index}:child:remove`,
                    )
                  }
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
            ))}
          </div>
        </article>
      ))}
      {!items.length ? (
        <p className="rounded-md border border-dashed p-5 text-center text-xs text-muted-foreground">
          Chưa có mục điều hướng.
        </p>
      ) : null}
    </section>
  );
}

type GlobalRevision<TContent> = {
  id: string;
  version: number;
  content: TContent;
  note: string;
  createdAt: string;
  createdBy: string;
};

function formatRevisionDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function GlobalRevisionHistory<TContent>({
  currentVersion,
  description,
  loading,
  onRestore,
  pending,
  renderSummary,
  revisions,
  testId,
  title,
}: {
  currentVersion?: number;
  description: string;
  loading: boolean;
  onRestore: (revisionId: string) => Promise<void>;
  pending: boolean;
  renderSummary: (content: TContent) => ReactNode;
  revisions: GlobalRevision<TContent>[];
  testId: string;
  title: string;
}) {
  return (
    <section
      className="grid content-start gap-3 rounded-md border p-4"
      data-testid={testId}
    >
      <div className="flex items-start gap-3">
        <History aria-hidden className="mt-0.5 size-4 shrink-0" />
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <CmsRevisionList
        empty={
          <p className="rounded-md border border-dashed p-4 text-xs text-muted-foreground">
            Chưa có phiên bản nào.
          </p>
        }
        loading={loading}
        loadingSlot={<Skeleton className="h-24 w-full" />}
        revisions={revisions}
        renderRevision={(revision) => {
          const isCurrent = revision.version === currentVersion;
          return (
            <article
              className="grid gap-2 rounded-md border bg-muted/20 p-3"
              data-testid={`${testId}-v${revision.version}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <strong className="text-sm">v{revision.version}</strong>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {formatRevisionDate(revision.createdAt)}
                  </span>
                </div>
                {isCurrent ? (
                  <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium">
                    Hiện tại
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {revision.note || "Không có ghi chú"} · {revision.createdBy}
              </p>
              <div className="text-xs">{renderSummary(revision.content)}</div>
              <ConfirmDestructiveAction
                confirmLabel="Khôi phục phiên bản"
                confirmVariant="default"
                description={`Phiên bản v${revision.version} sẽ thay thế khu vực cấu hình này và tạo một phiên bản mới. Thay đổi chưa lưu ở các khu vực khác vẫn được giữ nguyên.`}
                pending={pending}
                title={`Khôi phục phiên bản v${revision.version}?`}
                trigger={
                  <Button
                    className="justify-start"
                    disabled={isCurrent || pending || !currentVersion}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    <RotateCcw aria-hidden /> Khôi phục
                  </Button>
                }
                onConfirm={() => onRestore(revision.id)}
              />
            </article>
          );
        }}
      />
    </section>
  );
}

type GlobalSettingsPreviewProps = {
  chrome: SiteChromeData;
};

function GlobalSettingsPreview({ chrome }: GlobalSettingsPreviewProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [connected, setConnected] = useState(false);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [availableWidth, setAvailableWidth] = useState(0);
  const frameWidth = device === "desktop" ? 1280 : 390;
  const frameHeight = device === "desktop" ? 820 : 844;
  const scale = Math.min(1, Math.max(0.1, availableWidth / frameWidth));

  const sendWorkingCopy = useCallback(() => {
    frameRef.current?.contentWindow?.postMessage(
      createGlobalSettingsPreviewMessage(chrome),
      window.location.origin,
    );
  }, [chrome]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const measure = () => setAvailableWidth(viewport.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const receiveReady = (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== frameRef.current?.contentWindow ||
        !event.data ||
        typeof event.data !== "object" ||
        event.data.type !== globalSettingsPreviewReadyMessageType
      )
        return;

      setConnected(true);
      sendWorkingCopy();
    };

    window.addEventListener("message", receiveReady);
    return () => window.removeEventListener("message", receiveReady);
  }, [sendWorkingCopy]);

  useEffect(() => {
    if (connected) sendWorkingCopy();
  }, [connected, sendWorkingCopy]);

  useEffect(() => {
    if (connected) return;
    sendWorkingCopy();
    const retry = window.setInterval(sendWorkingCopy, 250);
    return () => window.clearInterval(retry);
  }, [connected, sendWorkingCopy]);

  return (
    <aside className="xl:sticky xl:top-4 xl:self-start">
      <Card className="overflow-hidden rounded-md border bg-background">
        <CardHeader className="gap-3 border-b">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>
                <h2>Canvas cấu hình trực tiếp</h2>
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Header và footer production cập nhật theo bản đang sửa.
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-md border p-1">
              <Button
                aria-pressed={device === "desktop"}
                size="icon-sm"
                title="Xem trước desktop"
                type="button"
                variant={device === "desktop" ? "secondary" : "ghost"}
                onClick={() => setDevice("desktop")}
              >
                <Monitor aria-hidden />
                <span className="sr-only">Xem trước desktop</span>
              </Button>
              <Button
                aria-pressed={device === "mobile"}
                size="icon-sm"
                title="Xem trước mobile"
                type="button"
                variant={device === "mobile" ? "secondary" : "ghost"}
                onClick={() => setDevice("mobile")}
              >
                <Smartphone aria-hidden />
                <span className="sr-only">Xem trước mobile</span>
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span
              aria-live="polite"
              data-testid="global-settings-preview-status"
            >
              {connected ? "Canvas đã kết nối" : "Đang kết nối canvas…"}
            </span>
            <span>
              {frameWidth} × {frameHeight} · {Math.round(scale * 100)}%
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-hidden bg-muted/40 p-3" ref={viewportRef}>
            <div
              className="mx-auto overflow-hidden rounded-lg border bg-background shadow-lg"
              style={{
                height: Math.max(1, frameHeight * scale),
                width: Math.max(1, frameWidth * scale),
              }}
            >
              <iframe
                className="block border-0 bg-background"
                data-testid="global-settings-preview-frame"
                ref={frameRef}
                src="/admin/settings-preview"
                style={{
                  height: frameHeight,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                  width: frameWidth,
                }}
                title="Xem trước trực tiếp cấu hình website"
                onLoad={() => setConnected(false)}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </aside>
  );
}

function AdminSettingsRoute() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const settingsQuery = useQuery(trpc.content.siteSettings.get.queryOptions());
  const menusQuery = useQuery(trpc.content.menus.list.queryOptions());
  const settingsRevisionsQuery = useQuery(
    trpc.content.siteSettings.revisions.queryOptions(),
  );
  const headerRevisionsQuery = useQuery(
    trpc.content.menus.revisions.queryOptions({ location: "header" }),
  );
  const footerRevisionsQuery = useQuery(
    trpc.content.menus.revisions.queryOptions({ location: "footer" }),
  );
  const [draftHistory, setDraftHistory] = useState(() =>
    createCmsDraftHistory(emptyGlobalContentDraft()),
  );
  const [baselineDraft, setBaselineDraft] = useState<GlobalContentDraft | null>(
    null,
  );
  const installedVersions = useRef<InstalledGlobalVersions | null>(null);
  const settingsSaving = useRef(false);
  const menuSaving = useRef(false);
  const [settingsSaveError, setSettingsSaveError] = useState<string | null>(
    null,
  );
  const [menuSaveError, setMenuSaveError] = useState<string | null>(null);
  const updateSettings = useMutation(
    trpc.content.siteSettings.update.mutationOptions(),
  );
  const updateMenu = useMutation(trpc.content.menus.update.mutationOptions());
  const restoreSettings = useMutation(
    trpc.content.siteSettings.restore.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries(
            trpc.content.siteSettings.get.queryFilter(),
          ),
          queryClient.invalidateQueries(
            trpc.content.siteSettings.revisions.queryFilter(),
          ),
        ]);
        toast.success("Đã khôi phục cài đặt và tạo một phiên bản mới.");
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const restoreMenu = useMutation(
    trpc.content.menus.restore.mutationOptions({
      onSuccess: async (_result, variables) => {
        await Promise.all([
          queryClient.invalidateQueries(trpc.content.menus.list.queryFilter()),
          queryClient.invalidateQueries(
            trpc.content.menus.revisions.queryFilter({
              location: variables.location,
            }),
          ),
        ]);
        toast.success("Đã khôi phục điều hướng và tạo một phiên bản mới.");
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const settingsDraftFromRow = useCallback(
    (settings: NonNullable<typeof settingsQuery.data>): SiteSettingsDraft => {
      const values = settings.socials ?? defaultSocials;
      return {
        logo: settings.logo ?? "",
        phone: settings.phone ?? "",
        address: settings.address ?? "",
        socials: {
          facebook: primaryValue(values.facebook, defaultSocials.facebook),
          instagram: primaryValue(values.instagram),
          shopee: primaryValue(values.shopee, defaultSocials.shopee),
          youtube: primaryValue(values.youtube),
          tiktok: primaryValue(values.tiktok),
          zalo: primaryValue(values.zalo, defaultSocials.zalo),
        },
        extraSocials: extrasFromSocials(values),
        homepageSections: (
          settings.homepageSections ?? defaultHomepageSections
        ).map((section) => ({ ...section })),
      };
    },
    [],
  );

  const dirty =
    baselineDraft !== null &&
    !areCmsRevisionValuesEqual(draftHistory.present, baselineDraft);
  const settingsDirty =
    baselineDraft !== null &&
    !areCmsRevisionValuesEqual(
      draftHistory.present.settings,
      baselineDraft.settings,
    );
  const menuDirty =
    baselineDraft !== null &&
    (!areCmsRevisionValuesEqual(
      draftHistory.present.headerMenu,
      baselineDraft.headerMenu,
    ) ||
      !areCmsRevisionValuesEqual(
        draftHistory.present.footerMenu,
        baselineDraft.footerMenu,
      ));

  const commitDraft = useCallback(
    (
      update:
        | GlobalContentDraft
        | ((current: GlobalContentDraft) => GlobalContentDraft),
      historyGroup?: string,
    ) => {
      setSettingsSaveError(null);
      setMenuSaveError(null);
      setDraftHistory((current) => {
        const next =
          typeof update === "function" ? update(current.present) : update;
        return areCmsRevisionValuesEqual(current.present, next)
          ? current
          : commitCmsDraftHistory(current, next, {
              group: historyGroup,
              limit: 50,
            });
      });
    },
    [],
  );

  const updateSettingsDraft = useCallback(
    (
      update:
        SiteSettingsDraft | ((current: SiteSettingsDraft) => SiteSettingsDraft),
      historyGroup?: string,
    ) => {
      commitDraft(
        (current) => ({
          ...current,
          settings:
            typeof update === "function" ? update(current.settings) : update,
        }),
        historyGroup,
      );
    },
    [commitDraft],
  );

  const updateMenuDraft = useCallback(
    (
      location: "header" | "footer",
      items: MenuItem[],
      historyGroup?: string,
    ) => {
      commitDraft(
        (current) => ({
          ...current,
          [location === "header" ? "headerMenu" : "footerMenu"]:
            orderMenuItems(items),
        }),
        historyGroup,
      );
    },
    [commitDraft],
  );

  useEffect(() => {
    const settings = settingsQuery.data;
    if (!settings || !menusQuery.isFetched) return;
    const menus = menusQuery.data ?? [];
    const header = menus.find((menu) => menu.location === "header");
    const footer = menus.find((menu) => menu.location === "footer");
    const serverVersions: InstalledGlobalVersions = {
      settings: settings.version,
      headerMenu: header?.version ?? 0,
      footerMenu: footer?.version ?? 0,
    };
    const installed = installedVersions.current;
    const hasNewerServerValue =
      installed === null ||
      serverVersions.settings > installed.settings ||
      serverVersions.headerMenu > installed.headerMenu ||
      serverVersions.footerMenu > installed.footerMenu;
    if (!hasNewerServerValue) return;
    if (installed !== null && dirty) {
      const message =
        "Cấu hình trên máy chủ đã thay đổi trong khi màn hình này còn dữ liệu chưa lưu. Hãy hoàn tác hoặc tải lại trước khi tiếp tục.";
      setSettingsSaveError(message);
      setMenuSaveError(message);
      return;
    }
    const next: GlobalContentDraft = {
      settings: settingsDraftFromRow(settings),
      headerMenu: orderMenuItems(
        header?.items ?? defaultMenuItems.map((item) => ({ ...item })),
      ),
      footerMenu: orderMenuItems(
        footer?.items ?? defaultMenuItems.map((item) => ({ ...item })),
      ),
    };
    installedVersions.current = serverVersions;
    setDraftHistory(createCmsDraftHistory(next));
    setBaselineDraft(next);
    setSettingsSaveError(null);
    setMenuSaveError(null);
  }, [
    dirty,
    menusQuery.data,
    menusQuery.isFetched,
    settingsDraftFromRow,
    settingsQuery.data,
  ]);

  const saveSettingsDraft = useCallback(
    async (announce: boolean) => {
      if (settingsSaving.current) return null;
      const versions = installedVersions.current;
      if (!versions) return null;
      const submitted = draftHistory.present.settings;
      settingsSaving.current = true;
      setSettingsSaveError(null);
      try {
        const result = await updateSettings.mutateAsync({
          logo: submitted.logo,
          phone: submitted.phone,
          address: submitted.address,
          socials: {
            ...Object.fromEntries(
              submitted.extraSocials
                .map((item) => [item.key.trim(), item.url.trim()] as const)
                .filter(([key, url]) => key && url),
            ),
            ...submitted.socials,
          },
          homepageSections: submitted.homepageSections.map((section) => ({
            ...section,
          })),
          expectedVersion: versions.settings,
        });
        if (!result.data)
          throw new Error("Không tải lại được cấu hình đã lưu.");
        installedVersions.current = {
          ...versions,
          settings: result.data.version,
        };
        setBaselineDraft((current) =>
          current ? { ...current, settings: submitted } : current,
        );
        await Promise.all([
          queryClient.invalidateQueries(
            trpc.content.siteSettings.get.queryFilter(),
          ),
          queryClient.invalidateQueries(
            trpc.content.siteSettings.revisions.queryFilter(),
          ),
        ]);
        if (announce) toast.success("Đã lưu cài đặt website.");
        return result.data;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Không thể lưu cài đặt website.";
        setSettingsSaveError(message);
        toast.error(message);
        return null;
      } finally {
        settingsSaving.current = false;
      }
    },
    [draftHistory.present.settings, queryClient, trpc, updateSettings],
  );

  const saveMenuDraft = useCallback(
    async (announce: boolean, changedOnly = false) => {
      if (menuSaving.current) return null;
      const versions = installedVersions.current;
      if (!versions || !baselineDraft) return null;
      const submittedHeader = orderMenuItems(draftHistory.present.headerMenu);
      const submittedFooter = orderMenuItems(draftHistory.present.footerMenu);
      const saveHeader =
        !changedOnly ||
        !areCmsRevisionValuesEqual(submittedHeader, baselineDraft.headerMenu);
      const saveFooter =
        !changedOnly ||
        !areCmsRevisionValuesEqual(submittedFooter, baselineDraft.footerMenu);
      if (!saveHeader && !saveFooter) return true;
      menuSaving.current = true;
      setMenuSaveError(null);
      try {
        if (saveHeader) {
          const result = await updateMenu.mutateAsync({
            location: "header",
            title: "Header menu",
            items: submittedHeader,
            expectedVersion: installedVersions.current?.headerMenu || undefined,
          });
          if (!result.data)
            throw new Error("Không tải lại được menu đầu trang đã lưu.");
          installedVersions.current = {
            ...(installedVersions.current ?? versions),
            headerMenu: result.data.version,
          };
          setBaselineDraft((current) =>
            current ? { ...current, headerMenu: submittedHeader } : current,
          );
          await queryClient.invalidateQueries(
            trpc.content.menus.revisions.queryFilter({ location: "header" }),
          );
        }
        if (saveFooter) {
          const result = await updateMenu.mutateAsync({
            location: "footer",
            title: "Footer menu",
            items: submittedFooter,
            expectedVersion: installedVersions.current?.footerMenu || undefined,
          });
          if (!result.data)
            throw new Error("Không tải lại được menu cuối trang đã lưu.");
          installedVersions.current = {
            ...(installedVersions.current ?? versions),
            footerMenu: result.data.version,
          };
          setBaselineDraft((current) =>
            current ? { ...current, footerMenu: submittedFooter } : current,
          );
          await queryClient.invalidateQueries(
            trpc.content.menus.revisions.queryFilter({ location: "footer" }),
          );
        }
        await queryClient.invalidateQueries(
          trpc.content.menus.list.queryFilter(),
        );
        if (announce) toast.success("Đã lưu điều hướng.");
        return true;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Không thể lưu điều hướng.";
        setMenuSaveError(message);
        toast.error(message);
        return null;
      } finally {
        menuSaving.current = false;
      }
    },
    [
      baselineDraft,
      draftHistory.present.footerMenu,
      draftHistory.present.headerMenu,
      queryClient,
      trpc,
      updateMenu,
    ],
  );

  const saveAllDirty = useCallback(async () => {
    if (settingsDirty && !(await saveSettingsDraft(false))) return null;
    if (menuDirty && !(await saveMenuDraft(false, true))) return null;
    return true;
  }, [menuDirty, saveMenuDraft, saveSettingsDraft, settingsDirty]);

  useSaveBeforeNavigation({
    dirty,
    saving: updateSettings.isPending || updateMenu.isPending,
    save: saveAllDirty,
  });

  const canUndoDraft = draftHistory.past.length > 0;
  const canRedoDraft = draftHistory.future.length > 0;
  const navigateDraftHistory = useCallback((direction: "undo" | "redo") => {
    setSettingsSaveError(null);
    setMenuSaveError(null);
    setDraftHistory((current) =>
      direction === "undo"
        ? undoCmsDraftHistory(current)
        : redoCmsDraftHistory(current),
    );
  }, []);

  useEffect(() => {
    const handleHistoryShortcut = (event: KeyboardEvent) => {
      if ((!event.ctrlKey && !event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      const undo = key === "z" && !event.shiftKey;
      const redo = key === "y" || (key === "z" && event.shiftKey);
      if (!undo && !redo) return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest('input, textarea, [contenteditable="true"]')
      )
        return;
      if ((undo && !canUndoDraft) || (redo && !canRedoDraft)) return;
      event.preventDefault();
      navigateDraftHistory(undo ? "undo" : "redo");
    };
    window.addEventListener("keydown", handleHistoryShortcut);
    return () => window.removeEventListener("keydown", handleHistoryShortcut);
  }, [canRedoDraft, canUndoDraft, navigateDraftHistory]);

  const installRestoredSettings = useCallback(
    (row: NonNullable<typeof settingsQuery.data>) => {
      const nextSettings = settingsDraftFromRow(row);
      installedVersions.current = {
        ...(installedVersions.current ?? {
          settings: 0,
          headerMenu: 0,
          footerMenu: 0,
        }),
        settings: row.version,
      };
      setDraftHistory((current) =>
        createCmsDraftHistory({
          ...current.present,
          settings: nextSettings,
        }),
      );
      setBaselineDraft((current) => ({
        ...(current ?? draftHistory.present),
        settings: nextSettings,
      }));
      setSettingsSaveError(null);
    },
    [draftHistory.present, settingsDraftFromRow],
  );

  const installRestoredMenu = useCallback(
    (
      location: "header" | "footer",
      row: { items: MenuItem[]; version: number },
    ) => {
      const key = location === "header" ? "headerMenu" : "footerMenu";
      const nextItems = orderMenuItems(row.items);
      installedVersions.current = {
        ...(installedVersions.current ?? {
          settings: 0,
          headerMenu: 0,
          footerMenu: 0,
        }),
        [key]: row.version,
      };
      setDraftHistory((current) =>
        createCmsDraftHistory({
          ...current.present,
          [key]: nextItems,
        }),
      );
      setBaselineDraft((current) => ({
        ...(current ?? draftHistory.present),
        [key]: nextItems,
      }));
      setMenuSaveError(null);
    },
    [draftHistory.present],
  );

  function submitSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void saveSettingsDraft(true);
  }

  function submitMenus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void saveMenuDraft(true);
  }

  const { settings, headerMenu, footerMenu } = draftHistory.present;
  const { logo, phone, address, socials, extraSocials, homepageSections } =
    settings;

  const updateSocial = (key: keyof SiteSocials, value: string) =>
    updateSettingsDraft(
      (current) => ({
        ...current,
        socials: { ...current.socials, [key]: value },
      }),
      `settings:social:${key}`,
    );

  const previewChrome = useMemo(
    () =>
      getSiteChromeData(
        {
          address,
          homepageSections,
          logo,
          phone,
          socials: {
            ...Object.fromEntries(
              extraSocials
                .map((item) => [item.key.trim(), item.url.trim()] as const)
                .filter(([key, url]) => key && url),
            ),
            ...socials,
          },
        },
        [
          { items: headerMenu, location: "header" },
          { items: footerMenu, location: "footer" },
        ],
      ),
    [
      address,
      extraSocials,
      footerMenu,
      headerMenu,
      homepageSections,
      logo,
      phone,
      socials,
    ],
  );

  return (
    <AdminShell>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(32rem,0.9fr)]">
        <section
          aria-label="Khôi phục thay đổi cấu hình"
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-background p-4 xl:col-span-2"
        >
          <div>
            <h2 className="text-sm font-semibold">Bản làm việc cấu hình</h2>
            <p
              aria-live="polite"
              className="text-xs text-muted-foreground"
              data-testid="global-settings-draft-status"
            >
              {baselineDraft === null
                ? "Đang tải bản làm việc…"
                : updateSettings.isPending || updateMenu.isPending
                  ? "Đang lưu thay đổi…"
                  : dirty
                    ? `Chưa lưu: ${[
                        settingsDirty ? "thông tin website" : null,
                        menuDirty ? "điều hướng" : null,
                      ]
                        .filter(Boolean)
                        .join(", ")}.`
                    : "Đã đồng bộ với máy chủ."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              aria-label="Hoàn tác thay đổi cấu hình"
              disabled={!canUndoDraft}
              size="sm"
              title="Hoàn tác (Ctrl+Z)"
              type="button"
              variant="outline"
              onClick={() => navigateDraftHistory("undo")}
            >
              <Undo2 aria-hidden /> Hoàn tác
            </Button>
            <Button
              aria-label="Làm lại thay đổi cấu hình"
              disabled={!canRedoDraft}
              size="sm"
              title="Làm lại (Ctrl+Shift+Z)"
              type="button"
              variant="outline"
              onClick={() => navigateDraftHistory("redo")}
            >
              <Redo2 aria-hidden /> Làm lại
            </Button>
          </div>
        </section>
        <div className="grid min-w-0 gap-4">
          <form onSubmit={submitSettings}>
            <Card className="rounded-md border bg-background">
              <CardHeader>
                <CardTitle>
                  <h2>Thông tin website</h2>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-5">
                {settingsQuery.isLoading ? (
                  <div
                    aria-label="Đang tải cài đặt website"
                    className="grid gap-3"
                  >
                    {Array.from({ length: 6 }).map((_, index) => (
                      <Skeleton className="h-12 w-full" key={index} />
                    ))}
                  </div>
                ) : settingsQuery.isError ? (
                  <AsyncState
                    action={
                      <Button
                        size="sm"
                        type="button"
                        variant="outline"
                        onClick={() => settingsQuery.refetch()}
                      >
                        Thử lại
                      </Button>
                    }
                    description={settingsQuery.error.message}
                    title="Không thể tải cài đặt website"
                    tone="error"
                  />
                ) : (
                  <>
                    <MediaPickerField
                      helpText="Logo này được dùng ở đầu trang của website công khai."
                      id="site-logo"
                      label="Logo"
                      value={logo}
                      onChange={(value) =>
                        updateSettingsDraft(
                          (current) => ({ ...current, logo: value }),
                          "settings:logo",
                        )
                      }
                    />
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="grid gap-2">
                        <Label htmlFor="site-phone">Điện thoại</Label>
                        <Input
                          id="site-phone"
                          value={phone}
                          onChange={(event) =>
                            updateSettingsDraft(
                              (current) => ({
                                ...current,
                                phone: event.target.value,
                              }),
                              "settings:phone",
                            )
                          }
                        />
                      </div>
                      <div className="grid gap-2 md:col-span-2">
                        <Label htmlFor="site-address">Địa chỉ</Label>
                        <Textarea
                          className="min-h-20"
                          id="site-address"
                          value={address}
                          onChange={(event) =>
                            updateSettingsDraft(
                              (current) => ({
                                ...current,
                                address: event.target.value,
                              }),
                              "settings:address",
                            )
                          }
                        />
                      </div>
                    </div>
                    <section className="grid gap-4 rounded-md border p-4">
                      <div>
                        <h3 className="text-sm font-semibold">
                          Mạng xã hội và kênh bán hàng
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Chỉ lưu liên kết nội bộ, http(s), mailto hoặc tel hợp
                          lệ.
                        </p>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        {(
                          Object.keys(defaultSocials) as Array<
                            keyof SiteSocials
                          >
                        ).map((key) => (
                          <div className="grid gap-2" key={key}>
                            <Label htmlFor={`social-${key}`}>
                              {socialLabels[key]}
                            </Label>
                            <Input
                              id={`social-${key}`}
                              placeholder="https://…"
                              value={socials[key] ?? ""}
                              onChange={(event) =>
                                updateSocial(key, event.target.value)
                              }
                            />
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="text-xs font-semibold uppercase tracking-wide">
                          Kênh bổ sung
                        </h4>
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() =>
                            updateSettingsDraft(
                              (current) => ({
                                ...current,
                                extraSocials: [
                                  ...current.extraSocials,
                                  { id: itemId(), key: "", url: "" },
                                ],
                              }),
                              "settings:extra-social:add",
                            )
                          }
                        >
                          <Plus aria-hidden /> Thêm kênh
                        </Button>
                      </div>
                      {extraSocials.map((item, index) => (
                        <div
                          className="grid gap-2 sm:grid-cols-[1fr_1.5fr_auto]"
                          key={item.id}
                        >
                          <Input
                            aria-label={`Tên kênh bổ sung ${index + 1}`}
                            placeholder="linkedin"
                            value={item.key}
                            onChange={(event) =>
                              updateSettingsDraft(
                                (current) => ({
                                  ...current,
                                  extraSocials: current.extraSocials.map(
                                    (entry) =>
                                      entry.id === item.id
                                        ? { ...entry, key: event.target.value }
                                        : entry,
                                  ),
                                }),
                                `settings:extra-social:${item.id}:key`,
                              )
                            }
                          />
                          <Input
                            aria-label={`URL kênh bổ sung ${index + 1}`}
                            placeholder="https://…"
                            value={item.url}
                            onChange={(event) =>
                              updateSettingsDraft(
                                (current) => ({
                                  ...current,
                                  extraSocials: current.extraSocials.map(
                                    (entry) =>
                                      entry.id === item.id
                                        ? { ...entry, url: event.target.value }
                                        : entry,
                                  ),
                                }),
                                `settings:extra-social:${item.id}:url`,
                              )
                            }
                          />
                          <Button
                            aria-label={`Xóa kênh bổ sung ${index + 1}`}
                            size="icon-sm"
                            type="button"
                            variant="ghost"
                            onClick={() =>
                              updateSettingsDraft(
                                (current) => ({
                                  ...current,
                                  extraSocials: current.extraSocials.filter(
                                    (entry) => entry.id !== item.id,
                                  ),
                                }),
                                "settings:extra-social:remove",
                              )
                            }
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        </div>
                      ))}
                    </section>
                    <section className="grid gap-3 rounded-md border p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold">
                            Cờ tương thích cho trang chủ
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            Chỉ dùng cho giao diện cũ; trang chủ hiện tại có
                            trình chỉnh sửa nội dung riêng.
                          </p>
                        </div>
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() =>
                            updateSettingsDraft(
                              (current) => ({
                                ...current,
                                homepageSections: [
                                  ...current.homepageSections,
                                  {
                                    key: `section-${current.homepageSections.length + 1}`,
                                    enabled: true,
                                    title: "Khu vực mới",
                                  },
                                ],
                              }),
                              "settings:homepage-section:add",
                            )
                          }
                        >
                          <Plus aria-hidden /> Thêm
                        </Button>
                      </div>
                      {homepageSections.map((section, index) => (
                        <div
                          className="grid gap-2 sm:grid-cols-[auto_1fr_1fr_auto] sm:items-center"
                          key={`${section.key}-${index}`}
                        >
                          <input
                            aria-label={`Bật khu vực ${section.key}`}
                            checked={section.enabled}
                            type="checkbox"
                            onChange={(event) =>
                              updateSettingsDraft(
                                (current) => ({
                                  ...current,
                                  homepageSections:
                                    current.homepageSections.map(
                                      (item, position) =>
                                        position === index
                                          ? {
                                              ...item,
                                              enabled: event.target.checked,
                                            }
                                          : item,
                                    ),
                                }),
                                `settings:homepage-section:${index}:enabled`,
                              )
                            }
                          />
                          <Input
                            aria-label={`Mã khu vực ${index + 1}`}
                            value={section.key}
                            onChange={(event) =>
                              updateSettingsDraft(
                                (current) => ({
                                  ...current,
                                  homepageSections:
                                    current.homepageSections.map(
                                      (item, position) =>
                                        position === index
                                          ? { ...item, key: event.target.value }
                                          : item,
                                    ),
                                }),
                                `settings:homepage-section:${index}:key`,
                              )
                            }
                          />
                          <Input
                            aria-label={`Tiêu đề khu vực ${index + 1}`}
                            value={section.title ?? ""}
                            onChange={(event) =>
                              updateSettingsDraft(
                                (current) => ({
                                  ...current,
                                  homepageSections:
                                    current.homepageSections.map(
                                      (item, position) =>
                                        position === index
                                          ? {
                                              ...item,
                                              title: event.target.value,
                                            }
                                          : item,
                                    ),
                                }),
                                `settings:homepage-section:${index}:title`,
                              )
                            }
                          />
                          <Button
                            aria-label={`Xóa khu vực ${section.key}`}
                            size="icon-sm"
                            type="button"
                            variant="ghost"
                            onClick={() =>
                              updateSettingsDraft(
                                (current) => ({
                                  ...current,
                                  homepageSections:
                                    current.homepageSections.filter(
                                      (_, position) => position !== index,
                                    ),
                                }),
                                "settings:homepage-section:remove",
                              )
                            }
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        </div>
                      ))}
                    </section>
                    {settingsSaveError ? (
                      <p className="text-sm text-destructive" role="alert">
                        {settingsSaveError}
                      </p>
                    ) : null}
                    <Button disabled={updateSettings.isPending} type="submit">
                      <Save aria-hidden />
                      {updateSettings.isPending
                        ? "Đang lưu…"
                        : "Lưu cài đặt website"}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </form>

          <form onSubmit={submitMenus}>
            <Card className="rounded-md border bg-background">
              <CardHeader>
                <CardTitle>
                  <h2>Điều hướng website</h2>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-5">
                {menusQuery.isLoading ? (
                  <div
                    aria-label="Đang tải cấu hình điều hướng"
                    className="grid gap-3"
                  >
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Skeleton className="h-12 w-full" key={index} />
                    ))}
                  </div>
                ) : menusQuery.isError ? (
                  <AsyncState
                    action={
                      <Button
                        size="sm"
                        type="button"
                        variant="outline"
                        onClick={() => menusQuery.refetch()}
                      >
                        Thử lại
                      </Button>
                    }
                    description={menusQuery.error.message}
                    title="Không thể tải cấu hình điều hướng"
                    tone="error"
                  />
                ) : (
                  <>
                    <MenuEditor
                      idPrefix="header-menu"
                      items={headerMenu}
                      label="Menu đầu trang"
                      onChange={(items, historyGroup) =>
                        updateMenuDraft("header", items, historyGroup)
                      }
                    />
                    <MenuEditor
                      idPrefix="footer-menu"
                      items={footerMenu}
                      label="Menu cuối trang"
                      onChange={(items, historyGroup) =>
                        updateMenuDraft("footer", items, historyGroup)
                      }
                    />
                    {menuSaveError ? (
                      <p className="text-sm text-destructive" role="alert">
                        {menuSaveError}
                      </p>
                    ) : null}
                    <Button disabled={updateMenu.isPending} type="submit">
                      <Save aria-hidden />
                      {updateMenu.isPending ? "Đang lưu…" : "Lưu điều hướng"}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </form>

          <Card className="rounded-md border bg-background">
            <CardHeader>
              <CardTitle>
                <h2>Lịch sử cấu hình</h2>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Mỗi lần lưu hoặc khôi phục đều tạo một phiên bản bất biến. Khôi
                phục không xóa lịch sử cũ.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-3">
              <GlobalRevisionHistory
                currentVersion={settingsQuery.data?.version}
                description="Logo, liên hệ, mạng xã hội và cờ tương thích."
                loading={settingsRevisionsQuery.isLoading}
                pending={restoreSettings.isPending}
                revisions={settingsRevisionsQuery.data ?? []}
                testId="site-settings-revision-history"
                title="Thông tin website"
                renderSummary={(content) => (
                  <span>
                    {content.phone || "Chưa có số điện thoại"} ·{" "}
                    {content.address || "Chưa có địa chỉ"}
                  </span>
                )}
                onRestore={async (revisionId) => {
                  const expectedVersion = installedVersions.current?.settings;
                  if (!expectedVersion) return;
                  const result = await restoreSettings.mutateAsync({
                    revisionId,
                    expectedVersion,
                  });
                  if (result.data) installRestoredSettings(result.data);
                }}
              />
              <GlobalRevisionHistory
                currentVersion={
                  menusQuery.data?.find((menu) => menu.location === "header")
                    ?.version
                }
                description="Các liên kết hiển thị ở đầu trang."
                loading={headerRevisionsQuery.isLoading}
                pending={restoreMenu.isPending}
                revisions={headerRevisionsQuery.data ?? []}
                testId="header-menu-revision-history"
                title="Menu đầu trang"
                renderSummary={(content) => (
                  <span>{content.items.length} mục điều hướng</span>
                )}
                onRestore={async (revisionId) => {
                  const expectedVersion = installedVersions.current?.headerMenu;
                  if (!expectedVersion) return;
                  const result = await restoreMenu.mutateAsync({
                    location: "header",
                    revisionId,
                    expectedVersion,
                  });
                  if (result.data) installRestoredMenu("header", result.data);
                }}
              />
              <GlobalRevisionHistory
                currentVersion={
                  menusQuery.data?.find((menu) => menu.location === "footer")
                    ?.version
                }
                description="Các liên kết hiển thị ở cuối trang."
                loading={footerRevisionsQuery.isLoading}
                pending={restoreMenu.isPending}
                revisions={footerRevisionsQuery.data ?? []}
                testId="footer-menu-revision-history"
                title="Menu cuối trang"
                renderSummary={(content) => (
                  <span>{content.items.length} mục điều hướng</span>
                )}
                onRestore={async (revisionId) => {
                  const expectedVersion = installedVersions.current?.footerMenu;
                  if (!expectedVersion) return;
                  const result = await restoreMenu.mutateAsync({
                    location: "footer",
                    revisionId,
                    expectedVersion,
                  });
                  if (result.data) installRestoredMenu("footer", result.data);
                }}
              />
            </CardContent>
          </Card>
        </div>
        <GlobalSettingsPreview chrome={previewChrome} />
      </div>
    </AdminShell>
  );
}
