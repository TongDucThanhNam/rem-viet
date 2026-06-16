import { useEffect } from "react";

/**
 * Maps section ids to the visual theme that should be active while that
 * section is centered in the viewport. The IntersectionObserver uses
 * `rootMargin: "-50% 0px -50% 0px"` so only the section that is currently
 * crossing the viewport's middle triggers — sections still entering/leaving
 * do not count.
 *
 * The theme is written to `<html data-theme="...">` so any descendant that
 * consumes `--bg-color` / `--text-color` (custom cursor, navigation, future
 * dark sections) reacts automatically via the :root[data-theme] CSS blocks
 * defined in `landing.css`.
 */
type Theme = "light" | "dark";

const SECTION_TO_THEME: Record<string, Theme> = {
  home: "light",
  threat: "dark",
  benefits: "dark",
  craft: "light",
  details: "light",
  lifestyle: "dark",
  measure: "light",
  faq: "light",
  order: "dark",
};

const ALL_SECTION_IDS = Object.keys(SECTION_TO_THEME);

export function useThemeBySection() {
  useEffect(() => {
    // Skip when running in SSR / non-DOM environments.
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const html = document.documentElement;

    // Resolve elements once. If a section is mounted after the observer
    // starts (e.g. after the loader reveals content), re-query on the fly.
    const resolveElements = (): HTMLElement[] => {
      const found: HTMLElement[] = [];
      for (const id of ALL_SECTION_IDS) {
        const el = document.getElementById(id);
        if (el) found.push(el);
      }
      return found;
    };

    let observed: HTMLElement[] = resolveElements();
    if (observed.length === 0) return;

    let lastTheme: Theme | null = null;
    const applyTheme = (theme: Theme) => {
      if (lastTheme === theme) return;
      lastTheme = theme;
      html.dataset.theme = theme;
    };

    // Initial state: light. The page starts on a light hero so a flicker
    // to dark before mount would be wrong.
    applyTheme("light");

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry whose intersectionRatio is highest. With the
        // -50%/-50% rootMargin, typically only one entry is intersecting
        // at any given moment — but picking the highest ratio is robust
        // during the moment two sections straddle the band.
        let bestId: string | null = null;
        let bestRatio = 0;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = (entry.target as HTMLElement).id;
          if (entry.intersectionRatio > bestRatio) {
            bestRatio = entry.intersectionRatio;
            bestId = id;
          }
        }
        if (!bestId) return;
        const theme = SECTION_TO_THEME[bestId];
        if (theme) applyTheme(theme);
      },
      {
        // Section must cross the viewport's middle horizontal band to be
        // considered "active". This avoids half-active states while a
        // section is still scrolling into view.
        rootMargin: "-50% 0px -50% 0px",
        threshold: [0, 0.01, 0.5, 1],
      },
    );

    for (const el of observed) observer.observe(el);

    // Re-query on DOM mutations so sections that mount later (e.g. after
    // the loader is dismissed) are picked up.
    const mutation = new MutationObserver(() => {
      const next = resolveElements();
      if (next.length === observed.length) return;
      // Disconnect and rebind. Cheap because there are <10 sections.
      observer.disconnect();
      observed = next;
      for (const el of observed) observer.observe(el);
    });
    mutation.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutation.disconnect();
    };
  }, []);
}
