import type { HomepageSection, MenuItem, SiteSocials } from "@rem-viet/cms";

import { siteConfig } from "@/lib/site-config";

export type PublicSiteSettings = {
  address: string;
  homepageSections: HomepageSection[];
  logo: string;
  phone: string;
  socials: SiteSocials & Record<string, string>;
};

export type PublicMenuItem = {
  children?: PublicMenuItem[];
  href: string;
  label: string;
  order?: number;
};

export type SiteChromeData = {
  footerMenu: PublicMenuItem[];
  headerMenu: PublicMenuItem[];
  settings: PublicSiteSettings;
};

type CmsSettings = Partial<{
  address: string | null;
  homepageSections: HomepageSection[] | null;
  logo: string | null;
  phone: string | null;
  socials: (SiteSocials & Record<string, string>) | null;
}>;

type CmsMenu = Partial<{
  items: MenuItem[] | null;
  location: string;
}>;

const fallbackSocials: PublicSiteSettings["socials"] = {
  facebook: siteConfig.links.facebook,
  instagram: "",
  shopee: siteConfig.links.shopee,
  tiktok: "",
  youtube: "",
  zalo: siteConfig.links.zalo,
};

const fallbackSettings: PublicSiteSettings = {
  address: siteConfig.footer.address,
  homepageSections: [],
  logo: "/src/remviet2.webp",
  phone: siteConfig.links.phone,
  socials: fallbackSocials,
};

function configHref(item: { href?: unknown; to?: unknown }) {
  if (typeof item.href === "string") {
    return item.href;
  }

  if (typeof item.to === "string") {
    return item.to;
  }

  return "/";
}

const fallbackHeaderMenu: PublicMenuItem[] = siteConfig.navItems.map(
  (item, index) => ({
    href: configHref(item),
    label: item.label,
    order: index,
  }),
);

const fallbackFooterMenu: PublicMenuItem[] = siteConfig.footer.navItems.map(
  (item, index) => ({
    href: configHref(item),
    label: item.label,
    order: index,
  }),
);

function nonBlank(value?: string | null) {
  return value?.trim() || undefined;
}

function normalizeMenuItem(item: MenuItem): PublicMenuItem | null {
  const href = nonBlank(item.href);
  const label = nonBlank(item.label);

  if (!href || !label) {
    return null;
  }

  const children = item.children
    ?.map(normalizeMenuItem)
    .filter((child): child is PublicMenuItem => Boolean(child));

  return {
    href,
    label,
    order: item.order,
    ...(children?.length ? { children } : {}),
  };
}

function normalizeMenu(items?: MenuItem[] | null, fallback: PublicMenuItem[] = []) {
  const normalized =
    items
      ?.map(normalizeMenuItem)
      .filter((item): item is PublicMenuItem => Boolean(item))
      .sort((left, right) => (left.order ?? 0) - (right.order ?? 0)) ?? [];

  return normalized.length ? normalized : fallback;
}

function normalizeSocials(
  socials?: (SiteSocials & Record<string, string>) | null,
) {
  const normalized = { ...fallbackSocials };

  for (const [key, value] of Object.entries(socials ?? {})) {
    const href = nonBlank(value);

    if (href) {
      normalized[key] = href;
    }
  }

  return normalized;
}

export function getSiteChromeData(
  settings?: CmsSettings | null,
  menus?: CmsMenu[] | null,
): SiteChromeData {
  const headerMenu = menus?.find((menu) => menu.location === "header");
  const footerMenu = menus?.find((menu) => menu.location === "footer");

  return {
    footerMenu: normalizeMenu(footerMenu?.items, fallbackFooterMenu),
    headerMenu: normalizeMenu(headerMenu?.items, fallbackHeaderMenu),
    settings: {
      address: nonBlank(settings?.address) ?? fallbackSettings.address,
      homepageSections:
        settings?.homepageSections?.length
          ? settings.homepageSections
          : fallbackSettings.homepageSections,
      logo: nonBlank(settings?.logo) ?? fallbackSettings.logo,
      phone: nonBlank(settings?.phone) ?? fallbackSettings.phone,
      socials: normalizeSocials(settings?.socials),
    } satisfies PublicSiteSettings,
  };
}

export function formatPhoneHref(phone: string) {
  const normalized = phone.replace(/\s+/g, "");

  if (normalized.startsWith("+")) {
    return `tel:${normalized}`;
  }

  if (normalized.startsWith("0")) {
    return `tel:+84${normalized.slice(1)}`;
  }

  return `tel:${normalized}`;
}
