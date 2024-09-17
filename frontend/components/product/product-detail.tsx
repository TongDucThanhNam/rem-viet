"use client";

import React, { useEffect, useState } from "react";
import { Skeleton, Spacer } from "@nextui-org/react";
import ProductItem from "@/components/product/product-item";
import ReviewComponent from "@/components/product/review-item";

export default function ProductDetails({ productId }: { productId: string }) {
  {
    const [product, setProduct] = React.useState<any>({
      id: "1",
      name: "Product 1",
      price: "???-???",
      imageUrl: "/src/product.webp",
      description:
        "The Nike Air Max 270 delivers an even more adaptive fit than before. Stretch material in the upper moves with your foot, while the tri-star outsole pattern adjusts to your every step for a ride that delivers support and flexibility where you need it.",
    });
    // variants
    const [variants, setVariants] = useState<any>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
      const fetchProduct = async () => {
        try {
          const response = await fetch(`/api/product/${productId}/variant`, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          });
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          // "{\"Màu sắc\": \"Nam Châm, Lưới Trắng\", \"Kích thước\": \"rộng 90, cao 210\"}",
          const data = await response.json();
          console.log("Product fetched:", data);
          if (data.statusCode !== 200) {
            //TODO: 404 Product not found
            console.error("Product not found:", data);
          }

          //product
          const product = data.data.product;
          setProduct(product);

          return data;
        } catch (error) {
          console.error("Failed to fetch product:", error);
          setIsLoading(false);
        }
      };
      fetchProduct().then((data) => {
        console.log("Product fetched");
        //variants
        const variants = data.data.variants;
        console.log("Variants fetched:", variants);
        setVariants(variants);
        setIsLoading(false);
      });
    }, [productId]);

    if (isLoading) {
      return (
        <div>
          <Skeleton>
            <ProductItem product={product} variants={variants} />
          </Skeleton>

          <Spacer y={3} />

          {/* Review */}
          <Skeleton>
            <ReviewComponent />
          </Skeleton>
        </div>
      );
    }

    return (
      //returning button
      <div>
        <ProductItem product={product} variants={variants} />

        <Spacer y={3} />

        {/* Review */}
        <ReviewComponent />
      </div>
    );
  }
}
