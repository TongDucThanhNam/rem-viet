import { useRef } from "react";

import { useSiteChrome } from "@/hooks/use-site-chrome";
import { gsap, SplitText, useGSAP, prefersReducedMotion } from "@/lib/gsap";

/**
 * `#order` curtain footer — full-screen (`position: fixed; height: 100vh`)
 * revealed behind `#smooth-wrapper` as the user scrolls to the bottom.
 *
 * Because the footer is fixed and full-viewport, it is geometrically "in view"
 * the moment it mounts (it sits behind the page content until revealed). The
 * previous framer-motion `useInView` therefore fired on mount, so GSAP does the
 * same: a single mount timeline plays the SplitText title reveal + CTA +
 * bottom row. By the time the footer scrolls into view, the animation has
 * settled.
 */
export function CurtainFooter() {
  const { settings } = useSiteChrome();
  const footerRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const footer = footerRef.current;
      if (!footer) return;

      const title = footer.querySelector<HTMLElement>(".footer-cta h2");
      const cta = footer.querySelector<HTMLElement>(".massive-link");
      const bottom = footer.querySelector<HTMLElement>(".footer-bottom");

      if (prefersReducedMotion()) {
        gsap.set([title, cta], { opacity: 1, y: 0 });
        gsap.set(bottom, { opacity: 0.82, y: 0 });
        return;
      }

      const split = title
        ? new SplitText(title, { type: "lines", mask: "lines" })
        : null;

      const tl = gsap.timeline({ defaults: { ease: "expo.out" } });

      tl.from(split?.lines ?? [], { yPercent: 110, stagger: 0.12, duration: 1.2 }, 0)
        .from(cta, { opacity: 0, y: 40, duration: 1 }, 0.25)
        .fromTo(
          bottom,
          { opacity: 0, y: 20 },
          { opacity: 0.82, y: 0, duration: 1 },
          0.5,
        );
    },
    { scope: footerRef },
  );

  return (
    <footer
      className="footer curtain-footer fixed bottom-0 left-0 z-[1] flex h-dvh w-full flex-col items-center justify-center bg-[var(--text-color)] pt-[20vh] pr-[4vw] pb-[5vh] pl-[4vw] font-sans text-[var(--bg-color)] max-[1024px]:h-[70dvh]"
      id="order"
      ref={footerRef}
    >
      <div className="footer-cta font-vietnam m-0 text-center">
        <h2 className="font-playfair mb-[2vh] text-[6vw] font-normal">
          Bắt đầu
          <br />
          dự án của bạn.
        </h2>
        <a
          href="mailto:tuvan@remvina.vn"
          className="massive-link hover-target font-playfair mb-[15vh] block text-[8vw] font-normal text-[var(--accent)] italic no-underline transition-colors duration-300 hover:text-white"
          data-cursor="Đặt may"
        >
          tuvan@remvina.vn
        </a>
      </div>
      <div className="footer-bottom font-vietnam flex justify-between border-t border-white/10 pt-[3vh] text-xs tracking-[0.1em] uppercase">
        <p>&copy; 2026 Rèm Vina. Bản quyền đã được bảo hộ.</p>
        <div className="footer-socials flex gap-10">
          <a
            href={settings.socials.facebook}
            className="hover-target text-[var(--bg-color)] no-underline"
            rel="noreferrer"
            target="_blank"
            data-cursor="Mở"
          >
            Facebook
          </a>
          <a
            href={settings.socials.shopee}
            className="hover-target text-[var(--bg-color)] no-underline"
            rel="noreferrer"
            target="_blank"
            data-cursor="Mở"
          >
            Shopee
          </a>
        </div>
      </div>
    </footer>
  );
}
