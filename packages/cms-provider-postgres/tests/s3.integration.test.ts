import { describe, expect, test } from "bun:test";
import {
  CreateBucketCommand,
  DeleteBucketCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { createS3CmsObjectStorage } from "../src/s3";

const endpoint = process.env.CMS_S3_TEST_ENDPOINT?.trim();
const accessKeyId = process.env.CMS_S3_TEST_ACCESS_KEY_ID?.trim();
const secretAccessKey = process.env.CMS_S3_TEST_SECRET_ACCESS_KEY?.trim();
const integrationTest =
  endpoint && accessKeyId && secretAccessKey ? test : test.skip;

describe("real S3-compatible storage conformance", () => {
  integrationTest(
    "round-trips bytes and a SigV4 presigned URL through MinIO",
    async () => {
      const bucket = `agency-cms-${Date.now().toString(36)}`;
      const client = new S3Client({
        region: "us-east-1",
        endpoint,
        forcePathStyle: true,
        credentials: {
          accessKeyId: accessKeyId!,
          secretAccessKey: secretAccessKey!,
        },
      });
      const storage = createS3CmsObjectStorage({ bucket, client });
      const key = "media/integration-proof.txt";
      try {
        await client.send(new CreateBucketCommand({ Bucket: bucket }));
        await storage.put(key, "postgres-s3-proof", {
          httpMetadata: { contentType: "text/plain" },
        });
        expect(await storage.exists(key)).toBe(true);
        const response = await fetch(await storage.getPresignedUrl(key, 60));
        expect(response.status).toBe(200);
        expect(await response.text()).toBe("postgres-s3-proof");
        await storage.delete(key);
        expect(await storage.exists(key)).toBe(false);
      } finally {
        if (await storage.exists(key).catch(() => false)) {
          await storage.delete(key);
        }
        await client.send(new DeleteBucketCommand({ Bucket: bucket }));
        client.destroy();
      }
    },
    20_000,
  );
});
