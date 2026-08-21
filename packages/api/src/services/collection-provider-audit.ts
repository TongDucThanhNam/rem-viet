import type {
  CloudflareCmsCollectionMutationEvent,
  CloudflareD1Database,
  CloudflareD1PreparedStatement,
} from "@agency/cms-provider-cloudflare";

import type { CmsActor } from "./content-revisions";

const outboxRetentionMs = 90 * 24 * 60 * 60 * 1_000;

function json(value: unknown) {
  return value === null ? null : JSON.stringify(value);
}

export function cmsCollectionDocumentIdentity(input: {
  collection: string;
  documentId: string;
  locale?: string | null;
}) {
  return `${input.collection}:${input.documentId}:${input.locale || "default"}`;
}

function auditState(event: CloudflareCmsCollectionMutationEvent) {
  if (event.action === "delete") {
    return { before: event.before, after: null };
  }
  if (event.action === "publish" || event.action === "unpublish") {
    return {
      before: {
        publishedRevisionId: event.previousPublishedRevisionId ?? null,
        version: event.version - 1,
      },
      after: {
        publishedRevisionId:
          event.action === "publish" ? (event.revisionId ?? null) : null,
        version: event.version,
      },
    };
  }
  if (event.action === "schedule" || event.action === "unschedule") {
    return {
      before: {
        scheduledAt: event.previousScheduledAt ?? null,
        version: event.version - 1,
      },
      after: {
        scheduledAt: event.scheduledAt ?? null,
        version: event.version,
      },
    };
  }
  return { before: event.before, after: event.after };
}

/** Audit and reliable, content-free publication events prepared inside the
 * collection provider's own D1 batch. */
export function collectionMutationStatements(
  database: CloudflareD1Database,
  actor: CmsActor,
  event: CloudflareCmsCollectionMutationEvent,
): CloudflareD1PreparedStatement[] {
  const identity = cmsCollectionDocumentIdentity(event);
  const state = auditState(event);
  return [
    database
      .prepare(
        `INSERT INTO audit_events (
          id, actor_user_id, actor_email, actor_role, action,
          entity_type, entity_id, before, after, request_id, created_at
        ) VALUES (?, ?, ?, ?, ?, 'cms_collection_document', ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        actor.userId,
        actor.email,
        actor.role,
        `collection.${event.action}`,
        identity,
        json(state.before),
        json(state.after),
        actor.requestId ?? "",
        event.timestamp.getTime(),
      ),
    ...(event.action === "publish" && event.revisionId
      ? [
          database
            .prepare(
              `INSERT INTO cms_outbox_events (
                id, topic, aggregate_type, aggregate_id, aggregate_version,
                payload, idempotency_key, status, attempts, max_attempts,
                available_at, last_error, occurred_at, retention_until
              ) VALUES (?, 'content.collection.published', 'collection', ?, ?, ?, ?,
                'pending', 0, 8, ?, '', ?, ?)`,
            )
            .bind(
              crypto.randomUUID(),
              identity,
              event.version,
              JSON.stringify({
                collection: event.collection,
                documentId: event.documentId,
                locale: event.locale,
                version: event.version,
                revisionId: event.revisionId,
              }),
              `content.collection.published:${identity}:v${event.version}`,
              event.timestamp.getTime(),
              event.timestamp.getTime(),
              event.timestamp.getTime() + outboxRetentionMs,
            ),
        ]
      : []),
  ];
}
