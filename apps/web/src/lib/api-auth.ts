import { getAdminUser } from "@/functions/get-admin-user";

export async function requireApiSession() {
  const session = await getAdminUser();

  if (session) {
    return null;
  }

  return Response.json(
    { message: "Admin authentication required", statusCode: 401 },
    { status: 401 },
  );
}
