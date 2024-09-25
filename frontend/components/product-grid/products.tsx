"use client";

import CardItem from "@/components/product-grid/card-items";
import { Pagination } from "@nextui-org/react";
import React, { useState, useEffect } from "react";

export default function ProductGridComponent({ myProducts }: { myProducts: any }) {
    console.log(myProducts);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5; // Number of items per page
    const total = Math.ceil(myProducts.length / itemsPerPage); // Total number of pages

    // Calculate the products to display on the current page
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentProducts = myProducts.slice(startIndex, endIndex);

    useEffect(() => {
        setCurrentPage(1); // Reset to first page when myProducts changes
    }, [myProducts]);

    return (
        <>
            <h2 className="text-2xl font-bold tracking-tight px-10">
                Danh sách sản phẩm{" "}
            </h2>
            <div
                className={
                    "grid w-full grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-5 px-10"
                }
            >
                {currentProducts.map((product: any) => (
                    <CardItem
                        key={product._id}
                        productId={product._id}
                        imageUrls={product.imageUrls}
                        productSize={product.size}
                        description={product.description}
                        name={product.name}
                        price={product.price}
                    />
                ))}
            </div>
            <div className="flex items-center justify-center py-2 sm:py-4">
                <Pagination
                    showControls
                    initialPage={1}
                    total={total}
                    onChange={(page: number) => {
                        setCurrentPage(page);
                    }}
                />
            </div>
        </>
    );
}