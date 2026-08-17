import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";

import { HomepageRenderer } from "@/components/landing/homepage-renderer";
import { SanityVisualEditing } from "@/components/sanity-visual-editing";
import { loadSanityPreviewPage } from "@/lib/sanity-preview.server";
import { siteConfig } from "@/lib/site-config";

export const Route = createFileRoute("/sanity-preview/$id")({
  loader: ({ params }) => getPreviewPage({ data: { id: params.id } }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title:
          loaderData?.status === "ok"
            ? `${loaderData.title} — Sanity preview`
            : `Sanity preview — ${siteConfig.name}`,
      },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: SanityPreviewRoute,
});

const getPreviewPage = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => ({ id: data.id.trim() }))
  .handler(({ data }) => loadSanityPreviewPage(data.id));

function SanityPreviewRoute() {
  const page = Route.useLoaderData();
  const { id } = Route.useParams();
  const [blocks, setBlocks] = useState(page.status === "ok" ? page.blocks : []);
  const refreshSequence = useRef(0);
  useEffect(() => {
    if (page.status === "ok") setBlocks(page.blocks);
  }, [page]);
  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    const response = await fetch(
      `/api/draft-mode/page/${encodeURIComponent(id)}`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      throw new Error(`Sanity preview refresh failed (${response.status}).`);
    }
    const next = (await response.json()) as typeof page;
    if (next.status !== "ok") {
      throw new Error(`Sanity preview refresh returned ${next.status}.`);
    }
    if (sequence === refreshSequence.current) setBlocks(next.blocks);
  }, [id]);

  if (page.status !== "ok") {
    const messages = {
      "not-configured": "Sanity preview is not configured for this site.",
      unauthorized: "This preview session is invalid or has expired.",
      "not-found": "The requested Sanity page does not exist.",
      "invalid-content": "The Sanity document does not match this template.",
    } as const;
    return (
      <main className="grid min-h-dvh place-items-center bg-neutral-950 px-6 text-white">
        <p className="max-w-lg text-center text-sm">{messages[page.status]}</p>
      </main>
    );
  }

  return (
    <>
      <HomepageRenderer blocks={blocks} preview />
      <SanityVisualEditing onRefresh={refresh} />
    </>
  );
}
