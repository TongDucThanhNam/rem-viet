import { getAdminUser } from "@/functions/get-admin-user";
import { rejectCrossSiteMutation } from "@/lib/mutation-request-security";

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

export async function requireApiSession(request: Request) {
  const crossSite = rejectCrossSiteMutation(request);
  if (crossSite) {
    await discardRequestBody(request);
    return crossSite;
  }

  const session = await getAdminUser();

  if (session && !session.mfaRequired) {
    return null;
  }

  await discardRequestBody(request);

  const status = session?.mfaRequired ? 403 : 401;
  return Response.json(
    {
      message: session?.mfaRequired
        ? "Two-factor authentication required"
        : "Admin authentication required",
      statusCode: status,
    },
    { status },
  );
}
