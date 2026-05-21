import type { ReactNode } from "react";

import RemVietLogo from "@/components/rem-viet-logo";

type AuthLayoutProps = {
  children: ReactNode;
  quote: string;
};

export default function AuthLayout({ children, quote }: AuthLayoutProps) {
  return (
    <main className="relative flex min-h-svh w-full items-center justify-end overflow-hidden rounded-sm bg-zinc-950 p-2 text-white sm:p-4 lg:p-8">
      <div
        aria-hidden
        className="absolute inset-0 bg-[url('https://nextuipro.nyc3.cdn.digitaloceanspaces.com/components-images/black-background-texture.jpeg')] bg-cover bg-center opacity-80"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(120deg,rgba(12,18,28,0.72),rgba(10,10,10,0.46)_46%,rgba(10,10,10,0.18))]"
      />

      <a
        className="absolute left-5 top-5 z-10 flex items-center gap-3 text-sm font-semibold text-white sm:left-10 sm:top-10"
        href="/"
      >
        <RemVietLogo size={40} />
        <span>Rèm Việt</span>
      </a>

      <p className="absolute bottom-10 left-10 z-10 hidden max-w-xl text-sm leading-7 text-white/60 md:block">
        <span className="font-medium">“</span>
        {quote}
        <span className="font-medium">”</span>
      </p>

      <section className="relative z-10 flex w-full max-w-sm flex-col gap-4 rounded-xl bg-background px-8 pb-10 pt-6 text-foreground shadow-lg shadow-black/20">
        {children}
      </section>
    </main>
  );
}
