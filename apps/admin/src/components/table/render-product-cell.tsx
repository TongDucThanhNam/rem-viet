"use client";

import { Chip, Tooltip } from "@nextui-org/react";
import React from "react";
import { useRouter } from "next/navigation";

import {
  DeleteFilledIcon,
  EditLinearIcon,
  EyeFilledIcon,
} from "@/components/icons/icons";

interface Props {
  product: Record<string, unknown>;
  columnKey: string;
}

// "createdAt": "2024-09-18T07:16:59.315Z",
function formatDate(date: string | number | Date) {
  const d = new Date(date);

  return `${d.getDate()}/${d.getMonth()}/${d.getFullYear()}`;
}

export const RenderCellProduct = ({ product, columnKey }: Props) => {
  const router = useRouter();

  const cellValue = product[columnKey];

  switch (columnKey) {
    case "name":
      return <p>{cellValue}</p>;

    case "isActive":
      return (
        <Chip
          color={cellValue === true ? "success" : "danger"}
          size="sm"
          variant="flat"
        >
          <span className="capitalize text-xs">
            {cellValue ? "Active" : "Disable"}
          </span>
        </Chip>
      );

    case "actions":
      return (
        <div className="flex items-center gap-4 ">
          <div>
            <Tooltip content="Xem sản phẩm">
              <button
                onClick={() => {
                  router.push(`/view-product/${product._id}`);
                }}
              >
                <EyeFilledIcon fill="#979797" size={20} />
              </button>
            </Tooltip>
          </div>
          <div>
            <Tooltip color="secondary" content="Sửa sản phẩm">
              <button
                onClick={() => {
                  router.push(`/edit-product/${product._id}`);
                }}
              >
                <EditLinearIcon fill="#979797" size={20} />
              </button>
            </Tooltip>
          </div>
          <div>
            <Tooltip color="danger" content="Xoá sản phẩm" onClick={() => {}}>
              <button>
                <DeleteFilledIcon fill="#FF0080" size={20} />
              </button>
            </Tooltip>
          </div>
        </div>
      );
    // Brand
    case "brand":
      return <span>{cellValue}</span>;

    // Size
    case "size":
      return <span>{cellValue}</span>;

    // Color
    case "color":
      return <span>{cellValue}</span>;

    // Price
    case "price":
      return (
        <span>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(cellValue))}</span>
      );
    //Description
    case "description":
      return (
        <Tooltip content={String(cellValue)} delay={500}>
          <p className="truncate max-w-xs">{String(cellValue)}</p>
        </Tooltip>
      );

    case "updatedAt":
      return <span> {formatDate(cellValue)}</span>;

    default:
      return cellValue;
  }
};
