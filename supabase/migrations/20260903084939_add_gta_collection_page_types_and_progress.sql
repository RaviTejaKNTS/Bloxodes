-- GTA collectible pages use the existing collection contract with a checklist
-- renderer and account progress kept separate from immutable content revisions.
begin;

alter table public.gta_wiki_collection_pages
  add column if not exists page_type text not null default 'database';

alter table public.gta_wiki_collection_pages
  drop constraint if exists gta_wiki_collection_pages_page_type_check;

alter table public.gta_wiki_collection_pages
  add constraint gta_wiki_collection_pages_page_type_check
  check (page_type in ('database', 'checklist'));

create index if not exists gta_wiki_collection_pages_type_idx
  on public.gta_wiki_collection_pages (wiki_slug, page_type, wiki_sort_order, title)
  where is_published = true;

create table if not exists public.user_gta_collection_progress (
  user_id uuid not null references public.app_users(user_id) on delete cascade,
  collection_code text not null,
  checked_item_slugs text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, collection_code),
  constraint user_gta_collection_progress_code_not_blank check (length(btrim(collection_code)) > 0),
  constraint user_gta_collection_progress_code_length check (length(collection_code) <= 200)
);

create index if not exists idx_user_gta_collection_progress_code
  on public.user_gta_collection_progress (collection_code);

alter table public.user_gta_collection_progress enable row level security;

drop policy if exists "user_gta_collection_progress_admin" on public.user_gta_collection_progress;
create policy "user_gta_collection_progress_admin" on public.user_gta_collection_progress
  for all
  to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));

drop policy if exists "user_gta_collection_progress_select_own" on public.user_gta_collection_progress;
create policy "user_gta_collection_progress_select_own" on public.user_gta_collection_progress
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "user_gta_collection_progress_insert_own" on public.user_gta_collection_progress;
create policy "user_gta_collection_progress_insert_own" on public.user_gta_collection_progress
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "user_gta_collection_progress_update_own" on public.user_gta_collection_progress;
create policy "user_gta_collection_progress_update_own" on public.user_gta_collection_progress
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "user_gta_collection_progress_delete_own" on public.user_gta_collection_progress;
create policy "user_gta_collection_progress_delete_own" on public.user_gta_collection_progress
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop trigger if exists trg_user_gta_collection_progress_updated_at on public.user_gta_collection_progress;
create trigger trg_user_gta_collection_progress_updated_at
before update on public.user_gta_collection_progress
for each row execute function public.set_updated_at();

revoke all on table public.user_gta_collection_progress from anon, authenticated;
grant all on table public.user_gta_collection_progress to service_role;

notify pgrst, 'reload schema';

commit;
