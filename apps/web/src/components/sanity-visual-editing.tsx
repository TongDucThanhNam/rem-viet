import { enableVisualEditing } from "@sanity/visual-editing";
import { useEffect } from "react";

export function SanityVisualEditing({
  onRefresh,
}: {
  onRefresh: () => Promise<void>;
}) {
  useEffect(() => {
    return enableVisualEditing({
      history: {
        subscribe: (navigate) => {
          const onPopState = () =>
            navigate({ type: "pop", url: location.href });
          addEventListener("popstate", onPopState);
          return () => removeEventListener("popstate", onPopState);
        },
        update: (update) => {
          if (update.type === "push") history.pushState(null, "", update.url);
          if (update.type === "replace") {
            history.replaceState(null, "", update.url);
          }
          dispatchEvent(new PopStateEvent("popstate"));
        },
      },
      refresh: (payload) =>
        payload.source === "manual" || payload.source === "mutation"
          ? onRefresh()
          : false,
      onPerspectiveChange: async (perspective) => {
        const response = await fetch("/api/draft-mode/perspective", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            perspective,
            partitioned: window.self !== window.top,
          }),
        });
        if (response.status === 200) await onRefresh();
      },
      zIndex: 10_001,
    });
  }, [onRefresh]);

  return null;
}
