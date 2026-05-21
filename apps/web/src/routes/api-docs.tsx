import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api-docs")({
  head: () => ({
    meta: [
      { title: "API docs - Rèm Việt" },
      {
        name: "description",
        content:
          "Tài liệu API đã migrate từ Express/Mongoose sang TanStack Start, tRPC, Drizzle và Cloudflare D1.",
      },
    ],
  }),
  component: ApiDocsRoute,
});

const endpointGroups = [
  {
    title: "Products",
    description: "Product CRUD và variant API từ Express backend cũ.",
    endpoints: [
      ["GET", "/api/products", "Danh sách sản phẩm, hỗ trợ search/sort/page/limit."],
      [
        "GET",
        "/api/products/:productId",
        "Alias frontend cũ trả sản phẩm kèm variant.",
      ],
      ["GET", "/api/product/:productId", "Chi tiết sản phẩm legacy."],
      [
        "GET",
        "/api/product/:productId/variant",
        "Chi tiết sản phẩm kèm variant.",
      ],
      ["POST", "/api/product", "Tạo sản phẩm, nhận cả imageurls và imageUrls."],
      ["PUT", "/api/product/:productId", "Cập nhật sản phẩm."],
      ["DELETE", "/api/product/:productId", "Xóa mềm sản phẩm."],
      ["POST", "/api/add-product", "Alias legacy từ admin cũ."],
      ["PUT", "/api/edit-product/:productId", "Alias legacy từ admin cũ."],
      ["POST", "/api/uploads/product-images", "Upload ảnh sản phẩm vào Cloudflare R2, yêu cầu admin."],
      ["GET", "/api/product-images/:key", "Đọc ảnh sản phẩm đã upload từ R2."],
    ],
  },
  {
    title: "Posts",
    description: "Notion posts cũ đã được lưu vào bảng posts trong D1.",
    endpoints: [
      ["GET", "/api/posts", "Danh sách bài viết."],
      ["GET", "/api/posts/:slug", "Chi tiết bài viết, hỗ trợ slug .html."],
      ["GET", "/api/get-bookmark", "Metadata cho Notion bookmark blocks."],
    ],
  },
  {
    title: "Orders và Telegram",
    description:
      "Các endpoint order/newsletter ghi D1 trước, Telegram là bước phụ nếu env được cấu hình.",
    endpoints: [
      ["POST", "/api/send-newletter", "Endpoint typo legacy từ Express cũ."],
      ["POST", "/api/send-newsletter", "Endpoint newsletter đúng chính tả."],
      ["POST", "/api/send-product-order", "Đơn hàng nhanh từ trang sản phẩm."],
      ["POST", "/api/send-cart-order", "Đơn hàng từ giỏ hàng."],
      ["GET", "/api/orders", "Danh sách đơn hàng cho admin đã đăng nhập."],
      ["POST", "/api/orders", "Tạo cart order."],
      ["GET", "/api/orders/:orderId", "Chi tiết đơn hàng."],
      ["PATCH", "/api/orders/:orderId", "Cập nhật trạng thái đơn hàng."],
      ["PUT", "/api/orders/:orderId", "Alias cập nhật trạng thái đơn hàng."],
    ],
  },
  {
    title: "Admin data",
    description: "Các bảng quản trị mới chạy trên Drizzle/D1.",
    endpoints: [
      ["GET", "/api/categories", "Danh sách danh mục."],
      ["POST", "/api/categories", "Tạo danh mục."],
      ["PUT", "/api/categories/:categoryId", "Cập nhật danh mục."],
      ["DELETE", "/api/categories/:categoryId", "Xóa danh mục."],
      ["GET", "/api/logs", "Danh sách logs."],
      ["POST", "/api/logs", "Tạo log."],
      ["GET", "/api/logs/:logId", "Chi tiết log."],
      ["PUT", "/api/logs/:logId", "Cập nhật log."],
      ["DELETE", "/api/logs/:logId", "Xóa log."],
      ["GET/POST", "/api/trpc/*", "tRPC router cho UI TanStack Start."],
      ["GET/POST", "/api/auth/*", "Better Auth handlers."],
    ],
  },
] as const;

function ApiDocsRoute() {
  return (
    <main className="bg-[linear-gradient(to_right,#80808012_3px,transparent_3px),linear-gradient(to_bottom,#80808012_3px,transparent_3px)] bg-[size:24px_24px]">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10">
        <div className="max-w-3xl">
          <p className="text-sm font-medium uppercase text-muted-foreground">
            TanStack Start API
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">
            API docs
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Bề mặt API cũ từ Express/Mongoose đã được gom vào `apps/web` bằng
            TanStack Start server routes, tRPC services, Drizzle schema và
            Cloudflare D1. Route này thay cho Swagger UI cũ ở `/api-docs`.
          </p>
        </div>

        <div className="grid gap-6">
          {endpointGroups.map((group) => (
            <section className="overflow-hidden rounded-md border bg-background" key={group.title}>
              <div className="border-b px-4 py-3">
                <h2 className="text-lg font-semibold tracking-normal">
                  {group.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {group.description}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="w-28 px-4 py-3 font-semibold">Method</th>
                      <th className="w-72 px-4 py-3 font-semibold">Path</th>
                      <th className="px-4 py-3 font-semibold">Mô tả</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.endpoints.map(([method, path, description]) => (
                      <tr className="border-t" key={`${method}-${path}`}>
                        <td className="px-4 py-3">
                          <span className="rounded-md bg-muted px-2 py-1 font-mono text-xs">
                            {method}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{path}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
