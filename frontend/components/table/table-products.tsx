import {
  cn,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@nextui-org/react";
import React from "react";

import { RenderCellProduct } from "@/components/table/render-product-cell";
import Topbar from "@/components/table/topbar";
import TopContent from "@/components/table/top-content";
import BottomContent from "@/components/table/bottom-cotent";

export const products_columns = [
  { name: "Name", uid: "name" },
  { name: "Description", uid: "description" },
  { name: "Price", uid: "price" },
  { name: "Sold", uid: "soldQuantity" },
  { name: "Status", uid: "isActive" },
  { name: "UpdatedAt", uid: "updatedAt" },
  { name: "Actions", uid: "actions" },
];

type Product = {
  name: string;
  description: string;
  price: number;
  soldQuantity: number;
  isActive: boolean;
  updatedAt: string;
  actions: React.ReactNode;
};

export const TableProducts = ({ products }: { products: Product[] }) => {
  const [page, setPage] = React.useState(1);
  const rowsPerPage = 4;
  const pages = Math.ceil(products.length / rowsPerPage);
  const items: Product[] = React.useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;

    return products.slice(start, end)
  }, [page, products]);

  return (
    <div className="w-full flex flex-col gap-4">
      {<Topbar products={products} />}
      <Table
        isHeaderSticky
        layout={"fixed"}
        aria-label="Example table with custom cells, pagination and sorting"
        topContent={<TopContent products_columns={products_columns} />}
        topContentPlacement={"outside"}
        bottomContent={
          <BottomContent page={page} pages={pages} setPage={setPage} />
        }
        bottomContentPlacement={"outside"}
      >
        <TableHeader columns={products_columns}>
          {(column) => (
            <TableColumn
              key={column.uid}
              align={column.uid === "actions" ? "center" : "start"}
              className={cn(
                "text-sm font-semibold",
                column.uid === "name" && "w-1/4 min-w-[100px]",
                column.uid === "description" && "w-1/4 min-w-[100px]",
                column.uid === "price" && "w-1/6 min-w-[80px]",
                column.uid === "stock" && "w-1/6 min-w-[80px]",
                column.uid === "actions" && "w-1/12 min-w-[60px]",
              )}
              hideHeader={column.uid === "actions"}
            >
              <div className="truncate">{column.name}</div>
            </TableColumn>
          )}
        </TableHeader>
        <TableBody emptyContent={"No users found"} items={items}>
          {(item) => (
            <TableRow key={item.name} aria-label={`Row for ${item.name}`}>
              {(columnKey) => (
                <TableCell key={columnKey} aria-label={`Cell for ${columnKey}`}>
                  {RenderCellProduct({ product: item, columnKey: columnKey })}
                </TableCell>
              )}
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};
