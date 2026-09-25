import { Input } from "@rem-viet/ui/components/input";
import { Label } from "@rem-viet/ui/components/label";

import {
  designTokenStorageKeys,
  usePersistedEditorState,
} from "@/hooks/use-persisted-editor-state";

type ColorToken = {
  key: string;
  label: string;
  value: string;
};

const DEFAULT_COLOR_TOKENS: ColorToken[] = [
  { key: "bg", label: "Canvas", value: "#0a0a0a" },
  { key: "panel", label: "Panel", value: "#18181b" },
  { key: "border", label: "Border", value: "#27272a" },
  { key: "text", label: "Text primary", value: "#fafafa" },
  { key: "muted", label: "Text muted", value: "#a1a1aa" },
  { key: "accent", label: "Accent", value: "#10b981" },
];

export function ColorsEditor() {
  const [tokens, setTokens] = usePersistedEditorState<ColorToken[]>(
    designTokenStorageKeys.colors,
    DEFAULT_COLOR_TOKENS,
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <aside className="space-y-3 rounded-lg border border-border bg-card p-4">
        {tokens.map((token, i) => (
          <div key={token.key} className="grid gap-1.5">
            <Label className="text-xs font-medium">{token.label}</Label>
            <div className="flex items-center gap-2">
              <input
                aria-label={`Color swatch cho ${token.label}`}
                className="size-9 cursor-pointer rounded border border-white/10 bg-transparent"
                onChange={(e) =>
                  setTokens((current) =>
                    current.map((t, idx) =>
                      idx === i ? { ...t, value: e.target.value } : t,
                    ),
                  )
                }
                type="color"
                value={token.value}
              />
              <Input
                value={token.value}
                onChange={(e) =>
                  setTokens((current) =>
                    current.map((t, idx) =>
                      idx === i ? { ...t, value: e.target.value } : t,
                    ),
                  )
                }
                className="flex-1 font-mono text-xs"
              />
            </div>
          </div>
        ))}
      </aside>

      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
          Preview
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {tokens.map((token) => (
            <div
              key={token.key}
              className="flex items-center gap-2 rounded-md border border-border p-2"
            >
              <span
                aria-hidden
                className="size-8 shrink-0 rounded border border-white/10"
                style={{ backgroundColor: token.value }}
              />
              <div className="min-w-0">
                <div className="truncate text-xs font-medium">{token.label}</div>
                <div className="truncate font-mono text-[10px] text-zinc-500">
                  {token.value}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
