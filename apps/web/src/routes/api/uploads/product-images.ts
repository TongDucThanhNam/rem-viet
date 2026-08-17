import { reportOperationalIncident } from "@rem-viet/api/services/incidents";
import { env } from "@rem-viet/env/server";
import { createFileRoute } from "@tanstack/react-router";

import { requireApiSession } from "@/lib/api-auth";
import {
  productImageObjectKey,
  productImagePublicPath,
  validateProductImageFiles,
} from "@/lib/product-images";

export const Route = createFileRoute("/api/uploads/product-images")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = await requireApiSession(request);

        if (unauthorized) {
          return unauthorized;
        }

        const formData = await request.formData();
        const requestId =
          request.headers.get("x-request-id") ?? crypto.randomUUID();
        const files = formData
          .getAll("files")
          .filter((value): value is File => value instanceof File);

        if (!files.length) {
          return Response.json(
            { message: "No image files uploaded", statusCode: 400 },
            { status: 400 },
          );
        }

        const bucket = (env as Env & { PRODUCT_IMAGES?: R2Bucket })
          .PRODUCT_IMAGES;

        if (!bucket) {
          reportOperationalIncident({
            category: "upload",
            operation: "product-image.upload.configuration",
            source: "request",
            error: new Error("Product image storage binding is not configured"),
            requestId,
            recoverable: false,
            detail: { fileCount: files.length },
          });
          return Response.json(
            {
              message: "Product image storage is not configured",
              statusCode: 500,
            },
            { status: 500 },
          );
        }

        try {
          await validateProductImageFiles(files);
        } catch (error) {
          return Response.json(
            {
              message:
                error instanceof Error ? error.message : "Invalid image file",
              statusCode: 400,
            },
            { status: 400 },
          );
        }

        const uploaded = [];
        const uploadedKeys: string[] = [];

        try {
          for (const file of files) {
            const key = productImageObjectKey(file);

            await bucket.put(key, file, {
              httpMetadata: {
                contentType: file.type,
              },
            });
            uploadedKeys.push(key);
            uploaded.push({
              key,
              url: productImagePublicPath(key),
            });
          }
        } catch (error) {
          await Promise.allSettled(
            uploadedKeys.map((key) => bucket.delete(key)),
          );
          reportOperationalIncident({
            category: "upload",
            operation: "product-image.upload.persistence",
            source: "request",
            error,
            requestId,
            recoverable: true,
            detail: {
              fileCount: files.length,
              rolledBackObjects: uploadedKeys.length,
            },
          });
          return Response.json(
            {
              message: "Failed to upload product images",
              statusCode: 500,
            },
            { status: 500 },
          );
        }

        return Response.json(
          {
            message: "Images uploaded",
            statusCode: 201,
            data: uploaded,
          },
          { status: 201 },
        );
      },
    },
  },
});
