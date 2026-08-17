import { roleHasCapability } from "@rem-viet/cms";
import { listSubmissions } from "@rem-viet/api/services/operations";
import { createFileRoute } from "@tanstack/react-router";

import { getAdminUser } from "@/functions/get-admin-user";

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export const Route = createFileRoute("/api/leads/export.csv")({
  server: {
    handlers: {
      GET: async () => {
        const session = await getAdminUser();
        if (!session || !roleHasCapability(session.staffRole, "leads.manage"))
          return new Response("Forbidden", { status: 403 });
        const rows = await listSubmissions({ limit: 500 });
        const keys = [
          ...new Set(rows.flatMap((row) => Object.keys(row.payload))),
        ];
        const csv = [
          ["id", "form", "status", "source", "createdAt", ...keys]
            .map(csvCell)
            .join(","),
          ...rows.map((row) =>
            [
              row.id,
              row.formKey,
              row.status,
              row.sourcePage,
              row.createdAt.toISOString(),
              ...keys.map((key) => row.payload[key]),
            ]
              .map(csvCell)
              .join(","),
          ),
        ].join("\r\n");
        return new Response(`\uFEFF${csv}`, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
            "Cache-Control": "private, no-store",
          },
        });
      },
    },
  },
});
