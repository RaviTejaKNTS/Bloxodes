import assert from "node:assert/strict";
import { once } from "node:events";
import fs from "node:fs";
import test from "node:test";
import { queryRows, rowContract } from "../data-query.mjs";
import { schemaManifest, validateSeedRows } from "../data-schema.mjs";
import { seedContracts, seedTables } from "../data-seed.mjs";
import { createDataServer, parseRange } from "../data-server.mjs";

test("a seeded table cannot expose columns borrowed from another page type", () => {
  const tables = seedTables(), contracts = seedContracts(tables);
  assert.equal(Object.hasOwn(tables.puzzle_pages_view[0], "controls_json"), false);
  assert.equal(contracts.puzzle_pages_view.columns.has("controls_json"), false);
  for (const rows of [tables.puzzle_pages_view, []]) {
    assert.throws(() => queryRows(rows, new URLSearchParams("select=slug,controls_json"), {contract:contracts.puzzle_pages_view}), /Unknown CI data column: controls_json/);
  }
  assert.throws(() => queryRows([], new URLSearchParams("select=id")), /require a schema/);
});

test("seed validation fails on an invalid key before serving requests", () => {
  const tables = seedTables();
  tables.puzzle_pages_view[0].controls_json = [];
  assert.throws(() => validateSeedRows(tables), /Unknown CI seed column puzzle_pages_view.controls_json/);
  assert.throws(() => seedContracts(tables), /Unknown CI seed column/);
});

test("embeds stay separate from base columns and SELECT star", () => {
  const tables = seedTables(), contract = seedContracts(tables).articles;
  assert.equal(Object.hasOwn(tables.articles[0], "author"), false);
  assert.equal(contract.columns.has("author"), false);
  const result = queryRows(tables.articles, new URLSearchParams("select=*,author:authors(name)"), {contract}).data[0];
  assert.deepEqual(result.author, {name:"Alex Rivers"});
  assert.throws(() => queryRows(tables.articles, new URLSearchParams("select=author"), {contract}), /Unknown CI data column/);
});

const columns = Object.fromEntries(Object.entries({
  sort_order:"integer", total:"bigint", amount:"numeric", enabled:"boolean", day:"date", at:"timestamp with time zone", id:"uuid", title:"text", tags:"text[]", ids:"integer[]", metadata:"jsonb"
}).map(([key,type]) => [key,{type}]));
const contract = rowContract(columns);
const row = {sort_order:1,total:"9007199254740993",amount:1.5,enabled:true,day:"2026-11-16",at:"2026-11-16T00:00:00Z",id:"00000000-0000-4000-8000-000000000001",title:"Wordle",tags:["word","daily"],ids:[1,2],metadata:{answer:"TRAIL",tags:["daily","word"]}};
const run = (search, rows = [row]) => queryRows(rows, new URLSearchParams(search), {contract});
test("filter values match the schema type even when the table or result is empty", () => {
  for (const search of ["sort_order=gt.oops", "sort_order=in.(1,oops)", "sort_order=eq.1.5", "sort_order=eq.2147483648", "total=eq.9223372036854775808", "amount=gt.NaN", "amount=eq.1e9999", "enabled=eq.yes", "day=eq.2026-02-30", "at=gte.2026-02-30T00:00:00Z", "at=eq.yesterday", "id=eq.wordle", "ids=cs.{1,oops}", "metadata=cs.invalid", "title=eq.missing&or=(sort_order.eq.oops,title.eq.Wordle)"]) {
    for (const rows of [[row], []]) assert.throws(() => run(search, rows), /Invalid CI data/, search);
  }
  assert.deepEqual(run("sort_order=gte.1&amount=lt.2&enabled=eq.true&day=lte.2026-11-16&at=gte.2026-11-16T01:00:00%2B01:00&select=title").data, [{title:"Wordle"}]);
  assert.deepEqual(run("total=gt.9007199254740992&select=title").data, [{title:"Wordle"}]);
  assert.deepEqual(run("total=eq.9007199254740992&select=title").data, []);
});

test("operators reject incompatible types and implement array and JSON containment", () => {
  for (const search of ["title=cs.{Wordle}", "title=cd.{Wordle}", "title=ov.{Wordle}", "sort_order=like.1", "enabled=ilike.true", "title=is.true", "metadata=ov.{}", "sort_order->>value=eq.1"]) {
    assert.throws(() => run(search, []), /Incompatible|incompatible|Invalid CI data is/, search);
  }
  assert.deepEqual(run('tags=cs.{daily}&tags=ov.{word}&ids=cd.{1,2,3}&metadata=cs.{"tags":["daily"]}&select=title').data,[{title:"Wordle"}]);
  assert.deepEqual(run('tags=eq.{word,daily}&metadata->>answer=eq.TRAIL&select=title').data,[{title:"Wordle"}]);
  assert.deepEqual(run('tags=cs.{missing}&select=title').data,[]);
});

test("Range distinguishes absence from malformed, reversed or unsafe values", () => {
  assert.equal(parseRange(undefined), undefined);
  assert.deepEqual(parseRange("0-9"), [0,9]);
  for (const value of ["", "oops", "bytes=0-9", "0-", "9-0", "-1-9", "0-1,2-3", "0-9007199254740992", ["0-9"]]) assert.throws(() => parseRange(value), /Invalid CI data Range/);
});

test("HTTP audits missing columns, wrong types, incompatible operators and malformed Range", {skip:process.env.BLOXODES_CI_DATA !== "1"}, async () => {
  const server = createDataServer();
  server.listen(0,"127.0.0.1"); await once(server,"listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const requests = [
    ["puzzle_pages_view?select=slug,controls_json", {}],
    ["puzzle_pages_view?sort_order=gt.oops", {}],
    ["puzzle_pages_view?title=cs.{Wordle}", {}],
    ["puzzle_pages_view", {headers:{Range:"malformed"}}],
    ["rpc/get_stats_platform_current_summary?select=nonexistent", {method:"POST",body:"{}"}],
    ["rpc/get_stats_platform_ccu_trend", {method:"POST",body:'{"p_since":"oops"}'}]
  ];
  try {
    for (const [path, init] of requests) {
      const response = await fetch(`${base}/rest/v1/${path}`,init);
      assert.equal(response.status,500,path);
      assert.equal((await response.json()).code,"CI_FIXTURE_UNSUPPORTED");
    }
    const absent = await fetch(`${base}/rest/v1/roblox_platform_stats_daily`);
    assert.equal(absent.status,404); assert.equal((await absent.json()).code,"PGRST205");
    const audit = await (await fetch(`${base}/__audit`)).json();
    assert.equal(audit.unexpected.length,requests.length);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test("manifest drift runs after PR migrations and never changes production release steps", () => {
  const workflow = fs.readFileSync(new URL("../../../.github/workflows/schema-release.yml",import.meta.url),"utf8");
  assert.match(workflow,/managed-schema.ts --apply[\s\S]*name: Check CI fixture schema manifest\n        if: \$\{\{ !inputs.production \}\}\n        run: node --import tsx scripts\/ci\/schema-manifest.ts --check/);
  for (const name of Object.keys(seedTables())) assert.ok(schemaManifest.tables[name] || schemaManifest.absentTables.includes(name),name);
});
