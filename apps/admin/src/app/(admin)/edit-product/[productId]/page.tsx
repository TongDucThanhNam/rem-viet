import { notFound } from "next/navigation";

import EditProductComponent from "@/components/edit-product/edit-product-component";

export default async function EditProductPage({
  params,
}: {
  params: { productId: string };
}) {
  const productId = params.productId;
  // console.log("Product ID:", productId);

  try {
    // Fetch san-pham
    const response = await fetch(
      `${process.env.BACKEND_URL}/api/product/${productId}/variant`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-cache",
      },
    );

    if (!response.ok) {
      throw new Error("Failed to fetch san-pham");
    }

    const data = await response.json();
    // console.log("Product fetched:", data);

    const myProduct = data.data.product;
    const myVariants = data.data.variants;

    // Preprocess variants
    const preProcessingVariant: { [key: string]: string[] } = {};
    const variantCombinationArray = myVariants.map(
      (variant: { values: string; key: any; variantPrice: any }) => {
        const values = JSON.parse(variant.values);

        for (const key in values) {
          if (!preProcessingVariant[key]) {
            preProcessingVariant[key] = [];
          }
          if (!preProcessingVariant[key].includes(values[key])) {
            preProcessingVariant[key].push(values[key]);
          }
        }

        return {
          key: variant.key,
          values,
          variantPrice: variant.variantPrice,
        };
      },
    );

    const variantArray = Object.keys(preProcessingVariant).map((key) => ({
      name: key,
      values: preProcessingVariant[key].map((value) => ({ value })),
    }));

    return (
      <EditProductComponent
        myProduct={myProduct}
        myVariantCombinationArray={variantCombinationArray}
        myVariants={variantArray}
      />
    );
  } catch (error) {
    console.error("Error fetching san-pham:", error);
    notFound();
  }
}
