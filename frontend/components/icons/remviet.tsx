import React from "react";
import NextImage from "next/image";

import { IconSvgProps } from "@/types";
import remviet from "@/public/src/remviet2.webp";

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
      priority={true}
      fetchPriority={"high"}
      loading={"eager"}
      unselectable={"on"}
      decoding={"sync"}
      role={"img"}
      alt={"Rem Viet"}
      height={size}
      src={remviet}
      width={size}
    />
  );
};
