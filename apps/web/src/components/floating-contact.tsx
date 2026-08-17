import { MessageCircle, Phone, Store } from "lucide-react";

import { ZaloIcon } from "@/components/legacy-icons";
import { useSiteChrome } from "@/hooks/use-site-chrome";
import { formatPhoneHref, type SiteChromeData } from "@/lib/site-chrome";

const baseButtonClass =
  "grid size-12 place-items-center rounded-full border shadow-lg shadow-black/15 outline-none transition-all duration-300 ease-in-out hover:scale-110 focus-visible:scale-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:size-14 animate-bounce";

type FloatingContactProps = {
  initialChrome?: SiteChromeData;
};

export default function FloatingContact({
  initialChrome,
}: FloatingContactProps) {
  const { settings } = useSiteChrome(initialChrome);
  const zaloHref = settings.socials.zalo
    ? `${settings.socials.zalo}?text=${encodeURIComponent("Hello Zalo")}`
    : "";
  const actions = [
    {
      label: "Call us",
      href: formatPhoneHref(settings.phone),
      icon: Phone,
      className:
        "border-primary/20 bg-primary text-primary-foreground hover:bg-primary/90",
    },
    {
      label: "Chat on Zalo",
      href: zaloHref,
      icon: ZaloIcon,
      className: "border-sky-500/20 bg-sky-500 text-white hover:bg-sky-600",
    },
    {
      label: "Facebook",
      href: settings.socials.facebook,
      icon: MessageCircle,
      className: "border-blue-600/20 bg-blue-600 text-white hover:bg-blue-700",
    },
    {
      label: "Shopee",
      href: settings.socials.shopee,
      icon: Store,
      className:
        "border-orange-500/20 bg-orange-500 text-white hover:bg-orange-600",
    },
  ].filter((action) => action.href && !action.href.startsWith("?"));

  return (
    <nav
      aria-label="Liên hệ nhanh"
      className="fixed right-3 bottom-4 z-50 flex flex-col items-end gap-3 sm:right-5 sm:bottom-6"
    >
      {actions.map((action) => {
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
