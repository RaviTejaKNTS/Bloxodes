import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { robloxAugust2026Report } from "@/data/reports/roblox-august-2026";

const augustDates = Array.from({ length: 31 }, (_, index) => "2026-08-" + String(index + 1).padStart(2, "0"));

describe("August 2026 Roblox report data", () => {
  it("presents the approved August story in search copy", () => {
    expect(robloxAugust2026Report.title).toContain("Roblox Stats August 2026 Report");
    expect(robloxAugust2026Report.title).toContain("Adopt Me!");
    expect(robloxAugust2026Report.seoTitle).toBe(robloxAugust2026Report.title);
    expect(robloxAugust2026Report.seoDescription).toContain("late-month rise");
    expect(robloxAugust2026Report.seoDescription).toContain("cool-downs");
  });

  it("covers all 31 August dates for the lead series without gaps", () => {
    const points = robloxAugust2026Report.adoptMe.points;
    expect(points.map((point) => point.date)).toEqual(augustDates);
    expect(points.every((point) => Number.isFinite(point.players) && point.players > 0)).toBe(true);
    expect(points[0]?.players).toBe(183797);
    expect(points[points.length - 1]?.players).toBe(275461);
    expect(Math.max(...points.map((point) => point.players))).toBe(396858);
  });

  it("keeps every indexed series aligned and normalized around 100", () => {
    const allSeries = [...robloxAugust2026Report.establishedGames.series, ...robloxAugust2026Report.coolDownGames.series];
    for (const series of allSeries) {
      expect(series.points.map((point) => point.date)).toEqual(augustDates);
      expect(series.points.every((point) => Number.isFinite(point.index) && point.index > 0)).toBe(true);
      const average = series.points.reduce((total, point) => total + point.index, 0) / series.points.length;
      expect(average).toBeCloseTo(100, 1);
    }
  });

  it("anchors every visible event marker to an observed August date", () => {
    const observedDates = new Set(augustDates);
    const markers = [
      ...robloxAugust2026Report.adoptMe.markers,
      ...robloxAugust2026Report.establishedGames.markers,
      ...robloxAugust2026Report.coolDownGames.markers
    ];
    expect(markers.length).toBeGreaterThan(0);
    expect(markers.every((marker) => observedDates.has(marker.date))).toBe(true);
  });

  it("orders genre movement from strongest to weakest typical change", () => {
    const changes = robloxAugust2026Report.genreMovement.map((row) => row.typicalChangePercent);
    expect(changes).toEqual([...changes].sort((left, right) => right - left));
    expect(robloxAugust2026Report.genreMovement).toHaveLength(12);
    expect(
      robloxAugust2026Report.genreMovement.every(
        (row) => row.stableGames > 0 && row.combinedDailyAverage > 0 && row.shareRosePercent >= 0 && row.shareRosePercent <= 100
      )
    ).toBe(true);
  });

  it("keeps the article free of dashboard terminology and exposes noindex metadata", () => {
    const route = readFileSync(
      path.resolve(process.cwd(), "src/app/(site)/stats/reports/roblox-august-2026/page.tsx"),
      "utf8"
    ).toLowerCase();
    for (const term of ["cohort", "coverage", "ccu", "dashboard", "watchlist", "questions for next month"]) {
      expect(route).not.toContain(term);
    }
    expect(route).toContain("index: false");
    expect(route).toContain("follow: false");
    expect(route).toContain("googlebot");
  });

  it("keeps the internal route out of archive, navigation, sitemap, feed, and revalidation wiring", () => {
    const files = [
      "src/app/(site)/stats/reports/page.tsx",
      "src/app/(site)/stats/page.tsx",
      "src/app/sitemaps/stats.xml/route.ts",
      "src/app/feed.xml/route.ts",
      "src/app/api/revalidate/route.ts"
    ];
    for (const file of files) {
      expect(readFileSync(path.resolve(process.cwd(), file), "utf8")).not.toContain("roblox-august-2026");
    }
  });

  it("defines the approved reusable feature image from the lead series", () => {
    const feature = robloxAugust2026Report.featureImage;
    expect(feature.src).toBe("/images/reports/roblox-august-2026.png");
    expect(feature.reportLabel).toBe("Roblox August Stats Report");
    expect(feature.headlineLines).toEqual(["Adopt Me! rose as", "big hits cooled"]);
    expect(feature.chartSeriesPath).toBe("adoptMe.points");
    expect(feature.chartValueKey).toBe("players");
    expect(feature.metric).toContain("278,444");
    expect(feature.alt).toContain("August 2026");
  });

  it("keeps the public endnote plain and scoped", () => {
    const endnote = robloxAugust2026Report.endnote.toLowerCase();
    for (const term of ["cohort", "coverage", "ccu"]) {
      expect(endnote).not.toContain(term);
    }
    expect(endnote).toContain("august 1–31, 2026");
    expect(endnote).toContain("timing alone does not show what caused");
  });
});
