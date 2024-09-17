import {NavbarMenu, NavbarMenuItem} from "@nextui-org/navbar";
import {siteConfig} from "@/config/site";
import React from "react";
import {Link} from "@nextui-org/react";

export const NavbarMenuItems = () => {
    return (
        <>
            <NavbarMenu
                className="top-[calc(var(--navbar-height)_-_1px)] max-h-[70vh] bg-default-200/50 pt-6 shadow-medium backdrop-blur-md backdrop-saturate-150 dark:bg-default-100/50"
                motionProps={{
                    initial: {opacity: 0, y: -20},
                    animate: {opacity: 1, y: 0},
                    exit: {opacity: 0, y: -20},
                    transition: {
                        ease: "easeInOut",
                        duration: 0.2,
                    },
                }}
            >
                {siteConfig.navItems.map((item, index) => (
                    <NavbarMenuItem key={`${item}-${index}`}>
                        <Link className="w-full text-default-500" href="#" size="md">
                            {item.href}
                        </Link>
                    </NavbarMenuItem>
                ))}
            </NavbarMenu>
        </>
    )
}
