import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/bai-viet")({
  component: PostsLayoutRoute,
});

function PostsLayoutRoute() {
  return <Outlet />;
}
