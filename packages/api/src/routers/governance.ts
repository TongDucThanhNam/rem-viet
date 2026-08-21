import { capabilityProcedure, router } from "../index";
import {
  auditListInputSchema,
  createStaff,
  createStaffInputSchema,
  inviteStaff,
  inviteStaffInputSchema,
  listAuditEvents,
  listStaff,
  revokeStaff,
  staffUserInputSchema,
  updateStaffRole,
  updateStaffRoleInputSchema,
  type GovernanceActor,
} from "../services/governance";
import {
  apiKeyIdInputSchema,
  apiKeyPermissionMatrix,
  createServiceAccountInputSchema,
  createServiceAccountWithKey,
  listServiceAccounts,
  revokeApiKey,
  revokeServiceAccount,
  rotateApiKey,
  rotateApiKeyInputSchema,
  serviceAccountIdInputSchema,
} from "../services/api-keys";

type StaffContext = {
  actor: GovernanceActor;
  requestId: string;
};

function actorFromContext(ctx: StaffContext): GovernanceActor {
  return { ...ctx.actor, requestId: ctx.requestId };
}

export const governanceRouter = router({
  staff: router({
    list: capabilityProcedure("staff.manage").query(() => listStaff()),
    create: capabilityProcedure("staff.manage")
      .input(createStaffInputSchema)
      .mutation(({ ctx, input }) => createStaff(input, actorFromContext(ctx))),
    invite: capabilityProcedure("staff.manage")
      .input(inviteStaffInputSchema)
      .mutation(({ ctx, input }) => inviteStaff(input, actorFromContext(ctx))),
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
  serviceAccounts: router({
    permissions: capabilityProcedure("staff.manage").query(
      () => apiKeyPermissionMatrix,
    ),
    list: capabilityProcedure("staff.manage").query(() =>
      listServiceAccounts(),
    ),
    create: capabilityProcedure("staff.manage")
      .input(createServiceAccountInputSchema)
      .mutation(({ ctx, input }) =>
        createServiceAccountWithKey(input, actorFromContext(ctx)),
      ),
    rotateKey: capabilityProcedure("staff.manage")
      .input(rotateApiKeyInputSchema)
      .mutation(({ ctx, input }) => rotateApiKey(input, actorFromContext(ctx))),
    revokeKey: capabilityProcedure("staff.manage")
      .input(apiKeyIdInputSchema)
      .mutation(({ ctx, input }) => revokeApiKey(input, actorFromContext(ctx))),
    revoke: capabilityProcedure("staff.manage")
      .input(serviceAccountIdInputSchema)
      .mutation(({ ctx, input }) =>
        revokeServiceAccount(input, actorFromContext(ctx)),
      ),
  }),
});
