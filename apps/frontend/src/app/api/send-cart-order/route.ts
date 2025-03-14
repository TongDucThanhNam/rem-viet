// /api/send-newsletter

import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const res = await request.json();

    // console.log("Cart order:", res);

    const response = await fetch(
      `${process.env.BACKEND_URL}/api/send-cart-order`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          body: res,
        }),
      },
    );

    return NextResponse.json({
      statusCode: 200,
    });
  } catch (error) {
    console.error("Error:", error);

    return NextResponse.error();
  }
}
