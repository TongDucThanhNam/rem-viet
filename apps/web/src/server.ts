import {
  publishDueContent,
  systemActor,
} from "@rem-viet/api/services/content-revisions";
import {
  purgeExpiredSubmissions,
  retryFailedNotifications,
} from "@rem-viet/api/services/operations";
import { reportOperationalIncident } from "@rem-viet/api/services/incidents";
import {
  purgeExpiredCmsJobs,
  runDueCmsJobs,
} from "@rem-viet/api/services/jobs";
import {
  dispatchCmsOutboxEvents,
  purgeExpiredCmsOutbox,
} from "@rem-viet/api/services/outbox";
import { purgeExpiredWebVitals } from "@rem-viet/api/services/vitals";
import { deliverDueCmsWebhooks } from "@rem-viet/api/services/webhooks";
import { ensureCmsReleaseTaskRegistered } from "@rem-viet/api/services/releases";
import {
  createStartHandler,
  defaultStreamHandler,
} from "@tanstack/react-start/server";

import { purgeExpiredSanityWebhookDeliveries } from "@/lib/sanity-webhook.server";

const startHandler = createStartHandler(defaultStreamHandler);
ensureCmsReleaseTaskRegistered();

export default {
  fetch(request: Request) {
    return startHandler(request);
  },
  scheduled(controller: ScheduledController, _env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      (async () => {
        const scheduledAt = new Date(controller.scheduledTime);
        const jobs = await runDueCmsJobs(scheduledAt);
        const result = await publishDueContent(scheduledAt);
        const outbox = await dispatchCmsOutboxEvents(scheduledAt);
        const webhooks = await deliverDueCmsWebhooks(scheduledAt);
        const notificationRetries = await retryFailedNotifications(scheduledAt);
        const retention = await purgeExpiredSubmissions(scheduledAt);
        const vitalsRetention = await purgeExpiredWebVitals(scheduledAt);
        const webhookRetention =
          await purgeExpiredSanityWebhookDeliveries(scheduledAt);
        await purgeExpiredCmsJobs(scheduledAt);
        await purgeExpiredCmsOutbox(scheduledAt);
        if (result.errors.length) {
          reportOperationalIncident({
            category: "publish",
            operation: "scheduled-publish.batch",
            source: "scheduler",
            error: new Error("One or more scheduled publishes failed"),
            recoverable: true,
            detail: {
              failures: result.errors.length,
              actorRole: systemActor.role,
            },
          });
        }
        if (notificationRetries.failed || notificationRetries.exhausted) {
          reportOperationalIncident({
            category: "notification",
            operation: "lead.notification.retry.batch",
            source: "scheduler",
            error: new Error("Notification retry batch is not healthy"),
            recoverable: notificationRetries.exhausted === 0,
            detail: {
              failed: notificationRetries.failed,
              exhausted: notificationRetries.exhausted,
            },
          });
        }
        console.info("[cms:scheduler] complete", {
          cron: controller.cron,
          jobs,
          pages: result.pages.length,
          posts: result.posts.length,
          outbox,
          webhooks,
          notificationRetries,
          purgedLeads: retention.deleted,
          purgedVitals: vitalsRetention.deleted,
          purgedSanityWebhooks: webhookRetention.deleted,
        });
      })(),
    );
  },
};
