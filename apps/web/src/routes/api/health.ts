import { checkOperationsHealth } from "@rem-viet/api/services/operations";
import { deploymentProvenanceFromEnv } from "@rem-viet/cms";
import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const deployment = deploymentProvenanceFromEnv(
            env as unknown as Record<string, unknown>,
          );
          const health = await checkOperationsHealth();
          return Response.json(
            { ...health, deployment },
            {
              status: health.status === "ok" ? 200 : 503,
              headers: { "Cache-Control": "no-store" },
            },
          );
        } catch (error) {
          console.error("[health] runtime check failed", error);
          return Response.json(
            {
              status: "degraded",
              checks: { database: "failed", deployment: "failed" },
            },
            { status: 503, headers: { "Cache-Control": "no-store" } },
          );
        }
      },
    },
  },
});
