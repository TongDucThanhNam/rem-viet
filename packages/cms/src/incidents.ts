import { z } from "zod";

export const operationalIncidentCategorySchema = z.enum([
  "publish",
  "upload",
  "notification",
  "migration",
]);
export type OperationalIncidentCategory = z.infer<
  typeof operationalIncidentCategorySchema
>;

export const operationalIncidentSourceSchema = z.enum([
  "request",
  "scheduler",
  "deployment",
]);
export type OperationalIncidentSource = z.infer<
  typeof operationalIncidentSourceSchema
>;

const incidentDetailValueSchema = z.union([
  z.string().max(500),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

export const operationalIncidentEventSchema = z.object({
  schemaVersion: z.literal(1),
  event: z.literal("cms.operational_incident"),
  fingerprint: z.string().min(1).max(160),
  category: operationalIncidentCategorySchema,
  operation: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,119}$/),
  source: operationalIncidentSourceSchema,
  severity: z.enum(["error", "critical"]),
  recoverable: z.boolean(),
  error: z.object({
    name: z.string().min(1).max(100),
    message: z.string().min(1).max(500),
    code: z.string().max(100).optional(),
  }),
  entityType: z.string().max(80).optional(),
  entityId: z.string().max(120).optional(),
  requestId: z.string().max(120).optional(),
  detail: z.record(z.string(), incidentDetailValueSchema).optional(),
  timestamp: z.string().datetime(),
});
export type OperationalIncidentEvent = z.infer<
  typeof operationalIncidentEventSchema
>;

export type OperationalIncidentInput = {
  category: OperationalIncidentCategory;
  operation: string;
  source: OperationalIncidentSource;
  error: unknown;
  severity?: "error" | "critical";
  recoverable?: boolean;
  entityType?: string;
  entityId?: string;
  requestId?: string;
  detail?: Record<string, string | number | boolean | null | undefined>;
  now?: Date;
};

const redactions: Array<[RegExp, string]> = [
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]"],
  [/https?:\/\/[^\s]+/gi, "[redacted-url]"],
  [/\bBearer\s+[^\s]+/gi, "Bearer [redacted-secret]"],
  [
    /\b(?:cfoa[A-Z0-9_.=-]{12,}|re_[A-Z0-9_.=-]{12,}|sk_[A-Z0-9_.=-]{12,})\b/gi,
    "[redacted-secret]",
  ],
  [/\b[A-Z0-9_-]{32,}\b/gi, "[redacted-token]"],
];

export function redactOperationalText(value: string, limit = 500): string {
  let redacted = value.replace(/[\r\n\t]+/g, " ").trim();
  for (const [pattern, replacement] of redactions) {
    redacted = redacted.replace(pattern, replacement);
  }
  return redacted.slice(0, limit) || "Operational failure";
}

const safeIdentifier = (value: string, limit: number) =>
  value.replace(/[^a-zA-Z0-9:._-]/g, "_").slice(0, limit);

function describeError(error: unknown) {
  const record =
    typeof error === "object" && error !== null
      ? (error as Record<string, unknown>)
      : undefined;
  const name = redactOperationalText(
    error instanceof Error ? error.name : "OperationalError",
    100,
  );
  const message = redactOperationalText(
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unknown operational failure",
  );
  const rawCode = record?.code;
  const code =
    typeof rawCode === "string" || typeof rawCode === "number"
      ? redactOperationalText(String(rawCode), 100)
      : undefined;
  return { name, message, ...(code ? { code } : {}) };
}

function safeDetail(
  detail: OperationalIncidentInput["detail"],
): Record<string, string | number | boolean | null> | undefined {
  if (!detail) return undefined;
  const entries = Object.entries(detail)
    .slice(0, 20)
    .flatMap(([key, value]) => {
      if (
        value === undefined ||
        (typeof value === "number" && !isFinite(value))
      )
        return [];
      return [
        [
          safeIdentifier(key, 80),
          typeof value === "string" ? redactOperationalText(value) : value,
        ] as const,
      ];
    });
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

/** Builds a bounded event safe for provider logs and notification payloads. */
export function createOperationalIncidentEvent(
  input: OperationalIncidentInput,
): OperationalIncidentEvent {
  const detail = safeDetail(input.detail);
  return operationalIncidentEventSchema.parse({
    schemaVersion: 1,
    event: "cms.operational_incident",
    fingerprint: `${input.category}:${input.operation}`,
    category: input.category,
    operation: input.operation,
    source: input.source,
    severity: input.severity ?? "error",
    recoverable: input.recoverable ?? true,
    error: describeError(input.error),
    ...(input.entityType
      ? { entityType: safeIdentifier(input.entityType, 80) }
      : {}),
    ...(input.entityId
      ? { entityId: safeIdentifier(input.entityId, 120) }
      : {}),
    ...(input.requestId
      ? { requestId: safeIdentifier(input.requestId, 120) }
      : {}),
    ...(detail ? { detail } : {}),
    timestamp: (input.now ?? new Date()).toISOString(),
  });
}
