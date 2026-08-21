import {
  capabilitiesForRole,
  isStaffMfaRequired,
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
    const mfaRequired = isStaffMfaRequired(role, context.session?.user);

    const previewSessionBinding = await createPreviewSessionBinding(
      context.session!.session.id,
    );

    return {
      ...context.session,
      capabilities: mfaRequired ? [] : capabilitiesForRole(role),
      mfaRequired,
      previewChannel: {
        conflictToken: crypto.randomUUID(),
        sessionBinding: previewSessionBinding,
        sessionId: crypto.randomUUID(),
      },
      staffRole: role,
    };
  });
