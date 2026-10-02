import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { robloxSeptember2026Report as report } from "@/data/reports/roblox-september-2026";

const dates = Array.from({ length: 26 }, (_, index) => "2026-09-" + String(index + 5).padStart(2, "0"));
const sourceHashes: Record<string, string> = {
  "anime-dice": "3863ed241b04fff30ab23c9cdc9a6b66923d86dbf575ed0c9bceb03d6b0262c2",
  "lumber-tycoon-2-2471084": "8c6c5caf14e90ce38c6b0a9eabd069981507a67412bb21a6ed5e2a0bc1f6fc94",
  "jailbreak-245662005": "e6a2928be305bd7cde56f3df941ae408a3a8819442c602948ef77ca31b703341",
  "blox-fruits-994732206": "59ac9b910be58800c1f6593ef7b574472117d76fa14c021f55bb11a3d4eff17a",
  "animal-hospital": "bd357620b41c713c691dec16c207b5ddaae8d72cb79f5df10b4875fa76ca302a",
  "steal-a-brainrot-7709344486": "09cfec0e327137d28fb0c86e68b277502d47ed9ec4f165d8a1ebedb45a52f153"
};
const read = (file: string) => readFileSync(path.resolve(process.cwd(), file), "utf8");

// These hashes freeze the approved source series and their derived indices.
describe("September 2026 Roblox report", () => {
  it("preserves all approved chart dates and numbers", () => {
    const series = [report.lead, ...report.anniversaryGames.series, ...report.coolDownGames.series];
    for (const game of series) {
      expect(game.points.map(point => point.date)).toEqual(dates);
      const digest = createHash("sha256").update(JSON.stringify(game.points)).digest("hex");
      expect(digest).toBe(sourceHashes[game.slug]);
    }
  });

  it("supports the headline through persistent growth and a real strongest week", () => {
    const values = report.lead.points.map(point => point.players);
    const comparisons = values.slice(7).map((value, index) => (value / values[index] - 1) * 100);
    expect(comparisons).toHaveLength(19);
    expect(comparisons.every(value => value > 0)).toBe(true);
    const sorted = [...comparisons].sort((a, b) => a - b);
    expect(sorted[9]).toBeCloseTo(43.549806, 5);
    const weeks = values.slice(6).map((_, index) => values.slice(index, index + 7).reduce((a, b) => a + b, 0) / 7);
    expect(Math.round(Math.max(...weeks))).toBe(57130);
    expect(weeks.indexOf(Math.max(...weeks))).toBe(19);
    expect(Math.round(Math.max(...values))).toBe(68076);
    expect(report.title).toContain("September 2026");
    expect(report.title).toContain("Anime Dice");
  });

  it("normalizes each comparison line by its own observed average", () => {
    for (const game of [...report.anniversaryGames.series, ...report.coolDownGames.series]) {
      const average = game.points.reduce((sum, point) => sum + point.index, 0) / game.points.length;
      expect(average).toBeCloseTo(100, 1);
      expect(game.points.every(point => Number.isFinite(point.index) && point.index > 0)).toBe(true);
    }
  });

  it("anchors sourced markers to approved event dates", () => {
    expect(report.lead.markers.map(marker => marker.date)).toEqual(["2026-09-12", "2026-09-27"]);
    expect(report.anniversaryGames.markers.map(marker => marker.date)).toEqual(["2026-09-17", "2026-09-28"]);
    expect(report.coolDownGames.markers).toHaveLength(0);
    for (const marker of [...report.lead.markers, ...report.anniversaryGames.markers]) {
      expect(dates).toContain(marker.date);
      expect(["www.roblox.com", "about.roblox.com"]).toContain(new URL(marker.sourceUrl).hostname);
    }
  });

  it("orders only named genres and preserves their aggregate weekly measures", () => {
    const changes = report.genreMovement.map(row => row.typicalChangePercent);
    expect(changes).toEqual([...changes].sort((a, b) => b - a));
    expect(report.genreMovement).toHaveLength(11);
    expect(report.genreMovement.some(row => ["All", "Uncategorized"].includes(row.genre))).toBe(false);
    expect(report.genreMovement.find(row => row.genre === "Sports & Racing")?.typicalChangePercent).toBe(3.6);
    expect(report.genreMovement.find(row => row.genre === "RPG")?.typicalChangePercent).toBe(-18.3);
    expect(report.genreMovement.every(row => row.stableGames >= 5 && row.combinedDailyAverage > 0 && row.shareRosePercent >= 0 && row.shareRosePercent <= 100)).toBe(true);
  });

  it("keeps the article and captions plain, with three main sections and four figures", () => {
    const route = read("src/app/(site)/stats/reports/roblox-september-2026/page.tsx");
    const charts = read("src/components/reports/RobloxSeptember2026ReportCharts.tsx");
    const publicCopy = (route + charts + report.endnote + report.subtitle).toLowerCase();
    for (const term of ["cohort", "coverage", "ccu", "dashboard", "watchlist", "questions for next month", "opening window", "closing window"]) {
      expect(publicCopy).not.toContain(term);
    }
    expect(route.match(/<h2\b/g)).toHaveLength(3);
    expect(route.match(/<(AnimeDice|AnniversaryGames|GenreMovement|CoolDownGames)Chart\b/g)).toHaveLength(4);
    expect(charts).toContain("strokeDasharray={linePatterns");
    expect(charts).toContain("ariaLabel=");
    expect(report.endnote).toContain("September 5 through 30, 2026");
    expect(report.endnote).toContain("September 1 through 4 were excluded");
  });

  it("publishes the approved report through metadata and discovery routes", () => {
    const route = read("src/app/(site)/stats/reports/roblox-september-2026/page.tsx").toLowerCase();
    expect(route).toContain("index: true");
    expect(route).toContain("follow: true");
    expect(route).not.toContain("index: false");
    for (const file of ["src/app/(site)/stats/reports/page.tsx", "src/app/sitemaps/stats.xml/route.ts", "src/app/feed.xml/route.ts"]) {
      expect(read(file)).toContain(report.slug);
      expect(read(file)).not.toContain("roblox-august-2026");
    }
    const revalidation = read("src/app/api/revalidate/route.ts");
    expect(revalidation).toContain('"stats-reports"');
    expect(revalidation).toContain('`/stats/reports/${reportSlug}`');
    expect(read("src/app/(site)/stats/components/StatsViews.tsx")).toContain('href="/stats/reports"');
  });

  it("uses one correctly sized PNG from the lead series for social metadata", () => {
    expect(report.featureImage.src).toBe("/images/reports/roblox-september-2026.png");
    expect(report.featureImage.chartSeriesPath).toBe("lead.points");
    expect(report.featureImage.chartValueKey).toBe("players");
    expect(report.featureImage.metric).toContain("57,130");
    expect(report.featureImage.headlineLines).toEqual(["Anime Dice", "kept climbing"]);
    const png = readFileSync(path.resolve(process.cwd(), "public" + report.featureImage.src));
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
    const route = read("src/app/(site)/stats/reports/roblox-september-2026/page.tsx");
    expect(route).toContain("const featureImageUrl = SITE_URL + report.featureImage.src");
    expect(route).toContain("url: featureImageUrl");
    expect(route).toContain("images: [featureImageUrl]");
  });
});
