"use client";

import React, { useEffect, useState } from "react";
import { Spacer } from "@nextui-org/spacer";

import ProductItem from "@/components/product/product-item";
import ReviewComponent from "@/components/product/review-item";
import { useCartStore } from "@/store/useCartStore";

export default function ProductDetails({
  productId,
  initialData,
}: {
  productId: string;
  initialData: any;
}) {
  {
    const [product, setProduct] = React.useState<any>(initialData.data.product);
    // variants
    const [variants, setVariants] = useState<any>(initialData.data.variants);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const addToCart = useCartStore((state) => state.addToCart);

    useEffect(() => {
      async function fetchProduct() {
        const res = await fetch(`/api/products/${productId}`);
        const data = await res.json();

        console.log("Product fetched:", data);
        setProduct(data.product);

        return data;
      }

      fetchProduct().then((data: any) => {
        console.log("Data fetched:", data);

        if (!data) {
          return;
        }
        console.log("Product fetched");
        //variants
        const variants = data.data.variants;

        console.log("Variants fetched:", variants);
        setProduct(data.data.product);
        setVariants(variants);
        setIsLoading(false);
      });
    }, [productId]);

    if (isLoading) {
      return (
        <div>
          <ProductItem
            addToCart={addToCart}
            isLoading={isLoading}
            product={product}
            variants={variants}
          />

          <Spacer y={3} />

          {/* Review */}
          <ReviewComponent isLoading={isLoading} />
        </div>
      );
    }

    return (
      //returning button
      <div>
        <ProductItem
          addToCart={addToCart}
          isLoading={isLoading}
          product={product}
          variants={variants}
        />

        <Spacer y={3} />

        {/* Review */}
        <ReviewComponent isLoading={isLoading} />
      </div>
    );
  }
}
