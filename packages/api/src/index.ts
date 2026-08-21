import { roleHasCapability, type CmsCapability } from "@rem-viet/cms";
import { initTRPC, TRPCError } from "@trpc/server";

import type { Context } from "./context";
import { isStaffMfaRequired } from "./services/staff";

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
  if (isStaffMfaRequired(ctx.staffRole, ctx.session.user)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Two-factor authentication required",
      cause: "MFA_REQUIRED",
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
    if (ctx.apiKeyPrincipal) {
      if (!ctx.capabilities.includes(capability)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Missing API key scope: ${capability}`,
        });
      }
      if (!ctx.actor) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Service account authentication required",
        });
      }
      return next({
        ctx: {
          ...ctx,
          actor: ctx.actor,
          apiKeyPrincipal: ctx.apiKeyPrincipal,
        },
      });
    }

    if (!ctx.session || !ctx.staffRole) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Staff authentication required",
        cause: "No staff session",
      });
    }

    if (isStaffMfaRequired(ctx.staffRole, ctx.session.user)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Two-factor authentication required",
        cause: "MFA_REQUIRED",
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
        actor: ctx.actor!,
        session: ctx.session,
        staffRole: ctx.staffRole,
      },
    });
  });
}
