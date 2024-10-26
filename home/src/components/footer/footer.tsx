// "use client";

// import Link from "next/link";

import { footer } from "@/config/site";
import { ExpandableCard } from "@/components/animation/expandable-card";
import {Link} from "@nextui-org/react";

export default function Footer() {
  return (
    <footer className="justify-end">
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-primary">
              Địa chỉ của chúng tôi
            </h2>
            <div className="space-x-4">
              <ExpandableCard />
            </div>
          </div>
          <div className="h-64 md:h-full min-h-[250px]">
            <iframe
              src={footer.map}
              title={"Rèm Việt Google Map"}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen={false}
              aria-hidden="true"
            />
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-muted-foreground/20">
          <div className="flex flex-wrap justify-between items-center">
            <nav className="space-x-4 mb-4 md:mb-0">
              {footer.navItems.map((item) => (
                <Link
                  key={item.href}
                  className="hover:underline"
                  href={item.href}
                >
                  {item.name}
                </Link>
              ))}
            </nav>
            <p className="text-sm">
              &copy; {new Date().getFullYear()} {footer.brand}.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
