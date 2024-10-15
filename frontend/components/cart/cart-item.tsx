import { Button, DropdownItem, Image } from "@nextui-org/react";
import { CloseIcon } from "@nextui-org/shared-icons";
import React from "react";

import { Product } from "@/types";

export default function CartItem({ product }: { product: Product }) {
  return (
    <DropdownItem href={"/"}>
      <div className="w-96 flex items-center border-divider">
        <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center mr-5">
          <Image
            alt="Product image"
            height={80}
            src={product.imageUrl}
            width={80}
          />
        </div>
        <div className="flex flex-1 flex-col">
          <div className="mt-2 flex items-center gap-2">
            <span className="text-small font-semibold text-default-700">
              {product.price}
            </span>
            <span className="text-small text-default-500">
              x {product.quantity}
            </span>
          </div>

          <h4 className="text-small">{product.name}</h4>
          <div className="flex items-center gap-3">
            <p>
              <span className="text-small text-default-500">Màu sắc: </span>
              {/*<span className="text-small font-medium capitalize text-default-700">*/}
              {/*    {product.color}*/}
              {/*</span>*/}
            </p>
            <p>
              <span className="text-small text-default-500">Size: </span>
              <span className="text-small font-medium text-default-700">
                {/*{product.size}*/}
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
  );
}
