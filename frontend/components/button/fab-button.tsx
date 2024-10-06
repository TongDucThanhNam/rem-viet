"use client";

import { Button, cn } from "@nextui-org/react";
import React from "react";
import { SolarPhoneCallingBold, ZaloIcon } from "@/components/icons/icons";
import { fab } from "@/config/site";

export const FabButton = () => {
  const handlePhoneClick = () => {
    window.location.href = `tel:${fab.phone}`; // Thay số điện thoại
  };

  const shareToZalo = (message: string | number | boolean) => {
    const url = fab.zalo; // Thay thế bằng URL Zalo của bạn
    const encodedMessage = encodeURIComponent(message);
    window.open(`${url}?text=${encodedMessage}`, "_blank");
  };

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 md:bottom-8 md:right-8 flex flex-col items-end space-y-4">
      <Button
        aria-label="Call us"
        isIconOnly={true}
        onClick={handlePhoneClick}
        className={cn(
          "w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-lg",
          "transition-all duration-300 ease-in-out",
          "hover:scale-110 focus:scale-110",
          "animate-bounce",
        )}
      >
        <SolarPhoneCallingBold className="w-6 h-6 sm:w-7 sm:h-7" />
      </Button>

      <Button
        isIconOnly={true}
        aria-label="Chat on Zalo"
        onClick={() => shareToZalo("Hello Zalo")}
        className={cn(
          "w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-lg",
          "bg-blue-500 hover:bg-blue-600",
          "transition-all duration-300 ease-in-out",
          "hover:scale-110 focus:scale-110",
          "animate-bounce",
        )}
      >
        <ZaloIcon className="w-6 h-6 sm:w-7 sm:h-7" />
      </Button>
    </div>
  );
};
