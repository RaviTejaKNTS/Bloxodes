-- Keep one permissive policy per action on the GTA checklist progress table.
-- The service-role API remains the only app data path today, while this keeps
-- future authenticated grants safe for both owners and administrators.
begin;

drop policy if exists "user_gta_collection_progress_admin" on public.user_gta_collection_progress;
drop policy if exists "user_gta_collection_progress_select_own" on public.user_gta_collection_progress;
drop policy if exists "user_gta_collection_progress_insert_own" on public.user_gta_collection_progress;
drop policy if exists "user_gta_collection_progress_update_own" on public.user_gta_collection_progress;
drop policy if exists "user_gta_collection_progress_delete_own" on public.user_gta_collection_progress;

create policy "user_gta_collection_progress_select" on public.user_gta_collection_progress
  for select
  to authenticated
  using ((select auth.uid()) = user_id or public.is_admin((select auth.uid())));

create policy "user_gta_collection_progress_insert" on public.user_gta_collection_progress
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id or public.is_admin((select auth.uid())));

create policy "user_gta_collection_progress_update" on public.user_gta_collection_progress
  for update
  to authenticated
  using ((select auth.uid()) = user_id or public.is_admin((select auth.uid())))
  with check ((select auth.uid()) = user_id or public.is_admin((select auth.uid())));

create policy "user_gta_collection_progress_delete" on public.user_gta_collection_progress
  for delete
  to authenticated
  using ((select auth.uid()) = user_id or public.is_admin((select auth.uid())));

notify pgrst, 'reload schema';

commit;
