import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cửa hàng lưới chống muỗi",
    short_name: "Lưới chống muỗi",
    description:
      "Cửa hàng lưới chống muỗi, lưới chống côn trùng, lưới chống muỗi cửa sổ, lưới chống muỗi cửa ra vào, lưới chống muỗi cửa sổ, lưới chống muỗi cửa ra vào, lưới chống muỗi cửa sổ, lưới chống muỗi cửa ra vào, lưới chống muỗi cửa sổ, lưới chống muỗi cửa ra vào, lưới chống muỗi cửa sổ, lưới chống muỗi cửa ra vào, lưới chống muỗi cửa sổ, lưới chống muỗi cửa ra vào, lưới chống muỗi cửa sổ, lưới chống muỗi cửa ra vào, lưới chống muỗi cửa sổ, lưới chống muỗi cửa ra vào, lưới chống muỗi cửa sổ, lưới chống muỗi cửa ra vào, lưới chống muỗi cửa sổ, lưới chống muỗi cửa ra vào, lưới chống muỗi cửa sổ, lưới chống muỗi cửa ra vào, lưới chống muỗi cửa sổ, lưới chống muỗi cửa ra vào",
    start_url: "/",
    display: "standalone",
    background_color: "#fff",
    theme_color: "#fff",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}