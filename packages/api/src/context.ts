import { createAuth } from "@rem-viet/auth";

import { authenticateCmsApiKey } from "./services/api-keys";
import {
  capabilitiesForRole,
  isStaffMfaRequired,
  resolveStaffRole,
} from "./services/staff";

export async function createContext({ req }: { req: Request }) {
  const session = await createAuth().api.getSession({
    headers: req.headers,
  });
  const staffRole = await resolveStaffRole(session?.user);
  const mfaRequired = isStaffMfaRequired(staffRole, session?.user);
  const apiKeyPrincipal = session
    ? null
    : await authenticateCmsApiKey(req.headers.get("authorization"));
  const capabilities = apiKeyPrincipal
    ? [...apiKeyPrincipal.capabilities]
    : mfaRequired
      ? []
      : capabilitiesForRole(staffRole);
  const actor =
    session && staffRole
      ? {
          userId: session.user.id,
          email: session.user.email ?? "",
          role: staffRole,
          requestId: req.headers.get("x-request-id") ?? crypto.randomUUID(),
        }
      : apiKeyPrincipal
        ? {
            userId: `service-account:${apiKeyPrincipal.serviceAccountId}`,
            email: `api-key:${apiKeyPrincipal.serviceAccountName}`,
            role: "system" as const,
            requestId: req.headers.get("x-request-id") ?? crypto.randomUUID(),
          }
        : null;

  return {
    auth: null,
    session,
    staffRole,
    actor,
    apiKeyPrincipal,
    authType: session
      ? ("session" as const)
      : apiKeyPrincipal
        ? ("apiKey" as const)
        : null,
    capabilities,
    isAdmin: Boolean(staffRole),
    mfaRequired,
    requestId:
      actor?.requestId ??
      req.headers.get("x-request-id") ??
      crypto.randomUUID(),
    clientIp:
      req.headers.get("cf-connecting-ip") ??
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown",
    userAgent: req.headers.get("user-agent") ?? "",
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
