// Pure transformations shared by server reads, charts and focused tests.
export const DAY_MS = 86_400_000;
export const HOUR_MS = 3_600_000;
export type DailyInsightRow = {
  stat_date: string; playing: number | null; avg_playing: number | null; peak_playing: number | null;
  visits: number | null; visit_delta: number | null;
  visits_start: number | null; visits_end: number | null; like_delta: number | null;
  dislike_delta: number | null; sample_count: number | null; is_finalized: boolean;
};
export type MonthlyPlayers = { month: string; average: number; peak: number | null; change: number | null; days: number };
export type SessionPoint = { date: string; minutes: number | null };
export type VotePoint = { date: string; likes: number; dislikes: number };
export type UpdateMarker = { date: string; label: string };
export type UpdateImpact = { date: string; title: string; before: number; after: number; change: number };
export type HourlyInsightRow = { hour_start: string; avg_playing: number | null; playing: number | null };
export type BadgeInsight = { badge_id: number; name: string; enabled: boolean | null; rarity_percent: number | null; stats_updated_at: string | null };
export type PassInsight = { pass_id: number; name: string; price: number };
export type ScatterPoint = { universeId: number; name: string; rating: number; players: number };
export type GenreScatter = { genre: string; points: ScatterPoint[]; current: ScatterPoint; rank: number; count: number };
export type Mover = { universe_id: number; slug: string; name: string; playing: number | null; baseline_playing_7d: number | null; growth_7d_percent: number | null };
export type CalendarDay = { date: string; players: number | null; level: number; future: boolean };
export type StatsGameInsights = {
  months: MonthlyPlayers[]; trackedSince: string | null; updates: UpdateImpact[];
  votes: VotePoint[]; sessions: SessionPoint[]; markers: UpdateMarker[]; scatter: GenreScatter | null;
  badges: BadgeInsight[]; passes: PassInsight[]; asOf: string;
};
const finite = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n);
export const utcDay = (now: number) => new Date(now).toISOString().slice(0, 10);
export const dayTime = (date: string) => Date.parse(`${date.slice(0, 10)}T00:00:00Z`);
const average = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;

function summarizeMonth(month: string, rows: DailyInsightRow[]): MonthlyPlayers | null {
  const days = [...new Map(rows.map(row => [row.stat_date, row])).values()];
  if (days.length < 7) return null;
  const peaks = days.map(row => row.peak_playing).filter(finite);
  return {
    month,
    average: average(days.map(row => (row.avg_playing ?? row.playing)!)),
    peak: peaks.length ? Math.max(...peaks) : null,
    change: null,
    days: days.length
  };
}

export function monthlyPlayers(rows: DailyInsightRow[], now = Date.now()): MonthlyPlayers[] {
  const today = utcDay(now);
  const end = dayTime(today);
  const completed = rows.filter(row => row.stat_date < today && finite(row.avg_playing ?? row.playing));
  const rolling = (offset: number) => completed.filter(row => {
    const time = dayTime(row.stat_date);
    return time >= end - (offset + 30) * DAY_MS && time < end - offset * DAY_MS;
  });
  const last30 = summarizeMonth('last30', rolling(0));
  const previous30 = summarizeMonth('previous30', rolling(30));
  const change = (row: MonthlyPlayers, older: MonthlyPlayers | null | undefined): MonthlyPlayers => ({
    ...row,
    change: older && older.average > 0 ? (row.average / older.average - 1) * 100 : null
  });
  const byMonth = new Map<string, DailyInsightRow[]>();
  for (const row of completed) {
    const key = row.stat_date.slice(0, 7);
    if (key < today.slice(0, 7)) byMonth.set(key, [...(byMonth.get(key) ?? []), row]);
  }
  const months = new Map([...byMonth].map(([key, days]) => [key, summarizeMonth(key, days)]));
  const calendar = [...months.values()]
    .filter((row): row is MonthlyPlayers => row !== null)
    .sort((a, b) => b.month.localeCompare(a.month))
    .slice(0, 12)
    .map(row => {
      const previous = new Date(`${row.month}-01T00:00:00Z`);
      previous.setUTCMonth(previous.getUTCMonth() - 1);
      return change(row, months.get(previous.toISOString().slice(0, 7)));
    });
  return [...(last30 ? [change(last30, previous30)] : []), ...calendar];
}

export function updateImpact(date: string, rows: HourlyInsightRow[], now = Date.now()): Omit<UpdateImpact, 'title'> | null {
  const at = Date.parse(date);
  if (!Number.isFinite(at) || at + 48 * HOUR_MS > now) return null;
  // Only complete hourly buckets fully inside the relevant side of the update.
  const usable = [...new Map(rows.map(r => [r.hour_start, r])).values()].filter(r => finite(r.avg_playing ?? r.playing));
  const before = usable.filter(r => Date.parse(r.hour_start) >= at - 24 * HOUR_MS && Date.parse(r.hour_start) + HOUR_MS <= at);
  const after = usable.filter(r => Date.parse(r.hour_start) >= at && Date.parse(r.hour_start) + HOUR_MS <= at + 48 * HOUR_MS);
  // Alternate-hour sampling can contain either parity. A non-aligned
  // 24h/48h window has 23/47 eligible full buckets, hence a minimum of 11/23.
  const covered = (samples: HourlyInsightRow[], start: number, hours: number) => {
    const first = Math.ceil(start / HOUR_MS) * HOUR_MS;
    const end = Math.floor((start + hours * HOUR_MS) / HOUR_MS) * HOUR_MS;
    const eligible = Math.round((end - first) / HOUR_MS);
    const times = samples.map(row => Date.parse(row.hour_start));
    return samples.length >= Math.max(1, Math.floor(eligible / 2)) &&
      Math.min(...times) <= first + 2 * HOUR_MS &&
      Math.max(...times) >= end - 3 * HOUR_MS;
  };
  if (!covered(before, at - 24 * HOUR_MS, 24) || !covered(after, at, 48)) return null;
  const b = average(before.map(r => (r.avg_playing ?? r.playing)!));
  const a = average(after.map(r => (r.avg_playing ?? r.playing)!));
  return b > 0 ? { date, before: b, after: a, change: (a / b - 1) * 100 } : null;
}

export function sessionEstimates(rows: DailyInsightRow[], now = Date.now()): SessionPoint[] {
  const today = utcDay(now);
  const byDate = new Map(rows.map(r => [r.stat_date, r]));
  return Array.from({ length: 90 }, (_, index) => {
    const date = utcDay(dayTime(today) - (90 - index) * DAY_MS);
    const r = byDate.get(date);
    if (!r) return { date, minutes: null };
    const players = r.avg_playing; // Never substitute a point snapshot here.
    const delta = r.visit_delta;
    const endpointsAgree = r.visits_start == null || r.visits_end == null || r.visits_end - r.visits_start === delta;
    const minutes = finite(players) && players > 0 && finite(delta) && delta > 0 && (r.sample_count ?? 0) >= 12 && r.is_finalized && endpointsAgree &&
      (r.visits == null || delta <= r.visits) ? players * 1440 / delta : null;
    // Below six seconds or above 12 hours is too sensitive to counter gaps.
    return { date: r.stat_date, minutes: minutes !== null && minutes >= .1 && minutes <= 720 ? minutes : null };
  });
}
export function selectBadges(rows: BadgeInsight[], now = Date.now()): BadgeInsight[] {
  // The stored field is the raw 0..1 Roblox win rate, NOT lifetime completion.
  const sorted = rows.filter(r => r.enabled === true && finite(r.rarity_percent) && r.rarity_percent >= 0 && r.rarity_percent <= 1 &&
    r.stats_updated_at && Date.parse(r.stats_updated_at) >= now - 7 * DAY_MS)
    .sort((a, b) => b.rarity_percent! - a.rarity_percent! || a.badge_id - b.badge_id);
  const count = Math.min(6, sorted.length);
  return Array.from({ length: count }, (_, i) => sorted[Math.round(i * (sorted.length - 1) / Math.max(1, count - 1))]);
}
export function selectMovers(rows: Mover[]): Mover[] {
  const eligible = rows.filter(r => finite(r.playing) && r.playing >= 5000 && finite(r.baseline_playing_7d) && r.baseline_playing_7d >= 1000 && finite(r.growth_7d_percent));
  return [...eligible.filter(r => r.growth_7d_percent! > 0).sort((a, b) => b.growth_7d_percent! - a.growth_7d_percent!).slice(0, 4),
    ...eligible.filter(r => r.growth_7d_percent! < 0).sort((a, b) => a.growth_7d_percent! - b.growth_7d_percent!).slice(0, 4)];
}
export function playersCalendar(rows: { stat_date: string; playing: number | null }[], now = Date.now()): CalendarDay[][] {
  const today = dayTime(utcDay(now));
  const end = today + (6 - new Date(today).getUTCDay()) * DAY_MS;
  const start = end - 90 * DAY_MS; // Sunday-first, 13 complete calendar columns.
  const byDate = new Map(rows.map(r => [r.stat_date, r.playing]));
  const values = rows.filter(r => dayTime(r.stat_date) >= start && dayTime(r.stat_date) <= today).map(r => r.playing).filter(finite);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  return Array.from({ length: 13 }, (_, week) => Array.from({ length: 7 }, (_, day) => {
    const time = start + (week * 7 + day) * DAY_MS;
    const date = utcDay(time);
    const value = time > today ? null : byDate.get(date) ?? null;
    return { date, players: value, future: time > today, level: value === null ? 0 : max === min ? 3 : Math.min(4, 1 + Math.floor((value - min) / (max - min) * 4)) };
  }));
}

// Keep the complete price range between labelled log ticks, including unusually
// cheap/expensive passes. The upper endpoint is always above the largest price.
export function passPriceAxis(prices: number[]): { domain: [number, number]; ticks: number[] } {
  const valid = prices.filter(price => finite(price) && price > 0);
  if (!valid.length) return { domain: [1, 10], ticks: [1, 2.5, 5, 10] };
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const candidates: number[] = [];
  for (let exponent = Math.floor(Math.log10(min)) - 1; exponent <= Math.ceil(Math.log10(max)) + 1; exponent++) {
    for (const step of [1, 2.5, 5]) candidates.push(step * 10 ** exponent);
  }
  const lowerTicks = candidates.filter(tick => tick < min);
  const low = lowerTicks[lowerTicks.length - 1];
  const high = candidates.find(tick => tick > max)!;
  return { domain: [low, high], ticks: candidates.filter(tick => tick >= low && tick <= high) };
}

export type ScatterLabel = { text: string; position: 'left' | 'right' };
export function scatterLabels(data: GenreScatter, width: number): Map<number, ScatterLabel> {
  const all = [...data.points.filter(point => point.universeId !== data.current.universeId), data.current];
  const minX = Math.max(0, Math.min(...all.map(point => point.rating)) - 2);
  const maxX = Math.min(100, Math.max(...all.map(point => point.rating)) + 2);
  const minY = Math.log10(Math.min(...all.map(point => point.players)) / 1.5);
  const maxY = Math.log10(Math.max(...all.map(point => point.players)) * 1.7);
  // Match the scatter's 48px Y axis and 24px right margin. Width comes from
  // ResizeObserver, so a full name must fit even in a narrow mobile card.
  const plotWidth = Math.max(0, width - 48 - 24);
  const plotHeight = 220 - 24 - 30;
  const boxes: Array<{ left: number; right: number; top: number; bottom: number }> = [];
  const labels = new Map<number, ScatterLabel>();
  const add = (point: ScatterPoint, fontSize: number) => {
    const x = (point.rating - minX) / (maxX - minX) * plotWidth;
    const y = (maxY - Math.log10(point.players)) / (maxY - minY) * plotHeight;
    // One font-size per character is deliberately conservative. Skip names
    // that cannot fit in full; their hover tooltip always keeps the full name.
    const textWidth = point.name.length * fontSize;
    const gap = 8;
    const position = x >= plotWidth - x ? 'left' : 'right';
    const left = position === 'left' ? x - gap - textWidth : x + gap;
    const box = { left, right: left + textWidth, top: y - fontSize / 2, bottom: y + fontSize / 2 };
    if (box.left < 0 || box.right > plotWidth || boxes.some(other =>
      box.left < other.right + gap && box.right + gap > other.left &&
      box.top < other.bottom + gap && box.bottom + gap > other.top)) return false;
    labels.set(point.universeId, { text: point.name, position });
    boxes.push(box);
    return true;
  };
  add(data.current, 10);
  let peers = 0;
  for (const point of all.filter(point => point.universeId !== data.current.universeId).sort((a, b) => b.players - a.players)) {
    if (peers === 2) break;
    if (add(point, 9)) peers++;
  }
  return labels;
}
