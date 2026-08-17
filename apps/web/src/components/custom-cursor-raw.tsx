import { useEffect, useRef } from "react";

type CursorLabelTarget = HTMLElement & {
  __cursorLabelBound?: boolean;
};

const INTERACTIVE_SELECTOR =
  ".hover-target, a, button, [role='button'], input, textarea, select, summary, [data-cursor]";

export function CustomCursorRaw() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const cursor = cursorRef.current;
    const cursorText = textRef.current;
    if (!cursor || !cursorText) return;

    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    if (coarsePointer) {
      cursor.style.display = "none";
      return;
    }

    document.body.classList.add("has-custom-cursor");

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let cursorX = mouseX;
    let cursorY = mouseY;
    let rafId = 0;

    const setLabel = (label: string) => {
      cursorText.textContent = label;
      cursor.classList.add("has-text");
      cursor.classList.remove("hovering");
    };

    const setHover = () => {
      cursorText.textContent = "";
      cursor.classList.remove("has-text");
      cursor.classList.add("hovering");
    };

    const clearHover = () => {
      cursorText.textContent = "";
      cursor.classList.remove("has-text", "hovering");
    };

    const onMouseMove = (event: MouseEvent) => {
      mouseX = event.clientX;
      mouseY = event.clientY;
    };

    const raf = () => {
      cursorX += (mouseX - cursorX) * 0.14;
      cursorY += (mouseY - cursorY) * 0.14;
      cursor.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0)`;
      rafId = window.requestAnimationFrame(raf);
    };

    const onMouseOver = (event: MouseEvent) => {
      const target = (event.target as Element | null)?.closest(
        INTERACTIVE_SELECTOR,
      ) as HTMLElement | null;
      if (!target || cursor.contains(target)) return;

      const label = target.getAttribute("data-cursor");
      if (label) setLabel(label);
      else setHover();
    };

    const onMouseOut = (event: MouseEvent) => {
      const target = (event.target as Element | null)?.closest(
        INTERACTIVE_SELECTOR,
      ) as HTMLElement | null;
      if (!target) return;

      const related = event.relatedTarget as Node | null;
      if (related && target.contains(related)) return;
      clearHover();
    };

    const cleanupLabelListeners: Array<() => void> = [];

    const bindLabelTargets = () => {
      document
        .querySelectorAll<CursorLabelTarget>("[data-cursor]")
        .forEach((target) => {
          if (target.__cursorLabelBound) return;
          target.__cursorLabelBound = true;

          const onEnter = () => {
            const label = target.getAttribute("data-cursor");
            if (label) setLabel(label);
          };
          const onLeave = clearHover;

          target.addEventListener("mouseenter", onEnter);
          target.addEventListener("mouseleave", onLeave);
          cleanupLabelListeners.push(() => {
            target.removeEventListener("mouseenter", onEnter);
            target.removeEventListener("mouseleave", onLeave);
            target.__cursorLabelBound = false;
          });
        });
    };

    bindLabelTargets();

    const observer = new MutationObserver(bindLabelTargets);
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseover", onMouseOver);
    document.addEventListener("mouseout", onMouseOut);
    rafId = window.requestAnimationFrame(raf);

    return () => {
      observer.disconnect();
      cleanupLabelListeners.forEach((cleanup) => cleanup());
      window.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseover", onMouseOver);
      document.removeEventListener("mouseout", onMouseOut);
      window.cancelAnimationFrame(rafId);
      document.body.classList.remove("has-custom-cursor");
    };
  }, []);

  return (
    <div
      className="cursor pointer-events-none fixed top-0 left-0 z-[10000] [mix-blend-mode:difference]"
      id="cursor"
      ref={cursorRef}
    >
      <div className="cursor-dot absolute h-3 w-3 rounded-full bg-white -translate-x-1/2 -translate-y-1/2 [transition:width_0.3s_var(--ease-out-expo),height_0.3s_var(--ease-out-expo),background-color_0.3s]" />
      <div
        className="cursor-text font-vietnam absolute -translate-x-1/2 -translate-y-1/2 text-[10px] font-medium tracking-[0.1em] text-black uppercase opacity-0 whitespace-nowrap [transition:opacity_0.3s]"
        ref={textRef}
      />
    </div>
  );
}
