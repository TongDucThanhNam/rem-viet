"use client";

import { Button } from "@nextui-org/button";
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenu,
  NavbarMenuItem,
  NavbarMenuToggle
} from "@nextui-org/navbar";
import React, { useCallback, useMemo, useState } from "react";
import Link from "next/link";

import { RemVietIcon } from "@/components/icons/remviet";
import { siteConfig } from "@/config/site";
import { GithubIcon } from "@/components/icons/icons";
import SearchBar from "@/components/my-navbar/search-bar";
import { cn } from "@/components/lib/server-utils/utils";
import { CartDropdown } from "@/components/my-navbar/cart";
import { ThemeSwitch } from "@/components/theme-switch";

export default function MyNavbar(props: any) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleMenuToggle = useCallback(() => {
    setIsMenuOpen((prev) => !prev);
  }, []);

  const navbarBaseClass = useMemo(
    () =>
      cn("border-default-100", {
        "bg-default-200/50 dark:bg-default-100/50": isMenuOpen
      }),
    [isMenuOpen]
  );

  const navItems = useMemo(
    () =>
      siteConfig.navItems.map((item) => (
        <NavbarItem key={item.href}>
          <Link prefetch={false} href={item.href}>
            {item.label}
          </Link>
        </NavbarItem>
      )),
    []
  );

  const menuItems = useMemo(
    () =>
      siteConfig.navItems.map((item, index) => (
        <NavbarMenuItem key={`${item}-${index}`}>
          <Link
            prefetch={false}
            className="w-full text-default-500"
            href={item.href}
          >
            {item.label}
          </Link>
        </NavbarMenuItem>
      )),
    []
  );

  return (
    <Navbar
      {...props}
      isBordered
      classNames={{
        base: navbarBaseClass,
        wrapper: "w-full justify-center bg-transparent",
        item: "hidden md:flex"
      }}
      isMenuOpen={isMenuOpen}
      onMenuOpenChange={handleMenuToggle}
    >
      <NavbarMenuToggle className="text-default-400 md:hidden" />

      <NavbarBrand>
        <Button
          aria-label="Rèm Việt"
          as={Link}
          prefetch={false}
          className="bg-transparent"
          href="/"
          startContent={<RemVietIcon />}
        >
          Rèm Việt
        </Button>
      </NavbarBrand>

      <NavbarContent className="max-md:hidden">{navItems}</NavbarContent>

      <NavbarContent className="max-md:hidden">
        <NavbarItem className="hidden lg:flex">
          <SearchBar />
        </NavbarItem>
      </NavbarContent>

      <NavbarContent
        className="w-fit data-[justify=end]:flex-grow-0"
        justify="end"
      >
        <NavbarItem className="ml-2 !flex gap-2">
          <ThemeSwitch />
        </NavbarItem>
        <CartDropdown />
        <NavbarItem>
          <Button
            aria-label="Github"
            as={Link}
            prefetch={false}
            className="bg-transparent"
            href={siteConfig.links.github}
            isIconOnly
          >
            <GithubIcon />
          </Button>
        </NavbarItem>
      </NavbarContent>

      <NavbarMenu
        className="top-[calc(var(--navbar-height)_-_1px)] max-h-[70vh] bg-default-200/50 pt-6 shadow-medium backdrop-blur-md backdrop-saturate-150 dark:bg-default-100/50">
        <NavbarMenuItem>
          <SearchBar />
        </NavbarMenuItem>
        {menuItems}
      </NavbarMenu>
    </Navbar>
  );
}
