import { describe, expect, it } from "vitest";
import { DAY_MS, HOUR_MS, detectMilestones, monthlyPlayers, playersCalendar, passPriceAxis, scatterLabels, selectBadges, selectMovers, sessionEstimates, updateImpact, type DailyInsightRow, type HourlyInsightRow, type GenreScatter } from "../stats-insights";

const now = Date.parse("2026-10-25T12:00:00Z");
const daily = (date: string, extra: Partial<DailyInsightRow> = {}): DailyInsightRow => ({
  stat_date: date, playing: 100, avg_playing: 100, peak_playing: 150, visits: 1e7, favorites: 1000,
  visit_delta: 14400, visits_start: 100000, visits_end: 114400, like_delta: 100, dislike_delta: 5,
  sample_count: 12, is_finalized: true, ...extra
});
const month = (ym: string, n: number, avg: number) => Array.from({ length: n }, (_, i) => daily(`${ym}-${String(i + 1).padStart(2, '0')}`, { avg_playing: avg }));

describe("monthly player history", () => {
  it("excludes the partial current month and compares rolling days with days 31–60", () => {
    const rows = [...month("2026-10", 7, 200), ...month("2026-09", 7, 100), ...month("2026-08", 7, 50), daily("2026-10-25", { avg_playing: 999999 })];
    rows[0] = daily("2026-10-01", { avg_playing: null, playing: 200, peak_playing: 900 });
    const result = monthlyPlayers(rows, now);
    expect(result.map(row => row.month)).toEqual(["last30", "2026-09", "2026-08"]);
    expect(result[0]).toMatchObject({ average: 200, days: 7, peak: 900, change: 100 });
    expect(result[1].change).toBe(100);
    expect(result[2].change).toBeNull();
  });
  it("uses both exact 30-day boundaries, independent of the calendar row", () => {
    const rows = Array.from({ length: 60 }, (_, index) => daily(
      new Date(Date.parse("2026-10-25T00:00:00Z") - (index + 1) * DAY_MS).toISOString().slice(0, 10),
      { avg_playing: index < 30 ? 300 : 100 }
    ));
    const result = monthlyPlayers([...rows, daily("2026-08-25", { avg_playing: 999999 })], now);
    expect(result[0]).toMatchObject({ average: 300, days: 30, change: 200 });
    expect(result[1].month).toBe("2026-09");
    expect(result[1].average).not.toBe(result[0].average);
  });
  it("skips sparse months, deduplicates dates and leaves unsupported comparisons empty", () => {
    const rows = [...month("2026-10", 7, 200).map(row => ({ ...row, peak_playing: null })), ...month("2026-09", 6, 100)];
    expect(monthlyPlayers([...rows, rows[0]], now)).toEqual([
      { month: "last30", average: 200, days: 7, peak: null, change: null }
    ]);
  });
  it("caps completed calendar months at twelve and retains the oldest row's prior-month comparison", () => {
    const rows = Array.from({ length: 20 }, (_, index) => {
      const date = new Date(Date.UTC(2026, 9 - index, 1));
      return month(date.toISOString().slice(0, 7), 7, 100);
    }).flat();
    const result = monthlyPlayers(rows, now);
    expect(result).toHaveLength(13);
    expect(result[1].month).toBe("2026-09");
    expect(result[result.length - 1]?.change).toBe(0);
  });
});

describe("tracked milestones", () => {
  it("does not invent crossings on first observation or repeat corrected counters", () => {
    const rows = [daily("2026-10-01", { peak_playing: 1000, visits: 1900, favorites: 900 }),
      daily("2026-10-02", { peak_playing: 1040, visits: 2100, favorites: 1001 }),
      daily("2026-10-03", { peak_playing: 1200, visits: 1800, favorites: 900 }),
      daily("2026-10-04", { peak_playing: 1210, visits: 2200, favorites: 1010 })];
    const result = detectMilestones(rows);
    expect(result).toHaveLength(3);
    expect(result).toContainEqual({ date: "2026-10-03", kind: "peak", value: 1200 });
    expect(result).toContainEqual({ date: "2026-10-02", kind: "visits", value: 2000 });
    expect(result.every(r => r.date !== "2026-10-01")).toBe(true);
  });
  it.each([
    [1.9e8, 2.1e8, 2e8], [4.9e8, 5.1e8, 5e8], [9e8, 1.1e9, 1e9], [1.9e9, 2.1e9, 2e9], [9.9e9, 10.1e9, 1e10],
    [14.9e9, 15.1e9, 15e9], [99.9e9, 100.1e9, 1e11], [109.9e9, 110.1e9, 110e9]
  ])("uses the wider visit threshold from %s to %s", (before, after, threshold) => {
    const result = detectMilestones([daily("2026-10-01", { visits: before }), daily("2026-10-02", { visits: after })]);
    expect(result).toEqual([{ date: "2026-10-02", kind: "visits", value: threshold }]);
  });
  it("ignores half-billion crossings and includes first daily rank achievements", () => {
    const result = detectMilestones([daily("2026-10-01", { visits: 1.4e9 }), daily("2026-10-02", { visits: 1.6e9 })], "2026-10-04", "2026-10-03");
    expect(result.map(row => row.kind)).toEqual(["top1", "top10"]);
  });
  it("does not fill MM2's timeline with 29.5B–31.8B half-billion steps", () => {
    const rows = [29.5, 30, 30.5, 31, 31.5, 31.8].map((visits, index) =>
      daily(`2026-10-${String(index + 1).padStart(2, '0')}`, { visits: visits * 1e9 }));
    expect(detectMilestones(rows)).toEqual([{ date: "2026-10-02", kind: "visits", value: 30e9 }]);
  });
  it("keeps at most two visits and two favorites without crowding out ranks or player peaks", () => {
    const rows = Array.from({ length: 7 }, (_, index) => daily(`2026-10-${String(index + 1).padStart(2, '0')}`, {
      visits: (index + 1) * 5e9, favorites: (index + 1) * 1e9, peak_playing: index === 6 ? 2000 : 1000
    }));
    const result = detectMilestones(rows, "2026-10-05", "2026-10-04");
    expect(result).toHaveLength(6);
    expect(result.filter(row => row.kind === "visits").map(row => row.value)).toEqual([35e9, 30e9]);
    expect(result.filter(row => row.kind === "favorites")).toHaveLength(2);
    expect(result.some(row => row.kind === "peak")).toBe(true);
    expect(result.some(row => row.kind === "top1")).toBe(true);
    expect(result.map(row => row.date)).toEqual(result.map(row => row.date).sort().reverse());
  });
  it("keeps at most six, newest first", () => {
    const rows = Array.from({ length: 10 }, (_, i) => daily(`2026-10-${String(i + 1).padStart(2, '0')}`, { peak_playing: 1000 * (i + 1) }));
    expect(detectMilestones(rows)).toHaveLength(6);
    expect(detectMilestones(rows)[0].date).toBe("2026-10-10");
  });
});

describe("update impact", () => {
  const at = Date.parse("2026-10-20T10:00:00Z");
  const hours: HourlyInsightRow[] = Array.from({ length: 72 }, (_, i) => ({ hour_start: new Date(at + (i - 24) * HOUR_MS).toISOString(), avg_playing: i < 24 ? 100 : 150, playing: 999 }));
  it("compares 24 hours before with 48 after, allowing alternate-hour collection", () => {
    expect(updateImpact(new Date(at).toISOString(), hours.filter((_, i) => i % 2 === 0), now)).toMatchObject({ before: 100, after: 150, change: 50 });
  });
  it("rejects unfinished windows, sparse windows, zero baselines and concentrated coverage", () => {
    expect(updateImpact(new Date(at).toISOString(), hours, at + 47 * HOUR_MS)).toBeNull();
    expect(updateImpact(new Date(at).toISOString(), hours.slice(20), now)).toBeNull();
    expect(updateImpact(new Date(at).toISOString(), hours.map(r => ({ ...r, avg_playing: 0 })), now)).toBeNull();
    expect(updateImpact(new Date(at).toISOString(), hours.filter((_, i) => i < 12 || i >= 24), now)).toBeNull();
  });
  it.each([0, 1])("accepts full alternate-hour coverage around a non-hour-aligned update, parity %s", parity => {
    const date = new Date(at + HOUR_MS / 2).toISOString();
    const sampled = hours.filter((_, index) => index % 2 === parity);
    expect(updateImpact(date, sampled, now)).toMatchObject({ before: 100, after: 150, change: 50 });
    // Removing a central sample from the smaller parity falls below the
    // eligible full-bucket minimum while keeping endpoint coverage intact.
    if (parity === 0) {
      expect(updateImpact(date, sampled.filter(row => Date.parse(row.hour_start) !== at - 12 * HOUR_MS), now)).toBeNull();
      expect(updateImpact(date, sampled.filter(row => Date.parse(row.hour_start) !== at + 12 * HOUR_MS), now)).toBeNull();
    }
  });
  it("deduplicates hourly rows and excludes the bucket straddling an update", () => {
    expect(updateImpact(new Date(at + 30 * 60_000).toISOString(), [...hours, ...hours], now)?.before).toBe(100);
    expect(updateImpact(new Date(at).toISOString(), [...hours.slice(0, 5), ...hours.slice(0, 5)], now)).toBeNull();
  });
});

describe("session estimate filtering", () => {
  it("uses average concurrency and visits, leaves gaps, and rejects unreliable days", () => {
    const invalid: Partial<DailyInsightRow>[] = [{ visit_delta: 0 }, { visit_delta: -5 }, { sample_count: 11 }, { is_finalized: false }, { avg_playing: null }, { visits_end: 2 }, { visit_delta: 1, visits_start: null, visits_end: null }, { visit_delta: 1e8, visits_start: null, visits_end: null }];
    const rows = [daily("2026-10-01"), ...invalid.map((extra, i) => daily(`2026-10-${String(i + 2).padStart(2, '0')}`, extra)), daily("2026-10-25")];
    const result = sessionEstimates(rows, now);
    expect(result).toHaveLength(90);
    expect(result.filter(p => p.minutes !== null)).toEqual([{ date: "2026-10-01", minutes: 10 }]);
    expect(result[result.length - 1]?.date).toBe("2026-10-24");
  });
});

describe("badge range selection", () => {
  it("selects evenly spaced enabled fresh raw fractions and preserves zero", () => {
    const rows = Array.from({ length: 11 }, (_, i) => ({ badge_id: i, name: `Badge ${i}`, enabled: true, rarity_percent: 1 - i / 10, stats_updated_at: new Date(now).toISOString() }));
    expect(selectBadges(rows, now).map(r => r.badge_id)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(selectBadges([{ ...rows[0], enabled: false }, { ...rows[1], rarity_percent: 20 }, { ...rows[2], stats_updated_at: null }, { ...rows[3], stats_updated_at: new Date(now - 8 * DAY_MS).toISOString() }], now)).toEqual([]);
  });
});

describe("weekly movers", () => {
  it("filters tiny baselines, missing values and low current players, then takes four each side", () => {
    const base = { universe_id: 1, slug: "one", name: "One", playing: 6000, baseline_playing_7d: 2000, growth_7d_percent: 100 };
    const rows = [ { ...base, baseline_playing_7d: 1, growth_7d_percent: 1e6 }, { ...base, playing: 4999 }, { ...base, growth_7d_percent: null }, ...Array.from({ length: 12 }, (_, i) => ({ ...base, universe_id: i + 10, growth_7d_percent: (i - 6) * 10 })) ];
    expect(selectMovers(rows).map(r => r.growth_7d_percent)).toEqual([50, 40, 30, 20, -60, -50, -40, -30]);
  });
});

describe("daily average player calendar", () => {
  it("lays out Sunday-first columns, preserves missing dates and does not invent zeroes", () => {
    const weeks = playersCalendar([{ stat_date: "2026-10-25", playing: 100 }, { stat_date: "2026-10-24", playing: 0 }], now);
    expect(weeks).toHaveLength(13);
    expect(weeks.every(w => w.length === 7 && new Date(`${w[0].date}T00:00:00Z`).getUTCDay() === 0)).toBe(true);
    expect(weeks[12][0]).toMatchObject({ date: "2026-10-25", players: 100, level: 4, future: false });
    expect(weeks[12][1]).toMatchObject({ players: null, future: true });
    expect(weeks[11][6]).toMatchObject({ date: "2026-10-24", players: 0, level: 1 });
    expect(weeks[0][0].players).toBeNull();
    expect(playersCalendar([], now).flat().every(d => d.players === null)).toBe(true);
  });
});

describe("game pass price axis", () => {
  it.each([
    [[99, 3399], [50, 5000]], [[1, 5000], [.5, 10000]], [[149, 10001], [100, 25000]],
    [[2500], [1000, 5000]], [[5, 10], [2.5, 25]]
  ])("brackets %j with nice labelled ticks", (prices, expected) => {
    const { domain, ticks } = passPriceAxis(prices);
    expect(domain).toEqual(expected);
    expect(ticks[0]).toBe(domain[0]);
    expect(ticks[ticks.length - 1]).toBe(domain[1]);
    expect(domain[0]).toBeLessThan(Math.min(...prices));
    expect(domain[1]).toBeGreaterThan(Math.max(...prices));
  });
});

describe("scatter labels", () => {
  const current = { universeId: 1, name: "Current", rating: 50, players: 10000 };
  const points = [
    { universeId: 2, name: "99 Nights in the Forest", rating: 99, players: 100000 },
    { universeId: 3, name: "MM2", rating: 1, players: 1000 },
    { universeId: 4, name: "Small", rating: 40, players: 50 }
  ];
  const data: GenreScatter = { genre: "Survival", count: 40, rank: 2, current, points };
  it("labels at most two peers with complete names that fit", () => {
    const labels = scatterLabels(data, 1000);
    expect(labels.get(2)?.text).toBe("99 Nights in the Forest");
    expect([...labels.keys()].filter(id => id !== 1).length).toBeLessThanOrEqual(2);
    for (const [id, label] of labels) expect(label.text).toBe([...points, current].find(point => point.universeId === id)?.name);
  });
  it("skips a long peer label on narrow cards without changing the tooltip name", () => {
    expect(scatterLabels(data, 220).has(2)).toBe(false);
    expect(points[0].name).toBe("99 Nights in the Forest");
    expect(scatterLabels(data, 0).size).toBe(0);
  });
});
