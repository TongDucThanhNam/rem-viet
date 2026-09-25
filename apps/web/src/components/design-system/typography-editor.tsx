import { cn } from "@rem-viet/ui/lib/utils";
import { Label } from "@rem-viet/ui/components/label";
import { Input } from "@rem-viet/ui/components/input";

import {
  designTokenStorageKeys,
  usePersistedEditorState,
} from "@/hooks/use-persisted-editor-state";

type TypeStep = {
  key: string;
  label: string;
  basePx: number;
  ratio: number;
};

const DEFAULT_TYPE_SCALE: TypeStep[] = [
  { key: "display", label: "Display", basePx: 96, ratio: 1.25 },
  { key: "h1", label: "Heading 1", basePx: 64, ratio: 1.25 },
  { key: "h2", label: "Heading 2", basePx: 48, ratio: 1.25 },
  { key: "h3", label: "Heading 3", basePx: 32, ratio: 1.2 },
  { key: "lead", label: "Lead", basePx: 20, ratio: 1 },
  { key: "body", label: "Body", basePx: 16, ratio: 1 },
  { key: "small", label: "Small", basePx: 13, ratio: 1 },
];

export function TypographyEditor() {
  const [scale, setScale] = usePersistedEditorState<TypeStep[]>(
    designTokenStorageKeys.typography,
    DEFAULT_TYPE_SCALE,
  );
  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <aside className="space-y-3 rounded-lg border border-border bg-card p-4">
        {scale.map((step, i) => (
          <div key={step.key} className="grid gap-1.5">
            <Label className="text-xs font-medium">{step.label}</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                value={step.basePx}
                onChange={(e) =>
                  setScale((current) =>
                    current.map((s, idx) =>
                      idx === i
                        ? { ...s, basePx: Number(e.target.value) || 0 }
                        : s,
                    ),
                  )
                }
                className="font-mono text-xs"
                placeholder="px"
              />
              <Input
                type="number"
                step="0.05"
                value={step.ratio}
                onChange={(e) =>
                  setScale((current) =>
                    current.map((s, idx) =>
                      idx === i
                        ? { ...s, ratio: Number(e.target.value) || 1 }
                        : s,
                    ),
                  )
                }
                className="font-mono text-xs"
                placeholder="ratio"
              />
            </div>
          </div>
        ))}
      </aside>

      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
          Preview
        </h3>
        {scale.map((step) => (
          <div
            key={step.key}
            className={cn(
              "flex items-baseline justify-between gap-3 border-b border-border pb-2",
            )}
          >
            <div style={{ fontSize: `${step.basePx}px`, lineHeight: 1.1 }}>
              {step.label}
            </div>
            <span className="shrink-0 font-mono text-[10px] text-zinc-500">
              {step.basePx}px · ratio {step.ratio}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
