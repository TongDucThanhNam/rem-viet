import type {FC} from 'react';
import React from "react";

import type {IconSvgProps} from "@/types";
// import remviet from "@/public/src/remviet2.webp";
import {Image} from "@nextui-org/image";


interface Props {
    size?: number;
    width?: number;
    height?: number;
}

export const RemVietIcon: FC<IconSvgProps> = ({
                                                  size = 32,
                                                  width,
                                                  height,
                                              }) => {
    return (
        <Image
            aria-label="Rèm Việt"
            role={"img"}
            alt={"Rem Viet"}
            height={size}
            src={"/remviet2.webp"}
            width={size}
        />
    );
};
