import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import { assertFixtureEnvironment, createDataServer } from "../data-server.mjs";
import fs from "node:fs";
import { queryRows, rowContract } from "../data-query.mjs";
import { seedTables, seedContracts } from "../data-seed.mjs";

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
  const contract = rowContract(rows);
  contract.relations.authors = { key: "author", contract: rowContract([{name:"Alex",private:"hidden"}]) };
  const result=queryRows(rows,new URLSearchParams('select=id,author:authors(name)&order=id.asc'),{range:[1,1],count:true,contract});
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
test("HTTP supports CORS, HEAD counts, singular rows, read RPCs and rejects writes or unknown data", {skip:process.env.BLOXODES_CI_DATA !== "1"}, async () => {
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

test("the fixture covers moved batch namespaces, every game page family and calculator datasets", () => {
  const tables=seedTables();
  const roots=tables.games.filter(game=>game.parent_id===null && !["gta","red-dead","minecraft","peak","risk-of-rain"].includes(game.namespace));
  assert.ok(roots.length>=2);
  for(const kind of ["wiki","collection","code","tool","map","quiz","catalog","checklist"]) assert.ok(tables[`game_${kind}_pages_view`].length>0,kind);
  for(const code of ["grow-a-garden-crops","grow-a-garden-2-seeds","grow-a-garden-2-mutations","the-forge-ores","the-forge-weapons","the-forge-armors","wizard-alchemy-potions","wizard-alchemy-materials","wizard-alchemy-races"]) assert.ok(tables.wiki_collection_pages_view.some(page=>page.code===code),code);
});


test("query validation rejects unsupported clauses before evaluating any rows", () => {
  const tables = seedTables(), contracts = seedContracts(tables);
  const contract = contracts.puzzle_pages_view;
  const invalid = [
    "title=unsupported.Wordle", "title=eq.missing&slug=unsupported.wordle",
    "select=unknown", "order=unknown.asc", "unknown=eq.value",
    "or=(title.eq.Wordle,slug.unsupported.wordle)",
    "or=(title.eq.Wordle,unknown.eq.value)",
    "and=(title.eq.missing,or(slug.eq.wordle,slug.unsupported.wordle))",
    "or=(title.eq.Wordle,)", "or=title.eq.Wordle", "title=in.wordle",
    "title=in.(wordle", 'title=in.("wordle)', "order=title.sideways",
    "select=id,", "select=missing(*)", "limit=nope", "offset=-1"
  ];
  for (const rows of [[], tables.puzzle_pages_view]) for (const search of invalid) {
    assert.throws(() => queryRows(rows, new URLSearchParams(search), { contract }), undefined, search);
  }
  const articleContract = contracts.articles;
  for (const search of ["select=author:authors(unknown)", "select=author:missing(name)", "select=author:authors(name", "select=author:authors!inner(name)"]) {
    assert.throws(() => queryRows([], new URLSearchParams(search), { contract: articleContract }), undefined, search);
  }
  assert.deepEqual(queryRows([], new URLSearchParams("title=eq.Wordle&select=id,title&order=title.desc"), { contract }).data, []);
  // Even a genuinely empty table retains a declared, finite set of columns.
  assert.ok(contracts.app_sessions.columns.has("id"));
  assert.throws(() => queryRows(tables.app_sessions, new URLSearchParams("id=unsupported.x"), { contract: contracts.app_sessions }), /Unimplemented/);
  assert.throws(() => queryRows(tables.app_sessions, new URLSearchParams("select=unknown"), { contract: contracts.app_sessions }), /Unknown/);
});

test("every fixture table has sample rows or an explicit unused-route reason", () => {
  const tables = seedTables();
  const exemptions = JSON.parse(fs.readFileSync(new URL("../fixtures/empty-table-contracts.json", import.meta.url)));
  for (const [table, rows] of Object.entries(tables)) {
    if (rows.length) { assert.equal(exemptions[table], undefined, `${table} no longer needs an empty-table exemption`); continue; }
    assert.ok(exemptions[table]?.reason, `${table} needs public samples or an unused-route reason`);
    assert.ok(exemptions[table]?.columns.length, `${table} needs a schema even when empty`);
  }
  for (const table of Object.keys(exemptions)) assert.equal(tables[table]?.length, 0, table);
  const contract = seedContracts(tables).code_pages;
  const codes = queryRows(tables.code_pages, new URLSearchParams("select=universe:roblox_universes(updated_at,game_description_md),codes(code,rewards_text)"), { contract }).data;
  assert.deepEqual(codes[0].codes, [{ code: "TRAIL2026", rewards_text: "20 minutes of double XP" }]);
  assert.ok(codes[0].universe.updated_at);
  assert.equal(tables.puzzle_pages_view.length, 1);
  assert.equal(tables.puzzle_answers.length, 3);
  assert.ok(tables.site_routes.some(row => row.page_type === "puzzle" && row.status === "live"));
  console.log(`Fixture sweep: ${Object.entries(tables).map(([table, rows]) => `${table}=${rows.length}`).join(", ")}`);
});

test("HTTP audits invalid queries and any read of an unseeded table", {skip:process.env.BLOXODES_CI_DATA !== "1"}, async () => {
  const server = createDataServer();
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const requests = ["app_sessions?select=id&id=eq.missing", "app_sessions?id=unsupported.x", "puzzle_pages_view?title=eq.missing&slug=unsupported.wordle", "puzzle_pages_view?select=unknown", "puzzle_pages_view?order=unknown.asc", "app_sessions?or=(id.eq.missing,id.unsupported.x)", "articles?select=author:authors(unknown)"];
  try {
    for (const path of requests) {
      const response = await fetch(`${base}/rest/v1/${path}`);
      assert.equal(response.status, 500, path);
      assert.equal((await response.json()).code, "CI_FIXTURE_UNSUPPORTED");
    }
    const audit = await (await fetch(`${base}/__audit`)).json();
    assert.equal(audit.unexpected.length, requests.length);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
