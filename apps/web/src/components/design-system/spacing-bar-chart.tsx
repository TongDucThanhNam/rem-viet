import { cn } from "@rem-viet/ui/lib/utils";

const VIEW_BOX_WIDTH = 720;
const VIEW_BOX_HEIGHT = 220;
const BASELINE_Y = 180;
const BAR_TOP_PADDING = 40;
const BAR_WIDTH = 56;
const BAR_GAP = 16;

/**
 * SVG bar chart visualization cho spacing scale.
 *
 * Anchor step ("m") highlight bằng emerald, các step khác dùng blue-500.
 * Bar height scale theo `value / max * (BASELINE_Y - BAR_TOP_PADDING)`.
 */
export function SpacingBarChart({
  values,
  anchorKey = "m",
}: {
  values: Record<string, number>;
  anchorKey?: string;
}) {
  const entries = Object.entries(values);
  if (entries.length === 0) {
    return (
      <div className="grid place-items-center rounded-lg border border-white/10 bg-zinc-900/80 p-8 text-center">
        <p className="text-xs text-zinc-500">Chưa có step nào để visualize.</p>
      </div>
    );
  }
  const max = Math.max(...Object.values(values), 1);

  return (
    <figure
      aria-label="Spacing scale bar chart"
      className="rounded-lg border border-white/10 bg-zinc-950 p-4"
    >
      <header className="mb-3 flex items-baseline justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
          Scale visualization
        </h3>
        <span className="font-mono text-[10px] text-zinc-500">
          {entries.length} steps · max {max.toFixed(2)}px
        </span>
      </header>

      <svg
        viewBox={`0 0 ${VIEW_BOX_WIDTH} ${VIEW_BOX_HEIGHT}`}
        className="h-56 w-full"
        role="img"
      >
        {/* Baseline rule */}
        <line
          x1={0}
          x2={VIEW_BOX_WIDTH}
          y1={BASELINE_Y}
          y2={BASELINE_Y}
          stroke="rgba(255,255,255,0.08)"
          strokeDasharray="2 4"
        />

        {entries.map(([key, value], i) => {
          const height = (value / max) * (BASELINE_Y - BAR_TOP_PADDING);
          const startX = (VIEW_BOX_WIDTH - entries.length * (BAR_WIDTH + BAR_GAP)) / 2;
          const x = startX + i * (BAR_WIDTH + BAR_GAP);
          const y = BASELINE_Y - height;
          const isAnchor = key === anchorKey;

          return (
            <g key={key}>
              <rect
                x={x}
                y={y}
                width={BAR_WIDTH}
                height={Math.max(height, 1)}
                rx={3}
                fill={isAnchor ? "rgb(16 185 129)" : "rgb(59 130 246)"}
                fillOpacity={isAnchor ? 0.92 : 0.7}
                className="transition-all duration-300 ease-out"
              />
              <text
                x={x + BAR_WIDTH / 2}
                y={y - 6}
                textAnchor="middle"
                fill={isAnchor ? "rgb(167 243 208)" : "rgb(228 228 231)"}
                fontSize="10"
                fontFamily="ui-monospace, monospace"
              >
                {value.toFixed(2)}
              </text>
              <text
                x={x + BAR_WIDTH / 2}
                y={BASELINE_Y + 14}
                textAnchor="middle"
                fill="rgb(161 161 170)"
                fontSize="10"
                fontFamily="ui-monospace, monospace"
              >
                {key}
              </text>
            </g>
          );
        })}
      </svg>

      <figcaption className="mt-2 text-center font-mono text-[10px] text-zinc-600">
        Anchor:{" "}
        <span className={cn("font-semibold", "text-emerald-400")}>
          {anchorKey}
        </span>{" "}
        · emerald highlight, các step khác dùng blue-500
      </figcaption>
    </figure>
  );
}
