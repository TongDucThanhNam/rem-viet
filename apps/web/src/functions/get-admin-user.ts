import { env } from "@rem-viet/env/server";
import { createServerFn } from "@tanstack/react-start";

import { authMiddleware } from "@/middleware/auth";

function adminEmails() {
  const value = (env as Env & { ADMIN_EMAILS?: string }).ADMIN_EMAILS ?? "";

  return new Set(
    value
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export const getAdminUser = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const email = context.session?.user.email?.toLowerCase();

    if (!email || !adminEmails().has(email)) {
      return null;
    }

    return context.session;
  });
