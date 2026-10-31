import { describe, expect, it, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync } from 'node:fs';
import fixture from '../../../../../scripts/routes/fixtures/phase-2-redirects.json';
import { phase2RedirectRows } from '../../../../../scripts/routes/phase-2-seed';
import { buildRedirectSnapshot, resolveSiteRoute, siteRouteTarget, type RedirectRoute } from '../site-route-resolver';
vi.mock('server-only', () => ({}));
vi.mock('../supabase-admin', () => ({supabaseAdmin: vi.fn()}));
const state = vi.hoisted(() => ({snapshot: undefined as ReturnType<typeof buildRedirectSnapshot> | undefined}));
vi.mock('../site-route-snapshot', async importOriginal => {
  const actual = await importOriginal<typeof import('../site-route-snapshot')>();
  return {...actual, readRedirectSnapshot: () => state.snapshot};
});
import { proxy } from '../../proxy';
import { createRedirectSnapshotCache, SITE_ROUTE_SNAPSHOT_TTL } from '../site-route-snapshot';
const rows = phase2RedirectRows();
state.snapshot = buildRedirectSnapshot(rows);
const base = 'http://localhost:3000';
afterEach(() => { vi.restoreAllMocks(); state.snapshot = buildRedirectSnapshot(rows); });
describe('frozen Phase 2 behavior against migration seed', () => {
  it('captures every removed root alias', () => {
    expect(fixture.counts).toEqual({articles:12,legacyCodeSlugs:360,retiredLists:61});
    expect(rows.filter(r=>r.origin==='slug_oldslugs')).toHaveLength(360);
  });
  for (const entry of fixture.cases) it(entry.url, async () => {
    // Next's configured redirect stage handles trailing slashes before middleware.
    if (entry.url.split('?')[0].endsWith('/')) {
      expect(entry.status).toBe(308);
      const expected = new URL(entry.location!, fixture.origin);
      const target = new URL(entry.url.replace(/\/(?=\?|$)/,''), fixture.origin);
      expect(expected.pathname + expected.search).toBe(target.pathname + target.search);
      return;
    }
    // Next's HTTP server rebuilds middleware's query from its parsed query
    // object. Preserve key order, group duplicates, and use URLSearchParams.
    const requestUrl = new URL(entry.url, base);
    const incoming = requestUrl.searchParams;
    const grouped = new URLSearchParams();
    for (const key of new Set(incoming.keys())) for (const value of incoming.getAll(key)) grouped.append(key, value);
    requestUrl.search = grouped.toString();
    const request = new NextRequest(requestUrl);
    const response = (await proxy(request));
    expect(response.status).toBe(entry.status);
    const actual = response.headers.get('location');
    if (entry.location === null) { expect(actual).toBeNull(); return; }
    expect(actual).toMatch(/^https?:\/\//);
    const expected = new URL(entry.location, new URL(entry.url, fixture.origin));
    const resolved = new URL(actual!, new URL(entry.url, base));
    expect(resolved.pathname + resolved.search).toBe(expected.pathname + expected.search);
    expect(resolved.host).toBe(expected.host === new URL(fixture.origin).host ? new URL(base).host : expected.host);
  });
});
it('exact priority, segment boundaries, match_self, tails and nonredirect statuses', () => {
  const prefix = rows.find(r=>r.path==='/lists')!;
  const append = {...prefix,path:'/old',tail_mode:'append' as const,target_url:'/new',match_self:false};
  const exact = {...append,path:'/old/deep',match_type:'exact' as const,match_self:true,target_url:'/exact'};
  const snapshot = buildRedirectSnapshot([append,exact,{...exact,path:'/live',status:'live'},{...exact,path:'/gone',status:'gone'}]);
  expect(resolveSiteRoute(snapshot,'/old')).toBeNull();
  expect(resolveSiteRoute(snapshot,'/older')).toBeNull();
  expect(resolveSiteRoute(snapshot,'/old/deep')?.target).toBe('/exact');
  expect(resolveSiteRoute(snapshot,'/old/deep/more')?.target).toBe('/new/deep/more');
  expect(resolveSiteRoute(snapshot,'/live')?.target).toBeNull();
  expect(resolveSiteRoute(snapshot,'/gone')?.target).toBeNull();
  const free=rows.find(r=>r.tail_mode==='free-items')!;
  expect(siteRouteTarget(free,free.path+'/a/b/c/d/e')).toBeNull();
});
it('cold readers await one load; warm refresh retains old targets and failures', async () => {
  let now = 0;
  const alias: RedirectRoute = {...rows[0], path:'/codes/previous', match_type:'exact', page_id:'owner', resolved_target:'/codes/current'};
  const load = vi.fn().mockResolvedValue([alias]);
  const cache = createRedirectSnapshotCache(load, () => now);
  const work: Promise<void>[] = [];
  const read = () => cache.read(p => work.push(p));
  const [first, second] = await Promise.all([read(), read()]);
  expect(load).toHaveBeenCalledTimes(1);
  expect(first).toBe(second);
  expect(resolveSiteRoute(first, alias.path)?.target).toBe('/codes/current');
  now = SITE_ROUTE_SNAPSHOT_TTL + 1;
  let complete!: (rows: RedirectRoute[]) => void;
  load.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  expect(resolveSiteRoute(await read(), alias.path)?.target).toBe('/codes/current');
  complete([{...alias, resolved_target:'/codes/renamed'}]);
  await work[work.length - 1];
  expect(resolveSiteRoute(await read(), alias.path)?.target).toBe('/codes/renamed');
  now += SITE_ROUTE_SNAPSHOT_TTL + 1;
  load.mockRejectedValue(new Error('secret must not be logged'));
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  await read(); await work[work.length - 1];
  expect(resolveSiteRoute(await read(), alias.path)?.target).toBe('/codes/renamed');
  expect(log.mock.calls.flat().join(' ')).not.toContain('secret must');
});
it('cold timeout fails open at 2 seconds and retries after 2 then 4 seconds', async () => {
  vi.useFakeTimers();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const load = vi.fn().mockImplementation(() => new Promise(() => {}));
    const cache = createRedirectSnapshotCache(load);
    const first = cache.read();
    await vi.advanceTimersByTimeAsync(1_999);
    expect(load).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect((await first).exact.size).toBe(0);
    await cache.read(); expect(load).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2_000);
    const second = cache.read();
    await vi.advanceTimersByTimeAsync(2_000);
    expect((await second).exact.size).toBe(0);
    await vi.advanceTimersByTimeAsync(3_999);
    await cache.read(); expect(load).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    load.mockResolvedValue(rows);
    expect((await cache.read()).exact.size).toBeGreaterThan(0);
    expect(load).toHaveBeenCalledTimes(3);
  } finally { vi.useRealTimers(); }
});
it('forbidden former runtime sources are gone', () => {
  const source=readFileSync(new URL('../../proxy.ts',import.meta.url),'utf8');
  expect(source).not.toMatch(/ARTICLE_REDIRECT_SLUGS|slug_oldslugs\.json/);
});
it('canonical host and root aliases preserve their combined redirect', async () => {
  const response=(await proxy(new NextRequest('https://www.bloxodes.com/all-fisch-enchantments-guide?x=a%20b')));
  expect(response.status).toBe(301);
  expect(response.headers.get('location')).toBe('https://bloxodes.com/articles/all-fisch-enchantments-guide?x=a%20b');
  const minecraft=(await proxy(new NextRequest('https://www.bloxodes.com/minecraft/wiki/mobs?edition=bedrock')));
  expect(minecraft.status).toBe(301);
  expect(minecraft.headers.get('location')).toBe('https://bloxodes.com/minecraft/wiki/mobs?edition=bedrock');
});
it('codes namespace aliases are now handled by the registry without root normalization', async () => {
  const owner={...rows[0],path:'/codes/previous-name',page_id:'page-id',target_url:null,resolved_target:'/codes/current-name',redirect_code:301};
  state.snapshot=buildRedirectSnapshot([owner]);
  const response=(await proxy(new NextRequest(base+'/codes/previous-name?ref=old')));
  expect(response.status).toBe(301);
  expect(response.headers.get('location')).toBe(base+'/codes/current-name?ref=old');
  expect((await proxy(new NextRequest(base+'/codes/PREVIOUS-NAME'))).headers.get('location')).toBeNull();
});
it('former config rules retain their priority over canonical-host correction', async () => {
  const pizza=(await proxy(new NextRequest('https://www.bloxodes.com/catalog/roblox-music-ids/games/work-at-a-pizza-place/deep?ref=a')));
  expect(pizza.status).toBe(308);
  expect(pizza.headers.get('location')).toBe('https://www.bloxodes.com/catalog/roblox-music-ids?ref=a');
  const ads=(await proxy(new NextRequest('https://www.bloxodes.com/ads.txt?ref=a')));
  expect(ads.status).toBe(301);
  expect(ads.headers.get('location')).toContain('https://adstxt.mediavine.com/');
});
it('failed cold load retries after 2 seconds, without rejecting requests', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  let now = 0;
  const load = vi.fn().mockRejectedValue(new Error('unavailable'));
  const cache = createRedirectSnapshotCache(load, () => now);
  expect((await cache.read()).exact.size).toBe(0);
  await cache.read(); expect(load).toHaveBeenCalledTimes(1);
  now = 2_000;
  load.mockResolvedValue(rows);
  expect((await cache.read()).exact.size).toBeGreaterThan(0);
  expect(load).toHaveBeenCalledTimes(2);
});
