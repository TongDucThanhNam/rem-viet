import React, {useMemo} from "react";
import {Button, Chip, Link, Spacer} from "@nextui-org/react";
import {ExportIcon} from "@/components/icons/icons";
import {Icon} from "@iconify/react";

export default function Topbar({products}: {products:any}) {
    //Topbar
    return useMemo(() => {
        return (
            <div className="mb-[18px] flex items-center justify-between">
                <div className="flex w-[226px] items-center gap-2">
                    <h1 className="text-2xl font-[700] leading-[32px]">Sản phẩm</h1>
                    <Chip className="hidden items-center text-default-500 sm:flex" size="sm" variant="flat">
                        {products.length}
                    </Chip>
                </div>

                <div className={"flex"}
                >
                    <Button
                        as={Link}
                        href={"/products/export"}
                        size={"sm"} color="primary" startContent={<ExportIcon/>}>
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