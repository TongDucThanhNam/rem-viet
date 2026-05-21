import { Phone } from "lucide-react";

import { ZaloIcon } from "@/components/legacy-icons";
import { siteConfig } from "@/lib/site-config";

const baseButtonClass =
  "grid size-12 place-items-center rounded-full border shadow-lg shadow-black/15 outline-none transition-all duration-300 ease-in-out hover:scale-110 focus-visible:scale-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:size-14 animate-bounce";

const contactActions = [
  {
    label: "Call us",
    href: formatPhoneHref(siteConfig.links.phone),
    icon: Phone,
    className:
      "border-primary/20 bg-primary text-primary-foreground hover:bg-primary/90",
  },
  {
    label: "Chat on Zalo",
    href: `${siteConfig.links.zalo}?text=${encodeURIComponent(
      "Hello Zalo",
    )}`,
    icon: ZaloIcon,
    className: "border-sky-500/20 bg-sky-500 text-white hover:bg-sky-600",
  },
] as const;

export default function FloatingContact() {
  return (
    <nav
      aria-label="Liên hệ nhanh"
      className="fixed right-3 bottom-4 z-50 flex flex-col items-end gap-3 sm:right-5 sm:bottom-6"
    >
      {contactActions.map((action) => {
        const Icon = action.icon;

        return (
          <a
            key={action.label}
            aria-label={action.label}
            className={`${baseButtonClass} ${action.className}`}
            href={action.href}
            rel={action.href.startsWith("http") ? "noreferrer" : undefined}
            target={action.href.startsWith("http") ? "_blank" : undefined}
            title={action.label}
          >
            <Icon aria-hidden className="size-5 sm:size-6" />
            <span className="sr-only">{action.label}</span>
          </a>
        );
      })}
    </nav>
  );
}

function formatPhoneHref(phone: string) {
  if (phone.startsWith("+")) {
    return `tel:${phone}`;
  }

  if (phone.startsWith("0")) {
    return `tel:+84${phone.slice(1)}`;
  }

  return `tel:${phone}`;
}
