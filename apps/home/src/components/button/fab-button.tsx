"use client";

import React, { useCallback, useMemo } from "react";
import { Button } from "@nextui-org/react";
import { SolarPhoneCallingBold, ZaloIcon } from "@/components/icons/icons";
import { fab } from "@/config/site";

interface FABButtonProps {
  phoneNumber?: string;
  zaloUrl?: string;
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  showPhone?: boolean;
  showZalo?: boolean;
  className?: string;
}

const BASE_BUTTON_CLASSES = [
  "w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-lg",
  "transition-all duration-300 ease-in-out",
  "hover:scale-110 focus:scale-110",
  "animate-bounce",
] as const;

const POSITION_CLASSES = {
  "bottom-right":
    "bottom-4 right-4 sm:bottom-6 sm:right-6 md:bottom-8 md:right-8",
  "bottom-left": "bottom-4 left-4 sm:bottom-6 sm:left-6 md:bottom-8 md:left-8",
  "top-right": "top-4 right-4 sm:top-6 sm:right-6 md:top-8 md:right-8",
  "top-left": "top-4 left-4 sm:top-6 sm:left-6 md:top-8 md:left-8",
} as const;

export default function FABButton({
  phoneNumber = fab.phone,
  zaloUrl = fab.zalo,
  position = "bottom-right",
  showPhone = true,
  showZalo = true,
  className = "",
}: FABButtonProps) {
  const handlePhoneClick = useCallback(() => {
    const formattedNumber = phoneNumber.startsWith("+")
      ? phoneNumber
      : `+84${phoneNumber}`;

    window.location.href = `tel:${formattedNumber}`;
  }, [phoneNumber]);

  const handleZaloClick = useCallback(() => {
    const message = encodeURIComponent("Hello Zalo");

    window.open(`${zaloUrl}?text=${message}`, "_blank", "noopener,noreferrer");
  }, [zaloUrl]);

  const containerClasses = useMemo(() => {
    return `fixed ${POSITION_CLASSES[position]} flex flex-col items-end space-y-4 ${className}`;
  }, [position, className]);

  const phoneButton = useMemo(
    () => (
      <Button
        aria-label="Call us"
        className={BASE_BUTTON_CLASSES.join(" ")}
        isIconOnly
        onClick={handlePhoneClick}
      >
        <SolarPhoneCallingBold className="w-6 h-6 sm:w-7 sm:h-7" />
        <span className="sr-only">Call us</span>
      </Button>
    ),
    [handlePhoneClick],
  );

  const zaloButton = useMemo(
    () => (
      <Button
        aria-label="Chat on Zalo"
        className={[
          ...BASE_BUTTON_CLASSES,
          "bg-blue-500 hover:bg-blue-600",
        ].join(" ")}
        isIconOnly
        onClick={handleZaloClick}
      >
        <ZaloIcon className="w-6 h-6 sm:w-7 sm:h-7" />
        <span className="sr-only">Chat on Zalo</span>
      </Button>
    ),
    [handleZaloClick],
  );

  return (
    <div className={containerClasses}>
      {showPhone && phoneButton}
      {showZalo && zaloButton}
    </div>
  );
}
