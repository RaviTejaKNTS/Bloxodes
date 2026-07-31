import { describe, expect, it } from "vitest";
import { robloxJune2026Report } from "@/data/reports/roblox-june-2026";

const juneDates = Array.from({ length: 25 }, (_, i) => `2026-06-${String(i + 6).padStart(2, "0")}`);

describe("June 2026 Roblox report data", () => {
  it("covers June 6-30 for the Animal Hospital breakout chart, with only the earliest days missing", () => {
    const points = robloxJune2026Report.animalHospital.points;
    expect(points.map((point) => point.date)).toEqual(juneDates);
    expect(points.filter((point) => point.players == null).map((point) => point.date)).toEqual([
      "2026-06-06",
      "2026-06-07",
      "2026-06-08"
    ]);
    expect(points.every((point) => point.players == null || point.players >= 0)).toBe(true);
  });

  it("anchors Animal Hospital event markers to observed dates", () => {
    const observedDates = new Set(
      robloxJune2026Report.animalHospital.points.filter((point) => point.players != null).map((point) => point.date)
    );
    expect(robloxJune2026Report.animalHospital.markers.every((marker) => observedDates.has(marker.date))).toBe(true);
  });

  it("orders genre momentum from strongest to weakest typical weekly change", () => {
    const changes = robloxJune2026Report.genreMomentum.map((row) => row.weeklyChangePercent);
    const sorted = [...changes].sort((a, b) => b - a);
    expect(changes).toEqual(sorted);
    expect(robloxJune2026Report.genreMomentum.every((row) => row.games > 0 && row.combinedDailyAverage > 0)).toBe(true);
    expect(robloxJune2026Report.genreMomentum.every((row) => row.shareRosePercent >= 0 && row.shareRosePercent <= 100)).toBe(
      true
    );
  });

  it("keeps every event-rhythm and cooling-games series aligned on the same 25 June dates", () => {
    const allSeries = [...robloxJune2026Report.eventRhythm.series, ...robloxJune2026Report.coolingGames.series];
    for (const series of allSeries) {
      expect(series.points.map((point) => point.date)).toEqual(juneDates);
      expect(series.points.every((point) => point.index == null || Number.isFinite(point.index))).toBe(true);
    }
  });

  it("only marks Saturdays that fall within the observed June window", () => {
    const saturdays = robloxJune2026Report.eventRhythm.saturdays;
    expect(saturdays.every((date) => juneDates.includes(date))).toBe(true);
    for (const date of saturdays) {
      expect(new Date(`${date}T00:00:00Z`).getUTCDay()).toBe(6);
    }
  });

  it("never uses banned dashboard or causal-claim language in the endnote", () => {
    const banned = ["cohort", "coverage", "CCU"];
    for (const word of banned) {
      expect(robloxJune2026Report.endnote.toLowerCase()).not.toContain(word.toLowerCase());
    }
  });

  it("defines a reusable social image from the observed Animal Hospital series", () => {
    const feature = robloxJune2026Report.featureImage;
    expect(feature.src).toBe("/images/reports/roblox-june-2026.png");
    expect(feature.reportLabel).toBe("Roblox June Stats Report");
    expect(feature.headlineLines).toHaveLength(2);
    expect(feature.chartSeriesPath).toBe("animalHospital.points");
    expect(feature.chartValueKey).toBe("players");
    expect(feature.alt).toContain("884");
    expect(feature.alt).toContain("429,721");
  });
});
