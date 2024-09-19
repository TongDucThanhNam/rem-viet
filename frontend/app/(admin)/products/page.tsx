"use client"; // This is a comment

import React from "react";
import { InfoIcon } from "@nextui-org/shared-icons";
import { TableProducts } from "@/components/table/table-products";
import {
  DotsIcon,
  ExportIcon,
  SettingsIcon,
  TrashIcon,
} from "@/components/icons/icons";
import { Button, Input } from "@nextui-org/react";

export default function ProductPage() {
  return (
    <div className="my-14 lg:px-6 max-w-[95rem] mx-auto w-full flex flex-col gap-4">
      <h3 className="text-xl font-semibold">All Products</h3>
      <div className="flex justify-between flex-wrap gap-4 items-center">
        <div className="flex items-center gap-3 flex-wrap md:flex-nowrap">
          <Input
            classNames={{
              input: "w-full",
              mainWrapper: "w-full",
            }}
            placeholder="Search products"
            aria-label="Search products"
          />
          <SettingsIcon aria-label="Settings" />
          <TrashIcon aria-label="Trash" />
          <InfoIcon aria-label="Info" />
          <DotsIcon aria-label="More options" />
        </div>
        <div className="flex flex-row gap-3.5 flex-wrap">
          <Button color="primary" startContent={<ExportIcon />}>
            Export to CSV
          </Button>
        </div>
      </div>
      <div className="max-w-[95rem] mx-auto w-full">
        <TableProducts />
      </div>
    </div>
  );
}
