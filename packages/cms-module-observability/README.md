# `@agency/cms-module-observability`

Provider-neutral CMS telemetry with explicit Sentry and OpenTelemetry bridge
ports. The hub emits bounded spans, metrics, and exception records, samples
deterministically when requested, redacts credential/PII-shaped keys and
values before fan-out, and never lets an exporter failure break the observed
CMS operation. Derived telemetry may be deleted on uninstall.
