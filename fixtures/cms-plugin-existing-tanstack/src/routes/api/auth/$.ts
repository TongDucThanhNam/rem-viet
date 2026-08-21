import { createFileRoute } from "@tanstack/react-router";

const unauthorized = () =>
  Response.json({ message: "Fixture auth required" }, { status: 401 });

export const Route = createFileRoute("/api/auth/$")({
  server: { handlers: { GET: unauthorized, POST: unauthorized } },
});
