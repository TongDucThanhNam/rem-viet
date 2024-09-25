import {
  type SidebarItem,
  SidebarItemType,
} from "@/components/sidebar/sidebar";
import FacebookIcon from "@/components/icons/icons";
import React from "react";

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
    title: "Báo cáo",
  },

  //Products Nested
  {
    key: "products",
    title: "Sản phẩm",
    icon: "solar:pie-chart-2-outline",
    type: SidebarItemType.Nest,
    items: [
      {
        key: "manage_product",
        icon: "solar:users-group-rounded-linear",
        href: "/products",
        title: "Quản lý sản phẩm",
      },
      {
        key: "add-product",
        icon: "solar:users-group-rounded-linear",
        href: "/add-product",
        title: "Thêm sản phẩm",
      },
    ],
  },

  //Orders Nested
  {
    key: "orders",
    title: "Đơn hàng",
    icon: "solar:pie-chart-2-outline",
    type: SidebarItemType.Nest,
    items: [
      {
        key: "manage_order",
        icon: "solar:users-group-rounded-linear",
        href: "/orders",
        title: "Quản lý đơn hàng",
      },
      {
        key: "add-order",
        icon: "solar:users-group-rounded-linear",
        href: "/add-order",
        title: "Thêm đơn hàng",
      },
    ],
  },

  //Nhập xuất kho Nested
  {
    key: "inventory",
    title: "Nhập xuất kho",
    icon: "solar:pie-chart-2-outline",
    type: SidebarItemType.Nest,
    items: [
      {
        key: "manage_inventory",
        icon: "solar:users-group-rounded-linear",
        href: "/inventory",
        title: "Quản lý nhập xuất",
      },
      {
        key: "add-inventory",
        icon: "solar:users-group-rounded-linear",
        href: "/add-inventory",
        title: "Thêm nhập xuất",
      },
    ],
  },

  {
    key: "home",
    href: "/",
    icon: "solar:home-2-linear",
    title: "Trang chủ",
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


export const faqs = [
  {
    id: 1,
    question:
        "Tôi muốn một kích thước không có trong danh sách, tôi phải làm sao?",
    answer:
        "Bạn hãy liên hệ chúng tôi và cung cấp kích thước bạn muốn, chúng tôi sẽ tư vấn và sản xuất theo yêu cầu của bạn.",
  },
  {
    id: 2,
    question: "Làm thế nào để đặt hàng?",
    answer:
        "Bạn có thể đặt hàng trực tiếp trên website hoặc liên hệ với chúng tôi qua số điện thoại hoặc email.",
  },
  {
    id: 3,
    question: "Ưu điểm của chúng tôi so với sản phẩm khác trên thị trường?",
    answer:
        "Chúng tôi cam kết sản phẩm của chúng tôi chất lượng và thời gian sử dụng tốt nhất. Ngoài ra vì chúng tôi sản xuất tại Việt Nam, chúng tôi có thể điều chỉnh sản phẩm cho phù hợp với bạn nhất.",
  },
];

export const reviews = [
  {
    name: "Jon Slow",
    date: "August 1, 2024",
    icon: "123",
    title: "Quá tuyệt vời, chính tôi cũng không thể tin nổi",
    content: "Khi sử dụng sản phẩm này nhà tôi đã hết muỗi rõ rệt, cảm ơn bạn.",
  },
  {
    name: "Mai Linh",
    date: "July 15, 2024",
    icon: "123",
    title: "Sản phẩm đáng giá từng xu",
    content:
        "Tôi đã thử nhiều loại nhưng chưa có sản phẩm nào hiệu quả như thế này. Thực sự ấn tượng!",
  },
  {
    name: "Trần Quốc",
    date: "June 30, 2024",
    icon: "123",
    title: "Giải pháp hoàn hảo cho mùa hè",
    content:
        "Không còn phải lo lắng về muỗi khi đi dã ngoại nữa. Sản phẩm nhỏ gọn, dễ mang theo.",
  },
  {
    name: "Nguyễn Thảo",
    date: "June 1, 2024",
    icon: "123",
    title: "Hiệu quả vượt mong đợi",
    content:
        "Ban đầu tôi còn nghi ngờ, nhưng sau khi dùng thử, tôi đã phải thay đổi suy nghĩ. Rất đáng mua!",
  },
];
