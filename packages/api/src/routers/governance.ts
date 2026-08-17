import { capabilityProcedure, router } from "../index";
import {
  auditListInputSchema,
  createStaff,
  createStaffInputSchema,
  listAuditEvents,
  listStaff,
  revokeStaff,
  staffUserInputSchema,
  updateStaffRole,
  updateStaffRoleInputSchema,
  type GovernanceActor,
} from "../services/governance";

type StaffContext = {
  requestId: string;
  session: { user: { id: string; email?: string | null } };
  staffRole: "owner" | "admin" | "editor";
};

function actorFromContext(ctx: StaffContext): GovernanceActor {
  return {
    userId: ctx.session.user.id,
    email: ctx.session.user.email ?? "",
    role: ctx.staffRole,
    requestId: ctx.requestId,
  };
}

export const governanceRouter = router({
  staff: router({
    list: capabilityProcedure("staff.manage").query(() => listStaff()),
    create: capabilityProcedure("staff.manage")
      .input(createStaffInputSchema)
      .mutation(({ ctx, input }) => createStaff(input, actorFromContext(ctx))),
    updateRole: capabilityProcedure("staff.manage")
      .input(updateStaffRoleInputSchema)
      .mutation(({ ctx, input }) =>
        updateStaffRole(input, actorFromContext(ctx)),
      ),
    revoke: capabilityProcedure("staff.manage")
      .input(staffUserInputSchema)
      .mutation(({ ctx, input }) => revokeStaff(input, actorFromContext(ctx))),
  }),
  audit: router({
    list: capabilityProcedure("audit.read")
      .input(auditListInputSchema)
      .query(({ input }) => listAuditEvents(input)),
  }),
});
