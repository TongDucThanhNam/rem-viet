import React, { Suspense } from "react";

import ProductDetail from "@/components/product/product-detail";

async function getProduct(productId: string) {
  const res = await fetch(
    `${process.env.BACKEND_URL}/api/product/${productId}/variant`,
  );

  if (!res.ok) throw new Error("Failed to fetch san-pham");

  return res.json();
}

export default async function ProductPage({
  params,
}: {
  params: { productId: string };
}) {
  const initialData: any = await getProduct(params.productId);

  // console.log("Initial data:", initialData);
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ProductDetail initialData={initialData} productId={params.productId} />
    </Suspense>
  );
}
