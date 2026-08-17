import { Menu, X } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";

import {
  gsap,
  ScrollTrigger,
  useGSAP,
  shouldUseStaticLanding,
} from "@/lib/gsap";
import { useMagnetic } from "@/hooks/use-magnetic";
import { siteConfig } from "@/lib/site-config";

const sectionGroups = [
  { key: "threat", ids: ["threat", "benefits", "craft"] },
  { key: "details", ids: ["details", "lifestyle"] },
  { key: "measure", ids: ["measure", "faq"] },
] as const;

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
  isCurrent,
  section,
  "data-cursor": dataCursor,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  isCurrent?: boolean;
  section?: string;
  "data-cursor"?: string;
}) {
  const { ref } = useMagnetic();

  return (
    <a
      ref={ref as React.Ref<HTMLAnchorElement>}
      href={href}
      className={className}
      data-cursor={dataCursor}
      data-section={section}
      aria-current={isCurrent ? "location" : undefined}
      onClick={(event) => handleAnchorClick(event, href)}
    >
      {children}
    </a>
  );
}

type NavigationProps = {
  enabledSectionIds?: string[];
  sectionHrefPrefix?: "" | "/";
};

export function Navigation({
  enabledSectionIds,
  sectionHrefPrefix = "",
}: NavigationProps) {
  const shellRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(
    sectionHrefPrefix ? "blog" : null,
  );

  const sectionHref = (id: string) => `${sectionHrefPrefix}#${id}`;
  const homeHref = sectionHrefPrefix ? "/" : "#home";
  const enabledSet = enabledSectionIds ? new Set(enabledSectionIds) : undefined;
  const firstEnabledId = (ids: readonly string[]) =>
    ids.find((id) => !enabledSet || enabledSet.has(id));
  const navItems = [
    {
      key: "threat",
      label: "Tầm Nhìn",
      sectionId: firstEnabledId(sectionGroups[0].ids),
      cursor: "Xem",
    },
    {
      key: "details",
      label: "Chi Tiết",
      sectionId: firstEnabledId(sectionGroups[1].ids),
      cursor: "Xem",
    },
    {
      key: "measure",
      label: "Cách Đo",
      sectionId: firstEnabledId(sectionGroups[2].ids),
      cursor: "Xem",
    },
    {
      key: "blog",
      label: "Bài Viết",
      sectionId: undefined,
      href: "/bai-viet",
      cursor: "Đọc",
    },
  ]
    .filter((item) => item.key === "blog" || item.sectionId)
    .map((item) => ({
      ...item,
      href: item.href ?? sectionHref(item.sectionId!),
    }));
  const showOrderCta = !enabledSet || enabledSet.has("order");

  useEffect(() => {
    if (!isMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMenuOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isMenuOpen]);

  // Adapted from `transparent-glass-scroll-header`: the header condenses into
  // a theme-aware glass capsule after leaving the top of the document. On the
  // landing route, the same lifecycle also keeps one destination current.
  useGSAP(
    () => {
      const shell = shellRef.current;
      const nav = shell?.querySelector<HTMLElement>(".nav");
      if (!nav) return;

      ScrollTrigger.create({
        start: 72,
        end: "max",
        onToggle: (self) => nav.classList.toggle("is-scrolled", self.isActive),
      });

      if (sectionHrefPrefix) return;

      const trackedSections = sectionGroups.flatMap(({ key, ids }) =>
        ids.flatMap((id) => {
          const section = document.getElementById(id);
          return section ? [{ key, section }] : [];
        }),
      );
      let lastActive: string | null = null;

      const updateActiveSection = () => {
        const marker = window.scrollY + window.innerHeight * 0.56;
        let current: string | null = null;

        trackedSections.forEach(({ key, section }) => {
          const sectionTop =
            section.getBoundingClientRect().top + window.scrollY;
          if (sectionTop <= marker) current = key;
        });

        if (current === lastActive) return;
        lastActive = current;
        setActiveSection(current);
      };

      ScrollTrigger.create({
        start: 0,
        end: "max",
        onRefresh: updateActiveSection,
        onUpdate: updateActiveSection,
      });
      updateActiveSection();
    },
    { scope: shellRef },
  );

  // Menu reveal uses one clipped plane + staggered links. The CSS owns the
  // initial closed state so there is no flash before hydration.
  useGSAP(
    () => {
      const panel = panelRef.current;
      if (!panel) return;

      const links = Array.from(
        panel.querySelectorAll<HTMLElement>(".mobile-nav-link"),
      );

      if (shouldUseStaticLanding()) {
        gsap.set(panel, {
          autoAlpha: isMenuOpen ? 1 : 0,
          clipPath: isMenuOpen ? "inset(0% 0 0 0)" : "inset(0 0 100% 0)",
          pointerEvents: isMenuOpen ? "auto" : "none",
        });
        gsap.set(links, { autoAlpha: isMenuOpen ? 1 : 0, y: 0 });
        return;
      }

      const timeline = gsap.timeline({ defaults: { ease: "cinematic" } });
      if (isMenuOpen) {
        gsap.set(panel, { pointerEvents: "auto" });
        timeline
          .to(panel, {
            autoAlpha: 1,
            clipPath: "inset(0% 0 0 0)",
            duration: 0.72,
          })
          .fromTo(
            links,
            { autoAlpha: 0, yPercent: 80 },
            { autoAlpha: 1, yPercent: 0, duration: 0.68, stagger: 0.07 },
            0.18,
          );
      } else {
        timeline
          .to(links, {
            autoAlpha: 0,
            yPercent: -30,
            duration: 0.2,
            stagger: 0.025,
            ease: "power2.in",
          })
          .to(
            panel,
            {
              autoAlpha: 0,
              clipPath: "inset(0 0 100% 0)",
              pointerEvents: "none",
              duration: 0.46,
            },
            0.08,
          );
      }
    },
    { dependencies: [isMenuOpen], revertOnUpdate: true, scope: shellRef },
  );

  const navigateFromMenu = (
    event: MouseEvent<HTMLAnchorElement>,
    href: string,
  ) => {
    handleAnchorClick(event, href);
    setIsMenuOpen(false);
  };

  return (
    <header className="landing-nav-shell" ref={shellRef}>
      <nav
        className={`nav fixed top-0 left-0 z-[100] flex w-full items-center justify-between px-[4vw] py-[2vw] text-white [mix-blend-mode:difference] max-[640px]:px-[22px] max-[640px]:py-[22px] ${isMenuOpen ? "is-menu-open" : ""}`}
        aria-label="Điều hướng chính"
      >
        <a
          href={homeHref}
          className="nav-link font-vietnam hover-target inline-block shrink-0 whitespace-nowrap text-sm font-medium tracking-[0.2em] uppercase no-underline will-change-transform max-[640px]:text-[11px]"
          data-cursor="Lên đầu"
          onClick={(event) => handleAnchorClick(event, homeHref)}
        >
          {siteConfig.name}
        </a>

        <div className="font-vietnam flex shrink-0 gap-[3vw] max-[1024px]:hidden">
          {navItems.map((item) => (
            <MagneticLink
              href={item.href}
              className="nav-link hover-target inline-block shrink-0 whitespace-nowrap text-xs tracking-[0.1em] uppercase no-underline will-change-transform"
              data-cursor={item.cursor}
              isCurrent={activeSection === item.key}
              section={item.key}
              key={item.key}
            >
              {item.label}
            </MagneticLink>
          ))}
        </div>

        <div className="flex items-center gap-4 max-[640px]:gap-3">
          {showOrderCta ? (
            <MagneticLink
              href={sectionHref("order")}
              className="nav-link nav-cta hover-target font-vietnam inline-block shrink-0 whitespace-nowrap text-xs tracking-[0.1em] uppercase no-underline will-change-transform max-[640px]:text-[10px]"
              data-cursor="Liên hệ"
            >
              Tư Vấn
            </MagneticLink>
          ) : null}
          <button
            type="button"
            className="nav-menu-button hidden h-10 w-10 items-center justify-center rounded-full border border-current/25 bg-transparent text-current max-[1024px]:inline-flex"
            aria-controls="landing-mobile-menu"
            aria-expanded={isMenuOpen}
            aria-label={isMenuOpen ? "Đóng menu" : "Mở menu"}
            onClick={() => setIsMenuOpen((value) => !value)}
          >
            {isMenuOpen ? (
              <X aria-hidden="true" size={18} strokeWidth={1.5} />
            ) : (
              <Menu aria-hidden="true" size={18} strokeWidth={1.5} />
            )}
          </button>
        </div>
      </nav>

      <div
        className="mobile-nav-panel invisible fixed inset-0 z-[90] flex flex-col justify-end bg-[var(--text-color)] px-[7vw] pt-28 pb-[8vh] text-[var(--bg-color)] opacity-0 [clip-path:inset(0_0_100%_0)]"
        id="landing-mobile-menu"
        ref={panelRef}
        aria-hidden={!isMenuOpen}
        inert={!isMenuOpen}
      >
        <div className="mb-auto font-vietnam text-[10px] tracking-[0.2em] text-current/55 uppercase">
          Khám phá {siteConfig.name}
        </div>
        <div className="flex flex-col border-t border-current/18">
          {navItems.map((item, index) => (
            <a
              href={item.href}
              className="mobile-nav-link flex items-baseline justify-between border-b border-current/18 py-5 font-playfair text-[clamp(38px,11vw,64px)] leading-none text-current no-underline"
              aria-current={activeSection === item.key ? "location" : undefined}
              onClick={(event) => navigateFromMenu(event, item.href)}
              key={item.key}
            >
              <span>{item.label}</span>
              <span className="font-vietnam text-[10px] tracking-[0.16em] text-current/45">
                0{index + 1}
              </span>
            </a>
          ))}
          {showOrderCta ? (
            <a
              href={sectionHref("order")}
              className="mobile-nav-link mt-6 inline-flex min-h-12 items-center justify-between rounded-lg bg-brand px-5 font-vietnam text-[12px] font-semibold tracking-[0.12em] text-black uppercase no-underline"
              onClick={(event) => navigateFromMenu(event, sectionHref("order"))}
            >
              <span>Tư vấn kích thước</span>
              <span aria-hidden="true">↘</span>
            </a>
          ) : null}
        </div>
      </div>
    </header>
  );
}
