import React from "react";

import ProductGridComponent from "@/components/product-grid/products";

export default async function ProductGrid({}: {}) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/products/`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    return <div>Failed to fetch</div>;
  }
  const data = await res.json();
  const products = data.data;

  return <ProductGridComponent myProducts={products} />;
}
