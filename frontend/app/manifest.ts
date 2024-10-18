import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cửa hàng lưới chống muỗi",
    short_name: "Lưới chống muỗi",
    description:
      "Cửa hàng chuyên cung cấp lưới chống muỗi, lưới chống côn trùng cho cửa sổ và cửa ra vào. Bảo vệ gia đình bạn khỏi côn trùng một cách hiệu quả.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#4a90e2",
    icons: [
      {
        src: "/src/icon-192x192.webp",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/src/icon-256x256.webp",
        sizes: "256x256",
        type: "image/png",
      },
      {
        src: "/src/icon-384x384.webp",
        sizes: "384x384",
        type: "image/png",
      },
      {
        src: "/src/icon-512x512.webp",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    categories: ["shopping", "home", "lifestyle"],
    orientation: "any",
    lang: "vi-VN",
    prefer_related_applications: false,
  };
}
