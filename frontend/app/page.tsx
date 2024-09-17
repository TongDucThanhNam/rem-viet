"use client"; // This is a comment

import React, { useEffect, useState } from "react";

import CardItem from "@/components/product-grid/card-items";
import MyNavbar from "@/components/my-navbar/my-navbar";
import { Pagination, Skeleton } from "@nextui-org/react";
import * as process from "process";
import Footer from "@/components/footer/footer";

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

const placeholderProducts = Array.from({ length: 8 }, (_, index) => ({
  _id: `placeholder-${index}`,
  name: "Loading...",
  imageUrls: ["https://down-vn.img.susercontent.com/file/vn-11134207-7r98o-lzv7svt4s219e6"],
  description: "Loading...",
  size: ["Loading..."],
  price: "Loading...,",
}));

export default function Home() {
  const [products, setProducts] = useState<any[]>([]);

  //pagination
  const [currentPage, setCurrentPage] = useState(1);
  //Total number of products
  const [total, setTotal] = useState(1);

  //isLoading
  const [isLoading, setIsLoading] = useState(true);

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
      setIsLoading(false);
    });
  }, [currentPage]);

  return (
    <>
      <MyNavbar />
      <div className={"bg-background bg-radial"}>
        {/*Grid of Product*/}
        {isLoading ? (
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
                  {placeholderProducts.map((product, index) => (
                    <Skeleton key={`Skeleton-${index}`}>
                      <CardItem
                        key={product._id}
                        productId={product._id}
                        imageUrls={product.imageUrls}
                        productSize={product.size}
                        description={product.description}
                        name={product.name}
                        price={product.price}
                      />
                    </Skeleton>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
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
                      imageUrls={product.imageUrls}
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
        )}

        <div className="flex items-center justify-center mb-14">
          <Pagination
            showControls
            initialPage={1}
            total={total}
            onChange={(page: number) => {
              setCurrentPage(page);
            }}
          />
        </div>
      </div>

      <Footer/>

    </>
  );
}
