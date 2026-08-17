import type {
  CloudflareCmsMutationEvent,
  CloudflareD1Database,
  CloudflareD1PreparedStatement,
} from "@agency/cms-provider-cloudflare";
import type { CmsPageContent } from "@agency/cms-runtime";

import type { CmsActor } from "./content-revisions";

export type PageSlugRedirect = {
  oldPath: string;
  newPath: string;
};

/** Adds the redirect and its audit record to the provider's page-save batch. */
export function pageSlugRedirectStatements<TContent extends CmsPageContent>(
  database: CloudflareD1Database,
  actor: CmsActor,
  redirect: PageSlugRedirect,
  event: CloudflareCmsMutationEvent<TContent>,
): CloudflareD1PreparedStatement[] {
  if (event.action !== "save") return [];
  const id = crypto.randomUUID();
  const timestamp = event.timestamp.getTime();
  const after = {
    id,
    oldPath: redirect.oldPath,
    newPath: redirect.newPath,
    statusCode: 301,
    active: true,
    createdBy: actor.userId,
    createdAt: event.timestamp.toISOString(),
    updatedAt: event.timestamp.toISOString(),
  };
  return [
    database
      .prepare(
        `INSERT INTO redirects
          (id, old_path, new_path, status_code, active, created_by, created_at, updated_at)
         VALUES (?, ?, ?, 301, 1, ?, ?, ?)`,
      )
      .bind(
        id,
        redirect.oldPath,
        redirect.newPath,
        actor.userId,
        timestamp,
        timestamp,
      ),
    database
      .prepare(
        `INSERT INTO audit_events (
          id, actor_user_id, actor_email, actor_role, action,
          entity_type, entity_id, before, after, request_id, created_at
        ) VALUES (?, ?, ?, ?, 'redirect.create', 'redirect', ?, NULL, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        actor.userId,
        actor.email,
        actor.role,
        id,
        JSON.stringify(after),
        actor.requestId ?? "",
        timestamp,
      ),
  ];
}
