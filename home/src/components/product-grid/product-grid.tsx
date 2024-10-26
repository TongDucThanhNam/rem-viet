import React from "react";

import ProductGridComponent from "@/components/product-grid/products";

export default function ProductGrid({products}: { products: any }) {
    return <ProductGridComponent myProducts={products}/>;
}
