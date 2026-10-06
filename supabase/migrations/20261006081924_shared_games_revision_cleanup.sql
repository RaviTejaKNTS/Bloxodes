begin;
alter table public.game_collection_items drop constraint game_collection_items_dataset_id_fkey;
alter table public.game_collection_items add constraint game_collection_items_dataset_id_fkey foreign key(dataset_id) references public.game_collection_datasets(id) on delete cascade;
alter table public.game_releases alter column game_id set not null;
create or replace function public.protect_published_game_collection_runtime() returns trigger language plpgsql set search_path='' as $$
declare target_dataset_id uuid;
begin
 if tg_op='UPDATE' then raise exception 'Game collection runtime revisions are immutable. Publish a new revision instead.'; end if;
 if tg_table_name='game_collection_datasets' then target_dataset_id:=old.id;
 else
  target_dataset_id:=old.dataset_id;
  -- Serialize item deletion with publication and staged item insertion.
  perform 1 from public.game_collection_datasets where id=target_dataset_id for update;
 end if;
 if exists(select 1 from public.game_collection_pages where published_dataset_id=target_dataset_id) then raise exception 'Published game collection dataset % is immutable. Publish a new revision instead.',target_dataset_id; end if;
 return old;
end $$;
commit;
