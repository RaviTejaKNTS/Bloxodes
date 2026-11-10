import { referencedGames, writerNotes } from './writer-notes';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { loadBloxodesEnv } from '../shared/env-files';
import { buildModel, dates, day, lastOf, ranks, coverage, players, type Row, type DailyRow } from './model';
export const hash = (v: Buffer | string) => createHash('sha256').update(v).digest('hex');
export const json = (v: unknown) => JSON.stringify(v, null, 2) + '\n';
export function dataFileHash(file: string, bytes: Buffer) {
  if (file !== 'data-check.json')
    return hash(bytes);
  const value = JSON.parse(bytes.toString());
  delete value.built_at;
  return hash(json(value));
}
export async function manifest(root: string, month: string, sha: string) {
  const files: Record<string, string> = {};
  for (const file of ['data-check.json', 'facts.json', 'games.json', 'insights.json', 'writer-notes.md', ...(await fs.readdir(path.join(root, 'charts'))).sort().map(f => 'charts/' + f)])
    files[file] = dataFileHash(file, await fs.readFile(path.join(root, file)));
  await fs.writeFile(path.join(root, 'manifest.json'), json({
    contract: 'stats-report-data@1',
    month,
    built_at: new Date().toISOString(),
    source_sha: sha,
    hash_exclusions: {
      'data-check.json': ['built_at']
    },
    files
  }));
}
async function sourceSha() {
  const root = path.resolve(import.meta.dirname, '../..'), marker = path.join(root, '.git');
  const gitDir = (await fs.stat(marker)).isDirectory() ? marker : path.resolve(root, (await fs.readFile(marker, 'utf8')).replace(/^gitdir:\s*/, '').trim());
  const head = (await fs.readFile(path.join(gitDir, 'HEAD'), 'utf8')).trim();
  if (/^[a-f0-9]{40}$/.test(head))
    return head;
  const ref = head.replace(/^ref:\s*/, '');
  let common = gitDir;
  try {
    common = path.resolve(gitDir, (await fs.readFile(path.join(gitDir, 'commondir'), 'utf8')).trim());
  }
  catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
      throw error;
  }
  for (const dir of [gitDir, common]) {
    try {
      const sha = (await fs.readFile(path.join(dir, ref), 'utf8')).trim();
      if (/^[a-f0-9]{40}$/.test(sha))
        return sha;
    }
    catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        throw error;
    }
  }
  const packed = await fs.readFile(path.join(common, 'packed-refs'), 'utf8');
  const entry = packed.split('\n').find(line => line.endsWith(' ' + ref));
  if (!entry || !/^[a-f0-9]{40} /.test(entry))
    throw Error('Cannot resolve source Git SHA');
  return entry.slice(0, 40);
}
async function main() {
  const argv = process.argv.slice(2), arg = (s: string) => {
    const i = argv.indexOf(s);
    if (i < 0 || !argv[i + 1] || argv[i + 1].startsWith('--'))
      throw Error(`${s} requires a value`);
    return argv[i + 1];
  };
  const month = arg('--month');
  dates(month);
  if (!path.isAbsolute(arg('--out')))
    throw Error('--out must be absolute');
  const out = path.resolve(arg('--out'));
  if (!argv.includes('--allow-prod-read'))
    throw Error('Production reads require --allow-prod-read');
  process.env.BLOXODES_ENV_PROFILE = 'production-preview';
  loadBloxodesEnv();
  if (process.env.SUPABASE_URL?.replace(/\/$/, '') !== 'https://database.bloxodes.com')
    throw Error('production-preview must select production');
  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
  const raw = path.join(out, 'raw');
  await fs.mkdir(raw, {
    recursive: true
  });
  const readPrior = async (file: string) => {
    try {
      return JSON.parse(await fs.readFile(file, 'utf8'));
    }
    catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        return null;
      throw error;
    }
  };
  const priorCheck = await readPrior(path.join(out, 'data/data-check.json'));
  const priorManifest = await readPrior(path.join(out, 'data/manifest.json'));
  const priorContext = await readPrior(path.join(raw, 'context.json'));
  const priorMonth = priorContext?.month ?? priorManifest?.month;
  if (priorMonth && priorMonth !== month || priorCheck && priorCheck.status !== 'ready') {
    for (const file of await fs.readdir(raw))
      if (/^(?:daily-\d{4}-\d{2}-\d{2}|hours-[0-9a-f]+|universes|updates)\.json$/.test(file))
        await fs.unlink(path.join(raw, file));
    console.log('Refreshing incomplete or different-month source caches.');
  }
  await fs.writeFile(path.join(raw, 'context.json'), json({
    contract: 'stats-report-data@1',
    month
  }));
  async function cached(name: string, query: () => {
    range(from: number, to: number): PromiseLike<{
      data: Row[] | null;
      error: {
        message: string;
      } | null;
    }>;
  }) {
    const file = path.join(raw, name + '.json');
    try {
      return JSON.parse(await fs.readFile(file, 'utf8'));
    }
    catch {
    }
    const all: Row[] = [];
    for (let offset = 0; ;) {
      // Production reads can hit a gateway timeout under load. Retry a page a few times, then fail.
      let page: Awaited<ReturnType<ReturnType<typeof query>['range']>> | undefined;
      for (let attempt = 1; attempt <= 3; attempt++) {
        page = await query().range(offset, offset + 999);
        if (!page.error)
          break;
        if (attempt < 3)
          await new Promise(resolve => setTimeout(resolve, attempt * 10_000));
      }
      if (page!.error)
        throw Error(`${name}: ${page!.error.message.slice(0, 300)}`);
      const data = page!.data;
      if (!data?.length)
        break;
      all.push(...data);
      offset += data.length;
    }
    // Write under a temporary name and rename, so a killed run never leaves a half-written cache.
    await fs.writeFile(file + '.tmp', JSON.stringify(all));
    await fs.rename(file + '.tmp', file);
    return all;
  }
  const end = day(lastOf(dates(month))!, 8);
  let start = day(lastOf(dates(month))!, -97);
  if (start < '2026-08-10')
    start = '2026-08-10';
  const previousFirst = day(month + '-01', -1).slice(0, 7) + '-01';
  if (start > previousFirst)
    start = previousFirst;
  const ds: string[] = [];
  for (let d = start; d <= end; d = day(d, 1))
    ds.push(d);
  const daily: DailyRow[] = [];
  let next = 0;
  await Promise.all(Array
    .from({
      length: 12
    }, async () => {
      while (next < ds.length) {
        const d = ds[next++];
        const rs = await cached('daily-' + d, () => db
          .from('roblox_universe_stats_daily')
          .select('universe_id,stat_date,avg_playing,playing,peak_playing,visit_delta,likes_end,likes,dislikes_end,dislikes')
          .eq('stat_date', d)
          .order('universe_id'));
        daily.push(...rs.map((r: Row) => ({
          universe_id: +r.universe_id,
          stat_date: d,
          avg_playing: players(r),
          peak_playing: Number(r.peak_playing ?? r.playing ?? 0),
          visit_delta: Number(r.visit_delta ?? 0),
          likes_end: Number(r.likes_end ?? r.likes ?? 0),
          dislikes_end: Number(r.dislikes_end ?? r.dislikes ?? 0)
        })));
        console.log(`${d}: ${rs.length} daily rows`);
      }
    }));
  daily.sort((a, b) => a.stat_date.localeCompare(b.stat_date) || Number(a.universe_id) - Number(b.universe_id));
  const universes = await cached('universes', () => db
    .from('roblox_universes')
    .select('universe_id,name,display_name,slug,genre_l1,genre_l2,created_at_api')
    .order('universe_id'));
  const counts: Record<string, number> = {};
  for (const r of daily)
    counts[r.stat_date] = (counts[r.stat_date] ?? 0) + 1;
  const ranked = ranks(daily, coverage(month, counts).full_days);
  const ids = ranked.slice(0, 1000).map(g => g.id);
  const hourly: Row[] = [];
  const batches = Array
    .from({
      length: Math.ceil(ids.length / 50)
    }, (_, i) => i * 50);
  let nextBatch = 0;
  await Promise.all(Array
    .from({
      length: 2
    }, async () => {
      while (nextBatch < batches.length) {
        const i = batches[nextBatch++], batch = ids.slice(i, i + 50);
        // Key the cache by the batch's game IDs: the ranking can change between builds.
        hourly.push(...await cached(`hours-${hash(Buffer.from(batch.join(','))).slice(0, 16)}`, () => db
          .from('roblox_universe_stats_hourly')
          .select('universe_id,hour_start,avg_playing,playing')
          .in('universe_id', batch)
          .gte('hour_start', month + '-01')
          .lt('hour_start', day(lastOf(dates(month))!, 1))
          .order('universe_id')
          .order('hour_start')));
        console.log(`Hourly games ${i + batch.length}/${ids.length}`);
      }
    }));
  const updates = await cached('updates', () => db
    .from('roblox_universe_update_events')
    .select('id,universe_id,updated_at_api')
    .in('universe_id', ids.slice(0, 100))
    .gte('updated_at_api', day(month + '-01', -8))
    .lte('updated_at_api', end)
    .order('updated_at_api')
    .order('id'));
  hourly.sort((a, b) => Number(a.universe_id) - Number(b.universe_id) || a.hour_start.localeCompare(b.hour_start));
  const result = buildModel(month, daily, universes, updates, hourly);
  await fs.writeFile(path.join(raw, 'games.json'), json(result.games));
  result.games = referencedGames(result.charts, result.insights, result.games);
  const sha = await sourceSha();
  const root = path.join(out, 'data');
  await fs.mkdir(path.join(root, 'charts'), {
    recursive: true
  });
  for (const file of await fs.readdir(path.join(root, 'charts')))
    if (/^[a-z0-9-]+\.json$/.test(file))
      await fs.unlink(path.join(root, 'charts', file));
  const source_max_dates = {
    daily: lastOf(daily)?.stat_date ?? null,
    hourly: lastOf(hourly.map(r => r.hour_start).sort()) ?? null,
    updates: lastOf(updates)?.updated_at_api ?? null
  };
  for (const [file, value] of Object.entries({
    'data-check': {
      ...result.check,
      source_max_dates,
      git_sha: sha,
      built_at: new Date().toISOString()
    },
    facts: result.facts,
    games: result.games,
    insights: result.insights
  }))
    await fs.writeFile(path.join(root, file + '.json'), json(value));
  for (const [id, chart] of Object.entries(result.charts))
    await fs.writeFile(path.join(root, 'charts', id + '.json'), json(chart));
  await fs.writeFile(path.join(root, 'writer-notes.md'), writerNotes(month, result));
  await manifest(root, month, sha);
  console.log(json(result.check));
  if (result.check.status !== 'ready')
    process.exitCode = 2;
}
if (process.argv[1]?.endsWith('/build.ts'))
  main().catch(e => {
    console.error(e.message);
    process.exitCode = 1;
  });
