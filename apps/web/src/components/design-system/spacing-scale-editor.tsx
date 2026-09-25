import { cn } from "@rem-viet/ui/lib/utils";
import { Input } from "@rem-viet/ui/components/input";
import { Label } from "@rem-viet/ui/components/label";

import {
  calculateSpacing,
  defaultSpacingScale,
  SPACING_RATIO_PRESETS,
  type SpacingScale,
} from "./spacing-tokens";
import { SpacingBarChart } from "./spacing-bar-chart";
import {
  designTokenStorageKeys,
  usePersistedEditorState,
} from "@/hooks/use-persisted-editor-state";

export function SpacingScaleEditor() {
  const [scale, setScale] = usePersistedEditorState<SpacingScale>(
    designTokenStorageKeys.spacing,
    defaultSpacingScale(),
  );
  const values = calculateSpacing(scale);

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <aside className="space-y-4 rounded-lg border border-border bg-card p-4">
        <div>
          <Label htmlFor="spacing-base" className="text-xs font-medium">
            Base size (px) — anchor "m"
          </Label>
          <Input
            id="spacing-base"
            type="number"
            value={scale.baseSize}
            onChange={(e) =>
              setScale({ ...scale, baseSize: Number(e.target.value) || 0 })
            }
            className="mt-1 font-mono"
          />
        </div>

        <div className="grid gap-2">
          <div>
            <Label htmlFor="spacing-min-ratio" className="text-xs font-medium">
              Min ratio
            </Label>
            <select
              id="spacing-min-ratio"
              value={scale.minRatio}
              onChange={(e) =>
                setScale({ ...scale, minRatio: Number(e.target.value) })
              }
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {Object.entries(SPACING_RATIO_PRESETS).map(([key, { name, value }]) => (
                <option key={key} value={value}>
                  {name} ({value})
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="spacing-max-ratio" className="text-xs font-medium">
              Max ratio
            </Label>
            <select
              id="spacing-max-ratio"
              value={scale.maxRatio}
              onChange={(e) =>
                setScale({ ...scale, maxRatio: Number(e.target.value) })
              }
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {Object.entries(SPACING_RATIO_PRESETS).map(([key, { name, value }]) => (
                <option key={key} value={value}>
                  {name} ({value})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <span className="text-xs font-medium">Mode</span>
          <div className="mt-1 flex gap-1 rounded-md border border-input p-1">
            {(["automatic", "manual"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setScale({ ...scale, mode })}
                className={cn(
                  "flex-1 rounded px-3 py-1 text-xs transition-colors",
                  scale.mode === mode
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted",
                )}
              >
                {mode === "automatic" ? "Automatic" : "Manual"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="spacing-steps" className="text-xs font-medium">
            Steps (comma-separated, "m" là anchor)
          </Label>
          <Input
            id="spacing-steps"
            value={scale.steps.join(", ")}
            onChange={(e) =>
              setScale({
                ...scale,
                steps: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
              })
            }
            className="mt-1 font-mono text-xs"
          />
        </div>
      </aside>

      <div className="space-y-4">
        <SpacingBarChart values={values} anchorKey="m" />

        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-300">
            Computed values
          </h3>
          <table className="w-full font-mono text-xs">
            <thead className="text-zinc-500">
              <tr>
                <th className="text-left font-medium">Step</th>
                <th className="text-right font-medium">px</th>
                <th className="text-right font-medium">rem</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(values).map(([step, px]) => (
                <tr key={step} className="border-t border-border">
                  <td className="py-1">
                    {step === "m" ? (
                      <span className="font-semibold text-emerald-400">
                        {step} (anchor)
                      </span>
                    ) : (
                      step
                    )}
                  </td>
                  <td className="py-1 text-right">{px.toFixed(2)}</td>
                  <td className="py-1 text-right">{(px / 16).toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
