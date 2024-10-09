// /api/products/{productId}/route.ts
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: { productId: string } },
) {
  const productId = params.productId;
  // Fetch your san-pham data here
  try {
    const response = await fetch(
      `${process.env.BACKEND_URL}/api/product/${productId}/variant`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
    const data = await response.json();
    if (data.statusCode !== 200) {
      //TODO: 404 Product not found
      console.error("Product not found:", data);
      return NextResponse.rewrite(new URL("/not-found", request.url));
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch san-pham:", error);
    return NextResponse.error();
  }
}
