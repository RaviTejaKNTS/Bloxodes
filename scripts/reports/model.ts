import { insightSentence } from './writer-notes';
import { cleanRobloxUniverseDisplayName } from '../../apps/web/src/lib/roblox/display-name';

/** The last item of a list. The web app type-checks this file against ES2021, which has no Array.prototype.at. */
export function lastOf<T>(items: readonly T[]): T | undefined {
  return items[items.length - 1];
}
export const CHARTS = ['players-daily', 'busiest-hours', 'top-games', 'top10-weekly', 'concentration', 'movers', 'new-games', 'genre-share', 'genre-trends', 'genre-table', 'rating-vs-size', 'session-length', 'update-effect', 'top100'] as const;
export type Row = Record<string, any>;
export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
export const mean = (xs: number[]) => xs.length ? sum(xs) / xs.length : 0;
export const day = (d: string, n = 0) => new Date(Date.parse(d.slice(0, 10)) + n * 86400000).toISOString().slice(0, 10);
export function dates(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
    throw Error('Invalid month');
  const first = month + '-01';
  const end = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5), 0)).getUTCDate();
  return Array.from({
    length: end
  }, (_, i) => day(first, i));
}
export const genre = (v: string | null) => !v?.trim() || v === 'All' ? 'Other' : v.trim();
export const players = (r: {
  avg_playing?: number | null;
  playing?: number | null;
}) => Number(r.avg_playing ?? r.playing ?? 0);
export function coverage(month: string, counts: Record<string, number>, now = new Date()) {
  const monthDays = dates(month);
  const today = now.toISOString().slice(0, 10);
  const sorted = monthDays.filter(date => date < today).map(date => counts[date] ?? 0).sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length === 0 ? 0 : sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  const full_days = monthDays.filter(date => median > 0 && (counts[date] ?? 0) >= median * .9);
  const gap_days = monthDays.filter(date => !full_days.includes(date));
  const lastDay = lastOf(monthDays)!;
  const ended = today > lastDay;
  let status = 'ready';
  let reason: string | null = null;
  if (!ended) {
    status = 'not-ready';
    reason = 'Month has not ended UTC';
  }
  else if (!counts[lastDay]) {
    status = 'not-ready';
    reason = 'Last daily rollup is missing';
  }
  else if (full_days.length / monthDays.length < .9) {
    status = 'invalid';
    reason = 'Fewer than 90% full days';
  }
  return {
    status,
    full_days,
    gap_days,
    median,
    row_counts: Object.fromEntries(monthDays.map(date => [date, counts[date] ?? 0])),
    reason
  };
}
export interface DailyRow {
  universe_id: number | string;
  stat_date: string;
  avg_playing?: number | null;
  playing?: number | null;
  peak_playing?: number | null;
  visit_delta?: number | null;
  likes_end?: number | null;
  likes?: number | null;
  dislikes_end?: number | null;
  dislikes?: number | null;
}
interface GameAccumulator {
  id: number;
  days: number;
  total: number;
  visits: number;
  peak: number;
  last: string;
  rating: number | null;
  daily: Record<string, number>;
}
export interface RankedGame extends GameAccumulator {
  players: number;
  session: number | null;
  rank: number;
}
interface GameIdentity {
  name: string;
  slug: string | null;
  genre: string;
  subgenre?: string | null;
  created?: string | null;
}
export function ranks(rows: DailyRow[], full: string[]): RankedGame[] {
  const selected = new Set(full);
  const games = new Map<number, GameAccumulator>();
  for (const row of rows) {
    if (!selected.has(row.stat_date))
      continue;
    const id = Number(row.universe_id);
    const game = games.get(id) ?? {
      id,
      days: 0,
      total: 0,
      visits: 0,
      peak: 0,
      last: '',
      rating: null,
      daily: {}
    };
    game.days++;
    game.total += players(row);
    game.visits += Math.max(0, Number(row.visit_delta ?? 0));
    game.peak = Math.max(game.peak, Number(row.peak_playing ?? row.playing ?? 0));
    if (row.stat_date > game.last) {
      game.last = row.stat_date;
      const likes = Number(row.likes_end ?? row.likes ?? 0);
      const votes = likes + Number(row.dislikes_end ?? row.dislikes ?? 0);
      game.rating = votes >= 100 ? likes / votes * 100 : null;
    }
    games.set(id, game);
  }
  const ranked = [...games.values()]
    .filter(game => game.days >= full.length * .8)
    .map(game => ({
      ...game,
      // Average over the days the game has data; a missing day is a gap, not zero players.
      players: game.total / game.days,
      session: game.visits > 0 ? game.total * 1440 / game.visits : null
    }))
    .sort((a, b) => b.players - a.players || a.id - b.id)
    .map((game, index) => ({
      ...game,
      rank: index + 1
    }));
  const sparklineGames = new Map(ranked.slice(0, 100).map(game => [game.id, game]));
  for (const row of rows) {
    const game = sparklineGames.get(Number(row.universe_id));
    if (game && selected.has(row.stat_date))
      game.daily[row.stat_date] = players(row);
  }
  return ranked;
}
export function trendWeeks(counts: Row, month: string) {
  const end = lastOf(dates(month))!;
  const start = day(end, -97);
  const full = new Set<string>();
  for (const m of [...new Set(Array.from({
    length: 105
  }, (_, i) => day(start, i).slice(0, 7)))])
    for (const d of coverage(m, counts, new Date('9999-01-01')).full_days)
      full.add(d);
  const weeks: string[][] = [];
  for (let d = start; d <= end; d = day(d, 1))
    if (new Date(d).getUTCDay() === 1 && d >= '2026-08-10') {
      const ds = Array.from({
        length: 7
      }, (_, i) => day(d, i)).filter(x => x <= end && full.has(x));
      if (ds.length >= 6)
        weeks.push(ds);
    }
  return weeks.slice(-13);
}
export function meaningfulUpdates(events: Row[], top: Pick<RankedGame, 'id' | 'players'>[], rows: DailyRow[], full: Set<string>, month: string) {
  const by = new Map<number, string[]>();
  for (const e of events) {
    const ds = by.get(+e.universe_id) ?? [];
    ds.push(e.updated_at_api);
    by.set(+e.universe_id, ds);
  }
  const selected = new Set(top.slice(0, 100).map(g => g.id));
  const lookup = new Map(rows.filter(r => selected.has(+r.universe_id)).map(r => [`${r.universe_id}:${r.stat_date}`, players(r)]));
  const result: Row[] = [];
  for (const g of top.slice(0, 100)) {
    const es = (by.get(g.id) ?? []).sort();
    for (let i = 0; i < es.length; i++) {
      const d = es[i].slice(0, 10);
      if (!d.startsWith(month) || i > 0 && Date.parse(es[i]) - Date.parse(es[i - 1]) <= 7 * 86400000)
        continue;
      const before = Array.from({
        length: 7
      }, (_, j) => day(d, -j - 1)), after = Array.from({
        length: 7
      }, (_, j) => day(d, j + 1));
      if (![...before, ...after].every(x => full.has(x) && lookup.has(`${g.id}:${x}`)))
        continue;
      const b = mean(before.map(x => lookup.get(`${g.id}:${x}`)!)), a = mean(after.map(x => lookup.get(`${g.id}:${x}`)!));
      const chronologicalBefore = [...before].sort().map(x => lookup.get(`${g.id}:${x}`)!);
      const chronologicalAfter = after.map(x => lookup.get(`${g.id}:${x}`)!);
      const beforeTrend = mean(chronologicalBefore.slice(-3)) - mean(chronologicalBefore.slice(0, 3));
      const afterTrend = mean(chronologicalAfter.slice(-3)) - mean(chronologicalAfter.slice(0, 3));
      result.push({
        id: g.id,
        date: d,
        before: b,
        after: a,
        change: a - b,
        percent: b ? (a / b - 1) * 100 : 0,
        beforeTrend,
        afterTrend,
        keptDirection: Math.sign(beforeTrend) === Math.sign(afterTrend),
        players: g.players
      });
    }
  }
  return result.sort((a, b) => b.players - a.players || a.date.localeCompare(b.date));
}
export function busiestHours(rows: Row[], ids: number[]) {
  const selected = new Set(ids);
  const games = new Map<number, Map<number, number[]>>();
  for (const r of rows) {
    const id = +r.universe_id;
    if (!selected.has(id))
      continue;
    const t = new Date(r.hour_start), cell = ((t.getUTCDay() + 6) % 7) * 24 + t.getUTCHours();
    const cells = games.get(id) ?? new Map();
    const a = cells.get(cell) ?? [0, 0];
    a[0] += players(r);
    a[1]++;
    cells.set(cell, a);
    games.set(id, cells);
  }
  const cells = Array.from({
    length: 168
  }, (_, cell) => {
    let value = 0, present = 0;
    for (const g of games.values()) {
      const a = g.get(cell);
      if (a) {
        value += a[0] / a[1];
        present++;
      }
    }
    return {
      weekday: Math.floor(cell / 24),
      hour: cell % 24,
      value: present ? value * ids.length / present : 0,
      coverage: ids.length ? present / ids.length : 0
    };
  });
  const minCoverage = Math.min(...cells.map(x => x.coverage));
  const maxJump = Math.max(...cells.map((x, i) => {
    const previous = cells[(i + 167) % 168].value;
    return previous ? Math.abs(x.value - previous) / previous : x.value ? 1 : 0;
  }));
  const failing = cells.filter(cell => cell.coverage < .8);
  const reason = minCoverage < .8 ? `${failing.length}/168 weekday/hour cells have coverage below 80%; minimum ${(minCoverage * 100).toFixed(1)}%; largest adjacent-hour jump ${(maxJump * 100).toFixed(1)}%` : maxJump > .35 ? `Adjacent-hour jump ${(maxJump * 100).toFixed(1)}% exceeds 35%` : null;
  return {
    cells,
    minCoverage,
    maxJump,
    failingCells: failing,
    valid: !reason,
    reason
  };
}
interface GenreSummary {
  genre: string;
  players: number;
  share: number;
  change: number | null;
  games: number;
  top100: number;
  biggest: number | undefined;
  biggestName: string | undefined;
  biggestSlug: string | null | undefined;
  leaderShare: number | null;
  session: number | null;
}
export function buildModel(month: string, rows: DailyRow[], universes: Row[], events: Row[], hourly: Row[], now = new Date()) {
  const counts: Record<string, number> = {};
  for (const r of rows)
    counts[r.stat_date] = (counts[r.stat_date] ?? 0) + 1;
  const check = coverage(month, counts, now), prev = day(month + '-01', -1).slice(0, 7);
  const comparison = coverage(prev, counts, now);
  if (prev < '2026-09') {
    comparison.status = 'invalid';
    comparison.reason = 'Months before September 2026 are not comparable';
  }
  const current = ranks(rows, check.full_days), prior = comparison.status === 'ready' ? ranks(rows, comparison.full_days) : [];
  const old = new Map(prior.map(x => [x.id, x]));
  const games: Record<string, GameIdentity> = {};
  for (const u of universes)
    games[u.universe_id] = {
      name: cleanRobloxUniverseDisplayName(u.display_name || u.name) || `Universe ${u.universe_id}`,
      slug: u.slug,
      genre: genre(u.genre_l1),
      subgenre: u.genre_l2,
      created: u.created_at_api
    };
  for (const g of [...current, ...prior])
    games[g.id] ??= {
      name: `Universe ${g.id}`,
      slug: null,
      genre: 'Other'
    };
  const top = current.slice(0, 100).map(g => ({
    ...g,
    ...games[g.id],
    change: old.has(g.id) ? g.players - old.get(g.id)!.players : null,
    percentChange: old.has(g.id) && old.get(g.id)!.players ? (g.players / old.get(g.id)!.players - 1) * 100 : null,
    rankChange: old.has(g.id) ? old.get(g.id)!.rank - g.rank : null
  }));
  const dailyTotals: Record<string, number> = {};
  for (const r of rows)
    dailyTotals[r.stat_date] = (dailyTotals[r.stat_date] ?? 0) + players(r);
  const avg = mean(check.full_days.map(d => dailyTotals[d] ?? 0)), previousAvg = prior.length ? mean(comparison.full_days.map(d => dailyTotals[d] ?? 0)) : null;
  const visits = sum(rows.filter(r => check.full_days.includes(r.stat_date)).map(r => Math.max(0, +r.visit_delta || 0))), oldVisits = prior.length ? sum(rows.filter(r => comparison.full_days.includes(r.stat_date)).map(r => Math.max(0, +r.visit_delta || 0))) : null;
  const weeks = trendWeeks(counts, month).map(ds => {
    const ranked = ranks(rows, ds).map(g => ({
      id: g.id,
      players: g.players,
      rank: g.rank
    }));
    return {
      week: day(ds[0], -((new Date(ds[0]).getUTCDay() + 6) % 7)),
      days: ds,
      ranked,
      total: mean(ds.map(d => dailyTotals[d] ?? 0))
    };
  });
  // Genre totals count every game on full days, not only ranked games, so shares add up to the
  // platform total. Rankings, leaders and session length still use ranked games only.
  const genreAverages = (days: string[]) => {
    const fullDays = new Set(days), totals = new Map<string, number>();
    if (!fullDays.size)
      return totals;
    for (const r of rows) {
      if (!fullDays.has(r.stat_date))
        continue;
      const name = games[String(r.universe_id)]?.genre ?? 'Other';
      totals.set(name, (totals.get(name) ?? 0) + players(r));
    }
    for (const [name, total] of totals)
      totals.set(name, total / fullDays.size);
    return totals;
  };
  const genreNow = genreAverages(check.full_days), genreBefore = prior.length ? genreAverages(comparison.full_days) : new Map<string, number>();
  const genreRows: GenreSummary[] = [...genreNow.keys()].map(name => {
    const gs = current.filter(g => games[g.id].genre === name), p = genreNow.get(name) ?? 0, before = genreBefore.get(name) ?? 0;
    return {
      genre: name,
      players: p,
      share: p / avg * 100,
      change: previousAvg ? p / avg * 100 - before / previousAvg * 100 : null,
      games: gs.length,
      top100: top.filter(g => g.genre === name).length,
      biggest: gs[0]?.id,
      biggestName: games[gs[0]?.id]?.name,
      biggestSlug: games[gs[0]?.id]?.slug,
      leaderShare: gs.length && p ? gs[0].players / p * 100 : null,
      session: sum(gs.map(g => g.visits)) ? sum(gs.map(g => g.total)) * 1440 / sum(gs.map(g => g.visits)) : null
    };
  }).sort((a, b) => b.players - a.players);
  const heat = busiestHours(hourly, current.slice(0, 1000).map(g => g.id));
  const allFull = new Set<string>();
  for (const m of [...new Set(Object.keys(counts).map(d => d.slice(0, 7)))])
    for (const d of coverage(m, counts, now).full_days)
      allFull.add(d);
  const updates = meaningfulUpdates(events, current, rows, allFull, month);
  const omitted: Record<string, string> = {};
  if (!heat.valid)
    omitted['busiest-hours'] = heat.reason!;
  if (updates.length < 4)
    omitted['update-effect'] = 'Fewer than 4 qualifying updates';
  if (!prior.length)
    omitted.movers = 'Previous month is not valid';
  const newGames = top.filter(g => g.created && g.created.slice(0, 10) >= day(lastOf(dates(month))!, -90) && g.created.slice(0, 10) <= lastOf(dates(month))!);
  const facts = {
    trackedGames: current.length,
    avgPlayers: avg,
    playersChange: previousAvg ? (avg / previousAvg - 1) * 100 : null,
    busiestDay: check.full_days.reduce((a, b) => dailyTotals[a] > dailyTotals[b] ? a : b, check.full_days[0]),
    busiestPlayers: Math.max(0, ...check.full_days.map(d => dailyTotals[d])),
    visits,
    visitsChange: oldVisits ? (visits / oldVisits - 1) * 100 : null,
    top10Share: sum(top.slice(0, 10).map(g => g.players)) / avg * 100,
    newGames: newGames.length,
    session: visits ? avg * 1440 / (visits / check.full_days.length) : null
  };
  const movers = current.map(g => ({
    ...g,
    ...games[g.id],
    change: old.has(g.id) ? g.players - old.get(g.id)!.players : null
  })).filter(g => g.change !== null && Math.max(g.players, old.get(g.id)!.players) >= 20000).sort((a, b) => b.change! - a.change!);
  const charts: Row = {};
  const put = (id: string, kind: string, data: Row[]) => charts[id] = {
    id,
    kind,
    data,
    month,
    comparison: comparison.status === 'ready'
  };
  put('players-daily', 'line', dates(month).map((d, i) => ({
    date: d,
    value: check.full_days.includes(d) ? dailyTotals[d] : null,
    previous: comparison.status === 'ready' && comparison.full_days.includes(dates(prev)[i]) ? dailyTotals[dates(prev)[i]] : null,
    weekend: [0, 6].includes(new Date(d).getUTCDay())
  })));
  put('busiest-hours', 'heatmap', heat.cells);
  put('top-games', 'hbar', top.slice(0, 20));
  const weeklyIds = new Set(weeks.filter(w => w.days.some(d => d.startsWith(month))).flatMap(w => w.ranked.slice(0, 10).map(g => g.id)));
  put('top10-weekly', 'bump', [...weeklyIds].map(id => ({
    id,
    name: games[id]?.name,
    points: weeks.map(w => ({
      week: w.week,
      rank: w.ranked.find(g => g.id === id)?.rank ?? null
    }))
  })));
  put('concentration', 'stacked', weeks.map(w => ({
    week: w.week,
    top10: sum(w.ranked.slice(0, 10).map(g => g.players)) / w.total * 100,
    top100: sum(w.ranked.slice(10, 100).map(g => g.players)) / w.total * 100,
    rest: 100 - sum(w.ranked.slice(0, 100).map(g => g.players)) / w.total * 100
  })));
  put('movers', 'diverging', [...movers.filter(g => g.change! > 0).slice(0, 7), ...movers.filter(g => g.change! < 0).slice(-5)]);
  put('new-games', 'table', newGames);
  const tiny = genreRows.filter(g => g.share < 1 || g.genre === 'Other');
  const major = genreRows.filter(g => g.share >= 1 && g.genre !== 'Other');
  if (tiny.length)
    major.push({
      genre: 'Other',
      players: sum(tiny.map(g => g.players)),
      share: sum(tiny.map(g => g.share)),
      change: comparison.status === 'ready' ? sum(tiny.map(g => g.change ?? 0)) : null,
      games: sum(tiny.map(g => g.games)),
      top100: sum(tiny.map(g => g.top100)),
      biggest: undefined,
      biggestName: undefined,
      biggestSlug: undefined,
      leaderShare: 0,
      session: null
    });
  put('genre-share', 'hbar', major);
  const weeklyGenres = weeks.map(w => genreAverages(w.days));
  put('genre-trends', 'multiples', genreRows.filter(g => g.genre !== 'Other').slice(0, 8).map(g => ({
    genre: g.genre,
    points: weeks.map((w, i) => ({
      week: w.week,
      value: weeklyGenres[i].get(g.genre) ?? 0
    }))
  })));
  put('genre-table', 'table', genreRows);
  put('rating-vs-size', 'scatter', top);
  put('session-length', 'hbar', genreRows.filter(g => g.games >= 3 && g.session !== null));
  put('update-effect', 'dumbbell', updates.slice(0, 12).map(u => ({
    ...u,
    ...games[u.id]
  })));
  put('top100', 'table', top);
  for (const id of Object.keys(omitted))
    delete charts[id];
  const insights: Row[] = [];
  const add = (kind: string, values: Row, related: string[], summary: string) => insights.push({
    id: `insight-${insights.length + 1}`,
    kind,
    values,
    charts: related,
    summary
  });
  // Only when a game really lost players and at least two gained.
  const biggestLoser = movers.filter(g => g.change! < 0).sort((a, b) => a.change! - b.change!)[0];
  const topGainers = movers.filter(g => g.change! > 0).sort((a, b) => b.change! - a.change!).slice(0, 2);
  if (biggestLoser && topGainers.length === 2)
    add('loss-vs-gains', {
      loser: biggestLoser.id,
      loss: biggestLoser.change,
      gains: sum(topGainers.map(g => g.change!))
    }, ['movers'], 'Largest loss compared with the two largest gains.');
  for (let n = 3; n <= 5; n++)
    add('leader-vs-runners', {
      leaderId: top[0]?.id,
      leader: top[0]?.players ?? 0,
      others: sum(top.slice(1, n).map(g => g.players)),
      throughRank: n
    }, ['top-games'], 'The leader compared with the next games combined.');
  for (const g of genreRows.filter(g => g.players > 0 && g.leaderShare !== null))
    add('genre-leader', {
      genre: g.genre,
      leader: g.biggest,
      share: g.leaderShare,
      players: g.players
    }, ['genre-share', 'genre-table'], 'Share of the genre held by its biggest game.');
  for (const g of charts['genre-trends'].data) {
    const ps = g.points.map((p: Row) => p.value);
    if (ps.length > 1 && (ps.every((p: number, i: number) => !i || p > ps[i - 1]) || ps.every((p: number, i: number) => !i || p < ps[i - 1])))
      add('genre-direction', {
        genre: g.genre,
        first: ps[0],
        last: lastOf(ps)
      }, ['genre-trends'], 'Genre changed in the same direction every trend week.');
  }
  const rated = top.filter(g => g.rating !== null).sort((a, b) => b.rating! - a.rating!);
  add('newest-vs-rating', {
    newest: top.slice(0, 20).filter(g => g.created).sort((a, b) => (b.created ?? '').localeCompare(a.created ?? ''))[0]?.id ?? null,
    best: rated[0]?.id ?? null,
    worst: lastOf(rated)?.id ?? null,
    bestRating: rated[0]?.rating ?? null,
    worstRating: lastOf(rated)?.rating ?? null
  }, ['rating-vs-size'], 'Newest top twenty game and the rating extremes.');
  for (const u of updates.slice(0, 12))
    add('update-direction', {
      id: u.id,
      date: u.date,
      before: u.before,
      after: u.after,
      change: u.change,
      percent: u.percent,
      beforeTrend: u.beforeTrend,
      afterTrend: u.afterTrend,
      keptDirection: u.keptDirection
    }, ['update-effect'], 'Players before and after a qualifying update.');
  for (const word of ['Brainrot', 'Steal', 'Egg']) {
    const cluster = top.slice(0, 50).filter(g => g.name.toLowerCase().includes(word.toLowerCase()));
    if (cluster.length) {
      const clusterPlayers = sum(cluster.map(g => g.players));
      const benchmark = genreRows.find(g => g.players > 0 && g.players <= clusterPlayers) ?? genreRows.find(g => g.players > 0);
      add('keyword-cluster', {
        word,
        players: clusterPlayers,
        count: cluster.length,
        genre: benchmark?.genre,
        genrePlayers: benchmark?.players
      }, ['top-games', 'genre-share'], 'Shared name keyword compared with a whole genre.');
    }
  }
  const weekend = mean(check.full_days.filter(d => [0, 6].includes(new Date(d).getUTCDay())).map(d => dailyTotals[d])), weekday = mean(check.full_days.filter(d => ![0, 6].includes(new Date(d).getUTCDay())).map(d => dailyTotals[d]));
  add('weekend-uplift', {
    weekend,
    weekday,
    uplift: weekday ? (weekend / weekday - 1) * 100 : null
  }, ['players-daily'], 'Weekend average compared with weekdays.');
  for (let i = 0; i < dates(month).length; i += 7) {
    const ds = dates(month).slice(i, i + 7).filter(d => check.full_days.includes(d));
    if (!ds.length) continue;
    add('daily-stretch', {
      start: ds[0] ?? null,
      players: mean(ds.map(d => dailyTotals[d])),
      previous: comparison.status === 'ready' ? mean(ds.map(d => dates(prev)[+d.slice(8) - 1]).filter(d => comparison.full_days.includes(d)).map(d => dailyTotals[d])) : null
    }, ['players-daily'], 'Average players during this stretch against the previous month pace.');
  }
  const cs = charts.concentration.data;
  add('concentration-change', {
    first: cs[0]?.top10 ?? null,
    last: lastOf(cs)?.top10 ?? null,
    points: cs.length ? lastOf(cs)!.top10 - cs[0].top10 : null
  }, ['concentration'], 'Change in the top ten share across trend weeks.');
  add('visits-vs-players', {
    playersChange: facts.playersChange,
    visitsChange: facts.visitsChange,
    session: facts.session,
    previousSession: oldVisits && previousAvg ? previousAvg * 1440 / (oldVisits / comparison.full_days.length) : null
  }, ['session-length', 'players-daily'], 'Visit growth versus player growth and session length.');
  for (const g of charts['top10-weekly'].data) {
    const ps = g.points.filter((p: Row) => p.rank !== null);
    if (ps.length > 1)
      add('weekly-rank', {
        id: g.id,
        first: ps[0].rank,
        last: lastOf(ps)!.rank,
        change: ps[0].rank - lastOf(ps)!.rank
      }, ['top10-weekly'], 'Weekly rank climb or fall.');
  }
  for (const sub of [...new Set(top.map(g => g.subgenre).filter(Boolean))])
    add('subgenre-cluster', {
      subgenre: sub,
      players: sum(top.filter(g => g.subgenre === sub).map(g => g.players)),
      count: top.filter(g => g.subgenre === sub).length
    }, ['top100', 'genre-table'], 'Subgenre cluster within the top hundred.');
  const stretches = insights.filter(i => i.kind === 'daily-stretch').sort((a, b) => b.values.players - a.values.players);
  if (stretches.length) {
    stretches[0].kind = 'best-stretch';
    stretches[stretches.length - 1].kind = 'worst-stretch';
  }
  const importance = (insight: Row): number => {
    const value = insight.values;
    switch (insight.kind) {
      case 'loss-vs-gains': return 100 + Math.abs(value.loss) / Math.max(1, value.gains);
      case 'leader-vs-runners': return 95 + value.leader / Math.max(1, value.others);
      case 'weekend-uplift': return 90 + Math.abs(value.uplift ?? 0) / 10;
      case 'visits-vs-players': return 85 + Math.abs((value.playersChange ?? 0) - (value.visitsChange ?? 0));
      case 'keyword-cluster': return 80 + value.players / Math.max(1, value.genrePlayers);
      case 'concentration-change': return 75 + Math.abs(value.points ?? 0);
      case 'weekly-rank': return 60 + Math.min(20, Math.abs(value.change));
      case 'update-direction': return 60 + Math.min(20, Math.abs(value.percent ?? 0) / 5);
      case 'genre-direction': return 75;
      case 'genre-leader': return 40 + Math.min(25, value.share / 4);
      case 'newest-vs-rating': return 65;
      case 'best-stretch':
      case 'worst-stretch': return 65;
      default: return 30 + Math.log10(Math.max(1, value.players ?? 1));
    }
  };
  for (const insight of insights)
    insight.summary = insightSentence(insight, games);
  // Keep one leader comparison and only the best/worst daily stretches.
  const candidates = insights.filter(i => i.kind !== 'daily-stretch' && (i.kind !== 'leader-vs-runners' || i.values.throughRank === 3) && (prior.length > 0 || !['loss-vs-gains', 'visits-vs-players', 'best-stretch', 'worst-stretch'].includes(i.kind)));
  candidates.sort((a, b) => importance(b) - importance(a) || a.id.localeCompare(b.id));
  return {
    check: {
      ...check,
      comparison_month: {
        month: prev,
        ...comparison
      },
      omitted_charts: omitted,
      qualifying_update_count: updates.length,
      busiest_hours: {
        valid: heat.valid,
        reason: heat.reason,
        min_coverage: heat.minCoverage,
        max_jump: heat.maxJump,
        failing_cells: heat.failingCells,
        source_rows: hourly.length,
        selected_games: Math.min(1000, current.length)
      }
    },
    facts,
    charts,
    insights: candidates.slice(0, 40),
    games,
    current
  };
}
