"use client"; // This is a comment

import React, { useEffect, useState } from "react";
import { TableProducts } from "@/components/table/table-products";
import process from "process";

export default function ProductPage() {
  const [products, setProducts] = useState<any[]>([]);

  //pagination
  const [currentPage, setCurrentPage] = useState(1);
  //Total number of products
  const [total, setTotal] = useState(1);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch(`/api/products?page=${currentPage}&&limit=8`);
        console.log(process.env.BACKEND_URL);
        console.log(process.env.TEST_ENV);

        if (!res.ok) {
          console.error("Failed to fetch products:", res);
          throw new Error("Network response was not ok");
        }
        const response = await res.json();

        console.log(response);
        setProducts(response.data);
        setTotal(response.totalPage);
      } catch (error) {
        console.error("Failed to fetch products:", error);
      }
    };

    fetchProducts().then(() => {
      //Log
      console.log("Fetch products success");
    });
  }, [currentPage]);

  return (
    <div className="my-14 lg:px-6 max-w-[95rem] mx-auto w-full flex flex-col gap-4">
      <div className="max-w-[95rem] mx-auto w-full">
        <TableProducts products={products} />
      </div>
    </div>
  );
}
