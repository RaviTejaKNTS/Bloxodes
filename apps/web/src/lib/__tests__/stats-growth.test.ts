import { describe, expect, it } from "vitest";
import {
  closestStatsGrowthRow,
  statsGrowthBaselineToleranceMs,
  statsGrowthReferenceMs
} from "../stats-growth";

describe("stats growth baselines", () => {
  it("uses the current observation clock instead of render time", () => {
    expect(statsGrowthReferenceMs("2026-08-13T01:47:00.000Z", Date.parse("2026-08-13T10:00:00.000Z")))
      .toBe(Date.parse("2026-08-13T01:47:00.000Z"));
  });

  it("uses cadence-compatible tier tolerances", () => {
    expect(statsGrowthBaselineToleranceMs("HOT")).toBe(90 * 60 * 1000);
    expect(statsGrowthBaselineToleranceMs("WARM")).toBe(7 * 60 * 60 * 1000);
    expect(statsGrowthBaselineToleranceMs("COLD")).toBe(12 * 60 * 60 * 1000);
  });

  it("accepts the closest row inside the tier window and rejects rows outside it", () => {
    const target = Date.parse("2026-08-12T12:00:00.000Z");
    const rows = [
      { hour_start: "2026-08-12T01:00:00.000Z", playing: 10 },
      { hour_start: "2026-08-12T18:00:00.000Z", playing: 20 },
      { hour_start: "2026-08-13T01:00:00.000Z", playing: 30 }
    ];
    expect(closestStatsGrowthRow(rows, target, statsGrowthBaselineToleranceMs("COLD"))?.playing).toBe(20);
    expect(closestStatsGrowthRow(rows, target, statsGrowthBaselineToleranceMs("HOT"))).toBeNull();
  });
});
