import {afterEach, describe, expect, it, vi} from 'vitest';
import {CodeSourcesUnavailableError, scrapeSources} from '../scraper';

afterEach(()=>vi.unstubAllGlobals());
describe('code-source availability',()=>{
  it('tries a second provider after a retired source and reports the incomplete scrape',async()=>{
    vi.stubGlobal('fetch',vi.fn(async(input: string|URL|Request)=>new Response('',{status:String(input).includes('robloxden.com')?404:200})));
    const result=await scrapeSources(['https://robloxden.com/game-codes/removed','https://beebom.com/example-codes/'],{allowPartial:true});
    expect(result.sourceFailures).toHaveLength(1);
    expect(result.sourceFailures?.[0].url).toContain('robloxden.com');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
  it('distinguishes a retired source from a provider outage',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>new Response('',{status:404})));
    await expect(scrapeSources(['https://robloxden.com/game-codes/removed'],{allowPartial:true})).rejects.toBeInstanceOf(CodeSourcesUnavailableError);
    vi.stubGlobal('fetch',vi.fn(async()=>new Response('',{status:403})));
    await expect(scrapeSources(['https://robloxden.com/game-codes/removed'],{allowPartial:true})).rejects.not.toBeInstanceOf(CodeSourcesUnavailableError);
  });
  it('keeps strict imports from silently accepting incomplete sources',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>new Response('',{status:404})));
    await expect(scrapeSources(['https://robloxden.com/game-codes/removed','https://beebom.com/example-codes/'])).rejects.toThrow('404');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});
