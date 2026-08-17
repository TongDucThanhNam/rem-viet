import { describe, expect, test } from "bun:test";

import {
  createGlobalSettingsPreviewMessage,
  isGlobalSettingsPreviewMessage,
} from "./global-settings-preview";

const chrome = {
  footerMenu: [{ href: "/contact", label: "Contact", order: 0 }],
  headerMenu: [
    {
      children: [{ href: "/child", label: "Child", order: 0 }],
      href: "/",
      label: "Home",
      order: 0,
    },
  ],
  settings: {
    address: "123 Example Street",
    homepageSections: [],
    logo: "/logo.svg",
    phone: "+84 28 0000 0000",
    socials: { facebook: "https://facebook.com/example" },
  },
};

describe("global settings preview protocol", () => {
  test("accepts the exact working-copy envelope", () => {
    expect(
      isGlobalSettingsPreviewMessage(
        createGlobalSettingsPreviewMessage(chrome),
      ),
    ).toBe(true);
  });

  test("rejects malformed chrome and nested menu data", () => {
    expect(isGlobalSettingsPreviewMessage(null)).toBe(false);
    expect(
      isGlobalSettingsPreviewMessage({
        type: "cms:global-settings-preview",
        chrome: { ...chrome, headerMenu: [{ label: "Missing href" }] },
      }),
    ).toBe(false);
    expect(
      isGlobalSettingsPreviewMessage({
        type: "cms:global-settings-preview",
        chrome: { ...chrome, settings: { ...chrome.settings, phone: 123 } },
      }),
    ).toBe(false);
  });
});
