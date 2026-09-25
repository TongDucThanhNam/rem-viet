import { cn } from "@rem-viet/ui/lib/utils";
import { Input } from "@rem-viet/ui/components/input";
import { Label } from "@rem-viet/ui/components/label";

import {
  designTokenStorageKeys,
  usePersistedEditorState,
} from "@/hooks/use-persisted-editor-state";

type RadiiToken = { key: string; label: string; value: number };

const DEFAULT_RADII: RadiiToken[] = [
  { key: "xs", label: "XS", value: 2 },
  { key: "sm", label: "SM", value: 4 },
  { key: "md", label: "MD", value: 8 },
  { key: "lg", label: "LG", value: 12 },
  { key: "xl", label: "XL", value: 16 },
  { key: "pill", label: "Pill", value: 999 },
];

export function RadiiShadowsEditor() {
  const [radii, setRadii] = usePersistedEditorState<RadiiToken[]>(
    designTokenStorageKeys.radii,
    DEFAULT_RADII,
  );
  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <aside className="space-y-3 rounded-lg border border-border bg-card p-4">
        {radii.map((token, i) => (
          <div key={token.key} className="grid gap-1.5">
            <Label className="text-xs font-medium">{token.label}</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={token.value}
                onChange={(e) =>
                  setRadii((current) =>
                    current.map((r, idx) =>
                      idx === i ? { ...r, value: Number(e.target.value) || 0 } : r,
                    ),
                  )
                }
                className="flex-1 font-mono text-xs"
              />
              <span className="font-mono text-[10px] text-zinc-500">px</span>
            </div>
          </div>
        ))}
      </aside>

      <div className="space-y-4 rounded-lg border border-border bg-card p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
          Preview
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {radii.map((token) => (
            <div key={token.key} className="flex flex-col items-center gap-2">
              <div
                aria-hidden
                className={cn(
                  "size-16 border border-white/20 bg-gradient-to-br from-zinc-700 to-zinc-900",
                )}
                style={{ borderRadius: `${token.value}px` }}
              />
              <div className="text-center">
                <div className="text-xs font-medium">{token.label}</div>
                <div className="font-mono text-[10px] text-zinc-500">
                  {token.value}px
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
