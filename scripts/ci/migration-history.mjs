const versionPattern = /^\d{14}$/;
const hashPattern = /^[0-9a-f]{64}$/;
const literal = value => `'${value.replaceAll("'", "''")}'`;

export function historyRepairs(aliases, migrations, ledger) {
  const local = new Map(migrations.map(row => [row.version, row]));
  const remote = new Map(ledger.map(row => [String(row.version), row]));
  const seen = new Set();
  const sources = new Set();
  const repairs = [];
  for (const alias of aliases) {
    if (!versionPattern.test(alias.version) || !versionPattern.test(alias.source_version) ||
        alias.version === alias.source_version || seen.has(alias.version) || sources.has(alias.source_version) ||
        !hashPattern.test(alias.source_sha256) || !hashPattern.test(alias.local_sha256) || !alias.reason?.trim()) {
      throw new Error("Invalid audited migration-history alias.");
    }
    seen.add(alias.version);
    sources.add(alias.source_version);
    const migration = local.get(alias.version);
    if (!migration || migration.hash !== alias.local_sha256) throw new Error(`Migration-history local proof changed for ${alias.version}.`);
    if (remote.has(alias.version)) continue;
    const source = remote.get(alias.source_version);
    if (!source) continue; // A new project must execute the migration normally.
    if (source.name !== migration.name || source.sql_hash !== alias.source_sha256) {
      throw new Error(`Migration-history source proof changed for ${alias.source_version}.`);
    }
    repairs.push({ ...alias, name: migration.name });
  }
  if (repairs.length && !remote.has("20261006074815")) throw new Error("History aliases require the verified shared-table retirement.");
  if (repairs.length) {
    const removal = aliases.find(row => row.version === "20260920000021");
    const source = removal && remote.get(removal.source_version);
    if (!source || source.sql_hash !== removal.source_sha256) throw new Error("History aliases require the verified GTA tools removal SQL.");
  }
  return repairs;
}

// Check again under the same advisory lock as application. Copy the original SQL
// evidence into the canonical record; never execute it or delete its old version.
export function repairHistorySql(repairs) {
  if (!repairs.length) return [];
  return [String.raw`do $history$ begin
    if to_regclass('public.wiki_collection_datasets') is null
       or to_regclass('public.wiki_collection_items') is null
       or to_regclass('public.games') is null
       or to_regclass('public.game_checklist_pages') is null
       or to_regclass('public.gta_games') is not null
       or to_regclass('public.gta_tools') is not null
       or to_regclass('public.red_dead_games') is not null
       or to_regprocedure('public.trg_enqueue_revalidation_gta_content()') is not null
       or to_regprocedure('public.trg_search_index_gta_content()') is not null
       or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='quiz_pages' and column_name='quiz_data')
       or not exists (select 1 from supabase_migrations.schema_migrations where version='20261006074815') then
      raise exception 'Migration-history current-object proof failed';
    end if;
  end $history$;`, ...repairs.flatMap(alias => [
    `do $history$ begin
      if not exists (select 1 from supabase_migrations.schema_migrations where version=${literal(alias.source_version)} and name=${literal(alias.name)} and encode(sha256(convert_to(array_to_string(statements,E'\\n'),'UTF8')),'hex')=${literal(alias.source_sha256)}) then
        raise exception 'Migration-history source proof changed';
      end if;
    end $history$;`,
    `insert into supabase_migrations.schema_migrations(version,name,statements)
     select ${literal(alias.version)},name,statements from supabase_migrations.schema_migrations where version=${literal(alias.source_version)};`
  ])];
}
