"""Isolated PostgreSQL 17 benchmark. Never connects to a remote database."""
import os, json, time, statistics, threading
from pathlib import Path
from urllib.parse import urlparse
import psycopg
url = os.environ["CI_TRANSACTION_DATABASE_URL"]
assert urlparse(url).hostname in ("localhost","127.0.0.1") and not urlparse(url).query
c = psycopg.connect(url, autocommit=True)
c.execute("set statement_timeout='180s'")
setup = Path("supabase/tests/catalog_membership_setup.sql").read_text().split("-- APPLY MIGRATION HERE")[0]
c.execute(setup)
c.execute("""
alter table roblox_catalog_items add column raw_catalog_json jsonb default '{}'::jsonb,
 add column catalog_status text, add column catalog_status_checked_at timestamptz,
 add column catalog_status_failure_count int default 0, add column last_item_stats_refreshed_at timestamptz;
alter table roblox_music_ids add column payload jsonb;
alter table roblox_decal_ids add column payload jsonb;
insert into catalog_pages(code) select 'roblox-music-ids/games/'||x from unnest(array['jujutsu-shenanigans','murder-mystery-2','adopt-me','brookhaven-rp','fisch','driving-empire','evade','3008','a-dusty-trip','basketball-zero','grand-piece-online','da-hood','retail-tycoon-2','nicos-nextbots','the-strongest-battlegrounds']) x on conflict do nothing;
insert into catalog_pages(code) select 'roblox-decal-ids/games/'||x from unnest(array['da-hood','shindo-life','berry-avenue','jujutsu-shenanigans','spray-paint','bloxstrike']) x on conflict do nothing;
insert into roblox_catalog_items(asset_id,category,subcategory,price_robux,is_for_sale,has_resellers,lowest_resale_price_robux,free_claimability,free_verification_source,free_verified_at,raw_catalog_json)
select g,(array['Accessories','Body','Clothing','AvatarAnimations','Makeup'])[g%5+1],
(array['HeadAccessories','HairAccessories','ClassicShirts','EmoteAnimations','FaceMakeup'])[g%5+1],
case when g%100=0 then 0 else 100 end,true,false,0,'direct','roblox',now(),jsonb_build_object('Name','Item '||g,'Description',repeat(md5(g::text),16)) from generate_series(1,85000) g;
insert into roblox_music_ids select g,case when g%5=0 then 10 else 180 end,g,now(),(array['creator_store_top_week','creator_store_top_month','creator_store_top_year','other'])[g%4+1],jsonb_build_object('text',repeat(md5(g::text),8)) from generate_series(1,60000) g;
insert into roblox_decal_ids select g,'active','Completed','https://image/'||g,g,(array[array['posters'],array['faces'],array['anime']])[g%3+1:g%3+1][1:1],g,'Crosshair '||g,now(),jsonb_build_object('text',repeat(md5(g::text),8)) from generate_series(1,38000) g;
""".replace("(array[array['posters'],array['faces'],array['anime']])[g%3+1:g%3+1][1:1]", "array[(array['posters','faces','anime'])[g%3+1]]"))
# Explicit maps for half the configured games; other pages exercise full fallback sets.
c.execute("""
insert into roblox_music_id_game_usage select x,g,'untested' from unnest(array['forsaken','adopt-me','fisch','evade','3008','da-hood','nicos-nextbots']) x cross join generate_series(1,1000) g;
insert into roblox_decal_id_game_usage select x,g,'untested',g from unnest(array['bloxburg','shindo-life','spray-paint']) x cross join generate_series(1,1000) g;
create index bench_free on roblox_catalog_items(free_verified_at) where price_robux=0 and is_deleted=false and is_for_sale=true and has_resellers=false and lowest_resale_price_robux=0 and free_claimability='direct' and free_verification_source='roblox';
create index bench_music_rank on roblox_music_ids(rank);
create index bench_decal_rank on roblox_decal_ids(curated_rank);
analyze;
""")

# Install the exact rejected development history, then prove forward cleanup.
# Existing cache helpers survive #215 in live development; fixture stubs model them.
for name in ('music_ids','decal_ids','promo_rewards','music_game_usage','decal_game_usage'):
 c.execute(f"create function public.trg_enqueue_revalidation_{name}() returns trigger language plpgsql as $$ begin return null; end $$")
for rejected in sorted(Path("supabase/migrations_archive/catalog-dates-rejected").glob("*.sql")):
 c.execute(rejected.read_text())
# Exact new migration, with no writer-side membership triggers.
migration = next(Path("supabase/migrations").glob("*_catalog_membership_reconciler.sql"))
c.execute(migration.read_text())
assert c.execute("select count(*) from pg_trigger where not tgisinternal and tgname in ('catalog_membership_insert','catalog_membership_update','catalog_membership_delete','initialize_catalog_membership_snapshot','catalog_data_revalidation')").fetchone()[0] == 0
assert c.execute("select count(*) from information_schema.columns where table_name='catalog_membership_snapshots' and column_name='identities'").fetchone()[0] == 0
c.execute("analyze")
# Real unique queue and row enqueue behavior reproduce the old deadlock's lock order.
c.execute("""
create table revalidation_events(entity_type text,slug text,source text,created_at timestamptz default now(),unique(entity_type,slug));
create or replace function public.enqueue_revalidation(p_entity_type text,p_slug text,p_source text) returns void language plpgsql as $$ begin
insert into public.revalidation_events values(p_entity_type,p_slug,p_source,now())
on conflict(entity_type,slug) do update set created_at=now(),source=excluded.source; end $$;
create function bench_item_queue() returns trigger language plpgsql as $$ begin perform public.enqueue_revalidation('catalog','free-roblox-items','item'); return null; end $$;
create trigger bench_item_queue after update on roblox_catalog_items for each row execute function bench_item_queue();
create function bench_page_queue() returns trigger language plpgsql as $$ begin perform public.enqueue_revalidation('catalog',new.code,'page'); return null; end $$;
create trigger bench_page_queue after update on catalog_pages for each row execute function bench_page_queue();
""")
assert c.execute("select refresh_catalog_membership_dates()").fetchone()[0] == 0
original = c.execute("select code,updated_at from catalog_pages order by code").fetchall()
assert c.execute("select refresh_catalog_membership_dates()").fetchone()[0] == 0
assert c.execute("select code,updated_at from catalog_pages order by code").fetchall() == original
# Stats, reorder, and verification changes leave membership alone.
c.execute("update roblox_music_ids set rank=case when rank=1 then 2 when rank=2 then 1 else rank end,verified_at=now()")
assert c.execute("select refresh_catalog_membership_dates()").fetchone()[0] == 0
# A rank crossing affects trending but leaves main music membership alone.
c.execute("update roblox_music_ids set rank=60001 where asset_id=1")
assert c.execute("select refresh_catalog_membership_dates()").fetchone()[0] == 1
# Free expiry is detected independently of writes from a collector.
c.execute("update roblox_catalog_items set free_verified_at=now()-interval '73 hours' where asset_id=100")
assert c.execute("select refresh_catalog_membership_dates()").fetchone()[0] == 1
# Paid-price changes do not move membership dates.
c.execute("update roblox_catalog_items set price_robux=101 where asset_id between 1 and 99")
assert c.execute("select refresh_catalog_membership_dates()").fetchone()[0] == 0
# Deletion changes only affected avatar pages, and the second run is harmless.
c.execute("update roblox_catalog_items set is_deleted=true where asset_id=2")
assert c.execute("select refresh_catalog_membership_dates()").fetchone()[0] > 0
assert c.execute("select refresh_catalog_membership_dates()").fetchone()[0] == 0
# Permissions: clients cannot execute the definer or read its state.
for role in ('anon','authenticated'):
 assert not c.execute("select has_function_privilege(%s,'public.refresh_catalog_membership_dates()','execute')",(role,)).fetchone()[0]
 assert not c.execute("select has_table_privilege(%s,'public.catalog_membership_snapshots','select')",(role,)).fetchone()[0]

# Mapping switches, empty sets and remaining families retain #215's predicates.
for mutation, expect_change in [
 ("insert into roblox_music_id_game_usage values('jujutsu-shenanigans',999999,'untested')", True),
 ("update roblox_music_id_game_usage set compatibility_status='tested' where asset_id=999999", False),
 ("delete from roblox_music_id_game_usage where asset_id=999999", True),
 ("update roblox_decal_ids set curated_rank=null where asset_id=38000", True),
 ("insert into roblox_font_ids values(1,'active','Pending',null)", False),
 ("update roblox_font_ids set thumbnail_state='Completed',thumbnail_url='image'", True),
 ("insert into roblox_emote_commands values('wave',false,1)", False),
 ("update roblox_emote_commands set is_published=true", True),
 ("insert into roblox_promo_rewards values(1,'verified_claimable','promo_code')", True),
 ("update roblox_promo_rewards set status='expired'", False),
 ("update roblox_catalog_items set name=null where asset_id=3", True),
]:
 c.execute(mutation)
 changed=c.execute("select refresh_catalog_membership_dates()").fetchone()[0]
 assert bool(changed)==expect_change,(mutation,changed)
 assert c.execute("select refresh_catalog_membership_dates()").fetchone()[0] == 0

out={"counts":{"items":85000,"music":60000,"decals":38000,"mappings":10000},"refresh_ms":[],"writes_idle_ms":[],"writes_concurrent_ms":[],"blocking_probe":None}
write_sql="update roblox_catalog_items set price_robux=price_robux+1 where asset_id between 1 and 100"
for _ in range(21):
 t=time.perf_counter(); c.execute("select refresh_catalog_membership_dates()");out['refresh_ms'].append((time.perf_counter()-t)*1000)
for _ in range(21):
 t=time.perf_counter();c.execute(write_sql);out['writes_idle_ms'].append((time.perf_counter()-t)*1000)
errors=[]
def refresh_loop():
 try:
  with psycopg.connect(url,autocommit=True) as d:
   d.execute("set statement_timeout='60s'")
   for _ in range(30): d.execute("select refresh_catalog_membership_dates()")
 except Exception as e: errors.append(str(e))
th=threading.Thread(target=refresh_loop);th.start()
for _ in range(21):
 t=time.perf_counter();c.execute(write_sql);out['writes_concurrent_ms'].append((time.perf_counter()-t)*1000)
th.join();assert not errors,errors
# Hold the reconciler transaction open after changed-date writes.
# The source writer must commit within 250ms without a family-lock cycle.
c.execute("update roblox_catalog_items set is_deleted=false where asset_id=2")
c.execute("begin");c.execute("select refresh_catalog_membership_dates()")
with psycopg.connect(url,autocommit=True) as d:
 d.execute("set lock_timeout='250ms'")
 t=time.perf_counter();d.execute(write_sql);out['blocking_probe']={"status":"ok","ms":(time.perf_counter()-t)*1000}
c.execute("rollback")
for key in ('refresh_ms','writes_idle_ms','writes_concurrent_ms'):
 vals=out[key];out[key]={'median':statistics.median(vals),'p95':sorted(vals)[int(.95*(len(vals)-1))],'samples':len(vals)}
Path('tmp').mkdir(exist_ok=True)
Path('tmp/catalog-reconciler-benchmark.json').write_text(json.dumps(out,indent=2))
print(json.dumps(out,indent=2),flush=True)
