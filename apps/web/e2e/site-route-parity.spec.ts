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

test('live pages never redirect, across every registered page type', async ({request}) => {
  test.setTimeout(240_000);
  if(process.env.GITHUB_ACTIONS!=='true') throw new Error('Managed route parity must run on GitHub');
  const url=process.env.SUPABASE_URL!;
  expect(new URL(url).hostname).toBe('bbtcaurrtyoukvjbxbbj.supabase.co');
  const client=createClient(url,process.env.SUPABASE_SERVICE_ROLE!,{auth:{persistSession:false,autoRefreshToken:false}});
  const types=[...['code','article','wiki','collection','quiz','checklist','tool','event','catalog','puzzle'].map(type=>['roblox',type]),
    ...['hub','wiki','collection','code','tool','map','quiz','checklist','catalog'].map(type=>['game',type])];
  const covered:string[]=[];
  for(const [source,type] of types) {
    // Live rows include drafts, so a sampled page may 404. It must never redirect.
    const {data:routes,error}=await client.from('site_routes').select('path').eq('status','live').eq('match_type','exact').eq('source',source).eq('page_type',type).order('path').limit(20);
    expect(error,`${source}/${type}`).toBeNull();
    let sampled=0;
    for(const route of routes??[]) {
      // Known Minecraft live/redirect conflicts stay with minecraftLegacyRedirect.
      if(route.path==='/minecraft/wiki'||route.path.startsWith('/minecraft/wiki/')) continue;
      const response=await request.get(route.path,{maxRedirects:0});
      expect([200,404],`${source}/${type} ${route.path}`).toContain(response.status());
      if(++sampled===3) break;
    }
    covered.push(`${source}/${type}: ${sampled}`);
  }
  console.log(`Live route samples: ${covered.join(', ')}`);
});
