import { createFileRoute, redirect } from "@tanstack/react-router";

import HomeEditorWorkspace from "@/components/home-editor-workspace";
import { getAdminUser } from "@/functions/get-admin-user";

export const Route = createFileRoute("/admin/home")({
  component: AdminHomeRoute,
  beforeLoad: async () => ({ session: await getAdminUser() }),
  loader: async ({ context }) => {
    if (!context.session) throw redirect({ to: "/dang-nhap" });
  },
});

function AdminHomeRoute() {
  const { session } = Route.useRouteContext();
  return <HomeEditorWorkspace session={session} />;
}
