import {
  defineCmsExtensionPackageManifest,
  defineCmsFeatureModuleManifest,
  defineFeatureModule,
} from "@agency/cms-core";

export const cmsObservabilityExtensionManifest =
  defineCmsExtensionPackageManifest({
    schemaVersion: 1,
    id: "official/observability",
    packageName: "@agency/cms-module-observability",
    version: "0.1.0",
    classification: "official",
    cmsCompatibility: { minimum: "0.1.0", maximumExclusive: "1.0.0" },
    permissions: [
      {
        id: "official/observability/read",
        capability: "audit.read",
        description: "Inspect redacted CMS traces, metrics, and alert status.",
      },
    ],
    secrets: [
      {
        name: "SENTRY_DSN",
        required: false,
        description: "Optional Sentry project DSN configured by the host.",
        exposure: "server-only",
      },
      {
        name: "OTEL_EXPORTER_OTLP_ENDPOINT",
        required: false,
        description: "Optional host-owned OpenTelemetry exporter endpoint.",
        exposure: "server-only",
      },
    ],
    routes: [],
    admin: [
      {
        id: "official/observability/dashboard",
        slot: "dashboard",
        label: "CMS health",
        requiredCapability: "audit.read",
      },
    ],
    entrypoints: [
      {
        id: "official/observability/server",
        export: ".",
        runtime: "server",
        capabilities: ["audit.read"],
      },
    ],
    data: {
      schemaVersion: 1,
      migrations: [
        {
          id: "official/observability/v1",
          from: 0,
          to: 1,
          reversible: false,
        },
      ],
      uninstall: {
        policy: "delete",
        description:
          "Derived redacted telemetry may be deleted without changing canonical content.",
      },
    },
  });

export const cmsObservabilityModule = defineFeatureModule({
  id: "official-observability",
  manifest: defineCmsFeatureModuleManifest({
    schemaVersion: 1,
    packageName: "@agency/cms-module-observability",
    version: "0.1.0",
    cmsCompatibility: { minimum: "0.1.0", maximumExclusive: "1.0.0" },
    uninstall: {
      dataPolicy: "delete",
      description:
        "Derived redacted telemetry may be deleted without changing canonical content.",
    },
  }),
  permissions: [
    {
      id: "official-observability/read",
      capability: "audit.read",
      operations: ["update"],
      description: "Inspect CMS telemetry health and exporter status.",
    },
  ],
  migrations: [
    {
      id: "official-observability/v1",
      from: 0,
      to: 1,
      migrate: (state) => state ?? { exporterHealth: {} },
    },
  ],
  admin: [
    {
      id: "official-observability/dashboard",
      placement: "dashboard",
      label: "CMS health",
    },
  ],
});

export type CmsTelemetryAttributes = Readonly<Record<string, unknown>>;

export type CmsTelemetryEvent =
  | Readonly<{
      type: "span";
      traceId: string;
      name: string;
      status: "ok" | "error";
      startedAt: string;
      durationMs: number;
      attributes: CmsTelemetryAttributes;
    }>
  | Readonly<{
      type: "metric";
      name: string;
      value: number;
      recordedAt: string;
      attributes: CmsTelemetryAttributes;
    }>
  | Readonly<{
      type: "exception";
      traceId: string;
      name: string;
      message: string;
      recordedAt: string;
      attributes: CmsTelemetryAttributes;
    }>;

export interface CmsTelemetrySink {
  readonly name: string;
  emit(event: CmsTelemetryEvent): void | Promise<void>;
}

const redactedKeyPattern =
  /(?:authorization|cookie|password|passphrase|secret|token|api[-_]?key|session|email|phone|ip[-_]?address)/i;
const emailValuePattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const bearerValuePattern = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;

function sanitizeString(value: string) {
  return value
    .slice(0, 2_000)
    .replace(emailValuePattern, "[REDACTED_EMAIL]")
    .replace(bearerValuePattern, "Bearer [REDACTED]");
}

export function sanitizeCmsTelemetryValue(
  value: unknown,
  options: { maximumDepth?: number; maximumArrayLength?: number } = {},
): unknown {
  const maximumDepth = options.maximumDepth ?? 6;
  const maximumArrayLength = options.maximumArrayLength ?? 100;
  const visit = (input: unknown, depth: number): unknown => {
    if (
      input === null ||
      typeof input === "boolean" ||
      typeof input === "number"
    )
      return input;
    if (typeof input === "string") return sanitizeString(input);
    if (depth >= maximumDepth) return "[TRUNCATED]";
    if (Array.isArray(input))
      return Object.freeze(
        input
          .slice(0, maximumArrayLength)
          .map((item) => visit(item, depth + 1)),
      );
    if (input && typeof input === "object") {
      return Object.freeze(
        Object.fromEntries(
          Object.entries(input as Record<string, unknown>)
            .slice(0, 200)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, item]) => [
              key,
              redactedKeyPattern.test(key)
                ? "[REDACTED]"
                : visit(item, depth + 1),
            ]),
        ),
      );
    }
    return String(input).slice(0, 500);
  };
  return visit(value, 0);
}

function eventName(value: string) {
  const name = value.trim();
  if (!/^[a-z][a-z0-9._/-]{1,159}$/i.test(name))
    throw new Error(`Invalid telemetry event name: ${value}.`);
  return name;
}

function errorMessage(error: unknown) {
  return sanitizeString(error instanceof Error ? error.message : String(error));
}

function safeAttributes(value: CmsTelemetryAttributes | undefined) {
  return sanitizeCmsTelemetryValue(value ?? {}) as CmsTelemetryAttributes;
}

export function createCmsObservabilityHub(input: {
  sinks: readonly CmsTelemetrySink[];
  sampleRate?: number;
  random?: () => number;
  now?: () => Date;
  createTraceId?: () => string;
  onSinkError?: (sinkName: string, error: unknown) => void;
}) {
  const sampleRate = input.sampleRate ?? 1;
  if (!Number.isFinite(sampleRate) || sampleRate < 0 || sampleRate > 1)
    throw new Error("Telemetry sample rate must be between 0 and 1.");
  const names = input.sinks.map(({ name }) => eventName(name));
  if (new Set(names).size !== names.length)
    throw new Error("Telemetry sink names must be unique.");
  const random = input.random ?? Math.random;
  const now = input.now ?? (() => new Date());
  const createTraceId =
    input.createTraceId ?? (() => crypto.randomUUID().replaceAll("-", ""));
  const emit = async (event: CmsTelemetryEvent) => {
    const results = await Promise.allSettled(
      input.sinks.map((sink) => sink.emit(event)),
    );
    results.forEach((result, index) => {
      if (result.status === "rejected")
        input.onSinkError?.(names[index]!, result.reason);
    });
  };
  const exception = async (
    error: unknown,
    attributes?: CmsTelemetryAttributes,
    traceId = createTraceId(),
  ) => {
    await emit(
      Object.freeze({
        type: "exception",
        traceId,
        name: error instanceof Error ? error.name.slice(0, 160) : "Error",
        message: errorMessage(error),
        recordedAt: now().toISOString(),
        attributes: safeAttributes(attributes),
      }),
    );
  };
  return Object.freeze({
    async runSpan<TResult>(
      span: { name: string; attributes?: CmsTelemetryAttributes },
      operation: () => TResult | Promise<TResult>,
    ) {
      const name = eventName(span.name);
      const sampled = random() < sampleRate;
      const traceId = createTraceId();
      const started = now();
      try {
        const result = await operation();
        if (sampled) {
          const ended = now();
          await emit(
            Object.freeze({
              type: "span",
              traceId,
              name,
              status: "ok",
              startedAt: started.toISOString(),
              durationMs: Math.max(0, ended.getTime() - started.getTime()),
              attributes: safeAttributes(span.attributes),
            }),
          );
        }
        return result;
      } catch (error) {
        if (sampled) {
          const ended = now();
          await emit(
            Object.freeze({
              type: "span",
              traceId,
              name,
              status: "error",
              startedAt: started.toISOString(),
              durationMs: Math.max(0, ended.getTime() - started.getTime()),
              attributes: safeAttributes(span.attributes),
            }),
          );
          await exception(error, span.attributes, traceId);
        }
        throw error;
      }
    },
    async recordMetric(metric: {
      name: string;
      value: number;
      attributes?: CmsTelemetryAttributes;
    }) {
      if (!Number.isFinite(metric.value))
        throw new Error("Telemetry metric value must be finite.");
      if (random() >= sampleRate) return;
      await emit(
        Object.freeze({
          type: "metric",
          name: eventName(metric.name),
          value: metric.value,
          recordedAt: now().toISOString(),
          attributes: safeAttributes(metric.attributes),
        }),
      );
    },
    captureException: exception,
  });
}

export function createCmsSentryTelemetrySink(input: {
  name?: string;
  captureException: (
    error: Readonly<{ name: string; message: string }>,
    context: Readonly<{
      tags: Record<string, string>;
      extra: CmsTelemetryAttributes;
    }>,
  ) => void | Promise<void>;
  captureMessage: (
    message: string,
    context: Readonly<{
      level: "info" | "error";
      extra: CmsTelemetryAttributes;
    }>,
  ) => void | Promise<void>;
}): CmsTelemetrySink {
  return Object.freeze({
    name: input.name ?? "sentry",
    async emit(event: CmsTelemetryEvent) {
      if (event.type === "exception") {
        await input.captureException(
          { name: event.name, message: event.message },
          { tags: { traceId: event.traceId }, extra: event.attributes },
        );
        return;
      }
      await input.captureMessage(`cms.${event.type}.${event.name}`, {
        level:
          event.type === "span" && event.status === "error" ? "error" : "info",
        extra: event,
      });
    },
  });
}

export function createCmsOpenTelemetrySink(input: {
  name?: string;
  recordSpan: (
    event: Extract<CmsTelemetryEvent, { type: "span" }>,
  ) => void | Promise<void>;
  recordMetric: (
    event: Extract<CmsTelemetryEvent, { type: "metric" }>,
  ) => void | Promise<void>;
  recordException: (
    event: Extract<CmsTelemetryEvent, { type: "exception" }>,
  ) => void | Promise<void>;
}): CmsTelemetrySink {
  return Object.freeze({
    name: input.name ?? "opentelemetry",
    emit(event: CmsTelemetryEvent) {
      if (event.type === "span") return input.recordSpan(event);
      if (event.type === "metric") return input.recordMetric(event);
      return input.recordException(event);
    },
  });
}
