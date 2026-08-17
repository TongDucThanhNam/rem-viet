export type AlertDestination = {
  type: string;
  eligible: boolean;
  ready: boolean;
};

export type AlertType = {
  group: string;
  type: string;
  displayName?: string;
};

export type AlertPolicySummary = {
  alertType: string;
  enabled: boolean;
  mechanisms: {
    email: number;
    pagerduty: number;
    webhook: number;
  };
  created?: string;
  modified?: string;
};

export type AlertDispatchSummary = {
  alertType: string;
  mechanismType: string;
  sent?: string;
};

export type CloudflareAlertAuditReport = {
  availableAlertTypes: AlertType[];
  destinations: AlertDestination[];
  policies: AlertPolicySummary[];
  recentDispatches: AlertDispatchSummary[];
  availableAlertTypeCount: number;
  policyCount: number;
  recentDispatchCount: number;
  healthCheckAlertAvailable: boolean;
  workerObservabilityAlertAvailable: boolean;
  emailDeliveryReady: boolean;
  healthCheckEmailPolicyConfigured: boolean;
  healthCheckEmailReceiptRecorded: boolean;
  workerObservabilityEmailPolicyConfigured: boolean;
  workerObservabilityEmailReceiptRecorded: boolean;
  operationalEmailPolicyConfigured: boolean;
  operationalEmailReceiptRecorded: boolean;
  capabilityReady: boolean;
  releaseEvidenceReady: boolean;
  gaps: string[];
};

export type CloudflareAlertApiSnapshot = {
  availableAlerts: unknown;
  destinationsEligible: unknown;
  policies: unknown;
  history: unknown;
};

type ParsedAlertPolicy = AlertPolicySummary & {
  providerId?: string;
};

type ParsedAlertDispatch = AlertDispatchSummary & {
  providerId?: string;
  policyId?: string;
};

const HEALTH_CHECK_ALERT = "health_check_status_notification";
const WORKER_OBSERVABILITY_ALERT = "workers_observability_alert";

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const canonicalMechanismType = (value: string): string =>
  value === "webhooks" ? "webhook" : value;

const mechanismCount = (
  mechanisms: Record<string, unknown> | undefined,
  key: string,
): number => {
  const value = mechanisms?.[key];
  if (Array.isArray(value)) return value.length;
  return value === undefined || value === null ? 0 : 1;
};

function readAvailableAlerts(value: unknown): AlertType[] {
  const alerts: AlertType[] = [];
  for (const [group, entries] of Object.entries(asRecord(value) ?? {})) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      const item = asRecord(entry);
      const type = asString(item?.type);
      if (!type) continue;
      alerts.push({
        group,
        type,
        ...(asString(item?.display_name) || asString(item?.displayName)
          ? {
              displayName:
                asString(item?.display_name) ?? asString(item?.displayName),
            }
          : {}),
      });
    }
  }
  return alerts.sort(
    (left, right) =>
      left.group.localeCompare(right.group) ||
      left.type.localeCompare(right.type),
  );
}

function readDestinations(value: unknown): AlertDestination[] {
  const destinations = new Map<string, AlertDestination>();
  for (const [key, raw] of Object.entries(asRecord(value) ?? {})) {
    const entries = Array.isArray(raw) ? raw : [raw];
    for (const entry of entries) {
      const item = asRecord(entry);
      if (!item) continue;
      const type = canonicalMechanismType(asString(item.type) ?? key);
      destinations.set(type, {
        type,
        eligible: item.eligible === true,
        ready: item.ready === true,
      });
    }
  }
  return [...destinations.values()].sort((left, right) =>
    left.type.localeCompare(right.type),
  );
}

function readPolicies(value: unknown): ParsedAlertPolicy[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((entry): AlertPolicySummary[] => {
      const item = asRecord(entry);
      const alertType = asString(item?.alert_type) ?? asString(item?.alertType);
      if (!item || !alertType) return [];
      const mechanisms = asRecord(item.mechanisms);
      return [
        {
          alertType,
          enabled: item.enabled === true,
          ...(asString(item.id) ? { providerId: asString(item.id) } : {}),
          mechanisms: {
            email: mechanismCount(mechanisms, "email"),
            pagerduty: mechanismCount(mechanisms, "pagerduty"),
            webhook:
              mechanismCount(mechanisms, "webhooks") +
              mechanismCount(mechanisms, "webhook"),
          },
          ...(asString(item.created)
            ? { created: asString(item.created) }
            : {}),
          ...(asString(item.modified)
            ? { modified: asString(item.modified) }
            : {}),
        },
      ];
    })
    .sort((left, right) => left.alertType.localeCompare(right.alertType));
}

function readHistory(value: unknown): ParsedAlertDispatch[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((entry): AlertDispatchSummary[] => {
      const item = asRecord(entry);
      const alertType = asString(item?.alert_type) ?? asString(item?.alertType);
      const mechanismType =
        asString(item?.mechanism_type) ?? asString(item?.mechanismType);
      if (!item || !alertType || !mechanismType) return [];
      return [
        {
          alertType,
          mechanismType: canonicalMechanismType(mechanismType),
          ...(asString(item.id) ? { providerId: asString(item.id) } : {}),
          ...(asString(item.policy_id) || asString(item.policyId)
            ? {
                policyId: asString(item.policy_id) ?? asString(item.policyId),
              }
            : {}),
          ...(asString(item.sent) ? { sent: asString(item.sent) } : {}),
        },
      ];
    })
    .sort((left, right) => (right.sent ?? "").localeCompare(left.sent ?? ""));
}

/**
 * Reduces Cloudflare's alerting payloads to release-relevant, non-secret data.
 * Recipient IDs, webhook URLs, policy IDs, filters, descriptions and alert
 * bodies are deliberately never copied into the report.
 */
export function buildCloudflareAlertAuditReport(
  snapshot: CloudflareAlertApiSnapshot,
): CloudflareAlertAuditReport {
  const availableAlertTypes = readAvailableAlerts(snapshot.availableAlerts);
  const destinations = readDestinations(snapshot.destinationsEligible);
  const parsedPolicies = readPolicies(snapshot.policies);
  const parsedDispatches = readHistory(snapshot.history);
  const policies = parsedPolicies.map(
    ({ providerId: _providerId, ...policy }) => policy,
  );
  const recentDispatches = parsedDispatches.map(
    ({ providerId: _providerId, policyId: _policyId, ...dispatch }) => dispatch,
  );
  const healthCheckAlertAvailable = availableAlertTypes.some(
    (alert) => alert.type === HEALTH_CHECK_ALERT,
  );
  const workerObservabilityAlertAvailable = availableAlertTypes.some(
    (alert) => alert.type === WORKER_OBSERVABILITY_ALERT,
  );
  const emailDeliveryReady = destinations.some(
    (destination) =>
      destination.type === "email" && destination.eligible && destination.ready,
  );
  const healthCheckEmailPolicies = parsedPolicies.filter(
    (policy) =>
      policy.alertType === HEALTH_CHECK_ALERT &&
      policy.enabled &&
      policy.mechanisms.email > 0,
  );
  const healthCheckPolicyIds = new Set(
    healthCheckEmailPolicies.flatMap((policy) =>
      policy.providerId ? [policy.providerId] : [],
    ),
  );
  const healthCheckEmailPolicyConfigured = healthCheckEmailPolicies.length > 0;
  const healthCheckEmailReceiptRecorded = parsedDispatches.some(
    (dispatch) =>
      dispatch.alertType === HEALTH_CHECK_ALERT &&
      dispatch.mechanismType === "email" &&
      dispatch.policyId !== undefined &&
      healthCheckPolicyIds.has(dispatch.policyId),
  );
  const workerObservabilityEmailPolicies = parsedPolicies.filter(
    (policy) =>
      policy.alertType === WORKER_OBSERVABILITY_ALERT &&
      policy.enabled &&
      policy.mechanisms.email > 0,
  );
  const workerObservabilityPolicyIds = new Set(
    workerObservabilityEmailPolicies.flatMap((policy) =>
      policy.providerId ? [policy.providerId] : [],
    ),
  );
  const workerObservabilityEmailPolicyConfigured =
    workerObservabilityEmailPolicies.length > 0;
  const workerObservabilityEmailReceiptRecorded = parsedDispatches.some(
    (dispatch) =>
      dispatch.alertType === WORKER_OBSERVABILITY_ALERT &&
      dispatch.mechanismType === "email" &&
      dispatch.policyId !== undefined &&
      workerObservabilityPolicyIds.has(dispatch.policyId),
  );
  const operationalEmailPolicyConfigured =
    healthCheckEmailPolicyConfigured ||
    workerObservabilityEmailPolicyConfigured;
  const operationalEmailReceiptRecorded =
    healthCheckEmailReceiptRecorded || workerObservabilityEmailReceiptRecorded;
  const capabilityReady =
    emailDeliveryReady &&
    (healthCheckAlertAvailable || workerObservabilityAlertAvailable);
  const releaseEvidenceReady =
    capabilityReady &&
    operationalEmailPolicyConfigured &&
    operationalEmailReceiptRecorded;
  const gaps: string[] = [];

  if (!healthCheckAlertAvailable) {
    gaps.push("Cloudflare Health Check status alerts are not available.");
  }
  if (!emailDeliveryReady) {
    gaps.push("Cloudflare email delivery is not eligible and ready.");
  }
  if (!operationalEmailPolicyConfigured) {
    gaps.push(
      "No enabled Health Check or Workers Observability email notification policy is configured.",
    );
  }
  if (!operationalEmailReceiptRecorded) {
    gaps.push(
      "No Health Check or Workers Observability email dispatch receipt is present in alert history.",
    );
  }

  return {
    availableAlertTypes,
    destinations,
    policies,
    recentDispatches,
    availableAlertTypeCount: availableAlertTypes.length,
    policyCount: policies.length,
    recentDispatchCount: recentDispatches.length,
    healthCheckAlertAvailable,
    workerObservabilityAlertAvailable,
    emailDeliveryReady,
    healthCheckEmailPolicyConfigured,
    healthCheckEmailReceiptRecorded,
    workerObservabilityEmailPolicyConfigured,
    workerObservabilityEmailReceiptRecorded,
    operationalEmailPolicyConfigured,
    operationalEmailReceiptRecorded,
    capabilityReady,
    releaseEvidenceReady,
    gaps,
  };
}
