import {
  createOperationalIncidentEvent,
  type OperationalIncidentInput,
} from "@rem-viet/cms";

/** Emits one structured, redacted event for Cloudflare Workers Observability. */
export function reportOperationalIncident(input: OperationalIncidentInput) {
  const event = createOperationalIncidentEvent(input);
  console.error("[cms:incident]", event);
  return event;
}
