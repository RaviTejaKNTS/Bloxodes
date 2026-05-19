begin;

delete from public.catalog_pages cp
using public.wiki_catalog_pages wcp
where cp.code = wcp.code
  and wcp.wiki_slug in (
    'adopt-me',
    'blox-fruits',
    'brookhaven-rp',
    'grow-a-garden',
    'sailor-piece',
    'steal-a-brainrot',
    'the-forge'
  );

commit;
