import type { MouseEvent, ReactNode } from "react";

import { useMagnetic } from "../../hooks/use-magnetic";

function handleAnchorClick(e: MouseEvent<HTMLAnchorElement>, href: string) {
  if (!href.startsWith("#")) return;
  const target = document.getElementById(href.slice(1));
  if (!target) return;
  e.preventDefault();
  // Lenis intercepts the native imperative scroll API, so scrollIntoView runs
  // through the eased smooth-scroll engine. Do NOT switch to window.scrollTo.
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function MagneticLink({
  href,
  className,
  children,
  "data-cursor": dataCursor,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  "data-cursor"?: string;
}) {
  const { ref } = useMagnetic();

  return (
    <a
      ref={ref as React.Ref<HTMLAnchorElement>}
      href={href}
      className={className}
      data-cursor={dataCursor}
      onClick={(event) => handleAnchorClick(event, href)}
    >
      {children}
    </a>
  );
}

export function Navigation() {
  return (
    <nav className="fixed top-0 left-0 z-[100] flex w-full items-center justify-between p-[2vw_4vw] text-white [mix-blend-mode:difference] max-[640px]:p-[22px]">
      <a
        href="#home"
        className="font-vietnam hover-target inline-block text-sm font-medium tracking-[0.2em] text-white uppercase no-underline will-change-transform max-[640px]:text-[11px]"
        data-cursor="Lên đầu"
        onClick={(event) => handleAnchorClick(event, "#home")}
      >
        Rèm Vina
      </a>
      <div className="font-vietnam flex gap-[3vw] max-[1024px]:hidden">
        <MagneticLink
          href="#threat"
          className="hover-target inline-block text-xs tracking-[0.1em] text-white uppercase no-underline will-change-transform max-[640px]:text-[11px]"
          data-cursor="Xem"
        >
          Tầm Nhìn
        </MagneticLink>
        <MagneticLink
          href="#details"
          className="hover-target inline-block text-xs tracking-[0.1em] text-white uppercase no-underline will-change-transform max-[640px]:text-[11px]"
          data-cursor="Xem"
        >
          Chi Tiết
        </MagneticLink>
        <MagneticLink
          href="#measure"
          className="hover-target inline-block text-xs tracking-[0.1em] text-white uppercase no-underline will-change-transform max-[640px]:text-[11px]"
          data-cursor="Xem"
        >
          Cách Đo
        </MagneticLink>
      </div>
      <MagneticLink
        href="#order"
        className="nav-cta hover-target font-vietnam inline-block text-xs tracking-[0.1em] text-white uppercase no-underline will-change-transform max-[640px]:text-[11px]"
        data-cursor="Liên hệ"
      >
        Tư Vấn
      </MagneticLink>
    </nav>
  );
}
