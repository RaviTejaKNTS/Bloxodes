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

test("embeds reject dropped foreign keys before reading populated or empty tables", () => {
  const tables = seedTables(), manifest = structuredClone(schemaManifest);
  manifest.tables.articles.foreignKeys = manifest.tables.articles.foreignKeys.filter(key => key.name !== "articles_author_id_fkey");
  const contract = seedContracts(tables, manifest).articles;
  for (const rows of [tables.articles, []]) assert.throws(() => queryRows(rows, new URLSearchParams("select=slug,author:authors(name)"), {contract}), /Unknown CI data relation: authors/);
});

test("ambiguous embeds require a foreign key or column hint and join the chosen key", () => {
  const tables = seedTables(), manifest = structuredClone(schemaManifest);
  const editor = {...tables.authors[0],id:"00000000-0000-4000-8000-999999999999",name:"Editor"};
  tables.authors.push(editor);
  tables.articles[0].editor_id = editor.id;
  manifest.tables.articles.columns.editor_id = {type:"uuid",nullable:true};
  manifest.tables.articles.foreignKeys.push({name:"articles_editor_id_fkey",target:"authors",columns:["editor_id"],targetColumns:["id"]});
  const contract = seedContracts(tables, manifest).articles;
  for (const rows of [tables.articles, []]) assert.throws(() => queryRows(rows, new URLSearchParams("select=authors(name)"), {contract}), /Ambiguous CI data relation/);
  const result = queryRows(tables.articles, new URLSearchParams("select=author:authors!articles_author_id_fkey(name),editor:authors!editor_id(name)"), {contract});
  assert.deepEqual(result.data, [{author:{name:"Alex Rivers"},editor:{name:"Editor"}}]);
  assert.throws(() => queryRows([], new URLSearchParams("select=authors!missing(name)"), {contract}), /Unknown CI data relation/);
});

test("foreign key direction determines object and array embeds, including view joins", () => {
  const tables = seedTables(), contracts = seedContracts(tables);
  for (const table of ["code_pages", "code_pages_view"]) {
    const result = queryRows(tables[table], new URLSearchParams("select=universe:roblox_universes(name),codes!codes_code_page_id_fkey(code)"), {contract:contracts[table]}).data[0];
    assert.equal(result.universe.name,"Blox Fruits");
    assert.deepEqual(result.codes,[{code:"TRAIL2026"}]);
  }
  const manifest = structuredClone(schemaManifest);
  manifest.tables.codes.foreignKeys = [];
  const contract = seedContracts(tables, manifest).code_pages_view;
  assert.throws(() => queryRows([], new URLSearchParams("select=codes(code)"), {contract}), /Unknown CI data relation/);
});

test("every handwritten view relationship names an existing base-table foreign key", () => {
  const views = JSON.parse(fs.readFileSync(new URL("../fixtures/view-relations.json", import.meta.url), "utf8"));
  const tables = seedTables(), contracts = seedContracts(tables);
  for (const [view, definition] of Object.entries(views)) {
    for (const key of definition.foreignKeys) {
      assert.ok(schemaManifest.tables[key.table]?.foreignKeys.some(actual => actual.name === key.name), `${view}: ${key.table}.${key.name}`);
      const manifest = structuredClone(schemaManifest);
      manifest.tables[key.table].foreignKeys = manifest.tables[key.table].foreignKeys.filter(actual => actual.name !== key.name);
      const changed = seedContracts(tables, manifest)[view];
      for (const [target, candidates] of Object.entries(contracts[view].relations)) {
        if (!candidates.some(candidate => candidate.hints.includes(key.name))) continue;
        assert.throws(() => queryRows([],new URLSearchParams(`select=${target}!${key.name}(*)`),{contract:changed}), /Unknown CI data relation/);
      }
    }
  }
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

test("filters allow one not prefix and reject repeated not inside nested logic", () => {
  for (const search of ["title=not.not.eq.Wordle", "or=(title.not.not.eq.Wordle,title.eq.Wordle)", "and=(title.eq.missing,or(title.not.not.eq.Wordle,title.eq.Wordle))", "or=(not.and(title.not.not.eq.Wordle))"]) {
    for (const rows of [[row], []]) assert.throws(() => run(search,rows), /Unimplemented CI data filter: not/,search);
  }
  assert.deepEqual(run("title=not.eq.Other&select=title").data,[{title:"Wordle"}]);
  assert.deepEqual(run("or=(title.not.eq.Other)&select=title").data,[{title:"Wordle"}]);
  assert.deepEqual(run("title=not.eq.Wordle&select=title").data,[]);
  assert.deepEqual(run("title=not.eq.Wordle",[{...row,title:null}]).data,[]);
  assert.equal(run("title=not.is.null").data.length,1);
});

test("JSON text extraction preserves strings, serializes arrays and objects and keeps null", () => {
  const tables = seedTables(), quiz = tables.quiz_pages[0], contract = seedContracts(tables).quiz_pages;
  const result = queryRows([quiz],new URLSearchParams("select=easy:quiz_data->>easy,json:quiz_data->easy"),{contract}).data[0];
  assert.equal(result.easy,JSON.stringify(quiz.quiz_data.easy));
  assert.deepEqual(result.json,quiz.quiz_data.easy);
  const rows = [{...row,metadata:{answer:"TRAIL",tags:["daily","word"],details:{count:2},number:2,enabled:true,empty:null}}];
  assert.deepEqual(run("select=answer:metadata->>answer,tags:metadata->>tags,details:metadata->>details,number:metadata->>number,enabled:metadata->>enabled,empty:metadata->>empty,missing:metadata->>missing,nested:metadata->tags->>0",rows).data,
    [{answer:"TRAIL",tags:'["daily","word"]',details:'{"count":2}',number:"2",enabled:"true",empty:null,missing:null,nested:"daily"}]);
  const params = new URLSearchParams({"metadata->>tags":"eq."+JSON.stringify('["daily","word"]'),"metadata->>number":"eq.2",select:"title"});
  assert.deepEqual(queryRows(rows,params,{contract:rowContract(columns)}).data,[{title:"Wordle"}]);
  assert.deepEqual(run("or=(metadata->>answer.eq.TRAIL)&select=title",rows).data,[{title:"Wordle"}]);
  assert.deepEqual(run("metadata->>empty=is.null&select=title",rows).data,[{title:"Wordle"}]);
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
    ["puzzle_pages_view?title=not.not.eq.Wordle", {}],
    ["puzzle_pages_view?or=(title.not.not.eq.Wordle)", {}],
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
