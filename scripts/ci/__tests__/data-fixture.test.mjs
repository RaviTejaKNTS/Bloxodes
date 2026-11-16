import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import { assertFixtureEnvironment, createDataServer } from "../data-server.mjs";
import { queryRows } from "../data-query.mjs";
import { seedTables } from "../data-seed.mjs";

const query = (rows, search) => queryRows(rows, new URLSearchParams(search));
test("fixture refuses workstation or implicit CI use", () => {
  assert.throws(() => assertFixtureEnvironment({}), /explicit GitHub CI/);
  assert.throws(() => assertFixtureEnvironment({GITHUB_ACTIONS:"true"}), /explicit GitHub CI/);
  const env = {GITHUB_ACTIONS:"true",BLOXODES_CI_DATA:"1",BLOXODES_ENV_PROFILE:"process-only",SUPABASE_URL:"http://127.0.0.1:54321",NEXT_PUBLIC_SUPABASE_URL:"http://127.0.0.1:54321",SUPABASE_MEDIA_PUBLIC_URL:"http://127.0.0.1:54321"};
  assert.doesNotThrow(() => assertFixtureEnvironment(env));
  assert.throws(() => assertFixtureEnvironment({...env,SUPABASE_URL:"https://database.bloxodes.com"}), /loopback/);
});
test("queries implement nested logic, quoted lists, JSON filters and date comparisons", () => {
  const rows = [{id:1,name:"Rock, paper",date:"2026-11-01",meta:{credit:null}},{id:2,name:"Rope",date:"2026-10-01",meta:{credit:"Game"}}];
  assert.deepEqual(query(rows,'or=(and(id.gte.1,id.lt.2),name.eq.Rope)&select=id').data,[{id:1},{id:2}]);
  assert.deepEqual(query(rows,'name=in.("Rock, paper")&select=name').data,[{name:"Rock, paper"}]);
  assert.deepEqual(query(rows,'date=gte.2026-10-20&meta->>credit=is.null&select=id').data,[{id:1}]);
  assert.deepEqual(query(rows,'id=not.in.(1)&select=id').data,[{id:2}]);
  assert.throws(() => query(rows,'name=unsupported.Rope'), /Unimplemented/);
});
test("count happens before range and projection includes embedded relations", () => {
  const rows = [{id:2,author:{name:"Alex",private:"hidden"}},{id:1,author:null}];
  const result=queryRows(rows,new URLSearchParams('select=id,author:authors(name)&order=id.asc'),{range:[1,1],count:true});
  assert.deepEqual(result,{data:[{id:2,author:{name:"Alex"}}],count:2,error:null});
  assert.equal(queryRows(rows,new URLSearchParams('offset=9'),{count:true}).error.code,"PGRST103");
  assert.deepEqual(query(rows,'offset=9').data,[]);
});
test("seed has linked page inventories, both collection types and paginated game data", () => {
  const tables=seedTables();
  assert.ok(tables.game_collection_items.length > 90);
  assert.ok(tables.wiki_collection_pages.some(page=>page.page_type==="collectible"));
  for(const page of tables.game_collection_pages_view) {
    const dataset=tables.game_collection_datasets.find(row=>row.id===page.published_dataset_id);
    assert.equal(tables.game_collection_items.filter(row=>row.dataset_id===dataset.id).length,page.item_count);
    assert.ok(tables.site_routes.some(route=>route.page_id===page.id && route.path===page.canonical_path && route.status==="live"));
  }
});
test("HTTP supports CORS, HEAD counts, singular rows, read RPCs and rejects writes or unknown data", async () => {
  const server=createDataServer();
  server.listen(0,"127.0.0.1"); await once(server,"listening");
  const base=`http://127.0.0.1:${server.address().port}`;
  try {
    const counted=await fetch(`${base}/rest/v1/code_pages?select=id`,{method:"HEAD",headers:{Prefer:"count=exact"}});
    assert.equal(counted.headers.get("content-range"),"0-0/1");assert.equal(await counted.text(),"");
    const row=await fetch(`${base}/rest/v1/code_pages?slug=eq.blox-fruits&select=name`,{headers:{Accept:"application/vnd.pgrst.object+json"}});
    assert.deepEqual(await row.json(),{name:"Blox Fruits"});
    assert.equal((await fetch(`${base}/rest/v1/code_pages?slug=eq.missing`,{headers:{Accept:"application/vnd.pgrst.object+json"}})).status,406);
    assert.equal((await fetch(`${base}/rest/v1/rpc/get_stats_platform_current_summary`,{method:"POST",body:"{}"})).status,200);
    assert.equal((await fetch(`${base}/rest/v1/code_pages`,{method:"POST",body:"{}"})).status,500);
    assert.equal((await fetch(`${base}/rest/v1/missing`)).status,500);
    const audit=await (await fetch(`${base}/__audit`)).json(); assert.equal(audit.unexpected.length,2);
    assert.equal(row.headers.get("access-control-allow-origin"),"*");
  } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test("quoted PostgREST LIKE patterns retain commas, brackets and escaped wildcards", () => {
  const rows=[{name:"Rock, [paper] 50%_"},{name:"Rock paper 500x"}];
  const params=new URLSearchParams();
  params.set("or",'('+`name.ilike.${JSON.stringify("%Rock, [paper] 50\\%\\_%")}`+')');
  assert.deepEqual(queryRows(rows,params).data,[rows[0]]);
});
