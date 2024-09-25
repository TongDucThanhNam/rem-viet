import {Card, CardBody, CardHeader} from "@nextui-org/react";
import React from "react";
import FacebookIcon, {Community} from "@/components/icons/icons";


export const CardBalance3 = () => {
    return (
        <Card className="w-full max-w-md bg-primary text-primary-foreground rounded-xl shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <h1 className="text-lg font-semibold">Tình hình sản phẩm</h1>
                <FacebookIcon className="h-5 w-5 text-primary-foreground/70" />
            </CardHeader>
            <CardBody>
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-2xl font-bold">1,311</span>
                            <span className="text-sm text-primary-foreground/70">Tổng sản phẩm</span>
                        </div>
                        <div className="flex items-center text-sm text-emerald-400">
                            <FacebookIcon className="h-4 w-4 mr-1" />
                            <span>+ 5.2%</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-lg font-semibold">3,910</span>
                        <span className="text-sm text-primary-foreground/70">Giao dịch trong tháng</span>
                    </div>

                    <div className="grid grid-cols-3 gap-4 pt-4 border-t border-primary-foreground/20">
                        <div className="flex flex-col">
                            <span className="text-xs text-primary-foreground/70">Nhập kho</span>
                            <div className="flex items-center gap-1">
                                <FacebookIcon className="h-4 w-4 text-emerald-400" />
                                <span className="text-sm font-semibold">930</span>
                            </div>
                            <span className="text-xs text-primary-foreground/70">Sản phẩm</span>
                        </div>

                        <div className="flex flex-col">
                            <span className="text-xs text-primary-foreground/70">Xuất kho</span>
                            <div className="flex items-center gap-1">
                                <FacebookIcon className="h-4 w-4 text-red-400" />
                                <span className="text-sm font-semibold">820</span>
                            </div>
                            <span className="text-xs text-primary-foreground/70">Sản phẩm</span>
                        </div>

                        <div className="flex flex-col">
                            <span className="text-xs text-primary-foreground/70">Sản phẩm hot</span>
                            <div className="flex items-center gap-1">
                                <FacebookIcon className="h-4 w-4 text-yellow-400" />
                                <span className="text-sm font-semibold">125</span>
                            </div>
                            <span className="text-xs text-primary-foreground/70">Mặt hàng</span>
                        </div>
                    </div>
                </div>
            </CardBody>
        </Card>
    );
};
