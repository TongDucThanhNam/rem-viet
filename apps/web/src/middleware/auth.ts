import { createAuth } from "@rem-viet/auth";
import { createMiddleware } from "@tanstack/start-client-core";

export const authMiddleware = createMiddleware().server(async ({ next, request }) => {
  const session = await createAuth().api.getSession({
    headers: request.headers,
  });
  return next({
    context: { session },
  });
});
