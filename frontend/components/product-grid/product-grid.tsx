import CardItem from "@/components/product-grid/card-items";
import React from "react";

export default function ProductGrid({products, isLoading}: { products: any, isLoading: boolean }) {
    return (
        <>
            <h2 className="text-2xl font-bold tracking-tight">Danh sách sản phẩm </h2>
            <div
                className={
                    "grid w-full grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4"
                }
            >

                {products.map((product:any) => (
                    <CardItem
                        key={product._id}
                        productId={product._id}
                        imageUrls={product.imageUrls}
                        productSize={product.size}
                        description={product.description}
                        isLoading={isLoading}
                        name={product.name}
                        price={product.price}
                    />
                ))}
            </div>
        </>
    )
}