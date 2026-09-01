import {
  Outlet,
  createFileRoute,
  redirect,
  useRouterState,
} from "@tanstack/react-router";

import AdminShell from "@/components/admin-shell";
import { getAdminUser } from "@/functions/get-admin-user";

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ location }) => {
    const session = await getAdminUser();

    if (!session) {
      throw redirect({ to: "/dang-nhap" });
    }

    if (session.mfaRequired && location.pathname !== "/admin/security") {
      throw redirect({ to: "/admin/security" });
    }

    return { session };
  },
  component: AdminLayoutRoute,
});

function AdminLayoutRoute() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const standalone =
    pathname === "/admin/home-preview" ||
    pathname === "/admin/settings-preview" ||
    pathname.endsWith("/preview");

  if (standalone) return <Outlet />;

  return (
    <AdminShell defaultSidebarExpanded={pathname !== "/admin/home"}>
      <Outlet />
    </AdminShell>
  );
}
