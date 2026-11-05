-- Included by the GitHub disposable Postgres route harness, inside its transaction.
insert into public.games(id,namespace,slug,title,url_style) values
 ('41000000-0000-0000-0000-000000000001','article-fixture','article-fixture','Article Fixture','namespace');
insert into public.game_wiki_pages(namespace,game_id,slug) values('article-fixture','41000000-0000-0000-0000-000000000001','article-fixture');
insert into public.game_article_pages(namespace,game_id,slug,title,content_md,is_published,published_at) values
 ('article-fixture','41000000-0000-0000-0000-000000000001','article-fixture-guide','Guide','Body',true,'2026-01-02'),
 ('article-fixture','41000000-0000-0000-0000-000000000001','article-fixture-future','Future','Body',true,now()+interval '1 day'),
 ('article-fixture','41000000-0000-0000-0000-000000000001','article-fixture-draft','Draft','Body',false,null);
select pg_temp.url_assert(public.expected_game_page_path('41000000-0000-0000-0000-000000000001','article','article-fixture-guide')='/articles/article-fixture-guide','article flat path for namespace style');
select pg_temp.url_assert((select canonical_path='/articles/article-fixture-guide' from public.game_article_pages where slug='article-fixture-guide'),'prepare article route');
select pg_temp.url_assert((select source='game' and page_type='article' from public.site_routes where path='/articles/article-fixture-guide'),'article registry owner');
select pg_temp.url_assert((select count(*)=1 from public.game_article_pages_view where namespace='article-fixture'),'draft and future article visibility');
select pg_temp.url_assert((select count(*)=1 from public.search_index where entity_type='game_article' and is_published and subtitle like 'article-fixture %'),'article search visibility');
select pg_temp.url_assert(not has_table_privilege('anon','public.game_article_pages','select') and not has_table_privilege('authenticated','public.game_article_pages_view','select'),'service-only article access');
select pg_temp.url_assert((select relrowsecurity from pg_class where oid='public.game_article_pages'::regclass),'article RLS');
-- Cross-table and cross-namespace slug clashes must fail even for drafts.
insert into public.articles(slug,title,content_md,is_published,published_at) values('article-fixture-roblox','Roblox','Body',true,'2026-01-03');
do $$ begin
 begin insert into public.game_article_pages(namespace,game_id,slug,title,content_md) values('article-fixture','41000000-0000-0000-0000-000000000001','article-fixture-roblox','Clash','Body'); raise exception 'expected route collision';
 exception when others then if sqlerrm='expected route collision' then raise; end if; end;
 begin insert into public.articles(slug,title,content_md) values('article-fixture-draft','Clash','Body'); raise exception 'expected reverse route collision';
 exception when others then if sqlerrm='expected reverse route collision' then raise; end if; end;
 begin update public.game_article_pages set slug='changed' where slug='article-fixture-guide'; raise exception 'expected permanent slug';
 exception when others then if sqlerrm='expected permanent slug' then raise; end if; end;
end $$;
-- The union must paginate across source boundaries in SQL, without duplicates.
select pg_temp.url_assert((select array_agg(slug order by published_at desc,id)=array['article-fixture-roblox','article-fixture-guide'] from public.published_articles_view where slug in ('article-fixture-roblox','article-fixture-guide')),'merged chronological article order');
select pg_temp.url_assert((select slug='article-fixture-guide' from public.published_articles_view where slug in ('article-fixture-roblox','article-fixture-guide') order by published_at desc,id offset 1 limit 1),'merged second page');
select pg_temp.url_assert((select article_count=1 and game_slug='article-fixture' from public.game_article_game_summary where game_id='41000000-0000-0000-0000-000000000001'),'per-game article count');
select public.move_game_namespace_to_page_type_urls('article-fixture');
select pg_temp.url_assert((select canonical_path='/articles/article-fixture-guide' from public.game_article_pages where slug='article-fixture-guide'),'namespace move preserves flat article path');
select pg_temp.url_assert((select count(*)=3 from public.expected_site_routes where page_table='game_article_pages' and path like '/articles/article-fixture-%'),'expected route inventory');
update public.games set is_published=false where namespace='article-fixture';
select pg_temp.url_assert(not exists(select 1 from public.game_article_pages_view where namespace='article-fixture'),'hidden game hides articles');
select pg_temp.url_assert(not exists(select 1 from public.published_articles_view where namespace='article-fixture'),'hidden game leaves merged lists');
select pg_temp.url_assert(not exists(select 1 from public.search_index where entity_type='game_article' and is_published and subtitle like 'article-fixture %'),'hidden game hides article search');
-- Publication also depends on the owning game's franchise parent.
insert into public.games(id,namespace,slug,title,kind,is_published) values('42000000-0000-0000-0000-000000000001','article-parent-fixture','article-parent-fixture','Parent','franchise',false);
insert into public.games(id,namespace,slug,title,parent_id,is_published) values('42000000-0000-0000-0000-000000000002','article-parent-fixture','article-child-fixture','Child','42000000-0000-0000-0000-000000000001',true);
insert into public.game_article_pages(namespace,game_id,slug,title,content_md,is_published) values('article-parent-fixture','42000000-0000-0000-0000-000000000002','article-child-guide','Child guide','Body',true);
select pg_temp.url_assert(not exists(select 1 from public.game_article_pages_view where slug='article-child-guide'),'hidden franchise hides child article');
update public.games set is_published=true where id='42000000-0000-0000-0000-000000000001';
select pg_temp.url_assert(exists(select 1 from public.game_article_pages_view where slug='article-child-guide'),'published franchise reveals child article');
do $$ begin
 begin insert into public.game_article_pages(namespace,game_id,slug,title,content_md) values('article-parent-fixture','42000000-0000-0000-0000-000000000002','article-fixture-guide','Clash','Body'); raise exception 'expected cross-game slug collision';
 exception when others then if sqlerrm='expected cross-game slug collision' then raise; end if; end;
end $$;
