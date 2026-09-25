import { useCallback, useEffect, useState } from "react";

/**
 * Generic localStorage-backed editor state. Used by design-system editors
 * to persist user tweaks across reloads (admin-only, ephemeral).
 *
 * The companion `<DesignTokensBootstrap />` reads all registered keys
 * and applies CSS vars to `:root` so the rest of the admin shell picks
 * them up.
 */
export function usePersistedEditorState<T>(
  storageKey: string,
  defaultValue: T,
): readonly [T, (next: T | ((prev: T) => T)) => void, () => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return defaultValue;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw === null) return defaultValue;
      return JSON.parse(raw) as T;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      /* quota / private mode — silent */
    }
  }, [storageKey, value]);

  const reset = useCallback(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  return [value, setValue, reset] as const;
}

const TOKEN_STORAGE_PREFIX = "rem-viet:design-tokens:";

export const designTokenStorageKeys = {
  spacing: `${TOKEN_STORAGE_PREFIX}spacing`,
  typography: `${TOKEN_STORAGE_PREFIX}typography`,
  colors: `${TOKEN_STORAGE_PREFIX}colors`,
  radii: `${TOKEN_STORAGE_PREFIX}radii`,
  shadows: `${TOKEN_STORAGE_PREFIX}shadows`,
} as const;
