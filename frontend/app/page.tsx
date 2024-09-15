"use client"; // This is a comment

import React, {useEffect, useState} from "react";

import CardItem from "@/components/product-grid/card-items";
import MyPagination from "@/components/product-grid/Pagination";
import {MyNavbar} from "@/components/my-navbar/my-navbar";

// import {NavbarWrapper} from "@/components/my-navbar/my-navbar";

interface Products {
    products: {
        _id: number;
        name: string;
        description: string;
        size: string[];
        price: string;
    };
}

export default function Home() {
    const [products, setProducts] = useState<any[]>([]);

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const res = await fetch("http://localhost:3001/api/products");

                if (!res.ok) {
                    console.error("Failed to fetch products:", res);
                    throw new Error("Network response was not ok");
                }
                const data = await res.json();

                console.log(data);
                setProducts(data.products);
            } catch (error) {
                console.error("Failed to fetch products:", error);
            }
        };

        fetchProducts().then((r) => console.log(r));
    }, []);

    return (
        <>
            <MyNavbar/>
            <div className={"bg-background bg-radial"}>
                {/*Grid of Product*/}
                <div className="relative flex min-h-dvh flex-col bg-background bg-radial pt-16">
                    <div className="flex items-center h-auto justify-center p-4">
                        <div
                            className={
                                "my-auto flex h-full w-full max-w-7xl flex-col gap-2 p-4"
                            }
                        >
                            <div
                                className={
                                    "grid w-full grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4"
                                }
                            >
                                {products.map((product) => (
                                    <CardItem
                                        key={product._id}
                                        productId={product._id}
                                        productSize={product.size}
                                        description={product.description}
                                        name={product.name}
                                        price={product.price}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center justify-center mb-14">
                    <MyPagination/>
                </div>
            </div>
        </>
    );
}
