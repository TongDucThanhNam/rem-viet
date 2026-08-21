import { describe, expect, test } from "bun:test";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";

import {
  createS3CmsObjectStorage,
  createS3DamDeliveryAdapter,
  createS3R2CompatibleBucket,
} from "../src/s3";

describe("S3-compatible CMS object storage", () => {
  test("uses official SDK commands, bounded presigning, and an R2-compatible surface", async () => {
    const commands: unknown[] = [];
    const client = {
      async send(command: unknown) {
        commands.push(command);
        return {};
      },
    } as unknown as S3Client;
    const storage = createS3CmsObjectStorage({
      bucket: "agency-cms-assets",
      client,
      presign: async (_client, command, options) => {
        commands.push({ command, options });
        return "https://signed.example/asset";
      },
    });
    await storage.put("media/hero image.png", new Uint8Array([1, 2]), {
      httpMetadata: { contentType: "image/png" },
    });
    expect(commands[0]).toBeInstanceOf(PutObjectCommand);
    expect((commands[0] as PutObjectCommand).input).toMatchObject({
      Bucket: "agency-cms-assets",
      Key: "media/hero image.png",
      ContentType: "image/png",
    });
    await storage.exists("media/hero image.png");
    expect(commands[1]).toBeInstanceOf(HeadObjectCommand);
    await createS3R2CompatibleBucket(storage).delete("media/hero image.png");
    expect(commands[2]).toBeInstanceOf(DeleteObjectCommand);
    const delivery = createS3DamDeliveryAdapter({
      storage,
      now: () => new Date("2026-08-21T00:00:00.000Z"),
    });
    expect(
      await delivery.sign({
        key: "media/hero image.png",
        url: "https://private.invalid",
        expiresAt: new Date("2026-08-21T00:15:00.000Z"),
      }),
    ).toBe("https://signed.example/asset");
    const signed = commands[3] as {
      command: GetObjectCommand;
      options: { expiresIn: number };
    };
    expect(signed.command).toBeInstanceOf(GetObjectCommand);
    expect(signed.options.expiresIn).toBe(900);
  });

  test("fails closed for unsafe keys, buckets, expiry, and non-404 storage errors", async () => {
    expect(() => createS3CmsObjectStorage({ bucket: "Bad_Bucket" })).toThrow(
      "bucket",
    );
    const client = {
      async send() {
        throw new Error("storage offline");
      },
    } as unknown as S3Client;
    const storage = createS3CmsObjectStorage({
      bucket: "valid-bucket",
      client,
    });
    await expect(storage.put("../secret", "x")).rejects.toThrow("key");
    await expect(storage.exists("media/a.png")).rejects.toThrow(
      "storage offline",
    );
    await expect(
      storage.getPresignedUrl("media/a.png", 604_801),
    ).rejects.toThrow("7 days");
  });
});
