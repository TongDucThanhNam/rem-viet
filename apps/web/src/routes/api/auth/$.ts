import { createAuth } from "@rem-viet/auth";
import { recordAuthenticationAudit } from "@rem-viet/api/services/governance";
import { createFileRoute } from "@tanstack/react-router";

async function authenticationMetadata(request: Request) {
  const pathname = new URL(request.url).pathname;
  if (pathname.endsWith("/sign-in/email")) {
    try {
      const body = (await request.clone().json()) as { email?: unknown };
      return {
        kind: "sign-in" as const,
        email: typeof body.email === "string" ? body.email : "",
      };
    } catch {
      return { kind: "sign-in" as const, email: "" };
    }
  }
  if (pathname.endsWith("/sign-out")) {
    return { kind: "sign-out" as const, email: "" };
  }
  return null;
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const auth = createAuth();
        return auth.handler(request);
      },
      POST: async ({ request }) => {
        const auth = createAuth();
        const metadata = await authenticationMetadata(request);
        const signedOutSession =
          metadata?.kind === "sign-out"
            ? await auth.api.getSession({ headers: request.headers })
            : null;
        const response = await auth.handler(request);

        if (metadata) {
          const email =
            metadata.kind === "sign-out"
              ? signedOutSession?.user.email
              : metadata.email;
          try {
            await recordAuthenticationAudit({
              action:
                metadata.kind === "sign-out"
                  ? "auth.sign_out"
                  : response.ok
                    ? "auth.sign_in_success"
                    : "auth.sign_in_failed",
              email,
              requestId: request.headers.get("x-request-id"),
            });
          } catch (error) {
            console.error("[cms:audit] authentication event failed", {
              action: metadata.kind,
              error: error instanceof Error ? error.message : "unknown",
            });
          }
        }

        return response;
      },
    },
  },
});
