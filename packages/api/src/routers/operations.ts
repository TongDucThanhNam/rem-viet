import {
  deploymentProvenanceFromEnv,
  publicFormSubmissionSchema,
} from "@rem-viet/cms";
import { env } from "@rem-viet/env/server";

import {
  createRedirect,
  createRedirectInputSchema,
  checkOperationsHealth,
  deleteRedirect,
  deleteSubmission,
  deleteSubmissionInputSchema,
  formDefinitionKeyInputSchema,
  listFormDefinitions,
  listRedirects,
  listSubmissions,
  listSubmissionsInputSchema,
  redirectIdInputSchema,
  redirectPathInputSchema,
  resolveRedirect,
  retrySubmissionNotificationInputSchema,
  retrySubmissionNotificationManually,
  submitForm,
  updateRedirect,
  updateRedirectInputSchema,
  updateSubmission,
  updateSubmissionInputSchema,
  upsertFormDefinition,
  upsertFormDefinitionInputSchema,
} from "../services/operations";
import {
  getWebVitalSummary,
  webVitalSummaryInputSchema,
} from "../services/vitals";
import { capabilityProcedure, publicProcedure, router } from "../index";

type StaffContext = {
  requestId: string;
  session: { user: { id: string; email?: string | null } };
  staffRole: "owner" | "admin" | "editor";
};

function actorFromContext(ctx: StaffContext) {
  return {
    userId: ctx.session.user.id,
    email: ctx.session.user.email ?? "",
    role: ctx.staffRole,
    requestId: ctx.requestId,
  };
}

export const operationsRouter = router({
  readiness: router({
    runtime: capabilityProcedure("audit.read").query(async () => ({
      deployment: deploymentProvenanceFromEnv(
        env as unknown as Record<string, unknown>,
      ),
      health: await checkOperationsHealth(),
    })),
  }),
  vitals: router({
    summary: capabilityProcedure("audit.read")
      .input(webVitalSummaryInputSchema)
      .query(({ input }) => getWebVitalSummary(input)),
  }),
  redirects: router({
    resolve: publicProcedure
      .input(redirectPathInputSchema)
      .query(({ input }) => resolveRedirect(input.path)),
    list: capabilityProcedure("redirects.manage").query(() => listRedirects()),
    create: capabilityProcedure("redirects.manage")
      .input(createRedirectInputSchema)
      .mutation(({ ctx, input }) =>
        createRedirect(input, actorFromContext(ctx)),
      ),
    update: capabilityProcedure("redirects.manage")
      .input(updateRedirectInputSchema)
      .mutation(({ ctx, input }) =>
        updateRedirect(input, actorFromContext(ctx)),
      ),
    delete: capabilityProcedure("redirects.manage")
      .input(redirectIdInputSchema)
      .mutation(({ ctx, input }) =>
        deleteRedirect(input, actorFromContext(ctx)),
      ),
  }),
  forms: router({
    list: capabilityProcedure("leads.manage").query(() =>
      listFormDefinitions(),
    ),
    byKey: publicProcedure
      .input(formDefinitionKeyInputSchema)
      .query(
        async ({ input }) =>
          (await listFormDefinitions()).find(
            (form) => form.key === input.key && form.active,
          ) ?? null,
      ),
    upsert: capabilityProcedure("leads.manage")
      .input(upsertFormDefinitionInputSchema)
      .mutation(({ ctx, input }) =>
        upsertFormDefinition(input, actorFromContext(ctx)),
      ),
    submit: publicProcedure
      .input(publicFormSubmissionSchema)
      .mutation(({ ctx, input }) =>
        submitForm(input, { ip: ctx.clientIp, userAgent: ctx.userAgent }),
      ),
  }),
  submissions: router({
    list: capabilityProcedure("leads.manage")
      .input(listSubmissionsInputSchema)
      .query(({ input }) => listSubmissions(input)),
    update: capabilityProcedure("leads.manage")
      .input(updateSubmissionInputSchema)
      .mutation(({ ctx, input }) =>
        updateSubmission(input, actorFromContext(ctx)),
      ),
    retryNotification: capabilityProcedure("leads.manage")
      .input(retrySubmissionNotificationInputSchema)
      .mutation(({ ctx, input }) =>
        retrySubmissionNotificationManually(input, actorFromContext(ctx)),
      ),
    delete: capabilityProcedure("leads.manage")
      .input(deleteSubmissionInputSchema)
      .mutation(({ ctx, input }) =>
        deleteSubmission(input, actorFromContext(ctx)),
      ),
  }),
});
