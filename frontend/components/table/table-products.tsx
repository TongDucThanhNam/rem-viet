import {Pagination, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow,} from "@nextui-org/react";
import React from "react";

import {RenderCellProduct} from "@/components/table/render-product-cell";

import {products, products_columns} from "./data";

export const TableProducts = () => {
    const [page, setPage] = React.useState(1);
    const rowsPerPage = 4;

    const pages = Math.ceil(products.length / rowsPerPage);

    const items = React.useMemo(() => {
        const start = (page - 1) * rowsPerPage;
        const end = start + rowsPerPage;

        return products.slice(start, end);
    }, [page, products]);

    return (
        <div className="w-full flex flex-col gap-4">
            <Table
                aria-label="Example table with client side pagination"
                bottomContent={
                    <div className="flex w-full justify-center">
                        <Pagination
                            isCompact
                            showControls
                            showShadow
                            color="secondary"
                            page={page}
                            total={pages}
                            onChange={(page) => setPage(page)}
                        />
                    </div>
                }
                classNames={{
                    wrapper: "min-h-[222px]",
                }}
            >
                <TableHeader columns={products_columns}>
                    {(column) => (
                        <TableColumn
                            key={column.uid}
                            align={column.uid === "actions" ? "center" : "start"}
                            className={
                                column.uid === "description"
                                    ? "w-10 overflow-hidden text-ellipsis whitespace-nowrap"
                                    : ""
                            }
                            hideHeader={column.uid === "actions"}
                            textValue={column.name}
                        >
                            {column.name}
                        </TableColumn>
                    )}
                </TableHeader>
                <TableBody items={items}>
                    {(item) => (
                        <TableRow key={item.name} aria-label={`Row for ${item.name}`}>
                            {(columnKey) => (
                                <TableCell key={columnKey} aria-label={`Cell for ${columnKey}`}>
                                    {RenderCellProduct({product: item, columnKey: columnKey})}
                                </TableCell>
                            )}
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
};