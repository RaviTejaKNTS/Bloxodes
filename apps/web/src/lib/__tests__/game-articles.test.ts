import {beforeEach,expect,it,vi} from "vitest";
const state=vi.hoisted(()=>({route:undefined as undefined|null|{source:string;page_type:string;page_id:string;game_id:string},roblox:null as Record<string,unknown>|null,summary:null as Array<Record<string,unknown>>|null,queries:[] as Array<{table:string;filters:Record<string,unknown>;range?:number[];orders:string[]} >}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/site-route-page",()=>({getLiveSiteRoute:async()=>state.route}));
vi.mock("@/lib/supabase",()=>({supabaseAdmin:()=>({from(table:string){
  const call:{table:string;filters:Record<string,unknown>;range?:number[];orders:string[]}={table,filters:{},orders:[]};state.queries.push(call);
  const shared={id:"shared",namespace:"example",game_id:"game",slug:"example-guide",content_md:"First page\n\n<!-- pagebreak -->\n\nSecond page",sources_json:[{title:"Official",url:"https://example.com"}],author:null};
  const result=()=>({data:table==="articles"?(state.roblox??[]):table==="game_article_pages_view"?shared:table==="game_article_game_summary"?state.summary??[{game_id:"game",game_slug:"example-game",namespace:"example",title:"Example",article_count:2,latest_updated_at:null,icon_url:null}]:[],error:null,count:4});
  const query={select:()=>query,eq:(key:string,value:unknown)=>{call.filters[key]=value;return query;},is:(key:string,value:unknown)=>{call.filters[key]=value;return query;},order:(key:string)=>{call.orders.push(key);return query;},limit:()=>query,range:(start:number,end:number)=>{call.range=[start,end];return query;},maybeSingle:async()=>table==="articles"?{data:state.roblox,error:null}:result(),then:(resolve:(value:unknown)=>unknown)=>Promise.resolve(result()).then(resolve)};
  return query;
}})}));
import {getArticleBySlug,listArticleGameSummaries,listPublishedArticlesPage,listPublishedArticlesByArticleGameSlugPage} from "../db";
beforeEach(()=>{state.queries=[];state.summary=null;state.roblox=null;state.route=undefined;});
it("checks Roblox first and skips the game reader on a hit",async()=>{
 state.roblox={id:"roblox",slug:"example-guide"};
 expect((await getArticleBySlug("example-guide"))?.id).toBe("roblox");
 expect(state.queries.map(q=>q.table)).toEqual(["articles"]);
});
it("uses exact stored article paths when the registry is unavailable",async()=>{
 const row=await getArticleBySlug("example-guide");
 expect(row?.namespace).toBe("example");expect(row?.universe_id).toBe(null);
 expect(row?.sources).toEqual(["https://example.com"]);
 expect(state.queries[1].filters).toEqual({canonical_path:"/articles/example-guide"});
});
it.each([null,{source:"roblox",page_type:"article",page_id:"id",game_id:"game"}])("rejects registry absence or Roblox ownership: %j",async route=>{
 state.route=route;expect(await getArticleBySlug("example-guide")).toBeNull();expect(state.queries).toHaveLength(1);
});
it("binds a live route read to both page and game IDs",async()=>{
 state.route={source:"game",page_type:"article",page_id:"shared",game_id:"game"};
 expect((await getArticleBySlug("example-guide"))?.id).toBe("shared");
 expect(state.queries[1].filters).toEqual({canonical_path:"/articles/example-guide",id:"shared",game_id:"game"});
});
it("asks the database for a single sorted merged page and exact total",async()=>{
 const result=await listPublishedArticlesPage(2,2);
 expect(result.total).toBe(4);expect(state.queries).toHaveLength(1);
 expect(state.queries[0]).toMatchObject({table:"published_articles_view",range:[2,3],orders:["published_at","id"]});
});
it("filters one game's archive without other games or platform-wide Roblox articles",async()=>{
 await listPublishedArticlesByArticleGameSlugPage("example-game",1,2);
 const query=state.queries.find(q=>q.table==="published_articles_view");
 expect(query?.filters).toEqual({is_published:true,game_id:"game"});
});
it("keeps the Roblox archive and every other archive when two share a slug",async()=>{
 state.roblox=[{universe_id:null,updated_at:null,published_at:null,created_at:null,universe:null}] as never;
 state.summary=[{game_id:"clash",game_slug:"roblox",namespace:"clash",title:"Clash",article_count:1,latest_updated_at:null},{game_id:"game",game_slug:"example-game",namespace:"example",title:"Example",article_count:2,latest_updated_at:null}];
 const warn=vi.spyOn(console,"warn").mockImplementation(()=>{});
 const games=await listArticleGameSummaries();
 expect(games.map(game=>game.slug).sort()).toEqual(["example-game","roblox"]);
 expect(games.find(game=>game.slug==="roblox")?.gameId).toBeUndefined();
 expect(warn).toHaveBeenCalledTimes(1);
 warn.mockRestore();
});
