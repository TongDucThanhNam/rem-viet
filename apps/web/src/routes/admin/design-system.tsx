import { AdminPage } from "@/components/admin-shell";
import { ColorsEditor } from "@/components/design-system/colors-editor";
import { DesignTokensBootstrap } from "@/components/design-system/design-tokens-bootstrap";
import { RadiiShadowsEditor } from "@/components/design-system/radii-shadows-editor";
import { SpacingScaleEditor } from "@/components/design-system/spacing-scale-editor";
import { TypographyEditor } from "@/components/design-system/typography-editor";
import { cn } from "@rem-viet/ui/lib/utils";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";

import { getAdminUser } from "@/functions/get-admin-user";

export const Route = createFileRoute("/admin/design-system")({
  component: AdminDesignSystemRoute,
  beforeLoad: async () => ({ session: await getAdminUser() }),
  loader: ({ context }) => {
    if (!context.session) throw redirect({ to: "/dang-nhap" });
  },
});

type TabId = "spacing" | "typography" | "colors" | "radii-shadows";

const tabs: Array<{ id: TabId; label: string; description: string }> = [
  {
    id: "spacing",
    label: "Spacing",
    description: "Define rhythm với min/max ratio và base size.",
  },
  {
    id: "typography",
    label: "Typography",
    description: "Type scale ladder — display → small.",
  },
  {
    id: "colors",
    label: "Colors",
    description: "Canvas, panel, text, accent tokens.",
  },
  {
    id: "radii-shadows",
    label: "Radii & Shadows",
    description: "Border radius scale cho components.",
  },
];

function AdminDesignSystemRoute() {
  const [tab, setTab] = useState<TabId>("spacing");

  return (
    <AdminPage
      titleOverride="Design System"
    >
      <DesignTokensBootstrap />
      <div className="flex flex-col gap-4">
        <nav
          aria-label="Design system sections"
          className="flex border-b border-border"
        >
          {tabs.map((entry) => (
            <TabTrigger
              active={tab === entry.id}
              description={entry.description}
              key={entry.id}
              label={entry.label}
              onClick={() => setTab(entry.id)}
            />
          ))}
        </nav>

        <div>
          {tab === "spacing" ? <SpacingScaleEditor /> : null}
          {tab === "typography" ? <TypographyEditor /> : null}
          {tab === "colors" ? <ColorsEditor /> : null}
          {tab === "radii-shadows" ? <RadiiShadowsEditor /> : null}
        </div>
      </div>
    </AdminPage>
  );
}

function TabTrigger({
  active,
  description,
  label,
  onClick,
}: {
  active: boolean;
  description: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-selected={active}
      className={cn(
        "group relative flex flex-1 flex-col items-start gap-0.5 px-4 py-3 text-left",
        "transition-colors duration-150 ease-out motion-reduce:transition-none",
        active
          ? "text-foreground"
          : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
      )}
      onClick={onClick}
      role="tab"
      type="button"
    >
      <span className="text-sm font-medium">{label}</span>
      <span className="text-[11px] text-muted-foreground">{description}</span>
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-0 bottom-0 h-0.5 transition-colors",
          active ? "bg-emerald-500" : "bg-transparent",
        )}
      />
    </button>
  );
}
