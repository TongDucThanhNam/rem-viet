import { getAdminUser } from "@/functions/get-admin-user";

export async function discardRequestBody(request: Request) {
  if (!request.body || request.bodyUsed) {
    return;
  }

  const reader = request.body.getReader();
  try {
    while (!(await reader.read()).done) {
      // Drain without retaining the payload so the Worker proxy can safely
      // reuse the connection after an early authentication response.
    }
  } catch {
    // The response must still fail closed if the client disconnects mid-body.
  } finally {
    reader.releaseLock();
  }
}

export async function requireApiSession(request?: Request) {
  const session = await getAdminUser();

  if (session) {
    return null;
  }

  if (request) {
    await discardRequestBody(request);
  }

  return Response.json(
    { message: "Admin authentication required", statusCode: 401 },
    { status: 401 },
  );
}
