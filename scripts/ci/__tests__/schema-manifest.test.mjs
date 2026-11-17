import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { buildSchemaManifest, compareSchemaManifests } from "../schema-manifest-lib.mjs";

const baseline = () => ({
  version:1, schema:"public", absentTables:["absent"],
  tables:{
    pages:{columns:{id:{type:"uuid",nullable:false},author_id:{type:"uuid",nullable:true}},foreignKeys:[{name:"pages_author_fkey",target:"authors",columns:["author_id"],targetColumns:["id"]}]},
    authors:{columns:{id:{type:"uuid",nullable:false}},foreignKeys:[]},
    pages_view:{columns:{id:{type:"uuid",nullable:true}},foreignKeys:[]}
  },
  rpcs:{lookup:[{identity:"p_id uuid",result:"TABLE(id uuid)",returnsSet:true,defaults:0,arguments:[{name:"p_id",type:"uuid",mode:"i"},{name:"id",type:"uuid",mode:"t"}]}]}
});

test("manifest comparison accepts identical claims regardless of object or array order", () => {
  const claimed = baseline(), actual = baseline();
  actual.tables = Object.fromEntries(Object.entries(actual.tables).reverse());
  actual.tables.pages.columns = Object.fromEntries(Object.entries(actual.tables.pages.columns).reverse());
  assert.deepEqual(compareSchemaManifests(claimed,actual),{errors:[],extras:[]});
});

test("managed-development additions are warnings only for tables, columns, foreign keys and RPCs", () => {
  const claimed = baseline(), actual = baseline();
  actual.tables.absent = {columns:{id:{type:"uuid",nullable:false}},foreignKeys:[]};
  actual.tables.pages.columns.title = {type:"text",nullable:true};
  actual.tables.pages.foreignKeys.push({name:"pages_extra_fkey",target:"authors",columns:["id"],targetColumns:["id"]});
  actual.rpcs.extra = [...actual.rpcs.lookup];
  actual.rpcs.lookup.push({...actual.rpcs.lookup[0],identity:"p_slug text",arguments:[{name:"p_slug",type:"text",mode:"i"},{name:"id",type:"uuid",mode:"t"}]});
  assert.deepEqual(compareSchemaManifests(claimed,actual),{errors:[],extras:["absent","pages.pages_extra_fkey","pages.title","rpc.extra(p_id uuid)","rpc.lookup(p_slug text)"]});
});

test("manifest claims fail when managed development is missing a table, view, column, FK or RPC", () => {
  for (const [remove, name] of [
    [actual => delete actual.tables.authors,"authors"],
    [actual => delete actual.tables.pages_view,"pages_view"],
    [actual => delete actual.tables.pages.columns.author_id,"pages.author_id"],
    [actual => { actual.tables.pages.foreignKeys = []; },"pages.pages_author_fkey"],
    [actual => delete actual.rpcs.lookup,"rpc.lookup(p_id uuid)"]
  ]) {
    const actual = baseline(); remove(actual);
    assert.deepEqual(compareSchemaManifests(baseline(),actual).errors,[name]);
    // Reversing the same drift must warn without failing.
    assert.deepEqual(compareSchemaManifests(actual,baseline()),{errors:[],extras:[name]});
  }
});

test("manifest claims fail on changed types, nullability, FK direction and RPC signatures", () => {
  for (const [change, name] of [
    [actual => { actual.tables.pages.columns.id.type = "text"; },"pages.id"],
    [actual => { actual.tables.pages.columns.id.nullable = true; },"pages.id"],
    [actual => { actual.tables.pages.foreignKeys[0].target = "pages"; },"pages.pages_author_fkey"],
    [actual => { actual.tables.pages.foreignKeys[0].columns = ["id"]; },"pages.pages_author_fkey"],
    [actual => { actual.tables.pages.foreignKeys[0].targetColumns = ["other_id"]; },"pages.pages_author_fkey"],
    [actual => { actual.rpcs.lookup[0].result = "TABLE(id text)"; },"rpc.lookup(p_id uuid)"],
    [actual => { actual.rpcs.lookup[0].returnsSet = false; },"rpc.lookup(p_id uuid)"],
    [actual => { actual.rpcs.lookup[0].defaults = 1; },"rpc.lookup(p_id uuid)"],
    [actual => { actual.rpcs.lookup[0].arguments[0].type = "text"; },"rpc.lookup(p_id uuid)"]
  ]) {
    const actual = baseline(); change(actual);
    assert.deepEqual(compareSchemaManifests(baseline(),actual).errors,[name]);
    assert.deepEqual(compareSchemaManifests(actual,baseline()).errors,[name]);
  }
});

test("check can generate a downloadable manifest even when required metadata is missing", () => {
  const catalog = {columns:[],foreign_keys:[],functions:[]};
  assert.throws(() => buildSchemaManifest(catalog), /No public schema columns/);
  const manifest = buildSchemaManifest(catalog,{allowMissing:true});
  assert.deepEqual(manifest.tables,{});
  assert.deepEqual(manifest.rpcs,{});
  assert.ok(compareSchemaManifests(baseline(),manifest).errors.includes("pages"));
});

test("schema workflow uploads fresh manifests after warnings or failures and excludes production", () => {
  const workflow = fs.readFileSync(new URL("../../../.github/workflows/schema-release.yml",import.meta.url),"utf8");
  assert.match(workflow,/name: Upload fresh CI schema manifest on drift\n        if: \$\{\{ always\(\) && !inputs.production \}\}/);
  assert.match(workflow,/name: ci-schema-manifest-\$\{\{ inputs.sha \}\}/);
  assert.match(workflow,/path: \$\{\{ runner.temp \}\}\/ci-schema-manifest.json/);
  const script = fs.readFileSync(new URL("../schema-manifest.ts",import.meta.url),"utf8");
  assert.match(script,/if \(errors.length \|\| extras.length\)/);
  assert.match(script,/if \(errors.length\) throw new Error/);
});
