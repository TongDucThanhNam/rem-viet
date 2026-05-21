import { ZodError } from "zod";

export function apiErrorResponse(error: unknown, status = 400) {
  const message =
    error instanceof ZodError
      ? error.issues.map((issue) => issue.message).join("; ")
      : error instanceof Error
        ? error.message
        : "Request failed";

  return Response.json(
    {
      message,
      statusCode: status,
    },
    { status },
  );
}
