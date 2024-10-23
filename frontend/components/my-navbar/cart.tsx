"use client"; // This is a comment

import { Badge } from "@nextui-org/badge";
import { Button } from "@nextui-org/button";
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownSection,
  DropdownTrigger,
} from "@nextui-org/dropdown";
import { Image } from "@nextui-org/image";
import Link from "next/link";
import { NavbarItem } from "@nextui-org/navbar";

import React from "react";
import { CartIcon, CloseIcon } from "@nextui-org/shared-icons";

import { useCartStore } from "@/store/useCartStore";
import { priceVietNamDongformetter } from "@/components/lib/client-utils/utils";

//Props

export const CartDropdown = () => {
  // const addToCart = useCartStore((state) => state.addToCart);
  const removeFromCart = useCartStore((state) => state.removeFromCart);

  const cart = useCartStore((state) => state.cart);
  const total = cart.reduce(
    (acc, product) => acc + product.price * (product.quantity as number),
    0,
  );

  //cart lenght
  const cartLength = cart.length || 0;

  return (
    <Dropdown>
      <NavbarItem className={"ml-2 !flex gap-2"}>
        <DropdownTrigger>
          <Button
            aria-label={"Cart"}
            className="bg-transparent"
            isIconOnly={true}
          >
            <Badge color="default" content={cartLength || 0}>
              <CartIcon />
            </Badge>
          </Button>
        </DropdownTrigger>
      </NavbarItem>
      <DropdownMenu
        aria-label="User menu actions"
        onAction={(actionKey) => console.log({ actionKey })}
      >
        <DropdownSection showDivider={true} title="Giỏ hàng của bạn.">
          {cart &&
            cart.map((product) => (
              <DropdownItem key={product.id} href={`/san-pham/${product.id}`}>
                <div className="w-full max-w-sm sm:max-w-md rounded-lg shadow-sm border border-border p-3 sm:p-4 transition-all duration-300 hover:shadow-md">
                  <div
                    className={
                      "flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4"
                    }
                  >
                    <div className="w-full sm:w-auto flex justify-center sm:justify-start">
                      <Image
                        alt={`${product.name} image`}
                        className="rounded-md object-cover"
                        height={60}
                        src={product.imageUrl}
                        width={60}
                      />
                    </div>
                    <div className="flex-1 min-w-0 w-full sm:w-fit">
                      <div className="flex items-start justify-between">
                        <h4 className="text-base sm:text-lg font-semibold text-foreground truncate pr-2 sm:max-w-sm md:max-w-xs">
                          {product.name} {product.name}
                        </h4>
                        <Button
                          aria-label="Remove item"
                          className="h-7 w-7 sm:h-8 sm:w-8"
                          color={"danger"}
                          isIconOnly={true}
                          onClick={() => removeFromCart(product)}
                        >
                          <CloseIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                        </Button>
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-sm font-medium text-foreground">
                          {priceVietNamDongformetter(product.price.toString())}
                        </span>
                        <span className="text-xs sm:text-sm text-muted-foreground">
                          x {product.quantity}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-2">
                        {Object.entries(product.variants).map(
                          ([key], index) => (
                            <span
                              key={index}
                              className="text-xs bg-secondary text-secondary-foreground px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full"
                            >
                              {product.variants[key]}
                            </span>
                          ),
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </DropdownItem>
            ))}
        </DropdownSection>

        {/* See all */}
        <DropdownItem
          className="text-center"
          onClick={() => {
            console.log("See all");
          }}
        >
          <p>Tổng cộng {priceVietNamDongformetter(total.toString())}</p>
          <Link prefetch={false} href={"/gio-hang"}>
            Đến trang giỏ hàng
          </Link>
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
};
