import { siteManifestSchema } from "@rem-viet/cms";

declare const __SITE_MANIFEST__: unknown;

type SiteNavRoute =
  "/" | "/gioi-thieu" | "/bai-viet" | "/danh-sach-san-pham" | "/san-pham";
type SiteNavItem =
  { label: string; to: SiteNavRoute } | { label: string; href: string };

export const siteManifest = siteManifestSchema.parse(__SITE_MANIFEST__);

export const siteConfig = {
  name: siteManifest.name,
  url: siteManifest.siteUrl,
  description: siteManifest.description,
  image: siteManifest.brand.logo,
  navItems: [
    { label: "Trang chủ", to: "/" },
    { label: "Giới thiệu", to: "/gioi-thieu" },
    ...(siteManifest.features.blog
      ? ([{ label: "Bài viết", to: "/bai-viet" }] satisfies SiteNavItem[])
      : []),
  ] satisfies SiteNavItem[],
  adminItems: [
    { label: "Dashboard", to: "/admin/dashboard" },
    ...(siteManifest.features.catalog
      ? [{ label: "Sản phẩm", to: "/admin/products" as const }]
      : []),
    { label: "Danh mục", to: "/admin/categories" },
    ...(siteManifest.features.orders
      ? [{ label: "Đơn hàng", to: "/admin/orders" as const }]
      : []),
  ],
  links: {
    github: siteManifest.contact.socials.github ?? "",
    zalo: siteManifest.contact.socials.zalo ?? "",
    facebook: siteManifest.contact.socials.facebook ?? "",
    shopee: siteManifest.contact.socials.shopee ?? "",
    phone: siteManifest.contact.phone,
  },
  footer: {
    map: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3919.2112628799364!2d106.6384076!3d10.7951252!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3175297c20ce6ff3%3A0x671008ae50b4a394!2zTMaw4bubaSBjaOG7kW5nIG114buXaQ!5e0!3m2!1svi!2s!4v1726648582357!5m2!1svi!2s",
    address: siteManifest.contact.address,
    brand: siteManifest.name,
    navItems: [
      { label: "Đầu trang", href: "/#hero" },
      ...(siteManifest.features.blog
        ? ([{ label: "Bài viết", to: "/bai-viet" }] satisfies SiteNavItem[])
        : []),
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
