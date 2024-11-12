import React from "react";
import { cn } from "@/components/lib/server-utils/utils";

// Server components (default in App Router)
import MyNavbar from "@/components/my-navbar/my-navbar";
import Footer from "@/components/footer/footer";

import { BreadcrumbItem, Breadcrumbs } from "@nextui-org/breadcrumbs";
import FABButton from "@/components/button/fab-button";
import SwiperComp from "@/components/swiper/swiper";
import { Card, CardBody } from "@nextui-org/card";

import { Button, ButtonGroup } from "@nextui-org/react";
import { Spacer } from "@nextui-org/spacer";
import ProductGrid from "@/components/product-grid/product-grid";

export default function Home() {
  let prices = [
    "Dưới 1 triệu",
    "1 triệu - 2 triệu",
    "2 triệu - 3 triệu"
  ];

  return (
    <div className="flex flex-col max-w-screen max-h-screen">
      <MyNavbar />
      <div
        className={cn(
          "max-w-screen h-full",
          "overflow-y-auto",
          "scrollbar-hide scroll-smooth",
          "bg-[linear-gradient(to_right,#80808012_3px,transparent_3px),linear-gradient(to_bottom,#80808012_3px,transparent_3px)] bg-[size:24px_24px]"
        )}
      >

        {/*Banner*/}
        <div className="flex items-center justify-center ">
          <SwiperComp />
        </div>

        {/*Breadcumb*/}
        <div className="ml-40 mt-10">
          <Breadcrumbs>
            <BreadcrumbItem>Trang chủ</BreadcrumbItem>
            <BreadcrumbItem>Nhà cửa và đời sống</BreadcrumbItem>
            <BreadcrumbItem>Nhà bếp</BreadcrumbItem>
          </Breadcrumbs>
        </div>


        {/*Filter bar*/}
        <div className="flex items-center justify-center mt-6">
          <Card>
            <CardBody>
              <ButtonGroup isDisabled>
                <Button color={"primary"} variant="solid">Phổ biến</Button>
                <Button>Mới nhất</Button>
                <Button>Bán chạy</Button>
              </ButtonGroup>

              <Spacer y={1} />
            </CardBody>

          </Card>
        </div>

        {/*Grid of Product*/}
        <div className={"flex justify-center"}>
          <div className={"my-auto flex h-full w-full max-w-7xl flex-col gap-2 p-4"}>
            <ProductGrid />
          </div>
        </div>

        <div
          className="flex flex-col justify-center"
        >
          <Footer />
        </div>
      </div>

      <FABButton />
    </div>
  );
}
