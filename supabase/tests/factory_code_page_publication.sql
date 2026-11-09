-- GitHub-only fixture. factory-code-page-sql.test.ts owns BEGIN/ROLLBACK,
-- loads the real migration and supplies the real TypeScript RPC payload.
insert into public.code_pages (id, name, slug, universe_id, is_published,
  intro_md, community_link, discord_link, cover_image) values
  ('00000000-0000-0000-0000-000000000001', 'Old', 'example', 1, false, 'Old intro', 'keep-community', 'clear-discord', 'old-cover'),
  ('00000000-0000-0000-0000-000000000002', 'Other', 'other', 2, true, null, null, null, null),
  ('00000000-0000-0000-0000-000000000003', 'Draft', 'draft', 3, false, null, null, null, null);

-- Fail after the RPC has attempted its credits, at the final source-row update.
create function public.factory_test_fail_update() returns trigger language plpgsql as $$
begin
  if new.intro_md = 'force failure' then raise exception 'forced source update failure'; end if;
  return new;
end $$;
create trigger factory_test_fail_update before update on public.code_pages
  for each row execute function public.factory_test_fail_update();

set local role service_role;

-- unknown field
do $$
declare before_rows jsonb;
begin
  select jsonb_agg(to_jsonb(p) order by id) into before_rows from public.code_pages p;
  begin
    perform public.publish_factory_code_page('00000000-0000-0000-0000-000000000001', '{"game_display_name":"bad"}'::jsonb, repeat('a',64), array['00000000-0000-0000-0000-000000000002']::uuid[]);
    raise exception 'Expected rejection did not happen';
  exception when raise_exception then
    if sqlerrm <> 'Unexpected factory publication field' then raise; end if;
  end;
  if before_rows is distinct from (select jsonb_agg(to_jsonb(p) order by id) from public.code_pages p) then
    raise exception 'Failed RPC left partial writes: unknown field';
  end if;
end $$;

-- universe mismatch
do $$
declare before_rows jsonb;
begin
  select jsonb_agg(to_jsonb(p) order by id) into before_rows from public.code_pages p;
  begin
    perform public.publish_factory_code_page('00000000-0000-0000-0000-000000000001', '{"universe_id":9}'::jsonb, repeat('a',64), array['00000000-0000-0000-0000-000000000002']::uuid[]);
    raise exception 'Expected rejection did not happen';
  exception when raise_exception then
    if sqlerrm <> 'Factory publication identity mismatch' then raise; end if;
  end;
  if before_rows is distinct from (select jsonb_agg(to_jsonb(p) order by id) from public.code_pages p) then
    raise exception 'Failed RPC left partial writes: universe mismatch';
  end if;
end $$;

-- slug mismatch
do $$
declare before_rows jsonb;
begin
  select jsonb_agg(to_jsonb(p) order by id) into before_rows from public.code_pages p;
  begin
    perform public.publish_factory_code_page('00000000-0000-0000-0000-000000000001', '{"slug":"wrong"}'::jsonb, repeat('a',64), array['00000000-0000-0000-0000-000000000002']::uuid[]);
    raise exception 'Expected rejection did not happen';
  exception when raise_exception then
    if sqlerrm <> 'Factory publication identity mismatch' then raise; end if;
  end;
  if before_rows is distinct from (select jsonb_agg(to_jsonb(p) order by id) from public.code_pages p) then
    raise exception 'Failed RPC left partial writes: slug mismatch';
  end if;
end $$;

-- self-credit
do $$
declare before_rows jsonb;
begin
  select jsonb_agg(to_jsonb(p) order by id) into before_rows from public.code_pages p;
  begin
    perform public.publish_factory_code_page('00000000-0000-0000-0000-000000000001', '{}'::jsonb, repeat('a',64), array['00000000-0000-0000-0000-000000000001']::uuid[]);
    raise exception 'Expected rejection did not happen';
  exception when raise_exception then
    if sqlerrm <> 'Factory page cannot credit itself' then raise; end if;
  end;
  if before_rows is distinct from (select jsonb_agg(to_jsonb(p) order by id) from public.code_pages p) then
    raise exception 'Failed RPC left partial writes: self-credit';
  end if;
end $$;

-- unpublished target
do $$
declare before_rows jsonb;
begin
  select jsonb_agg(to_jsonb(p) order by id) into before_rows from public.code_pages p;
  begin
    perform public.publish_factory_code_page('00000000-0000-0000-0000-000000000001', '{}'::jsonb, repeat('a',64), array['00000000-0000-0000-0000-000000000003']::uuid[]);
    raise exception 'Expected rejection did not happen';
  exception when raise_exception then
    if sqlerrm <> 'Linked page is absent or unpublished' then raise; end if;
  end;
  if before_rows is distinct from (select jsonb_agg(to_jsonb(p) order by id) from public.code_pages p) then
    raise exception 'Failed RPC left partial writes: unpublished target';
  end if;
end $$;

-- late failure rolls back credits
do $$
declare before_rows jsonb;
begin
  select jsonb_agg(to_jsonb(p) order by id) into before_rows from public.code_pages p;
  begin
    perform public.publish_factory_code_page('00000000-0000-0000-0000-000000000001', '{"intro_md":"force failure"}'::jsonb, repeat('a',64), array['00000000-0000-0000-0000-000000000002']::uuid[]);
    raise exception 'Expected rejection did not happen';
  exception when raise_exception then
    if sqlerrm <> 'forced source update failure' then raise; end if;
  end;
  if before_rows is distinct from (select jsonb_agg(to_jsonb(p) order by id) from public.code_pages p) then
    raise exception 'Failed RPC left partial writes: late failure rolls back credits';
  end if;
end $$;

-- The mapped production payload, including renamed copy fields and cover.
select public.publish_factory_code_page('00000000-0000-0000-0000-000000000001', (select payload from factory_test_payload),
  repeat('a',64), array['00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002']::uuid[]);
do $$
declare live public.code_pages;
begin
  select * into strict live from public.code_pages where id = '00000000-0000-0000-0000-000000000001';
  if not live.is_published or live.published_at is null
     or live.interlinking_ai->>'bundle_hash' is distinct from repeat('a',64)
     or (live.interlinking_ai->'credited_page_ids' @> jsonb_build_array('00000000-0000-0000-0000-000000000002'::text)) is distinct from true
     or exists (select 1 from jsonb_each((select payload from factory_test_payload)) kv
                where to_jsonb(live)->kv.key is distinct from kv.value) then
    raise exception 'Real TypeScript payload was not stored';
  end if;
  -- The bundle owns Discord, X and YouTube (explicit null clears); the community link is omitted and kept.
  if live.community_link is distinct from 'keep-community' or live.discord_link is not null then
    raise exception 'Omitted fields were overwritten or bundle social links were not applied';
  end if;
end $$;

-- Replays, duplicate IDs and changed bundle hashes must each retain one credit.
select public.publish_factory_code_page('00000000-0000-0000-0000-000000000001', '{}', repeat('a',64), array['00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002']::uuid[]);
select public.publish_factory_code_page('00000000-0000-0000-0000-000000000001', '{"discord_link":null,"source_url":null}',
  repeat('b',64), array['00000000-0000-0000-0000-000000000002']::uuid[]);
do $$
begin
  if (select internal_links from public.code_pages where id = '00000000-0000-0000-0000-000000000002') is distinct from 1
     or (select jsonb_array_length(interlinking_ai->'credited_page_ids') from public.code_pages where id = '00000000-0000-0000-0000-000000000001') is distinct from 1 then
    raise exception 'Duplicate calls credited a link more than once';
  end if;
  if (select discord_link is not null or source_url is not null or community_link is distinct from 'keep-community'
      or intro_md is distinct from 'Intro' from public.code_pages where id = '00000000-0000-0000-0000-000000000001') then
    raise exception 'Explicit nulls or omitted field preservation failed';
  end if;
end $$;
reset role;

set local role anon;
do $$ begin
  begin
    perform public.publish_factory_code_page('00000000-0000-0000-0000-000000000001', '{}', repeat('a',64), '{}'::uuid[]);
    raise exception 'Unprivileged role executed factory RPC';
  exception when insufficient_privilege then
    -- Check the function grant, not an unrelated missing table grant.
    if has_function_privilege(current_user, 'public.publish_factory_code_page(uuid,jsonb,text,uuid[])', 'execute') then
      raise exception 'Unprivileged role has EXECUTE';
    end if;
  end;
end $$;
reset role;

set local role authenticated;
do $$ begin
  begin
    perform public.publish_factory_code_page('00000000-0000-0000-0000-000000000001', '{}', repeat('a',64), '{}'::uuid[]);
    raise exception 'Unprivileged role executed factory RPC';
  exception when insufficient_privilege then
    -- Check the function grant, not an unrelated missing table grant.
    if has_function_privilege(current_user, 'public.publish_factory_code_page(uuid,jsonb,text,uuid[])', 'execute') then
      raise exception 'Unprivileged role has EXECUTE';
    end if;
  end;
end $$;
reset role;
