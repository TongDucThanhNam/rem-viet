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
import { CircleAlert, Inbox, type LucideIcon } from "lucide-react";
import { useState, type ReactElement, type ReactNode } from "react";

import { getAdminRouteMeta } from "@/lib/admin-routes";

export function AdminPageHeader({
  actions,
  eyebrow,
}: {
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const { description, title } = getAdminRouteMeta(pathname);

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
      {actions ? (
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
          {actions}
        </div>
      ) : null}
    </header>
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
  tone?: "empty" | "error";
}) {
  const Icon = tone === "error" ? CircleAlert : Inbox;

  return (
    <div
      className="flex min-h-40 flex-col items-center justify-center px-4 py-8 text-center"
      role={tone === "error" ? "alert" : "status"}
    >
      <div className="mb-3 grid size-9 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon aria-hidden className="size-4" />
      </div>
      <h2 className="text-sm font-medium text-foreground">{title}</h2>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

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
