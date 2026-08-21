import {
  rollbackUploadedMediaRecord,
  uploadMediaRecord,
} from "@rem-viet/api/services/content";
import { reportOperationalIncident } from "@rem-viet/api/services/incidents";
import { allowedMediaTypeSchema, roleHasCapability } from "@rem-viet/cms";
import { env } from "@rem-viet/env/server";
import { createFileRoute } from "@tanstack/react-router";

import { getAdminUser } from "@/functions/get-admin-user";
import { discardRequestBody } from "@/lib/api-auth";
import { rejectCrossSiteMutation } from "@/lib/mutation-request-security";
import {
  mediaObjectKey,
  mediaPublicPath,
  validateMediaFiles,
} from "@/lib/media";

export const Route = createFileRoute("/api/uploads/media")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const crossSite = rejectCrossSiteMutation(request);
        if (crossSite) {
          await discardRequestBody(request);
          return crossSite;
        }
        const session = await getAdminUser();
        if (!session?.user) {
          await discardRequestBody(request);
          return Response.json(
            { message: "Admin authentication required", statusCode: 401 },
            { status: 401 },
          );
        }
        if (session.mfaRequired) {
          await discardRequestBody(request);
          return Response.json(
            {
              message: "Two-factor authentication required",
              statusCode: 403,
            },
            { status: 403 },
          );
        }
        if (!roleHasCapability(session.staffRole, "media.manage")) {
          await discardRequestBody(request);
          return Response.json(
            { message: "Missing capability: media.manage", statusCode: 403 },
            { status: 403 },
          );
        }

        const formData = await request.formData();
        const requestId =
          request.headers.get("x-request-id") ?? crypto.randomUUID();
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
          reportOperationalIncident({
            category: "upload",
            operation: "media.upload.configuration",
            source: "request",
            error: new Error("Media storage binding is not configured"),
            requestId,
            recoverable: false,
            detail: { fileCount: files.length },
          });
          return Response.json(
            { message: "Media storage is not configured", statusCode: 500 },
            { status: 500 },
          );
        }

        try {
          await validateMediaFiles(files);
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
        const uploadedIds: string[] = [];
        const actor = {
          userId: session.user.id,
          email: session.user.email,
          role: session.staffRole,
          requestId,
        };

        try {
          for (const file of files) {
            const key = mediaObjectKey(file);
            const url = mediaPublicPath(key);

            const mediaRecord = await uploadMediaRecord(
              {
                key,
                url,
                altText: "",
                size: file.size,
                mimeType: allowedMediaTypeSchema.parse(file.type),
                body: file,
              },
              actor,
            );

            uploaded.push(mediaRecord.data);
            if (mediaRecord.data) uploadedIds.push(mediaRecord.data.id);
          }
        } catch (error) {
          await Promise.allSettled(
            uploadedIds.map((id) => rollbackUploadedMediaRecord(id, actor)),
          );
          reportOperationalIncident({
            category: "upload",
            operation: "media.upload.persistence",
            source: "request",
            error,
            requestId,
            recoverable: true,
            detail: {
              fileCount: files.length,
              rolledBackObjects: uploadedIds.length,
            },
          });

          return Response.json(
            {
              message:
                error instanceof Error
                  ? error.message
                  : "Failed to upload media",
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
