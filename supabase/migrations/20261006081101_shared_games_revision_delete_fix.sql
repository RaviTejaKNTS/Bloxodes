begin;
create or replace function public.protect_published_game_collection_runtime() returns trigger language plpgsql set search_path='' as $$
declare target_dataset_id uuid;
begin
 if tg_op='UPDATE' then raise exception 'Game collection runtime revisions are immutable. Publish a new revision instead.'; end if;
 if tg_table_name='game_collection_datasets' then target_dataset_id:=old.id;
 else target_dataset_id:=old.dataset_id; end if;
 if exists(select 1 from public.game_collection_pages where published_dataset_id=target_dataset_id) then raise exception 'Published game collection dataset % is immutable. Publish a new revision instead.',target_dataset_id; end if;
 return old;
end $$;
commit;
