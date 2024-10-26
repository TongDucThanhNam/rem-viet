import type {FC} from 'react';
import React from "react";

import type {IconSvgProps} from "@/types";
// import remviet from "@/public/src/remviet2.webp";
import {Image} from "@nextui-org/react";


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
            role={"img"}
            alt={"Rem Viet"}
            height={size}
            src={""}
            width={size}
        />
    );
};
