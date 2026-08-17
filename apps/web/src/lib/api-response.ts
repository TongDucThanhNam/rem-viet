import { ZodError } from "zod";
import { TRPCError } from "@trpc/server";

function statusForTrpcCode(code: TRPCError["code"]) {
  switch (code) {
    case "BAD_REQUEST":
      return 400;
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
      return 409;
    case "PAYLOAD_TOO_LARGE":
      return 413;
    case "TOO_MANY_REQUESTS":
      return 429;
    default:
      return 500;
  }
}

export function apiErrorResponse(error: unknown, status = 400) {
  const resolvedStatus =
    error instanceof TRPCError ? statusForTrpcCode(error.code) : status;
  const message =
    error instanceof ZodError
      ? error.issues.map((issue) => issue.message).join("; ")
      : error instanceof Error
        ? error.message
        : "Request failed";

  return Response.json(
    {
      message,
      statusCode: resolvedStatus,
    },
    { status: resolvedStatus },
  );
}
