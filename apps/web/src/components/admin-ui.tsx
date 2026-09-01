import { Badge } from "@rem-viet/ui/components/badge";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@rem-viet/ui/components/alert-dialog";
import { Button } from "@rem-viet/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@rem-viet/ui/components/card";
import { Skeleton } from "@rem-viet/ui/components/skeleton";
import { cn } from "@rem-viet/ui/lib/utils";
import { useRouterState } from "@tanstack/react-router";
import {
  ChevronDown,
  CircleAlert,
  Inbox,
  LoaderCircle,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import {
  useState,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";

import { getAdminRouteMeta } from "@/lib/admin-routes";

export function AdminPageHeader({
  actions,
  descriptionOverride,
  eyebrow,
  titleOverride,
}: {
  actions?: ReactNode;
  descriptionOverride?: ReactNode;
  eyebrow?: ReactNode;
  titleOverride?: ReactNode;
}) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const routeMeta = getAdminRouteMeta(pathname);
  const description = descriptionOverride ?? routeMeta.description;
  const title = titleOverride ?? routeMeta.title;

  return (
    <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-medium text-muted-foreground">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description ? (
          <div className="mt-1.5 text-xs text-muted-foreground">
            {description}
          </div>
        ) : null}
      </div>
      {actions ? <AdminToolbar>{actions}</AdminToolbar> : null}
    </header>
  );
}

export type AdminContentWidth =
  "reading" | "form" | "table" | "workspace" | "full";

const adminContentWidthClass = {
  reading: "mx-auto w-full max-w-3xl",
  form: "mx-auto w-full max-w-5xl",
  table: "mx-auto w-full max-w-[90rem]",
  workspace: "w-full max-w-none",
  full: "w-full max-w-none",
} satisfies Record<AdminContentWidth, string>;

export function AdminContent({
  children,
  className,
  width = "full",
}: {
  children: ReactNode;
  className?: string;
  width?: AdminContentWidth;
}) {
  return (
    <div className={cn(adminContentWidthClass[width], className)}>
      {children}
    </div>
  );
}

export function AdminToolbar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end",
        className,
      )}
      data-admin-toolbar
    >
      {children}
    </div>
  );
}

export function AdminSplitView({
  children,
  className,
  inspector,
}: {
  children: ReactNode;
  className?: string;
  inspector: ReactNode;
}) {
  return (
    <div className={cn("cms-admin-split-view", className)}>
      <div className="min-w-0">{children}</div>
      {inspector}
    </div>
  );
}

export function AdminInspector({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <aside
      className={cn("grid min-w-0 content-start gap-3", className)}
      data-admin-inspector
      {...props}
    >
      {children}
    </aside>
  );
}

export function AdminDisclosure({
  children,
  className,
  defaultOpen = false,
  description,
  title,
}: {
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
  description?: ReactNode;
  title: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details
      className={cn(
        "group overflow-hidden rounded-xl border bg-background",
        className,
      )}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium marker:hidden">
        <span className="min-w-0">
          <span className="block">{title}</span>
          {description ? (
            <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
              {description}
            </span>
          ) : null}
        </span>
        <ChevronDown
          aria-hidden
          className="size-4 shrink-0 transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="border-t">{children}</div>
    </details>
  );
}

export function MetricCard({
  context,
  icon: Icon,
  label,
  value,
}: {
  context: ReactNode;
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <Card className="min-h-32 justify-between ring-border">
      <CardHeader>
        <CardTitle className="text-xs text-muted-foreground">{label}</CardTitle>
        <CardAction>
          <Icon aria-hidden className="size-4 text-muted-foreground" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight text-card-foreground tabular-nums">
          {value}
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground">{context}</div>
      </CardContent>
    </Card>
  );
}

export function DashboardWidget({
  action,
  children,
  className,
  description,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  description?: ReactNode;
  title: string;
}) {
  return (
    <Card className={cn("ring-border", className)}>
      <CardHeader className="border-b">
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function FormSection({
  children,
  description,
  id,
  title,
}: {
  children: ReactNode;
  description?: ReactNode;
  id?: string;
  title: string;
}) {
  return (
    <Card className="ring-border" id={id}>
      <CardHeader className="border-b">
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="grid gap-4">{children}</CardContent>
    </Card>
  );
}

export function ConfirmDestructiveAction({
  confirmLabel = "Xóa",
  confirmVariant = "destructive",
  description,
  onConfirm,
  pending = false,
  title,
  trigger,
}: {
  confirmLabel?: string;
  confirmVariant?: "default" | "destructive";
  description: ReactNode;
  onConfirm: () => Promise<void> | void;
  pending?: boolean;
  title: string;
  trigger: ReactElement;
}) {
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent>
        <div className="grid gap-2">
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <AlertDialogClose
            render={
              <Button disabled={pending} type="button" variant="outline" />
            }
          >
            Hủy
          </AlertDialogClose>
          <Button
            disabled={pending}
            type="button"
            variant={confirmVariant}
            onClick={async () => {
              await onConfirm();
              setOpen(false);
            }}
          >
            {pending ? "Đang xử lý…" : confirmLabel}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function StatusBadge({
  children,
  status,
}: {
  children: ReactNode;
  status: "success" | "warning" | "info" | "destructive" | "neutral";
}) {
  return (
    <Badge variant={status === "neutral" ? "default" : status}>
      {children}
    </Badge>
  );
}

export function AsyncState({
  action,
  description,
  title,
  tone = "empty",
}: {
  action?: ReactNode;
  description: string;
  title: string;
  tone?: "empty" | "error" | "loading" | "conflict";
}) {
  const Icon =
    tone === "error"
      ? CircleAlert
      : tone === "loading"
        ? LoaderCircle
        : tone === "conflict"
          ? TriangleAlert
          : Inbox;

  return (
    <div
      className="flex min-h-40 flex-col items-center justify-center px-4 py-8 text-center"
      role={tone === "error" || tone === "conflict" ? "alert" : "status"}
    >
      <div className="mb-3 grid size-9 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon
          aria-hidden
          className={cn("size-4", tone === "loading" && "animate-spin")}
        />
      </div>
      <h2 className="text-sm font-medium text-foreground">{title}</h2>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export const AdminStatus = AsyncState;

export function DashboardSkeleton() {
  return (
    <div aria-label="Đang tải dashboard" className="grid gap-4" role="status">
      <span className="sr-only">Đang tải dashboard</span>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton className="h-32" key={index} />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(18rem,0.8fr)]">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}
