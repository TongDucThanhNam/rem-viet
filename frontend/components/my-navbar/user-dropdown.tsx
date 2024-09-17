"use client"; // This is a comment

import {
  Avatar,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  NavbarItem,
} from "@nextui-org/react";
import React from "react";
import { Link } from "@nextui-org/link";

import { DarkModeSwitch } from "./darkmodeswitch";

export const UserDropdown = () => {
  return (
    <Dropdown>
      <NavbarItem>
        <DropdownTrigger>
          <Avatar
            as="button"
            color="secondary"
            size="md"
            src="https://i.pravatar.cc/150?u=a042581f4e29026704d"
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
        <DropdownItem key={"cart"}>
          <Link href={"/cart"}>Giỏ hàng của tôi</Link>
        </DropdownItem>
        <DropdownItem key="help_and_feedback">Liên hệ hỗ trợ</DropdownItem>
        <DropdownItem key="logout" className="text-danger " color="danger">
            Đăng xuất
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
};
