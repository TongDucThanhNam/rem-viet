import type { SanityWebhookDeliveryStore } from "@agency/cms-provider-sanity/webhook";

export const sanityWebhookProcessingLeaseMs = 5 * 60 * 1000;

export function createD1DeliveryStore(
  database: D1Database,
  now: () => Date = () => new Date(),
  processingLeaseMs = sanityWebhookProcessingLeaseMs,
): SanityWebhookDeliveryStore {
  return {
    async claim(event) {
      const timestamp = now().getTime();
      const insert = await database
        .prepare(
          `INSERT INTO sanity_webhook_deliveries (
            idempotency_key, webhook_id, project_id, dataset, document_id,
            agency_id, operation, transaction_id, transaction_time,
            signature_timestamp, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'processing', ?, ?)
          ON CONFLICT(idempotency_key) DO NOTHING`,
        )
        .bind(
          event.idempotencyKey,
          event.webhookId,
          event.projectId,
          event.dataset,
          event.documentId,
          event.agencyId,
          event.operation,
          event.transactionId,
          Date.parse(event.transactionTime),
          Date.parse(event.signatureTimestamp),
          timestamp,
          timestamp,
        )
        .run();
      if (insert.meta.changes > 0) return "claimed";

      const reclaimed = await database
        .prepare(
          `UPDATE sanity_webhook_deliveries
           SET updated_at = ?
           WHERE idempotency_key = ? AND status = 'processing' AND updated_at < ?`,
        )
        .bind(timestamp, event.idempotencyKey, timestamp - processingLeaseMs)
        .run();
      return reclaimed.meta.changes > 0 ? "claimed" : "duplicate";
    },
    async complete(event) {
      const timestamp = now().getTime();
      await database
        .prepare(
          `UPDATE sanity_webhook_deliveries
           SET status = 'completed', completed_at = ?, updated_at = ?
           WHERE idempotency_key = ? AND status = 'processing'`,
        )
        .bind(timestamp, timestamp, event.idempotencyKey)
        .run();
    },
    async release(event) {
      await database
        .prepare(
          `DELETE FROM sanity_webhook_deliveries
           WHERE idempotency_key = ? AND status = 'processing'`,
        )
        .bind(event.idempotencyKey)
        .run();
    },
  };
}
