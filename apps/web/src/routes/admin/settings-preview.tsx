import { roleHasCapability } from "@rem-viet/cms";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState, type MouseEvent as ReactMouseEvent } from "react";

import Header from "@/components/header";
import SiteFooter from "@/components/site-footer";
import { getPreviewAdminUser } from "@/functions/get-preview-admin-user";
import { useSiteChrome } from "@/hooks/use-site-chrome";
import {
  globalSettingsPreviewReadyMessageType,
  isGlobalSettingsPreviewMessage,
} from "@/lib/global-settings-preview";
import type { SiteChromeData } from "@/lib/site-chrome";
import { siteConfig } from "@/lib/site-config";

export const Route = createFileRoute("/admin/settings-preview")({
  headers: () => ({
    "Cache-Control": "private, no-store, max-age=0",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
  }),
  beforeLoad: async () => ({ session: await getPreviewAdminUser() }),
  loader: async ({ context }) => {
    if (!context.session) throw redirect({ to: "/dang-nhap" });
    if (!roleHasCapability(context.session.staffRole, "settings.manage"))
      throw redirect({ to: "/admin/dashboard" });
  },
  head: () => ({
    meta: [
      { title: `Xem trước cấu hình — ${siteConfig.name} CMS` },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: GlobalSettingsPreviewRoute,
});

function GlobalSettingsPreviewRoute() {
  const currentChrome = useSiteChrome();
  const [liveChrome, setLiveChrome] = useState<SiteChromeData | null>(null);
  const displayedChrome =
    liveChrome ??
    ({
      footerMenu: currentChrome.footerMenu,
      headerMenu: currentChrome.headerMenu,
      settings: currentChrome.settings,
    } satisfies SiteChromeData);

  useEffect(() => {
    const receiveWorkingCopy = (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== window.parent ||
        !isGlobalSettingsPreviewMessage(event.data)
      )
        return;

      setLiveChrome(event.data.chrome);
      window.parent.postMessage(
        { type: globalSettingsPreviewReadyMessageType },
        window.location.origin,
      );
    };

    window.addEventListener("message", receiveWorkingCopy);
    window.parent.postMessage(
      { type: globalSettingsPreviewReadyMessageType },
      window.location.origin,
    );
    return () => window.removeEventListener("message", receiveWorkingCopy);
  }, []);

  const keepPreviewInPlace = (event: ReactMouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("a")) event.preventDefault();
  };

  return (
    <div
      className="grid min-h-svh grid-rows-[auto_1fr_auto] bg-background"
      data-testid="global-settings-rendered-preview"
      onClickCapture={keepPreviewInPlace}
    >
      <Header initialChrome={displayedChrome} preferInitialChrome />
      <main className="bg-gradient-to-b from-muted/30 to-background px-5 py-12 sm:px-8 lg:py-20">
        <section className="mx-auto grid w-full max-w-5xl gap-8 rounded-3xl border bg-background/95 p-6 shadow-sm sm:p-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div className="space-y-4">
            <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">
              Bản làm việc trực tiếp
            </p>
            <h1 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-5xl">
              Kiểm tra nhận diện và điều hướng trong giao diện thật.
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              Header và footer trên canvas này là component production. Nội dung
              ở giữa được giữ trung tính để bạn tập trung vào logo, liên hệ,
              mạng xã hội và cấu trúc menu trước khi lưu.
            </p>
          </div>
          <div className="grid gap-3 rounded-2xl border bg-muted/20 p-5 text-sm">
            <p className="font-semibold">Đang xem bản chưa lưu</p>
            <p className="text-muted-foreground">
              Thay đổi trong màn hình cấu hình sẽ xuất hiện ở đây mà không ghi
              dữ liệu lên máy chủ.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter initialChrome={displayedChrome} preferInitialChrome />
    </div>
  );
}
