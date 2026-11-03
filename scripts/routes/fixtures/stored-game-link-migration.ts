import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gtaMapLinkSnapshots } from "./gta-map-link-snapshots";

const literal = (value: string) => "'" + value.replaceAll("'", "''") + "'";
const json = (value: unknown) => literal(JSON.stringify(value)) + "::jsonb";
const families = ["wiki", "collection", "map", "checklist"];
const tables = [...families.map(kind => `game_${kind}_pages`), "game_checklist_items"];
const missingId = "2f2263d2-e1fa-4030-b14e-eddff7946854";

// Parse only the reviewed inventory, never regenerate the migration's UPDATEs.
// Literal before/after URL pairs provide expectations without calling the SQL
// rewrite helper. Counts fail closed if the inventory/parser changes.
export function storedGameLinkMigrationFixture(repair: string, snapshotPrerequisite: string): string {
  const maps = gtaMapLinkSnapshots();
  // One map uses a development UUID absent from the production repair inventory.
  const storedId = (id: string) => id === maps[0].id ? "b0000000-0000-0000-0000-000000000001" : id;
  const guards = [...repair.matchAll(/r\.path='([^']+)' and r\.status='old' and public\.site_route_target\(r,r\.path\)='([^']+)'/g)]
    .map(([, path, target]) => ({ path, target }));
  assert.equal(guards.length, 111);
  assert.equal(new Set(guards.map(g => g.path)).size, guards.length);
  const fields = [...repair.matchAll(/update public\.(game_\w+) set (\w+)=[^\n]*?rewrite_game_url_links\(to_jsonb\(\2\),'([^']+)'::jsonb,'([^']+)'::jsonb\)[^\n]*\nwhere id='([0-9a-f-]+)'/g)]
    .map(([, table, field, mapping, collections, id]) => ({
      table, field, mapping: JSON.parse(mapping) as Record<string, string>,
      collections: JSON.parse(collections) as string[], id,
    }));
  assert.equal(fields.length, 108);
  assert.equal((repair.match(/^update public\./gm) ?? []).length, fields.length);
  assert.deepEqual([...new Set(fields.map(f => f.table))].sort(), [...tables].sort());
  const rows = new Map<string, Record<string, unknown>>();
  const expectedFields: { table: string; id: string; field: string; value: unknown }[] = [];
  for (const f of fields) {
    const namespace = Object.keys(f.mapping)[0].startsWith("/red-dead/") ? "red-dead" : "gta";
    const row = rows.get(f.id) ?? { id: f.id, namespace };
    assert.equal(row.namespace, namespace);
    const before: string[] = [], after: string[] = [];
    for (const [old, target] of Object.entries(f.mapping)) {
      assert.ok(guards.some(g => g.path === old && g.target === target));
      // Check relative/absolute links, suffixes, punctuation and pagination.
      const suffixes = ["", "?sort=name#map", "#locations", ...(f.collections.includes(old) ? ["/page/2?sort=name#map"] : [])];
      for (const suffix of suffixes) {
        before.push(`[Find it](${old}${suffix}) <https://bloxodes.com${old}${suffix}>`);
        after.push(`[Find it](${target}${suffix}) <https://bloxodes.com${target}${suffix}>`);
      }
      const unchanged = `https://other.example${old} ${old}-extra ${old}/tiles/1/2/3.png`;
      before.push(unchanged); after.push(unchanged);
    }
    const prose = "Keep the player's route notes, task order and reward amounts: 42. ";
    const shape = (parts: string[]) => /_(json|data)$/.test(f.field)
      ? { nested: [null, 42, false, { text: prose + parts.join("\n"), assets: ["/gta/maps/gta5/tiles/1/2/3.png", "/red-dead/maps/rdr2/icon.webp"] }], empty: {} }
      : prose + parts.join("\n") + "\n/gta/maps/gta5/tiles/1/2/3.png";
    const map = maps.find(map => map.id === f.id && f.table === "game_map_pages");
    if (f.table === "game_map_pages") assert.ok(map, `Missing real map ${f.id}`);
    row[f.field] = map ? map.before : shape(before);
    rows.set(f.id, row);
    if (f.id !== missingId) expectedFields.push({ table: f.table, id: storedId(f.id), field: f.field, value: map ? map.after : shape(after) });
  }
  assert.equal(rows.size, 88);
  assert.ok(rows.has(missingId));
  const owner = (ns: unknown) => ns === "gta" ? "a0000000-0000-0000-0000-000000000001" : "a0000000-0000-0000-0000-000000000002";
  const wiki = (ns: unknown) => ns === "gta" ? "256ffb44-edde-4b19-80d3-ba0bf754893e" : "a0000000-0000-0000-0000-000000000003";
  assert.ok(fields.some(f => f.table === "game_wiki_pages" && f.id === wiki("gta")));
  const checklist = fields.find(f => f.table === "game_checklist_pages")!.id;
  const seed = tables.flatMap(table => {
    const ids = [...new Set(fields.filter(f => f.table === table).map(f => f.id))];
    return ids.filter(id => id !== missingId).map(id => {
      const row = { ...rows.get(id)!, id: storedId(id) };
      if (table === "game_checklist_items") {
        Object.assign(row, { page_id: checklist, item_key: `task-${id}`, section_code: "story.missions.complete" });
      } else {
        Object.assign(row, { game_id: owner(row.namespace), title: "Repair fixture", slug: `repair-${id}` });
        if (table === "game_map_pages") {
          const map = maps.find(map => map.id === id)!;
          Object.assign(row, { slug: map.slug, renderer_key: map.renderer });
        }
        if (table === "game_wiki_pages") row.slug = "gta-repair-owner";
        if (table === "game_collection_pages") Object.assign(row, {
          wiki_page_id: wiki(row.namespace), wiki_slug: `${row.namespace}-repair-owner`,
          collection_slug: `repair-${id}`, code: `repair-${id}`,
        });
      }
      const columns = Object.keys(row).join(",");
      return `insert into public.${table}(${columns}) select ${columns} from jsonb_populate_record(null::public.${table},${json(row)});`;
    });
  }).join("\n");
  const snapshot = "select * from (" + tables.map(table => `select '${table}'::text tbl,id,to_jsonb(t) value from public.${table} t`).join(" union all ") + ") repair_rows";
  const expectedEvents = tables.map(table => `select 'game_content'::text kind,ltrim(p.canonical_path,'/') path,'${table}_update'::text reason
    from repair_expected_fields f join public.${table} t on t.id=f.id
    ${table === "game_checklist_items" ? "join public.game_checklist_pages p on p.id=t.page_id" : `join public.${table} p on p.id=t.id`}
    where f."table"='${table}'`).join(" union all ");
  const dataTrigger = readFileSync(new URL("../../../supabase/migrations/20261006070414_shared_games_runtime.sql", import.meta.url), "utf8")
    .match(/create function public\.trg_game_data_changed\(\)[\s\S]+?end \$\$;/)?.[0];
  assert.ok(dataTrigger);
  return `
   -- Run after URL moves, prepare triggers and the real search implementation.
   -- Retire the earlier URL-only GTA5 dummy before inserting its real snapshot.
   delete from public.game_map_pages m using public.games g
    where m.game_id=g.id and g.namespace='gta' and g.slug='gta-fixture'
     and m.slug='gta5' and m.renderer_key='image-pins';
   insert into public.games(id,namespace,slug,url_style) values
    ('${owner("gta")}','gta','gta-repair-owner','page_type'),
    ('${owner("red-dead")}','red-dead','red-dead-repair-owner','page_type');
   insert into public.game_wiki_pages(id,namespace,game_id,slug,title) values
    ('${wiki("red-dead")}','red-dead','${owner("red-dead")}','red-dead-repair-owner','Repair fixture');
   ${seed}
   -- A nontarget row contains a matching old URL and must remain untouched.
   insert into public.game_checklist_items(id,page_id,namespace,item_key,section_code,description)
    values('a0000000-0000-0000-0000-000000000004','${checklist}','gta','untargeted','story.missions.complete','Keep /gta/wiki/gta-5/story-missions');
   create temp table repair_guards as select * from jsonb_to_recordset(${json(guards)}) g(path text,target text);
   insert into public.site_routes(path,status,target_url,origin)
    select path,'old',target,'repair-fixture' from repair_guards;
   create temp table repair_before as ${snapshot};
   create temp table repair_expected_fields as select * from jsonb_to_recordset(${json(expectedFields)}) f("table" text,id uuid,field text,value jsonb);
   create temp table repair_updates(tbl text,id uuid);
   create function pg_temp.record_repair_update() returns trigger language plpgsql as $$ begin
    insert into repair_updates values(tg_table_name,new.id); return null;
   end $$;
   ${tables.map(table => `create trigger repair_audit after update on public.${table} for each row execute function pg_temp.record_repair_update();`).join("\n")}
   -- Exercise the deployed deferral trigger and real search SQL, recording calls.
   create temp table repair_search_calls(namespace text,deferred text);
   alter function public.refresh_game_content_index(text) rename to fixture_refresh_game_content_index;
   create function public.refresh_game_content_index(ns text) returns void language plpgsql as $$ begin
    insert into repair_search_calls values(ns,current_setting('bloxodes.url_move_namespace',true));
    perform public.fixture_refresh_game_content_index(ns);
   end $$;
   create temp table repair_revalidation(kind text,path text,reason text);
   create or replace function public.enqueue_revalidation(text,text,text) returns void language plpgsql as $$ begin
    insert into repair_revalidation values($1,$2,$3);
   end $$;
   ${families.map(kind => `create trigger game_content_changed after insert or update or delete on public.game_${kind}_pages for each row execute function public.trg_game_content_changed();`).join("\n")}
   ${dataTrigger}
   create trigger game_checklist_items_changed after insert or update or delete on public.game_checklist_items for each row execute function public.trg_game_data_changed();
   -- Each guarded destination must independently reject drift. EXECUTE runs the
   -- exact migration body inside an exception subtransaction, preserving atomicity.
   do $fixture$ declare g record; rejected boolean; begin
    for g in select * from repair_guards loop
     update public.site_routes set target_url='/wrong-destination' where path=g.path;
     rejected:=false;
     begin
      execute ${literal(repair)};
     exception when raise_exception then
      if sqlerrm <> ('Reviewed link destination changed: '||g.path) then raise; end if;
      rejected:=true;
     end;
     perform pg_temp.url_assert(rejected,'destination drift was accepted: '||g.path);
     perform pg_temp.url_assert(not exists(select * from repair_updates),'guard failure left partial writes');
     perform pg_temp.url_assert(not exists(select * from repair_search_calls),'guard failure rebuilt search');
     perform pg_temp.url_assert(not exists(select * from repair_revalidation),'guard failure queued revalidation');
     update public.site_routes set target_url=g.target where path=g.path;
    end loop;
   end $fixture$;
   select pg_temp.url_assert(not exists((select * from repair_before except ${snapshot}) union all (${snapshot} except select * from repair_before)),'guard failures preserve complete stored rows');
   -- Reproduce deploy 41446295212 with real map rows under the original guard.
   -- The exception subtransaction must undo ALL earlier page writes/events.
   do $fixture$ declare rejected boolean:=false; failed_constraint text; begin
    begin
     execute ${literal(repair)};
    exception when check_violation then
     get stacked diagnostics failed_constraint = constraint_name;
     if failed_constraint <> 'game_registered_map_snapshot_check' then raise; end if;
     rejected:=true;
    end;
    perform pg_temp.url_assert(rejected,'original map guard did not reproduce production failure');
   end $fixture$;
   select pg_temp.url_assert(not exists((select * from repair_before except ${snapshot}) union all (${snapshot} except select * from repair_before)),'snapshot failure preserves every complete row');
   select pg_temp.url_assert(not exists(select * from repair_updates),'snapshot failure retained updates');
   select pg_temp.url_assert(not exists(select * from repair_revalidation),'snapshot failure retained events');
   select pg_temp.url_assert(not exists(select * from repair_search_calls),'snapshot failure retained search writes');
   create temp table reviewed_maps as select * from jsonb_to_recordset(${json(maps.map(map => ({...map, id: storedId(map.id)})))}) m(id uuid,slug text,renderer text,before_hash text,after_hash text,before jsonb,after jsonb);
   select pg_temp.url_assert(bool_and(public.valid_gta_map_snapshot(slug,renderer,before) is true
    and encode(extensions.digest(before::text,'sha256'),'hex')=before_hash
    and public.valid_gta_map_snapshot(slug,renderer,after) is false),'original guard proves all nine old snapshots and rejects repairs') from reviewed_maps;
   ${snapshotPrerequisite}
   ${readFileSync(new URL("../../../supabase/tests/gta_map_link_snapshots.sql", import.meta.url), "utf8")}
   ${repair}
   create temp table repair_after as ${snapshot};
   -- Full row equality catches accidental prose, JSON, asset or identity edits.
   select pg_temp.url_assert(not exists(
    select 1 from repair_before b full join repair_after a using(tbl,id)
    left join lateral (select jsonb_object_agg(field,value) fields from repair_expected_fields f where f."table"=b.tbl and f.id=b.id) f on true
    where a.value is distinct from b.value||coalesce(f.fields,'{}'::jsonb)
   ),'migration repairs every selected field and preserves all other stored data');
   select pg_temp.url_assert((select count(*)=${expectedFields.length} from repair_updates),'every seeded target field executes an UPDATE');
   select pg_temp.url_assert((select count(*)=3 and count(*) filter(where namespace='gta' and deferred='')=2 and count(*) filter(where namespace='red-dead' and deferred='')=1 from repair_search_calls),'prerequisite and repair defer search until their final namespace refreshes');
   select pg_temp.url_assert(current_setting('bloxodes.url_move_namespace',true)='','deferral cleared');
   create temp table repair_expected_events as ${expectedEvents};
   select pg_temp.url_assert(not exists(
    (select * from repair_revalidation except all select * from repair_expected_events)
    union all (select * from repair_expected_events except all select * from repair_revalidation)
   ),'each field update queues exactly its canonical page, including checklist tasks');
   select pg_temp.url_assert(not exists(select 1 from public.game_checklist_items where id='${missingId}'),'missing selected row stays absent');
   truncate repair_updates,repair_search_calls,repair_revalidation;
   ${snapshotPrerequisite}
   ${repair}
   select pg_temp.url_assert(not exists((select * from repair_after except ${snapshot}) union all (${snapshot} except select * from repair_after)),'migration rerun preserves complete rows');
   select pg_temp.url_assert(not exists(select * from repair_updates),'idempotence: rerun issues no row updates');
   select pg_temp.url_assert(not exists(select * from repair_revalidation),'idempotence: rerun queues no page events');
   select pg_temp.url_assert((select count(*)=3 from repair_search_calls),'rerun only rebuilds the declared namespaces');
  `;
}
