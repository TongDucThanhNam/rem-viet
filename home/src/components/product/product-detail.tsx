"use client";

import React, {useState} from "react";
import {Spacer} from "@nextui-org/react";
import ProductItem from "@/components/product/product-item";
import ReviewComponent from "@/components/product/review-item";
import {useCartStore} from "@/store/useCartStore";

export default function ProductDetails({
                                           myProduct, myVariants
                                       }: {
    myProduct: any,
    myVariants: any
}) {
    {
        const [product, setProduct] = React.useState<any>(myProduct);
        // variants
        const [variants, setVariants] = useState<any>(myVariants);
        const addToCart = useCartStore((state) => state.addToCart);

        return (
            //returning button
            <div>
                <ProductItem
                    addToCart={addToCart}
                    isLoading={false}
                    product={product}
                    variants={variants}
                />

                <Spacer y={3}/>

                {/* Review */}
                <ReviewComponent isLoading={false}/>
            </div>
        );
    }
}