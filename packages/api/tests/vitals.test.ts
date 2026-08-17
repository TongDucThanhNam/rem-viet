import { describe, expect, mock, test } from "bun:test";

mock.module("cloudflare:workers", () => ({ env: {} }));

const { compareWebVitalPeriods, nearestRankPercentile } =
  await import("../src/services/vitals");

describe("Web Vitals evidence math", () => {
  test("uses the nearest-rank p75 definition without mutating input", () => {
    const values = [400, 100, 300, 200];
    expect(nearestRankPercentile(values, 0.75)).toBe(300);
    expect(values).toEqual([400, 100, 300, 200]);
  });

  test("handles one sample and an empty sample set", () => {
    expect(nearestRankPercentile([123], 0.75)).toBe(123);
    expect(nearestRankPercentile([], 0.75)).toBeNull();
  });

  test("rejects invalid percentile arguments", () => {
    expect(() => nearestRankPercentile([1], 0)).toThrow(RangeError);
    expect(() => nearestRankPercentile([1], 1.01)).toThrow(RangeError);
  });

  test("compares periods with lower values treated as better", () => {
    expect(
      compareWebVitalPeriods(
        "LCP",
        { p75: 2_000, sampleCount: 90 },
        { p75: 2_500, sampleCount: 80 },
      ),
    ).toEqual({
      direction: "improved",
      delta: -500,
      deltaPercent: -20,
    });
    expect(
      compareWebVitalPeriods(
        "CLS",
        { p75: 0.1254, sampleCount: 90 },
        { p75: 0.1, sampleCount: 80 },
      ),
    ).toEqual({
      direction: "regressed",
      delta: 0.025,
      deltaPercent: 25.4,
    });
  });

  test("does not invent a comparison without two real baselines", () => {
    expect(
      compareWebVitalPeriods(
        "INP",
        { p75: 120, sampleCount: 12 },
        { p75: null, sampleCount: 0 },
      ),
    ).toEqual({
      direction: "unavailable",
      delta: null,
      deltaPercent: null,
    });
    expect(
      compareWebVitalPeriods(
        "CLS",
        { p75: 0, sampleCount: 75 },
        { p75: 0, sampleCount: 75 },
      ),
    ).toEqual({
      direction: "stable",
      delta: 0,
      deltaPercent: null,
    });
  });
});
