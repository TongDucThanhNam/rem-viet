// /api/add-san-pham/route.ts

import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const res = await request.json();
    console.log("res:", res);
    const response = await fetch(`${process.env.BACKEND_URL}/api/product`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(res),
    });

    if (response.ok) {
      console.log("Product saved successfully");
      return NextResponse.json({
        statusCode: 200,
      });
    } else {
      console.error("Failed to save san-pham");
      return NextResponse.error();
    }
  } catch (error) {
    console.error("Failed to save san-pham", error);
  }
}
