import { Card, CardBody, CardHeader } from "@nextui-org/react";
import React from "react";
import { BarChart } from "recharts";

import FacebookIcon from "@/components/icons/icons";

export const CardBalance1 = () => {
  return (
    <Card className="w-full max-w-md bg-primary text-primary-foreground rounded-xl shadow-md">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <h1 className="text-sm font-medium">Doanh thu tháng</h1>
        <BarChart className="h-4 w-4 text-primary-foreground/70" />
      </CardHeader>
      <CardBody>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FacebookIcon className="h-5 w-5 text-primary-foreground/70" />
              <span className="text-2xl font-bold">14 Triệu</span>
            </div>
            <div className="flex items-center text-sm text-emerald-400">
              <FacebookIcon className="h-4 w-4 mr-1" />
              <span>+4.5%</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <FacebookIcon className="h-4 w-4 text-primary-foreground/70" />
            <span className="text-sm">100 Đơn hàng</span>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-primary-foreground/20">
            <div className="flex flex-col">
              <span className="text-xs text-primary-foreground/70">
                Thu nhập
              </span>
              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold text-emerald-400">
                  ↓
                </span>
                <span className="text-sm">100,930</span>
              </div>
              <span className="text-xs text-primary-foreground/70">USD</span>
            </div>

            <div className="flex flex-col">
              <span className="text-xs text-primary-foreground/70">
                Chi phí
              </span>
              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold text-red-400">↑</span>
                <span className="text-sm">54,120</span>
              </div>
              <span className="text-xs text-primary-foreground/70">USD</span>
            </div>

            <div className="flex flex-col">
              <span className="text-xs text-primary-foreground/70">
                Khách VIP
              </span>
              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold text-yellow-400">
                  ⭐
                </span>
                <span className="text-sm">125</span>
              </div>
              <span className="text-xs text-primary-foreground/70">
                Khách hàng
              </span>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};
