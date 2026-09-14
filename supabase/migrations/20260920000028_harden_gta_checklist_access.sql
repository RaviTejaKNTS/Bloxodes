-- Match the GTA platform's server-only database access. The server view filters
-- both checklist and title publication before exposing public HTML/search.
begin;
revoke all on public.gta_checklist_pages, public.gta_checklist_items, public.gta_checklist_pages_view from anon, authenticated;
drop policy gta_checklist_pages_read on public.gta_checklist_pages;
drop policy gta_checklist_items_read on public.gta_checklist_items;
commit;
