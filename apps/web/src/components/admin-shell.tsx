import { Button } from "@rem-viet/ui/components/button";
import {
  roleHasCapability,
  type CmsCapability,
  type StaffRole,
} from "@rem-viet/cms";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@rem-viet/ui/components/sheet";
import { cn } from "@rem-viet/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronRight,
  HelpCircle,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  UserRound,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import RemVietLogo from "@/components/rem-viet-logo";
import {
  AdminCommandCenter,
  AdminCommandLauncher,
} from "@/components/admin-command-center";
import ThemeSwitch from "@/components/theme-switch";
import { adminNavigationSections, getAdminRouteMeta } from "@/lib/admin-routes";
import { authClient } from "@/lib/auth-client";
import { siteManifest } from "@/lib/site-config";

type AdminShellProps = {
  titleOverride?: string;
  actions?: ReactNode;
  defaultSidebarExpanded?: boolean;
  hideHeading?: boolean;
  legacyContentFrame?: boolean;
  children: ReactNode;
};

export default function AdminShell({
  titleOverride,
  actions,
  defaultSidebarExpanded = true,
  hideHeading = false,
  legacyContentFrame = false,
  children,
}: AdminShellProps) {
  const navigate = useNavigate();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const staffRole = useRouterState({
    select: (state) => {
      for (let index = state.matches.length - 1; index >= 0; index -= 1) {
        const context = state.matches[index]?.context as
          { session?: { staffRole?: StaffRole } } | undefined;
        if (context?.session?.staffRole) return context.session.staffRole;
      }
      return undefined;
    },
  });
  const mfaRequired = useRouterState({
    select: (state) => {
      for (let index = state.matches.length - 1; index >= 0; index -= 1) {
        const context = state.matches[index]?.context as
          { session?: { mfaRequired?: boolean } } | undefined;
        if (context?.session?.mfaRequired !== undefined)
          return context.session.mfaRequired;
      }
      return false;
    },
  });
  const { data: session } = authClient.useSession();
  const [isHydrated, setIsHydrated] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(
    defaultSidebarExpanded,
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const userName = session?.user.name || "Nam Tong";
  const userEmail = session?.user.email || "Đang xác minh tài khoản";
  const routeMeta = getAdminRouteMeta(pathname);
  const title = titleOverride ?? routeMeta.title;
  const resolvedDescription = routeMeta.description;
  const activeGroupLabel = routeMeta.sectionLabel;

  useEffect(() => setIsHydrated(true), []);
  useEffect(() => {
    document.title = `${title} | ${siteManifest.name}`;
  }, [title]);
  useEffect(() => {
    if (mfaRequired && pathname !== "/admin/security") {
      void navigate({ to: "/admin/security", replace: true });
    }
  }, [mfaRequired, navigate, pathname]);

  const handleSignOut = () => {
    authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          navigate({ to: "/" });
        },
      },
    });
  };

  return (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <main
        aria-label="Không gian quản trị"
        className="flex min-h-dvh w-full bg-background text-foreground"
        data-admin-root
        data-admin-ready={isHydrated ? "true" : undefined}
      >
        <aside
          className={cn(
            "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 motion-reduce:transition-none md:flex",
            sidebarExpanded ? "w-72" : "w-16",
          )}
        >
          <AdminSidebarContent
            collapsed={!sidebarExpanded}
            onCollapse={() => setSidebarExpanded((value) => !value)}
            onNavigate={() => undefined}
            onOpenCommand={() => setCommandOpen(true)}
            onSignOut={handleSignOut}
            activeNavTo={routeMeta.navTo}
            activeSectionKey={routeMeta.sectionKey}
            staffRole={staffRole}
            userEmail={userEmail}
            userImage={session?.user.image || "/src/avatar.webp"}
            userName={userName}
          />
        </aside>

        <SheetContent className="p-0" side="left">
          <SheetTitle className="sr-only">Điều hướng quản trị</SheetTitle>
          <AdminSidebarContent
            collapsed={false}
            onNavigate={() => setMobileOpen(false)}
            onOpenCommand={() => {
              setMobileOpen(false);
              setCommandOpen(true);
            }}
            onSignOut={handleSignOut}
            activeNavTo={routeMeta.navTo}
            activeSectionKey={routeMeta.sectionKey}
            staffRole={staffRole}
            userEmail={userEmail}
            userImage={session?.user.image || "/src/avatar.webp"}
            userName={userName}
          />
        </SheetContent>

        <section className="min-w-0 flex-1 p-3 sm:p-4">
          <div className="mx-auto flex min-h-[calc(100dvh-1.5rem)] w-full max-w-[100rem] flex-col sm:min-h-[calc(100dvh-2rem)]">
            <header className="flex min-h-14 items-center gap-3 border-b px-1 sm:px-2">
              <SheetTrigger
                render={
                  <Button
                    aria-label="Mở điều hướng"
                    className="md:hidden"
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  />
                }
              >
                <Menu aria-hidden className="size-4" />
              </SheetTrigger>
              <div
                aria-label="Breadcrumb"
                className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"
                role="navigation"
              >
                <span className="hidden sm:inline">Quản trị</span>
                <ChevronRight
                  aria-hidden
                  className="hidden size-3.5 sm:block"
                />
                {activeGroupLabel !== title ? (
                  <>
                    <span className="hidden truncate sm:inline">
                      {activeGroupLabel}
                    </span>
                    <ChevronRight
                      aria-hidden
                      className="hidden size-3.5 sm:block"
                    />
                  </>
                ) : null}
                <span className="truncate font-medium text-foreground">
                  {title}
                </span>
              </div>
              <AdminCommandLauncher
                className="ml-auto"
                onClick={() => setCommandOpen(true)}
              />
            </header>

            <div
              className={cn(
                "mt-3 flex-1 bg-background sm:mt-4",
                legacyContentFrame ? "" : "border border-border p-4 sm:p-6",
              )}
            >
              {hideHeading ? null : (
                <div className="flex flex-col justify-between gap-4 border-b pb-5 sm:flex-row sm:items-end">
                  <div className="min-w-0">
                    <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      <UserRound aria-hidden className="size-3.5" />
                      Quản trị
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                      {title}
                    </h1>
                    {resolvedDescription ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {resolvedDescription}
                      </p>
                    ) : null}
                  </div>
                  {actions ? (
                    <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
                      {actions}
                    </div>
                  ) : null}
                </div>
              )}
              <div className={hideHeading ? "" : "mt-6"}>{children}</div>
            </div>
          </div>
        </section>
        <AdminCommandCenter
          currentPathname={pathname}
          onOpenChange={setCommandOpen}
          open={commandOpen}
          staffRole={staffRole}
        />
      </main>
    </Sheet>
  );
}

function AdminSidebarContent({
  activeNavTo,
  activeSectionKey,
  collapsed,
  onCollapse,
  onNavigate,
  onOpenCommand,
  onSignOut,
  staffRole,
  userEmail,
  userImage,
  userName,
}: {
  activeNavTo: string;
  activeSectionKey: string;
  collapsed: boolean;
  onCollapse?: () => void;
  onNavigate: () => void;
  onOpenCommand: () => void;
  onSignOut: () => void;
  staffRole?: StaffRole;
  userEmail: string;
  userImage: string;
  userName: string;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col p-3">
      <div
        className={cn(
          "flex min-h-11 items-center gap-3",
          collapsed ? "justify-center" : "px-2",
        )}
      >
        <div className="grid size-8 shrink-0 place-items-center rounded-full bg-foreground">
          <RemVietLogo size={32} />
        </div>
        {collapsed ? null : (
          <span className="min-w-0 truncate text-sm font-semibold uppercase">
            {siteManifest.name}
          </span>
        )}
        {onCollapse ? (
          <Button
            aria-label={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
            className={collapsed ? undefined : "ml-auto"}
            onClick={onCollapse}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden className="size-4" />
            ) : (
              <PanelLeftClose aria-hidden className="size-4" />
            )}
          </Button>
        ) : null}
      </div>

      <div
        className={cn(
          "mt-4 flex items-center gap-3",
          collapsed ? "justify-center" : "px-2",
        )}
      >
        <img
          alt=""
          className="size-8 shrink-0 rounded-full border border-sidebar-border object-cover"
          src={userImage}
        />
        {collapsed ? null : (
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">{userName}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {userEmail}
            </p>
          </div>
        )}
      </div>

      <nav
        aria-label="Điều hướng quản trị"
        className="mt-4 grid min-h-0 flex-1 content-start gap-1 overflow-y-auto py-2"
      >
        {adminNavigationSections.map((section) => {
          if (
            "feature" in section &&
            section.feature &&
            !siteManifest.features[section.feature]
          )
            return null;

          const Icon = section.icon;

          if ("items" in section) {
            const visibleItems = section.items.filter((item) => {
              const requiredCapability =
                "requiredCapability" in item
                  ? (item.requiredCapability as CmsCapability)
                  : undefined;
              if (
                requiredCapability &&
                !roleHasCapability(staffRole, requiredCapability)
              )
                return false;
              if (
                "feature" in item &&
                item.feature &&
                !siteManifest.features[item.feature]
              )
                return false;
              return true;
            });
            const isOpen = activeSectionKey === section.key;

            if (collapsed) {
              const firstItem = visibleItems[0];
              if (!firstItem) return null;

              return (
                <Link
                  aria-label={section.label}
                  className={cn(
                    "mx-auto grid size-10 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                    isOpen &&
                      "bg-sidebar-accent text-sidebar-accent-foreground",
                  )}
                  key={section.key}
                  onClick={onNavigate}
                  title={section.label}
                  to={firstItem.to}
                >
                  <Icon aria-hidden className="size-4" />
                </Link>
              );
            }

            return (
              <details
                className="group/sidebar"
                key={section.key}
                open={isOpen}
              >
                <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-md px-2.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring [&::-webkit-details-marker]:hidden">
                  <Icon aria-hidden className="size-4" />
                  <span className="truncate">{section.label}</span>
                  <ChevronDown
                    aria-hidden
                    className="ml-auto size-3.5 transition-transform group-open/sidebar:rotate-180"
                  />
                </summary>
                <div className="ml-4 mt-0.5 grid gap-1 border-l border-sidebar-border pl-2">
                  {visibleItems.map(({ label, to, icon: ItemIcon }) => (
                    <Link
                      className={cn(
                        "flex min-h-9 items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                        activeNavTo === to &&
                          "bg-sidebar-accent text-sidebar-accent-foreground",
                      )}
                      key={to}
                      onClick={onNavigate}
                      to={to}
                    >
                      <ItemIcon aria-hidden className="size-3.5" />
                      <span className="truncate">{label}</span>
                    </Link>
                  ))}
                </div>
              </details>
            );
          }

          const isActive = activeNavTo === section.to;

          return (
            <Link
              aria-label={collapsed ? section.label : undefined}
              className={cn(
                "flex min-h-10 items-center gap-2 rounded-md px-2.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                collapsed && "mx-auto size-10 justify-center px-0",
                isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
              )}
              key={section.key}
              onClick={onNavigate}
              title={collapsed ? section.label : undefined}
              to={section.to}
            >
              <Icon aria-hidden className="size-4" />
              {collapsed ? null : (
                <span className="truncate">{section.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto grid gap-1 border-t border-sidebar-border pt-3">
        <div
          className={cn(
            "flex min-h-10 items-center gap-2 rounded-md px-2.5 py-2 text-xs text-muted-foreground",
            collapsed && "justify-center px-0",
          )}
        >
          <ThemeSwitch />
          {collapsed ? null : "Đổi giao diện"}
        </div>
        {collapsed ? null : (
          <button
            className="flex min-h-10 items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            onClick={onOpenCommand}
            type="button"
          >
            <HelpCircle aria-hidden className="size-4" />
            Tìm nhanh và trợ giúp
          </button>
        )}
        <button
          aria-label={collapsed ? "Đăng xuất" : undefined}
          className={cn(
            "flex min-h-10 items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40",
            collapsed && "justify-center px-0",
          )}
          onClick={onSignOut}
          title={collapsed ? "Đăng xuất" : undefined}
          type="button"
        >
          <LogOut aria-hidden className="size-4" />
          {collapsed ? null : "Đăng xuất"}
        </button>
      </div>
    </div>
  );
}

/* Legacy exports remain until the dashboard migration is complete. */

type AdminStatCardProps = {
  title: string;
  value: string;
  detail?: string;
  tone?: "dark" | "blue" | "light";
  icon?: ReactNode;
};

export function AdminStatCard({
  title,
  value,
  detail,
  tone = "light",
  icon,
}: AdminStatCardProps) {
  const toneClass =
    tone === "dark"
      ? "bg-primary text-primary-foreground"
      : tone === "blue"
        ? "bg-blue-700 text-white"
        : "bg-background";
  const mutedClass =
    tone === "light" ? "text-muted-foreground" : "text-white/70";

  return (
    <article className={`w-full rounded-xl border p-5 shadow-md ${toneClass}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">{title}</h2>
        <div className={mutedClass}>{icon}</div>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="text-2xl font-bold">{value}</p>
        <span className="text-sm text-emerald-400">+4.5%</span>
      </div>
      {detail ? <p className={`mt-3 text-sm ${mutedClass}`}>{detail}</p> : null}
      <div
        className={`mt-4 grid grid-cols-3 gap-4 border-t pt-4 ${tone === "light" ? "" : "border-white/20"}`}
      >
        {["Thu nhập", "Chi phí", "Khách VIP"].map((label, index) => (
          <div className="grid gap-1" key={label}>
            <span className={`text-xs ${mutedClass}`}>{label}</span>
            <span className="text-sm font-semibold">
              {index === 0 ? "930" : index === 1 ? "120" : "125"}
            </span>
          </div>
        ))}
      </div>
    </article>
  );
}

export function AdminChart({
  data,
  valueKey,
}: {
  data: Array<{ name: string; price: number; stock: number; sales: number }>;
  valueKey: "price" | "stock" | "sales";
}) {
  const maxValue = Math.max(...data.map((item) => item[valueKey]), 1);

  return (
    <div className="rounded-2xl border bg-background p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold tracking-normal">
          Phân tích sản phẩm
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Biểu đồ đơn giản port từ dashboard cũ.
        </p>
      </div>
      <div className="flex h-72 items-end gap-4 overflow-x-auto border-l border-b px-4 pb-4">
        {data.map((item) => (
          <div
            className="flex min-w-20 flex-1 flex-col items-center gap-2"
            key={item.name}
          >
            <div className="flex h-56 w-full items-end">
              <div
                className="w-full rounded-t-lg bg-primary/80"
                style={{
                  height: `${Math.max((item[valueKey] / maxValue) * 100, 4)}%`,
                }}
              />
            </div>
            <span className="text-center text-xs text-muted-foreground">
              {item.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
