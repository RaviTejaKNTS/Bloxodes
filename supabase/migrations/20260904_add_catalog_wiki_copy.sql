alter table if exists public.catalog_pages
  add column if not exists wiki_md text,
  add column if not exists wiki_sort_order integer,
  add column if not exists wiki_item_count integer,
  add column if not exists wiki_image_urls text[] not null default '{}'::text[];

create index if not exists idx_catalog_pages_universe_wiki_sort
  on public.catalog_pages (universe_id, wiki_sort_order)
  where is_published = true;

drop view if exists public.catalog_pages_view;
create or replace view public.catalog_pages_view as
select
  cp.*,
  greatest(cp.updated_at, coalesce(cp.published_at, cp.updated_at)) as content_updated_at
from public.catalog_pages cp;

alter view if exists public.catalog_pages_view set (security_invoker = true);

insert into public.catalog_pages (
  universe_id,
  code,
  title,
  seo_title,
  meta_description,
  intro_md,
  how_it_works_md,
  description_json,
  faq_json,
  cta_label,
  cta_url,
  wiki_md,
  wiki_sort_order,
  wiki_item_count,
  is_published,
  published_at
)
values
  (
    7671049560,
    'the-forge-races',
    'All Races in The Forge',
    'All Races in The Forge',
    'Every The Forge race with tiers, roll chances, and stat bonuses.',
    'Every The Forge race with tiers, roll chances, and stat bonuses.',
    null,
    '{}'::jsonb,
    '[]'::jsonb,
    'Open races catalog',
    '/catalog/the-forge-races',
    $md$Races are The Forge's version of classes, and they matter much more than they first appear. You do not choose one directly when you start. Instead, you roll into a race, and that roll shapes your early damage, health, movement, luck, stamina efficiency, or utility depending on what you land. A strong race can smooth out early progression, while a weak one can make the same stretch of content feel slower and more expensive.

That is why rerolls matter so much. Current reroll options come through the shop, redeem codes, daily login rewards, events, and Robux purchases, so most players eventually face the same question: keep a decent race, or gamble for something stronger. Higher-tier races can dramatically improve mining, combat, or general account efficiency, but they are also much rarer, and burning rerolls blindly is one of the easiest ways to waste a useful resource.

Use this races catalog when you want a clear read on what each roll actually gives you. It brings together tiers, rarities, roll chances, and stat bonuses in one place, so you can tell the difference between a race that is merely usable, one that is ideal for farming, and one that is worth building around for the long haul.$md$,
    10,
    13,
    true,
    now()
  ),
  (
    7671049560,
    'the-forge-ores',
    'All Ores in The Forge',
    'All Ores in The Forge',
    'Browse every ore in The Forge with drop chances, multipliers, and regions.',
    'Browse every ore in The Forge with drop chances, multipliers, and regions.',
    null,
    '{}'::jsonb,
    '[]'::jsonb,
    'Open ores catalog',
    '/catalog/the-forge-ores',
    $md$Ores are the foundation of everything in The Forge. Every weapon, armor piece, and most meaningful crafting decisions start with what you mined and what you decided to keep. That is why ores are not just vendor loot. Each one has a rarity, a drop chance, a region, a multiplier, and often a trait that can influence how valuable it is in recipes. Once you move beyond the early game, those differences matter a lot because the wrong ore can drag down a forge result, while the right one can push a craft into something genuinely worth keeping.

The system gets deeper the farther you go. Ore quantity helps determine weight class, ore quality affects how strong the finished item can be, and special materials start to split into clear roles. Some are mostly stepping stones. Some are efficient sell materials. Some are premium ingredients you should almost never throw away without a plan. The current progression path also spreads ores across multiple islands and sub-areas, so location knowledge matters nearly as much as raw luck once you start targeting better recipes.

Use this ores catalog when you want to compare regions, traits, rock sources, multipliers, sell values, and rarity without jumping between scattered notes. It is built to help you answer the questions that matter most: what to mine next, what to save for forging, what to sell for gold, and which rare ores are strong enough to shape your next real upgrade.$md$,
    20,
    88,
    true,
    now()
  ),
  (
    7671049560,
    'the-forge-pickaxes',
    'All Pickaxes in The Forge',
    'All Pickaxes in The Forge',
    'Explore every pickaxe in The Forge with power, speed, and luck stats.',
    'Explore every pickaxe in The Forge with power, speed, and luck stats.',
    null,
    '{}'::jsonb,
    '[]'::jsonb,
    'Open pickaxes catalog',
    '/catalog/the-forge-pickaxes',
    $md$Pickaxes decide what kind of progress is even possible in The Forge. Mining power determines which rocks you can break, mining speed changes how quickly you can farm, and luck affects how often the game pays you back with better ores. Because every major gear upgrade begins with mining, your pickaxe is not just a tool. It is the gatekeeper for the next part of the game.

That is why pickaxe progression is one of the most important routes to plan well. Early upgrades come quickly, but the middle of the game is where a lot of players stall, especially when deciding whether to bridge through several smaller upgrades or save directly for a major jump. Current progression also spreads pickaxes across shops, quests, hidden rooms, and later-island objectives, so knowing where a pickaxe comes from matters just as much as knowing its stats.

Use this pickaxes catalog to compare power, speed, luck, rune slots, cost, and how each pickaxe is obtained. It is designed to help you map out practical upgrades across Stonewake's Cross, Forgotten Kingdom, Frostspire Expanse, Crimson Sakura, and special quest-gated content, so you can spend your gold and rare materials with a clear target instead of guessing.$md$,
    30,
    23,
    true,
    now()
  ),
  (
    7671049560,
    'the-forge-weapons',
    'All Weapons in The Forge',
    'All Weapons in The Forge',
    'Compare every forgeable weapon in The Forge grouped by class.',
    'Compare every forgeable weapon in The Forge grouped by class.',
    null,
    '{}'::jsonb,
    '[]'::jsonb,
    'Open weapons catalog',
    '/catalog/the-forge-weapons',
    $md$Weapons are where The Forge's mining loop turns into real combat power. You mine ore, choose a recipe path, run the forge, and end up with something that can either carry your account forward or waste a pile of good materials. Because the game has a wide spread of weapon classes with different damage, speed, range, pricing, and forge chances, choosing a weapon is never just about what looks coolest. It is about what fits your current resources and how you actually fight.

The forge itself adds another layer. Before crafting, you can check the percentage menu to see what you are likely to make, and doing that saves a lot of regret. Mixing ores can change the outcome depending on your primary material, and the weapon forge process runs through multiple minigames, with the Fast Forge gamepass currently skipping two of them. That means good weapon planning is part recipe knowledge, part material discipline, and part understanding how much risk you are taking with each attempt.

Use this weapons catalog to compare weapon classes, baseline stats, forge odds, and key differences between options before spending premium ore. It is meant for the moment when you need to decide whether to craft a short-term weapon, hold for a better recipe, or push toward a weapon that can carry you through the next stretch of harder content.$md$,
    40,
    41,
    true,
    now()
  ),
  (
    7671049560,
    'the-forge-armors',
    'All Armors in The Forge',
    'All Armors in The Forge',
    'See every armor piece in The Forge, grouped by armor class.',
    'See every armor piece in The Forge, grouped by armor class.',
    null,
    '{}'::jsonb,
    '[]'::jsonb,
    'Open armors catalog',
    '/catalog/the-forge-armors',
    $md$Armor is what keeps a promising run from turning into a wipe. In The Forge, stronger enemies hit hard enough that raw weapon damage is never the whole story. A good armor set lets you stay in dangerous areas longer, complete harder quests more safely, and survive the mistakes that tougher zones punish immediately. Since armor is split across helmets, chestplates, and leggings, gearing well means thinking in full-set terms instead of chasing one lucky piece.

The forge rules matter here too. Ore quantity affects the weight class of what you make, ore quality affects how strong the resulting stats can be, and the percentage menu is just as important for armor as it is for weapons. If you are using rare materials, you want to know what your likely outcomes are before committing them. That becomes even more important when you start deciding whether a set is only a stepping stone or something worth enhancing and holding for a long time.

Use this armors catalog to compare armor classes, slots, health values, base prices, and forge chances in one place. It is built to help you figure out which pieces are early-game filler, which sets stabilize difficult areas, and which ones deserve your best ore because they can carry you into the next serious progression wall.$md$,
    50,
    25,
    true,
    now()
  ),
  (
    7671049560,
    'the-forge-runes',
    'All Runes in The Forge',
    'All Runes in The Forge',
    'All The Forge runes with elements, rarities, and effects.',
    'All The Forge runes with elements, rarities, and effects.',
    null,
    '{}'::jsonb,
    '[]'::jsonb,
    'Open runes catalog',
    '/catalog/the-forge-runes',
    $md$Runes are where a normal item starts becoming a real build piece. They drop from enemies, carry elemental or utility effects, and can add power that changes how a weapon, armor piece, or pickaxe actually performs once you have something worth investing in. Some runes support raw damage, some improve mining, some add status effects, and some are simply better than others for the amount of effort they take to farm.

They also come with an important restriction: runes are gear-specific. A pickaxe rune only belongs on a pickaxe, a weapon rune only belongs on a weapon, and the same logic applies across the system. That makes timing important. Carving a rune into weak temporary gear is often a waste, especially once enhancement and slot unlocks start becoming part of the decision. By the mid and late game, rune planning matters almost as much as your base forge materials.

Use this runes catalog to compare elements, rarities, effects, and primary enemy drops before you start carving anything. It gives you a clean way to see which runes are worth farming now, which ones are better saved for stronger gear, and which drops are tied to the exact enemies and areas you should be prioritizing next.$md$,
    60,
    11,
    true,
    now()
  ),
  (
    7671049560,
    'the-forge-quests',
    'All Quests in The Forge',
    'All Quests in The Forge',
    'Track The Forge quests by world, NPC, and listed objectives.',
    'Track The Forge quests by world, NPC, and listed objectives.',
    null,
    '{}'::jsonb,
    '[]'::jsonb,
    'Open quests catalog',
    '/catalog/the-forge-quests',
    $md$Quests in The Forge are not filler content. They are one of the main ways the game quietly controls progression. Some teach the basics of mining, forging, and upgrading. Others unlock rooms, keys, pickaxes, side areas, and major character chains that lead to much stronger rewards. If you ignore quests for too long, it is easy to end up overfarming old content while the real path forward is sitting behind an NPC you forgot to revisit.

That matters more as the world opens up. Early quests around Sensei Moro help move players through the opening game, but later chains tied to characters like Captain Rowan, Bard, Raven, Goblin King, Bjorn, Monke, Tomo, Isaac, and Skal start connecting directly to secrets, doors, and important progression checkpoints. Current quest routes also include notable unlocks like the Lost Guitar reward path for the Unknown Key and Demon Skal's late-game chain for the Demonite Key.

Use this quests catalog to track quests by world, NPC, status, and objective list so you always know what the next meaningful task actually is. It is meant to help you move with purpose, especially when you are trying to unlock a room, finish a character chain, or figure out which quest reward matters most for the build you are pushing toward.$md$,
    70,
    65,
    true,
    now()
  ),
  (
    7671049560,
    'the-forge-npcs',
    'All NPCs in The Forge',
    'All NPCs in The Forge',
    'The Forge NPC roster and their roles.',
    'The Forge NPC roster and their roles.',
    null,
    '{}'::jsonb,
    '[]'::jsonb,
    'Open NPCs catalog',
    '/catalog/the-forge-npcs',
    $md$NPCs are how The Forge organizes almost every important system without spelling it out too loudly. If you need a pickaxe, a potion, a reroll, a way to sell extra gear, a quest chain, an enhancement upgrade, a rune service, or a hidden progression trigger, there is usually one specific character tied to that job. Knowing the right name and the right location saves a surprising amount of time once the game starts sending you across islands and sub-areas.

The early-game cast already matters a lot. Miner Fred handles key pickaxe progression, Maria is central for potion shopping, the Wizard is tied to race rerolls and travel utility, and the Enhancer and Runemaker become more important the longer you play. From there the list grows fast. NPCs like Goblin King, Goblin Lord, Raven, localModuled, Zarall, Fungi, Captain Rowan, and Bard all connect to later systems, keys, blueprints, or special quest branches that can change what content opens next.

Use this NPC catalog when you need a quick answer to the most practical question in the game: who do I need to talk to right now? It brings together roles, areas, and locations so you can move directly to the right merchant, quest giver, or progression NPC instead of running in circles trying to remember where the game parked them.$md$,
    80,
    52,
    true,
    now()
  ),
  (
    7671049560,
    'the-forge-locations',
    'All Locations in The Forge',
    'All Locations in The Forge',
    'The Forge locations organized by area and type.',
    'The Forge locations organized by area and type.',
    null,
    '{}'::jsonb,
    '[]'::jsonb,
    'Open locations catalog',
    '/catalog/the-forge-locations',
    $md$Locations are not just backdrop in The Forge. Every area changes what you can mine, what you can fight, which NPCs you can reach, and which secrets or quest steps become available. That means map knowledge turns into progression knowledge very quickly. If you know what a place contains, you know what you can reasonably farm there and whether you are actually ready for it.

The current game now stretches across four main islands, with Stonewake's Cross opening the path, then branching into later regions like Forgotten Kingdom, Frostspire Expanse, and Crimson Sakura Isles. From there, sub-areas and secret locations add another layer: caves, camps, quest rooms, towers, hidden roofs, the Raven Cave, and harder spaces like Volcanic Depths or The Peak all push the game in different directions. Some locations are there for steady farming. Others are progress gates disguised as exploration.

Use this locations catalog as a clean map-style reference for major areas, location types, and why each place matters. It is especially helpful when you are routing quests, looking for a specific NPC, planning a farming loop, or trying to understand which location is actually worth your time before you spend the next hour running across the wrong island.$md$,
    90,
    18,
    true,
    now()
  ),
  (
    7671049560,
    'the-forge-enemies',
    'All Enemies in The Forge',
    'All Enemies in The Forge',
    'The Forge enemy list with stats, gold, and experience rewards.',
    'The Forge enemy list with stats, gold, and experience rewards.',
    null,
    '{}'::jsonb,
    '[]'::jsonb,
    'Open enemies catalog',
    '/catalog/the-forge-enemies',
    $md$Enemies are one of the clearest reality checks in The Forge. You can think your build is ready for the next area, but the local enemy roster will tell you the truth almost immediately. Their health, damage, level, gold payout, and experience rewards determine whether a zone feels efficient, frustrating, or completely out of reach. As the game moves into stronger regions, enemies stop being background obstacles and start becoming the system that decides whether your current gear is actually good enough.

They matter for more than survival too. Enemies are one of the main sources of essences, rune drops, and other valuable materials, which means combat farming is directly tied to progression. Some mobs are mainly useful for steady essence income. Others become priority targets because they can drop stronger runes, premium essences, or special ore rewards. By the time you are fighting through places like Frostspire, Raven Cave, The Peak, or Volcanic Depths, knowing what a zone drops is just as important as knowing how hard it hits.

Use this enemies catalog to compare enemy stats, areas, and rewards before you commit to a farming route. It is meant to help you see where difficulty spikes begin, which enemies are worth revisiting for materials, and whether your next stop should be a gold grind, an essence grind, or a straight progression push into harder content.$md$,
    100,
    21,
    true,
    now()
  ),
  (
    7671049560,
    'the-forge-essences',
    'All Essences in The Forge',
    'All Essences in The Forge',
    'All The Forge essences organized by tier.',
    'All The Forge essences organized by tier.',
    null,
    '{}'::jsonb,
    '[]'::jsonb,
    'Open essences catalog',
    '/catalog/the-forge-essences',
    $md$Essences are the reason enemy farming never really stops mattering in The Forge. They drop from mobs and bosses, come in several tiers, and are one of the main materials used at the Enhancer to strengthen your equipment. That makes them the bridge between combat and long-term gear progression. Mining gets you the base item. Essences help turn that item into something strong enough to keep.

The difference between tiers matters a lot. Tiny and Small Essence are early progression fuel. Medium and Large Essence help carry the awkward middle stretch. Greater, Superior, Epic, and Legendary Essence are where the stakes rise, because those stacks start getting tied to stronger weapons, better armor, and upgrades you do not want to waste on replaceable gear. Current guides also connect essences to slot planning, since enhancing gear far enough is part of preparing items for rune use.

Use this essences catalog to compare tiers, descriptions, and progression value before you spend a single stack. It is designed to help you answer the real question behind every upgrade decision: should this gear be enhanced now, should these essences be saved for a stronger item, or is this the piece that deserves a serious investment because it is finally good enough to build around?$md$,
    110,
    8,
    true,
    now()
  ),
  (
    7671049560,
    'the-forge-skills',
    'All Skills in The Forge',
    'All Skills in The Forge',
    'Compare The Forge skill boosts and the achievements used to unlock them.',
    'Compare The Forge skill boosts and the achievements used to unlock them.',
    null,
    '{}'::jsonb,
    '[]'::jsonb,
    'Open skills catalog',
    '/catalog/the-forge-skills',
    $md$Skills are one of The Forge's most underrated progression systems because they reward the way you naturally play over time. They are tied to achievements and milestones, then equipped through the Achievements menu as passive boosts. That means your account can quietly get stronger while you mine, forge, explore, kill enemies, level up, or apply runes, even if you are not farming a single headline item at that moment.

The system is especially strong once you understand what each skill is pushing you toward. Current skill lines reward things like forging weapons, forging armor, mining rocks, killing bosses, exploring areas, spending time in the game, and applying runes. In return, they boost stats such as attack speed, health, mine power, damage, luck, stamina, movement speed, XP gain, and more. Only one skill boost can be equipped at a time, so choosing the right one for your current goal actually matters.

Use this skills catalog to compare each skill's boost, requirement, and summary in a way that is easy to act on. It is built for players who want to know which achievement path helps their current build most, which passive is best for mining or combat, and what long-term milestones are worth keeping in mind while they grind.$md$,
    120,
    10,
    true,
    now()
  ),
  (
    7671049560,
    'the-forge-potions',
    'All Potions in The Forge',
    'All Potions in The Forge',
    'Every The Forge potion with cost and effect details.',
    'Every The Forge potion with cost and effect details.',
    null,
    '{}'::jsonb,
    '[]'::jsonb,
    'Open potions catalog',
    '/catalog/the-forge-potions',
    $md$Potions are The Forge's cleanest short-term power spike. Instead of changing your whole build, they give you a focused boost for the exact session you are about to play. That can mean a safer fight, a faster mining route, better luck during a rare-ore farm, or a small edge that turns an annoying quest step into something manageable. Used casually, they are convenient. Used at the right moment, they can save a lot of time.

The current potion pool covers several useful needs: healing, damage, movement, mining speed, and luck. Most players meet these through Maria's Shop, which makes potions one of the easiest systems to understand but also one of the easiest to waste. Burning a strong consumable during random wandering is rarely worth it. Saving it for a harder zone, a focused ore route, or a risky progression window is where the value really shows up.

Use this potions catalog to compare costs, durations, and effects before you spend your gold. It is meant to help you choose the right consumable for the job, whether that job is surviving a rough fight, squeezing more value out of a farming run, or stacking short-term efficiency for a specific goal you want to finish now.$md$,
    130,
    6,
    true,
    now()
  ),
  (
    7671049560,
    'the-forge-totems',
    'All Totems in The Forge',
    'All Totems in The Forge',
    'Every The Forge totem with cost and effect details.',
    'Every The Forge totem with cost and effect details.',
    null,
    '{}'::jsonb,
    '[]'::jsonb,
    'Open totems catalog',
    '/catalog/the-forge-totems',
    $md$Totems are the premium version of a planned farming session in The Forge. They are short-duration boosts, usually around five minutes, but those minutes can be extremely valuable when you line them up with the right activity. A good totem can turn a routine route into a serious ore hunt, a combat session into a fast leveling push, or a difficult progression wall into something much more manageable.

Each totem serves a different purpose. Current options focus on luck, damage, health sustain, XP gain, or mining performance, so choosing one is really choosing what kind of session you want to optimize. That is why timing matters. A totem used at random is just a nice bonus. A totem used during a 2x luck weekend, a rare-material grind, a high-XP route, or a hard push through stronger enemies can completely change the value you get out of those five minutes.

Use this totems catalog to compare costs and effects before you spend one. It is designed to help you decide which totem fits the grind you are planning, when a premium boost is actually worth using, and which sessions deserve the extra push because the rewards on the other side are finally good enough to justify it.$md$,
    140,
    5,
    true,
    now()
  ),
  (
    7671049560,
    'the-forge-blueprints',
    'All Blueprints in The Forge',
    'All Blueprints in The Forge',
    'See The Forge blueprints, where they come from, and whether they are available.',
    'See The Forge blueprints, where they come from, and whether they are available.',
    null,
    '{}'::jsonb,
    '[]'::jsonb,
    'Open blueprints catalog',
    '/catalog/the-forge-blueprints',
    $md$Blueprints are your crafting roadmap for special gear in The Forge. When you want a specific weapon or armor piece, the blueprint tells you whether that target is actually obtainable, where it comes from, and what progression path leads to it. That matters because many of the most interesting gear goals are not simple shop purchases. They are tied to events, questlines, limited content, hidden vendors, or side systems that are easy to miss if you only focus on raw materials.

Current blueprint routes already show how varied the system can be. Some are tied to event content like Hidden Maze rewards. Some are connected to stores such as Fungi's shop. Others can point toward quests, rarer sources, or availability limits that change whether a craft is part of your current plan or something you simply cannot chase right now. Without that context, it is easy to waste time farming ingredients for a target you do not yet have access to.

Use this blueprints catalog to compare item types, sources, availability, and acquisition notes before you commit to any big forge goal. It is built to answer the question that matters most when you set your sights on a late-game weapon or armor piece: can I actually get this now, and if not, what part of the game do I need to clear first?$md$,
    150,
    18,
    true,
    now()
  )
on conflict (code) do update
set
  universe_id = excluded.universe_id,
  title = excluded.title,
  seo_title = excluded.seo_title,
  meta_description = excluded.meta_description,
  intro_md = excluded.intro_md,
  how_it_works_md = excluded.how_it_works_md,
  description_json = excluded.description_json,
  faq_json = excluded.faq_json,
  cta_label = excluded.cta_label,
  cta_url = excluded.cta_url,
  wiki_md = excluded.wiki_md,
  wiki_sort_order = excluded.wiki_sort_order,
  wiki_item_count = excluded.wiki_item_count,
  is_published = excluded.is_published,
  published_at = coalesce(catalog_pages.published_at, excluded.published_at);

update public.catalog_pages cp
set wiki_image_urls = images.urls
from (
  values
    ('the-forge-races', array['/The%20Forge/Races/human-race.webp', '/The%20Forge/Races/elf.webp', '/The%20Forge/Races/dwarf.webp', '/The%20Forge/Races/orc.webp', '/The%20Forge/Races/goblin.webp', '/The%20Forge/Races/undead-race.webp']::text[]),
    ('the-forge-ores', array['/The%20Forge/Ores/stone.png', '/The%20Forge/Ores/sand-stone.png', '/The%20Forge/Ores/copper.png', '/The%20Forge/Ores/iron.png', '/The%20Forge/Ores/cardboardite.png', '/The%20Forge/Ores/tin.png']::text[]),
    ('the-forge-pickaxes', array['/The%20Forge/Pickaxes/Stone-Pickaxe.webp', '/The%20Forge/Pickaxes/Bronze-Pickaxe.webp', '/The%20Forge/Pickaxes/Iron-Pickaxe.webp', '/The%20Forge/Pickaxes/Golden-Pickaxe.webp', '/The%20Forge/Pickaxes/StoneWakes-Pickaxe.webp', '/The%20Forge/Pickaxes/Platinum-Pickaxe.webp']::text[]),
    ('the-forge-weapons', array['/The%20Forge/Weapons/dagger.webp', '/The%20Forge/Weapons/falchion-knife.webp', '/The%20Forge/Weapons/gladius-daggers.webp', '/The%20Forge/Weapons/hook.webp', '/The%20Forge/Weapons/mace.webp', '/The%20Forge/Weapons/spiked-mace.webp']::text[]),
    ('the-forge-armors', array['/The%20Forge/Armor/light-helmet.webp', '/The%20Forge/Armor/light-leggings.webp', '/The%20Forge/Armor/light-chestplate.webp', '/The%20Forge/Armor/medium-helmet.webp', '/The%20Forge/Armor/medium-leggings.webp', '/The%20Forge/Armor/samurai-helmet.webp']::text[]),
    ('the-forge-runes', array['/The%20Forge/Runes/miner-shard-1.webp', '/The%20Forge/Runes/frost-speck-1.webp', '/The%20Forge/Runes/flame-spark-1.webp', '/The%20Forge/Runes/venom-crumb-1.webp', '/The%20Forge/Runes/chill-dust-1.webp', '/The%20Forge/Runes/blast-chip-1.webp']::text[]),
    ('the-forge-quests', array[]::text[]),
    ('the-forge-npcs', array[]::text[]),
    ('the-forge-locations', array['/The%20Forge/Locations/the-forge-480w.webp', '/The%20Forge/Locations/enhancing-area-480w.webp', '/The%20Forge/Locations/runemaker-area-480w.webp', '/The%20Forge/Locations/marias-potion-shop-480w.webp', '/The%20Forge/Locations/bard-area-480w.webp', '/The%20Forge/Locations/miner-freds-shop-480w.webp']::text[]),
    ('the-forge-enemies', array['/The%20Forge/Enemies/zombie-1.webp', '/The%20Forge/Enemies/delver-zombie-1.webp', '/The%20Forge/Enemies/elite-zombie-1.webp', '/The%20Forge/Enemies/brute-zombie-1.webp', '/The%20Forge/Enemies/bomber-1.webp', '/The%20Forge/Enemies/skeleton-rogue-1.webp']::text[]),
    ('the-forge-essences', array['/The%20Forge/Essences/TinyEssence.webp', '/The%20Forge/Essences/SmallEssence.webp', '/The%20Forge/Essences/MediumEssence.webp', '/The%20Forge/Essences/LargeEssence.webp', '/The%20Forge/Essences/GreaterEssence.webp', '/The%20Forge/Essences/EpicEssence.webp']::text[]),
    ('the-forge-skills', array[]::text[]),
    ('the-forge-potions', array['/The%20Forge/Potions/Health-potions.webp', '/The%20Forge/Potions/Damage-potions.webp', '/The%20Forge/Potions/miner-potion.webp', '/The%20Forge/Potions/speed-potion.webp', '/The%20Forge/Potions/luck-potion.webp']::text[]),
    ('the-forge-totems', array['/The%20Forge/Totems/LuckTotem.webp', '/The%20Forge/Totems/WarriorTotem.webp', '/The%20Forge/Totems/VitalityTotem.webp', '/The%20Forge/Totems/XpTotem.webp', '/The%20Forge/Totems/MinerTotem.webp']::text[]),
    ('the-forge-blueprints', array['/The%20Forge/Weapons/hell-slayer.webp', '/The%20Forge/Weapons/candy-cane.webp', '/The%20Forge/Armor/goblin-s-crown.webp', '/The%20Forge/Armor/raven-s-helmet.webp', '/The%20Forge/Armor/raven-s-chestplate.webp', '/The%20Forge/Armor/raven-s-leggings.webp']::text[])
) as images(code, urls)
where cp.code = images.code;
