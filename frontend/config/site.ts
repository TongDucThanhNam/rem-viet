import {
  type SidebarItem,
  SidebarItemType,
} from "@/components/sidebar/sidebar";

export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "Rèm Việt",
  description:
    "Cửa hàng Rèm Việt, chuyên cung cấp các sản phẩm lưới chống muỗi chất lượng cao. Đến với chúng tôi, bạn sẽ được phục vụ tận tình, chu đáo.",
  navItems: [
    {
      label: "Trang chủ",
      href: "/",
    },
    // {
    //     label: "Bảng điều khiển",
    //     href: "/dashboard",
    // },
  ],
  links: {
    github: "https://github.com/tongducthanhnam",
  },
  image: "https://luoichongmuoi.cdn.vccloud.vn/remviet.webp",
};

export const heroSection = {
  hello: "Chào mừng đến với cửa hàng",
  title: "Rèm Việt",
  description:
    "Mang đến sự bảo vệ cho gia đình bạn khỏi những tác nhân như côn trùng,khói bụi, ...",
  videoUrl: "https://luoichongmuoi.cdn.vccloud.vn/remviet.mp4",
};

export const features = [
  {
    name: "Chất lượng sản phẩm",
    description:
      "Chất lượng sản phẩm là tiêu chí hàng đầu mà chúng tôi đặt ra. Chúng tôi cam kết cung cấp sản phẩm chất lượng, an toàn cho gia đình bạn.",
    href: "/",
  },
  {
    name: "Hỗ trợ 24/7",
    description:
      "Chúng tôi luôn sẵn sàng tư vấn, hỗ trợ bạn mọi lúc, mọi nơi. Hãy liên hệ với chúng tôi ngay hôm nay để được tư vấn miễn phí.",
    href: "/",
  },
  {
    name: "Giá cả phải chăng",
    description:
      "Chúng tôi không ngừng tìm tòi hòi hỏi áp dụng các kỹ thuật khoa học để tôi ưu quá trình sản xuất để đem đến giá cả phù hợp nhất cho người tiêu dùng.",
    href: "/",
  },
];

export const our_strength = {
  title: "Ưu thế của chúng tôi",
  content: [
    `Chúng tôi cam kết mang đến cho bạn những sản phẩm chất lượng nhất, giá cả phải chăng nhất và dịch vụ hỗ trợ tốt nhất.",
    "Không như các loại sản phẩm khác, sản phẩm của chúng tôi bền hơn rất nhiều, giúp bạn tiết kiệm chi phí và thời gian.",
    "Nếu bạn cần tư vấn, hãy liên hệ với chúng tôi ngay hôm nay để được tư vấn miễn phí.`,
  ],
  button: "Liên hệ ngay",
  video: "iuYum3L2cEg",
};

/**
 * Please check the https://nextui.org/docs/guide/routing to have a seamless router integration
 */

export const sectionNestedItems: SidebarItem[] = [
  //Dashboard
  {
    key: "dashboard",
    href: "/dashboard",
    icon: "solar:chart-outline",
    title: "Dashboard",
  },

  //Products Nested
  {
    key: "products",
    title: "Products",
    icon: "solar:pie-chart-2-outline",
    type: SidebarItemType.Nest,
    items: [
      {
        key: "manage_product",
        icon: "solar:users-group-rounded-linear",
        href: "/products",
        title: "Manage Product",
      },
      {
        key: "add-product",
        icon: "solar:users-group-rounded-linear",
        href: "/add-product",
        title: "Add Product",
      },
    ],
  },

  //Orders Nested
  {
    key: "orders",
    title: "Orders",
    icon: "solar:pie-chart-2-outline",
    type: SidebarItemType.Nest,
    items: [
      {
        key: "manage_order",
        icon: "solar:users-group-rounded-linear",
        href: "/orders",
        title: "Manage Order",
      },
      {
        key: "add-order",
        icon: "solar:users-group-rounded-linear",
        href: "/add-order",
        title: "Add Order",
      },
    ],
  },

  {
    key: "home",
    href: "/",
    icon: "solar:home-2-linear",
    title: "Home",
  },
];

export const footer = {
  map: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3919.2112628799364!2d106.6384076!3d10.7951252!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3175297c20ce6ff3%3A0x671008ae50b4a394!2zTMaw4bubaSBjaOG7kW5nIG114buXaQ!5e0!3m2!1svi!2s!4v1726648582357!5m2!1svi!2s",
  brand: "Rèm Việt",
  navItems: [
    {
      name: "Đầu trang",
      href: "#hero",
    },
  ],
};

export const fab = {
  phone: "tel:0986207619",
  zalo: "https://zalo.me/84949491964",
  facebook: "https://www.facebook.com/profile.php?id=100076172431695",
};
