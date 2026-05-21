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
            { message: "No image files uploaded", statusCode: 400 },
            { status: 400 },
          );
        }

        const bucket = (env as Env & { PRODUCT_IMAGES?: R2Bucket })
          .PRODUCT_IMAGES;

        if (!bucket) {
          return Response.json(
            { message: "Product image storage is not configured", statusCode: 500 },
            { status: 500 },
          );
        }

        try {
          validateProductImageFiles(files);
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

        for (const file of files) {
          const key = productImageObjectKey(file);

          await bucket.put(key, file, {
            httpMetadata: {
              contentType: file.type,
            },
          });
          uploaded.push({
            key,
            url: productImagePublicPath(key),
          });
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
