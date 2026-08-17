import type {
  CloudflareCmsMutationEvent,
  CloudflareD1Database,
  CloudflareD1PreparedStatement,
} from "@agency/cms-provider-cloudflare";
import type { CmsPageContent } from "@agency/cms-runtime";

import type { CmsActor } from "./content-revisions";

function auditJson(value: unknown) {
  return value === null ? null : JSON.stringify(value);
}

function auditValues<TContent extends CmsPageContent>(
  event: CloudflareCmsMutationEvent<TContent>,
  encodeRevision: (content: TContent) => unknown,
) {
  if (event.action === "delete") {
    return {
      action: "page.delete",
      before: event.before ? encodeRevision(event.before) : null,
      after: null,
    };
  }
  if (event.action === "unpublish") {
    return {
      action: "page.unpublish",
      before: {
        publishedRevisionId: event.previousPublishedRevisionId ?? null,
        version: event.version - 1,
      },
      after: { publishedRevisionId: null, version: event.version },
    };
  }
  if (!event.after) {
    throw new Error(`CMS mutation ${event.action} requires after content.`);
  }
  if (event.action === "publish") {
    return {
      action: "page.publish",
      before: {
        publishedRevisionId: event.previousPublishedRevisionId ?? null,
        version: event.version - 1,
      },
      after: {
        publishedRevisionId: event.revisionId,
        snapshot: encodeRevision(event.after),
        version: event.version,
      },
    };
  }
  if (event.action === "restore") {
    return {
      action: "page.restore",
      before: event.before ? encodeRevision(event.before) : null,
      after: {
        restoredFrom: event.revisionId,
        snapshot: encodeRevision(event.after),
      },
    };
  }
  if (event.action === "schedule" || event.action === "unschedule") {
    return {
      action: `page.${event.action}`,
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
  return {
    action: event.action === "create" ? "page.create" : "page.update",
    before: event.before ? encodeRevision(event.before) : null,
    after: encodeRevision(event.after),
  };
}

export function pageMutationStatements<TContent extends CmsPageContent>(
  database: CloudflareD1Database,
  actor: CmsActor,
  event: CloudflareCmsMutationEvent<TContent>,
  encodeRevision: (content: TContent) => unknown,
): CloudflareD1PreparedStatement[] {
  const values = auditValues(event, encodeRevision);
  return [
    database
      .prepare(
        `INSERT INTO audit_events (
          id, actor_user_id, actor_email, actor_role, action,
          entity_type, entity_id, before, after, request_id, created_at
        ) VALUES (?, ?, ?, ?, ?, 'page', ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        actor.userId,
        actor.email,
        actor.role,
        values.action,
        event.documentId,
        auditJson(values.before),
        auditJson(values.after),
        actor.requestId ?? "",
        event.timestamp.getTime(),
      ),
  ];
}
