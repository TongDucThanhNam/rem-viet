import { Input } from "@nextui-org/input";
import { Radio, RadioGroup } from "@nextui-org/react";
import React from "react";

import PaymentMethod from "@/components/payment-method/payment-method";

export default function PurchaseForm() {
  return (
    <div className="flex items-center h-auto text-center mx-auto">
      <div className="flex w-full max-w-2xl py-8">
        <form className="flex flex-col gap-5 py-8">
          {/*Email*/}
          <div className="group flex flex-col w-full group relative justify-end">
            <Input
              required
              label="Email address"
              labelPlacement="outside"
              placeholder="Enter your email address"
            />
          </div>

          {/*Name*/}
          <div className="flex flex-wrap items-center gap-4 sm:flex-nowrap">
            {/*First Name*/}
            <div className="group flex flex-col w-full group relative justify-end">
              <Input
                required
                isRequired={true}
                label="First Name"
                labelPlacement="outside"
                placeholder="Enter your first name"
              />
            </div>

            {/*Last Name*/}
            <div className="group flex flex-col w-full group relative justify-end">
              <Input
                required
                label="Last Name"
                labelPlacement="outside"
                placeholder="Enter your last name"
              />
            </div>
          </div>

          {/*Address*/}
          <div className="flex flex-wrap items-center gap-4 sm:flex-nowrap">
            {/*Address*/}
            <div className="group flex flex-col w-full group relative justify-end">
              <Input
                required
                label="Address"
                labelPlacement="outside"
                placeholder="Le Van Luong, District 7, HCMC, Vietnam"
              />
            </div>

            {/*Specific address*/}
            <div className="group flex flex-col w-full group relative justify-end">
              <Input
                isRequired
                label="Specific address"
                labelPlacement="outside"
                placeholder="RMIT Univercity"
              />
            </div>
          </div>

          {/*City and Country*/}
          <div className="flex flex-wrap items-center gap-4 sm:flex-nowrap">
            {/*City*/}
            <div className="group flex flex-col w-full group relative justify-end">
              <Input
                isRequired
                label="City"
                labelPlacement="outside"
                placeholder="Ho Chi Minh City"
              />
            </div>

            {/*Country*/}
            <div className="group flex flex-col w-full group relative justify-end">
              <Input
                required
                label="Country"
                labelPlacement="outside"
                placeholder="Vietnam"
              />
            </div>
          </div>

          {/*Postcode and Phone number*/}
          <div className="flex flex-wrap items-center gap-4 sm:flex-nowrap">
            {/*Postcode*/}
            <div className="group flex flex-col w-full group relative justify-end">
              <Input
                required
                label="Postcode"
                labelPlacement="outside"
                placeholder="700000"
              />
            </div>

            {/*Phone number*/}
            <div className="group flex flex-col w-full group relative justify-end">
              <Input
                required
                label="Phone number"
                labelPlacement="outside"
                placeholder="0901234567"
              />
            </div>
          </div>

          {/*Address Type*/}
          <div className="relative flex flex-col gap-2 ml-1 mt-6">
            <span className="relative text-foreground-500">Address type</span>
            <RadioGroup className="" orientation={"horizontal"}>
              <Radio value="1">Home</Radio>
              <Radio value="2">Work</Radio>
              <Radio value="3">Other </Radio>
            </RadioGroup>
          </div>

          {/*Payment method*/}
          {/*<div className="relative flex flex-col gap-2 ml-1 mt-3">*/}
          {/*                                    <span*/}
          {/*                                        className="relative text-foreground-500">Payment method</span>*/}
          {/*    <RadioGroup orientation={"horizontal"} className="">*/}
          {/*        <Radio value="1">Credit Card</Radio>*/}
          {/*        <Radio value="2">Paypal</Radio>*/}
          {/*        <Radio value="3">Other </Radio>*/}
          {/*    </RadioGroup>*/}
          {/*</div>*/}
          <PaymentMethod className="w-[420px]" />

          {/*Card number*/}
          <div className="group flex flex-col w-full group relative justify-end">
            <Input
              isRequired
              label="Card number"
              labelPlacement={"outside"}
              placeholder="XXXX-XXXX-XXXX-XXXX"
            />
          </div>

          {/*Cardholder Name*/}
          <div className="group flex flex-col w-full group relative justify-end">
            <Input
              required
              label="Cardholder Name"
              labelPlacement={"outside"}
              placeholder="Enter your cardholder name"
            />
          </div>
        </form>
      </div>
    </div>
  );
}
