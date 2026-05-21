import { Button } from "@rem-viet/ui/components/button";
import { cn } from "@rem-viet/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Boxes,
  ChevronDown,
  ClipboardList,
  FileText,
  FolderTree,
  HelpCircle,
  Home,
  LayoutDashboard,
  ListFilter,
  LogOut,
  Menu,
  PackageOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  UserRound,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import RemVietLogo from "@/components/rem-viet-logo";
import ThemeSwitch from "@/components/theme-switch";
import { authClient } from "@/lib/auth-client";

type AdminShellProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  hideHeading?: boolean;
  legacyContentFrame?: boolean;
  children: ReactNode;
};

const sections = [
  {
    key: "dashboard",
    label: "Báo cáo",
    to: "/admin/dashboard",
    icon: LayoutDashboard,
  },
  {
    key: "products",
    label: "Sản phẩm",
    icon: Boxes,
    items: [
      { label: "Quản lý sản phẩm", to: "/admin/products", icon: Boxes },
      { label: "Thêm sản phẩm", to: "/admin/products/new", icon: Plus },
      { label: "Danh mục", to: "/admin/categories", icon: FolderTree },
    ],
  },
  {
    key: "orders",
    label: "Đơn hàng",
    icon: ClipboardList,
    items: [
      { label: "Quản lý đơn hàng", to: "/admin/orders", icon: ClipboardList },
      { label: "Thêm đơn hàng", to: "/admin/orders/new", icon: Plus },
    ],
  },
  {
    key: "inventory",
    label: "Nhập xuất kho",
    icon: PackageOpen,
    items: [
      { label: "Quản lý nhập xuất", to: "/admin/inventory", icon: PackageOpen },
      { label: "Thêm nhập xuất", to: "/admin/inventory/new", icon: Plus },
    ],
  },
  {
    key: "system",
    label: "Hệ thống",
    icon: ListFilter,
    items: [
      { label: "Bài viết", to: "/bai-viet", icon: FileText },
      { label: "Logs", to: "/admin/logs", icon: ListFilter },
    ],
  },
  {
    key: "home",
    label: "Trang chủ",
    to: "/",
    icon: Home,
  },
] as const;

export default function AdminShell({
  title,
  description,
  actions,
  hideHeading = false,
  legacyContentFrame = false,
  children,
}: AdminShellProps) {
  const navigate = useNavigate();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const { data: session } = authClient.useSession();
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const userName = session?.user.name || "Nam Tong";
  const userEmail = session?.user.email || "ADMINISTRATOR";

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
    <main className="h-dvh w-full bg-background">
      <div className="flex h-full w-full">
        <aside
          className={cn(
            "relative flex h-full w-72 shrink-0 flex-col border-r border-divider p-6 transition-[width,transform,margin] duration-300",
            !sidebarVisible && "-ml-72 -translate-x-72",
          )}
        >
          <div className="flex items-center justify-between gap-3 px-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex items-center justify-center rounded-full bg-foreground">
                <RemVietLogo size={36} />
              </div>
              <span className="truncate text-sm font-bold uppercase">
                Rèm Việt
              </span>
            </div>
            <Button
              aria-label="Ẩn sidebar"
              className="rounded-md"
              onClick={() => setSidebarVisible(false)}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <PanelLeftClose aria-hidden className="size-4" />
            </Button>
          </div>

          <div className="mt-8 flex items-center gap-3 px-3">
            <img
              alt=""
              className="size-8 rounded-full border border-divider object-cover"
              src={session?.user.image || "/src/avatar.webp"}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-muted-foreground">
                {userName}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {userEmail}
              </p>
            </div>
          </div>

          <nav className="-mr-6 mt-6 grid flex-1 content-start gap-1 overflow-y-auto py-6 pr-6">
            {sections.map((section) => {
              if ("items" in section) {
                const Icon = section.icon;
                const isOpen = section.items.some((item) =>
                  pathname.startsWith(item.to),
                );

                return (
                  <details
                    className="group/sidebar"
                    key={section.key}
                    open={isOpen}
                  >
                    <summary className="flex h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-default-100 hover:text-foreground [&::-webkit-details-marker]:hidden">
                      <Icon aria-hidden className="size-4" />
                      <span className="truncate">{section.label}</span>
                      <ChevronDown
                        aria-hidden
                        className="ml-auto size-4 transition-transform group-open/sidebar:rotate-180"
                      />
                    </summary>
                    <div className="mt-0.5 grid gap-1 border-l border-default-200 pl-4">
                      {section.items.map(({ label, to, icon: ItemIcon }) => (
                        <Link
                          activeProps={{
                            className: "bg-default-100 text-foreground",
                          }}
                          className="flex h-11 items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-default-100 hover:text-foreground"
                          key={to}
                          to={to}
                        >
                          <ItemIcon aria-hidden className="size-4" />
                          <span className="truncate">{label}</span>
                        </Link>
                      ))}
                    </div>
                  </details>
                );
              }

              const Icon = section.icon;

              return (
                <Link
                  activeProps={{
                    className: "bg-default-100 text-foreground",
                  }}
                  className="flex h-11 items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-default-100 hover:text-foreground"
                  key={section.key}
                  to={section.to}
                >
                  <Icon aria-hidden className="size-4" />
                  <span className="truncate">{section.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto grid gap-1 border-t pt-4">
            <div className="flex h-11 items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-default-100 hover:text-foreground">
              <ThemeSwitch />
              Đổi theme
            </div>
            <button
              className="flex h-11 items-center gap-3 rounded-lg px-3 py-1.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-default-100 hover:text-foreground"
              type="button"
            >
              <HelpCircle aria-hidden className="size-4" />
              Trợ giúp
            </button>
            <button
              className="flex h-11 items-center gap-3 rounded-lg px-3 py-1.5 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
              onClick={handleSignOut}
              type="button"
            >
              <LogOut aria-hidden className="size-4" />
              Đăng xuất
            </button>
          </div>
        </aside>

        <section className="min-w-0 flex-1 p-4">
          <div className="flex h-full flex-col">
            <header className="flex min-h-16 items-center justify-between rounded-lg border border-divider px-4">
              <div className="flex min-w-0 items-center gap-3">
                <Button
                  aria-label={sidebarVisible ? "Ẩn sidebar" : "Hiện sidebar"}
                  className="rounded-md"
                  onClick={() => setSidebarVisible((value) => !value)}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  {sidebarVisible ? (
                    <Menu aria-hidden className="size-4" />
                  ) : (
                    <PanelLeftOpen aria-hidden className="size-4" />
                  )}
                </Button>
                <div className="min-w-0">
                  <p className="text-base font-medium text-muted-foreground">
                    Nội dung
                  </p>
                </div>
              </div>
            </header>

            <div
              className={cn(
                "mt-4 flex-1 border border-divider bg-background",
                legacyContentFrame ? "rounded-lg p-0" : "rounded-lg p-4 md:p-6",
              )}
            >
              {hideHeading ? null : (
                <div className="flex flex-col justify-between gap-4 border-b pb-5 md:flex-row md:items-end">
                  <div className="min-w-0">
                    <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                      <UserRound aria-hidden className="size-3.5" />
                      Administrator
                    </div>
                    <h1 className="text-2xl font-semibold tracking-normal">
                      {title}
                    </h1>
                    {description ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {description}
                      </p>
                    ) : null}
                  </div>
                  {actions ? (
                    <div className="flex flex-wrap gap-2">{actions}</div>
                  ) : null}
                </div>
              )}
              <div className={hideHeading ? "" : "mt-6"}>{children}</div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

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
