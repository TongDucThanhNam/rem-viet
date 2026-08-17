import { Button } from "@rem-viet/ui/components/button";
import { Card, CardContent } from "@rem-viet/ui/components/card";
import { Input } from "@rem-viet/ui/components/input";
import { Label } from "@rem-viet/ui/components/label";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Send } from "lucide-react";
import { useState, type FormEvent } from "react";

import { siteConfig } from "@/lib/site-config";

export const Route = createFileRoute("/lien-he")({
  component: ContactPage,
  head: () => ({
    meta: [
      { title: `Liên hệ | ${siteConfig.name}` },
      {
        name: "description",
        content: "Gửi yêu cầu tư vấn và đặt lịch đo rèm, lưới chống muỗi.",
      },
    ],
  }),
});

function ContactPage() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/forms/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        formKey: "contact",
        payload: {
          name: String(form.get("name") ?? ""),
          email: String(form.get("email") ?? ""),
          phone: String(form.get("phone") ?? ""),
          message: String(form.get("message") ?? ""),
        },
        sourcePage: "/lien-he",
        website: String(form.get("website") ?? ""),
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    if (response.ok) {
      setState("sent");
      event.currentTarget.reset();
      return;
    }
    const error = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    setMessage(error?.message ?? "Không thể gửi lúc này. Vui lòng thử lại.");
    setState("error");
  }

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-10 px-6 py-20 lg:grid-cols-[0.8fr_1.2fr] lg:py-28">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
          Tư vấn
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-6xl">
          Kể chúng tôi về không gian của bạn.
        </h1>
        <p className="mt-6 max-w-md text-base leading-7 text-muted-foreground">
          Thông tin được lưu vào inbox bảo mật của đội ngũ. Chúng tôi sẽ phản
          hồi trong giờ làm việc.
        </p>
      </div>
      <Card className="rounded-md">
        <CardContent>
          {state === "sent" ? (
            <div
              className="grid min-h-96 place-items-center text-center"
              role="status"
            >
              <div>
                <CheckCircle2 className="mx-auto size-10 text-emerald-600" />
                <h2 className="mt-4 text-xl font-semibold">Đã nhận yêu cầu</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Cảm ơn bạn. Đội ngũ sẽ liên hệ sớm.
                </p>
                <Button
                  className="mt-6"
                  variant="secondary"
                  onClick={() => setState("idle")}
                >
                  Gửi yêu cầu khác
                </Button>
              </div>
            </div>
          ) : (
            <form className="grid gap-5" onSubmit={submit}>
              <div className="grid gap-2">
                <Label htmlFor="contact-name">Họ và tên</Label>
                <Input
                  id="contact-name"
                  name="name"
                  autoComplete="name"
                  required
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="contact-email">Email</Label>
                  <Input
                    id="contact-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="contact-phone">Số điện thoại</Label>
                  <Input
                    id="contact-phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="contact-message">Nội dung</Label>
                <textarea
                  className="min-h-36 rounded-md border bg-background px-3 py-2 text-sm"
                  id="contact-message"
                  name="message"
                  required
                />
              </div>
              <div className="absolute -left-[10000px]" aria-hidden>
                <Label htmlFor="contact-website">Website</Label>
                <Input
                  id="contact-website"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>
              {state === "error" ? (
                <p className="text-sm text-destructive" role="alert">
                  {message}
                </p>
              ) : null}
              <Button disabled={state === "sending"} type="submit">
                <Send aria-hidden />
                {state === "sending" ? "Đang gửi..." : "Gửi yêu cầu"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
