// /api/get-bookmark

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json(
      { error: "URL parameter is missing" },
      { status: 400 },
    );
  }

  console.log("Fetching bookmark for:", url);

  try {
    const apiKey = "pk_f890de2ad1f6b330dab3681d1aff8c3566707bbf";
    const apiUrl = `https://jsonlink.io/api/extract?url=${url}&api_key=${apiKey}`;

    const res = await fetch(apiUrl);

    if (!res.ok) {
      console.error("Failed to fetch bookmark:", res.statusText);

      return NextResponse.json(
        { error: res.statusText },
        { status: res.status },
      );
    }

    const data = await res.json();

    console.log("Bookmark fetched:", data);

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch bookmark:", error);

    return NextResponse.json({ error: error }, { status: 500 });
  }
}
