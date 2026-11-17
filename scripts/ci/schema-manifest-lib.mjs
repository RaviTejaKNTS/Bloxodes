import fs from "node:fs";
import { isDeepStrictEqual } from "node:util";

export const fixtureTableNames = JSON.parse(fs.readFileSync(new URL("./fixtures/empty-tables.json", import.meta.url), "utf8"));
const viewRelations = JSON.parse(fs.readFileSync(new URL("./fixtures/view-relations.json", import.meta.url), "utf8"));
const schemaTableNames = [...new Set([...fixtureTableNames, ...Object.values(viewRelations).map(view => view.table)])].sort();
export const fixtureRpcNames = ["get_stats_platform_current_summary", "get_stats_platform_ccu_trend", "get_stats_subgenre_options", "get_stats_visit_share_chart", "search_site", "get_roblox_universe_pipeline_health_v4"];
const absentTables = JSON.parse(fs.readFileSync(new URL("./fixtures/absent-tables.json", import.meta.url), "utf8"));
const literals = names => names.map(name => `'${name}'`).join(",");

// Read catalog metadata, including materialized views and RETURNS TABLE functions.
// No data rows, credentials or time-dependent values enter the manifest.
export const schemaCatalogQuery = `
with columns as (
  select c.relname as relation, a.attname as name, a.attnum as position,
    pg_catalog.format_type(a.atttypid, a.atttypmod) as type,
    not a.attnotnull as nullable
  from pg_catalog.pg_attribute a
  join pg_catalog.pg_class c on c.oid=a.attrelid
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','v','m','p','f')
    and a.attnum>0 and not a.attisdropped and c.relname in (${literals(schemaTableNames)})
), functions as (
  select p.proname as name, pg_get_function_identity_arguments(p.oid) as identity,
    pg_get_function_result(p.oid) as result, p.proretset as returns_set,
    p.pronargdefaults as defaults,
    coalesce((select jsonb_agg(jsonb_build_object('name',p.proargnames[i],
      'type',pg_catalog.format_type((coalesce(p.proallargtypes,array(select unnest(p.proargtypes))))[i],null),
      'mode',coalesce(p.proargmodes[i],'i')) order by i)
      from generate_subscripts(coalesce(p.proallargtypes,array(select unnest(p.proargtypes))),1) i),'[]'::jsonb) as arguments
  from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prokind='f' and p.proname in (${literals(fixtureRpcNames)})
), foreign_keys as (
  select c.relname as relation, con.conname as name, f.relname as target,
    (select jsonb_agg(a.attname order by k.position) from unnest(con.conkey) with ordinality k(num,position)
      join pg_attribute a on a.attrelid=c.oid and a.attnum=k.num) as columns,
    (select jsonb_agg(a.attname order by k.position) from unnest(con.confkey) with ordinality k(num,position)
      join pg_attribute a on a.attrelid=f.oid and a.attnum=k.num) as target_columns
  from pg_catalog.pg_constraint con join pg_catalog.pg_class c on c.oid=con.conrelid
  join pg_catalog.pg_class f on f.oid=con.confrelid join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where con.contype='f' and n.nspname='public' and c.relname in (${literals(schemaTableNames)})
)
select coalesce((select jsonb_agg(to_jsonb(c) order by relation,position) from columns c),'[]'::jsonb) as columns,
  coalesce((select jsonb_agg(to_jsonb(f) order by name,identity) from functions f),'[]'::jsonb) as functions,
  coalesce((select jsonb_agg(to_jsonb(f) order by relation,name) from foreign_keys f),'[]'::jsonb) as foreign_keys;`;

export function buildSchemaManifest(catalog, { allowMissing = false } = {}) {
  const tables = {}, missing = [];
  for (const name of schemaTableNames) {
    const columns = catalog.columns.filter(column => column.relation === name);
    if (!columns.length) {
      if (!absentTables[name] && !allowMissing) throw new Error(`No public schema columns for CI fixture ${name}`);
      missing.push(name);
      continue;
    }
    tables[name] = {
      columns: Object.fromEntries(columns.map(({ name, type, nullable }) => [name, { type, nullable }])),
      foreignKeys: catalog.foreign_keys.filter(key => key.relation === name).map(({ name, target, columns, target_columns }) => ({ name, target, columns, targetColumns: target_columns }))
    };
  }
  const rpcs = {};
  for (const name of [...fixtureRpcNames].sort()) {
    const functions = catalog.functions.filter(fn => fn.name === name);
    if (!functions.length) {
      if (allowMissing) continue;
      throw new Error(`No public schema function for CI fixture ${name}`);
    }
    rpcs[name] = functions.map(({ identity, result, returns_set, defaults, arguments: args }) => ({ identity, result, returnsSet: returns_set, defaults, arguments: args }));
  }
  return { version: 1, schema: "public", tables, absentTables: missing, rpcs };
}

export const serializeSchemaManifest = manifest => JSON.stringify(manifest, null, 2) + "\n";

// A shared database may contain another PR's additions. Only fixture claims that
// the database cannot satisfy make query validation unsafe.
export function compareSchemaManifests(claimed, actual) {
  const errors = [], extras = [];
  for (const key of ["version", "schema"]) if (claimed[key] !== actual[key]) errors.push(`manifest.${key}`);
  for (const [table, definition] of Object.entries(claimed.tables)) {
    const live = actual.tables[table];
    if (!live) { errors.push(table); continue; }
    for (const [column, type] of Object.entries(definition.columns)) {
      if (!isDeepStrictEqual(type, live.columns[column])) errors.push(`${table}.${column}`);
    }
    for (const column of Object.keys(live.columns)) if (!Object.hasOwn(definition.columns, column)) extras.push(`${table}.${column}`);
    for (const key of definition.foreignKeys) {
      if (!isDeepStrictEqual(key, live.foreignKeys.find(candidate => candidate.name === key.name))) errors.push(`${table}.${key.name}`);
    }
    for (const key of live.foreignKeys) if (!definition.foreignKeys.some(candidate => candidate.name === key.name)) extras.push(`${table}.${key.name}`);
  }
  for (const table of Object.keys(actual.tables)) if (!Object.hasOwn(claimed.tables, table)) extras.push(table);
  for (const [name, signatures] of Object.entries(claimed.rpcs)) for (const signature of signatures) {
    if (!isDeepStrictEqual(signature, actual.rpcs[name]?.find(candidate => candidate.identity === signature.identity))) errors.push(`rpc.${name}(${signature.identity})`);
  }
  for (const [name, signatures] of Object.entries(actual.rpcs)) for (const signature of signatures) {
    if (!claimed.rpcs[name]?.some(candidate => candidate.identity === signature.identity)) extras.push(`rpc.${name}(${signature.identity})`);
  }
  return { errors: errors.sort(), extras: extras.sort() };
}
