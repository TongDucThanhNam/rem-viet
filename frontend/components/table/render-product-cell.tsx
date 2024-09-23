import { Chip, Tooltip } from "@nextui-org/react";
import React from "react";

import { DeleteIcon, EditIcon, EyeIcon } from "../icons/icons";

interface Props {
  product: any[number];
  columnKey: any;
}

export const RenderCellProduct = ({ product, columnKey }: Props) => {
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
            <Tooltip content="Details">
              <button onClick={() => console.log("View product", product.id)}>
                <EyeIcon fill="#979797" size={20} />
              </button>
            </Tooltip>
          </div>
          <div>
            <Tooltip color="secondary" content="Edit product">
              <button onClick={() => console.log("Edit product", product.id)}>
                <EditIcon fill="#979797" size={20} />
              </button>
            </Tooltip>
          </div>
          <div>
            <Tooltip
              color="danger"
              content="Delete product"
              onClick={() => console.log("Delete product", product.id)}
            >
              <button>
                <DeleteIcon fill="#FF0080" size={20} />
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
        // TODO: Add a currency formatter
        <span>{cellValue}</span>
      );
    //Description
    case "description":
      return (
        // TODO: Add a hover effect to show the full description
        <div className={""}>
          <p className={"truncate"}>{cellValue}</p>
        </div>
      );

    default:
      return cellValue;
  }
};
