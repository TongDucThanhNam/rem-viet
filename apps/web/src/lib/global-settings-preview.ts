import type { SiteChromeData } from "@/lib/site-chrome";

export const globalSettingsPreviewMessageType =
  "cms:global-settings-preview" as const;
export const globalSettingsPreviewReadyMessageType =
  "cms:global-settings-preview-ready" as const;

export type GlobalSettingsPreviewMessage = {
  type: typeof globalSettingsPreviewMessageType;
  chrome: SiteChromeData;
};

export function createGlobalSettingsPreviewMessage(
  chrome: SiteChromeData,
): GlobalSettingsPreviewMessage {
  return { type: globalSettingsPreviewMessageType, chrome };
}

function isMenuItem(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.href === "string" &&
    typeof item.label === "string" &&
    (item.children === undefined ||
      (Array.isArray(item.children) && item.children.every(isMenuItem)))
  );
}

export function isGlobalSettingsPreviewMessage(
  value: unknown,
): value is GlobalSettingsPreviewMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  if (message.type !== globalSettingsPreviewMessageType) return false;
  if (!message.chrome || typeof message.chrome !== "object") return false;
  const chrome = message.chrome as Record<string, unknown>;
  if (!Array.isArray(chrome.headerMenu) || !chrome.headerMenu.every(isMenuItem))
    return false;
  if (!Array.isArray(chrome.footerMenu) || !chrome.footerMenu.every(isMenuItem))
    return false;
  if (!chrome.settings || typeof chrome.settings !== "object") return false;
  const settings = chrome.settings as Record<string, unknown>;
  return (
    typeof settings.address === "string" &&
    typeof settings.logo === "string" &&
    typeof settings.phone === "string" &&
    Array.isArray(settings.homepageSections) &&
    Boolean(settings.socials) &&
    typeof settings.socials === "object"
  );
}
