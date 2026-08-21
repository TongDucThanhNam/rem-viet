import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <main>
      Existing TanStack Start fixture <Link to="/account">Account</Link>
    </main>
  );
}
