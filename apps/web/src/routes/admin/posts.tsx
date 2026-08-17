import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { getAdminUser } from "@/functions/get-admin-user";

export const Route = createFileRoute("/admin/posts")({
  beforeLoad: async () => {
    const session = await getAdminUser();
    return { session };
  },
  loader: async ({ context }) => {
    if (!context.session) {
      throw redirect({ to: "/dang-nhap" });
    }
  },
  component: PostsLayoutRoute,
});

function PostsLayoutRoute() {
  return <Outlet />;
}
