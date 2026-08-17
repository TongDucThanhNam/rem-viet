import { createAuth } from "@rem-viet/auth";

import { capabilitiesForRole, resolveStaffRole } from "./services/staff";

export async function createContext({ req }: { req: Request }) {
  const session = await createAuth().api.getSession({
    headers: req.headers,
  });
  const staffRole = await resolveStaffRole(session?.user);

  return {
    auth: null,
    session,
    staffRole,
    capabilities: capabilitiesForRole(staffRole),
    isAdmin: Boolean(staffRole),
    requestId: req.headers.get("x-request-id") ?? crypto.randomUUID(),
    clientIp:
      req.headers.get("cf-connecting-ip") ??
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown",
    userAgent: req.headers.get("user-agent") ?? "",
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
