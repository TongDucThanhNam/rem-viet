"use client";

import {Button, Spacer,} from "@nextui-org/react";
import React from "react";
import FacebookIcon, {SolarPhoneCallingBold, ZaloIcon} from "@/components/icons/icons";


export const FabButton = () => {
    const handlePhoneClick = () => {
        window.location.href = 'tel:0986207619'; // Thay số điện thoại
    };

    const shareToZalo = (message: string | number | boolean) => {
        const url = `https://zalo.me/84949491964`; // Thay thế bằng URL Zalo của bạn
        const encodedMessage = encodeURIComponent(message);
        window.open(`${url}?text=${encodedMessage}`, '_blank');
    };

    return (
        <div className={"fixed bottom-20 right-10 p-0 "}
        >
            <Button
                isIconOnly
                onClick={handlePhoneClick}
            >
                <SolarPhoneCallingBold/>
            </Button>

            <Spacer x={1}/>

            <Button
                color={"primary"}
                isIconOnly
                onClick={() => shareToZalo("Hello Zalo")}
            >
                <ZaloIcon/>
            </Button>

            <Spacer x={1}/>

            <Button isIconOnly
                    onClick={() => window.open('https://www.facebook.com/profile.php?id=100076172431695', '_blank')}
            >
                <FacebookIcon/>
            </Button>
        </div>
    );
};
