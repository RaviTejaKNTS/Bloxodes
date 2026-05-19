begin;

delete from public.wiki_catalog_pages
where code = 'adopt-me-gamepasses'
  or (wiki_slug = 'adopt-me' and collection_slug = 'gamepasses');

delete from public.catalog_pages
where code = 'adopt-me-gamepasses';

commit;
