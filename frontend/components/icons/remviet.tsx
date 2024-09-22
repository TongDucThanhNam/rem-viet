import React from "react";
import { IconSvgProps } from "@/types";
import NextImage from "next/image";
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
    <NextImage src={remviet} alt={"Rem Viet"} width={size} height={size} />
  );
};
