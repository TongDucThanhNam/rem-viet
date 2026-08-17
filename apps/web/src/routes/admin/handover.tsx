import { roleHasCapability } from "@rem-viet/cms";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";

import AdminShell from "@/components/admin-shell";
import HandoverPilotWorkspace from "@/components/handover-pilot-workspace";
import { getAdminUser } from "@/functions/get-admin-user";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/admin/handover")({
  component: HandoverAdminRoute,
  beforeLoad: async () => ({ session: await getAdminUser() }),
  loader: ({ context }) => {
    if (!context.session) throw redirect({ to: "/dang-nhap" });
    if (!roleHasCapability(context.session.staffRole, "audit.read"))
      throw redirect({ to: "/admin/dashboard" });
  },
});

function HandoverAdminRoute() {
  const { session } = Route.useRouteContext();
  const trpc = useTRPC();
  const runtimeQuery = useQuery(
    trpc.operations.readiness.runtime.queryOptions(),
  );
  if (!session?.user) return null;

  return (
    <AdminShell>
      <div className="mx-auto w-full max-w-7xl">
        <HandoverPilotWorkspace
          deployment={runtimeQuery.data?.deployment}
          error={runtimeQuery.error?.message}
          isLoading={runtimeQuery.isLoading}
          onRetry={() => void runtimeQuery.refetch()}
          operatorId={session.user.id}
        />
      </div>
    </AdminShell>
  );
}
