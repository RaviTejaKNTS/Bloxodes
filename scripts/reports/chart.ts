import fs from 'node:fs/promises';
import path from 'node:path';
import { manifest, json } from './build';
import { ranks, dates, lastOf, players, type Row, type DailyRow } from './model';
const argv = process.argv.slice(2), arg = (s: string) => {
  const i = argv.indexOf(s);
  if (i < 0 || !argv[i + 1] || argv[i + 1].startsWith('--'))
    throw Error(`${s} requires a value`);
  return argv[i + 1];
};
async function main() {
  const root = path.resolve(arg('--data')), id = arg('--id'), kind = arg('--kind');
  if (!/^extra-[a-z0-9-]+$/.test(id))
    throw Error('Extra chart id must begin extra-');
  const m = JSON.parse(await fs.readFile(path.join(root, 'manifest.json'), 'utf8'));
  const extras = Object.keys(m.files).filter(k => k.startsWith('charts/extra-'));
  if (!extras.includes(`charts/${id}.json`) && extras.length >= 3)
    throw Error('At most 3 extra charts');
  const check = JSON.parse(await fs.readFile(path.join(root, 'data-check.json'), 'utf8'));
  const games = JSON.parse(await fs.readFile(path.resolve(root, '../raw/games.json'), 'utf8'));
  async function rawRows(ds: string[]) {
    const rows: DailyRow[] = [];
    for (const d of ds) {
      const file = path.resolve(root, '../raw', `daily-${d}.json`);
      try {
        rows.push(...JSON.parse(await fs.readFile(file, 'utf8')));
      }
      catch {
        throw Error('Extras require the original build raw cache. Run report:chart before copying data into a publication bundle.');
      }
    }
    return rows;
  }
  const monthRows = await rawRows(check.full_days);
  const allRanked = ranks(monthRows, check.full_days).map(g => ({
    ...g,
    ...games[g.id]
  }));
  const chart = async (id: string) => JSON.parse(await fs.readFile(path.join(root, 'charts', id + '.json'), 'utf8')).data;
  let data: Row[];
  let renderKind = kind;
  if (kind === 'game-lines') {
    const ids = arg('--games').split(',').map(Number);
    if (ids.length > 5)
      throw Error('At most 5 games');
    const top = allRanked;
    data = ids.map(id => {
      const g = top.find((r: Row) => r.id === id);
      if (!g)
        throw Error('Game must qualify for the report month');
      const daily = Object.fromEntries(monthRows.filter(r => +r.universe_id === id).map(r => [r.stat_date, players(r)]));
      return {
        id,
        name: g.name,
        points: dates(m.month).map(date => ({
          date,
          value: daily[date] ?? null
        }))
      };
    });
    renderKind = 'lines';
  }
  else if (kind === 'genre-lines') {
    const names = arg('--genres').split(',');
    if (names.length > 5)
      throw Error('At most 5 genres');
    const weeks = (await chart('concentration')).map((w: Row) => w.week);
    data = await Promise.all(names.map(async (genre) => {
      if (!Object.values(games).some((g: Row) => g.genre === genre))
        throw Error('Unknown genre');
      const points = [];
      for (const week of weeks) {
        const ds = Array.from({
          length: 7
        }, (_, i) => new Date(Date.parse(week) + i * 86400000).toISOString().slice(0, 10)).filter(d => d <= lastOf(dates(m.month))!);
        const rows = await rawRows(ds);
        const counts = Object.fromEntries(ds.map(d => [d, rows.filter(r => r.stat_date === d).length]));
        const monthCounts: Row = {};
        const cacheFiles = await fs.readdir(path.resolve(root, '../raw'));
        for (const file of cacheFiles.filter(f => /^daily-/.test(f) && ds.some(d => f.includes(d.slice(0, 7))))) {
          const d = file.slice(6, 16);
          monthCounts[d] = JSON.parse(await fs.readFile(path.resolve(root, '../raw', file), 'utf8')).length;
        }
        const full = ds.filter(d => {
          const ns = Object.entries(monthCounts).filter(([date]) => date.startsWith(d.slice(0, 7))).map(([, n]) => n).filter(n => n > 0).sort((a: number, b: number) => a - b) as number[];
          const mid = Math.floor(ns.length / 2);
          const median = ns.length % 2 ? ns[mid] : (ns[mid - 1] + ns[mid]) / 2;
          return counts[d] >= median * .9;
        });
        points.push({
          week,
          value: ranks(rows, full).filter(g => games[g.id]?.genre === genre).reduce((a, g) => a + g.players, 0)
        });
      }
      return {
        genre,
        points
      };
    }));
    renderKind = 'multiples';
  }
  else if (kind === 'top-list' || kind === 'compare-bars') {
    const metric = arg('--metric');
    if (!['players', 'visits', 'rating', 'session'].includes(metric))
      throw Error('Invalid metric');
    let rows = allRanked;
    if (kind === 'compare-bars') {
      const ids = arg('--games').split(',').map(Number);
      rows = rows.filter((r: Row) => ids.includes(r.id));
      if (rows.length !== ids.length)
        throw Error('Game missing from monthly ranked games');
    }
    else {
      const limit = +arg('--limit');
      if (!(limit >= 1 && limit <= 20))
        throw Error('Limit must be 1..20');
      if (argv.includes('--genre'))
        rows = rows.filter((r: Row) => r.genre === arg('--genre'));
      rows = rows.filter((r: Row) => r[metric] !== null).sort((a: Row, b: Row) => b[metric] - a[metric]).slice(0, limit);
    }
    data = rows.map((r: Row) => ({
      ...r,
      value: r[metric]
    }));
    renderKind = 'hbar';
  }
  else
    throw Error('Unsupported chart kind');
  await fs.writeFile(path.join(root, 'charts', id + '.json'), json({
    id,
    kind: renderKind,
    data
  }));
  const selected = JSON.parse(await fs.readFile(path.join(root, 'games.json'), 'utf8'));
  const { referencedGames } = await import('./writer-notes');
  Object.assign(selected, referencedGames({
    [id]: {
      data
    }
  }, [], games));
  await fs.writeFile(path.join(root, 'games.json'), json(selected));
  await manifest(root, m.month, m.source_sha);
  console.log(`Wrote charts/${id}.json from frozen data`);
}
main().catch(e => {
  console.error(e.message);
  process.exitCode = 1;
});
