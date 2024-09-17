import {Input} from "@nextui-org/input";
import {Radio, RadioGroup} from "@nextui-org/react";
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
                            label="Email của bạn"
                            labelPlacement="outside"
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
                                placeholder="Nhập họ của bạn"
                            />
                        </div>

                        {/*Last Name*/}
                        <div className="group flex flex-col w-full group relative justify-end">
                            <Input
                                required
                                label="Tên của bạn"
                                labelPlacement="outside"
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
                                placeholder="Lê Văn Lương, Quận 7, TP.HCM"
                            />
                        </div>

                        {/*Specific address*/}
                        <div className="group flex flex-col w-full group relative justify-end">
                            <Input
                                isRequired
                                label="Specific address"
                                labelPlacement="outside"
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
                                placeholder="Quận 7"
                            />
                        </div>

                        {/*City*/}
                        <div className="group flex flex-col w-full group relative justify-end">
                            <Input
                                isRequired
                                label="Tỉnh/Thành phố"
                                labelPlacement="outside"
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
                                placeholder="700000"
                            />
                        </div>

                        {/*Phone number*/}
                        <div className="group flex flex-col w-full group relative justify-end">
                            <Input
                                required
                                label="Số điện thoại"
                                labelPlacement="outside"
                                placeholder="0901234567"
                            />
                        </div>
                    </div>

                    {/*Address Type*/}
                    <div className="relative flex flex-col gap-2 ml-1 mt-6">
                        <span className="relative text-foreground-500">Loại địa chỉ</span>
                        <RadioGroup className="" orientation={"horizontal"}>
                            <Radio value="1">Nhà riêng</Radio>
                            <Radio value="2">Cơ quan</Radio>
                            <Radio value="3">Khác </Radio>
                        </RadioGroup>
                    </div>
                    <PaymentMethod className="w-[420px]"/>

                    {/*Card number*/}
                    <div className="group flex flex-col w-full group relative justify-end">
                        <Input
                            isRequired
                            label="Nhập số thẻ"
                            labelPlacement={"outside"}
                            placeholder="XXXX-XXXX-XXXX-XXXX"
                        />
                    </div>

                    {/*Cardholder Name*/}
                    <div className="group flex flex-col w-full group relative justify-end">
                        <Input
                            required
                            label="Nhập tên trên thẻ"
                            labelPlacement={"outside"}
                            placeholder="Nguyen Van A"
                        />
                    </div>
                </form>
            </div>
        </div>
    );
}
