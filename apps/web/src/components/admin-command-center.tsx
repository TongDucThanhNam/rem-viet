import { Button } from "@rem-viet/ui/components/button";
import { Input } from "@rem-viet/ui/components/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@rem-viet/ui/components/sheet";
import { cn } from "@rem-viet/ui/lib/utils";
import {
  roleHasCapability,
  type CmsCapability,
  type StaffRole,
} from "@rem-viet/cms";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  CornerDownLeft,
  FileText,
  Globe2,
  Search,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { adminNavigationSections } from "@/lib/admin-routes";
import { siteManifest } from "@/lib/site-config";
import { useTRPC } from "@/utils/trpc";

type AdminCommandCenterProps = {
  currentPathname: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  staffRole?: StaffRole;
};

type CommandItem = {
  description: string;
  icon: LucideIcon;
  kind: "content" | "navigation";
  label: string;
  sectionLabel: string;
  status?: "draft" | "published" | "scheduled";
  to: string;
};

type SearchablePage = {
  _id: string;
  scheduledAt: string | Date | null;
  slug: string;
  status: "draft" | "published";
  template: "landing" | "standard";
  title: string;
  updatedAt: string;
};

type SearchablePost = {
  _id: string;
  scheduledAt?: string | Date | null;
  slug: string;
  status: "draft" | "published";
  title: string;
  updatedAt: string;
};

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

function getCommandItems(staffRole?: StaffRole): CommandItem[] {
  const items: CommandItem[] = [];

  for (const section of adminNavigationSections) {
    if (
      "feature" in section &&
      section.feature &&
      !siteManifest.features[section.feature]
    )
      continue;

    if ("items" in section) {
      for (const item of section.items) {
        const requiredCapability =
          "requiredCapability" in item
            ? (item.requiredCapability as CmsCapability)
            : undefined;
        if (
          requiredCapability &&
          !roleHasCapability(staffRole, requiredCapability)
        )
          continue;
        if (
          "feature" in item &&
          item.feature &&
          !siteManifest.features[item.feature]
        )
          continue;

        items.push({
          description: item.description,
          icon: item.icon,
          kind: "navigation",
          label: item.label,
          sectionLabel: section.label,
          to: item.to,
        });
      }
      continue;
    }

    items.push({
      description: section.description,
      icon: section.icon,
      kind: "navigation",
      label: section.label,
      sectionLabel: "Điều hướng",
      to: section.to,
    });
  }

  return items;
}

export function AdminCommandLauncher({
  className,
  onClick,
}: {
  className?: string;
  onClick: () => void;
}) {
  return (
    <Button
      aria-haspopup="dialog"
      aria-keyshortcuts="Control+K Meta+K"
      aria-label="Mở trung tâm lệnh"
      className={cn(
        "h-8 min-w-8 justify-start gap-2 px-2 text-muted-foreground sm:min-w-44",
        className,
      )}
      onClick={onClick}
      type="button"
      variant="outline"
    >
      <Search aria-hidden className="size-3.5" />
      <span className="hidden flex-1 text-left text-xs sm:inline">
        Tìm nhanh
      </span>
      <kbd className="hidden border bg-muted px-1.5 py-0.5 font-sans text-[10px] leading-none sm:inline">
        Ctrl K
      </kbd>
    </Button>
  );
}

export function AdminCommandCenter({
  currentPathname,
  onOpenChange,
  open,
  staffRole,
}: AdminCommandCenterProps) {
  const trpc = useTRPC();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const resultRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const navigationItems = useMemo(
    () => getCommandItems(staffRole),
    [staffRole],
  );
  const canReadContent = roleHasCapability(staffRole, "content.readDraft");
  const pagesQuery = useQuery({
    ...trpc.content.pages.adminList.queryOptions({}),
    enabled: open && canReadContent,
  });
  const postsQuery = useQuery({
    ...trpc.content.posts.adminList.queryOptions({}),
    enabled: open && canReadContent && siteManifest.features.blog,
  });
  const contentItems = useMemo<CommandItem[]>(() => {
    const pages = (pagesQuery.data ?? []) as SearchablePage[];
    const posts = (postsQuery.data ?? []) as SearchablePost[];

    return [
      ...pages.map((page) => ({
        description: `${page.template === "landing" ? "Trang flagship" : "Trang chuẩn"} · /${page.slug}`,
        icon: Globe2,
        kind: "content" as const,
        label: page.title,
        sectionLabel: "Nội dung · Trang",
        status: page.scheduledAt ? ("scheduled" as const) : page.status,
        to:
          page.template === "landing"
            ? "/admin/home"
            : `/admin/pages?pageId=${encodeURIComponent(page._id)}`,
        updatedAt: page.updatedAt,
      })),
      ...posts.map((post) => ({
        description: `Bài viết · /${post.slug}`,
        icon: FileText,
        kind: "content" as const,
        label: post.title,
        sectionLabel: "Nội dung · Bài viết",
        status: post.scheduledAt ? ("scheduled" as const) : post.status,
        to: `/admin/posts/${encodeURIComponent(post._id)}/edit`,
        updatedAt: post.updatedAt,
      })),
    ]
      .sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() -
          new Date(left.updatedAt).getTime(),
      )
      .map(({ updatedAt: _updatedAt, ...item }) => item);
  }, [pagesQuery.data, postsQuery.data]);
  const filteredItems = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    if (!normalizedQuery) {
      return [...contentItems.slice(0, 5), ...navigationItems];
    }

    return [...contentItems, ...navigationItems].filter((item) =>
      normalizeSearch(
        `${item.label} ${item.description} ${item.sectionLabel}`,
      ).includes(normalizedQuery),
    );
  }, [contentItems, navigationItems, query]);
  const contentLoading =
    canReadContent &&
    (pagesQuery.isFetching ||
      (siteManifest.features.blog && postsQuery.isFetching));
  const contentUnavailable =
    canReadContent &&
    (pagesQuery.isError || (siteManifest.features.blog && postsQuery.isError));

  useEffect(() => {
    const handleShortcut = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [onOpenChange, open]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
  }, [open]);

  useEffect(() => {
    setActiveIndex((index) =>
      filteredItems.length ? Math.min(index, filteredItems.length - 1) : 0,
    );
  }, [filteredItems.length]);

  const handleSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) =>
        filteredItems.length ? (index + 1) % filteredItems.length : 0,
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) =>
        filteredItems.length
          ? (index - 1 + filteredItems.length) % filteredItems.length
          : 0,
      );
      return;
    }
    if (event.key === "Enter" && filteredItems.length) {
      event.preventDefault();
      resultRefs.current[activeIndex]?.click();
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[min(34rem,94vw)] bg-background text-foreground">
        <div className="border-b px-5 py-5 pr-12">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
            <Sparkles aria-hidden className="size-3.5" />
            Trung tâm lệnh
          </div>
          <SheetTitle>Đi đến bất kỳ đâu</SheetTitle>
          <SheetDescription className="mt-1.5">
            Tìm nội dung, công việc hoặc công cụ được phép với vai trò hiện tại.
          </SheetDescription>
        </div>

        <div className="border-b p-4">
          <label className="sr-only" htmlFor="admin-command-search">
            Tìm trong CMS
          </label>
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              autoFocus
              className="h-11 border-border bg-muted/35 pl-9 pr-3 text-sm"
              id="admin-command-search"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Ví dụ: tên bài viết, trang chủ, media…"
              type="search"
              value={query}
            />
          </div>
          <p
            aria-live="polite"
            className="mt-2 text-[11px] text-muted-foreground"
          >
            {filteredItems.length
              ? `${filteredItems.length} kết quả · đang chọn ${filteredItems[activeIndex]?.label}${contentLoading ? " · đang cập nhật nội dung" : ""}`
              : contentLoading
                ? "Đang tìm trong nội dung…"
                : "Không có kết quả phù hợp"}
          </p>
          {contentUnavailable ? (
            <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
              Nội dung tạm thời chưa tải được; điều hướng và công cụ vẫn sẵn
              sàng.
            </p>
          ) : null}
        </div>

        <nav
          aria-label="Kết quả trung tâm lệnh"
          className="min-h-0 flex-1 overflow-y-auto p-3"
        >
          {filteredItems.length ? (
            <div className="grid gap-1">
              {filteredItems.map((item, index) => {
                const Icon = item.icon;
                const isActive = index === activeIndex;
                const isCurrent = currentPathname === item.to.split("?")[0];
                return (
                  <Link
                    aria-current={isCurrent ? "page" : undefined}
                    className={cn(
                      "group flex min-h-16 items-center gap-3 border border-transparent px-3 py-2.5 outline-none transition-colors focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/40",
                      isActive
                        ? "border-border bg-muted/70"
                        : "hover:bg-muted/45",
                    )}
                    key={item.to}
                    onClick={() => onOpenChange(false)}
                    onMouseEnter={() => setActiveIndex(index)}
                    ref={(element) => {
                      resultRefs.current[index] = element;
                    }}
                    to={item.to}
                  >
                    <span className="grid size-9 shrink-0 place-items-center border bg-background text-muted-foreground group-hover:text-foreground">
                      <Icon aria-hidden className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-xs font-medium">
                        <span className="truncate">{item.label}</span>
                        {isCurrent ? (
                          <span className="shrink-0 bg-primary/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-primary">
                            Hiện tại
                          </span>
                        ) : null}
                        {item.status ? (
                          <span className="shrink-0 border px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
                            {item.status === "scheduled"
                              ? "Đã lên lịch"
                              : item.status === "published"
                                ? "Công khai"
                                : "Bản nháp"}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                        {item.sectionLabel} · {item.description}
                      </span>
                    </span>
                    <ArrowUpRight
                      aria-hidden
                      className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                    />
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="grid min-h-48 place-items-center border border-dashed p-6 text-center">
              <div>
                <p className="text-sm font-medium">
                  Không tìm thấy nội dung hoặc công cụ
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Thử tên bài viết, trang, nhóm công việc hoặc mục tiêu khác.
                </p>
                <Button
                  className="mt-4"
                  onClick={() => setQuery("")}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Xóa tìm kiếm
                </Button>
              </div>
            </div>
          )}
        </nav>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-4 py-3 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <kbd className="border bg-muted px-1.5 py-0.5 font-sans">↑ ↓</kbd>
            Di chuyển
          </span>
          <span className="inline-flex items-center gap-1.5">
            <kbd className="inline-flex items-center border bg-muted px-1.5 py-0.5 font-sans">
              <CornerDownLeft aria-hidden className="size-3" />
            </kbd>
            Mở
          </span>
          <span className="ml-auto">Esc để đóng</span>
        </div>
      </SheetContent>
    </Sheet>
  );
}
