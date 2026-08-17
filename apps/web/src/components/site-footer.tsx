import { Mail, Phone } from "lucide-react";

import AddressExpandableCard from "@/components/address-expandable-card";
import { useSiteChrome } from "@/hooks/use-site-chrome";
import { formatPhoneHref, type SiteChromeData } from "@/lib/site-chrome";
import { siteConfig } from "@/lib/site-config";

function isExternalHref(href: string) {
  return (
    /^(https?:)?\/\//.test(href) ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  );
}

const socialLabels: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  shopee: "Shopee",
  tiktok: "TikTok",
  youtube: "YouTube",
  zalo: "Zalo",
};

const socialOrder = [
  "facebook",
  "shopee",
  "zalo",
  "instagram",
  "youtube",
  "tiktok",
];

function visibleSocials(socials: Record<string, string>) {
  const ordered = socialOrder
    .map((key) => [key, socials[key]] as const)
    .filter(([, href]) => href?.trim());
  const extras = Object.entries(socials).filter(
    ([key, href]) => !socialOrder.includes(key) && href?.trim(),
  );

  return [...ordered, ...extras];
}

type SiteFooterProps = {
  initialChrome?: SiteChromeData;
  preferInitialChrome?: boolean;
};

export default function SiteFooter({
  initialChrome,
  preferInitialChrome = false,
}: SiteFooterProps) {
  const { footerMenu, settings } = useSiteChrome(initialChrome, {
    preferInitial: preferInitialChrome,
  });
  const socials = visibleSocials(settings.socials);

  return (
    <footer className="justify-end border-t bg-muted/20" id="footer">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-8 md:grid-cols-2 md:py-12">
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold tracking-normal text-primary">
              Địa chỉ của chúng tôi
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              {settings.address}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              className="inline-flex min-h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium hover:bg-muted"
              href={formatPhoneHref(settings.phone)}
            >
              <Phone aria-hidden className="size-4" />
              {settings.phone}
            </a>
            <a
              className="inline-flex min-h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium hover:bg-muted"
              href="mailto:hello@luoichongmuoi.shop"
            >
              <Mail aria-hidden className="size-4" />
              Email
            </a>
          </div>

          <AddressExpandableCard />
        </section>

        <div className="min-h-[250px] overflow-hidden rounded-md border bg-background md:h-full">
          <iframe
            allowFullScreen={false}
            aria-hidden="true"
            className="size-full"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src={siteConfig.footer.map}
            title={`${siteConfig.name} Google Map`}
          />
        </div>

        <div className="border-t border-muted-foreground/20 pt-8 text-sm md:col-span-2">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div className="grid gap-3">
              <nav
                aria-label="Điều hướng chân trang"
                className="flex flex-wrap gap-4"
              >
                {footerMenu.map((item) => {
                  const external = isExternalHref(item.href);

                  return (
                    <a
                      className="hover:underline"
                      href={item.href}
                      key={`${item.href}-${item.label}`}
                      rel={external ? "noreferrer" : undefined}
                      target={external ? "_blank" : undefined}
                    >
                      {item.label}
                    </a>
                  );
                })}
              </nav>
              {socials.length ? (
                <nav
                  aria-label="Mạng xã hội"
                  className="flex flex-wrap gap-3 text-xs uppercase tracking-wide text-muted-foreground"
                >
                  {socials.map(([label, href]) => (
                    <a
                      className="hover:text-foreground"
                      href={href}
                      key={label}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {socialLabels[label] ?? label}
                    </a>
                  ))}
                </nav>
              ) : null}
            </div>
            <p className="text-muted-foreground">
              &copy; {new Date().getFullYear()} {siteConfig.footer.brand}.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
