import type { FormDefinition } from "@rem-viet/cms";
import type { formSubmissions } from "@rem-viet/db/schema/content";
import { env } from "@rem-viet/env/server";

import { sendTelegramMessage } from "./telegram";

type Submission = typeof formSubmissions.$inferSelect;
export type NotificationAdapter = "email" | "telegram";
export type NotificationResult = {
  adapter: NotificationAdapter;
  status: "sent" | "skipped" | "failed";
  providerId?: string;
  error?: string;
};

export type NotificationRuntime = {
  values?: Record<string, string | undefined>;
  fetch?: typeof fetch;
};

type NotificationDefinition = Pick<
  FormDefinition,
  "active" | "notificationSettings"
>;

function runtimeEnv() {
  return env as unknown as Record<string, string | undefined>;
}

export function notificationRuntimeStatus(
  definitions: NotificationDefinition[],
  values: Record<string, string | undefined> = runtimeEnv(),
) {
  const required = values.NOTIFICATIONS_REQUIRED?.trim() === "1";
  const emailEnabled = definitions.some(
    (definition) => definition.active && definition.notificationSettings.email,
  );
  const missing: NotificationAdapter[] = [];

  if (
    emailEnabled &&
    (!values.RESEND_API_KEY?.trim() ||
      !values.LEAD_NOTIFICATION_EMAIL?.trim() ||
      !values.EMAIL_FROM?.trim())
  )
    missing.push("email");

  return {
    required,
    status:
      required && missing.length > 0 ? ("degraded" as const) : ("ok" as const),
    missing,
  };
}

function messageFor(definition: FormDefinition, submission: Submission) {
  const fields = Object.entries(submission.payload)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join("\n");
  return `[${definition.name}] Lead mới\n${fields}\nNguồn: ${submission.sourcePage}`;
}

async function sendEmail(
  subject: string,
  text: string,
  idempotencyKey: string,
  runtime?: NotificationRuntime,
): Promise<NotificationResult> {
  const values = runtime?.values ?? runtimeEnv();
  const fetcher = runtime?.fetch ?? fetch;
  const apiKey = values.RESEND_API_KEY?.trim();
  const to = values.LEAD_NOTIFICATION_EMAIL?.trim();
  const from = values.EMAIL_FROM?.trim();
  if (!apiKey || !to || !from)
    return values.NOTIFICATIONS_REQUIRED?.trim() === "1"
      ? {
          adapter: "email",
          status: "failed",
          error: "Email notification provider is not configured",
        }
      : { adapter: "email", status: "skipped" };
  try {
    const response = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
    if (!response.ok)
      throw new Error(`Email provider returned ${response.status}`);
    const payload = (await response.json().catch(() => null)) as {
      id?: unknown;
    } | null;
    return {
      adapter: "email",
      status: "sent",
      ...(typeof payload?.id === "string" && { providerId: payload.id }),
    };
  } catch (error) {
    return {
      adapter: "email",
      status: "failed",
      error: error instanceof Error ? error.message : "unknown",
    };
  }
}

export async function sendLeadNotifications(input: {
  definition: FormDefinition;
  submission: Submission;
  adapters?: NotificationAdapter[];
  runtime?: NotificationRuntime;
}) {
  const message = messageFor(input.definition, input.submission);
  const requested = new Set<NotificationAdapter>(
    input.adapters ?? ["email", "telegram"],
  );
  const results: NotificationResult[] = [];
  if (input.definition.notificationSettings.email && requested.has("email"))
    results.push(
      await sendEmail(
        `Lead mới: ${input.definition.name}`,
        message,
        `lead/${input.submission.id}/email-v1`,
        input.runtime,
      ),
    );
  if (
    input.definition.notificationSettings.telegram &&
    requested.has("telegram")
  ) {
    try {
      const result = await sendTelegramMessage(message);
      results.push({
        adapter: "telegram",
        status: result.skipped ? "skipped" : "sent",
      });
    } catch (error) {
      results.push({
        adapter: "telegram",
        status: "failed",
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }
  return results;
}
