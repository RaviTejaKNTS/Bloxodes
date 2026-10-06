-- Shared non-Roblox content. Preserve source IDs and every revision.

begin;

create table public.games (like public.red_dead_games including defaults including constraints);

alter table public.games add column namespace text not null default '' check (namespace ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

alter table public.games add column kind text not null default 'game' check (kind in ('franchise','game')), add column parent_id uuid;

alter table public.games add primary key(id), add unique(id,namespace), add unique(namespace,slug,kind), add foreign key(parent_id) references public.games(id) deferrable initially deferred;

alter table public.games add constraint games_parent_not_self check (parent_id is null or parent_id <> id);

create index games_parent_idx on public.games(parent_id);

alter table public.games enable row level security;

revoke all on public.games from anon,authenticated;

grant all on public.games to service_role;

create table public.game_wiki_pages (like public.gta_wiki_pages including defaults including constraints);

alter table public.game_wiki_pages add column namespace text not null default '' check (namespace ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

alter table public.game_wiki_pages add primary key(id);

alter table public.game_wiki_pages add column canonical_path text;

create unique index game_wiki_pages_canonical_path_key on public.game_wiki_pages(canonical_path);

alter table public.game_wiki_pages add unique(game_id), add unique(namespace,slug), add unique(id,game_id), add foreign key(game_id,namespace) references public.games(id,namespace);

alter table public.game_wiki_pages enable row level security;

revoke all on public.game_wiki_pages from anon,authenticated;

grant all on public.game_wiki_pages to service_role;

create table public.game_collection_pages (like public.gta_wiki_collection_pages including defaults including constraints);

alter table public.game_collection_pages add column namespace text not null default '' check (namespace ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

alter table public.game_collection_pages add primary key(id);

alter table public.game_collection_pages add column canonical_path text;

create unique index game_collection_pages_canonical_path_key on public.game_collection_pages(canonical_path);

alter table public.game_collection_pages add unique(namespace,code), add unique(namespace,wiki_slug,collection_slug), add foreign key(wiki_page_id,game_id) references public.game_wiki_pages(id,game_id);

alter table public.game_collection_pages enable row level security;

revoke all on public.game_collection_pages from anon,authenticated;

grant all on public.game_collection_pages to service_role;

create table public.game_collection_datasets (like public.gta_wiki_collection_datasets including defaults including constraints);

alter table public.game_collection_datasets add column namespace text not null default '' check (namespace ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

alter table public.game_collection_datasets add primary key(id);

alter table public.game_collection_datasets add unique(collection_page_id,content_hash), add unique(id,collection_page_id), add foreign key(collection_page_id) references public.game_collection_pages(id);

alter table public.game_collection_datasets enable row level security;

revoke all on public.game_collection_datasets from anon,authenticated;

grant all on public.game_collection_datasets to service_role;

create table public.game_collection_items (like public.gta_wiki_collection_items including defaults including constraints);

alter table public.game_collection_items add column namespace text not null default '' check (namespace ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

alter table public.game_collection_items add primary key(id);

alter table public.game_collection_items add unique(dataset_id,item_slug), add foreign key(dataset_id) references public.game_collection_datasets(id);

alter table public.game_collection_items enable row level security;

revoke all on public.game_collection_items from anon,authenticated;

grant all on public.game_collection_items to service_role;

create table public.game_checklist_pages (like public.gta_checklist_pages including defaults including constraints);

alter table public.game_checklist_pages add column namespace text not null default '' check (namespace ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

alter table public.game_checklist_pages add primary key(id);

alter table public.game_checklist_pages add column canonical_path text;

create unique index game_checklist_pages_canonical_path_key on public.game_checklist_pages(canonical_path);

alter table public.game_checklist_pages add unique(namespace,slug), add foreign key(game_id,namespace) references public.games(id,namespace);

alter table public.game_checklist_pages enable row level security;

revoke all on public.game_checklist_pages from anon,authenticated;

grant all on public.game_checklist_pages to service_role;

create table public.game_checklist_items (like public.gta_checklist_items including defaults including constraints);

alter table public.game_checklist_items add column namespace text not null default '' check (namespace ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

alter table public.game_checklist_items add primary key(id);

alter table public.game_checklist_items add unique(page_id,item_key), add foreign key(page_id) references public.game_checklist_pages(id);

alter table public.game_checklist_items enable row level security;

revoke all on public.game_checklist_items from anon,authenticated;

grant all on public.game_checklist_items to service_role;

create table public.game_tool_pages (like public.minecraft_tools including defaults including constraints);

alter table public.game_tool_pages add column namespace text not null default '' check (namespace ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

alter table public.game_tool_pages add primary key(id);

alter table public.game_tool_pages add column canonical_path text;

create unique index game_tool_pages_canonical_path_key on public.game_tool_pages(canonical_path);

alter table public.game_tool_pages add column game_id uuid references public.games(id), add unique(namespace,slug), add unique(namespace,code);

alter table public.game_tool_pages enable row level security;

revoke all on public.game_tool_pages from anon,authenticated;

grant all on public.game_tool_pages to service_role;

create table public.game_releases (like public.minecraft_releases including defaults including constraints);

alter table public.game_releases add column namespace text not null default '' check (namespace ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

alter table public.game_releases add column game_id uuid references public.games(id);

alter table public.game_releases add primary key(namespace,edition,version), add unique(namespace,edition,release_order);

alter table public.game_releases enable row level security;

revoke all on public.game_releases from anon,authenticated;

grant all on public.game_releases to service_role;

create table public.game_collection_progress (like public.user_gta_collection_progress including defaults including constraints);

alter table public.game_collection_progress add column namespace text not null default '' check (namespace ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

alter table public.game_collection_progress add primary key(user_id,namespace,collection_code);

alter table public.game_collection_progress enable row level security;

revoke all on public.game_collection_progress from anon,authenticated;

grant all on public.game_collection_progress to service_role;

alter table public.game_collection_pages add foreign key(published_dataset_id,id) references public.game_collection_datasets(id,collection_page_id) deferrable initially deferred;

insert into public.games(namespace,slug,title,kind,is_published) values('gta','gta','GTA','franchise',true);

insert into public.games(namespace,slug,title,kind,is_published) values('red-dead','red-dead','Red Dead','franchise',true);

insert into public.games(namespace,slug,title,kind,is_published) values('minecraft','minecraft','Minecraft','franchise',true);

insert into public.games(id,slug,title,short_title,installment,developer,publisher,description_md,cover_image,hero_image,official_url,release_dates_json,platforms_json,status,is_published,published_at,created_at,updated_at,namespace,parent_id) select id,slug,title,short_title,installment,developer,publisher,description_md,cover_image,hero_image,official_url,release_dates_json,platforms_json,status,is_published,published_at,created_at,updated_at,'gta',(select id from public.games where namespace='gta' and kind='franchise') from public.gta_games;

insert into public.game_wiki_pages(id,game_id,slug,title,seo_title,meta_description,description_md,cover_image,controls_json,tips_md,is_published,published_at,created_at,updated_at,namespace) select id,game_id,slug,title,seo_title,meta_description,description_md,cover_image,controls_json,tips_md,is_published,published_at,created_at,updated_at,'gta' from public.gta_wiki_pages;

insert into public.game_collection_pages(id,wiki_page_id,game_id,wiki_slug,collection_slug,code,title,display_name,item_count,seo_title,meta_description,intro_md,how_it_works_md,description_md,description_json,faq_json,schema_ld_json,thumb_url,wiki_md,wiki_sort_order,is_published,published_at,created_at,updated_at,published_dataset_id,page_type,namespace) select id,wiki_page_id,game_id,wiki_slug,collection_slug,code,title,display_name,item_count,seo_title,meta_description,intro_md,how_it_works_md,description_md,description_json,faq_json,schema_ld_json,thumb_url,wiki_md,wiki_sort_order,is_published,published_at,created_at,updated_at,published_dataset_id,page_type,'gta' from public.gta_wiki_collection_pages;

insert into public.game_collection_datasets(id,collection_page_id,schema_version,content_hash,item_count,meta_json,validation_json,source_manifest_json,created_at,updated_at,namespace) select id,collection_page_id,schema_version,content_hash,item_count,meta_json,validation_json,source_manifest_json,created_at,updated_at,'gta' from public.gta_wiki_collection_datasets;

insert into public.game_collection_items(id,dataset_id,item_slug,item_name,section,sort_order,image_key,image_mime,image_width,image_height,image_bytes,image_sha256,fields_json,created_at,updated_at,namespace) select id,dataset_id,item_slug,item_name,section,sort_order,image_key,image_mime,image_width,image_height,image_bytes,image_sha256,fields_json,created_at,updated_at,'gta' from public.gta_wiki_collection_items;

insert into public.games(id,slug,title,short_title,installment,content_kind,parent_game_id,developer,publisher,description_md,cover_image,hero_image,official_url,release_dates_json,platforms_json,status,is_published,published_at,created_at,updated_at,namespace,parent_id) select id,slug,title,short_title,installment,content_kind,parent_game_id,developer,publisher,description_md,cover_image,hero_image,official_url,release_dates_json,platforms_json,status,is_published,published_at,created_at,updated_at,'red-dead',(select id from public.games where namespace='red-dead' and kind='franchise') from public.red_dead_games;

insert into public.game_wiki_pages(id,game_id,slug,title,seo_title,meta_description,description_md,cover_image,controls_json,tips_md,is_published,published_at,created_at,updated_at,namespace) select id,game_id,slug,title,seo_title,meta_description,description_md,cover_image,controls_json,tips_md,is_published,published_at,created_at,updated_at,'red-dead' from public.red_dead_wiki_pages;

insert into public.game_collection_pages(id,wiki_page_id,game_id,wiki_slug,collection_slug,code,page_type,title,display_name,item_count,seo_title,meta_description,intro_md,how_it_works_md,description_md,description_json,faq_json,schema_ld_json,thumb_url,wiki_md,wiki_sort_order,is_published,published_at,created_at,updated_at,published_dataset_id,namespace) select id,wiki_page_id,game_id,wiki_slug,collection_slug,code,page_type,title,display_name,item_count,seo_title,meta_description,intro_md,how_it_works_md,description_md,description_json,faq_json,schema_ld_json,thumb_url,wiki_md,wiki_sort_order,is_published,published_at,created_at,updated_at,published_dataset_id,'red-dead' from public.red_dead_wiki_collection_pages;

insert into public.game_collection_datasets(id,collection_page_id,schema_version,content_hash,item_count,meta_json,validation_json,source_manifest_json,created_at,updated_at,namespace) select id,collection_page_id,schema_version,content_hash,item_count,meta_json,validation_json,source_manifest_json,created_at,updated_at,'red-dead' from public.red_dead_wiki_collection_datasets;

insert into public.game_collection_items(id,dataset_id,item_slug,item_name,section,sort_order,image_key,image_mime,image_width,image_height,image_bytes,image_sha256,fields_json,created_at,updated_at,namespace) select id,dataset_id,item_slug,item_name,section,sort_order,image_key,image_mime,image_width,image_height,image_bytes,image_sha256,fields_json,created_at,updated_at,'red-dead' from public.red_dead_wiki_collection_items;

insert into public.games(id,slug,title,short_title,installment,content_kind,parent_game_id,developer,publisher,description_md,cover_image,hero_image,official_url,release_dates_json,platforms_json,status,is_published,published_at,created_at,updated_at,namespace,parent_id) select id,slug,title,short_title,installment,content_kind,parent_game_id,developer,publisher,description_md,cover_image,hero_image,official_url,release_dates_json,platforms_json,status,is_published,published_at,created_at,updated_at,'minecraft',(select id from public.games where namespace='minecraft' and kind='franchise') from public.minecraft_games;

insert into public.game_wiki_pages(id,game_id,slug,title,seo_title,meta_description,description_md,cover_image,controls_json,tips_md,is_published,published_at,created_at,updated_at,namespace) select id,game_id,slug,title,seo_title,meta_description,description_md,cover_image,controls_json,tips_md,is_published,published_at,created_at,updated_at,'minecraft' from public.minecraft_wiki_pages;

insert into public.game_collection_pages(id,wiki_page_id,game_id,wiki_slug,collection_slug,code,page_type,title,display_name,item_count,seo_title,meta_description,intro_md,how_it_works_md,description_md,description_json,faq_json,schema_ld_json,thumb_url,wiki_md,wiki_sort_order,is_published,published_at,created_at,updated_at,published_dataset_id,namespace) select id,wiki_page_id,game_id,wiki_slug,collection_slug,code,page_type,title,display_name,item_count,seo_title,meta_description,intro_md,how_it_works_md,description_md,description_json,faq_json,schema_ld_json,thumb_url,wiki_md,wiki_sort_order,is_published,published_at,created_at,updated_at,published_dataset_id,'minecraft' from public.minecraft_wiki_collection_pages;

insert into public.game_collection_datasets(id,collection_page_id,schema_version,content_hash,item_count,meta_json,validation_json,source_manifest_json,created_at,updated_at,namespace) select id,collection_page_id,schema_version,content_hash,item_count,meta_json,validation_json,source_manifest_json,created_at,updated_at,'minecraft' from public.minecraft_wiki_collection_datasets;

insert into public.game_collection_items(id,dataset_id,item_slug,item_name,section,sort_order,image_key,image_mime,image_width,image_height,image_bytes,image_sha256,fields_json,created_at,updated_at,namespace) select id,dataset_id,item_slug,item_name,section,sort_order,image_key,image_mime,image_width,image_height,image_bytes,image_sha256,fields_json,created_at,updated_at,'minecraft' from public.minecraft_wiki_collection_items;

insert into public.game_checklist_pages(id,game_id,slug,title,seo_title,seo_description,description_md,is_public,published_at,created_at,updated_at,namespace) select id,game_id,slug,title,seo_title,seo_description,description_md,is_public,published_at,created_at,updated_at,'gta' from public.gta_checklist_pages;

insert into public.game_checklist_items(id,page_id,item_key,section_code,title,description,is_required,created_at,updated_at,namespace) select id,page_id,item_key,section_code,title,description,is_required,created_at,updated_at,'gta' from public.gta_checklist_items;

insert into public.game_tool_pages(id,slug,code,title,seo_title,meta_description,intro_md,how_it_works_md,description_md,description_json,faq_json,schema_ld_json,thumb_url,tool_key,rules_json,is_published,published_at,created_at,updated_at,namespace) select id,slug,code,title,seo_title,meta_description,intro_md,how_it_works_md,description_md,description_json,faq_json,schema_ld_json,thumb_url,tool_key,rules_json,is_published,published_at,created_at,updated_at,'minecraft' from public.minecraft_tools;

insert into public.game_releases(edition,version,release_order,released_at,source_url,is_stable,checked_at,namespace) select edition,version,release_order,released_at,source_url,is_stable,checked_at,'minecraft' from public.minecraft_releases;

insert into public.game_collection_progress(user_id,collection_code,checked_item_slugs,created_at,updated_at,namespace) select user_id,collection_code,checked_item_slugs,created_at,updated_at,'gta' from public.user_gta_collection_progress;

insert into public.game_collection_progress(user_id,collection_code,checked_item_slugs,created_at,updated_at,namespace) select user_id,collection_code,checked_item_slugs,created_at,updated_at,'red-dead' from public.user_red_dead_collection_progress;

update public.game_wiki_pages set canonical_path = case when namespace='minecraft' and slug in ('minecraft-java','minecraft-bedrock') then '/minecraft/'||replace(slug,'minecraft-','')||'/wiki' else '/'||namespace||'/wiki/'||slug end;

update public.game_wiki_pages set canonical_path='/minecraft/wiki' where namespace='minecraft' and slug='minecraft';

update public.game_collection_pages p set canonical_path=w.canonical_path||'/'||p.collection_slug from public.game_wiki_pages w where w.id=p.wiki_page_id;

update public.game_tool_pages set canonical_path='/'||namespace||'/tools/'||slug, game_id=(select id from public.games where namespace='minecraft' and kind='franchise');

update public.game_checklist_pages set canonical_path='/'||namespace||'/checklists/'||slug;

update public.game_releases r set game_id=g.id from public.games g where g.namespace=r.namespace and g.slug='minecraft-'||r.edition and g.kind='game';

do $$ begin if exists((select id,slug,title,short_title,installment,developer,publisher,description_md,cover_image,hero_image,official_url,release_dates_json,platforms_json,status,is_published,published_at,created_at,updated_at from public.gta_games except select id,slug,title,short_title,installment,developer,publisher,description_md,cover_image,hero_image,official_url,release_dates_json,platforms_json,status,is_published,published_at,created_at,updated_at from public.games where namespace='gta' and kind='game') union all (select id,slug,title,short_title,installment,developer,publisher,description_md,cover_image,hero_image,official_url,release_dates_json,platforms_json,status,is_published,published_at,created_at,updated_at from public.games where namespace='gta' and kind='game' except select id,slug,title,short_title,installment,developer,publisher,description_md,cover_image,hero_image,official_url,release_dates_json,platforms_json,status,is_published,published_at,created_at,updated_at from public.gta_games)) then raise exception 'Copy mismatch: gta_games'; end if; end $$;

do $$ begin if exists((select id,game_id,slug,title,seo_title,meta_description,description_md,cover_image,controls_json,tips_md,is_published,published_at,created_at,updated_at from public.gta_wiki_pages except select id,game_id,slug,title,seo_title,meta_description,description_md,cover_image,controls_json,tips_md,is_published,published_at,created_at,updated_at from public.game_wiki_pages where namespace='gta') union all (select id,game_id,slug,title,seo_title,meta_description,description_md,cover_image,controls_json,tips_md,is_published,published_at,created_at,updated_at from public.game_wiki_pages where namespace='gta' except select id,game_id,slug,title,seo_title,meta_description,description_md,cover_image,controls_json,tips_md,is_published,published_at,created_at,updated_at from public.gta_wiki_pages)) then raise exception 'Copy mismatch: gta_wiki_pages'; end if; end $$;

do $$ begin if exists((select id,wiki_page_id,game_id,wiki_slug,collection_slug,code,title,display_name,item_count,seo_title,meta_description,intro_md,how_it_works_md,description_md,description_json,faq_json,schema_ld_json,thumb_url,wiki_md,wiki_sort_order,is_published,published_at,created_at,updated_at,published_dataset_id,page_type from public.gta_wiki_collection_pages except select id,wiki_page_id,game_id,wiki_slug,collection_slug,code,title,display_name,item_count,seo_title,meta_description,intro_md,how_it_works_md,description_md,description_json,faq_json,schema_ld_json,thumb_url,wiki_md,wiki_sort_order,is_published,published_at,created_at,updated_at,published_dataset_id,page_type from public.game_collection_pages where namespace='gta') union all (select id,wiki_page_id,game_id,wiki_slug,collection_slug,code,title,display_name,item_count,seo_title,meta_description,intro_md,how_it_works_md,description_md,description_json,faq_json,schema_ld_json,thumb_url,wiki_md,wiki_sort_order,is_published,published_at,created_at,updated_at,published_dataset_id,page_type from public.game_collection_pages where namespace='gta' except select id,wiki_page_id,game_id,wiki_slug,collection_slug,code,title,display_name,item_count,seo_title,meta_description,intro_md,how_it_works_md,description_md,description_json,faq_json,schema_ld_json,thumb_url,wiki_md,wiki_sort_order,is_published,published_at,created_at,updated_at,published_dataset_id,page_type from public.gta_wiki_collection_pages)) then raise exception 'Copy mismatch: gta_wiki_collection_pages'; end if; end $$;

do $$ begin if exists((select id,collection_page_id,schema_version,content_hash,item_count,meta_json,validation_json,source_manifest_json,created_at,updated_at from public.gta_wiki_collection_datasets except select id,collection_page_id,schema_version,content_hash,item_count,meta_json,validation_json,source_manifest_json,created_at,updated_at from public.game_collection_datasets where namespace='gta') union all (select id,collection_page_id,schema_version,content_hash,item_count,meta_json,validation_json,source_manifest_json,created_at,updated_at from public.game_collection_datasets where namespace='gta' except select id,collection_page_id,schema_version,content_hash,item_count,meta_json,validation_json,source_manifest_json,created_at,updated_at from public.gta_wiki_collection_datasets)) then raise exception 'Copy mismatch: gta_wiki_collection_datasets'; end if; end $$;

do $$ begin if exists((select id,dataset_id,item_slug,item_name,section,sort_order,image_key,image_mime,image_width,image_height,image_bytes,image_sha256,fields_json,created_at,updated_at from public.gta_wiki_collection_items except select id,dataset_id,item_slug,item_name,section,sort_order,image_key,image_mime,image_width,image_height,image_bytes,image_sha256,fields_json,created_at,updated_at from public.game_collection_items where namespace='gta') union all (select id,dataset_id,item_slug,item_name,section,sort_order,image_key,image_mime,image_width,image_height,image_bytes,image_sha256,fields_json,created_at,updated_at from public.game_collection_items where namespace='gta' except select id,dataset_id,item_slug,item_name,section,sort_order,image_key,image_mime,image_width,image_height,image_bytes,image_sha256,fields_json,created_at,updated_at from public.gta_wiki_collection_items)) then raise exception 'Copy mismatch: gta_wiki_collection_items'; end if; end $$;

do $$ begin if exists((select id,slug,title,short_title,installment,content_kind,parent_game_id,developer,publisher,description_md,cover_image,hero_image,official_url,release_dates_json,platforms_json,status,is_published,published_at,created_at,updated_at from public.red_dead_games except select id,slug,title,short_title,installment,content_kind,parent_game_id,developer,publisher,description_md,cover_image,hero_image,official_url,release_dates_json,platforms_json,status,is_published,published_at,created_at,updated_at from public.games where namespace='red-dead' and kind='game') union all (select id,slug,title,short_title,installment,content_kind,parent_game_id,developer,publisher,description_md,cover_image,hero_image,official_url,release_dates_json,platforms_json,status,is_published,published_at,created_at,updated_at from public.games where namespace='red-dead' and kind='game' except select id,slug,title,short_title,installment,content_kind,parent_game_id,developer,publisher,description_md,cover_image,hero_image,official_url,release_dates_json,platforms_json,status,is_published,published_at,created_at,updated_at from public.red_dead_games)) then raise exception 'Copy mismatch: red_dead_games'; end if; end $$;

do $$ begin if exists((select id,game_id,slug,title,seo_title,meta_description,description_md,cover_image,controls_json,tips_md,is_published,published_at,created_at,updated_at from public.red_dead_wiki_pages except select id,game_id,slug,title,seo_title,meta_description,description_md,cover_image,controls_json,tips_md,is_published,published_at,created_at,updated_at from public.game_wiki_pages where namespace='red-dead') union all (select id,game_id,slug,title,seo_title,meta_description,description_md,cover_image,controls_json,tips_md,is_published,published_at,created_at,updated_at from public.game_wiki_pages where namespace='red-dead' except select id,game_id,slug,title,seo_title,meta_description,description_md,cover_image,controls_json,tips_md,is_published,published_at,created_at,updated_at from public.red_dead_wiki_pages)) then raise exception 'Copy mismatch: red_dead_wiki_pages'; end if; end $$;

do $$ begin if exists((select id,wiki_page_id,game_id,wiki_slug,collection_slug,code,page_type,title,display_name,item_count,seo_title,meta_description,intro_md,how_it_works_md,description_md,description_json,faq_json,schema_ld_json,thumb_url,wiki_md,wiki_sort_order,is_published,published_at,created_at,updated_at,published_dataset_id from public.red_dead_wiki_collection_pages except select id,wiki_page_id,game_id,wiki_slug,collection_slug,code,page_type,title,display_name,item_count,seo_title,meta_description,intro_md,how_it_works_md,description_md,description_json,faq_json,schema_ld_json,thumb_url,wiki_md,wiki_sort_order,is_published,published_at,created_at,updated_at,published_dataset_id from public.game_collection_pages where namespace='red-dead') union all (select id,wiki_page_id,game_id,wiki_slug,collection_slug,code,page_type,title,display_name,item_count,seo_title,meta_description,intro_md,how_it_works_md,description_md,description_json,faq_json,schema_ld_json,thumb_url,wiki_md,wiki_sort_order,is_published,published_at,created_at,updated_at,published_dataset_id from public.game_collection_pages where namespace='red-dead' except select id,wiki_page_id,game_id,wiki_slug,collection_slug,code,page_type,title,display_name,item_count,seo_title,meta_description,intro_md,how_it_works_md,description_md,description_json,faq_json,schema_ld_json,thumb_url,wiki_md,wiki_sort_order,is_published,published_at,created_at,updated_at,published_dataset_id from public.red_dead_wiki_collection_pages)) then raise exception 'Copy mismatch: red_dead_wiki_collection_pages'; end if; end $$;

do $$ begin if exists((select id,collection_page_id,schema_version,content_hash,item_count,meta_json,validation_json,source_manifest_json,created_at,updated_at from public.red_dead_wiki_collection_datasets except select id,collection_page_id,schema_version,content_hash,item_count,meta_json,validation_json,source_manifest_json,created_at,updated_at from public.game_collection_datasets where namespace='red-dead') union all (select id,collection_page_id,schema_version,content_hash,item_count,meta_json,validation_json,source_manifest_json,created_at,updated_at from public.game_collection_datasets where namespace='red-dead' except select id,collection_page_id,schema_version,content_hash,item_count,meta_json,validation_json,source_manifest_json,created_at,updated_at from public.red_dead_wiki_collection_datasets)) then raise exception 'Copy mismatch: red_dead_wiki_collection_datasets'; end if; end $$;

do $$ begin if exists((select id,dataset_id,item_slug,item_name,section,sort_order,image_key,image_mime,image_width,image_height,image_bytes,image_sha256,fields_json,created_at,updated_at from public.red_dead_wiki_collection_items except select id,dataset_id,item_slug,item_name,section,sort_order,image_key,image_mime,image_width,image_height,image_bytes,image_sha256,fields_json,created_at,updated_at from public.game_collection_items where namespace='red-dead') union all (select id,dataset_id,item_slug,item_name,section,sort_order,image_key,image_mime,image_width,image_height,image_bytes,image_sha256,fields_json,created_at,updated_at from public.game_collection_items where namespace='red-dead' except select id,dataset_id,item_slug,item_name,section,sort_order,image_key,image_mime,image_width,image_height,image_bytes,image_sha256,fields_json,created_at,updated_at from public.red_dead_wiki_collection_items)) then raise exception 'Copy mismatch: red_dead_wiki_collection_items'; end if; end $$;

do $$ begin if exists((select id,slug,title,short_title,installment,content_kind,parent_game_id,developer,publisher,description_md,cover_image,hero_image,official_url,release_dates_json,platforms_json,status,is_published,published_at,created_at,updated_at from public.minecraft_games except select id,slug,title,short_title,installment,content_kind,parent_game_id,developer,publisher,description_md,cover_image,hero_image,official_url,release_dates_json,platforms_json,status,is_published,published_at,created_at,updated_at from public.games where namespace='minecraft' and kind='game') union all (select id,slug,title,short_title,installment,content_kind,parent_game_id,developer,publisher,description_md,cover_image,hero_image,official_url,release_dates_json,platforms_json,status,is_published,published_at,created_at,updated_at from public.games where namespace='minecraft' and kind='game' except select id,slug,title,short_title,installment,content_kind,parent_game_id,developer,publisher,description_md,cover_image,hero_image,official_url,release_dates_json,platforms_json,status,is_published,published_at,created_at,updated_at from public.minecraft_games)) then raise exception 'Copy mismatch: minecraft_games'; end if; end $$;

do $$ begin if exists((select id,game_id,slug,title,seo_title,meta_description,description_md,cover_image,controls_json,tips_md,is_published,published_at,created_at,updated_at from public.minecraft_wiki_pages except select id,game_id,slug,title,seo_title,meta_description,description_md,cover_image,controls_json,tips_md,is_published,published_at,created_at,updated_at from public.game_wiki_pages where namespace='minecraft') union all (select id,game_id,slug,title,seo_title,meta_description,description_md,cover_image,controls_json,tips_md,is_published,published_at,created_at,updated_at from public.game_wiki_pages where namespace='minecraft' except select id,game_id,slug,title,seo_title,meta_description,description_md,cover_image,controls_json,tips_md,is_published,published_at,created_at,updated_at from public.minecraft_wiki_pages)) then raise exception 'Copy mismatch: minecraft_wiki_pages'; end if; end $$;

do $$ begin if exists((select id,wiki_page_id,game_id,wiki_slug,collection_slug,code,page_type,title,display_name,item_count,seo_title,meta_description,intro_md,how_it_works_md,description_md,description_json,faq_json,schema_ld_json,thumb_url,wiki_md,wiki_sort_order,is_published,published_at,created_at,updated_at,published_dataset_id from public.minecraft_wiki_collection_pages except select id,wiki_page_id,game_id,wiki_slug,collection_slug,code,page_type,title,display_name,item_count,seo_title,meta_description,intro_md,how_it_works_md,description_md,description_json,faq_json,schema_ld_json,thumb_url,wiki_md,wiki_sort_order,is_published,published_at,created_at,updated_at,published_dataset_id from public.game_collection_pages where namespace='minecraft') union all (select id,wiki_page_id,game_id,wiki_slug,collection_slug,code,page_type,title,display_name,item_count,seo_title,meta_description,intro_md,how_it_works_md,description_md,description_json,faq_json,schema_ld_json,thumb_url,wiki_md,wiki_sort_order,is_published,published_at,created_at,updated_at,published_dataset_id from public.game_collection_pages where namespace='minecraft' except select id,wiki_page_id,game_id,wiki_slug,collection_slug,code,page_type,title,display_name,item_count,seo_title,meta_description,intro_md,how_it_works_md,description_md,description_json,faq_json,schema_ld_json,thumb_url,wiki_md,wiki_sort_order,is_published,published_at,created_at,updated_at,published_dataset_id from public.minecraft_wiki_collection_pages)) then raise exception 'Copy mismatch: minecraft_wiki_collection_pages'; end if; end $$;

do $$ begin if exists((select id,collection_page_id,schema_version,content_hash,item_count,meta_json,validation_json,source_manifest_json,created_at,updated_at from public.minecraft_wiki_collection_datasets except select id,collection_page_id,schema_version,content_hash,item_count,meta_json,validation_json,source_manifest_json,created_at,updated_at from public.game_collection_datasets where namespace='minecraft') union all (select id,collection_page_id,schema_version,content_hash,item_count,meta_json,validation_json,source_manifest_json,created_at,updated_at from public.game_collection_datasets where namespace='minecraft' except select id,collection_page_id,schema_version,content_hash,item_count,meta_json,validation_json,source_manifest_json,created_at,updated_at from public.minecraft_wiki_collection_datasets)) then raise exception 'Copy mismatch: minecraft_wiki_collection_datasets'; end if; end $$;

do $$ begin if exists((select id,dataset_id,item_slug,item_name,section,sort_order,image_key,image_mime,image_width,image_height,image_bytes,image_sha256,fields_json,created_at,updated_at from public.minecraft_wiki_collection_items except select id,dataset_id,item_slug,item_name,section,sort_order,image_key,image_mime,image_width,image_height,image_bytes,image_sha256,fields_json,created_at,updated_at from public.game_collection_items where namespace='minecraft') union all (select id,dataset_id,item_slug,item_name,section,sort_order,image_key,image_mime,image_width,image_height,image_bytes,image_sha256,fields_json,created_at,updated_at from public.game_collection_items where namespace='minecraft' except select id,dataset_id,item_slug,item_name,section,sort_order,image_key,image_mime,image_width,image_height,image_bytes,image_sha256,fields_json,created_at,updated_at from public.minecraft_wiki_collection_items)) then raise exception 'Copy mismatch: minecraft_wiki_collection_items'; end if; end $$;

create view public.game_wiki_pages_view with(security_invoker=true) as select w.*, greatest(w.updated_at,coalesce(w.published_at,w.updated_at)) content_updated_at,g.title game_title,g.short_title game_short_title,g.installment game_installment,g.content_kind game_content_kind,g.parent_game_id game_parent_game_id,g.kind game_kind,g.parent_id,g.developer game_developer,g.publisher game_publisher,g.description_md game_description_md,g.cover_image game_cover_image,g.hero_image game_hero_image,g.official_url game_official_url,g.release_dates_json game_release_dates_json,g.platforms_json game_platforms_json,g.status game_status from public.game_wiki_pages w join public.games g on g.id=w.game_id where g.is_published;

create view public.game_collection_pages_view with(security_invoker=true) as select p.*,greatest(p.updated_at,coalesce(p.published_at,p.updated_at)) content_updated_at,g.title game_title,g.short_title game_short_title,g.content_kind game_content_kind,g.parent_game_id game_parent_game_id,g.cover_image game_cover_image,g.hero_image game_hero_image from public.game_collection_pages p join public.games g on g.id=p.game_id join public.game_wiki_pages w on w.id=p.wiki_page_id where g.is_published and w.is_published;

create view public.game_tool_pages_view with(security_invoker=true) as select p.*,greatest(p.updated_at,coalesce(p.published_at,p.updated_at)) content_updated_at from public.game_tool_pages p join public.games g on g.id=p.game_id where g.is_published;

create view public.game_checklist_pages_view with(security_invoker=true) as select p.*,g.title game_title,g.slug game_slug,g.hero_image image,(select count(*) from public.game_checklist_items i where i.page_id=p.id and cardinality(string_to_array(i.section_code,'.'))=3) leaf_item_count,greatest(p.updated_at,(select max(i.updated_at) from public.game_checklist_items i where i.page_id=p.id)) content_updated_at from public.game_checklist_pages p join public.games g on g.id=p.game_id where p.is_public and p.published_at<=now() and g.is_published;

revoke all on public.game_wiki_pages_view from anon,authenticated; grant select on public.game_wiki_pages_view to service_role;

revoke all on public.game_collection_pages_view from anon,authenticated; grant select on public.game_collection_pages_view to service_role;

revoke all on public.game_tool_pages_view from anon,authenticated; grant select on public.game_tool_pages_view to service_role;

revoke all on public.game_checklist_pages_view from anon,authenticated; grant select on public.game_checklist_pages_view to service_role;

create table public.game_code_pages(id uuid primary key default gen_random_uuid(),game_id uuid not null references public.games(id),namespace text not null,slug text not null,title text not null,seo_title text,meta_description text,intro_md text,redeem_md text,rewards_md text,troubleshoot_md text,find_codes_md text,sources_json jsonb not null default '[]',faq_json jsonb not null default '[]',canonical_path text unique,is_published boolean not null default false,published_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(game_id),unique(namespace,slug),foreign key(game_id,namespace) references public.games(id,namespace));

create table public.game_codes(id uuid primary key default gen_random_uuid(),code_page_id uuid not null references public.game_code_pages(id),code text not null,rewards_text text,status text not null check(status in ('active','expired','check')),first_seen_at timestamptz not null default now(),last_seen_at timestamptz not null default now(),verified_at timestamptz,source_url text,unique(code_page_id,code));

alter table public.game_code_pages enable row level security; revoke all on public.game_code_pages from anon,authenticated; grant all on public.game_code_pages to service_role;

alter table public.game_codes enable row level security; revoke all on public.game_codes from anon,authenticated; grant all on public.game_codes to service_role;

create function public.prepare_game_content() returns trigger language plpgsql set search_path='' as $$
declare g public.games%rowtype; root public.games%rowtype; wiki public.game_wiki_pages%rowtype; base text;
begin
 if tg_table_name='games' then
  if new.kind='game' and new.parent_id is null then select id into new.parent_id from public.games where namespace=new.namespace and kind='franchise'; end if;
  if new.parent_id is not null and not exists(select 1 from public.games where id=new.parent_id and kind='franchise' and namespace=new.namespace) then raise exception 'Game parent must be its franchise'; end if;
  return new;
 end if;
 if tg_table_name='game_collection_pages' then
  select * into strict wiki from public.game_wiki_pages where id=new.wiki_page_id;
  if new.game_id<>wiki.game_id or new.namespace<>wiki.namespace or new.wiki_slug<>wiki.slug then raise exception 'Collection wiki ownership mismatch'; end if;
  if new.canonical_path is null then new.canonical_path:=wiki.canonical_path||'/'||new.collection_slug; end if;
 else
  select * into strict g from public.games where id=new.game_id;
  if new.namespace<>g.namespace then raise exception 'Page game ownership mismatch'; end if;
  select * into root from public.games where id=coalesce(g.parent_id,g.id);
  base:='/'||root.slug;
  if new.canonical_path is null then
   if tg_table_name='game_wiki_pages' then new.canonical_path:=base||'/wiki'||case when g.parent_id is null then '' else '/'||g.slug end;
   elsif tg_table_name='game_code_pages' then new.canonical_path:=base||'/codes'||case when g.parent_id is null then '' else '/'||g.slug end;
   elsif tg_table_name='game_tool_pages' then new.canonical_path:=base||'/tools/'||new.slug;
   else new.canonical_path:=base||'/checklists/'||new.slug; end if;
  end if;
 end if;
 if new.canonical_path !~ '^/[a-z0-9/-]+$' or new.canonical_path like '%..%' then raise exception 'Invalid game content path'; end if;
 if tg_table_name<>'game_checklist_pages' and new.is_published and new.published_at is null then new.published_at:=now(); end if;
 return new;
end $$;

create trigger prepare_game_content before insert or update on public.games for each row execute function public.prepare_game_content();

create trigger prepare_game_content before insert or update on public.game_wiki_pages for each row execute function public.prepare_game_content();

create trigger prepare_game_content before insert or update on public.game_collection_pages for each row execute function public.prepare_game_content();

create trigger prepare_game_content before insert or update on public.game_tool_pages for each row execute function public.prepare_game_content();

create trigger prepare_game_content before insert or update on public.game_code_pages for each row execute function public.prepare_game_content();

create trigger prepare_game_content before insert or update on public.game_checklist_pages for each row execute function public.prepare_game_content();

CREATE FUNCTION "public"."protect_published_game_collection_runtime"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  target_dataset_id uuid;
begin
  if tg_op = 'UPDATE' then
    raise exception 'Game collection runtime revisions are immutable. Publish a new revision instead.';
  end if;

  target_dataset_id := case
    when tg_table_name = 'game_collection_datasets' then old.id
    else old.dataset_id
  end;

  if exists (
    select 1 from public.game_collection_pages page
    where page.published_dataset_id = target_dataset_id
  ) then
    raise exception 'Published Game collection dataset % is immutable. Publish a new revision instead.', target_dataset_id;
  end if;

  return old;
end;
$$;

CREATE FUNCTION "public"."validate_game_collection_publication"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare expected_count integer; actual_count integer;
begin
  if new.is_published then
    if new.published_dataset_id is null then raise exception 'Published Game collections require a dataset.'; end if;
    select item_count into expected_count from public.game_collection_datasets where id = new.published_dataset_id and collection_page_id = new.id;
    select count(*) into actual_count from public.game_collection_items where dataset_id = new.published_dataset_id;
    if expected_count is null or expected_count <> actual_count or new.item_count <> actual_count or actual_count = 0 then
      raise exception 'Game collection publication count or ownership mismatch.';
    end if;
  end if;
  return new;
end;
$$;

create trigger protect_game_revision before update or delete on public.game_collection_datasets for each row execute function public.protect_published_game_collection_runtime();

create trigger protect_game_revision before update or delete on public.game_collection_items for each row execute function public.protect_published_game_collection_runtime();

create trigger validate_game_publication before insert or update on public.game_collection_pages for each row execute function public.validate_game_collection_publication();

create function public.prepare_game_data_owner() returns trigger language plpgsql set search_path='' as $$
declare owner_namespace text;
begin
 if tg_table_name='game_collection_datasets' then select namespace into owner_namespace from public.game_collection_pages where id=new.collection_page_id;
 elsif tg_table_name='game_collection_items' then select namespace into owner_namespace from public.game_collection_datasets where id=new.dataset_id;
 elsif tg_table_name='game_checklist_items' then select namespace into owner_namespace from public.game_checklist_pages where id=new.page_id;
 else return new; end if;
 if owner_namespace is null or (new.namespace<>'' and new.namespace<>owner_namespace) then raise exception 'Game data ownership mismatch'; end if;
 new.namespace:=owner_namespace;
 return new;
end $$;

create trigger prepare_game_data_owner before insert or update on public.game_collection_datasets for each row execute function public.prepare_game_data_owner();

create trigger prepare_game_data_owner before insert or update on public.game_collection_items for each row execute function public.prepare_game_data_owner();

create trigger prepare_game_data_owner before insert or update on public.game_checklist_items for each row execute function public.prepare_game_data_owner();

commit;
