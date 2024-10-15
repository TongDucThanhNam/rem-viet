"use client";

import React, { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Button,
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenu,
  NavbarMenuItem,
  NavbarMenuToggle,
} from "@nextui-org/react";

import { RemVietIcon } from "@/components/icons/remviet";
import { siteConfig } from "@/config/site";
import { GithubIcon } from "@/components/icons/icons";
import SearchBar from "@/components/my-navbar/search-bar";

const ThemeSwitch = dynamic(
  () => import("@/components/theme-switch").then((mod) => mod.ThemeSwitch),
  {
    ssr: false,
    loading: () => <Button className="bg-transparent" isIconOnly />,
  },
);

const CartDropdown = dynamic(
  () => import("@/components/my-navbar/cart").then((mod) => mod.CartDropdown),
  {
    ssr: false,
    loading: () => <Button className="bg-transparent" isIconOnly />,
  },
);

const NavbarLink = React.memo(
  ({ href, label }: { href: string; label: string }) => (
    <NavbarItem>
      <Link href={href}>{label}</Link>
    </NavbarItem>
  ),
);

NavbarLink.displayName = "NavbarLink";

const NavbarMenuLink = React.memo(
  ({ href, label }: { href: string; label: string }) => (
    <NavbarMenuItem>
      <Link className="w-full text-default-500" href={href}>
        {label}
      </Link>
    </NavbarMenuItem>
  ),
);

NavbarMenuLink.displayName = "NavbarMenuLink";

export default function MyNavbar(props: React.ComponentProps<typeof Navbar>) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleMenuToggle = useCallback(() => {
    setIsMenuOpen((prev) => !prev);
  }, []);

  const navLinks = useMemo(
    () =>
      siteConfig.navItems.map((item) => (
        <NavbarLink key={item.href} href={item.href} label={item.label} />
      )),
    [],
  );

  const menuLinks = useMemo(
    () =>
      siteConfig.navItems.map((item, index) => (
        <NavbarMenuLink
          key={`${item.href}-${index}`}
          href={item.href}
          label={item.label}
        />
      )),
    [],
  );

  const navbarClassNames = useMemo(
    () => ({
      base: `border-default-100 ${isMenuOpen ? "bg-default-200/50 dark:bg-default-100/50" : ""}`,
      wrapper: "w-screen justify-center bg-transparent",
      item: "hidden md:flex",
    }),
    [isMenuOpen],
  );

  return (
    <Navbar
      {...props}
      isBordered
      classNames={navbarClassNames}
      height="60px"
      isMenuOpen={isMenuOpen}
      onMenuOpenChange={handleMenuToggle}
    >
      <NavbarMenuToggle
        className="text-default-400 md:hidden"
        aria-label={isMenuOpen ? "Close menu" : "Open menu"}
      />

      <NavbarBrand>
        <Button
          aria-label="Rèm Việt"
          as={Link}
          className="bg-transparent"
          href="/"
          startContent={<RemVietIcon />}
        >
          Rèm Việt
        </Button>
      </NavbarBrand>

      <NavbarContent className="max-md:hidden">{navLinks}</NavbarContent>

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
            className="bg-transparent"
            href={siteConfig.links.github}
            isIconOnly
          >
            <GithubIcon />
          </Button>
        </NavbarItem>
      </NavbarContent>

      <NavbarMenu className="top-[calc(var(--navbar-height)_-_1px)] max-h-[70vh] bg-default-200/50 pt-6 shadow-medium backdrop-blur-md backdrop-saturate-150 dark:bg-default-100/50">
        <NavbarMenuItem>
          <SearchBar />
        </NavbarMenuItem>
        {menuLinks}
      </NavbarMenu>
    </Navbar>
  );
}
