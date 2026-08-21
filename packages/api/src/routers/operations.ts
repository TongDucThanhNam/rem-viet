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
  cancelCmsJob,
  cmsJobIdInputSchema,
  listCmsJobs,
  listCmsJobsInputSchema,
  retryCmsJob,
} from "../services/jobs";
import {
  listCmsCalendar,
  listCmsCalendarInputSchema,
} from "../services/calendar";
import {
  cancelCmsRelease,
  cmsReleaseIdInputSchema,
  createCmsRelease,
  createCmsReleaseInputSchema,
  listCmsReleases,
  listCmsReleasesInputSchema,
  previewCmsRelease,
  publishCmsReleaseNow,
  scheduleCmsRelease,
  scheduleCmsReleaseInputSchema,
} from "../services/releases";
import {
  createWebhookEndpoint,
  createWebhookEndpointInputSchema,
  listWebhookDeliveries,
  listWebhookDeliveriesInputSchema,
  listWebhookEndpoints,
  replayWebhookDelivery,
  replayWebhookDeliveryInputSchema,
  revokeWebhookEndpoint,
  rotateWebhookSecret,
  webhookEndpointIdInputSchema,
} from "../services/webhooks";
import {
  cmsWorkflowPolicyTargetSchema,
  deactivateCmsWorkflowPolicy,
  listCmsWorkflowPolicies,
  upsertCmsWorkflowPolicy,
  upsertCmsWorkflowPolicyInputSchema,
} from "../services/workflow-policies";
import {
  getWebVitalSummary,
  webVitalSummaryInputSchema,
} from "../services/vitals";
import { capabilityProcedure, publicProcedure, router } from "../index";

type StaffContext = {
  actor: {
    userId: string;
    email: string;
    role: "owner" | "admin" | "editor" | "system";
  };
  requestId: string;
};

function actorFromContext(ctx: StaffContext) {
  return { ...ctx.actor, requestId: ctx.requestId };
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
  calendar: router({
    list: capabilityProcedure("audit.read")
      .input(listCmsCalendarInputSchema)
      .query(({ input }) => listCmsCalendar(input)),
  }),
  jobs: router({
    list: capabilityProcedure("audit.read")
      .input(listCmsJobsInputSchema)
      .query(({ input }) => listCmsJobs(input)),
    cancel: capabilityProcedure("settings.manage")
      .input(cmsJobIdInputSchema)
      .mutation(({ ctx, input }) =>
        cancelCmsJob(input.jobId, undefined, actorFromContext(ctx)),
      ),
    retry: capabilityProcedure("settings.manage")
      .input(cmsJobIdInputSchema)
      .mutation(({ ctx, input }) =>
        retryCmsJob(input.jobId, undefined, actorFromContext(ctx)),
      ),
  }),
  releases: router({
    list: capabilityProcedure("audit.read")
      .input(listCmsReleasesInputSchema)
      .query(({ input }) => listCmsReleases(input)),
    create: capabilityProcedure("content.schedule")
      .input(createCmsReleaseInputSchema)
      .mutation(({ ctx, input }) =>
        createCmsRelease(input, actorFromContext(ctx)),
      ),
    preview: capabilityProcedure("audit.read")
      .input(cmsReleaseIdInputSchema)
      .mutation(({ input }) => previewCmsRelease(input)),
    schedule: capabilityProcedure("content.schedule")
      .input(scheduleCmsReleaseInputSchema)
      .mutation(({ ctx, input }) =>
        scheduleCmsRelease(input, actorFromContext(ctx)),
      ),
    publishNow: capabilityProcedure("content.publish")
      .input(cmsReleaseIdInputSchema)
      .mutation(({ ctx, input }) =>
        publishCmsReleaseNow(input, actorFromContext(ctx)),
      ),
    cancel: capabilityProcedure("content.schedule")
      .input(cmsReleaseIdInputSchema)
      .mutation(({ ctx, input }) =>
        cancelCmsRelease(input, actorFromContext(ctx)),
      ),
  }),
  workflows: router({
    list: capabilityProcedure("audit.read").query(() =>
      listCmsWorkflowPolicies(),
    ),
    upsert: capabilityProcedure("settings.manage")
      .input(upsertCmsWorkflowPolicyInputSchema)
      .mutation(({ ctx, input }) =>
        upsertCmsWorkflowPolicy(input, actorFromContext(ctx)),
      ),
    deactivate: capabilityProcedure("settings.manage")
      .input(cmsWorkflowPolicyTargetSchema)
      .mutation(({ ctx, input }) =>
        deactivateCmsWorkflowPolicy(input, actorFromContext(ctx)),
      ),
  }),
  webhooks: router({
    listEndpoints: capabilityProcedure("audit.read").query(() =>
      listWebhookEndpoints(),
    ),
    createEndpoint: capabilityProcedure("settings.manage")
      .input(createWebhookEndpointInputSchema)
      .mutation(({ ctx, input }) =>
        createWebhookEndpoint(input, actorFromContext(ctx)),
      ),
    rotateSecret: capabilityProcedure("settings.manage")
      .input(webhookEndpointIdInputSchema)
      .mutation(({ ctx, input }) =>
        rotateWebhookSecret(input, actorFromContext(ctx)),
      ),
    revokeEndpoint: capabilityProcedure("settings.manage")
      .input(webhookEndpointIdInputSchema)
      .mutation(({ ctx, input }) =>
        revokeWebhookEndpoint(input, actorFromContext(ctx)),
      ),
    listDeliveries: capabilityProcedure("audit.read")
      .input(listWebhookDeliveriesInputSchema)
      .query(({ input }) => listWebhookDeliveries(input.limit)),
    replayDelivery: capabilityProcedure("settings.manage")
      .input(replayWebhookDeliveryInputSchema)
      .mutation(({ ctx, input }) =>
        replayWebhookDelivery(input, actorFromContext(ctx)),
      ),
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
