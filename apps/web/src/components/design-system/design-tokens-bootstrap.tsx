import { useEffect } from "react";

import { designTokenStorageKeys } from "@/hooks/use-persisted-editor-state";

/**
 * Mounted once at the top of `/admin/design-system`. Reads all 5 token
 * keys from localStorage and applies them as CSS custom properties on
 * `:root` so the rest of the admin shell (sidebar, headers, panels)
 * picks up the live values without a rebuild.
 *
 * Pure client-side — does not affect landing page tokens (those are
 * owned by `:root[data-theme="dark|light"]` in `landing.css`).
 */
export function DesignTokensBootstrap() {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }
    const root = document.documentElement;

    const applyFromStorage = () => {
      // Spacing
      try {
        const spacingRaw = window.localStorage.getItem(
          designTokenStorageKeys.spacing,
        );
        if (spacingRaw) {
          const spacing = JSON.parse(spacingRaw) as Partial<{
            baseSize: number;
            minRatio: number;
            scaleRatio: number;
          }>;
          if (typeof spacing.baseSize === "number") {
            root.style.setProperty("--spacing-base", `${spacing.baseSize}px`);
          }
          const ratio =
            typeof spacing.scaleRatio === "number"
              ? spacing.scaleRatio
              : typeof spacing.minRatio === "number"
                ? spacing.minRatio
                : null;
          if (ratio !== null) {
            root.style.setProperty("--spacing-ratio", String(ratio));
          }
        }
      } catch {
        /* ignore malformed */
      }

      // Typography
      try {
        const typoRaw = window.localStorage.getItem(
          designTokenStorageKeys.typography,
        );
        if (typoRaw) {
          const typo = JSON.parse(typoRaw) as Partial<{
            fontFamily: string;
            baseSize: number;
          }>;
          if (typeof typo.fontFamily === "string") {
            root.style.setProperty("--font-sans", typo.fontFamily);
          }
          if (typeof typo.baseSize === "number") {
            root.style.setProperty("--font-size-base", `${typo.baseSize}px`);
          }
        }
      } catch {
        /* ignore */
      }

      // Colors
      try {
        const colorsRaw = window.localStorage.getItem(
          designTokenStorageKeys.colors,
        );
        if (colorsRaw) {
          const colors = JSON.parse(colorsRaw) as Record<string, string>;
          // Map known keys (bg/panel/border/text/muted/accent) to admin vars.
          if (typeof colors.bg === "string") {
            root.style.setProperty("--admin-canvas", colors.bg);
          }
          if (typeof colors.panel === "string") {
            root.style.setProperty("--admin-panel", colors.panel);
          }
          if (typeof colors.border === "string") {
            root.style.setProperty("--admin-border", colors.border);
          }
          if (typeof colors.text === "string") {
            root.style.setProperty("--admin-text", colors.text);
          }
          if (typeof colors.muted === "string") {
            root.style.setProperty("--admin-text-muted", colors.muted);
          }
          if (typeof colors.accent === "string") {
            root.style.setProperty("--admin-accent", colors.accent);
          }
        }
      } catch {
        /* ignore */
      }

      // Radii
      try {
        const radiiRaw = window.localStorage.getItem(
          designTokenStorageKeys.radii,
        );
        if (radiiRaw) {
          const radii = JSON.parse(radiiRaw) as Array<{ key: string; value: number }>;
          for (const r of radii) {
            root.style.setProperty(`--radius-${r.key}`, `${r.value}px`);
          }
        }
      } catch {
        /* ignore */
      }

      // Shadows
      try {
        const shadowsRaw = window.localStorage.getItem(
          designTokenStorageKeys.shadows,
        );
        if (shadowsRaw) {
          const shadows = JSON.parse(shadowsRaw) as Array<{ key: string; value: string }>;
          for (const s of shadows) {
            root.style.setProperty(`--shadow-${s.key}`, s.value);
          }
        }
      } catch {
        /* ignore */
      }
    };

    applyFromStorage();

    // Re-apply on storage events from other tabs / windows.
    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key.startsWith("rem-viet:design-tokens:")) {
        applyFromStorage();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return null;
}
