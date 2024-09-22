import CardItem from "@/components/product-grid/card-items";
import React, { useEffect, useState } from "react";
import { Pagination, Spacer } from "@nextui-org/react";
import process from "process";

export default function ProductGrid({}: {}) {
  //pagination
  const [currentPage, setCurrentPage] = useState(1);
  //Total number of products
  const [total, setTotal] = useState(1);

  const [products, setProducts] = useState<any[]>([]);

  //isLoading
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch(`/api/products?page=${currentPage}&&limit=5`);
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
        <h2 className="text-2xl font-bold tracking-tight px-10">Danh sách sản phẩm </h2>
        <div
            className={
              "grid w-full grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-5 px-10"
            }
        >

          {products.map((product: any) => (
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
