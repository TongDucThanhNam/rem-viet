import {
  capabilitiesForRole,
  resolveStaffRole,
} from "@rem-viet/api/services/staff";
import { createServerFn } from "@tanstack/react-start";

import { authMiddleware } from "@/middleware/auth";

export const getAdminUser = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const role = await resolveStaffRole(context.session?.user);

    if (!role) {
      return null;
    }

    return {
      ...context.session,
      capabilities: capabilitiesForRole(role),
      staffRole: role,
    };
  });
