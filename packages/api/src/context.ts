import { createAuth } from "@rem-viet/auth";
import { env } from "@rem-viet/env/server";

function adminEmails() {
  const value = (env as Env & { ADMIN_EMAILS?: string }).ADMIN_EMAILS ?? "";

  return new Set(
    value
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function createContext({ req }: { req: Request }) {
  const session = await createAuth().api.getSession({
    headers: req.headers,
  });
  const email = session?.user.email?.toLowerCase();

  return {
    auth: null,
    session,
    isAdmin: Boolean(email && adminEmails().has(email)),
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
