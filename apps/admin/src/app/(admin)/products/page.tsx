import React from "react";

import { TableProducts } from "@/components/table/table-products";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function ProductPage() {
  const res = await fetch(`${process.env.BACKEND_URL}/api/products`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-cache",
  });
  const data = await res.json();
  const products = data.data;
  // console.log(products);

  return (
    <div className="my-14 lg:px-6 max-w-[95rem] mx-auto w-full flex flex-col gap-4">
      <div className="max-w-[95rem] mx-auto w-full">
        <TableProducts products={products} />
      </div>
    </div>
  );
}
