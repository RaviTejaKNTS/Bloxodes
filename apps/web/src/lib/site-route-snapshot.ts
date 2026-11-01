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
async function loadRedirectRows(signal: AbortSignal): Promise<RedirectRoute[]> {
  const client = supabaseAdmin();
  const rows: RedirectRoute[] = [];
  async function read(table: string, blockers?: string) {
    let after: string | undefined;
    for (;;) {
      const columns = blockers ? 'path,status,match_type' : 'path,status,match_type,tail_mode,match_self,page_id,page_type,target_url,resolved_target,redirect_code,origin';
      let query = client.from(table).select(columns).order('path').limit(PAGE_SIZE).abortSignal(signal);
      if (blockers) query = query.in('status', ['live', 'gone']).eq('match_type', 'exact').or(blockers);
      if (after) query = query.gt('path', after);
      const { data, error } = await query;
      if (error || !data) throw new Error('Redirect snapshot unavailable');
      if (data.length === 0) break;
      const page = data as unknown as RedirectRoute[];
      rows.push(...page);
      // A short page is the last one; skip the extra empty round trip. PAGE_SIZE
      // stays below the PostgREST row cap (1000) so a capped page never looks short.
      if (page.length < PAGE_SIZE) break;
      after = page[page.length - 1].path;
    }
  }
  await read('site_route_redirects');
  // Exact live/gone paths can only block redirects at/below a prefix. Use
  // lexicographic subtree bounds, avoiding LIKE wildcards in stored paths.
  // Nested prefixes (every /lists/<slug> under /lists) add nothing to the
  // subtree filter; dropping them keeps the request URL short.
  const prefixPaths = rows.filter(row => row.match_type === 'prefix' || (row.page_type === 'collection' && row.page_id !== null)).map(row => row.path);
  const prefixes = prefixPaths
    .filter(path => !prefixPaths.some(other => other !== path && (other === '/' || path.startsWith(other + '/'))))
    .map(path => ({ path }));
  if (prefixes.length) {
    const quote = (value: string) => JSON.stringify(value);
    const filters = prefixes.flatMap(({path}) => path === '/' ? ['path.gte."/"'] : [
      `path.eq.${quote(path)}`,
      `and(path.gte.${quote(path + '/')},path.lt.${quote(path + '0')})`
    ]).join(',');
    await read('site_routes', filters);
  }
  return rows;
}
const cache = createRedirectSnapshotCache(loadRedirectRows);
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
