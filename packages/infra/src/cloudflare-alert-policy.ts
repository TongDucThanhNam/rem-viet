import { z } from "zod";

export const WORKERS_OBSERVABILITY_ALERT = "workers_observability_alert";
export const WORKERS_OBSERVABILITY_FAILURE_STATUS = "FIRING_FAILED";

const siteIdSchema = z.string().regex(/^[a-z][a-z0-9-]{1,62}$/);
const stageSchema = z.string().regex(/^[a-z][a-z0-9-]{1,31}$/);
const emailSchema = z.string().trim().email();
const isoTimestampSchema = z.string().datetime({ offset: true });

export type CloudflareOperationalAlertPolicySpec = {
  name: string;
  description: string;
  alert_type: typeof WORKERS_OBSERVABILITY_ALERT;
  enabled: true;
  mechanisms: {
    email: Array<{ id: string }>;
  };
  filters: {
    status: [typeof WORKERS_OBSERVABILITY_FAILURE_STATUS];
  };
};

export type CloudflareOperationalAlertPlan = {
  action: "create" | "noop" | "blocked" | "manual-review";
  policyName: string;
  matchingNameCount: number;
  exactPolicyCount: number;
  policyConfigured: boolean;
  safeToCreate: boolean;
  gaps: string[];
};

type ParsedPolicy = {
  id?: string;
  name?: string;
  description?: string;
  alertType?: string;
  enabled: boolean;
  emailIds: string[];
  pagerdutyCount: number;
  webhookCount: number;
  statuses: string[];
  created?: string;
};

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const objectArray = (value: unknown): Array<Record<string, unknown>> =>
  Array.isArray(value)
    ? value.flatMap((item) => {
        const record = asRecord(item);
        return record ? [record] : [];
      })
    : [];

const stringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.flatMap((item) => (typeof item === "string" ? [item] : []))
    : [];

function parsePolicy(value: unknown): ParsedPolicy | undefined {
  const policy = asRecord(value);
  if (!policy) return undefined;
  const mechanisms = asRecord(policy.mechanisms);
  const filters = asRecord(policy.filters);
  return {
    ...(asString(policy.id) ? { id: asString(policy.id) } : {}),
    ...(asString(policy.name) ? { name: asString(policy.name) } : {}),
    ...(asString(policy.description)
      ? { description: asString(policy.description) }
      : {}),
    ...(asString(policy.alert_type) || asString(policy.alertType)
      ? {
          alertType: asString(policy.alert_type) ?? asString(policy.alertType),
        }
      : {}),
    enabled: policy.enabled === true,
    emailIds: objectArray(mechanisms?.email)
      .flatMap((mechanism) =>
        asString(mechanism.id) ? [asString(mechanism.id)!] : [],
      )
      .sort(),
    pagerdutyCount: objectArray(mechanisms?.pagerduty).length,
    webhookCount:
      objectArray(mechanisms?.webhooks).length +
      objectArray(mechanisms?.webhook).length,
    statuses: stringArray(filters?.status).sort(),
    ...(asString(policy.created) ? { created: asString(policy.created) } : {}),
  };
}

export function buildCloudflareOperationalAlertPolicy(input: {
  site: string;
  stage: string;
  recipient: string;
}): CloudflareOperationalAlertPolicySpec {
  const site = siteIdSchema.parse(input.site);
  const stage = stageSchema.parse(input.stage);
  const recipient = emailSchema.parse(input.recipient);
  const name = `${site}-${stage}-operational-failures`;
  return {
    name,
    description: `Agency CMS ${site} ${stage}: email on Workers Observability firing failures.`,
    alert_type: WORKERS_OBSERVABILITY_ALERT,
    enabled: true,
    mechanisms: { email: [{ id: recipient }] },
    filters: { status: [WORKERS_OBSERVABILITY_FAILURE_STATUS] },
  };
}

export function cloudflareOperationalAlertContractAvailable(
  availableAlerts: unknown,
): boolean {
  for (const entries of Object.values(asRecord(availableAlerts) ?? {})) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      const alert = asRecord(entry);
      if (asString(alert?.type) !== WORKERS_OBSERVABILITY_ALERT) continue;
      const filterOptions = Array.isArray(alert?.filter_options)
        ? alert.filter_options
        : Array.isArray(alert?.filterOptions)
          ? alert.filterOptions
          : [];
      return filterOptions.some((option) => {
        const filter = asRecord(option);
        const key = asString(filter?.Key) ?? asString(filter?.key);
        const values = Array.isArray(filter?.AvailableValues)
          ? filter.AvailableValues
          : Array.isArray(filter?.availableValues)
            ? filter.availableValues
            : [];
        return (
          key === "status" &&
          values.some((value) => {
            const item = asRecord(value);
            return (
              (asString(item?.ID) ?? asString(item?.id)) ===
              WORKERS_OBSERVABILITY_FAILURE_STATUS
            );
          })
        );
      });
    }
  }
  return false;
}

const exactPolicy = (
  policy: ParsedPolicy,
  target: CloudflareOperationalAlertPolicySpec,
) =>
  policy.name === target.name &&
  policy.description === target.description &&
  policy.alertType === target.alert_type &&
  policy.enabled &&
  policy.emailIds.length === 1 &&
  policy.emailIds[0] === target.mechanisms.email[0]?.id &&
  policy.pagerdutyCount === 0 &&
  policy.webhookCount === 0 &&
  policy.statuses.length === 1 &&
  policy.statuses[0] === WORKERS_OBSERVABILITY_FAILURE_STATUS;

export function planCloudflareOperationalAlert(input: {
  policies: unknown;
  site: string;
  stage: string;
  recipient?: string;
}): CloudflareOperationalAlertPlan {
  const site = siteIdSchema.parse(input.site);
  const stage = stageSchema.parse(input.stage);
  const policyName = `${site}-${stage}-operational-failures`;
  const parsed = Array.isArray(input.policies)
    ? input.policies.flatMap((value) => {
        const policy = parsePolicy(value);
        return policy ? [policy] : [];
      })
    : [];
  const matchingName = parsed.filter((policy) => policy.name === policyName);

  if (!input.recipient?.trim()) {
    return {
      action: "blocked",
      policyName,
      matchingNameCount: matchingName.length,
      exactPolicyCount: 0,
      policyConfigured: false,
      safeToCreate: false,
      gaps: [
        "CLOUDFLARE_ALERT_EMAIL is not configured; the recipient is never printed.",
      ],
    };
  }

  const target = buildCloudflareOperationalAlertPolicy({
    site,
    stage,
    recipient: input.recipient,
  });
  const exact = matchingName.filter((policy) => exactPolicy(policy, target));
  if (matchingName.length === 0) {
    return {
      action: "create",
      policyName,
      matchingNameCount: 0,
      exactPolicyCount: 0,
      policyConfigured: false,
      safeToCreate: true,
      gaps: ["The deterministic operational email policy is not configured."],
    };
  }
  if (matchingName.length === 1 && exact.length === 1) {
    return {
      action: "noop",
      policyName,
      matchingNameCount: 1,
      exactPolicyCount: 1,
      policyConfigured: true,
      safeToCreate: false,
      gaps: [],
    };
  }
  return {
    action: "manual-review",
    policyName,
    matchingNameCount: matchingName.length,
    exactPolicyCount: exact.length,
    policyConfigured: false,
    safeToCreate: false,
    gaps: [
      "A same-name Cloudflare policy is duplicated or differs from the fail-closed specification; no automatic update or deletion is allowed.",
    ],
  };
}

export function resolveExactCloudflareOperationalAlertPolicy(input: {
  policies: unknown;
  target: CloudflareOperationalAlertPolicySpec;
}): { id: string; created?: string } {
  const matching = Array.isArray(input.policies)
    ? input.policies.flatMap((value) => {
        const policy = parsePolicy(value);
        return policy && exactPolicy(policy, input.target) ? [policy] : [];
      })
    : [];
  const [policy] = matching;
  if (matching.length !== 1 || !policy?.id) {
    throw new Error(
      "Expected exactly one fully converged operational policy with a provider ID.",
    );
  }
  return {
    id: policy.id,
    ...(policy.created ? { created: policy.created } : {}),
  };
}

export function buildCloudflareOperationalAlertEvidence(input: {
  policy: { id: string; created?: string };
  history: unknown;
  receiptConfirmedAt?: string;
  now?: Date;
}) {
  const createdMs = input.policy.created
    ? Date.parse(isoTimestampSchema.parse(input.policy.created))
    : undefined;
  const dispatches = Array.isArray(input.history)
    ? input.history.flatMap((value) => {
        const item = asRecord(value);
        const id = asString(item?.id);
        const policyId = asString(item?.policy_id) ?? asString(item?.policyId);
        const alertType =
          asString(item?.alert_type) ?? asString(item?.alertType);
        const mechanismType =
          asString(item?.mechanism_type) ?? asString(item?.mechanismType);
        const sent = asString(item?.sent);
        if (
          !id ||
          policyId !== input.policy.id ||
          alertType !== WORKERS_OBSERVABILITY_ALERT ||
          mechanismType !== "email" ||
          !sent
        )
          return [];
        const sentIso = isoTimestampSchema.safeParse(sent);
        if (!sentIso.success) return [];
        const sentMs = Date.parse(sentIso.data);
        if (createdMs !== undefined && sentMs < createdMs) return [];
        return [{ id, sent: sentIso.data, sentMs }];
      })
    : [];
  dispatches.sort((left, right) => right.sentMs - left.sentMs);
  const [latest] = dispatches;
  const base = {
    dispatchRecorded: Boolean(latest),
    receiptConfirmed: false,
    releaseEvidence: null,
  } as {
    dispatchRecorded: boolean;
    receiptConfirmed: boolean;
    releaseEvidence: null | {
      provider: "cloudflare";
      stage: "staging";
      trigger: "notification-failure";
      alertType: typeof WORKERS_OBSERVABILITY_ALERT;
      deliveryMechanism: "email";
      policyEnabled: true;
      delivered: true;
      dispatchReceiptId: string;
      verifiedAt: string;
    };
  };

  if (!input.receiptConfirmedAt) return base;
  const receipt = isoTimestampSchema.parse(input.receiptConfirmedAt);
  const receiptMs = Date.parse(receipt);
  const nowMs = (input.now ?? new Date()).getTime();
  if (receiptMs > nowMs) {
    throw new Error("Alert receipt confirmation cannot be in the future.");
  }
  if (!latest) {
    throw new Error(
      "No dispatch from the exact operational policy exists; receipt evidence was withheld.",
    );
  }
  if (receiptMs < latest.sentMs) {
    throw new Error(
      "Alert receipt confirmation must be at or after the provider dispatch.",
    );
  }
  return {
    dispatchRecorded: true,
    receiptConfirmed: true,
    releaseEvidence: {
      provider: "cloudflare" as const,
      stage: "staging" as const,
      trigger: "notification-failure" as const,
      alertType: WORKERS_OBSERVABILITY_ALERT,
      deliveryMechanism: "email" as const,
      policyEnabled: true as const,
      delivered: true as const,
      dispatchReceiptId: latest.id,
      verifiedAt: receipt,
    },
  };
}
