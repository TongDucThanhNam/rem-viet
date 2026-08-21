import type {
  CloudflareCmsGlobalMutationEvent,
  CloudflareD1Database,
  CloudflareD1PreparedStatement,
} from "@agency/cms-provider-cloudflare";

import type { CmsActor } from "./content-revisions";

const outboxRetentionMs = 90 * 24 * 60 * 60 * 1_000;

function json(value: unknown) {
  return value === null ? null : JSON.stringify(value);
}

/** Audit and content-free publication events prepared inside the global
 * provider's D1 batch, so a visible publication and its durable evidence cannot
 * diverge. */
export function globalMutationStatements(
  database: CloudflareD1Database,
  actor: CmsActor,
  event: CloudflareCmsGlobalMutationEvent,
): CloudflareD1PreparedStatement[] {
  const before =
    event.action === "publish" || event.action === "rollback"
      ? {
          publishedRevisionId: event.previousPublishedRevisionId,
          version: event.version - 1,
        }
      : event.before;
  const after =
    event.action === "publish"
      ? { publishedRevisionId: event.revisionId, version: event.version }
      : event.action === "rollback"
        ? { version: event.restoredVersion }
        : event.after;
  return [
    database
      .prepare(
        `INSERT INTO audit_events (
          id, actor_user_id, actor_email, actor_role, action,
          entity_type, entity_id, before, after, request_id, created_at
        ) VALUES (?, ?, ?, ?, ?, 'cms_global', ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        actor.userId,
        actor.email,
        actor.role,
        `global.${event.action}`,
        event.key,
        json(before),
        json(after),
        actor.requestId ?? "",
        event.timestamp.getTime(),
      ),
    ...(event.action === "publish"
      ? [
          database
            .prepare(
              `INSERT INTO cms_outbox_events (
                id, topic, aggregate_type, aggregate_id, aggregate_version,
                payload, idempotency_key, status, attempts, max_attempts,
                available_at, last_error, occurred_at, retention_until
              ) VALUES (?, 'content.global.published', 'global', ?, ?, ?, ?,
                'pending', 0, 8, ?, '', ?, ?)`,
            )
            .bind(
              crypto.randomUUID(),
              event.key,
              event.version,
              JSON.stringify({
                key: event.key,
                version: event.version,
                revisionId: event.revisionId,
              }),
              `content.global.published:${event.key}:v${event.version}`,
              event.timestamp.getTime(),
              event.timestamp.getTime(),
              event.timestamp.getTime() + outboxRetentionMs,
            ),
        ]
      : []),
    ...(event.action === "rollback"
      ? [
          database
            .prepare(
              `DELETE FROM cms_outbox_events
               WHERE idempotency_key = ?`,
            )
            .bind(`content.global.published:${event.key}:v${event.version}`),
        ]
      : []),
  ];
}
