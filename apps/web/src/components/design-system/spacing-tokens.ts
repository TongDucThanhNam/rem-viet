/**
 * Spacing scale data model + calculator — Instatic's killer feature port.
 *
 * Mục đích: cho phép admin define base size + min/max ratio, hệ thống tự
 * tính full scale (4xs → 4xl) và visualize bằng bar chart.
 */

export const SPACING_RATIO_PRESETS = {
  "minor-second": { name: "Minor Second", value: 1.067 },
  "major-second": { name: "Major Second", value: 1.125 },
  "minor-third": { name: "Minor Third", value: 1.2 },
  "major-third": { name: "Major Third", value: 1.25 },
  "perfect-fourth": { name: "Perfect Fourth", value: 1.333 },
  "augmented-fourth": { name: "Augmented Fourth", value: 1.414 },
  "perfect-fifth": { name: "Perfect Fifth", value: 1.5 },
  "golden-ratio": { name: "Golden Ratio", value: 1.618 },
} as const;

export type SpacingRatioKey = keyof typeof SPACING_RATIO_PRESETS;

export const DEFAULT_SPACING_STEPS = [
  "4xs",
  "3xs",
  "2xs",
  "xs",
  "s",
  "m",
  "l",
  "xl",
  "2xl",
  "3xl",
  "4xl",
];

export type SpacingMode = "automatic" | "manual";

export type SpacingScale = {
  baseSize: number;
  minRatio: number;
  maxRatio: number;
  steps: readonly string[];
  manualOverrides: Record<string, number>;
  mode: SpacingMode;
};

/**
 * Tính pixel value cho từng step dựa trên base size + ratios.
 *
 * "m" là anchor. Trước "m": chia cho minRatio. Sau "m": nhân với maxRatio.
 * Manual overrides được apply sau.
 */
export function calculateSpacing(scale: SpacingScale): Record<string, number> {
  const { baseSize, minRatio, maxRatio, steps, manualOverrides, mode } = scale;
  const mIndex = steps.indexOf("m");
  if (mIndex === -1) return { m: baseSize };

  const result: Record<string, number> = { m: baseSize };

  if (mode === "automatic") {
    for (let i = mIndex - 1; i >= 0; i -= 1) {
      const nextKey = steps[i + 1]!;
      const nextValue = result[nextKey]! / minRatio;
      const override = manualOverrides[steps[i]!];
      result[steps[i]!] = override ?? round2(nextValue);
    }
    for (let i = mIndex + 1; i < steps.length; i += 1) {
      const prevKey = steps[i - 1]!;
      const prevValue = result[prevKey]!;
      const override = manualOverrides[steps[i]!];
      result[steps[i]!] = override ?? round2(prevValue * maxRatio);
    }
  } else {
    // Manual mode: dùng overrides hoặc interpolate từ neighbor đã biết.
    for (let i = 0; i < steps.length; i += 1) {
      const key = steps[i]!;
      if (manualOverrides[key] !== undefined) {
        result[key] = manualOverrides[key]!;
      } else if (i > 0 && result[steps[i - 1]!] !== undefined) {
        result[key] = round2(result[steps[i - 1]!]! * minRatio);
      } else {
        result[key] = baseSize;
      }
    }
  }

  return result;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function defaultSpacingScale(): SpacingScale {
  return {
    baseSize: 16,
    minRatio: 1.25,
    maxRatio: 1.414,
    steps: DEFAULT_SPACING_STEPS,
    manualOverrides: {},
    mode: "automatic",
  };
}
