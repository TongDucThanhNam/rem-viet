import {
  publishDueContent,
  systemActor,
} from "@rem-viet/api/services/content-revisions";
import {
  purgeExpiredSubmissions,
  retryFailedNotifications,
} from "@rem-viet/api/services/operations";
import { reportOperationalIncident } from "@rem-viet/api/services/incidents";
import { purgeExpiredWebVitals } from "@rem-viet/api/services/vitals";
import {
  createStartHandler,
  defaultStreamHandler,
} from "@tanstack/react-start/server";

import { purgeExpiredSanityWebhookDeliveries } from "@/lib/sanity-webhook.server";

const startHandler = createStartHandler(defaultStreamHandler);

export default {
  fetch(request: Request) {
    return startHandler(request);
  },
  scheduled(controller: ScheduledController, _env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      (async () => {
        const result = await publishDueContent(
          new Date(controller.scheduledTime),
        );
        const notificationRetries = await retryFailedNotifications(
          new Date(controller.scheduledTime),
        );
        const retention = await purgeExpiredSubmissions(
          new Date(controller.scheduledTime),
        );
        const vitalsRetention = await purgeExpiredWebVitals(
          new Date(controller.scheduledTime),
        );
        const webhookRetention = await purgeExpiredSanityWebhookDeliveries(
          new Date(controller.scheduledTime),
        );
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
          pages: result.pages.length,
          posts: result.posts.length,
          notificationRetries,
          purgedLeads: retention.deleted,
          purgedVitals: vitalsRetention.deleted,
          purgedSanityWebhooks: webhookRetention.deleted,
        });
      })(),
    );
  },
};
