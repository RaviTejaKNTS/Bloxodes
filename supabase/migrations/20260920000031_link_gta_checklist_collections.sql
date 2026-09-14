-- Keep the San Andreas master checklist copy focused on player actions while
-- leaving exact locations to the linked GTA collection pages.
begin;
update public.gta_checklist_items i
set description = 'Use the linked collection pages for exact locations and item progress.'
from public.gta_checklist_pages p
where i.page_id = p.id
  and p.slug = 'gta-san-andreas'
  and i.item_key = 'collectibles';
commit;
