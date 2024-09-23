"use client";

// import CustomButton from "@/components/product/button";
import { Button, Divider, Image, Input, Spacer } from "@nextui-org/react";
import { CloseIcon } from "@nextui-org/shared-icons";

import PurchaseForm from "@/components/form/purchase-form";

let product = {
  // id: string;
  // name: string;
  // description: string;
  // price: number;
  // imageUrl: string;
  id: "1",
  name: "Product 1",
  price: 100,
  imageUrl: "/src/150x150.png",
  description:
    "The Nike Air Max 270 delivers an even more adaptive fit than before. Stretch material in the upper moves with your foot, while the tri-star outsole pattern adjusts to your every step for a ride that delivers support and flexibility where you need it.",
};

export default function CartPage() {
  return (
    //returning button
    <div className="flex items-center h-auto justify-center p-4">
      <div className="flex w-full max-w-7xl flex-col lg:flex-row lg:gap-8">
        {/*Ship and purchase*/}
        <div className="flex w-full justify-center mx-auto text-center">
          <PurchaseForm />
        </div>

        {/*Review and modify*/}
        <div className="w-full h-fit mt-6 rounded-medium bg-content2 px-2 py-4 md:px-6 md:py-8 lg:w-[340px] lg:flex-none">
          <div className={"flex flex-col"}>
            <h2 className="text-2xl font-semibold text-default-900">
              Review and modify
            </h2>
            <Spacer y={2} />

            {/*List Cart*/}
            <ul>
              <li>
                <div
                  className={"flex items-center gap-x-4 border-divider py-4"}
                >
                  <div
                    className={
                      "flex h-20 w-20 flex-shrink-0 items-center justify-center"
                    }
                  >
                    <Image
                      alt={"product"}
                      height={80}
                      src={product.imageUrl}
                      width={80}
                    />
                  </div>
                  <div className={"flex flex-1 flex-col"}>
                    <h4 className="text-small">
                      <a
                        className="relative inline-flex items-center tap-highlight-transparent outline-none data-[focus-visible=true]:z-10 data-[focus-visible=true]:outline-2 data-[focus-visible=true]:outline-focus data-[focus-visible=true]:outline-offset-2 text-medium hover:underline hover:opacity-80 active:opacity-disabled transition-opacity underline-offset-4 font-medium text-foreground"
                        href="/public"
                      >
                        Training shoes
                      </a>
                    </h4>
                    <div className="flex items-center gap-3">
                      <p>
                        <span className="text-small text-default-500">
                          Color:{" "}
                        </span>
                        <span className="text-small font-medium capitalize text-default-700">
                          black
                        </span>
                      </p>
                      <p>
                        <span className="text-small text-default-500">
                          Size:{" "}
                        </span>
                        <span className="text-small font-medium text-default-700">
                          42
                        </span>
                      </p>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-small font-semibold text-default-700">
                        $49.99
                      </span>
                      <span className="text-small text-default-500">x 1</span>
                    </div>
                  </div>

                  <Button
                    className={
                      "z-0 bg-transparent hover:bg-secondary active:bg-primary-50 focus:bg-default-200"
                    }
                    isIconOnly={true}
                    size={"sm"}
                    startContent={<CloseIcon />}
                  />
                </div>
              </li>
            </ul>

            {/*Apply coupon*/}
            <Spacer y={4} />
            <div className="mb-4 mt-6 flex items-end gap-2">
              <Input
                label={"Coupon code"}
                labelPlacement={"outside"}
                placeholder={"Enter coupon code"}
                size={"sm"}
              >
                Coupon code
              </Input>
              <Button color={"primary"} size={"sm"}>
                Apply
              </Button>
            </div>

            <div className={"flex flex-col gap-4 py-4"}>
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="text-default-800">$300</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping</span>
                <span className="text-default-800">$0</span>
              </div>

              <Divider />
              <div className="flex justify-between">
                <span>Total</span>
                <span className="text-default-800">$300</span>
              </div>
            </div>

            <Spacer y={2} />
            <Button className={"w-auto"} color={"primary"}>
              Proceed to checkout
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
