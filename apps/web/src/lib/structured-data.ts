import type { SiteManifest } from "@rem-viet/cms";

type OrganizationSettings = Partial<{
  address: string;
  logo: string;
  phone: string;
  socials: Record<string, string>;
}>;

function absoluteUrl(value: string, siteUrl: string) {
  return new URL(value, `${siteUrl}/`).href;
}

function httpSocialLinks(socials: Record<string, string>) {
  return Object.values(socials).filter((value) => {
    try {
      const protocol = new URL(value).protocol;
      return protocol === "http:" || protocol === "https:";
    } catch {
      return false;
    }
  });
}

export function buildOrganizationStructuredData(
  manifest: SiteManifest,
  settings: OrganizationSettings = {},
) {
  const sameAs = httpSocialLinks({
    ...manifest.contact.socials,
    ...settings.socials,
  });
  const address = settings.address || manifest.contact.address;
  const logo = settings.logo || manifest.brand.logo;
  const phone = settings.phone || manifest.contact.phone;

  return {
    "@context": "https://schema.org",
    "@type": manifest.preset === "catalog" ? "Store" : "Organization",
    "@id": `${manifest.siteUrl}/#organization`,
    name: manifest.name,
    url: manifest.siteUrl,
    description: manifest.description,
    logo: absoluteUrl(logo, manifest.siteUrl),
    ...(phone ? { telephone: phone } : {}),
    ...(manifest.contact.email ? { email: manifest.contact.email } : {}),
    ...(address ? { address } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
  } as const;
}

export function serializeStructuredData(value: unknown) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}
