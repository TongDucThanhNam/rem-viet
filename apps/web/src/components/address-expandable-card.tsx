import { Button } from "@rem-viet/ui/components/button";
import { ExternalLink, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { siteConfig } from "@/lib/site-config";

const addressCard = {
  title: "Cửa hàng lưới chống muỗi",
  description: "ĐC: 831 Đ. Âu Cơ, Tân Thành, Tân Phú",
  image: "/src/remviet2.webp",
  href: siteConfig.links.facebook,
  content:
    "831 Đ. Âu Cơ, Tân Thành, Tân Phú, Hồ Chí Minh 70000. Cửa hàng chuyên cung cấp các loại rèm, lưới chống côn trùng, chất lượng tốt nhất thị trường.",
};

export default function AddressExpandableCard() {
  const [isOpen, setIsOpen] = useState(false);
  const dialogId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", onKeyDown);
    }

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  function closeOnBackdrop(event: React.MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      setIsOpen(false);
    }
  }

  return (
    <>
      <button
        aria-controls={dialogId}
        aria-expanded={isOpen}
        className="group grid w-full max-w-2xl cursor-pointer gap-3 rounded-lg p-4 text-left transition hover:bg-muted/70"
        type="button"
        onClick={() => setIsOpen(true)}
      >
        <img
          alt={addressCard.title}
          className="h-60 w-full rounded-lg object-cover object-top"
          loading="lazy"
          src={addressCard.image}
        />
        <span className="grid gap-1 text-center md:text-left">
          <span className="text-base font-medium text-foreground">
            {addressCard.title}
          </span>
          <span className="text-base text-muted-foreground">
            {addressCard.description}
          </span>
        </span>
      </button>

      {isOpen ? (
        <div
          aria-labelledby={`${dialogId}-title`}
          aria-modal="true"
          className="fixed inset-0 z-[100] grid place-items-center bg-black/20 p-0 sm:p-4"
          id={dialogId}
          role="dialog"
          onMouseDown={closeOnBackdrop}
        >
          <div
            ref={dialogRef}
            className="relative flex h-full w-full max-w-[500px] flex-col overflow-hidden bg-background shadow-2xl sm:h-fit sm:max-h-[90svh] sm:rounded-lg"
          >
            <Button
              aria-label="Đóng"
              className="absolute right-2 top-2 z-10 rounded-full bg-background/90"
              size="icon-sm"
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
            >
              <X aria-hidden className="size-4" />
            </Button>

            <img
              alt={addressCard.title}
              className="h-80 w-full object-cover object-top"
              src={addressCard.image}
            />

            <div className="grid gap-4 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3
                    className="text-base font-medium text-foreground"
                    id={`${dialogId}-title`}
                  >
                    {addressCard.title}
                  </h3>
                  <p className="mt-1 text-base text-muted-foreground">
                    {addressCard.description}
                  </p>
                </div>
                <a
                  className="inline-flex shrink-0 items-center gap-2 rounded-full bg-green-500 px-4 py-3 text-sm font-bold text-white hover:bg-green-600"
                  href={addressCard.href}
                  rel="noreferrer"
                  target="_blank"
                >
                  Liên hệ
                  <ExternalLink aria-hidden className="size-4" />
                </a>
              </div>

              <p className="max-h-40 overflow-auto pb-6 text-sm leading-6 text-muted-foreground">
                {addressCard.content}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
