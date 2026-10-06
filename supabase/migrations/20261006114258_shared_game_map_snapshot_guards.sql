-- Registered GTA engines accept only the reviewed frozen snapshots.
create function public.valid_gta_map_snapshot(slug text, renderer text, data jsonb) returns boolean language sql immutable set search_path='' as $$
 select renderer=case when slug='gta5' then 'gta5' else 'gta-layered' end and encode(extensions.digest(data::text,'sha256'),'hex')=case slug
 when 'gta-4' then '393f66b8f803a7b34bb6396cfe605fcc7b20d964964e9d70cbd7bf6506085b68'
 when 'gta-chinatown-wars' then '8fee8a2fbaacdc387c84aabff030cf13c110262caf9d8450781a7b998a137832'
 when 'gta-iii' then '7243483239cf9ded6f8a4ae5d82d47802380fa27160041db94451894fafc789f'
 when 'gta-liberty-city-stories' then 'e971f3fb8934fccf58a79a1d562f1b826a7d5d332bcaa2692ca325bd7941b64a'
 when 'gta-online' then 'ecafbe58217508c6ad4e1e48157bcf46f1cd48b30dcd6a455fb5f0c59688c335'
 when 'gta-san-andreas' then '0f47f7b10c793147d2cf777c75a65005f51dd773f392bc197a45f05bb57ffb19'
 when 'gta-vice-city' then 'fd5752da5114de9c2da000e926437651cb283b86ca52096f7e1758b72f9196d4'
 when 'gta-vice-city-stories' then '3506028acc165c5892f23c8a3d6d98abfd989e67bd34452203ec1714b951ca20'
 when 'gta5' then '5a01530f556e974af20f28e02d9e2620d51af2cd8ccd8298c1e59b78eb5ece1f'
 else null end
$$;
revoke all on function public.valid_gta_map_snapshot(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.valid_gta_map_snapshot(text,text,jsonb) to service_role;
alter table public.game_map_pages add constraint game_registered_map_snapshot_check check(renderer_key='image-pins' or public.valid_gta_map_snapshot(slug,renderer_key,map_data) is true);
create function public.protect_game_map_renderer() returns trigger language plpgsql set search_path='' as $$
begin
 if new.renderer_key<>old.renderer_key then raise exception 'Map renderer identity is permanent; use a reviewed migration'; end if;
 return new;
end $$;
create trigger protect_game_map_renderer before update on public.game_map_pages for each row execute function public.protect_game_map_renderer();
