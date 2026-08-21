import { createDb } from "@rem-viet/db";
import * as schema from "@rem-viet/db/schema/auth";
import { env } from "@rem-viet/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";

import { sendAuthEmail } from "./email.js";

export * from "./email.js";

async function deliverAuthEmail(input: {
  to: string;
  subject: string;
  text: string;
}) {
  const result = await sendAuthEmail(input, {
    values: env as unknown as Record<string, string | undefined>,
  });
  if (result.status !== "sent") {
    throw new Error("Transactional authentication email delivery failed");
  }
}

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
      minPasswordLength: 12,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 30 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await deliverAuthEmail({
          to: user.email,
          subject: "Đặt lại mật khẩu CMS",
          text: `Một yêu cầu đặt lại mật khẩu vừa được tạo. Liên kết chỉ dùng một lần và hết hạn sau 30 phút:\n\n${url}\n\nNếu bạn không yêu cầu, hãy bỏ qua email này.`,
        });
      },
    },
    emailVerification: {
      expiresIn: 30 * 60,
      sendVerificationEmail: async ({ user, url }) => {
        await deliverAuthEmail({
          to: user.email,
          subject: "Xác minh email quản trị CMS",
          text: `Xác minh địa chỉ email quản trị bằng liên kết sau:\n\n${url}\n\nLiên kết hết hạn sau 30 phút.`,
        });
      },
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/*": { window: 60, max: 5 },
        "/request-password-reset": { window: 5 * 60, max: 3 },
        "/send-verification-email": { window: 5 * 60, max: 3 },
        "/two-factor/*": { window: 15 * 60, max: 10 },
      },
    },
    plugins: [
      twoFactor({
        issuer: "Rèm Việt CMS",
        accountLockout: {
          enabled: true,
          maxFailedAttempts: 5,
          durationSeconds: 15 * 60,
        },
      }),
      tanstackStartCookies(),
    ],
  });
}
