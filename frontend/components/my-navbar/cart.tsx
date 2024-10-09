"use client"; // This is a comment

import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownSection,
  DropdownTrigger,
  Image,
  Link,
  NavbarItem,
} from "@nextui-org/react";
import React from "react";
import { CartIcon, CloseIcon } from "@nextui-org/shared-icons"; //Props

//Props

export const CartDropdown = () => {
  return (
    <Dropdown>
      <NavbarItem className={"ml-2 !flex gap-2"}>
        <DropdownTrigger>
          <Button
            aria-label={"Cart"}
            className="bg-transparent"
            isIconOnly={true}
          >
            <CartIcon />
          </Button>
        </DropdownTrigger>
      </NavbarItem>
      <DropdownMenu
        aria-label="User menu actions"
        onAction={(actionKey) => console.log({ actionKey })}
      >
        <DropdownSection showDivider={true} title="Giỏ hàng của bạn.">
          <DropdownItem key={"1"} href={"/"}>
            <div className="w-96 flex items-center border-divider ">
              <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center">
                <Image
                  alt="Product image"
                  height={80}
                  src="/src/150x150.png"
                  width={80}
                />
              </div>
              <div className="flex flex-1 flex-col">
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-small font-semibold text-default-700">
                    $49.99
                  </span>
                  <span className="text-small text-default-500">x 1</span>

                  {/* Plus minus*/}
                </div>

                <h4 className="text-small">Training shoes</h4>
                <div className="flex items-center gap-3">
                  <p>
                    <span className="text-small text-default-500">Color: </span>
                    <span className="text-small font-medium capitalize text-default-700">
                      black
                    </span>
                  </p>
                  <p>
                    <span className="text-small text-default-500">Size: </span>
                    <span className="text-small font-medium text-default-700">
                      42
                    </span>
                  </p>
                </div>
              </div>

              <div className="z-0 group relative inline-flex items-center justify-center box-border">
                <Button
                  className="bg-red-500 text-white"
                  isIconOnly={true}
                  startContent={<CloseIcon />}
                />
              </div>
            </div>
          </DropdownItem>
        </DropdownSection>

        {/* See all */}
        <DropdownItem
          className="text-center"
          onClick={() => {
            console.log("See all");
          }}
        >
          <Link href={"/gio-hang"}>Đến trang giỏ hàng</Link>
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
};
