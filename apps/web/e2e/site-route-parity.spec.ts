import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import fixture from '../../../scripts/routes/fixtures/phase-2-redirects.json';

// Real production build, real middleware, managed-development route rows.
// No injected snapshot, catalog fetch fixture, content write, or production access.
test('all frozen redirects preserve status and Location against managed development', async ({request, baseURL}) => {
  test.setTimeout(240_000);
  const origin = baseURL!;
  for (const entry of fixture.cases) {
    const response=await request.get(entry.url,{maxRedirects:0});
    expect(response.status(),entry.url).toBe(entry.status);
    const actual = response.headers().location;
    if (entry.location === null) { expect(actual, entry.url).toBeUndefined(); continue; }
    const expected = new URL(entry.location, new URL(entry.url, fixture.origin));
    const resolved = new URL(actual!, new URL(entry.url, origin));
    expect(resolved.pathname + resolved.search, entry.url).toBe(expected.pathname + expected.search);
    expect(resolved.host, entry.url).toBe(expected.host === new URL(fixture.origin).host ? new URL(origin).host : expected.host);
  }
});

test('published live pages still render across every registered page type', async ({request}) => {
  test.setTimeout(240_000);
  if(process.env.GITHUB_ACTIONS!=='true') throw new Error('Managed route parity must run on GitHub');
  const url=process.env.SUPABASE_URL!;
  expect(new URL(url).hostname).toBe('bbtcaurrtyoukvjbxbbj.supabase.co');
  const client=createClient(url,process.env.SUPABASE_SERVICE_ROLE!,{auth:{persistSession:false,autoRefreshToken:false}});
  // Sample published owners, since site_routes intentionally also registers drafts.
  const tables=[['code_pages','code'],['articles','article'],['wiki_pages','wiki'],['wiki_collection_pages','collection'],['quiz_pages','quiz'],['checklist_pages','checklist'],['tools','tool'],['events_pages','event'],['catalog_pages','catalog'],
    ...['wiki','collection','code','tool','map','quiz','checklist','catalog'].map(kind=>[`game_${kind}_pages`,kind])];
  for(const [table,type] of tables) {
    const {data:owners,error}=await client.from(table).select('id').eq('is_published',true).order('id').limit(10);
    expect(error,table).toBeNull();
    // Some shared page types have no published development content.
    if(!owners?.length) continue;
    const source=table.startsWith('game_')?'game':'roblox';
    const {data:routes,error:routeError}=await client.from('site_routes').select('path').eq('status','live').eq('source',source).eq('page_type',type).in('page_id',owners.map(row=>String(row.id))).order('path');
    expect(routeError,table).toBeNull();
    // Retired catalog owners have intentionally no live route.
    if(table!=='catalog_pages') expect(routes?.length,table).toBeGreaterThan(0);
    let sampled=0;
    for(const route of routes??[]) {
      // Known Phase 2 Minecraft live/redirect conflicts are explicitly excluded.
      if(route.path==='/minecraft/wiki'||route.path.startsWith('/minecraft/wiki/')) continue;
      const response=await request.get(route.path,{maxRedirects:0});
      expect(response.status(),`${table} ${route.path}`).toBe(200);
      if(++sampled===2) break;
    }
  }
});
