"use client";

// Import và sử dụng các thành phần động, memo hóa, và sự kiện tối ưu
import dynamic from "next/dynamic";
import {
  Button,
  cn,
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenu,
  NavbarMenuItem,
  NavbarMenuToggle,
} from "@nextui-org/react";
import React from "react";
import Link from "next/link";

import { RemVietIcon } from "@/components/icons/remviet";
import { siteConfig } from "@/config/site";
import { GithubIcon } from "@/components/icons/icons";
import SearchBar from "@/components/my-navbar/search-bar";

// Dynamic import để giảm tải SSR
const ThemeSwitch = dynamic(
  () => import("@/components/theme-switch").then((mod) => mod.ThemeSwitch),
  {
    ssr: false,
    loading: () => <Button className={"bg-transparent"} isIconOnly={true} />,
  },
);
const CartDropdown = dynamic(
  () => import("@/components/my-navbar/cart").then((mod) => mod.CartDropdown),
  {
    ssr: false,
    loading: () => <Button className={"bg-transparent"} isIconOnly={true} />,
  },
);

export default function MyNavbar(props: any) {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const handleMenuToggle = React.useCallback(() => {
    setIsMenuOpen((prev) => !prev);
  }, []);

  return (
    <Navbar
      {...props}
      isBordered
      classNames={{
        base: cn("border-default-100", {
          "bg-default-200/50 dark:bg-default-100/50": isMenuOpen,
        }),
        wrapper: "w-full justify-center bg-transparent",
        item: "hidden md:flex",
      }}
      height="60px"
      isMenuOpen={isMenuOpen}
      onMenuOpenChange={handleMenuToggle}
    >
      <NavbarMenuToggle className="text-default-400 md:hidden" />

      <NavbarBrand>
        <Button
          aria-label={"Rèm Việt"}
          as={Link}
          className={"bg-transparent"}
          href={"/"}
          startContent={<RemVietIcon />}
        >
          Rèm Việt
        </Button>
      </NavbarBrand>

      <NavbarContent className="max-md:hidden">
        {siteConfig.navItems.map((item) => (
          <NavbarItem key={item.href}>
            <Link href={item.href}>{item.label}</Link>
          </NavbarItem>
        ))}
      </NavbarContent>

      <NavbarContent className="max-md:hidden">
        <NavbarItem className="hidden lg:flex">
          <SearchBar />
        </NavbarItem>
      </NavbarContent>

      <NavbarContent
        className="w-fit data-[justify=end]:flex-grow-0"
        justify="end"
      >
        <NavbarItem className={"ml-2 !flex gap-2"}>
          <ThemeSwitch />
        </NavbarItem>
        <CartDropdown />
        <NavbarItem>
          <Button
            aria-label="Github"
            as={Link}
            className={"bg-transparent"}
            href={siteConfig.links.github}
            isIconOnly={true}
          >
            <GithubIcon />
          </Button>
        </NavbarItem>
      </NavbarContent>

      <NavbarMenu className="top-[calc(var(--navbar-height)_-_1px)] max-h-[70vh] bg-default-200/50 pt-6 shadow-medium backdrop-blur-md backdrop-saturate-150 dark:bg-default-100/50">
        <NavbarMenuItem>
          <SearchBar />
        </NavbarMenuItem>
        {siteConfig.navItems.map((item, index) => (
          <NavbarMenuItem key={`${item}-${index}`}>
            <Link className="w-full text-default-500" href={item.href}>
              {item.label}
            </Link>
          </NavbarMenuItem>
        ))}
      </NavbarMenu>
    </Navbar>
  );
}
