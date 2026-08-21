import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { CmsDamDeliveryAdapter } from "@agency/cms-runtime";

const maximumPresignSeconds = 7 * 24 * 60 * 60;

function safeBucket(value: string) {
  const bucket = value.trim();
  if (
    !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket) ||
    bucket.includes("..")
  ) {
    throw new Error(`Invalid S3 bucket: ${value}`);
  }
  return bucket;
}

function safeObjectKey(value: string) {
  const key = value.trim();
  if (
    !key ||
    key.length > 1_024 ||
    key.startsWith("/") ||
    key.includes("\\") ||
    key.split("/").some((segment) => segment === "..") ||
    /[\u0000-\u001f\u007f]/.test(key)
  ) {
    throw new Error(`Invalid S3 object key: ${value}`);
  }
  return key;
}

function boundedExpiry(seconds: number) {
  if (
    !Number.isInteger(seconds) ||
    seconds < 1 ||
    seconds > maximumPresignSeconds
  ) {
    throw new Error(
      "S3 presigned URLs must expire between 1 second and 7 days.",
    );
  }
  return seconds;
}

export type S3CmsObjectStorage = Readonly<{
  put(
    key: string,
    value: unknown,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  delete(key: string): Promise<unknown>;
  exists(key: string): Promise<boolean>;
  getPresignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
}>;

export function createS3CmsObjectStorage(input: {
  bucket: string;
  client?: S3Client;
  clientConfig?: S3ClientConfig;
  presign?: typeof getSignedUrl;
}): S3CmsObjectStorage {
  const bucket = safeBucket(input.bucket);
  const client = input.client ?? new S3Client(input.clientConfig ?? {});
  const presign = input.presign ?? getSignedUrl;
  return Object.freeze({
    async put(key, value, options) {
      return client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: safeObjectKey(key),
          Body: value as never,
          ...(options?.httpMetadata?.contentType
            ? { ContentType: options.httpMetadata.contentType }
            : {}),
        }),
      );
    },
    async delete(key) {
      return client.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: safeObjectKey(key) }),
      );
    },
    async exists(key) {
      try {
        await client.send(
          new HeadObjectCommand({ Bucket: bucket, Key: safeObjectKey(key) }),
        );
        return true;
      } catch (error) {
        const candidate = error as {
          name?: unknown;
          $metadata?: { httpStatusCode?: unknown };
        };
        if (
          candidate.name === "NotFound" ||
          candidate.name === "NoSuchKey" ||
          candidate.$metadata?.httpStatusCode === 404
        ) {
          return false;
        }
        throw error;
      }
    },
    async getPresignedUrl(key, expiresInSeconds = 900) {
      return presign(
        client,
        new GetObjectCommand({ Bucket: bucket, Key: safeObjectKey(key) }),
        { expiresIn: boundedExpiry(expiresInSeconds) },
      );
    },
  });
}

/** Structural R2-compatible surface accepted by the shared DAM implementation. */
export function createS3R2CompatibleBucket(storage: S3CmsObjectStorage) {
  return Object.freeze({
    put: storage.put,
    delete: storage.delete,
  });
}

export function createS3DamDeliveryAdapter(input: {
  storage: S3CmsObjectStorage;
  now?: () => Date;
}): CmsDamDeliveryAdapter {
  return Object.freeze({
    sign({ key, expiresAt }) {
      const now = input.now?.() ?? new Date();
      const seconds = Math.ceil((expiresAt.getTime() - now.getTime()) / 1_000);
      return input.storage.getPresignedUrl(key, boundedExpiry(seconds));
    },
  });
}
