import { Link } from "@tanstack/react-router";

import { siteConfig } from "@/lib/site-config";
import AddressExpandableCard from "./address-expandable-card";

export default function SiteFooter() {
  return (
    <footer className="justify-end" id="footer">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-8 md:grid-cols-2 md:py-12">
        <section className="space-y-4">
          <h2 className="text-2xl font-bold tracking-normal text-primary">
            Địa chỉ của chúng tôi
          </h2>
          <div className="space-x-4">
            <AddressExpandableCard />
          </div>
        </section>

        <div className="min-h-[250px] overflow-hidden md:h-full">
          <iframe
            allowFullScreen={false}
            aria-hidden="true"
            className="size-full"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src={siteConfig.footer.map}
            title="Rèm Việt Google Map"
          />
        </div>

        <div className="border-t border-muted-foreground/20 pt-8 text-sm md:col-span-2">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <nav className="flex flex-wrap gap-4">
              {siteConfig.footer.navItems.map((item) =>
                "to" in item && item.to ? (
                  <Link
                    className="hover:underline"
                    key={item.label}
                    to={item.to}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <a
                    className="hover:underline"
                    href={item.href}
                    key={item.label}
                  >
                    {item.label}
                  </a>
                ),
              )}
            </nav>
            <p className="text-muted-foreground">
              &copy; {new Date().getFullYear()} {siteConfig.footer.brand}.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
