import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { robloxJuly2026Report } from "@/data/reports/roblox-july-2026";

const julyDates = Array.from({ length: 30 }, (_, i) => `2026-07-${String(i + 2).padStart(2, "0")}`);

describe("July 2026 Roblox report data", () => {
  it("presents itself as a full monthly Roblox stats report in search copy", () => {
    expect(robloxJuly2026Report.title).toContain("Roblox Stats July 2026 Report");
    expect(robloxJuly2026Report.seoTitle).toContain("Roblox Stats July 2026 Report");
    expect(robloxJuly2026Report.seoDescription).toContain("Murder Mystery 2");
    expect(robloxJuly2026Report.seoDescription).toContain("cooling genres");
    expect(robloxJuly2026Report.seoDescription).toContain("platform news");
  });

  it("covers the full July 2-31 window for the Murder Mystery 2 chart with no gaps", () => {
    const points = robloxJuly2026Report.murderMystery2.points;
    expect(points.map((point) => point.date)).toEqual(julyDates);
    expect(points.every((point) => Number.isFinite(point.players) && point.players > 0)).toBe(true);
    expect(points[0]?.players).toBe(257947);
    expect(points[points.length - 1]?.players).toBe(511403);
    expect(Math.max(...points.map((point) => point.players))).toBe(674963);
  });

  it("anchors the Murder Mystery 2 event marker to an observed date", () => {
    const observedDates = new Set(robloxJuly2026Report.murderMystery2.points.map((point) => point.date));
    expect(robloxJuly2026Report.murderMystery2.markers.every((marker) => observedDates.has(marker.date))).toBe(true);
    expect(robloxJuly2026Report.murderMystery2.markers.some((marker) => marker.date === "2026-07-23")).toBe(true);
  });

  it("orders genre movement from strongest to weakest typical same-weekday change", () => {
    const changes = robloxJuly2026Report.genreMovement.map((row) => row.typicalChangePercent);
    const sorted = [...changes].sort((a, b) => b - a);
    expect(changes).toEqual(sorted);
    expect(robloxJuly2026Report.genreMovement.every((row) => row.stableGames > 0 && row.combinedDailyAverage > 0)).toBe(
      true
    );
    expect(
      robloxJuly2026Report.genreMovement.every((row) => row.shareRosePercent >= 0 && row.shareRosePercent <= 100)
    ).toBe(true);
  });

  it("keeps every comeback and cool-down series aligned on the same 30 July dates", () => {
    const allSeries = [...robloxJuly2026Report.comebackGames.series, ...robloxJuly2026Report.coolDownGames.series];
    for (const series of allSeries) {
      expect(series.points.map((point) => point.date)).toEqual(julyDates);
      expect(series.points.every((point) => Number.isFinite(point.index))).toBe(true);
    }
  });

  it("normalizes every indexed series around its own monthly average of 100", () => {
    const allSeries = [...robloxJuly2026Report.comebackGames.series, ...robloxJuly2026Report.coolDownGames.series];
    for (const series of allSeries) {
      const average = series.points.reduce((total, point) => total + point.index, 0) / series.points.length;
      expect(average).toBeCloseTo(100, 1);
    }
  });

  it("anchors the comeback event marker to an observed July date", () => {
    const observedDates = new Set(robloxJuly2026Report.comebackGames.series[0]?.points.map((point) => point.date));
    expect(observedDates.has(robloxJuly2026Report.comebackGames.eventMarker.date)).toBe(true);
  });

  it("never uses banned dashboard or causal-claim language in the endnote", () => {
    const banned = ["cohort", "coverage", "CCU"];
    for (const word of banned) {
      expect(robloxJuly2026Report.endnote.toLowerCase()).not.toContain(word.toLowerCase());
    }
  });

  it("keeps banned internal terminology out of the reader-facing route", () => {
    const route = readFileSync(
      path.resolve(process.cwd(), "src/app/(site)/stats/reports/roblox-july-2026/page.tsx"),
      "utf8"
    ).toLowerCase();
    for (const term of ["cohort", "coverage", "ccu", "dashboard", "watchlist", "questions for next month"]) {
      expect(route).not.toContain(term);
    }
  });

  it("publishes the route through the archive, sitemap, and feed", () => {
    const files = [
      "src/app/(site)/stats/reports/page.tsx",
      "src/app/sitemaps/stats.xml/route.ts",
      "src/app/feed.xml/route.ts"
    ];
    for (const file of files) {
      const source = readFileSync(path.resolve(process.cwd(), file), "utf8");
      expect(source).toContain("roblox-july-2026");
    }

    const revalidation = readFileSync(path.resolve(process.cwd(), "src/app/api/revalidate/route.ts"), "utf8");
    expect(revalidation).toContain('normalized.startsWith("reports/")');
    expect(revalidation).toContain('"stats-reports"');
  });

  it("allows the published route to be indexed", () => {
    const route = readFileSync(
      path.resolve(process.cwd(), "src/app/(site)/stats/reports/roblox-july-2026/page.tsx"),
      "utf8"
    );
    expect(route).not.toContain("index: false");
    expect(route).not.toContain("follow: false");
  });

  it("defines a reusable social image from the approved feature image specification", () => {
    const feature = robloxJuly2026Report.featureImage;
    expect(feature.src).toBe("/images/reports/roblox-july-2026.png");
    expect(feature.reportLabel).toBe("Roblox July Stats Report");
    expect(feature.headlineLines).toEqual(["Murder Mystery 2's", "summer surge"]);
    expect(feature.chartSeriesPath).toBe("murderMystery2.points");
    expect(feature.chartValueKey).toBe("players");
    expect(feature.metric).toContain("596,960");
    expect(feature.alt).toContain("674,963");
  });
});
