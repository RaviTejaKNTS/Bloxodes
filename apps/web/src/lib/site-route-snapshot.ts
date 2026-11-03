import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { loadPublishedMovedGamePages, MOVED_PAGE_KINDS } from "./published-moved-game-pages";
import { buildRedirectSnapshot, type RedirectRoute, type RedirectSnapshot } from './site-route-resolver';

export const SITE_ROUTE_SNAPSHOT_TTL = 5 * 60_000;
export const SITE_ROUTE_INITIAL_TIMEOUT = 2_000;
export const SITE_ROUTE_INITIAL_RETRY = 2_000;
const PAGE_SIZE = 500;
/** Cold readers share a bounded initial load; warm readers use stale-while-revalidate. */
export function createRedirectSnapshotCache(load: (signal: AbortSignal) => Promise<RedirectRoute[]>, now = Date.now, initialTimeout = SITE_ROUTE_INITIAL_TIMEOUT) {
  let snapshot: RedirectSnapshot = buildRedirectSnapshot([]);
  let loaded = false;
  let failures = 0;
  let nextRefresh = 0;
  let refreshing: Promise<void> | undefined;
  return {
    isLoaded: () => loaded,
    async read(background?: (work: Promise<void>) => void) {
      if (!refreshing && now() >= nextRefresh) {
        const controller = new AbortController();
        const timeout = loaded ? 15_000 : initialTimeout;
        let timer: ReturnType<typeof setTimeout>;
        const deadline = new Promise<never>((_, reject) => {
          timer = setTimeout(() => { controller.abort(); reject(new Error('Redirect snapshot timed out')); }, timeout);
        });
        refreshing = Promise.race([Promise.resolve().then(() => load(controller.signal)), deadline]).then(rows => {
          snapshot = buildRedirectSnapshot(rows);
          loaded = true;
          failures = 0;
        }).catch(() => {
          failures++;
          // Transport errors may contain credentials. Never log their details.
          console.error('[site-routes] Redirect snapshot refresh failed; retaining last good snapshot.');
        }).finally(() => {
          clearTimeout(timer!);
          nextRefresh = now() + (loaded ? SITE_ROUTE_SNAPSHOT_TTL : Math.min(30_000, SITE_ROUTE_INITIAL_RETRY * 2 ** Math.min(failures - 1, 4)));
          refreshing = undefined;
        });
      }
      if (refreshing) {
        background?.(refreshing);
        if (!loaded) await refreshing;
      }
      return snapshot;
    }
  };
}
const REDIRECT_COLUMNS = 'path,status,match_type,tail_mode,match_self,page_id,page_type,target_url,resolved_target,redirect_code,origin';
// Two parallel rounds, so a cold load stays well inside the initial deadline
// however many redirects exist: resolved_target is computed per row, which
// makes each page slow, and reading pages one after another timed out.
async function loadRedirectRows(signal: AbortSignal): Promise<RedirectRoute[]> {
  const client = supabaseAdmin();
  const unavailable = () => new Error('Redirect snapshot unavailable');
  // Round 1: the redirect count (cheap, base table) and the few prefix rules.
  const [counted, prefixRows] = await Promise.all([
    client.from('site_routes').select('path', { count: 'exact', head: true }).eq('status', 'old').abortSignal(signal),
    client.from('site_routes').select('path').eq('status', 'old').eq('match_type', 'prefix').abortSignal(signal)
  ]);
  if (counted.error || counted.count == null || prefixRows.error || !prefixRows.data) throw unavailable();
  // Exact live/gone paths can only block redirects at/below a prefix. Use
  // lexicographic subtree bounds, avoiding LIKE wildcards in stored paths.
  // Nested prefixes (every /lists/<slug> under /lists) add nothing, and old
  // collection rows redirect only their exact path and /page/<n>, where no
  // live page exists, so neither belongs in this filter.
  const prefixPaths = prefixRows.data.map(row => row.path as string);
  const prefixes = prefixPaths.filter(path => !prefixPaths.some(other => other !== path && (other === '/' || path.startsWith(other + '/'))));
  const quote = (value: string) => JSON.stringify(value);
  const blockerFilter = prefixes.flatMap(path => path === '/' ? ['path.gte."/"'] : [
    `path.eq.${quote(path)}`,
    `and(path.gte.${quote(path + '/')},path.lt.${quote(path + '0')})`
  ]).join(',');
  // Round 2: every page of resolved redirects plus the blockers. One spare
  // page absorbs rows added since the count; the next refresh settles the rest.
  const pageCount = Math.ceil(counted.count / PAGE_SIZE) + 1;
  type Read = { data: unknown; error: unknown };
  // Query builders are cast once here: their generic types are too deep to mix in one array.
  const loose = (read: unknown) => Promise.resolve(read as PromiseLike<Read>).then(({ data, error }): Read => ({ data, error }));
  const pageReads = Array.from({ length: pageCount }, (_, index) => loose(
    client.from('site_route_redirects').select(REDIRECT_COLUMNS).order('path')
      .range(index * PAGE_SIZE, (index + 1) * PAGE_SIZE - 1).abortSignal(signal)));
  const blockerRead = blockerFilter
    ? loose(client.from('site_routes').select('path,status,match_type').in('status', ['live', 'gone']).eq('match_type', 'exact')
      .or(blockerFilter).order('path').range(0, PAGE_SIZE - 1).abortSignal(signal))
    : Promise.resolve<Read>({ data: [], error: null });
  const results = await Promise.all([...pageReads, blockerRead]);
  const rows = new Map<string, RedirectRoute>();
  for (const { data, error } of results) {
    if (error || !Array.isArray(data)) throw unavailable();
    for (const row of data as RedirectRoute[]) rows.set(row.path, row);
  }
  return [...rows.values()];
}
// The first request in a fresh process waits for redirects. ~1,600 rows take
// two parallel rounds; 2 seconds left no margin for database latency.
export const REDIRECT_INITIAL_TIMEOUT = 5_000;
const cache = createRedirectSnapshotCache(loadRedirectRows, Date.now, REDIRECT_INITIAL_TIMEOUT);
export const readRedirectSnapshot = cache.read;

// Policy refresh has its own timeout, last-good state and failure handling.
// Never await it on a redirect request, including the first cold request.
export function createGameIndexPolicyCache(load: (signal: AbortSignal) => Promise<RedirectRoute[]>, now = Date.now) {
  const cache = createRedirectSnapshotCache(load, now, 15_000);
  let paths: ReadonlySet<string> | undefined;
  return async (background?: (work: Promise<void>) => void, waitForInitial = false): Promise<ReadonlySet<string>> => {
    const work = cache.read(background).then(snapshot => {
      if (cache.isLoaded()) paths = snapshot.indexableGamePaths;
    });
    background?.(work);
    if (waitForInitial && !paths) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([work, new Promise<void>(resolve => { timer = setTimeout(resolve, SITE_ROUTE_INITIAL_TIMEOUT); })]);
      } finally {
        clearTimeout(timer);
      }
    }
    return paths ?? new Set();
  };
}
export async function loadGameIndexPolicyRows(signal: AbortSignal): Promise<RedirectRoute[]> {
  const client = supabaseAdmin();
  const rows: RedirectRoute[] = [];
  for (const kind of MOVED_PAGE_KINDS) {
    const pages = await loadPublishedMovedGamePages(client, kind, signal);
    if (signal.aborted) throw new Error("Game policy timed out");
    for (let start = 0; start < pages.length; start += 200) {
      const batch = pages.slice(start, start + 200);
      const { data, error } = await client.from("site_routes")
        .select("path,page_id").eq("source", "game").eq("status", "live").eq("page_type", kind)
        .in("path", batch.map(page => page.canonical_path)).abortSignal(signal);
      if (error) throw new Error("Published game policy routes unavailable");
      const published = new Map(batch.map(page => [page.canonical_path, page.id]));
      for (const route of data ?? []) {
        if (published.get(route.path) === route.page_id) rows.push({ path: route.path, status: "live", match_type: "exact", indexableGamePath: true } as RedirectRoute);
      }
    }
  }
  return rows;
}
export const readGameIndexPaths = createGameIndexPolicyCache(loadGameIndexPolicyRows);
