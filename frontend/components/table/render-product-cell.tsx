import {Chip, Tooltip} from "@nextui-org/react";
import React from "react";

import {DeleteIcon} from "../icons/table/delete-icon";
import {EditIcon} from "../icons/table/edit-icon";
import {EyeIcon} from "../icons/table/eye-icon";

import {products} from "./data";

interface Props {
    product: (typeof products)[number];
    columnKey: string | React.Key;
}

export const RenderCellProduct = ({product, columnKey}: Props) => {
    // @ts-ignore
    const cellValue = product[columnKey];

    switch (columnKey) {
        case "name":
            return <p>{cellValue}</p>;

        case "status":
            return (
                <Chip
                    color={
                        cellValue === "active"
                            ? "success"
                            : cellValue === "paused"
                                ? "danger"
                                : "warning"
                    }
                    size="sm"
                    variant="flat"
                >
                    <span className="capitalize text-xs">{cellValue}</span>
                </Chip>
            );

        case "actions":
            return (
                <div className="flex items-center gap-4 ">
                    <div>
                        <Tooltip content="Details">
                            <button onClick={() => console.log("View product", product.id)}>
                                <EyeIcon fill="#979797" size={20}/>
                            </button>
                        </Tooltip>
                    </div>
                    <div>
                        <Tooltip color="secondary" content="Edit product">
                            <button onClick={() => console.log("Edit product", product.id)}>
                                <EditIcon fill="#979797" size={20}/>
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
                                <DeleteIcon fill="#FF0080" size={20}/>
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
            return <span>{cellValue}</span>;
        //Description
        case "description":
            return (
                <div className={"w-20"}>
                    <p className={"truncate hover:text-clip"}>{cellValue}</p>
                </div>
            );

        default:
            return cellValue;
    }
};
