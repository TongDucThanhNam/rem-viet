import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/account")({
  component: () => <main>Existing account route</main>,
});
