import {
  decodeSignatureHeader,
  isValidSignature,
  SIGNATURE_HEADER_NAME,
} from "@sanity/webhook";

export const SANITY_WEBHOOK_MAX_BODY_BYTES = 16 * 1024;
export const SANITY_WEBHOOK_MAX_SIGNATURE_AGE_MS = 24 * 60 * 60 * 1000;
export const SANITY_WEBHOOK_FILTER =
  '_type == "agencyPage" && defined(agencyId)';
export const SANITY_WEBHOOK_PROJECTION = `{
  "_type": coalesce(after()._type, before()._type),
  "agencyId": coalesce(after().agencyId, before().agencyId)
}`;

export const sanityWebhookHeaderNames = Object.freeze({
  dataset: "sanity-dataset",
  documentId: "sanity-document-id",
  idempotencyKey: "idempotency-key",
  operation: "sanity-operation",
  projectId: "sanity-project-id",
  signature: SIGNATURE_HEADER_NAME,
  transactionId: "sanity-transaction-id",
  transactionTime: "sanity-transaction-time",
  webhookId: "sanity-webhook-id",
});

export type SanityWebhookOperation = "create" | "update" | "delete";

export type SanityWebhookEvent = Readonly<{
  agencyId: string;
  dataset: string;
  documentId: string;
  idempotencyKey: string;
  operation: SanityWebhookOperation;
  projectId: string;
  signatureTimestamp: string;
  transactionId: string;
  transactionTime: string;
  webhookId: string;
}>;

export type SanityWebhookDeliveryStore = Readonly<{
  claim(event: SanityWebhookEvent): Promise<"claimed" | "duplicate">;
  complete(event: SanityWebhookEvent): Promise<void>;
  release(event: SanityWebhookEvent): Promise<void>;
}>;

export type SanityWebhookRevalidation = Readonly<{
  paths: readonly string[];
  tags?: readonly string[];
}>;

export type SanityWebhookReceipt = Readonly<{
  status: "accepted" | "duplicate";
  event: SanityWebhookEvent;
  revalidation?: SanityWebhookRevalidation;
}>;

export type ReceiveSanityWebhookOptions = Readonly<{
  dataset: string;
  deliveries: SanityWebhookDeliveryStore;
  projectId: string;
  revalidate(event: SanityWebhookEvent): Promise<SanityWebhookRevalidation>;
  secret: string;
  documentIdForAgency?: (agencyId: string) => string;
  maxBodyBytes?: number;
  maxSignatureAgeMs?: number;
  now?: () => Date;
}>;

export class SanityWebhookRequestError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(input: { code: string; message: string; status: number }) {
    super(input.message);
    this.name = "SanityWebhookRequestError";
    this.code = input.code;
    this.status = input.status;
  }
}

export async function receiveSanityWebhook(
  request: Request,
  options: ReceiveSanityWebhookOptions,
): Promise<SanityWebhookReceipt> {
  if (request.method !== "POST") {
    requestError(405, "METHOD_NOT_ALLOWED", "Sanity webhooks require POST.");
  }
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  ) {
    requestError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Sanity webhooks require application/json.",
    );
  }

  const maxBodyBytes = positiveInteger(
    options.maxBodyBytes ?? SANITY_WEBHOOK_MAX_BODY_BYTES,
    "maxBodyBytes",
  );
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
    requestError(413, "PAYLOAD_TOO_LARGE", "Sanity webhook body is too large.");
  }
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > maxBodyBytes) {
    requestError(413, "PAYLOAD_TOO_LARGE", "Sanity webhook body is too large.");
  }

  const secret = boundedString(options.secret, "secret", 32, 512);
  const signature = requiredHeader(
    request.headers,
    sanityWebhookHeaderNames.signature,
  );
  if (!(await isValidSignature(rawBody, signature, secret))) {
    requestError(
      401,
      "INVALID_SIGNATURE",
      "Sanity webhook signature is invalid.",
    );
  }

  const now = options.now?.() ?? new Date();
  const maxSignatureAgeMs = positiveInteger(
    options.maxSignatureAgeMs ?? SANITY_WEBHOOK_MAX_SIGNATURE_AGE_MS,
    "maxSignatureAgeMs",
  );
  const { timestamp } = decodeSignatureHeader(signature);
  if (Math.abs(now.getTime() - timestamp) > maxSignatureAgeMs) {
    requestError(401, "STALE_SIGNATURE", "Sanity webhook signature is stale.");
  }

  const projectId = requiredHeader(
    request.headers,
    sanityWebhookHeaderNames.projectId,
  );
  const dataset = requiredHeader(
    request.headers,
    sanityWebhookHeaderNames.dataset,
  );
  if (projectId !== boundedString(options.projectId, "projectId", 1, 128)) {
    requestError(
      403,
      "PROJECT_MISMATCH",
      "Sanity webhook project is not allowed.",
    );
  }
  if (dataset !== boundedString(options.dataset, "dataset", 1, 128)) {
    requestError(
      403,
      "DATASET_MISMATCH",
      "Sanity webhook dataset is not allowed.",
    );
  }

  const payload = parsePayload(rawBody);
  const documentId = requiredHeader(
    request.headers,
    sanityWebhookHeaderNames.documentId,
  );
  if (/^(drafts|versions)\./.test(documentId)) {
    requestError(
      422,
      "NON_PUBLISHED_DOCUMENT",
      "Draft and version webhooks are not accepted.",
    );
  }
  const documentIdForAgency =
    options.documentIdForAgency ?? defaultDocumentIdForAgency;
  if (documentId !== documentIdForAgency(payload.agencyId)) {
    requestError(
      422,
      "DOCUMENT_MISMATCH",
      "Sanity webhook document does not match its agency page.",
    );
  }

  const operation = requiredHeader(
    request.headers,
    sanityWebhookHeaderNames.operation,
  );
  if (!isOperation(operation)) {
    requestError(
      422,
      "INVALID_OPERATION",
      "Sanity webhook operation is invalid.",
    );
  }
  const transactionTime = requiredHeader(
    request.headers,
    sanityWebhookHeaderNames.transactionTime,
  );
  if (!Number.isFinite(Date.parse(transactionTime))) {
    requestError(
      422,
      "INVALID_TRANSACTION_TIME",
      "Sanity webhook transaction time is invalid.",
    );
  }

  const event: SanityWebhookEvent = Object.freeze({
    agencyId: payload.agencyId,
    dataset,
    documentId,
    idempotencyKey: boundedHeader(
      request.headers,
      sanityWebhookHeaderNames.idempotencyKey,
      255,
    ),
    operation,
    projectId,
    signatureTimestamp: new Date(timestamp).toISOString(),
    transactionId: boundedHeader(
      request.headers,
      sanityWebhookHeaderNames.transactionId,
      255,
    ),
    transactionTime: new Date(transactionTime).toISOString(),
    webhookId: boundedHeader(
      request.headers,
      sanityWebhookHeaderNames.webhookId,
      255,
    ),
  });

  if ((await options.deliveries.claim(event)) === "duplicate") {
    return Object.freeze({ status: "duplicate", event });
  }

  try {
    const revalidation = normalizeRevalidation(await options.revalidate(event));
    await options.deliveries.complete(event);
    return Object.freeze({ status: "accepted", event, revalidation });
  } catch (error) {
    await options.deliveries.release(event).catch(() => undefined);
    throw error;
  }
}

function parsePayload(rawBody: string) {
  let value: unknown;
  try {
    value = JSON.parse(rawBody);
  } catch {
    requestError(400, "INVALID_JSON", "Sanity webhook body is invalid JSON.");
  }
  if (!isRecord(value)) {
    requestError(
      422,
      "INVALID_PAYLOAD",
      "Sanity webhook payload must be an object.",
    );
  }
  const keys = Object.keys(value).sort();
  if (keys.join(",") !== "_type,agencyId" || value._type !== "agencyPage") {
    requestError(
      422,
      "INVALID_PROJECTION",
      "Sanity webhook must use the documented agencyPage projection.",
    );
  }
  if (
    typeof value.agencyId !== "string" ||
    !/^[A-Za-z0-9_-]{1,96}$/.test(value.agencyId)
  ) {
    requestError(
      422,
      "INVALID_AGENCY_ID",
      "Sanity webhook agencyId must be a safe portable identifier.",
    );
  }
  return { agencyId: value.agencyId };
}

function normalizeRevalidation(value: SanityWebhookRevalidation) {
  const paths = [...new Set(value.paths.map(normalizePath))];
  const tags = [...new Set((value.tags ?? []).map(normalizeTag))];
  if (!paths.length && !tags.length) {
    throw new Error(
      "Sanity webhook revalidation must invalidate a path or tag.",
    );
  }
  return Object.freeze({
    paths: Object.freeze(paths),
    ...(tags.length ? { tags: Object.freeze(tags) } : {}),
  });
}

function normalizePath(value: string) {
  const path = boundedString(value, "revalidation path", 1, 512);
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("..")) {
    throw new Error(
      "Sanity webhook revalidation paths must be safe root paths.",
    );
  }
  return path;
}

function normalizeTag(value: string) {
  return boundedString(value, "revalidation tag", 1, 128);
}

function defaultDocumentIdForAgency(agencyId: string) {
  return `agency-page-${agencyId}`;
}

function requiredHeader(headers: Headers, name: string) {
  const value = headers.get(name)?.trim();
  if (!value) {
    requestError(400, "MISSING_HEADER", `Missing required ${name} header.`);
  }
  return value;
}

function boundedHeader(headers: Headers, name: string, maxLength: number) {
  const value = requiredHeader(headers, name);
  if (value.length > maxLength || /[\u0000-\u001f\u007f]/.test(value)) {
    requestError(400, "INVALID_HEADER", `${name} header is invalid.`);
  }
  return value;
}

function boundedString(
  value: unknown,
  name: string,
  minLength: number,
  maxLength: number,
) {
  if (typeof value !== "string") {
    throw new Error(`${name} must be a string.`);
  }
  const normalized = value.trim();
  if (
    normalized.length < minLength ||
    normalized.length > maxLength ||
    /[\u0000-\u001f\u007f]/.test(normalized)
  ) {
    throw new Error(`${name} has an invalid length or control characters.`);
  }
  return normalized;
}

function positiveInteger(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

function isOperation(value: string): value is SanityWebhookOperation {
  return value === "create" || value === "update" || value === "delete";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requestError(status: number, code: string, message: string): never {
  throw new SanityWebhookRequestError({ code, message, status });
}
