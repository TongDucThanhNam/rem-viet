"use client"; // This is a comment

import {
  Avatar,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Link,
  NavbarItem,
} from "@nextui-org/react";
import React from "react";

export const UserDropdown = () => {
  return (
    <Dropdown>
      <NavbarItem className={"ml-2 !flex gap-2"}>
        <DropdownTrigger>
          <Avatar
            as="button"
            color="secondary"
            size="md"
            src="/src/user-avatar.jpeg"
          />
        </DropdownTrigger>
      </NavbarItem>
      <DropdownMenu
        aria-label="User menu actions"
        onAction={(actionKey) => console.log({ actionKey })}
      >
        <DropdownItem
          key="profile"
          className="flex flex-col justify-start w-full items-start"
        >
          <p>Đã đăng nhập với</p>
          <p>User</p>
        </DropdownItem>
        <DropdownItem key="settings">Cài đặt</DropdownItem>
        <DropdownItem key={"gio-hang"}>
          <Link href={"/gio-hang"}>Giỏ hàng của tôi</Link>
        </DropdownItem>
        <DropdownItem key="help_and_feedback">Liên hệ hỗ trợ</DropdownItem>
        <DropdownItem key="logout" className="text-danger " color="danger">
          Đăng xuất
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
};
