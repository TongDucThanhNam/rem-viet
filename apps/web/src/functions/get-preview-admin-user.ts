import {
  capabilitiesForRole,
  isStaffMfaRequired,
  resolveStaffRole,
} from "@rem-viet/api/services/staff";
import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";

import { authMiddleware } from "@/middleware/auth";
import { createPreviewSessionBinding } from "@/lib/preview-session-binding.server";

/** Preview pages are private working-copy views, never public cache entries. */
export const getPreviewAdminUser = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    setResponseHeader("Cache-Control", "private, no-store, max-age=0");
    setResponseHeader("X-Robots-Tag", "noindex, nofollow, noarchive");

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
      previewSessionBinding,
      staffRole: role,
    };
  });
