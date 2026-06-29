import { createMediaRecord } from "@rem-viet/api/services/content";
import { env } from "@rem-viet/env/server";
import { createFileRoute } from "@tanstack/react-router";

import { requireApiSession } from "@/lib/api-auth";
import {
  mediaObjectKey,
  mediaPublicPath,
  validateMediaFiles,
} from "@/lib/media";

export const Route = createFileRoute("/api/uploads/media")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = await requireApiSession();

        if (unauthorized) {
          return unauthorized;
        }

        const formData = await request.formData();
        const files = formData
          .getAll("files")
          .filter((value): value is File => value instanceof File);

        if (!files.length) {
          return Response.json(
            { message: "No media files uploaded", statusCode: 400 },
            { status: 400 },
          );
        }

        const bucket = (env as Env & { PRODUCT_IMAGES?: R2Bucket })
          .PRODUCT_IMAGES;

        if (!bucket) {
          return Response.json(
            { message: "Media storage is not configured", statusCode: 500 },
            { status: 500 },
          );
        }

        try {
          validateMediaFiles(files);
        } catch (error) {
          return Response.json(
            {
              message:
                error instanceof Error ? error.message : "Invalid media file",
              statusCode: 400,
            },
            { status: 400 },
          );
        }

        const uploaded = [];
        const uploadedKeys: string[] = [];

        try {
          for (const file of files) {
            const key = mediaObjectKey(file);
            const url = mediaPublicPath(key);

            await bucket.put(key, file, {
              httpMetadata: {
                contentType: file.type,
              },
            });
            uploadedKeys.push(key);

            const mediaRecord = await createMediaRecord({
              key,
              url,
              altText: "",
              size: file.size,
              mimeType: file.type,
            });

            uploaded.push(mediaRecord.data);
          }
        } catch (error) {
          await Promise.allSettled(uploadedKeys.map((key) => bucket.delete(key)));

          return Response.json(
            {
              message:
                error instanceof Error ? error.message : "Failed to upload media",
              statusCode: 500,
            },
            { status: 500 },
          );
        }

        return Response.json(
          {
            message: "Media uploaded",
            statusCode: 201,
            data: uploaded,
          },
          { status: 201 },
        );
      },
    },
  },
});
