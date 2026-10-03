begin;

-- Activate the exact reviewed revisions together after the edition route deployment.
create or replace function public.activate_minecraft_edition_migration(expected jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  entry record;
  page_row public.minecraft_wiki_collection_pages%rowtype;
  dataset_row public.minecraft_wiki_collection_datasets%rowtype;
  edition_slug text;
  required_slugs text[] := array['armor','armor-trims','biomes','blocks','commands','crops-and-plants','enchantments','food','fuels','items','mobs','music-discs','ores','potions','pottery-sherds','recipes','redstone-components','status-effects','structures','tools','villager-professions','villager-trades','weapons'];
begin
  if jsonb_typeof(expected) <> 'array' or jsonb_array_length(expected) <> 48 then
    raise exception 'An exact 48-revision Minecraft edition allowlist is required';
  end if;
  if (select count(distinct row.code) from jsonb_to_recordset(expected) as row(code text)) <> 48 then
    raise exception 'Edition publication codes must be unique';
  end if;
  foreach edition_slug in array array['minecraft-java','minecraft-bedrock'] loop
    if not exists (select 1 from public.minecraft_games where slug = edition_slug)
      or not exists (select 1 from public.minecraft_wiki_pages wiki join public.minecraft_games game on game.id = wiki.game_id where wiki.slug = edition_slug and game.slug = edition_slug) then
      raise exception 'Stage the owned edition game and wiki before activation: %', edition_slug;
    end if;
    if (select count(*) from jsonb_to_recordset(expected) as row(code text)
      where row.code = any(select edition_slug || '-' || slug from unnest(required_slugs || case when edition_slug = 'minecraft-java' then 'advancements' else 'achievements' end) slug)) <> 24 then
      raise exception 'Unexpected collection inventory for %', edition_slug;
    end if;
  end loop;
  -- Validate every pointer and roster before changing any publication flag.
  for entry in select * from jsonb_to_recordset(expected) as row(code text, content_hash text, item_count integer) loop
    select * into strict page_row from public.minecraft_wiki_collection_pages where code = entry.code for update;
    if page_row.wiki_slug not in ('minecraft-java','minecraft-bedrock') or page_row.code <> page_row.wiki_slug || '-' || page_row.collection_slug then
      raise exception 'Invalid edition ownership for %', entry.code;
    end if;
    select * into strict dataset_row from public.minecraft_wiki_collection_datasets
      where collection_page_id = page_row.id and content_hash = entry.content_hash;
    if entry.item_count is null or entry.item_count < 1 or entry.item_count <> dataset_row.item_count or entry.item_count <> page_row.item_count
      or entry.item_count <> (select count(*) from public.minecraft_wiki_collection_items where dataset_id = dataset_row.id) then
      raise exception 'Incomplete staged revision for %', entry.code;
    end if;
  end loop;
  update public.minecraft_games set is_published = true where slug in ('minecraft-java','minecraft-bedrock');
  update public.minecraft_wiki_pages set is_published = true where slug in ('minecraft-java','minecraft-bedrock');
  for entry in select * from jsonb_to_recordset(expected) as row(code text, content_hash text, item_count integer) loop
    update public.minecraft_wiki_collection_pages page
      set published_dataset_id = dataset.id, is_published = true
      from public.minecraft_wiki_collection_datasets dataset
      where page.code = entry.code and dataset.collection_page_id = page.id and dataset.content_hash = entry.content_hash;
  end loop;
  -- Parent visibility triggers hide the legacy hub and search children atomically.
  update public.minecraft_games set is_published = false where slug = 'minecraft';
  return jsonb_build_object('hubs', 2, 'collections', 48, 'legacy_archived', true);
end;
$$;
revoke all on function public.activate_minecraft_edition_migration(jsonb) from public, anon, authenticated;
grant execute on function public.activate_minecraft_edition_migration(jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
