import { roleHasCapability, type CmsCapability } from "@rem-viet/cms";
import { initTRPC, TRPCError } from "@trpc/server";

import type { Context } from "./context";

export const t = initTRPC.context<Context>().create();

export const router = t.router;

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session || !ctx.staffRole) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Staff authentication required",
      cause: "No staff session",
    });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      staffRole: ctx.staffRole,
    },
  });
});

export function capabilityProcedure(capability: CmsCapability) {
  return t.procedure.use(({ ctx, next }) => {
    if (!ctx.session || !ctx.staffRole) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Staff authentication required",
        cause: "No staff session",
      });
    }

    if (!roleHasCapability(ctx.staffRole, capability)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Missing capability: ${capability}`,
      });
    }

    return next({
      ctx: {
        ...ctx,
        session: ctx.session,
        staffRole: ctx.staffRole,
      },
    });
  });
}
