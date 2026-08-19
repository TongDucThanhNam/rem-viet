import {
  capabilitiesForRole,
  resolveStaffRole,
} from "@rem-viet/api/services/staff";
import { createServerFn } from "@tanstack/react-start";

import { authMiddleware } from "@/middleware/auth";
import { createPreviewSessionBinding } from "@/lib/preview-session-binding.server";

export const getAdminUser = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const role = await resolveStaffRole(context.session?.user);

    if (!role) {
      return null;
    }

    const previewSessionBinding = await createPreviewSessionBinding(
      context.session!.session.id,
    );

    return {
      ...context.session,
      capabilities: capabilitiesForRole(role),
      previewChannel: {
        conflictToken: crypto.randomUUID(),
        sessionBinding: previewSessionBinding,
        sessionId: crypto.randomUUID(),
      },
      staffRole: role,
    };
  });
