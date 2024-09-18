"use client";

import {
    cn,
    Kbd,
    Link,
    Navbar,
    NavbarBrand,
    NavbarContent,
    NavbarItem,
    NavbarMenu,
    NavbarMenuItem,
    NavbarMenuToggle,
    NavbarProps
} from "@nextui-org/react";

import React from "react";
import {Input} from "@nextui-org/input";
import {SearchIcon} from "@/components/icons/icons";
import {RemVietIcon} from "@/components/icons/remviet";
import {siteConfig} from "@/config/site";
import clsx from "clsx";
import {ThemeSwitch} from "@/components/theme-switch";
import {CartDropdown} from "@/components/my-navbar/cart";
import {NotificationsDropdown} from "@/components/my-navbar/notifications-dropdown";
import {GithubIcon} from "@/components/icons/navbar/github-icon";
import {UserDropdown} from "@/components/my-navbar/user-dropdown";

// import {AcmeIcon} from "./acme";

const menuItems = [
    "About",
    "Blog",
    "Customers",
    "Pricing",
    "Enterprise",
    "Changelog",
    "Documentation",
    "Contact Us",
];

export default function MyNavbar(props: NavbarProps) {
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);


    const searchInput = (
        <Input
            aria-label="Search"
            classNames={{
                inputWrapper: "bg-default-100",
                input: "text-sm",
            }}
            endContent={
                <Kbd className="hidden lg:inline-block" keys={["command"]}>
                    F
                </Kbd>
            }
            labelPlacement="outside"
            placeholder="Tìm kiếm ..."
            startContent={
                <SearchIcon className="text-base text-default-400 pointer-events-none flex-shrink-0"/>
            }
            type="search"
        />
    );

    return (
        <Navbar
            {...props}
            isBordered
            classNames={{
                base: cn("border-default-100 select-none", {
                    "": isMenuOpen,
                }),
                wrapper: "w-full justify-center bg-transparent",
                item: "hidden md:flex",
            }}
            height="60px"
            isMenuOpen={isMenuOpen}
            onMenuOpenChange={setIsMenuOpen}
        >
            <NavbarMenuToggle className="text-default-400 md:hidden"/>

            <NavbarBrand>
                <Link className="rounded-full bg-foreground text-background" href={"/"}>
                    <RemVietIcon/>
                </Link>
                <span className="ml-2 font-medium">Rèm Việt</span>
            </NavbarBrand>

            <NavbarContent className="max-md:hidden">
                <ul className="hidden lg:flex gap-4 justify-start ml-2">
                    {siteConfig.navItems.map((item) => (
                        <NavbarItem key={item.href}>
                            <Link
                                className={clsx(
                                    "data-[active=true]:text-primary data-[active=true]:font-medium",
                                )}
                                color="foreground"
                                href={item.href}
                            >
                                {item.label}
                            </Link>
                        </NavbarItem>
                    ))}
                </ul>
            </NavbarContent>

            <NavbarContent
                className="hidden sm:flex basis-1/5 sm:basis-full"
                justify="end"
            >
                <NavbarItem className="hidden sm:flex gap-2">
                    {/*<Link isExternal href={siteConfig.links.github} aria-label="Github">*/}
                    {/*    <GithubIcon className="text-default-500" />*/}
                    {/*</Link>*/}
                </NavbarItem>
                <NavbarItem className="hidden lg:flex">{searchInput}</NavbarItem>
                <NavbarItem className="hidden md:flex"/>
            </NavbarContent>

            <NavbarContent
                className="w-fit data-[justify=end]:flex-grow-0"
                justify="end"
            >
                <ThemeSwitch/>

                {/*Cart item*/}
                <CartDropdown/>

                {/*Notification*/}
                <NotificationsDropdown/>

                <Link href="https://github.com/tongducthanhnam" target={"_blank"}>
                    <GithubIcon/>
                </Link>

                {/*User button & Dropdown */}
                <UserDropdown/>
            </NavbarContent>

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
                        <Link className="w-full text-default-500" href={item.href} size="md">
                            {item.label}
                        </Link>
                    </NavbarMenuItem>
                ))}
            </NavbarMenu>
        </Navbar>
    );
}
