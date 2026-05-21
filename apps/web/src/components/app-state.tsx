import { Button } from "@rem-viet/ui/components/button";
import {
  Link,
  type ErrorComponentProps,
  type NotFoundRouteProps,
} from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Home, RefreshCcw } from "lucide-react";
import { useEffect, type ReactNode } from "react";

type StateShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

function StateShell({
  eyebrow,
  title,
  description,
  children,
}: StateShellProps) {
  return (
    <main className="grid min-h-[70svh] place-items-center bg-[linear-gradient(to_right,#80808012_3px,transparent_3px),linear-gradient(to_bottom,#80808012_3px,transparent_3px)] bg-[size:24px_24px] px-4 py-16">
      <section className="w-full max-w-xl border bg-background p-6 text-center shadow-sm sm:p-10">
        <p className="text-sm font-semibold uppercase text-muted-foreground">
          {eyebrow}
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-normal sm:text-4xl">
          {title}
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-muted-foreground">
          {description}
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          {children}
        </div>
      </section>
    </main>
  );
}

export function NotFoundState(_props: NotFoundRouteProps) {
  return (
    <StateShell
      eyebrow="404"
      title="Không tìm thấy trang"
      description="Đường dẫn này không còn tồn tại hoặc đã được chuyển sang vị trí khác trong web mới."
    >
      <Link to="/">
        <Button className="h-10 rounded-lg px-4">
          <Home aria-hidden />
          Về trang chủ
        </Button>
      </Link>
      <Link to="/bai-viet">
        <Button className="h-10 rounded-lg px-4" variant="outline">
          <ArrowLeft aria-hidden />
          Xem bài viết
        </Button>
      </Link>
    </StateShell>
  );
}

export function ErrorState({ error, reset }: ErrorComponentProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const message =
    error instanceof Error ? error.message : "Đã xảy ra lỗi không xác định.";

  return (
    <StateShell
      eyebrow="Lỗi"
      title="Không thể tải nội dung"
      description={message}
    >
      <Button className="h-10 rounded-lg px-4" type="button" onClick={reset}>
        <RefreshCcw aria-hidden />
        Thử lại
      </Button>
      <Link to="/">
        <Button className="h-10 rounded-lg px-4" variant="outline">
          <AlertTriangle aria-hidden />
          Về trang chủ
        </Button>
      </Link>
    </StateShell>
  );
}
