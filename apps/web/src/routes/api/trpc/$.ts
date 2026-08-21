import { createContext } from "@rem-viet/api/context";
import { appRouter } from "@rem-viet/api/routers/index";
import { createFileRoute } from "@tanstack/react-router";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { rejectCrossSiteMutation } from "@/lib/mutation-request-security";

function handler({ request }: { request: Request }) {
  const crossSite = rejectCrossSiteMutation(request);
  if (crossSite) return crossSite;
  return fetchRequestHandler({
    req: request,
    router: appRouter,
    createContext,
    endpoint: "/api/trpc",
  });
}

export const Route = createFileRoute("/api/trpc/$")({
  server: {
    handlers: {
      GET: handler,
      POST: handler,
    },
  },
});
