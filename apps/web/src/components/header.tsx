import { Button } from "@rem-viet/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@rem-viet/ui/components/dropdown-menu";
import { Input } from "@rem-viet/ui/components/input";
import { Link } from "@tanstack/react-router";
import { Menu, Search, ShoppingCart, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";

import { formatCurrency, useCart } from "@/lib/cart";
import { productImageUrl, siteConfig } from "@/lib/site-config";
import RemVietLogo from "./rem-viet-logo";
import ThemeSwitch from "./theme-switch";

type HeaderNavRoute =
  | "/"
  | "/gioi-thieu"
  | "/bai-viet"
  | "/danh-sach-san-pham"
  | "/san-pham";
type HeaderNavItem = {
  href?: string;
  label: string;
  to?: HeaderNavRoute;
};

function getExternalHref(item: HeaderNavItem) {
  return "href" in item && typeof item.href === "string" ? item.href : null;
}

function getInternalTo(item: HeaderNavItem): HeaderNavRoute {
  if (
    "to" in item &&
    (item.to === "/" ||
      item.to === "/gioi-thieu" ||
      item.to === "/bai-viet" ||
      item.to === "/danh-sach-san-pham" ||
      item.to === "/san-pham")
  ) {
    return item.to;
  }

  return "/";
}

export default function Header() {
  const cart = useCart();
  const [searchValue, setSearchValue] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

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
            to="/"
            className="flex items-center gap-2 text-sm font-semibold"
          >
            <RemVietLogo />
            <span className="whitespace-nowrap">Rèm Việt</span>
          </Link>

          <nav className="hidden gap-5 text-sm text-muted-foreground md:flex">
            {siteConfig.navItems.map((item) => {
              const href = getExternalHref(item);

              if (href) {
                return (
                  <a
                    className="transition-colors hover:text-foreground"
                    href={href}
                    key={href}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {item.label}
                  </a>
                );
              }

              return (
                <Link
                  activeProps={{ className: "text-foreground" }}
                  className="transition-colors hover:text-foreground"
                  key={getInternalTo(item)}
                  to={getInternalTo(item)}
                >
                  {item.label}
                </Link>
              );
            })}
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

          <a
            aria-label="Github"
            className="hidden size-9 items-center justify-center rounded-lg bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground md:inline-flex"
            href={siteConfig.links.github}
            rel="noreferrer"
            target="_blank"
          >
            <GithubIcon aria-hidden className="size-4" />
          </a>
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
            {siteConfig.navItems.map((item) => {
              const href = getExternalHref(item);

              return href ? (
                <a
                  className="rounded-lg px-3 py-2 text-muted-foreground"
                  href={href}
                  key={href}
                  rel="noreferrer"
                  target="_blank"
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  activeProps={{ className: "bg-muted text-foreground" }}
                  className="rounded-lg px-3 py-2 text-muted-foreground"
                  key={getInternalTo(item)}
                  to={getInternalTo(item)}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      ) : null}
    </header>
  );
}

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.09.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.35 9.35 0 0 1 12 6.98c.85 0 1.71.12 2.51.35 1.9-1.33 2.74-1.05 2.74-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.59.69.49A10.13 10.13 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z" />
    </svg>
  );
}
