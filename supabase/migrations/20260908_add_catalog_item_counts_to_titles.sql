update public.catalog_pages as cp
set
  title = updates.title,
  seo_title = updates.seo_title
from (
  values
    ('the-forge-ores', 'All 88 Ores in The Forge', 'All 88 Ores in The Forge'),
    ('the-forge-weapons', 'All 41 Weapons in The Forge', 'All 41 Weapons in The Forge'),
    ('the-forge-armors', 'All 25 Armors in The Forge', 'All 25 Armors in The Forge'),
    ('the-forge-pickaxes', 'All 23 Pickaxes in The Forge', 'All 23 Pickaxes in The Forge'),
    ('the-forge-runes', 'All 11 Runes in The Forge', 'All 11 Runes in The Forge'),
    ('the-forge-races', 'All 13 Races in The Forge', 'All 13 Races in The Forge'),
    ('the-forge-essences', 'All 8 Essences in The Forge', 'All 8 Essences in The Forge'),
    ('the-forge-totems', 'All 5 Totems in The Forge', 'All 5 Totems in The Forge'),
    ('the-forge-potions', 'All 6 Potions in The Forge', 'All 6 Potions in The Forge'),
    ('the-forge-enemies', 'All 21 Enemies in The Forge', 'All 21 Enemies in The Forge'),
    ('the-forge-npcs', 'All 52 NPCs in The Forge', 'All 52 NPCs in The Forge'),
    ('the-forge-quests', 'All 65 Quests in The Forge', 'All 65 Quests in The Forge'),
    ('the-forge-skills', 'All 10 Skills in The Forge', 'All 10 Skills in The Forge'),
    ('the-forge-blueprints', 'All 18 Blueprints in The Forge', 'All 18 Blueprints in The Forge'),
    ('the-forge-locations', 'All 18 Locations in The Forge', 'All 18 Locations in The Forge'),
    ('grow-a-garden-crops', 'All 463 Crops in Grow a Garden', 'All 463 Crops in Grow a Garden'),
    ('grow-a-garden-seeds', 'All 463 Seeds in Grow a Garden', 'All 463 Seeds in Grow a Garden'),
    ('grow-a-garden-pets', 'All 364 Pets in Grow a Garden', 'All 364 Pets in Grow a Garden'),
    ('grow-a-garden-eggs', 'All 61 Eggs in Grow a Garden', 'All 61 Eggs in Grow a Garden'),
    ('grow-a-garden-gears', 'All 77 Gears in Grow a Garden', 'All 77 Gears in Grow a Garden'),
    ('grow-a-garden-crop-mutations', 'All 172 Crop Mutations in Grow a Garden', 'All 172 Crop Mutations in Grow a Garden'),
    ('grow-a-garden-pet-mutations', 'All 47 Pet Mutations in Grow a Garden', 'All 47 Pet Mutations in Grow a Garden'),
    ('grow-a-garden-weather', 'All 139 Weather in Grow a Garden', 'All 139 Weather in Grow a Garden'),
    ('grow-a-garden-merchants', 'All 11 Merchants in Grow a Garden', 'All 11 Merchants in Grow a Garden'),
    ('grow-a-garden-npcs', 'All 54 NPCs in Grow a Garden', 'All 54 NPCs in Grow a Garden'),
    ('grow-a-garden-shops', 'All 5 Shops in Grow a Garden', 'All 5 Shops in Grow a Garden'),
    ('grow-a-garden-seed-packs', 'All 28 Seed Packs in Grow a Garden', 'All 28 Seed Packs in Grow a Garden'),
    ('grow-a-garden-crafting-recipes', 'All 52 Crafting Recipes in Grow a Garden', 'All 52 Crafting Recipes in Grow a Garden'),
    ('grow-a-garden-food', 'All 25 Food in Grow a Garden', 'All 25 Food in Grow a Garden'),
    ('grow-a-garden-currencies', 'All 14 Currencies in Grow a Garden', 'All 14 Currencies in Grow a Garden')
) as updates(code, title, seo_title)
where cp.code = updates.code;
