import type { CmsCapability } from "@rem-viet/cms";
import {
  Activity,
  Boxes,
  ClipboardCheck,
  ClipboardList,
  FileText,
  FolderTree,
  Home,
  Image,
  Inbox,
  LayoutDashboard,
  ListFilter,
  Megaphone,
  PackageOpen,
  Plus,
  Settings,
  ShieldCheck,
  Shuffle,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export type AdminFeature = "blog" | "catalog" | "leads" | "orders";
export type AdminSectionKey =
  | "dashboard"
  | "products"
  | "orders"
  | "inventory"
  | "content"
  | "system"
  | "home";

type AdminNavItemDefinition = {
  description: string;
  feature?: AdminFeature;
  icon: LucideIcon;
  label: string;
  pageTitle: string;
  requiredCapability?: CmsCapability;
  to: string;
};

type AdminDirectSectionDefinition = AdminNavItemDefinition & {
  key: AdminSectionKey;
};

type AdminGroupSectionDefinition = {
  feature?: AdminFeature;
  icon: LucideIcon;
  items: readonly AdminNavItemDefinition[];
  key: AdminSectionKey;
  label: string;
};

type AdminNavigationSectionDefinition =
  AdminDirectSectionDefinition | AdminGroupSectionDefinition;

export const adminNavigationSections = [
  {
    key: "dashboard",
    label: "Báo cáo",
    pageTitle: "Báo cáo",
    description: "Tổng hợp trực tiếp từ dữ liệu đơn hàng và sản phẩm hiện tại.",
    to: "/admin/dashboard",
    icon: LayoutDashboard,
  },
  {
    key: "products",
    label: "Sản phẩm",
    icon: Boxes,
    feature: "catalog",
    items: [
      {
        label: "Danh sách sản phẩm",
        pageTitle: "Sản phẩm",
        description:
          "Tìm kiếm, lọc và cập nhật danh mục sản phẩm đang vận hành.",
        to: "/admin/products",
        icon: Boxes,
      },
      {
        label: "Thêm sản phẩm",
        pageTitle: "Thêm sản phẩm",
        description: "Tạo sản phẩm mới bằng dữ liệu và quy tắc hiện có.",
        to: "/admin/products/new",
        icon: Plus,
      },
      {
        label: "Danh mục",
        pageTitle: "Danh mục sản phẩm",
        description: "Tạo và cập nhật nhóm sản phẩm trong cửa hàng.",
        to: "/admin/categories",
        icon: FolderTree,
      },
    ],
  },
  {
    key: "orders",
    label: "Đơn hàng",
    icon: ClipboardList,
    feature: "orders",
    items: [
      {
        label: "Danh sách đơn hàng",
        pageTitle: "Đơn hàng",
        description:
          "Theo dõi khách hàng, sản phẩm, thanh toán và trạng thái xử lý.",
        to: "/admin/orders",
        icon: ClipboardList,
      },
      {
        label: "Thêm đơn hàng",
        pageTitle: "Thêm đơn hàng",
        description: "Tạo đơn thủ công từ sản phẩm và biến thể đang hoạt động.",
        to: "/admin/orders/new",
        icon: Plus,
      },
    ],
  },
  {
    key: "inventory",
    label: "Nhập xuất kho",
    icon: PackageOpen,
    feature: "catalog",
    items: [
      {
        label: "Tồn kho",
        pageTitle: "Nhập xuất kho",
        description:
          "Theo dõi số lượng tồn, đã bán và trạng thái sản phẩm hiện tại.",
        to: "/admin/inventory",
        icon: PackageOpen,
      },
      {
        label: "Điều chỉnh kho",
        pageTitle: "Thêm nhập xuất",
        description: "Cập nhật số lượng tồn kho trên sản phẩm hiện có.",
        to: "/admin/inventory/new",
        icon: Plus,
      },
    ],
  },
  {
    key: "content",
    label: "Nội dung",
    icon: FileText,
    items: [
      {
        label: "Trang chủ CMS",
        pageTitle: "Trang chủ CMS",
        description: "Biên tập nội dung và bố cục trang chủ công khai.",
        to: "/admin/home",
        icon: Home,
      },
      {
        label: "Bài viết",
        pageTitle: "Bài viết",
        description: "Quản lý bản nháp, bài đã xuất bản và metadata SEO.",
        to: "/admin/posts",
        icon: FileText,
        feature: "blog",
      },
      {
        label: "Thêm bài viết",
        pageTitle: "Thêm bài viết",
        description: "Tạo bản nháp bài viết mới.",
        to: "/admin/posts/new",
        icon: Plus,
        feature: "blog",
      },
      {
        label: "Trang nội dung",
        pageTitle: "Trang nội dung",
        description: "Quản lý các trang nội dung có cấu trúc.",
        to: "/admin/pages",
        icon: FileText,
      },
      {
        label: "Chiến dịch bản địa hóa",
        pageTitle: "Chiến dịch bản địa hóa",
        description:
          "Biên tập collection đa ngôn ngữ bằng editor shell và secure preview dùng chung.",
        to: "/admin/campaigns",
        icon: Megaphone,
        requiredCapability: "content.readDraft",
      },
      {
        label: "Thư viện media",
        pageTitle: "Thư viện media",
        description: "Tải lên, mô tả và quản lý tài nguyên hình ảnh.",
        to: "/admin/media",
        icon: Image,
      },
      {
        label: "Khách hàng tiềm năng",
        pageTitle: "Khách hàng tiềm năng",
        description: "Xử lý các biểu mẫu liên hệ và yêu cầu tư vấn.",
        to: "/admin/leads",
        icon: Inbox,
        feature: "leads",
        requiredCapability: "leads.manage",
      },
      {
        label: "Chuyển hướng",
        pageTitle: "Chuyển hướng",
        description: "Bảo toàn lưu lượng và SEO khi địa chỉ nội dung thay đổi.",
        to: "/admin/redirects",
        icon: Shuffle,
        requiredCapability: "redirects.manage",
      },
      {
        label: "Cài đặt website",
        pageTitle: "Cài đặt website",
        description: "Quản lý thương hiệu, liên hệ, mạng xã hội và điều hướng.",
        to: "/admin/settings",
        icon: Settings,
        requiredCapability: "settings.manage",
      },
    ],
  },
  {
    key: "system",
    label: "Hệ thống",
    icon: ListFilter,
    items: [
      {
        label: "Tự động hóa và release",
        pageTitle: "Tự động hóa và release",
        description:
          "Theo dõi công việc nền, release nhiều nội dung và webhook đã ký.",
        to: "/admin/operations",
        icon: Workflow,
        requiredCapability: "audit.read",
      },
      {
        label: "Hiệu năng thực tế",
        pageTitle: "Hiệu năng thực tế",
        description: "Theo dõi Web Vitals từ lưu lượng trang công khai.",
        to: "/admin/performance",
        icon: Activity,
        requiredCapability: "audit.read",
      },
      {
        label: "Pilot bàn giao",
        pageTitle: "Pilot bàn giao",
        description:
          "Chạy checklist bàn giao có giám sát trên đúng deployment staging.",
        to: "/admin/handover",
        icon: ClipboardCheck,
        requiredCapability: "audit.read",
      },
      {
        label: "Nhật ký kiểm toán",
        pageTitle: "Nhật ký kiểm toán",
        description: "Theo dõi thay đổi theo người thực hiện và thời điểm.",
        to: "/admin/audit",
        icon: ShieldCheck,
        requiredCapability: "audit.read",
      },
      {
        label: "Bảo mật tài khoản",
        pageTitle: "Bảo mật tài khoản",
        description: "Xác minh email và quản lý các thiết bị đang đăng nhập.",
        to: "/admin/security",
        icon: ShieldCheck,
      },
      {
        label: "Nhân sự và phân quyền",
        pageTitle: "Nhân sự và phân quyền",
        description: "Quản lý tài khoản, vai trò và quyền truy cập CMS.",
        to: "/admin/staff",
        icon: Users,
        requiredCapability: "staff.manage",
      },
      {
        label: "Nhật ký kỹ thuật",
        pageTitle: "Nhật ký kỹ thuật",
        description: "Kiểm tra các bản ghi kỹ thuật phục vụ vận hành.",
        to: "/admin/logs",
        icon: ListFilter,
        requiredCapability: "audit.read",
      },
    ],
  },
  {
    key: "home",
    label: "Trang chủ công khai",
    pageTitle: "Trang chủ công khai",
    description: "Mở website công khai trong cùng cửa sổ.",
    to: "/",
    icon: Home,
  },
] as const satisfies readonly AdminNavigationSectionDefinition[];

export type AdminRouteMeta = {
  description: string;
  navTo: string;
  sectionKey: AdminSectionKey;
  sectionLabel: string;
  title: string;
};

const dynamicAdminRoutes = [
  {
    pattern: /^\/admin\/products\/[^/]+\/edit\/?$/,
    sectionKey: "products",
    navTo: "/admin/products",
    title: "Sửa sản phẩm",
    description: "Cập nhật thông tin, hình ảnh, giá và biến thể sản phẩm.",
  },
  {
    pattern: /^\/admin\/products\/[^/]+\/?$/,
    sectionKey: "products",
    navTo: "/admin/products",
    title: "Chi tiết sản phẩm",
    description: "Xem thông tin và trạng thái hiện tại của sản phẩm.",
  },
  {
    pattern: /^\/admin\/posts\/[^/]+\/edit\/?$/,
    sectionKey: "content",
    navTo: "/admin/posts",
    title: "Sửa bài viết",
    description: "Cập nhật bản nháp, lịch xuất bản và phiên bản bài viết.",
  },
] as const;

function sectionLabel(sectionKey: AdminSectionKey) {
  return (
    adminNavigationSections.find((section) => section.key === sectionKey)
      ?.label ?? "Quản trị"
  );
}

function normalizePathname(pathname: string) {
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "");
}

export function getAdminRouteMeta(pathname: string): AdminRouteMeta {
  const normalizedPathname = normalizePathname(pathname);

  for (const section of adminNavigationSections) {
    if ("items" in section) {
      const item = section.items.find(
        (candidate) => normalizePathname(candidate.to) === normalizedPathname,
      );
      if (item) {
        return {
          description: item.description,
          navTo: item.to,
          sectionKey: section.key,
          sectionLabel: section.label,
          title: item.pageTitle,
        };
      }
      continue;
    }

    if (normalizePathname(section.to) === normalizedPathname) {
      return {
        description: section.description,
        navTo: section.to,
        sectionKey: section.key,
        sectionLabel: section.label,
        title: section.pageTitle,
      };
    }
  }

  const dynamicRoute = dynamicAdminRoutes.find((route) =>
    route.pattern.test(normalizedPathname),
  );
  if (dynamicRoute) {
    return {
      description: dynamicRoute.description,
      navTo: dynamicRoute.navTo,
      sectionKey: dynamicRoute.sectionKey,
      sectionLabel: sectionLabel(dynamicRoute.sectionKey),
      title: dynamicRoute.title,
    };
  }

  return {
    description: "Quản lý nội dung và vận hành website.",
    navTo: normalizedPathname,
    sectionKey: "content",
    sectionLabel: "Quản trị",
    title: "Quản trị",
  };
}
