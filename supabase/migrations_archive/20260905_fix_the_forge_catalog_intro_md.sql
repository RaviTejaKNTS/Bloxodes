update public.catalog_pages
set intro_md = wiki_md
where code in (
  'the-forge-races',
  'the-forge-ores',
  'the-forge-pickaxes',
  'the-forge-weapons',
  'the-forge-armors',
  'the-forge-runes',
  'the-forge-quests',
  'the-forge-npcs',
  'the-forge-locations',
  'the-forge-enemies',
  'the-forge-essences',
  'the-forge-skills',
  'the-forge-potions',
  'the-forge-totems',
  'the-forge-blueprints'
)
  and wiki_md is not null
  and btrim(wiki_md) <> '';
