"use client";

import { Button, Spacer } from "@nextui-org/react";
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
    <div className={"fixed bottom-20 right-10 p-0 "}>
      <Button size={"lg"} isIconOnly onClick={handlePhoneClick}>
        <SolarPhoneCallingBold />
      </Button>

      <Spacer y={3} />

      <Button
        color={"primary"}
        size={"lg"}
        isIconOnly
        onClick={() => shareToZalo("Hello Zalo")}
      >
        <ZaloIcon />
      </Button>

      <Spacer x={1} />
    </div>
  );
};
