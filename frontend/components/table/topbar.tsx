import React, { useMemo } from "react";
import { Button, Chip, Link, Spacer } from "@nextui-org/react";
import {
  ExportIcon,
  SolarAddCircleBoldDuotone,
} from "@/components/icons/icons";

export default function Topbar({ products }: { products: any }) {
  function handleExport() {
    console.log("Exporting...");
  }

  //Topbar
  return useMemo(() => {
    return (
      <div className="mb-[18px] flex items-center justify-between">
        <div className="flex w-[226px] items-center gap-2">
          <h1 className="text-2xl font-[700] leading-[32px]">Sản phẩm</h1>
          <Chip
            className="hidden items-center sm:flex"
            size="sm"
            variant="flat"
          >
            {products.length}
          </Chip>
        </div>

        <div className={"flex"}>
          <Button
            onPress={handleExport}
            size={"sm"}
            color="success"
            startContent={<ExportIcon />}
          >
            Xuất file Excel
          </Button>

          <Spacer x={2} />

          <Button
            as={Link}
            href={"/add-san-pham"}
            size={"sm"}
            color="primary"
            endContent={<SolarAddCircleBoldDuotone />}
          >
            Thêm sản phẩm
          </Button>
        </div>
      </div>
    );
  }, []);
}
