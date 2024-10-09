// /api/edit-san-pham/route.ts

import { NextResponse } from "next/server";

export async function PUT(
  request: Request,
  { params }: { params: { productId: string } },
) {
  try {
    const res = await request.json();
    const response = await fetch(
      `${process.env.BACKEND_URL}/api/product/${params.productId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(res),
      },
    );

    if (response.ok) {
      console.log("Product updated successfully");
      return NextResponse.json({
        statusCode: 200,
      });
    } else {
      console.error("Failed to update san-pham");
      return NextResponse.error();
    }
  } catch (error) {
    console.error("Failed to update san-pham", error);
  }
}