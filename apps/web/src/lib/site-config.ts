type SiteNavRoute =
  | "/"
  | "/gioi-thieu"
  | "/bai-viet"
  | "/danh-sach-san-pham"
  | "/san-pham";
type SiteNavItem =
  | { label: string; to: SiteNavRoute }
  | { label: string; href: string };

export const siteConfig = {
  name: "Rèm Việt",
  url: "https://luoichongmuoi.shop",
  description:
    "Cửa hàng Rèm Việt, chuyên cung cấp rèm cửa và lưới chống muỗi chất lượng cao.",
  image: "https://rem-viet.s3.ap-southeast-2.amazonaws.com/remviet.webp",
  navItems: [
    { label: "Trang chủ", to: "/" },
    { label: "Giới thiệu", to: "/gioi-thieu" },
    { label: "Bài viết", to: "/bai-viet" },
  ] satisfies SiteNavItem[],
  adminItems: [
    { label: "Dashboard", to: "/admin/dashboard" },
    { label: "Sản phẩm", to: "/admin/products" },
    { label: "Danh mục", to: "/admin/categories" },
    { label: "Đơn hàng", to: "/admin/orders" },
  ],
  links: {
    github: "https://github.com/tongducthanhnam",
    zalo: "https://zalo.me/84949491964",
    facebook: "https://www.facebook.com/profile.php?id=100076172431695",
    phone: "0399649743",
  },
  footer: {
    map: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3919.2112628799364!2d106.6384076!3d10.7951252!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3175297c20ce6ff3%3A0x671008ae50b4a394!2zTMaw4bubaSBjaOG7kW5nIG114buXaQ!5e0!3m2!1svi!2s!4v1726648582357!5m2!1svi!2s",
    address: "Lưới chống muỗi Rèm Việt, TP.HCM",
    brand: "Rèm Việt",
    navItems: [
      { label: "Đầu trang", href: "/#hero" },
      { label: "Bài viết", to: "/bai-viet" },
    ] satisfies SiteNavItem[],
  },
  heroImages: ["/src/swiper1.jpg", "/src/swiper2.jpg", "/src/swiper3.jpg"],
} as const;

export function cloudflareImageUrl(imageUrl?: string) {
  if (!imageUrl) {
    return "";
  }

  if (imageUrl.startsWith("/") || imageUrl.includes("/cdn-cgi/image/")) {
    return imageUrl;
  }

  return `${siteConfig.url}/cdn-cgi/image/fit=scale-down,width=640,format=auto/${imageUrl}`;
}

export function productImageUrl(imageUrl?: string) {
  return cloudflareImageUrl(imageUrl) || "/src/800x800.png";
}
