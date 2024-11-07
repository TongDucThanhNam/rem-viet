import React from "react";
import NextImage from "next/image";

import { IconSvgProps } from "@/types";
import remviet from "/public/src/remviet2.webp";

interface Props {
  size?: number;
  width?: number;
  height?: number;
}

export const RemVietIcon: React.FC<IconSvgProps> = ({
  size = 32,
  width,
  height,
}) => {
  return (
    <NextImage
      role={"img"}
      alt={"Rem Viet"}
      priority={true}
      height={size}
      src={remviet}
      width={size}
    />
  );
};
