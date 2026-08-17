import type { AppRouter } from "@rem-viet/api/routers/index";
import { getSiteSettings, listMenus } from "@rem-viet/api/services/content";
import { env } from "@rem-viet/env/server";
import { Toaster } from "@rem-viet/ui/components/sonner";
import type { QueryClient } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouterState,
} from "@tanstack/react-router";
import type { TRPCOptionsProxy } from "@trpc/tanstack-react-query";

import FloatingContact from "../components/floating-contact";
import Header from "../components/header";
import { ErrorState } from "../components/app-state";
import SiteFooter from "../components/site-footer";
import { WebVitalsReporter } from "../components/web-vitals-reporter";
import { getSiteChromeData } from "../lib/site-chrome";
import { siteConfig } from "../lib/site-config";

import appCss from "../index.css?url";
export interface RouterAppContext {
  trpc: TRPCOptionsProxy<AppRouter>;
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  loader: () => getRootChromeData(),
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      { title: siteConfig.name },
      {
        name: "description",
        content: siteConfig.description,
      },
      {
        name: "robots",
        content: "index, follow",
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        property: "og:locale",
        content: "vi_VN",
      },
      {
        property: "og:url",
        content: siteConfig.url,
      },
      {
        property: "og:title",
        content: siteConfig.name,
      },
      {
        property: "og:description",
        content: siteConfig.description,
      },
      {
        property: "og:site_name",
        content: siteConfig.name,
      },
      {
        property: "og:image",
        content: siteConfig.image,
      },
      {
        property: "og:image:width",
        content: "1200",
      },
      {
        property: "og:image:height",
        content: "630",
      },
      {
        property: "og:image:alt",
        content: siteConfig.name,
      },
      {
        name: "twitter:card",
        content: "summary_large_image",
      },
      {
        name: "twitter:title",
        content: siteConfig.name,
      },
      {
        name: "twitter:description",
        content: siteConfig.description,
      },
      {
        name: "twitter:image",
        content: siteConfig.image,
      },
      {
        name: "twitter:creator",
        content: "@tongducthanhnam",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "manifest",
        href: "/manifest.webmanifest",
      },
      {
        rel: "icon",
        href: "/favicon.ico",
      },
      {
        rel: "canonical",
        href: siteConfig.url,
      },
    ],
  }),

  component: RootDocument,
  errorComponent: ErrorState,
  notFoundComponent: NotFound,
});

const getRootChromeData = createServerFn({ method: "GET" }).handler(
  async () => {
    const [settings, menus] = await Promise.all([
      getSiteSettings(),
      listMenus(),
    ]);

    const configuredSampleRate = Number(env.RUM_SAMPLE_RATE);
    return {
      ...getSiteChromeData(settings, menus),
      rumSampleRate: Number.isFinite(configuredSampleRate)
        ? Math.min(1, Math.max(0, configuredSampleRate))
        : 0,
    };
  },
);

function RootDocument() {
  const chromeData = Route.useLoaderData();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const isAuthRoute = [
    "/dang-nhap",
    "/dang-ky",
    "/quen-mat-khau",
    "/login",
  ].includes(pathname);
  const isAdminRoute = pathname.startsWith("/admin");
  const isPreviewRoute =
    pathname === "/admin/home-preview" ||
    pathname === "/admin/settings-preview" ||
    /^\/admin\/(?:pages|posts)\/[^/]+\/preview$/.test(pathname);
  const isLegacyAdminRoute =
    pathname === "/dashboard" ||
    pathname === "/products" ||
    pathname === "/orders" ||
    pathname === "/add-order" ||
    pathname === "/add-product" ||
    pathname === "/inventory" ||
    pathname === "/add-inventory" ||
    pathname.startsWith("/edit-product/") ||
    pathname.startsWith("/view-product/");
  const isStandaloneRoute = pathname === "/not-found";
  // The landing page (`/`) is the AWWWARDS-style immersive design from
  // `components/landing/`. It ships its own `<Navigation />` and
  // `<CurtainFooter />` (see `routes/index.tsx`), plus its own contact
  // affordances via the custom cursor + magnetic CTA. Rendering the
  // standard `<Header />` / `<SiteFooter />` / `<FloatingContact />` on
  // top of it stacks two nav bars and two footer columns — the user
  // sees the regular header overlay and only the parts of the hero
  // that bleed through. So `/` joins the chrome-hidden set.
  const isLandingRoute = pathname === "/";
  const isBlogRoute =
    pathname === "/bai-viet" || pathname.startsWith("/bai-viet/");
  const hideSiteChrome =
    isAuthRoute ||
    isAdminRoute ||
    isLegacyAdminRoute ||
    isStandaloneRoute ||
    isLandingRoute ||
    isBlogRoute;
  const showSiteFooter = !hideSiteChrome;
  const collectWebVitals =
    !isAuthRoute && !isAdminRoute && !isLegacyAdminRoute && !isStandaloneRoute;

  return (
    <html lang="vi">
      <head>
        <HeadContent />
      </head>
      <body>
        <div
          className={
            hideSiteChrome
              ? "grid min-h-svh grid-rows-[1fr]"
              : showSiteFooter
                ? "grid min-h-svh grid-rows-[auto_1fr_auto]"
                : "grid min-h-svh grid-rows-[auto_1fr]"
          }
        >
          {hideSiteChrome ? null : <Header initialChrome={chromeData} />}
          <Outlet />
          {showSiteFooter ? <SiteFooter initialChrome={chromeData} /> : null}
        </div>
        {hideSiteChrome ? null : <FloatingContact initialChrome={chromeData} />}
        {collectWebVitals ? (
          <WebVitalsReporter sampleRate={chromeData.rumSampleRate} />
        ) : null}
        <Toaster
          containerAriaLabel={
            isPreviewRoute
              ? "Thông báo bản xem trước"
              : isAdminRoute
                ? "Thông báo quản trị"
                : "Thông báo trang web"
          }
          richColors
        />
        <Scripts />
      </body>
    </html>
  );
}

function NotFound() {
  return (
    <main className="grid min-h-[70svh] place-items-center bg-background px-6 py-24 sm:py-32 lg:px-8">
      <div className="text-center">
        <p className="text-base font-semibold text-primary">404</p>
        <h1 className="mt-4 text-3xl font-bold tracking-normal text-foreground sm:text-5xl">
          Không tìm thấy trang
        </h1>
        <p className="mt-6 text-base leading-7 text-muted-foreground">
          Đường dẫn này không còn tồn tại hoặc đã được chuyển sang trang khác.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            className="inline-flex min-h-10 items-center rounded-md bg-primary px-3.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
            to="/"
          >
            Về trang chủ
          </Link>
          <a
            className="inline-flex min-h-10 items-center rounded-md border px-3.5 text-sm font-semibold text-foreground hover:bg-muted"
            href="/#footer"
          >
            Liên hệ hỗ trợ
          </a>
        </div>
      </div>
    </main>
  );
}
