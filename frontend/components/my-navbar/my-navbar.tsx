"use client"; // This is a comment

import {
  Input,
  Link,
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
} from "@nextui-org/react";
import React from "react";
import NextLink from "next/link";
import clsx from "clsx";
import { link as linkStyles } from "@nextui-org/theme";
import { Kbd } from "@nextui-org/kbd";

import { siteConfig } from "@/config/site";
import { GithubIcon, Logo, SearchIcon } from "@/components/icons";
import { ThemeSwitch } from "@/components/theme-switch";

import { CartDropdown } from "./cart";
import { UserDropdown } from "./user-dropdown";
import { NotificationsDropdown } from "./notifications-dropdown";
import { RemVietIcon } from "@/components/icons/remviet";

interface Props {
  children?: React.ReactNode;
}

export const MyNavbar = ({ children }: Props) => {
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
      placeholder="Search..."
      startContent={
        <SearchIcon className="text-base text-default-400 pointer-events-none flex-shrink-0" />
      }
      type="search"
    />
  );

  return (
    <Navbar
      isBordered
      className="w-full"
      classNames={{
        wrapper: "w-full max-w-full",
      }}
    >
      <NavbarContent className="max-md:hidden">
        <NavbarBrand as="li" className="gap-3 max-w-fit">
          <NextLink
            className="flex justify-start items-center gap-1 w-32 h-32 rounded-full"
            href="/"
          >
            <RemVietIcon />
            <p className="font-bold text-inherit">Rèm Việt</p>
          </NextLink>
        </NavbarBrand>
        <ul className="hidden lg:flex gap-4 justify-start ml-2">
          {siteConfig.navItems.map((item) => (
            <NavbarItem key={item.href}>
              <NextLink
                className={clsx(
                  linkStyles({ color: "foreground" }),
                  "data-[active=true]:text-primary data-[active=true]:font-medium",
                )}
                color="foreground"
                href={item.href}
              >
                {item.label}
              </NextLink>
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
        <NavbarItem className="hidden md:flex" />
      </NavbarContent>

      <NavbarContent
        className="w-fit data-[justify=end]:flex-grow-0"
        justify="end"
      >
        <ThemeSwitch />

        {/*Cart item*/}
        <CartDropdown />

        {/*Notification*/}
        <NotificationsDropdown />

        <Link href="https://github.com/chvn9120/E-Commerce" target={"_blank"}>
          <GithubIcon />
        </Link>

        {/*User button & Dropdown */}
        <UserDropdown />
      </NavbarContent>
    </Navbar>
  );
};
