"use client"; // This is a comment

import {
  NavbarItem,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@nextui-org/react";
import React from "react";

import NotificationCard from "@/components/notification-card/notification-card";
import { NotificationIcon } from "@/components/icons/icons";

export const NotificationsDropdown = () => {
  return (
    <Popover showArrow offset={10} placement="bottom">
      <PopoverTrigger>
        <NavbarItem className={"ml-2 !flex gap-2"}>
          <NotificationIcon />
        </NavbarItem>
      </PopoverTrigger>
      <PopoverContent>
        <NotificationCard />
      </PopoverContent>
    </Popover>
  );
};
