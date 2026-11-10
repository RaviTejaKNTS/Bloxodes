-- Deleting an unpublished wiki collection dataset failed: the CASE expression
-- read old.dataset_id on wiki_collection_datasets, which has no such column.
-- Mirror the game collection guard: pick the column by table in IF branches.
create or replace function public.protect_published_wiki_collection_runtime()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_dataset_id uuid;
begin
  if tg_op = 'UPDATE' then
    raise exception 'Wiki collection runtime revisions are immutable. Publish a new revision instead.';
  end if;

  if tg_table_name = 'wiki_collection_datasets' then
    target_dataset_id := old.id;
  else
    target_dataset_id := old.dataset_id;
  end if;

  if exists (
    select 1
    from public.wiki_collection_pages page
    where page.published_dataset_id = target_dataset_id
  ) then
    raise exception 'Published wiki collection dataset % is immutable. Publish a new revision instead.', target_dataset_id;
  end if;

  return old;
end;
$$;
