import {
  roleCapabilities,
  staffRoleSchema,
  type CmsCapability,
  type StaffRole,
} from "@rem-viet/cms";
import { createDb } from "@rem-viet/db";
import { staffRoles } from "@rem-viet/db/schema/governance";
import { env } from "@rem-viet/env/server";
import { eq } from "drizzle-orm";

type StaffIdentity = {
  id: string;
  email?: string | null;
};

function bootstrapOwnerEmails() {
  const value = (env as Env & { ADMIN_EMAILS?: string }).ADMIN_EMAILS ?? "";

  return new Set(
    value
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Resolve the persisted role for a Better Auth user. `ADMIN_EMAILS` is kept as
 * a bootstrap-owner fallback so the revision migration cannot lock out the
 * existing operator before a staff row has been created.
 */
export async function resolveStaffRole(
  user?: StaffIdentity | null,
): Promise<StaffRole | null> {
  if (!user) {
    return null;
  }

  try {
    const db = createDb();
    const row = await db.query.staffRoles.findFirst({
      where: eq(staffRoles.userId, user.id),
    });

    if (row) {
      const parsed = staffRoleSchema.safeParse(row.role);

      if (parsed.success) {
        return parsed.data;
      }
    }
  } catch {
    // Compatibility during the additive migration: if the table is not
    // available yet, the explicit bootstrap allowlist remains authoritative.
  }

  const email = user.email?.trim().toLowerCase();

  return email && bootstrapOwnerEmails().has(email) ? "owner" : null;
}

export function capabilitiesForRole(role: StaffRole | null) {
  return role
    ? ([...roleCapabilities[role]] satisfies CmsCapability[])
    : ([] satisfies CmsCapability[]);
}
