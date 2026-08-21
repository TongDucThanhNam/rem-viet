const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

function forbidden() {
  return Response.json(
    { message: "Same-origin mutation required", statusCode: 403 },
    {
      status: 403,
      headers: {
        "cache-control": "no-store",
        vary: "Origin, Sec-Fetch-Site",
      },
    },
  );
}

/**
 * Rejects browser mutation requests that are not bound to this exact origin.
 * Origin-less server/API-key clients remain valid; browsers identify cross-site
 * requests through Origin and/or Sec-Fetch-Site before any body is consumed.
 */
export function rejectCrossSiteMutation(request: Request) {
  if (safeMethods.has(request.method.toUpperCase())) return null;

  const origin = request.headers.get("origin")?.trim();
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  const hasSessionCookie = Boolean(request.headers.get("cookie")?.trim());
  if (fetchSite === "cross-site" || fetchSite === "same-site") {
    return forbidden();
  }
  if (hasSessionCookie && !origin) return forbidden();
  if (origin && origin !== new URL(request.url).origin) return forbidden();
  return null;
}
