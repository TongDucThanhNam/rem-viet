import { Button } from "@rem-viet/ui/components/button";
import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/not-found")({
  component: NotFoundRoute,
});

function NotFoundRoute() {
  return (
    <main className="grid min-h-[70svh] place-items-center bg-background px-6 py-24 sm:py-32 lg:px-8">
      <div className="text-center">
        <p className="text-base font-semibold text-primary">404</p>
        <h1 className="mt-4 text-3xl font-bold tracking-normal text-foreground sm:text-5xl">
          Page not found
        </h1>
        <p className="mt-6 text-base leading-7 text-muted-foreground">
          Sorry, we couldn&apos;t find the page you&apos;re looking for.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link to="/">
            <Button className="min-h-10 rounded-md px-3.5 text-sm">
              Go back home
            </Button>
          </Link>
          <a
            className="inline-flex min-h-10 items-center rounded-md border px-3.5 text-sm font-semibold text-foreground hover:bg-muted"
            href="/#footer"
          >
            Contact support <span aria-hidden="true">&rarr;</span>
          </a>
        </div>
      </div>
    </main>
  );
}
