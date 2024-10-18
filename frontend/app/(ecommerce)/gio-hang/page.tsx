"use client";

// import CustomButton from "@/components/san-pham/button";
import { Button, Divider, Image, Input, Spacer } from "@nextui-org/react";
import { CloseIcon } from "@nextui-org/shared-icons";
import React from "react";

import { useCartStore } from "@/store/useCartStore";
import { priceVietNamDongformetter } from "@/components/lib/client-utils/utils";

export default function CartPage() {
  const removeFromCart = useCartStore((state) => state.removeFromCart);

  const cart = useCartStore((state) => state.cart);
  const total = cart.reduce(
    (acc, product) => acc + product.price * (product.quantity as number),
    0,
  );

  const handlePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(formData.entries());

    const bodyForm = {
      ...data,
      cart: cart,
      total: total,
    };

    console.log(`Purchased: `, bodyForm);

    try {
      const response = await fetch("/api/send-cart-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bodyForm),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  return (
    //returning button
    <div className="flex items-center h-auto justify-center p-4">
      <form
        className="flex w-full max-w-7xl flex-col lg:flex-row lg:gap-8"
        onSubmit={handlePurchase}
      >
        {/*Ship and purchase*/}
        <div className="flex w-full justify-center mx-auto text-center">
          <div className="flex items-center h-auto text-center mx-auto">
            <div className="flex w-full max-w-2xl py-8">
              <div className="flex flex-col gap-5 py-8">
                {/*Email*/}
                <div className="group flex flex-col w-full group relative justify-end">
                  <Input
                    required
                    label="Email của bạn"
                    labelPlacement="outside"
                    name={"email"}
                    placeholder="Nhập Email của bạn"
                  />
                </div>

                {/*Name*/}
                <div className="flex flex-wrap items-center gap-4 sm:flex-nowrap">
                  {/*First Name*/}
                  <div className="group flex flex-col w-full group relative justify-end">
                    <Input
                      required
                      isRequired={true}
                      label="Họ của bạn"
                      labelPlacement="outside"
                      name={"firstName"}
                      placeholder="Nhập họ của bạn"
                    />
                  </div>

                  {/*Last Name*/}
                  <div className="group flex flex-col w-full group relative justify-end">
                    <Input
                      required
                      label="Tên của bạn"
                      labelPlacement="outside"
                      name={"lastName"}
                      placeholder="Nhập tên của bạn"
                    />
                  </div>
                </div>

                {/*Address*/}
                <div className="flex flex-wrap items-center gap-4 sm:flex-nowrap">
                  {/*Address*/}
                  <div className="group flex flex-col w-full group relative justify-end">
                    <Input
                      required
                      label="Địa chỉ"
                      labelPlacement="outside"
                      name={"address"}
                      placeholder="Lê Văn Lương, Quận 7, TP.HCM"
                    />
                  </div>

                  {/*Specific address*/}
                  <div className="group flex flex-col w-full group relative justify-end">
                    <Input
                      isRequired
                      label="Specific address"
                      labelPlacement="outside"
                      name={"specificAddress"}
                      placeholder="Đại học RMIT"
                    />
                  </div>
                </div>

                {/*City and Country*/}
                <div className="flex flex-wrap items-center gap-4 sm:flex-nowrap">
                  {/*Quận, huyện */}
                  <div className="group flex flex-col w-full group relative justify-end">
                    <Input
                      isRequired
                      label="Quận, huyện"
                      labelPlacement="outside"
                      name={"district"}
                      placeholder="Quận 7"
                    />
                  </div>

                  {/*City*/}
                  <div className="group flex flex-col w-full group relative justify-end">
                    <Input
                      isRequired
                      label="Tỉnh/Thành phố"
                      labelPlacement="outside"
                      name={"city"}
                      placeholder="Hồ Chí Minh"
                    />
                  </div>
                </div>

                {/*Postcode and Phone number*/}
                <div className="flex flex-wrap items-center gap-4 sm:flex-nowrap">
                  {/*Postcode*/}
                  <div className="group flex flex-col w-full group relative justify-end">
                    <Input
                      label="Mã bưu điện"
                      labelPlacement="outside"
                      name={"postcode"}
                      placeholder="700000"
                    />
                  </div>

                  {/*Phone number*/}
                  <div className="group flex flex-col w-full group relative justify-end">
                    <Input
                      required
                      label="Số điện thoại"
                      labelPlacement="outside"
                      name={"phoneNumber"}
                      placeholder="0901234567"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/*Review and modify*/}
        <div className="w-full h-fit mt-6 rounded-medium bg-content2 px-2 py-4 md:px-6 md:py-8 lg:w-[340px] lg:flex-none">
          <div className={"flex flex-col"}>
            <h2 className="text-2xl font-semibold text-default-900">
              Giỏ hàng
            </h2>
            <Spacer y={2} />

            {/*List Cart*/}
            <ul>
              <li>
                <div
                  className={
                    "flex flex-col overflow-y-scroll items-center gap-x-4 border-divider py-4"
                  }
                >
                  {cart &&
                    cart.map((product) => (
                      <div
                        key={`cart-item${product.id}`}
                        className="w-full max-w-sm sm:max-w-md rounded-lg shadow-sm border border-border p-3 sm:p-4 transition-all duration-300 hover:shadow-md"
                      >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
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
                                {priceVietNamDongformetter(
                                  product.price.toString(),
                                )}
                              </span>
                              <span className="text-xs sm:text-sm text-muted-foreground">
                                x {product.quantity}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-2">
                              {Object.entries(product.variants).map(
                                ([key, value], index) => (
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
                    ))}
                </div>
              </li>
            </ul>

            <div className={"flex flex-col gap-4 py-4"}>
              <Divider />
              <div className="flex justify-between">
                <span>Tổng cộng</span>
                <span className="text-default-800">
                  {priceVietNamDongformetter(total.toString())}
                </span>
              </div>
            </div>

            <Spacer y={2} />
            <Button className={"w-auto"} color={"primary"} type={"submit"}>
              Đặt hàng
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
