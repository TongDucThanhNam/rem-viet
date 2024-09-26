import * as XLSX from 'xlsx';

import React, {useMemo} from "react";
import {Button, Chip, Link, Spacer} from "@nextui-org/react";
import {ExportIcon} from "@/components/icons/icons";
import {Icon} from "@iconify/react";

export default function Topbar({products}: {products:any}) {

    function handleExport() {
        // Create a worksheet from the products array
        const worksheet = XLSX.utils.json_to_sheet(products);

        // Create a new workbook and append the worksheet
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Products");

        // Generate a binary string representation of the workbook
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

        // Create a Blob from the binary string
        const file = new Blob([excelBuffer], { type: 'application/octet-stream' });

        // Create a link element and trigger the download
        const element = document.createElement("a");
        element.href = URL.createObjectURL(file);
        element.download = "products.xlsx";
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    }
    //Topbar
    return useMemo(() => {
        return (
            <div className="mb-[18px] flex items-center justify-between">
                <div className="flex w-[226px] items-center gap-2">
                    <h1 className="text-2xl font-[700] leading-[32px]">Sản phẩm</h1>
                    <Chip className="hidden items-center sm:flex" size="sm" variant="flat">
                        {products.length}
                    </Chip>
                </div>

                <div className={"flex"}
                >
                    <Button
                        onPress={handleExport}
                        size={"sm"} color="success" startContent={<ExportIcon/>}>
                        Xuất file Excel
                    </Button>

                    <Spacer x={2}/>

                    <Button
                        as={Link}
                        href={"/add-product"}
                        size={"sm"} color="primary" endContent={<Icon icon="solar:add-circle-bold"/>}>
                        Thêm sản phẩm
                    </Button>
                </div>
            </div>
        )
    }, []);
}