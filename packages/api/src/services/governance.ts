import { staffRoleSchema, type StaffRole } from "@rem-viet/cms";
import { createAuth, isAuthEmailDeliveryConfigured } from "@rem-viet/auth";
import { createDb } from "@rem-viet/db";
import { account, session, user } from "@rem-viet/db/schema/auth";
import { auditEvents, staffRoles } from "@rem-viet/db/schema/governance";
import { env } from "@rem-viet/env/server";
import { TRPCError } from "@trpc/server";
import { hashPassword } from "better-auth/crypto";
import { and, count, desc, eq, like, or } from "drizzle-orm";
import { z } from "zod";

export type GovernanceActor = {
  userId: string;
  email: string;
  role: StaffRole | "system";
  requestId: string;
};

const normalizedEmailSchema = z
  .string()
  .trim()
  .email()
  .max(320)
  .transform((value) => value.toLowerCase());

export const createStaffInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: normalizedEmailSchema,
  password: z.string().min(12).max(128),
  role: staffRoleSchema,
});

export const inviteStaffInputSchema = createStaffInputSchema.omit({
  password: true,
});

export const updateStaffRoleInputSchema = z.object({
  userId: z.string().min(1),
  role: staffRoleSchema,
});

export const staffUserInputSchema = z.object({ userId: z.string().min(1) });

export const auditListInputSchema = z
  .object({
    search: z.string().trim().max(120).optional(),
    action: z.string().trim().max(120).optional(),
    entityType: z.string().trim().max(80).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(100),
  })
  .default({ limit: 100 });

function bootstrapOwnerEmails() {
  const value = (env as Env & { ADMIN_EMAILS?: string }).ADMIN_EMAILS ?? "";
  return new Set(
    value
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

function auditRow(input: {
  action: string;
  actor: GovernanceActor;
  entityId: string;
  before?: unknown;
  after?: unknown;
}) {
  return {
    id: crypto.randomUUID(),
    actorUserId: input.actor.userId,
    actorEmail: input.actor.email,
    actorRole: input.actor.role,
    action: input.action,
    entityType: "staff",
    entityId: input.entityId,
    before: input.before ?? null,
    after: input.after ?? null,
    requestId: input.actor.requestId,
    createdAt: new Date(),
  } satisfies typeof auditEvents.$inferInsert;
}

async function staffIdentity(userId: string) {
  const [row] = await createDb()
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: staffRoles.role,
    })
    .from(user)
    .leftJoin(staffRoles, eq(staffRoles.userId, user.id))
    .where(eq(user.id, userId))
    .limit(1);
  if (!row)
    throw new TRPCError({ code: "NOT_FOUND", message: "User không tồn tại." });
  return row;
}

async function assertOwnerCanChange(
  target: Awaited<ReturnType<typeof staffIdentity>>,
  actor: GovernanceActor,
  nextRole: StaffRole | null,
) {
  if (target.id === actor.userId && nextRole !== "owner") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Owner không thể tự hạ quyền hoặc thu hồi chính mình.",
    });
  }
  if (
    bootstrapOwnerEmails().has(target.email.toLowerCase()) &&
    nextRole !== "owner"
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Tài khoản bootstrap trong ADMIN_EMAILS phải giữ quyền Owner.",
    });
  }
  if (target.role === "owner" && nextRole !== "owner") {
    const [owners] = await createDb()
      .select({ value: count() })
      .from(staffRoles)
      .where(eq(staffRoles.role, "owner"));
    if ((owners?.value ?? 0) <= 1) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Không thể thu hồi Owner cuối cùng.",
      });
    }
  }
}

export async function listStaff() {
  const allowlist = bootstrapOwnerEmails();
  const rows = await createDb()
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      persistedRole: staffRoles.role,
    })
    .from(user)
    .leftJoin(staffRoles, eq(staffRoles.userId, user.id))
    .orderBy(desc(user.createdAt));

  return rows.map((row) => ({
    ...row,
    bootstrapOwner: allowlist.has(row.email.toLowerCase()),
    role:
      staffRoleSchema.safeParse(row.persistedRole).data ??
      (allowlist.has(row.email.toLowerCase()) ? "owner" : null),
  }));
}

export async function createStaff(
  input: z.infer<typeof createStaffInputSchema>,
  actor: GovernanceActor,
) {
  const db = createDb();
  const existing = await db.query.user.findFirst({
    where: eq(user.email, input.email),
  });
  if (existing) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Email này đã có tài khoản.",
    });
  }

  const userId = crypto.randomUUID();
  const now = new Date();
  const password = await hashPassword(input.password);
  await db.batch([
    db.insert(user).values({
      id: userId,
      name: input.name,
      email: input.email,
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(account).values({
      id: crypto.randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password,
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(staffRoles).values({
      userId,
      role: input.role,
      assignedBy: actor.userId,
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(auditEvents).values(
      auditRow({
        action: "staff.create",
        actor,
        entityId: userId,
        after: { name: input.name, email: input.email, role: input.role },
      }),
    ),
  ]);
  return { id: userId, name: input.name, email: input.email, role: input.role };
}

export async function inviteStaff(
  input: z.infer<typeof inviteStaffInputSchema>,
  actor: GovernanceActor,
) {
  const values = env as unknown as Record<string, string | undefined>;
  if (!isAuthEmailDeliveryConfigured(values)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Chưa cấu hình RESEND_API_KEY và EMAIL_FROM để gửi lời mời an toàn.",
    });
  }
  const randomPassword = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
  const created = await createStaff(
    { ...input, password: randomPassword },
    actor,
  );
  try {
    await createAuth().api.requestPasswordReset({
      body: {
        email: input.email,
        redirectTo: new URL("/dat-lai-mat-khau", env.BETTER_AUTH_URL).href,
      },
    });
  } catch {
    await createDb().delete(user).where(eq(user.id, created.id));
    await createDb()
      .insert(auditEvents)
      .values(
        auditRow({
          action: "staff.invite_failed",
          actor,
          entityId: created.id,
          after: { email: created.email, role: created.role, rolledBack: true },
        }),
      );
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Không thể gửi lời mời. Tài khoản chưa được tạo.",
    });
  }
  await createDb()
    .insert(auditEvents)
    .values(
      auditRow({
        action: "staff.invite_sent",
        actor,
        entityId: created.id,
        after: { email: created.email, role: created.role },
      }),
    );
  return { ...created, invited: true as const };
}

export async function updateStaffRole(
  input: z.infer<typeof updateStaffRoleInputSchema>,
  actor: GovernanceActor,
) {
  const target = await staffIdentity(input.userId);
  await assertOwnerCanChange(target, actor, input.role);
  const now = new Date();
  const db = createDb();
  await db.batch([
    db
      .insert(staffRoles)
      .values({
        userId: target.id,
        role: input.role,
        assignedBy: actor.userId,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: staffRoles.userId,
        set: {
          role: input.role,
          assignedBy: actor.userId,
          updatedAt: now,
        },
      }),
    db.insert(auditEvents).values(
      auditRow({
        action: "staff.role_update",
        actor,
        entityId: target.id,
        before: { role: target.role },
        after: { role: input.role },
      }),
    ),
  ]);
  return { ...target, role: input.role };
}

export async function revokeStaff(
  input: z.infer<typeof staffUserInputSchema>,
  actor: GovernanceActor,
) {
  const target = await staffIdentity(input.userId);
  await assertOwnerCanChange(target, actor, null);
  const db = createDb();
  await db.batch([
    db.delete(session).where(eq(session.userId, target.id)),
    db.delete(staffRoles).where(eq(staffRoles.userId, target.id)),
    db.insert(auditEvents).values(
      auditRow({
        action: "staff.revoke",
        actor,
        entityId: target.id,
        before: { email: target.email, role: target.role },
      }),
    ),
  ]);
  return { revoked: true };
}

export async function listAuditEvents(
  input: z.infer<typeof auditListInputSchema> = { limit: 100 },
) {
  const search = input.search ? `%${input.search}%` : undefined;
  const filters = [
    ...(input.action ? [eq(auditEvents.action, input.action)] : []),
    ...(input.entityType ? [eq(auditEvents.entityType, input.entityType)] : []),
    ...(search
      ? [
          or(
            like(auditEvents.actorEmail, search),
            like(auditEvents.action, search),
            like(auditEvents.entityType, search),
            like(auditEvents.entityId, search),
            like(auditEvents.requestId, search),
          ),
        ]
      : []),
  ];
  return createDb()
    .select()
    .from(auditEvents)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(auditEvents.createdAt))
    .limit(input.limit);
}

export async function recordAuthenticationAudit(input: {
  action: "auth.sign_in_success" | "auth.sign_in_failed" | "auth.sign_out";
  email?: string | null;
  requestId?: string | null;
}) {
  const email = input.email?.trim().toLowerCase() ?? "";
  const db = createDb();
  const identity = email
    ? await db
        .select({ id: user.id, role: staffRoles.role })
        .from(user)
        .leftJoin(staffRoles, eq(staffRoles.userId, user.id))
        .where(eq(user.email, email))
        .limit(1)
        .then((rows) => rows[0])
    : undefined;
  const parsedRole = staffRoleSchema.safeParse(identity?.role);
  const actorRole = parsedRole.success
    ? parsedRole.data
    : bootstrapOwnerEmails().has(email)
      ? "owner"
      : "system";

  await db.insert(auditEvents).values({
    id: crypto.randomUUID(),
    actorUserId: identity?.id ?? "",
    actorEmail: email,
    actorRole,
    action: input.action,
    entityType: "authentication",
    entityId: identity?.id ?? (email || "unknown"),
    before: null,
    after: { success: input.action !== "auth.sign_in_failed" },
    requestId: input.requestId ?? "",
    createdAt: new Date(),
  });
}
