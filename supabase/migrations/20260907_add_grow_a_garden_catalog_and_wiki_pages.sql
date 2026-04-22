with target_universe as (
  select universe_id
  from public.roblox_universes
  where lower(slug) = 'grow-a-garden'
     or lower(name) = 'grow a garden'
     or lower(display_name) = 'grow a garden'
  order by
    case
      when lower(slug) = 'grow-a-garden' then 0
      when lower(display_name) = 'grow a garden' then 1
      else 2
    end
  limit 1
),
seed_rows (
  code,
  title,
  seo_title,
  meta_description,
  intro_md,
  how_it_works_md,
  faq_json,
  cta_label,
  cta_url,
  wiki_md,
  wiki_sort_order,
  wiki_item_count,
  wiki_image_urls,
  thumb_url
) as (
  values
    (
      'grow-a-garden-crops',
      'All Crops in Grow a Garden',
      'All Crops in Grow a Garden',
      'Browse every crop in Grow a Garden with value, weight, harvest behavior, and availability notes.',
      $intro$Crops are the center of Grow a Garden's entire economy. Every seed, mutation route, weather event, pet passive, and shop refresh ultimately points back to one question: what can you plant, what can you grow, and what is it worth when you harvest it. That makes the crop pool more than a simple item list. It is the real reference point for planning profit, tracking rare plants, and deciding which seeds are worth chasing when stock rotates in your favor.

This crops catalog is built for that decision-making. It brings together value data, average weight, huge chance, harvest behavior, availability, and source notes in one place so you can compare low-risk staples against rarer plants with better upside. When the source material only exposes a name or rarity without a full numeric row, we keep the entry visible and leave the missing fields blank instead of pretending the data is settled.$intro$,
      $how$Use the group sections to scan by crop tier, then compare the stat column on each card or table row to judge value, weight, and pricing side by side. Multi-harvest and availability fields are especially useful when you are deciding between steady income crops and rarer event or merchant plants that are harder to replace once they leave rotation.$how$,
      jsonb_build_array(
        jsonb_build_object(
          'q', 'How are crop values shown here?',
          'a', $a$The catalog uses the current structured crop sources we track, including the Grow a Garden wiki and crop-value references. Average value and weight are shown when the source material exposes them clearly.$a$
        ),
        jsonb_build_object(
          'q', 'Why do some crops still have missing stats?',
          'a', $a$Some named crops appear in the public source lists before a complete price, weight, or availability row is exposed. We keep those crops in the catalog so the collection stays complete, but we do not fill missing numbers with guesses.$a$
        )
      ),
      'Open crops catalog',
      '/catalog/grow-a-garden-crops',
      $wiki$Crops are the foundation of Grow a Garden because every profit route starts with what you plant. Use the crops catalog to compare value, weight, harvest behavior, and availability before you decide which seeds deserve your next stock check or mutation setup.$wiki$,
      10,
      463,
      array[
        'https://static.wikia.nocookie.net/growagarden/images/c/c3/Applefruiticon.png/revision/latest/scale-to-width-down/85?cb=20251220004807',
        'https://static.wikia.nocookie.net/growagarden/images/0/0f/AckeeProduce.png/revision/latest/scale-to-width-down/85?cb=20250830123751',
        'https://static.wikia.nocookie.net/growagarden/images/0/0c/AsterisProduce.png/revision/latest/scale-to-width-down/85?cb=20251123144138'
      ]::text[],
      'https://static.wikia.nocookie.net/growagarden/images/c/c3/Applefruiticon.png/revision/latest/scale-to-width-down/85?cb=20251220004807'
    ),
    (
      'grow-a-garden-seeds',
      'All Seeds in Grow a Garden',
      'All Seeds in Grow a Garden',
      'Compare Grow a Garden seeds by tier, harvest type, shop access, crafting routes, and pack availability.',
      $intro$Seeds are where planning starts in Grow a Garden. A crop might be the thing you eventually sell, but the seed determines whether you can access that crop through the shop, through crafting, through a pack, or through a more limited merchant or event route. That difference matters because two profitable plants can feel completely different to build around if one is guaranteed stock and the other only appears through a rarer source path.

This seeds catalog focuses on that acquisition layer. It separates the seed from the finished crop so you can quickly see which plants come from the Seed Shop, which ones need crafting, and which ones are mostly tied to packs or special sources. That makes it easier to plan rotations, craft chains, and event farming without losing track of how each plant actually enters your inventory.$intro$,
      $how$Start by scanning the tier groups, then use the source counts on each row to see whether a seed is shop-driven, craft-driven, or pack-driven. The harvest type and availability fields are meant to give quick context when you are building a garden around repeat harvests instead of one-off novelty plants.$how$,
      jsonb_build_array(
        jsonb_build_object(
          'q', 'Why separate seeds from crops?',
          'a', $a$The crop tells you what you can sell or mutate. The seed tells you how you actually get access to that crop. Keeping those as separate pages makes shop routes, crafting chains, and pack sourcing much easier to compare.$a$
        ),
        jsonb_build_object(
          'q', 'Can one seed show up in more than one source?',
          'a', $a$Yes. Some seeds can overlap across shop stock, crafting, packs, and limited sources. The counts on this page are there to show those acquisition paths at a glance.$a$
        )
      ),
      'Open seeds catalog',
      '/catalog/grow-a-garden-seeds',
      $wiki$Seeds are the access layer behind every profitable crop. Use the seeds catalog to see which plants come from normal shop stock, which ones need crafting or packs, and which sources are worth checking when you are targeting a specific garden build.$wiki$,
      20,
      463,
      array[
        'https://static.wikia.nocookie.net/growagarden/images/0/0f/AckeeProduce.png/revision/latest/scale-to-width-down/85?cb=20250830123751',
        'https://static.wikia.nocookie.net/growagarden/images/c/c3/Applefruiticon.png/revision/latest/scale-to-width-down/85?cb=20251220004807',
        'https://static.wikia.nocookie.net/growagarden/images/0/0c/AsterisProduce.png/revision/latest/scale-to-width-down/85?cb=20251123144138'
      ]::text[],
      'https://static.wikia.nocookie.net/growagarden/images/0/0f/AckeeProduce.png/revision/latest/scale-to-width-down/85?cb=20250830123751'
    ),
    (
      'grow-a-garden-pets',
      'All Pets in Grow a Garden',
      'All Pets in Grow a Garden',
      'See every Grow a Garden pet grouped by rarity with egg sources, merchant availability, and ability counts.',
      $intro$Pets are one of the reasons Grow a Garden gets deeper the longer you play. They do not just add collection value. They can change hatch pacing, improve mutation odds, add passive profit, or support specific strategies around harvesting and late-game farming. Once you move beyond the first few eggs, pet choice becomes less about rarity for its own sake and more about what kind of garden loop you want to optimize.

This pets catalog is meant to make that easier to read. Instead of forcing you to bounce between egg pages, merchant notes, and passive descriptions, it shows rarity, availability, egg sources, merchant sources, and ability counts together. That makes it much easier to spot the pets that are simple collection pieces versus the ones that actively shape how you play.$intro$,
      $how$Use the rarity groups to narrow the field, then compare egg count, merchant count, and ability count to understand where each pet comes from and how much detail is currently exposed for it. The summary text is especially helpful for pets that come from unusual routes rather than standard egg rotation.$how$,
      jsonb_build_array(
        jsonb_build_object(
          'q', 'Does obtainable mean the pet is currently hatchable?',
          'a', $a$Not always. Obtainable means the current public sources still treat the pet as available somewhere in the game, which might mean eggs, merchants, codes, or another active route instead of a normal hatch pool.$a$
        ),
        jsonb_build_object(
          'q', 'Why list egg and merchant sources separately?',
          'a', $a$Those are different acquisition loops. A pet that only comes from eggs behaves very differently from one tied to merchants, events, or other rotational sellers, so splitting them helps you plan around access instead of just rarity.$a$
        )
      ),
      'Open pets catalog',
      '/catalog/grow-a-garden-pets',
      $wiki$Pets add more than collection value in Grow a Garden. Use the pets catalog to compare rarity, egg sources, merchant routes, and passive notes so you can tell which companions are useful for hatching, mutation setups, or pure collection progress.$wiki$,
      30,
      364,
      array[
        'https://static.wikia.nocookie.net/growagarden/images/c/c3/Applefruiticon.png/revision/latest/scale-to-width-down/85?cb=20251220004807',
        'https://static.wikia.nocookie.net/growagarden/images/c/c6/CandyCarrotProduce.png/revision/latest/scale-to-width-down/120?cb=20260403014044',
        'https://static.wikia.nocookie.net/growagarden/images/a/a6/ChocolateBerryProduce.png/revision/latest/scale-to-width-down/120?cb=20260403014101'
      ]::text[],
      'https://static.wikia.nocookie.net/growagarden/images/c/c6/CandyCarrotProduce.png/revision/latest/scale-to-width-down/120?cb=20260403014044'
    ),
    (
      'grow-a-garden-eggs',
      'All Eggs in Grow a Garden',
      'All Eggs in Grow a Garden',
      'Track Grow a Garden egg types by shop category, hatch time, obtainable status, and pet drop pool size.',
      $intro$Eggs are the main bridge between currency and pet progression in Grow a Garden. The hatch pool on each egg determines what you can reasonably target, how long you need to wait, and whether a pet route is part of the normal shop cycle or tied to exotic and limited content. Since the Pet Egg Shop rotates on its own timer and special eggs come from other systems, keeping the egg list clear matters more than it first seems.

This eggs catalog is built to answer the practical questions quickly: which egg family an item belongs to, how long it takes to hatch, how many pets are in the pool, and whether the egg is still obtainable. That makes it easier to compare permanent shop eggs with limited and exotic eggs before you spend time or currency chasing a specific pet line.$intro$,
      $how$Check the egg category first to separate Pet Shop eggs from exotic or limited pools. From there, hatch time and drop count do most of the work: they tell you how fast the cycle is and how focused the reward pool will feel if you are aiming for one specific pet.$how$,
      jsonb_build_array(
        jsonb_build_object(
          'q', 'Does hatch time include pet or upgrade boosts?',
          'a', $a$No. The page lists the tracked base hatch time for the egg itself. Pets, slots, or other systems that reduce hatch time are separate effects layered on top of that base value.$a$
        ),
        jsonb_build_object(
          'q', 'Why are limited eggs listed with permanent eggs?',
          'a', $a$Because egg category is part of the planning process. Seeing permanent, exotic, and limited eggs in one place makes it easier to judge whether a target pet comes from everyday rotation or a much narrower window.$a$
        )
      ),
      'Open eggs catalog',
      '/catalog/grow-a-garden-eggs',
      $wiki$Eggs control most pet progression in Grow a Garden. Use the eggs catalog to compare hatch times, drop pools, and egg categories before you decide whether a pet target belongs to the normal shop loop or a rarer exotic or limited route.$wiki$,
      40,
      61,
      array[
        'https://static.wikia.nocookie.net/growagarden/images/c/c6/CandyCarrotProduce.png/revision/latest/scale-to-width-down/120?cb=20260403014044',
        'https://static.wikia.nocookie.net/growagarden/images/a/a6/ChocolateBerryProduce.png/revision/latest/scale-to-width-down/120?cb=20260403014101',
        'https://static.wikia.nocookie.net/growagarden/images/b/b6/GumballProduce.png/revision/latest/scale-to-width-down/120?cb=20260403014115'
      ]::text[],
      'https://static.wikia.nocookie.net/growagarden/images/b/b6/GumballProduce.png/revision/latest/scale-to-width-down/120?cb=20260403014115'
    ),
    (
      'grow-a-garden-gears',
      'All Gears in Grow a Garden',
      'All Gears in Grow a Garden',
      'Browse Grow a Garden gear by category with price, stock ranges, and what each tool actually does.',
      $intro$Gear is where Grow a Garden turns from passive planting into active optimization. Sprinklers, utility tools, mutation gear, and other shop items can speed up growth, change how your plot behaves, or open up more deliberate farming and mutation strategies. Since the Gear Shop rotates on a short timer and not every item is always in stock, gear planning becomes part of the daily rhythm once you are past the earliest game.

This gears catalog keeps that rotation readable. It shows category, price, stock, availability, and short use notes together so you can tell the difference between a cheap utility pickup, a garden-shaping sprinkler, and a rarer tool that matters more for specific farming setups than for general play.$intro$,
      $how$Use the category groups to separate common utility gear from craftables, merchant items, sprays, and higher-end shop tools. The price and stock fields are there to help with timing, while the effect text gives a quick reminder of which tools actually change your garden loop in a meaningful way.$how$,
      jsonb_build_array(
        jsonb_build_object(
          'q', 'What does stock mean on this page?',
          'a', $a$Stock reflects the tracked quantity range or known appearance count for that gear when it shows up in shop rotation. It is useful for quickly judging whether an item is common, guaranteed, or more limited.$a$
        ),
        jsonb_build_object(
          'q', 'Why do some price fields look compressed?',
          'a', $a$Some public gear sources mix icon-based sheckles and Robux labels into one value row. We preserve the cleaned text that is available, but icon stripping can still leave a compact combined price string on a few entries.$a$
        )
      ),
      'Open gears catalog',
      '/catalog/grow-a-garden-gears',
      $wiki$Gear is where Grow a Garden starts rewarding active planning instead of simple planting. Use the gears catalog to compare prices, stock, and tool effects when you are deciding which shop refreshes matter and which utility items are worth holding for longer setups.$wiki$,
      50,
      77,
      array[
        'https://static.wikia.nocookie.net/growagarden/images/5/51/Watering_Can.png/revision/latest/scale-to-width-down/100?cb=20250429005625',
        'https://static.wikia.nocookie.net/growagarden/images/c/c3/Applefruiticon.png/revision/latest/scale-to-width-down/85?cb=20251220004807',
        'https://static.wikia.nocookie.net/growagarden/images/0/0f/AckeeProduce.png/revision/latest/scale-to-width-down/85?cb=20250830123751'
      ]::text[],
      'https://static.wikia.nocookie.net/growagarden/images/5/51/Watering_Can.png/revision/latest/scale-to-width-down/100?cb=20250429005625'
    ),
    (
      'grow-a-garden-crop-mutations',
      'All Crop Mutations in Grow a Garden',
      'All Crop Mutations in Grow a Garden',
      'Review Grow a Garden crop mutations with multipliers, appearance notes, and the ways each mutation can be applied.',
      $intro$Crop mutations are one of the biggest reasons the same plant can have wildly different value in Grow a Garden. Weather, pets, fertilizers, sprays, special seeds, and admin-driven events can all change how a crop looks and how much it is worth. Once you start chasing higher-end profits, mutation knowledge matters almost as much as the crop itself because the multiplier path often defines the real payoff.

This mutation catalog is designed to make those paths readable. It keeps the multiplier, category, visual notes, and obtainment details together so you can separate natural mutations from limited, admin, or currently unavailable ones without relying on scattered notes or memory.$intro$,
      $how$Use the category groups first, because mutation availability is just as important as the multiplier. A huge multiplier is only actionable if the trigger path is still live, so the obtainment notes are there to help you tell the difference between a realistic setup and a mutation that only exists through special conditions.$how$,
      jsonb_build_array(
        jsonb_build_object(
          'q', 'What sources can apply crop mutations?',
          'a', $a$The tracked obtainment notes include weather, pets, gear, fertilizers, special seeds, merchant systems, and admin or event-driven effects whenever those paths are listed in the source material.$a$
        ),
        jsonb_build_object(
          'q', 'Why are admin and unobtainable mutations still listed?',
          'a', $a$Because they are part of the game''s mutation system even when they are not practical for normal farming. Keeping them visible helps the catalog stay complete and makes it easier to understand which multipliers are theoretical versus realistic.$a$
        )
      ),
      'Open crop mutations catalog',
      '/catalog/grow-a-garden-crop-mutations',
      $wiki$Mutations are what turn an ordinary harvest into a serious payout in Grow a Garden. Use the crop mutations catalog to compare multipliers, appearance cues, and trigger paths before you build around weather, pets, sprays, or special mutation setups.$wiki$,
      60,
      172,
      array[
        'https://static.wikia.nocookie.net/growagarden/images/c/c3/Applefruiticon.png/revision/latest/scale-to-width-down/85?cb=20251220004807',
        'https://static.wikia.nocookie.net/growagarden/images/0/0f/AckeeProduce.png/revision/latest/scale-to-width-down/85?cb=20250830123751',
        'https://static.wikia.nocookie.net/growagarden/images/0/0c/AsterisProduce.png/revision/latest/scale-to-width-down/85?cb=20251123144138'
      ]::text[],
      'https://static.wikia.nocookie.net/growagarden/images/0/0c/AsterisProduce.png/revision/latest/scale-to-width-down/85?cb=20251123144138'
    ),
    (
      'grow-a-garden-pet-mutations',
      'All Pet Mutations in Grow a Garden',
      'All Pet Mutations in Grow a Garden',
      'Compare Grow a Garden pet mutations by type, chance, XP boost, and sell multiplier.',
      $intro$Pet mutations add another layer to companion progression in Grow a Garden. Instead of only asking which pet you want, the game also gives you reasons to care about how that pet is rolled or upgraded. Some pet mutations improve XP gain, some change passive value, and some directly affect how strong or valuable the mutated pet becomes compared with its normal version.

This page keeps those mutation traits readable by separating type, chance, amount, sell multiplier, and passive text. It is meant to help you tell which pet mutations are simple collection upgrades and which ones actually matter for levelling, value, or long-term optimization.$intro$,
      $how$Use the mutation type groups first, then compare amount, chance, and sell multiplier to understand where the real value sits. The passive description is there because two mutations can look similar numerically while still playing very differently once the effect text is taken into account.$how$,
      jsonb_build_array(
        jsonb_build_object(
          'q', 'Does chance mean hatch chance?',
          'a', $a$No. On this page, chance refers to the tracked odds for the pet mutation itself rather than the odds of obtaining the base pet from an egg or merchant.$a$
        ),
        jsonb_build_object(
          'q', 'What does pet sell multiplier represent?',
          'a', $a$It shows the value multiplier tied to the mutated pet when that multiplier is exposed by the source data. It is useful for telling apart purely utility-focused mutations from ones that also carry extra sell value.$a$
        )
      ),
      'Open pet mutations catalog',
      '/catalog/grow-a-garden-pet-mutations',
      $wiki$Pet mutations add a second progression layer on top of the pet list itself. Use the pet mutations catalog to compare mutation type, odds, XP boosts, and sell multipliers when you want to understand which rolls matter for levelling and long-term value.$wiki$,
      70,
      47,
      array[
        'https://static.wikia.nocookie.net/growagarden/images/c/c6/CandyCarrotProduce.png/revision/latest/scale-to-width-down/120?cb=20260403014044',
        'https://static.wikia.nocookie.net/growagarden/images/a/a6/ChocolateBerryProduce.png/revision/latest/scale-to-width-down/120?cb=20260403014101',
        'https://static.wikia.nocookie.net/growagarden/images/b/b6/GumballProduce.png/revision/latest/scale-to-width-down/120?cb=20260403014115'
      ]::text[],
      'https://static.wikia.nocookie.net/growagarden/images/a/a6/ChocolateBerryProduce.png/revision/latest/scale-to-width-down/120?cb=20260403014101'
    ),
    (
      'grow-a-garden-weather',
      'All Weather in Grow a Garden',
      'All Weather in Grow a Garden',
      'Browse Grow a Garden weather types and see which effects, mutations, and gameplay changes each one brings.',
      $intro$Weather is one of the systems that makes Grow a Garden feel alive instead of static. Different weather patterns can speed up growth, trigger mutations, and change what kinds of outcomes are possible on a plot during a given session. Once you start caring about mutation stacking or timing your farming around specific boosts, weather becomes something you pay attention to instead of just background atmosphere.

This weather catalog keeps those effects in one place. It includes standard, event, admin, and other tracked weather entries so you can quickly see what each weather type does, how it affects crops or players, and whether it belongs to normal gameplay or a more limited system.$intro$,
      $how$Start with the category because weather availability changes the usefulness of the effect immediately. Standard weather is practical planning information. Event and admin weather are still worth knowing, but mainly so you understand where unusual mutations or special plot behavior actually comes from.$how$,
      jsonb_build_array(
        jsonb_build_object(
          'q', 'Why include admin and event weather on the same page?',
          'a', $a$Because they are still part of the game''s weather system and often explain mutation screenshots, special effects, or limited mechanics that players run into. Splitting them out would make the weather list less useful as a full reference.$a$
        ),
        jsonb_build_object(
          'q', 'Does weather only affect growth speed?',
          'a', $a$No. Many tracked weather entries also influence mutation application, visuals, status effects, or temporary world behavior, which is why the effect and details fields are both kept in the catalog.$a$
        )
      ),
      'Open weather catalog',
      '/catalog/grow-a-garden-weather',
      $wiki$Weather is one of the main drivers behind mutation timing in Grow a Garden. Use the weather catalog to compare standard, event, and admin weather effects when you want to know which conditions speed growth, apply mutations, or change how a farming session behaves.$wiki$,
      80,
      139,
      array[
        'https://static.wikia.nocookie.net/growagarden/images/c/c3/Applefruiticon.png/revision/latest/scale-to-width-down/85?cb=20251220004807',
        'https://static.wikia.nocookie.net/growagarden/images/0/0f/AckeeProduce.png/revision/latest/scale-to-width-down/85?cb=20250830123751',
        'https://static.wikia.nocookie.net/growagarden/images/0/0c/AsterisProduce.png/revision/latest/scale-to-width-down/85?cb=20251123144138'
      ]::text[],
      'https://static.wikia.nocookie.net/growagarden/images/c/c3/Applefruiticon.png/revision/latest/scale-to-width-down/85?cb=20251220004807'
    ),
    (
      'grow-a-garden-merchants',
      'All Merchants in Grow a Garden',
      'All Merchants in Grow a Garden',
      'See Grow a Garden merchants, how they appear, and the kinds of seeds, pets, gear, or event items they offer.',
      $intro$Merchants are one of the clearest examples of Grow a Garden rewarding awareness instead of pure grinding. They can show up with specialized inventories, event leftovers, or limited items that are not part of the standard shop loops players check every few minutes. That means a merchant page is less about decoration and more about understanding which seller matters when you are chasing something outside the usual stock cycle.

This merchants catalog keeps those sellers in one list with short function notes so you can tell what each merchant is for and what kind of inventory to expect. It is especially useful when a merchant shares space with event content or rotates in with items that do not behave like normal shop stock.$intro$,
      $how$Read the function field as the main value here. The merchant name matters, but what really changes your route is whether the seller is tied to seeds, pets, gear, old event pools, or a very specific seasonal system.$how$,
      jsonb_build_array(
        jsonb_build_object(
          'q', 'Are merchants permanent parts of the map?',
          'a', $a$Not usually. Merchants are notable because they are tied to spawn windows, seasonal systems, or special inventory pools rather than being static shops that every server always exposes in the same way.$a$
        ),
        jsonb_build_object(
          'q', 'Why keep event-flavored merchants in this catalog?',
          'a', $a$Because they are still item sources. Even when a merchant is seasonal or tied to an event theme, the seller changes what players can buy and therefore belongs in the item-acquisition side of the catalog.$a$
        )
      ),
      'Open merchants catalog',
      '/catalog/grow-a-garden-merchants',
      $wiki$Merchants are the rotating sellers that sit outside Grow a Garden''s core shop loop. Use the merchants catalog to see which special sellers matter, what kind of inventory they bring, and why a merchant appearance can change your item route for the day.$wiki$,
      90,
      11,
      array[
        'https://static.wikia.nocookie.net/growagarden/images/c/c6/CandyCarrotProduce.png/revision/latest/scale-to-width-down/120?cb=20260403014044',
        'https://static.wikia.nocookie.net/growagarden/images/b/b6/GumballProduce.png/revision/latest/scale-to-width-down/120?cb=20260403014115',
        'https://static.wikia.nocookie.net/growagarden/images/5/51/Watering_Can.png/revision/latest/scale-to-width-down/100?cb=20250429005625'
      ]::text[],
      'https://static.wikia.nocookie.net/growagarden/images/5/51/Watering_Can.png/revision/latest/scale-to-width-down/100?cb=20250429005625'
    ),
    (
      'grow-a-garden-npcs',
      'All NPCs in Grow a Garden',
      'All NPCs in Grow a Garden',
      'Track Grow a Garden NPCs and what each one does, from quest helpers to themed event characters and shop mascots.',
      $intro$NPCs are how Grow a Garden quietly explains a lot of its systems. Some characters run shops, some gate quests or exchanges, and some exist mostly to anchor limited systems or themed updates. That can make the cast feel scattered if you are returning after a break or trying to remember where a specific mechanic lives.

This NPC catalog is meant to fix that by putting the characters and their functions in one place. Even when an NPC only has a short note, that note is usually enough to answer the most useful question: is this character tied to a real mechanic you should revisit, or are they mostly scenery for an event or theme.$intro$,
      $how$Use this page like a quick role directory. If you remember the mechanic but not the name, scan the function text. If you remember the character but not why they matter, the same field gives the short version without making you dig through broader update notes.$how$,
      jsonb_build_array(
        jsonb_build_object(
          'q', 'Does this list include shopkeepers and mascots?',
          'a', $a$Yes. The catalog tracks named NPCs broadly, including characters that run systems, support events, serve as shop anchors, or otherwise matter to how the game presents content.$a$
        ),
        jsonb_build_object(
          'q', 'Why do some NPCs have very short entries?',
          'a', $a$Public sources are uneven across the cast. Some NPCs have detailed pages while others only have a brief role note, so we preserve the known function instead of padding the entry with speculation.$a$
        )
      ),
      'Open NPCs catalog',
      '/catalog/grow-a-garden-npcs',
      $wiki$NPCs are the faces attached to Grow a Garden''s shops, exchanges, and themed systems. Use the NPC catalog when you need a fast reminder of which character matters for which mechanic without digging back through update history or scattered notes.$wiki$,
      100,
      54,
      array[
        'https://static.wikia.nocookie.net/growagarden/images/c/c3/Applefruiticon.png/revision/latest/scale-to-width-down/85?cb=20251220004807',
        'https://static.wikia.nocookie.net/growagarden/images/0/0f/AckeeProduce.png/revision/latest/scale-to-width-down/85?cb=20250830123751',
        'https://static.wikia.nocookie.net/growagarden/images/5/51/Watering_Can.png/revision/latest/scale-to-width-down/100?cb=20250429005625'
      ]::text[],
      'https://static.wikia.nocookie.net/growagarden/images/0/0f/AckeeProduce.png/revision/latest/scale-to-width-down/85?cb=20250830123751'
    ),
    (
      'grow-a-garden-shops',
      'All Shops in Grow a Garden',
      'All Shops in Grow a Garden',
      'Compare Grow a Garden shops by owner, currency, and refresh cadence so you know where items rotate in and out.',
      $intro$Shops are the most familiar part of Grow a Garden, but they are also easy to blur together once the game adds more currencies, more sellers, and more rotation rules. The Seed Shop, Gear Shop, Pet Egg Shop, limited stores, and other specialized sellers all move on different cadences and use slightly different acquisition rules. If you are checking multiple systems in a session, remembering the refresh cycle matters almost as much as remembering the item itself.

This shops catalog keeps the core store list organized by currency and owner so you can see who runs each shop, what kind of money it uses, and how often the stock changes. It is a practical reference for planning stock checks instead of waiting around or refreshing the wrong shop.$intro$,
      $how$Use the currency groups first when you are thinking in terms of budget. Then compare refresh cadence and description to understand which shops are tied to short rotations, which ones are more stable, and which ones are worth checking every time you log in.$how$,
      jsonb_build_array(
        jsonb_build_object(
          'q', 'Are these refresh timers global or server-based?',
          'a', $a$The catalog tracks the cadence described by the current public sources for each shop. It is best used as a planning reference for how often that store type changes, even when a game system uses synchronized stock behind the scenes.$a$
        ),
        jsonb_build_object(
          'q', 'Which shops matter most for progression?',
          'a', $a$That depends on your current goal. The Seed Shop drives planting progression, the Gear Shop supports active garden optimization, and the Pet Egg Shop drives companion progression, while limited shops matter most when a seasonal or premium route is live.$a$
        )
      ),
      'Open shops catalog',
      '/catalog/grow-a-garden-shops',
      $wiki$The shop network is the backbone of Grow a Garden''s everyday progression. Use the shops catalog to compare owners, currencies, and refresh timers so you know which stores are worth checking every few minutes and which ones sit on slower loops.$wiki$,
      110,
      5,
      array[
        'https://static.wikia.nocookie.net/growagarden/images/5/51/Watering_Can.png/revision/latest/scale-to-width-down/100?cb=20250429005625',
        'https://static.wikia.nocookie.net/growagarden/images/c/c3/Applefruiticon.png/revision/latest/scale-to-width-down/85?cb=20251220004807',
        'https://static.wikia.nocookie.net/growagarden/images/0/0f/AckeeProduce.png/revision/latest/scale-to-width-down/85?cb=20250830123751'
      ]::text[],
      'https://static.wikia.nocookie.net/growagarden/images/5/51/Watering_Can.png/revision/latest/scale-to-width-down/100?cb=20250429005625'
    ),
    (
      'grow-a-garden-seed-packs',
      'All Seed Packs in Grow a Garden',
      'All Seed Packs in Grow a Garden',
      'Browse Grow a Garden seed packs with obtainment notes, pack contents, prices, and release timing.',
      $intro$Seed packs are one of the main ways Grow a Garden expands beyond the ordinary shop loop. They are where event plants, seasonal sets, achievement rewards, and paid or limited item pools often show up first. That makes packs more than a side mechanic. They are a major source of collection progress, rare plants, and short-lived opportunities that can disappear long before standard shop items do.

This seed packs catalog keeps those packs together with their pack type, price, obtainment notes, contents count, and date added. It is built for players who want to understand not just what a pack contains, but whether the pack was a normal reward path, a premium offer, or a limited-time collection window.$intro$,
      $how$Use pack type and availability first to separate currently relevant packs from historical ones. Then compare contents count, price, and obtainment notes to tell whether a pack was a quest reward, a pass reward, a Robux item, or a limited seasonal source.$how$,
      jsonb_build_array(
        jsonb_build_object(
          'q', 'Are the listed contents the exact pack pool?',
          'a', $a$The contents follow the current public pack pages we track. When individual drop chances are available, they are preserved inside the data, but the main catalog view focuses on pack identity and access instead of showing every sub-drop on the front page.$a$
        ),
        jsonb_build_object(
          'q', 'Why keep unavailable packs listed?',
          'a', $a$Unavailable packs are still useful for collection and sourcing history. They show where specific plants originally came from and help explain why certain seeds are difficult to recover through standard shop play.$a$
        )
      ),
      'Open seed packs catalog',
      '/catalog/grow-a-garden-seed-packs',
      $wiki$Seed packs are one of the easiest ways for Grow a Garden to introduce rare and seasonal plants. Use the seed packs catalog to compare pack types, access paths, and contents before you spend event effort, premium currency, or saved pack rewards.$wiki$,
      120,
      28,
      array[
        'https://static.wikia.nocookie.net/growagarden/images/c/c6/CandyCarrotProduce.png/revision/latest/scale-to-width-down/120?cb=20260403014044',
        'https://static.wikia.nocookie.net/growagarden/images/a/a6/ChocolateBerryProduce.png/revision/latest/scale-to-width-down/120?cb=20260403014101',
        'https://static.wikia.nocookie.net/growagarden/images/b/b6/GumballProduce.png/revision/latest/scale-to-width-down/120?cb=20260403014115'
      ]::text[],
      'https://static.wikia.nocookie.net/growagarden/images/c/c6/CandyCarrotProduce.png/revision/latest/scale-to-width-down/120?cb=20260403014044'
    ),
    (
      'grow-a-garden-crafting-recipes',
      'All Crafting Recipes in Grow a Garden',
      'All Crafting Recipes in Grow a Garden',
      'Check Grow a Garden crafting recipes by category with craft time, ingredient summary, and alternative prices.',
      $intro$Crafting gives Grow a Garden a second progression lane beyond pure shop luck. Instead of waiting for the right stock to appear, players can convert existing seeds, eggs, currencies, and ingredients into new items through the crafting systems the game exposes. That makes the crafting list important for planning because it shows which upgrades are grindable, which ones need event currency, and which ones are really just expensive shortcuts.

This crafting catalog keeps the recipe output, category, craft time, ingredient summary, and alternative price together so you can scan the whole recipe pool quickly. It is especially useful when you are deciding whether to keep farming ingredients, wait for a shop route, or spend Robux instead of continuing a long craft chain.$intro$,
      $how$Use the crafting category first to separate seed, sprinkler, and item recipes. Then compare craft time and the alternative price field to understand whether a recipe is mainly a gameplay route, a time-saving premium route, or a mix of both.$how$,
      jsonb_build_array(
        jsonb_build_object(
          'q', 'What does alternative price mean here?',
          'a', $a$Alternative price reflects the premium or shortcut purchase value attached to a tracked recipe when the source page exposes one. It lets you compare the crafted route against the direct paid route without leaving the catalog.$a$
        ),
        jsonb_build_object(
          'q', 'Does this page include seasonal crafting systems?',
          'a', $a$It includes recipes that appear on the current tracked crafting sources. If a seasonal crafting table is represented there, it stays in the catalog as part of the game''s item-acquisition landscape.$a$
        )
      ),
      'Open crafting catalog',
      '/catalog/grow-a-garden-crafting-recipes',
      $wiki$Crafting is the system that lets Grow a Garden players turn ingredients and currencies into more targeted progression. Use the crafting catalog to compare recipe categories, timers, and shortcut prices before you decide whether a route is worth grinding or skipping.$wiki$,
      130,
      52,
      array[
        'https://static.wikia.nocookie.net/growagarden/images/0/0f/AckeeProduce.png/revision/latest/scale-to-width-down/85?cb=20250830123751',
        'https://static.wikia.nocookie.net/growagarden/images/c/c3/Applefruiticon.png/revision/latest/scale-to-width-down/85?cb=20251220004807',
        'https://static.wikia.nocookie.net/growagarden/images/c/c6/CandyCarrotProduce.png/revision/latest/scale-to-width-down/120?cb=20260403014044'
      ]::text[],
      'https://static.wikia.nocookie.net/growagarden/images/0/0f/AckeeProduce.png/revision/latest/scale-to-width-down/85?cb=20250830123751'
    ),
    (
      'grow-a-garden-food',
      'All Food in Grow a Garden',
      'All Food in Grow a Garden',
      'Browse Grow a Garden food recipes with recipe groups, cook time, and base weight for each dish.',
      $intro$Food and cooking give Grow a Garden another way to turn crops into progression instead of direct sale value. Once cooking became part of the game's longer-term systems, food stopped being just an event curiosity and started acting like its own item family with recipes, timers, and outputs that players may want to reference separately from the raw crop list.

This food catalog keeps the dishes, recipe group notes, base time, and base weight together so you can quickly see what each cooked item needs and how it fits into the broader cooking system. It is meant to help when you are deciding whether specific crops are better saved for recipes than sold immediately.$intro$,
      $how$Use the recipe text as the main reference here, then check base time and base weight for a quick sense of how substantial the dish is in the current cooking data. Since cooking inputs are grouped conceptually on many public pages, this catalog focuses on readability instead of pretending each recipe is a standard one-line ingredient list.$how$,
      jsonb_build_array(
        jsonb_build_object(
          'q', 'What do base time and base weight represent?',
          'a', $a$Those values reflect the tracked baseline cooking information for each food item. They are useful as quick comparison points when you want to know how long a dish takes and how heavy the finished result is before other factors come into play.$a$
        ),
        jsonb_build_object(
          'q', 'Why are recipes written as ingredient groups?',
          'a', $a$That follows the way public food sources present many dishes in Grow a Garden. Instead of one exact ingredient list, some foods are defined by categories such as bread, fruit, icing, or sweet crops, so we preserve that grouped format.$a$
        )
      ),
      'Open food catalog',
      '/catalog/grow-a-garden-food',
      $wiki$Cooking gives Grow a Garden players another way to turn harvested crops into progression. Use the food catalog to compare recipe groups, base cook times, and weight when you are deciding which plants are better used in recipes instead of sold raw.$wiki$,
      140,
      25,
      array[
        'https://static.wikia.nocookie.net/growagarden/images/c/c3/Applefruiticon.png/revision/latest/scale-to-width-down/85?cb=20251220004807',
        'https://static.wikia.nocookie.net/growagarden/images/c/c6/CandyCarrotProduce.png/revision/latest/scale-to-width-down/120?cb=20260403014044',
        'https://static.wikia.nocookie.net/growagarden/images/b/b6/GumballProduce.png/revision/latest/scale-to-width-down/120?cb=20260403014115'
      ]::text[],
      'https://static.wikia.nocookie.net/growagarden/images/c/c3/Applefruiticon.png/revision/latest/scale-to-width-down/85?cb=20251220004807'
    ),
    (
      'grow-a-garden-currencies',
      'All Currencies in Grow a Garden',
      'All Currencies in Grow a Garden',
      'See the main currencies used in Grow a Garden and the primary ways players earn or exchange them.',
      $intro$Currencies shape almost every decision in Grow a Garden because the game does not run on a single budget. Sheckles cover the standard shop loop, Garden Coins push into ascension and later upgrades, and other currencies show up through specific mechanics or seasonal systems. If you are trying to understand how progression actually works, knowing which currency feeds which layer is just as important as knowing the item prices themselves.

This currencies catalog is built as a clean reference for that economy. It keeps the major tracked currencies and their obtainment notes together so you can tell which ones are part of normal day-to-day farming and which ones belong to much narrower systems or prestige-style progression.$intro$,
      $how$Read this page from top to bottom as an economy map rather than a rarity list. The obtainment field does most of the work: it shows whether a currency comes from selling, exchange systems, quests, ascension, or a more limited mechanic so you can understand which grinds actually feed the part of the game you care about.$how$,
      jsonb_build_array(
        jsonb_build_object(
          'q', 'Which currency matters first in Grow a Garden?',
          'a', $a$For most players, Sheckles are still the main progression currency because they drive the standard seed, gear, and pet loops. Later currencies matter more once you are deep enough into the game to care about prestige-style systems and special unlocks.$a$
        ),
        jsonb_build_object(
          'q', 'Why keep niche or older currencies in the catalog?',
          'a', $a$Because they help explain older items, seasonal content, and progression branches that still show up in public references. Keeping them visible makes the economy easier to understand as a whole.$a$
        )
      ),
      'Open currencies catalog',
      '/catalog/grow-a-garden-currencies',
      $wiki$Grow a Garden runs on more than one economy layer. Use the currencies catalog to see how Sheckles, Garden Coins, and other tracked currencies fit into selling, exchange systems, and later progression before you commit to one grind path.$wiki$,
      150,
      14,
      array[
        'https://static.wikia.nocookie.net/growagarden/images/c/c3/Applefruiticon.png/revision/latest/scale-to-width-down/85?cb=20251220004807',
        'https://static.wikia.nocookie.net/growagarden/images/5/51/Watering_Can.png/revision/latest/scale-to-width-down/100?cb=20250429005625',
        'https://static.wikia.nocookie.net/growagarden/images/c/c6/CandyCarrotProduce.png/revision/latest/scale-to-width-down/120?cb=20260403014044'
      ]::text[],
      'https://static.wikia.nocookie.net/growagarden/images/c/c3/Applefruiticon.png/revision/latest/scale-to-width-down/85?cb=20251220004807'
    )
)
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
  wiki_image_urls,
  thumb_url,
  is_published,
  published_at
)
select
  (select universe_id from target_universe),
  code,
  title,
  seo_title,
  meta_description,
  intro_md,
  how_it_works_md,
  '{}'::jsonb,
  faq_json,
  cta_label,
  cta_url,
  wiki_md,
  wiki_sort_order,
  wiki_item_count,
  wiki_image_urls,
  thumb_url,
  true,
  now()
from seed_rows
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
  wiki_image_urls = excluded.wiki_image_urls,
  thumb_url = excluded.thumb_url,
  is_published = excluded.is_published,
  published_at = coalesce(public.catalog_pages.published_at, excluded.published_at);

update public.wiki_pages
set
  title = 'Grow a Garden Wiki',
  seo_title = 'Grow a Garden Wiki',
  meta_description = 'Grow a Garden wiki hub with gameplay tips, catalog links, tools, quizzes, and Roblox universe details.',
  universe_id = (
    select universe_id
    from public.roblox_universes
    where lower(slug) = 'grow-a-garden'
       or lower(name) = 'grow a garden'
       or lower(display_name) = 'grow a garden'
    order by
      case
        when lower(slug) = 'grow-a-garden' then 0
        when lower(display_name) = 'grow a garden' then 1
        else 2
      end
    limit 1
  ),
  controls_json = '[]'::jsonb,
  tips_md = $tips$- Seed Shop main stock refreshes every 5 minutes, while Daily Deals refresh every 24 hours.
- Gear Shop stock rotates every 5 minutes.
- Pet Egg Shop eggs are part of their own refresh cycle, with standard shop eggs rotating every 30 minutes.
- Garden Coins come from ascension and feed later progression, including extra egg-slot upgrades.
- Mutations can come from weather, pets, sprays, fertilizers, and more specialized limited systems, so profitable farming often depends on timing rather than just planting a high-value crop.$tips$,
  is_published = true
where lower(slug) = 'grow-a-garden';

insert into public.wiki_pages (
  slug,
  title,
  seo_title,
  meta_description,
  universe_id,
  controls_json,
  tips_md,
  is_published
)
select
  'grow-a-garden',
  'Grow a Garden Wiki',
  'Grow a Garden Wiki',
  'Grow a Garden wiki hub with gameplay tips, catalog links, tools, quizzes, and Roblox universe details.',
  (
    select universe_id
    from public.roblox_universes
    where lower(slug) = 'grow-a-garden'
       or lower(name) = 'grow a garden'
       or lower(display_name) = 'grow a garden'
    order by
      case
        when lower(slug) = 'grow-a-garden' then 0
        when lower(display_name) = 'grow a garden' then 1
        else 2
      end
    limit 1
  ),
  '[]'::jsonb,
  $tips$- Seed Shop main stock refreshes every 5 minutes, while Daily Deals refresh every 24 hours.
- Gear Shop stock rotates every 5 minutes.
- Pet Egg Shop eggs are part of their own refresh cycle, with standard shop eggs rotating every 30 minutes.
- Garden Coins come from ascension and feed later progression, including extra egg-slot upgrades.
- Mutations can come from weather, pets, sprays, fertilizers, and more specialized limited systems, so profitable farming often depends on timing rather than just planting a high-value crop.$tips$,
  true
where not exists (
  select 1
  from public.wiki_pages
  where lower(slug) = 'grow-a-garden'
);
