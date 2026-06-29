import { Button } from "@rem-viet/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@rem-viet/ui/components/dropdown-menu";
import { Input } from "@rem-viet/ui/components/input";
import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, MessageCircle, Search, ShoppingCart, Store, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";

import { useSiteChrome } from "@/hooks/use-site-chrome";
import { formatCurrency, useCart } from "@/lib/cart";
import type { PublicMenuItem, SiteChromeData } from "@/lib/site-chrome";
import { productImageUrl, siteConfig } from "@/lib/site-config";
import RemVietLogo from "./rem-viet-logo";
import ThemeSwitch from "./theme-switch";

function isExternalHref(href: string) {
  return (
    /^(https?:)?\/\//.test(href) ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  );
}

function hrefPath(href: string) {
  if (!href.startsWith("/")) {
    return "";
  }

  return href.split("#")[0] || "/";
}

function isActiveHref(pathname: string, href: string) {
  const path = hrefPath(href);

  if (!path) {
    return false;
  }

  return path === "/"
    ? pathname === "/"
    : pathname === path || pathname.startsWith(`${path}/`);
}

function HeaderNavLink({
  className = "",
  currentPath,
  item,
  onNavigate,
}: {
  className?: string;
  currentPath: string;
  item: PublicMenuItem;
  onNavigate?: () => void;
}) {
  const external = isExternalHref(item.href);
  const active = isActiveHref(currentPath, item.href);

  return (
    <a
      className={`${className} ${
        active ? "text-foreground" : "text-muted-foreground"
      }`}
      href={item.href}
      rel={external ? "noreferrer" : undefined}
      target={external ? "_blank" : undefined}
      onClick={onNavigate}
    >
      {item.label}
    </a>
  );
}

type HeaderProps = {
  initialChrome?: SiteChromeData;
};

export default function Header({ initialChrome }: HeaderProps) {
  const cart = useCart();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const { headerMenu, settings } = useSiteChrome(initialChrome);
  const [searchValue, setSearchValue] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const socialActions = [
    {
      href: settings.socials.facebook,
      icon: MessageCircle,
      label: "Facebook",
    },
    {
      href: settings.socials.shopee,
      icon: Store,
      label: "Shopee",
    },
  ].filter((action) => action.href?.trim());

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!searchValue.trim()) {
      return;
    }

    window.open(
      `https://www.google.com/search?q=${searchValue} site:luoichongmuoi.shop`,
      "_blank",
    );
  }

  return (
    <header
      className={`sticky top-0 z-40 border-b border-default-100 backdrop-blur-md ${
        menuOpen
          ? "bg-default-200/50 dark:bg-default-100/50"
          : "bg-background/90"
      }`}
    >
      <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-3 md:gap-6">
          <Button
            aria-label="Mở menu"
            className="md:hidden"
            size="icon"
            type="button"
            variant="ghost"
            onClick={() => setMenuOpen((value) => !value)}
          >
            <Menu aria-hidden />
          </Button>

          <Link
            className="flex items-center gap-2 text-sm font-semibold"
            to="/"
          >
            <RemVietLogo alt={siteConfig.name} src={settings.logo} />
            <span className="whitespace-nowrap">{siteConfig.name}</span>
          </Link>

          <nav className="hidden gap-5 text-sm md:flex">
            {headerMenu.map((item) => (
              <HeaderNavLink
                className="transition-colors hover:text-foreground"
                currentPath={pathname}
                item={item}
                key={`${item.href}-${item.label}`}
              />
            ))}
          </nav>
        </div>

        <form
          className="hidden w-full max-w-sm items-center gap-2 lg:flex"
          onSubmit={submitSearch}
        >
          <Input
            aria-label="Tìm kiếm"
            className="h-9 rounded-lg bg-muted/70"
            placeholder="Tìm kiếm ..."
            type="search"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
          />
          <Button
            aria-label="Tìm kiếm"
            className="rounded-lg"
            size="icon"
            type="submit"
          >
            <Search aria-hidden />
          </Button>
        </form>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeSwitch />

          <DropdownMenu>
            <DropdownMenuTrigger className="relative inline-flex size-9 items-center justify-center rounded-lg bg-transparent text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <ShoppingCart aria-hidden className="size-5" />
              <span className="absolute -right-1 -top-1 inline-flex min-w-5 justify-center rounded-full bg-muted px-1 text-xs font-medium text-foreground ring-2 ring-background">
                {cart.items.length || 0}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-[min(92vw,26rem)] p-0"
            >
              <DropdownMenuLabel className="px-4 py-3">
                Giỏ hàng của bạn.
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="max-h-96 overflow-y-auto p-3">
                {cart.items.length ? (
                  <div className="grid gap-3">
                    {cart.items.map((item) => (
                      <div
                        className="grid grid-cols-[64px_1fr_auto] gap-3 rounded-lg border p-3"
                        key={item.id}
                      >
                        <img
                          alt={item.name}
                          className="size-16 rounded-md object-cover"
                          src={productImageUrl(item.imageUrl)}
                        />
                        <div className="min-w-0">
                          <Link
                            className="line-clamp-1 text-sm font-semibold hover:underline"
                            params={{ productId: item.productId }}
                            to="/san-pham/$productId"
                          >
                            {item.name}
                          </Link>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatCurrency(item.price)} x {item.quantity}
                          </p>
                          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                            {Object.values(item.variants).join(", ") ||
                              "Mặc định"}
                          </p>
                        </div>
                        <Button
                          aria-label="Xóa sản phẩm"
                          className="rounded-md"
                          size="icon-sm"
                          type="button"
                          variant="destructive"
                          onClick={() => cart.removeItem(item.id)}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Giỏ hàng trống.
                  </p>
                )}
              </div>
              <DropdownMenuSeparator />
              <div className="grid gap-3 p-4">
                <p className="text-center text-sm font-semibold">
                  Tổng cộng {formatCurrency(cart.summary.total)}
                </p>
                <Link
                  className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
                  to="/gio-hang"
                >
                  Đến trang giỏ hàng
                </Link>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {socialActions.map((action) => {
            const Icon = action.icon;

            return (
              <a
                aria-label={action.label}
                className="hidden size-9 items-center justify-center rounded-lg bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground md:inline-flex"
                href={action.href}
                key={action.label}
                rel="noreferrer"
                target="_blank"
                title={action.label}
              >
                <Icon aria-hidden className="size-4" />
              </a>
            );
          })}
        </div>
      </div>

      {menuOpen ? (
        <div className="max-h-[70vh] border-t bg-default-200/50 px-4 py-6 shadow-md backdrop-blur-md backdrop-saturate-150 dark:bg-default-100/50 md:hidden">
          <form className="mb-4 flex gap-2" onSubmit={submitSearch}>
            <Input
              aria-label="Tìm kiếm"
              className="h-9 rounded-lg"
              placeholder="Tìm kiếm ..."
              type="search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
            />
            <Button
              aria-label="Tìm kiếm"
              className="rounded-lg"
              size="icon"
              type="submit"
            >
              <Search aria-hidden />
            </Button>
          </form>
          <nav className="grid gap-2 text-sm">
            {headerMenu.map((item) => (
              <HeaderNavLink
                className="rounded-lg px-3 py-2"
                currentPath={pathname}
                item={item}
                key={`${item.href}-${item.label}`}
                onNavigate={() => setMenuOpen(false)}
              />
            ))}
          </nav>
          {socialActions.length ? (
            <div className="mt-5 grid grid-cols-2 gap-2">
              {socialActions.map((action) => {
                const Icon = action.icon;

                return (
                  <a
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border bg-background px-3 text-sm font-medium"
                    href={action.href}
                    key={action.label}
                    rel="noreferrer"
                    target="_blank"
                    onClick={() => setMenuOpen(false)}
                  >
                    <Icon aria-hidden className="size-4" />
                    {action.label}
                  </a>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
