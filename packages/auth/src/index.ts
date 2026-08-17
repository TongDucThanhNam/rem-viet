import { createDb } from "@rem-viet/db";
import * as schema from "@rem-viet/db/schema/auth";
import { env } from "@rem-viet/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";

export function createAuth() {
  const db = createDb();
  const trustedOrigins = [env.CORS_ORIGIN, env.BETTER_AUTH_URL];

  if (process.env.NODE_ENV !== "production") {
    trustedOrigins.push(
      "http://localhost:3001",
      "http://127.0.0.1:3001",
      "http://localhost:3011",
      "http://127.0.0.1:3011",
      "http://localhost:3020",
      "http://127.0.0.1:3020",
    );
  }

  return betterAuth({
    advanced: {
      ipAddress: {
        ipAddressHeaders: ["cf-connecting-ip"],
      },
    },
    database: drizzleAdapter(db, {
      provider: "sqlite",

      schema: schema,
    }),
    trustedOrigins: [...new Set(trustedOrigins)],
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    plugins: [tanstackStartCookies()],
  });
}
