import { Card, CardBody, CardHeader } from "@nextui-org/react";
import React from "react";

import FacebookIcon from "@/components/icons/icons";

export const CardBalance2 = () => {
  return (
    <Card className="w-full max-w-md bg-blue-700 rounded-xl shadow-md">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <h1 className="text-lg font-semibold">Báo cáo đơn hàng</h1>
        <FacebookIcon className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardBody>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">2,400</span>
              <span className="text-sm text-muted-foreground">Đơn hàng</span>
            </div>
            <div className="flex items-center text-sm text-red-500">
              <FacebookIcon className="h-4 w-4 mr-1" />
              <span>- 4.5%</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <FacebookIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-lg font-semibold">12,138 USD</span>
            <span className="text-sm text-muted-foreground">
              Tổng doanh thu
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">
                Đơn hoàn thành
              </span>
              <div className="flex items-center gap-1">
                <FacebookIcon className="h-4 w-4 text-green-500" />
                <span className="text-sm font-semibold">1,930</span>
              </div>
              <span className="text-xs text-muted-foreground">Đơn hàng</span>
            </div>

            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Đơn hủy</span>
              <div className="flex items-center gap-1">
                <FacebookIcon className="h-4 w-4 text-red-500" />
                <span className="text-sm font-semibold">470</span>
              </div>
              <span className="text-xs text-muted-foreground">Đơn hàng</span>
            </div>

            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Khách VIP</span>
              <div className="flex items-center gap-1">
                <FacebookIcon className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-semibold">150</span>
              </div>
              <span className="text-xs text-muted-foreground">Khách hàng</span>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};
