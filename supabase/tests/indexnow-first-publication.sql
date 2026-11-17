\set ON_ERROR_STOP on
begin;
-- GitHub's isolated PostgreSQL service only. The harness installs the real
-- table contracts, route migration chain and BEFORE publication guards first.
insert into public.articles(slug,title,content_md,is_published) values('indexnow-existing','Existing','Body',true);
insert into public.articles(slug,title,content_md,is_published,published_at) values('indexnow-unpublished','Past publication','Body',false,now()-interval '1 day');
insert into public.articles(slug,title,content_md) values('indexnow-draft','Draft','Body');
insert into public.authors(slug,name) values('indexnow-existing','Existing');
insert into public.wiki_pages(slug,title,is_published) values('indexnow-existing','Existing',true);
insert into public.wiki_collection_pages(wiki_slug,collection_slug,code,title,seo_title,meta_description,is_published)
 values('indexnow-existing','items','indexnow-existing-items','Items','Items','Items',true);
insert into public.games(namespace,slug,title,kind,is_published,url_style)
 values('indexnow-existing','indexnow-existing','Existing','game',true,'namespace');
insert into public.game_wiki_pages(game_id,namespace,slug,title,is_published)
 select id,namespace,'indexnow-existing','Existing',true from public.games where namespace='indexnow-existing';
insert into public.stats_reports(slug,month,title,meta_description,dek,content,data,feature_image_url,visibility,contract,data_sha256,published_at) values
 ('roblox-january-2090','2090-01-01','Public','Public','Public','{}','{}','https://example.com/image.png','public','stats-report@1','test',now()),
 ('roblox-february-2090','2090-02-01','Hidden','Hidden','Hidden','{}','{}','https://example.com/image.png','hidden','stats-report@1','test',now());

-- APPLY INDEXNOW MIGRATION HERE

do $$
declare p text;
begin
 foreach p in array array['/articles/indexnow-existing','/articles/indexnow-unpublished','/authors/indexnow-existing','/wiki/indexnow-existing','/wiki/indexnow-existing/items','/indexnow-existing','/indexnow-existing/wiki','/stats/reports/roblox-january-2090'] loop
  if not exists(select 1 from public.indexnow_urls where path=p and state='known') then raise exception 'Seed not known: %',p; end if;
 end loop;
 if exists(select 1 from public.indexnow_urls where state='pending') then raise exception 'Release queued existing pages'; end if;
 if exists(select 1 from public.indexnow_pages where page_table='stats_reports' and page_id=(select id::text from public.stats_reports where visibility='hidden')) then raise exception 'Hidden report identity seeded'; end if;
 if exists(select 1 from public.indexnow_urls where path in ('/articles/indexnow-draft','/stats/reports/roblox-february-2090')) then raise exception 'Draft/hidden report seeded'; end if;
 if exists(select 1 from pg_trigger where tgrelid='public.games'::regclass and tgname='zz_indexnow_publication') is not true then raise exception 'Missing games trigger'; end if;
 if exists(select 1 from public.indexnow_pages where page_table='roblox_universes') then raise exception 'Universe history out of scope'; end if;
end $$;

-- Five families, plus the namespace-root game without a matching event.
update public.articles set is_published=true where slug='indexnow-draft';
insert into public.authors(slug,name) values('indexnow-new','New');
insert into public.wiki_collection_pages(wiki_slug,collection_slug,code,title,seo_title,meta_description,is_published)
 values('indexnow-existing','new-items','indexnow-new-items','Items','Items','Items',false);
update public.wiki_collection_pages set is_published=true where collection_slug='new-items';
insert into public.games(namespace,slug,title,kind,is_published,url_style)
 values('indexnow-new','indexnow-new','New','game',false,'namespace');
insert into public.game_wiki_pages(game_id,namespace,slug,title,is_published)
 select id,namespace,'indexnow-new','New',false from public.games where namespace='indexnow-new';
update public.games set is_published=true where namespace='indexnow-new';
update public.game_wiki_pages set is_published=true where namespace='indexnow-new';
update public.stats_reports set visibility='public' where slug='roblox-february-2090';
do $$
declare p text;
begin
 foreach p in array array['/articles/indexnow-draft','/authors/indexnow-new','/wiki/indexnow-existing/new-items','/indexnow-new','/indexnow-new/wiki','/stats/reports/roblox-february-2090'] loop
  if not exists(select 1 from public.indexnow_urls where path=p and state='pending') then raise exception 'First publication missing: %',p; end if;
 end loop;
end $$;

update public.articles set content_md='Updated body' where slug='indexnow-existing';
update public.articles set is_published=false where slug='indexnow-existing';
update public.articles set is_published=true where slug='indexnow-existing';
update public.articles set slug='indexnow-renamed' where slug='indexnow-existing';
do $$
begin
 if not exists(select 1 from public.indexnow_urls where path='/articles/indexnow-renamed' and state='known') then raise exception 'Known identity rename queued'; end if;
 if exists(select 1 from public.claim_indexnow_urls(array['/articles/indexnow-existing','/articles/indexnow-renamed','/articles/indexnow-unpublished'])) then raise exception 'Known URLs claimable'; end if;
 if (select count(*) from public.claim_indexnow_urls(array['/articles/indexnow-draft']))<>1 then raise exception 'First claim missing'; end if;
 if exists(select 1 from public.claim_indexnow_urls(array['/articles/indexnow-draft'])) then raise exception 'Duplicate claim'; end if;
 update public.indexnow_urls set state='failed',detail='Uncertain network send' where path='/articles/indexnow-draft';
 if exists(select 1 from public.claim_indexnow_urls(array['/articles/indexnow-draft'])) then raise exception 'Failure retried'; end if;
end $$;

-- Test queue semantics against real RPCs. Keep the first-publication rows above
-- out of the ordered check batch without deleting any durable identity/history.
update public.indexnow_urls set last_checked_at=now() where state='pending';
insert into public.indexnow_urls(path,state,created_at,last_checked_at) values
 ('/wiki/indexnow-expired','pending',now()-interval '31 days',null),
 ('/wiki/indexnow-never-checked-old','pending',now()-interval '2 days',null),
 ('/wiki/indexnow-never-checked-new','pending',now()-interval '1 day',null),
 ('/wiki/indexnow-previously-checked','pending',now()-interval '3 days',now()-interval '2 minutes');
do $$
declare picked text[];
begin
 select array_agg(path) into picked from public.take_indexnow_pending_checks();
 if picked is distinct from array['/wiki/indexnow-never-checked-old','/wiki/indexnow-never-checked-new','/wiki/indexnow-previously-checked'] then raise exception 'Wrong pending order: %',picked; end if;
 if exists(select 1 from public.take_indexnow_pending_checks()) then raise exception 'Overlapping drain checked reserved rows'; end if;
 if not exists(select 1 from public.indexnow_urls where path='/wiki/indexnow-expired' and state='expired' and detail like '%30 days%') then raise exception 'Expiry missing'; end if;
 if exists(select 1 from public.claim_indexnow_urls(array['/wiki/indexnow-expired'])) then raise exception 'Expired URL claimable'; end if;
 if not exists(select 1 from public.indexnow_urls where path=picked[1] and check_count=1 and last_checked_at is not null) then raise exception 'Check history missing'; end if;
 -- A failed gate records its reason but does not consume the submission claim.
 update public.indexnow_urls set detail='http-404',last_checked_at=now()-interval '61 seconds' where path=picked[1];
 if (select count(*) from public.take_indexnow_pending_checks())<>1 then raise exception 'Failed gate not checked again'; end if;
 if not exists(select 1 from public.indexnow_urls where path=picked[1] and state='pending' and check_count=2 and detail='http-404') then raise exception 'Retry history missing'; end if;
end $$;
insert into public.indexnow_urls(path,state) select '/wiki/indexnow-cap-'||i,'pending' from generate_series(1,101) i;
do $$
begin
 if (select count(*) from public.take_indexnow_pending_checks() where capped)<>100 then raise exception '100-row cap / overflow flag missing'; end if;
 if (select count(*) from public.take_indexnow_pending_checks())<>1 then raise exception 'Cap overflow stranded'; end if;
 if (select count(*) from public.claim_indexnow_urls(array(select '/wiki/indexnow-cap-'||i from generate_series(1,101) i)))<>100 then raise exception 'Claim cap missing'; end if;
end $$;

-- Force a real ledger failure while keeping the editorial table/route intact.
-- The AFTER trigger must roll back its own identity insert and let the write pass.
create function pg_temp.reject_indexnow_url() returns trigger language plpgsql as $$
begin raise exception 'Fixture ledger failure'; end $$;
create trigger indexnow_fixture_failure before insert on public.indexnow_urls for each row execute function pg_temp.reject_indexnow_url();
insert into public.articles(slug,title,content_md,is_published) values('indexnow-failed-trigger','Still published','Body',true);
do $$
begin
 if not exists(select 1 from public.articles where slug='indexnow-failed-trigger' and is_published) then raise exception 'IndexNow blocked content write'; end if;
 if exists(select 1 from public.indexnow_pages where page_table='articles' and page_id=(select id::text from public.articles where slug='indexnow-failed-trigger')) then raise exception 'Failed capture left half an identity'; end if;
 if has_table_privilege('anon','public.indexnow_urls','select') or has_function_privilege('authenticated','public.claim_indexnow_urls(text[])','execute') then raise exception 'Private ledger exposed'; end if;
end $$;
rollback;
