-- Upsert the refined local Adopt Me wiki catalog pages into production.
-- Generated from local wiki_catalog_pages rows for wiki_slug = 'adopt-me'.

with payload as (
  select *
  from jsonb_to_recordset($adopt_me_wiki_catalog$
[
  {
    "universe_id": 383310974,
    "wiki_slug": "adopt-me",
    "collection_slug": "accessory-shop",
    "code": "adopt-me-accessory-shop",
    "title": "All 9 Accessory Shop Items in Adopt Me",
    "seo_title": "All 9 Accessory Shop Items in Adopt Me",
    "meta_description": "Adopt Me Accessory Shop chests and shop-tied pets explained by Bucks cost, chest odds, UGC reward history, and rarity.",
    "intro_md": "Adopt Me's Accessory Shop is split between pet-wear chests and a small group of pets tied to the shop's older reward history. That split matters because a Standard or Regal Chest is a Bucks pull for random pet wear, while pets like Jellyfish, Honey Badger, and Tri-horned Treehopper came from a different purchase path.\n\nIf you're comparing these items, start with the role they play. Chests are for opening or saving as tradeable gift items. The shop pets are more about collection history, original cost, and whether the old route is still around.",
    "how_it_works_md": "Accessory Shop items make more sense when you separate chest pulls from shop pets. Standard Chest and Regal Chest are Bucks items that open into random pet wear. The listed odds show the chance of each rarity tier, so they help you decide between cheaper pulls and better higher-rarity odds.\n\nThe shop-tied pets need a different read. Bloodhound had a simple Bucks price, while the UGC reward pets came from buying multiple Adopt Me UGC avatar items. Since that UGC reward route left the shop in 2026, those pets are better treated as older reward pets where trading and collector demand can matter more than the original price.",
    "description_md": "## Accessory Shop items are split into chests and shop pets\n\nThe Accessory Shop is mainly known for pet wear, which is cosmetic gear your pets can wear. Some pet wear comes from Standard and Regal Chests, and some appears on direct stands inside the shop rotation.\n\nThe pet entries in this group are different. Bloodhound was a Bucks pet, while Irish Water Spaniel, Glacier Moth, African Wild Dog, Jellyfish, Honey Badger, and Tri-horned Treehopper were tied to the old UGC reward system. Those pets should be judged like shop-history pets, not like normal chest pulls.\n\n## Standard Chest is the cheaper random pull\n\nStandard Chest costs 105 Bucks and opens into a random pet accessory. Its odds lean heavily toward common and uncommon pet wear, with 60% common, 30% uncommon, 7.5% rare, 2% ultra-rare, and 0.5% legendary in the local chest data.\n\nThat makes Standard Chest better when you want cheap openings or extra pet wear without spending much. It is a rough choice when you are chasing one specific rare piece because every opening is still a roll.\n\n## Regal Chest costs more because the odds are better\n\nRegal Chest costs 300 Bucks, so each opening is almost three Standard Chests in price. The tradeoff is the rarity spread: 20% common, 50% uncommon, 20% rare, 8.5% ultra-rare, and 1.5% legendary.\n\nThat does not make Regal Chest a guarantee. It simply gives you a better shot at higher rarity pet wear per opening. If you are saving Bucks, the decision is usually cheap volume with Standard Chest or stronger odds with Regal Chest.\n\n## The 10-minute stand rotation changed pet wear buying\n\nThe current Accessory Shop also has direct pet-wear stands that refresh every 10 minutes. Those stands sell pieces from the chest rotation, and the price changes by rarity: common pet wear is cheap, while legendary pieces cost a lot more.\n\nThat system matters because chests are not the only way to get pet wear anymore. If the exact accessory you want appears on a stand, buying it directly can be cleaner than opening chest after chest and hoping the roll lands.\n\n## UGC reward pets are shop history now\n\nSeveral pets in this group came from the Accessory Shop's old UGC reward system. That system gave stamps when players bought Adopt Me UGC avatar items, and buying enough UGC items unlocked the current reward pet.\n\nThe UGC store left the Accessory Shop on January 30, 2026. That makes the older reward pets feel different from normal Bucks items. A player looking for Jellyfish, Honey Badger, African Wild Dog, Glacier Moth, Irish Water Spaniel, or Tri-horned Treehopper may be dealing with trade value and collector demand instead of a simple shop purchase.\n\n## Price means different things across this group\n\nThe chest prices are simple Bucks prices: 105 for Standard Chest and 300 for Regal Chest. Bloodhound is also easy to read because it was listed at 600 Bucks.\n\nThe UGC pets use Robux ranges because the original route depended on buying five UGC avatar items, and those items did not all cost the same. That is why a price like 295-500 or 295-700 should be read as old reward-route cost, not one fixed pet button.\n\n## Rarity is only part of the decision\n\nBoth chests are Legendary items, but that does not mean they open into Legendary pet wear. The rarity label belongs to the chest itself; the accessory inside still follows the chest odds.\n\nThe shop pets show the opposite problem. Most of them are Ultra-Rare, but older reward-route pets can be harder to replace than the rarity label makes them look. If the original path is gone, the important question becomes how many players still have one and what they want for it in trade.",
    "description_json": {
      "Obtainable Pets": "These pets are tied to the shop's older UGC and purchase history, not normal egg hatching. Price and availability matter more than rarity because some routes depend on specific shop or UGC steps.",
      "Accessory Chests": "Standard Chest and Regal Chest are the random pet-wear pulls in the Accessory Shop. Standard Chest is the cheaper roll, while Regal Chest costs more because it gives better odds for higher-rarity accessories."
    },
    "faq_json": [
      {
        "a": "Standard and Regal Chests open into random pet wear. They do not guarantee one exact accessory; they roll from rarity pools, so the chest odds matter more than the chest's own Legendary label.",
        "q": "What do Standard and Regal Chests give in Adopt Me?"
      },
      {
        "a": "Regal Chest has better odds for rare, ultra-rare, and legendary pet wear, but it also costs 300 Bucks instead of 105. Standard is better for cheaper openings, while Regal is better when you want stronger odds per pull.",
        "q": "Is Regal Chest better than Standard Chest?"
      },
      {
        "a": "The UGC reward system left the Accessory Shop on January 30, 2026. Pets from that system, such as Jellyfish, Honey Badger, and Tri-horned Treehopper, should be treated as older shop reward pets rather than current chest items.",
        "q": "What happened to the Accessory Shop UGC reward pets?"
      },
      {
        "a": "Those pets came from buying five Adopt Me UGC avatar items. The total Robux spend depended on which UGC items were bought, so the original cost is shown as a range instead of one fixed price.",
        "q": "Why do some Accessory Shop pets show Robux ranges?"
      },
      {
        "a": "No. Bloodhound was listed as a 600 Bucks shop pet, while the UGC reward pets were tied to buying Adopt Me UGC avatar items. That difference matters when you compare original cost and replacement difficulty.",
        "q": "Is Bloodhound the same as the UGC reward pets?"
      },
      {
        "a": "Open chests when you are fine with random pet wear and can spend the Bucks. If you want one exact accessory or an older shop pet, trading may be cleaner because chest openings and old reward routes do not guarantee the item you want.",
        "q": "Should I open chests or trade for the accessory I want?"
      }
    ],
    "schema_ld_json": null,
    "thumb_url": "/Adopt%20Me/Accessory%20Shop/standard-chest.webp",
    "wiki_md": "Accessory Shop items split into pet-wear chests and shop-tied pets. Chests are Bucks pulls for random accessories, while older UGC reward pets matter more for collection and trading because their original reward route has changed.",
    "wiki_sort_order": 4010,
    "is_published": true,
    "published_at": "2026-05-07T21:33:05.667+00:00",
    "created_at": "2026-05-07T21:33:06.280448+00:00",
    "updated_at": "2026-05-19T06:59:27.100765+00:00"
  },
  {
    "universe_id": 383310974,
    "wiki_slug": "adopt-me",
    "collection_slug": "eggs",
    "code": "adopt-me-eggs",
    "title": "All 38 Eggs in Adopt Me",
    "seo_title": "All 38 Eggs in Adopt Me",
    "meta_description": "Adopt Me eggs explained by how to get them, hatch odds, current availability, Star Rewards, Pet Releaser tickets, events, and old rotations.",
    "intro_md": "Eggs are pet pools in Adopt Me. The egg you hatch decides which pets can appear, how rare those pets can be, and whether you can easily try again after a bad roll.\n\nThat is why the route matters as much as the egg name. A Cracked Egg is a cheap Nursery roll, an Endangered Egg is the current themed hunt, a Golden Egg comes from Star Rewards, and an old Safari Egg is usually a trade decision before it is a hatch decision.",
    "how_it_works_md": "Read an Adopt Me egg in this order:\n\n1. Check the route. Bucks, gumball rotation, Star Rewards, Pet Releaser Tickets, events, Admin Abuse, and trading all mean different things.\n2. Check whether another copy is easy to get. Current Nursery eggs are safe to hatch often; old event and retired gumball eggs are harder to replace.\n3. Check the hatch pool. The egg decides which pets can appear.\n4. Check the odds. The rarity label on the egg is not the same as the rarity of the pet that will hatch.\n\nThis keeps the decision simple. Repeatable eggs are for grinding, current themed eggs are for active pet hunting, old eggs are trade-aware choices, and timed eggs depend on the event window.",
    "description_md": "## How to acquire eggs in Adopt Me\n\nMost eggs come from one of six routes. Learn the route first, then the price and odds make a lot more sense.\n\n1. Buy permanent Nursery eggs with Bucks. Cracked Egg, Pet Egg, and Royal Egg are the main repeatable choices.\n2. Buy the current gumball egg while its theme is active. The Endangered Egg is the current themed egg in the local egg list.\n3. Earn Star Reward eggs by building daily login streak progress. Golden Egg and Diamond Egg come from this route.\n4. Use Pet Releaser tickets for Basic Egg and Crystal Egg. These are tied to releasing pets, not normal Bucks buying.\n5. Join limited event or Admin Abuse windows when special eggs are available.\n6. Trade with other players for eggs whose original route has already left the game.\n\n## Egg routes at a glance\n\n| Egg route | Examples | How it works | Best for |\n| --- | --- | --- | --- |\n| Nursery Bucks eggs | Cracked Egg, Pet Egg, Royal Egg | Buy again with Bucks whenever you need another roll | Pet grinding and repeat hatching |\n| Current gumball egg | Endangered Egg | Buy the active themed egg while it is in rotation | Hatching the current themed pets |\n| Retired gumball eggs | Safari, Jungle, Farm, Aussie, Fossil, Ocean | Original Nursery route is gone, so trading is usually the path | Collecting, trading, or careful hatching |\n| Star Reward eggs | Golden Egg, Diamond Egg | Earn through streak progress and Stars | Guaranteed legendary-style reward hatches |\n| Pet Releaser eggs | Basic Egg, Crystal Egg | Release pets for Tickets, then spend Tickets on eggs | Turning extra pets into another hatch route |\n| Event and special eggs | Christmas Egg, Easter 2020 Egg, Admin Abuse Egg | Available through old events, special windows, or timed rewards | Event history, limited pools, and timing-based rewards |\n\n## Permanent Nursery eggs are for repeat hatching\n\nCracked Egg, Pet Egg, and Royal Egg are the safest eggs to hatch casually because you can buy more with Bucks. They are the normal choice when the goal is simply to open eggs, age pets, and keep rolling without risking an older trade item.\n\n| Egg | Cost | Why it matters |\n| --- | --- | --- |\n| Starter Egg | Free | Beginner egg, mostly useful for the start of a new account |\n| Cracked Egg | 350 Bucks | Cheapest repeatable egg, but the legendary chance is tiny |\n| Pet Egg | 600 Bucks | Middle option with better odds than Cracked Egg |\n| Royal Egg | 1,450 Bucks | Expensive Nursery option with no common hatch result |\n| Retired Egg | 600 Bucks in VIP | Still available, but gated behind VIP access and an older normal-pet pool |\n\nIf you just want to hatch pets without overthinking trade value, stay with current repeatable eggs. The risk is low because another copy is easy to get.\n\n## Gumball eggs are current pet hunts until they rotate out\n\nThe gumball machine is where Adopt Me's themed egg cycle matters most. When a themed egg is active, it is the cleanest way to hatch that theme's pets directly. The Endangered Egg is the current example here, with a 750 Bucks price and a pool that includes pets like California Condor, Black Rhino, Sea Turtle, and Blue Whale.\n\nOlder gumball eggs need a different mindset. Safari Egg, Jungle Egg, Farm Egg, Aussie Egg, Fossil Egg, Ocean Egg, Mythic Egg, Woodland Egg, Japan Egg, Southeast Asia Egg, Danger Egg, Urban Egg, Desert Egg, Garden Egg, Moon Egg, and Aztec Egg all point to older rotations. Once that rotation is gone, hatching the egg also means giving up an item another player may want for trading.\n\n## Star Rewards and Pet Releaser eggs follow their own rules\n\nGolden Egg and Diamond Egg are simple once you understand the route: they come from Star Rewards, not a shop counter. Their listed hatch odds are 100% Legendary, but the hard part is earning enough Stars through streak progress.\n\nBasic Egg and Crystal Egg are a different system again. They use Pet Releaser Tickets, which come from releasing pets. Basic Egg is the cheaper ticket egg and leans heavily toward common and uncommon outcomes. Crystal Egg costs much more and starts at rare, ultra-rare, and legendary-style outcomes.\n\n| Egg | Route | What to know before chasing it |\n| --- | --- | --- |\n| Golden Egg | Star Rewards | Guaranteed legendary hatch, but earned through long streak progress |\n| Diamond Egg | Star Rewards | Another guaranteed legendary hatch after progressing through the reward cycle |\n| Basic Egg | Pet Releaser Tickets | Cheaper ticket egg, best understood as a recycling reward route |\n| Crystal Egg | Pet Releaser Tickets | Expensive ticket egg with stronger high-rarity odds |\n\n## Event and Admin Abuse eggs depend on timing\n\nEvent eggs are usually valuable because their original timing is gone. Christmas Egg came through Christmas gifts, Easter 2020 Egg came from the 2020 Easter event, Wrapped Doll came from a limited stand, and Royal Desert, Royal Moon, and Royal Aztec eggs were stronger event versions tied to specific releases.\n\nAdmin Abuse Egg is timing-based in a different way. It can be free during Admin Abuse events, but that does not mean it behaves like a permanent Nursery egg. If the event window is closed, the egg should be treated like a special-timing item.\n\n## Hatch odds matter more than the egg rarity label\n\nThe egg's rarity label is easy to misread. A Legendary egg is not always a guaranteed Legendary pet. The actual hatch odds decide the result.\n\n| Egg | Egg label | Legendary hatch chance | What that means |\n| --- | --- | --- | --- |\n| Cracked Egg | Common | 1.5% | Cheap to repeat, weak legendary odds |\n| Royal Egg | Legendary | 8% | Better Nursery odds, still not guaranteed |\n| Endangered Egg | Legendary | 3% | Current themed pool with a small legendary chance |\n| Golden Egg | Legendary | 100% | Star Reward egg with guaranteed legendary result |\n| Diamond Egg | Legendary | 100% | Star Reward egg with guaranteed legendary result |\n| Admin Abuse Egg | Legendary | 5% | Timed event egg with its own pool |\n\nRead the odds like a risk check. If the egg is easy to replace, a low legendary chance is just part of the grind. If the egg is old or event-tied, the same low chance can make hatching feel a lot riskier.\n\n## What to hatch, save, or trade\n\nUse this simple rule when you are unsure:\n\n- Hatch current Bucks eggs when you want repeatable pet rolls.\n- Hatch the active gumball egg when you want pets from the current theme.\n- Think twice before hatching old gumball or event eggs, because the original route may be gone.\n- Save Star Reward eggs if you care more about the egg itself than the guaranteed legendary pet inside.\n- Use Pet Releaser eggs when you are already clearing extra pets and want another reward path.\n- Treat Admin Abuse Egg as event-window content, not an always-open shop egg.\n\nEggs are easiest to understand when you separate the route from the roll. The route tells you how hard another copy is to get. The roll tells you what can come out of it.",
    "description_json": {
      "Admin Abuse egg": "Admin Abuse Egg is its own odd-case reward. It does not fit the usual Nursery, gumball, or Star Rewards path, so it needs to be read as a special release instead of a normal egg route.",
      "Pet Releaser eggs": "Pet Releaser eggs come from a separate system, so treat them differently from normal Nursery eggs. Their price and odds matter, but the route behind them is the bigger reason players compare them.",
      "Star Rewards eggs": "Golden Egg and Diamond Egg come from login Star Rewards, so they are progress rewards instead of shop rolls. Each one hatches a guaranteed legendary from its own small pet pool.",
      "Nursery and VIP eggs": "These are the repeatable egg routes players see as the normal hatching baseline. Cracked Egg, Pet Egg, and Royal Egg are the main Bucks choices, while Retired Egg sits behind VIP access.",
      "Rotating gumball eggs": "Gumball eggs are the big themed pet pools that rotate over time. Their hatch odds are usually similar, but the animal theme and availability decide whether an egg is easy to try again or mostly trade history.",
      "Event and special eggs": "Event eggs, seasonal eggs, and one-off special eggs depend on timing. Once the original event or special route is gone, the egg itself can become more important than the pet you might hatch from it."
    },
    "faq_json": [
      {
        "a": "You can buy repeatable Nursery eggs with Bucks, buy the current gumball egg while it is active, earn Golden Egg and Diamond Egg through Star Rewards, use Pet Releaser Tickets for Basic Egg and Crystal Egg, join special event windows, or trade for old eggs.",
        "q": "How do you get eggs in Adopt Me?"
      },
      {
        "a": "Cracked Egg, Pet Egg, and Royal Egg are the easiest normal replacements because they are permanent Nursery Bucks eggs. Retired Egg is also available through VIP, but many old themed and event eggs need trading.",
        "q": "Which Adopt Me eggs are easiest to replace?"
      },
      {
        "a": "No. The rarity label belongs to the egg item. Royal Egg, Endangered Egg, and Admin Abuse Egg are Legendary eggs, but their legendary hatch chances are still limited by their odds.",
        "q": "Does a Legendary egg always hatch a Legendary pet?"
      },
      {
        "a": "Old gumball eggs matter because their original rotation is gone. Hatching one can be fun, but it also removes an older tradeable egg that may be harder to replace than a current Bucks egg.",
        "q": "Why do old gumball eggs matter?"
      },
      {
        "a": "Cracked Egg is the cheapest normal roll, Pet Egg costs more and improves the odds, and Royal Egg is the expensive Nursery option with no common hatch result and the best legendary chance among the three.",
        "q": "What is the difference between Cracked Egg, Pet Egg, and Royal Egg?"
      },
      {
        "a": "Basic Egg and Crystal Egg use the Pet Releaser Ticket route instead of normal Bucks buying. Basic Egg is the cheaper ticket egg, while Crystal Egg costs more and has stronger higher-rarity odds.",
        "q": "How are Basic Egg and Crystal Egg different from normal eggs?"
      },
      {
        "a": "Admin Abuse Egg availability means the egg can be given during Admin Abuse event windows. It should not be treated like a permanent shop egg that can be bought at any time.",
        "q": "What does Admin Abuse Egg availability mean?"
      }
    ],
    "schema_ld_json": null,
    "thumb_url": "/Adopt%20Me/Eggs/blue-egg.webp",
    "wiki_md": "Eggs control the pet pool behind each hatch in Adopt Me. Current Nursery eggs are safe repeat hatches, rotating gumball eggs drive the active pet hunt, and older event or themed eggs usually matter because their original route has ended.",
    "wiki_sort_order": 4020,
    "is_published": true,
    "published_at": "2026-05-07T21:33:05.667+00:00",
    "created_at": "2026-05-07T21:33:06.280448+00:00",
    "updated_at": "2026-05-19T06:59:27.168829+00:00"
  },
  {
    "universe_id": 383310974,
    "wiki_slug": "adopt-me",
    "collection_slug": "food",
    "code": "adopt-me-food",
    "title": "All 90 Food, Drinks, Candy, and Potions in Adopt Me",
    "seo_title": "All 90 Food, Drinks, Candy, and Potions in Adopt Me",
    "meta_description": "Adopt Me food, drinks, candy, and potions explained by needs, uses, prices, weather timing, event history, and effects.",
    "intro_md": "Food in Adopt Me sits inside the same loop as pet care, Bucks, and aging. Hungry and Thirsty tasks look small, but they decide how smoothly you can grind with a pet out, play as a baby, and keep earning while you move around the map.\n\nThe important split is simple. Cheap food and drinks are everyday supplies, candy and old treats are more about collecting or event history, and potions matter because they change progress, movement, or a pet's abilities.",
    "how_it_works_md": "Food groups in Adopt Me make more sense when you read them by role. Edible Food and Drinkable Drinks are mostly for Hungry and Thirsty tasks. Candy can add a small speed effect and often carries event history. Potions are consumables with specific effects, so their value comes from progress, movement, pet abilities, or old availability.\n\nPrice tells you how easy an item is to replace right now. Uses tell you how many bites or sips a baby or parent gets from the item. Location tells you whether the item comes from a regular shop, a house setup, a weather rotation, a player stand, or an older event. Effect matters most for potions because the effect is the whole reason to keep or use them.",
    "description_md": "## Food starts with hungry and thirsty tasks\n\nMost normal food and drinks clear Hungry or Thirsty tasks for babies and pets. That is the practical reason apples, bottles, water, pizza, coffee, tea, and house food matter: they keep the care loop moving while you age pets and earn Bucks.\n\nUses matter more when a baby or parent eats the item, because some foods take one bite and others last through several bites or sips. Pets consume food on the game's own timing, so I usually care more about having a cheap food and drink ready than trying to squeeze perfect value out of each bite.\n\n## Cheap shop food is supply, old food is collection\n\nGreen Groceries, the Baby Shop, the Coffee Shop, the Pizza Shop, the Camping Shop, and house furniture cover a lot of the normal refill routes. If something costs a few Bucks, comes free from a building, or can be grabbed from a house setup, it is best treated like basic supply.\n\nOlder food works differently. Blueberry Pie, Burger, Cake, Dim Sum, advent food, and other removed or event-tied items may still behave like simple food in the inventory, but the hard part is getting another one. For those items, the story is less about hunger and more about whether the item can still be replaced.\n\n## Drinks are the other half of the task loop\n\nThirsty tasks come up often enough that drinks deserve their own attention. Water Bottles, Baby Bottles, Lemonade, Hot Cocoa, Coffee, Tea, and house drinks are useful because they stop you from running to a shop every time a pet wants a drink.\n\nPlayer stands and house items can make drinks feel casual, but the listed route still matters. A Lemonade Stand or Hotdog Stand item depends on a player-owned setup, while shop and house furniture routes are easier to plan around when you are grinding for a long session.\n\n## Candy is usually about speed, events, or collecting\n\nCandy is the odd part of Adopt Me food. Candy-classified items can slightly boost player speed, which makes them feel closer to a small movement item than a normal snack. They also have a strong event feel because many candy names are tied to older seasonal rewards.\n\nI would be careful before feeding old candy just to clear a basic need. If the item came from an older event, its real value may be the fact that it is no longer easy to restock. Normal food can replace the task value, but it cannot replace the history of an older candy item.\n\n## Weather food depends on the current rotation\n\nWeather items sit between normal shop food and limited event food. The local food data includes examples such as Coconut Drink for Rain Weather, Cinnamon Roll for Fall Weather, Knafeh for Desert Weather, and Ice Lolly for Snow Weather.\n\nThese items are not always gone forever when they disappear from the map. They depend on the weather cycle, so the smart move is patience unless you need one right away. When the right weather is active, they are much easier to restock.\n\n## Potions are effects, not normal meals\n\nPotions belong in the food and consumable space, but they should be judged by what they do. Age-Up Potion and Tiny Age Potion move pet progress. Cure All Potion clears needs. Ride-A-Pet Potion and Fly-A-Pet Potion unlock major pet features. Hyperspeed, Grow, Big Head, Anti-gravity, Big Brew, Translucent Tea, and Small Sip are more about temporary movement, size, or appearance changes.\n\nThis is where rarity and price can matter more than hunger value. Feeding an apple and using a Ride-A-Pet Potion are both consumable actions, but they solve completely different problems. I would treat effect potions like utility items, especially when they change a pet permanently or save a lot of aging time.\n\n## Blank or limited details should be handled carefully\n\nSome older food and candy entries have missing prices, unclear obtainment, or blank availability. That does not automatically mean the item is worthless or common. It means the clean public route is not listed clearly enough to treat it like regular shop food.\n\nFor practical play, the safest rule is simple: stock cheap current food, save older event food, wait for weather food when the rotation is close, and think twice before using a potion with a meaningful effect.",
    "description_json": {
      "Candy": "Candy usually points to events, speed boosts, stands, or older reward items. Some candy is meant to be used quickly, but limited candy can be more interesting as a saved collectible.",
      "Potions": "Food-page potions are consumables with effects, not normal meals. Check what the effect does before using one because several potion effects are the real value of the item.",
      "Edible Food": "Edible food covers the basic Hungry task loop and small roleplay items. Most cheap food is easy to replace, but older event food can matter more as a collector item than as something to feed away.",
      "Special Potions": "Special potions sit outside normal food and drink use. These are the items to read carefully because their source, effect, or event connection usually matters more than the food label.",
      "Drinkable Drinks": "Drinks handle the Thirsty side of baby and pet care. Cheap drinks are everyday supplies, while retired or event drinks should be checked before using because replacement can be harder."
    },
    "faq_json": [
      {
        "a": "Normal food and drinks help clear Hungry and Thirsty tasks for babies and pets. Those tasks are part of the core care loop, so keeping a few cheap items ready makes pet aging and Bucks grinding smoother.",
        "q": "What does food do in Adopt Me?"
      },
      {
        "a": "Babies and parents can take several bites or sips from some items, which is why uses are useful to know. Pets consume food on the game's own timing, so the main thing is having the right food or drink available when the need appears.",
        "q": "Do pets and babies use food the same way?"
      },
      {
        "a": "Cheap current food and drinks are the safest everyday stock. Apples, water, bottles, pizza, coffee, tea, and house food are useful because they solve tasks without making you spend much or chase an old item.",
        "q": "Which food should I keep stocked?"
      },
      {
        "a": "Old candy and event food may still work like simple consumables, but replacing them can be the hard part. If an item came from an old event or removed shop, it may be smarter to save it and use regular food for needs.",
        "q": "Why are old candy and event food worth keeping?"
      },
      {
        "a": "Potions are consumables, but they are better understood as effect items. Some age pets faster, some clear needs, some unlock ride or fly features, and others change movement, size, or appearance.",
        "q": "Do potions count as food?"
      },
      {
        "a": "Weather labels mean the item is tied to a weather rotation instead of a normal always-open shop. If the matching weather is active, the item is easier to get; if it is not active, waiting may be better than overpaying.",
        "q": "What do weather labels mean?"
      }
    ],
    "schema_ld_json": null,
    "thumb_url": "/Adopt%20Me/Food/apple.webp",
    "wiki_md": "Food in Adopt Me covers hungry and thirsty task items, drinks, candy, and potion-style consumables. Cheap shop food is normal grinding supply; older event food, weather items, and effect potions matter more because they are harder to replace or change how a pet or player behaves.",
    "wiki_sort_order": 4030,
    "is_published": true,
    "published_at": "2026-05-07T21:33:05.667+00:00",
    "created_at": "2026-05-07T21:33:06.280448+00:00",
    "updated_at": "2026-05-19T06:59:27.196019+00:00"
  },
  {
    "universe_id": 383310974,
    "wiki_slug": "adopt-me",
    "collection_slug": "furniture",
    "code": "adopt-me-furniture",
    "title": "All 1,898 Furniture Items in Adopt Me",
    "seo_title": "All 1,898 Furniture Items in Adopt Me",
    "meta_description": "Adopt Me furniture explained by category, Bucks cost, build use, Storage, event pieces, house trading, and room planning.",
    "intro_md": "Furniture is what turns an Adopt Me house from an empty shell into a nursery, pet-care room, shop, racetrack, display room, or full custom build. A cute item can still be the wrong buy if it does not fit the room, the budget, or the kind of build you are making.\n\nMost furniture pieces are best read through two values: category and Bucks cost. Category tells you what kind of build problem the item solves. Cost tells you whether the idea is cheap enough to repeat across a room or expensive enough to plan around.",
    "how_it_works_md": "Furniture in Adopt Me is easiest to read by build purpose. Category tells you what kind of room or theme the item belongs to, while Bucks cost tells you how painful it will be to repeat that piece across a build.\n\nFor normal rooms, start with functional furniture such as beds, cribs, showers, bowls, fridges, chairs, and tables. For custom builds, shapes and small decorations matter more because they create walls, counters, props, and detailed layouts. For flex rooms or house trading, displays, rare pieces, and clean theme matching can matter more than a single item's price.\n\nIf a furniture set looks tied to an event, reward, or old update, treat it carefully until you know whether that route is still active. Regular Bucks furniture is build supply. Older reward furniture is better handled like a piece you may want to keep.",
    "description_md": "## How to get furniture in Adopt Me\n\nFurniture starts inside your home, not from a normal backpack trade route. The usual flow is simple:\n\n1. Enter one of your houses and open editing mode.\n2. Pick a category, use search, or browse the A-Z style list when you know the item name.\n3. Place the item in the room and pay the listed Bucks cost, unless the item is free.\n4. Move, rotate, resize, clone, or store the item while building.\n5. Use Storage when you want to keep eligible furniture and reuse it in another house later.\n6. Trade full houses when the build itself is the item being traded. The furniture moves with the house.\n\nThat last part matters. Furniture usually works as part of a house build, not like a pet, stroller, toy, or vehicle sitting in a normal trade window.\n\n## Furniture groups at a glance\n\n| Group | Examples | Best use | Watch for |\n| --- | --- | --- | --- |\n| Room basics | Living Room, Bathroom, Kitchen, Bedroom | Normal rooms, family roleplay, pet and baby spaces | Cheap pieces are easy to repeat |\n| Pet and baby furniture | Pet bowls, pet beds, cribs, beds, showers | Need rooms and grinding setups inside a home | Function matters more than theme |\n| Shapes and building pieces | Brick, Glass, Plain, Stone, Wood Shapes | Custom walls, counters, dividers, props, glitch-style detail | Repeating small pieces can hit the item limit fast |\n| Theme packs | Space, Pirate, Castle, Fashion, Moon, Sugarfest | Fast style direction for a themed house | Matching a whole theme can cost a lot of Bucks |\n| Displays and stands | Holdables, accessory, stroller, pet, vehicle displays | Showing inventory pieces inside a house | Better for flex rooms and show builds |\n| Event and reward sets | Furniture Sale, Winter Event, Halloween Event | Limited-looking rooms and collection builds | Original routes may depend on old events or rewards |\n| Special systems | Lures, Teleporter, Money Tree, Age-O-Matic | Utility, collection, or special room ideas | Expensive pieces should be planned before buying |\n\n## Start with the room job before the theme\n\nThe easiest way to build a good house is to decide what the room needs to do first. A bedroom needs beds or cribs. A pet-care room needs bowls, beds, showers, and other useful pieces. A kitchen needs food and drink furniture. A display room needs stands and open floor space.\n\nAfter the room works, the theme becomes easier. A Space room, Castle room, Cute room, or Sugarfest room looks better when the basic layout already makes sense. If you buy the pretty pieces first, it is easy to spend Bucks before you know where the important furniture should go.\n\n## Shapes are the pieces serious builders repeat\n\nShape categories are easy to underestimate. Brick Shapes, Glass Shapes, Plain Shapes, Stone Shapes, and Wood Shapes are the pieces players use to make custom counters, fake walls, shelves, signs, stairs, booths, windows, and small detail work.\n\nThe tradeoff is item count. Adopt Me homes have a 4,000 furniture-item limit, so a detailed custom build can run out of space long before it runs out of ideas. Cheap shapes are great, but repeating hundreds of tiny pieces should be part of the plan, not an accident.\n\n## Bucks cost changes how you plan a build\n\nMost furniture is cheap enough to experiment with. Many pieces cost under 50 Bucks, which makes them good for blocking out a room, testing scale, or adding small details.\n\n| Cost range | How to think about it |\n| --- | --- |\n| Free | Good for starter rooms, testing layouts, and filling empty space |\n| 1-50 Bucks | Best range for repeat details, shapes, small props, and room polish |\n| 51-150 Bucks | Normal furniture budget for useful room pieces |\n| 151-500 Bucks | Bigger theme pieces, displays, beds, counters, and standout decor |\n| 501+ Bucks | Buy with a plan because repeating these can drain Bucks quickly |\n\nExpensive pieces can still be worth it. Teleporter, display stands, Collector's Potions, rare objects, and big themed furniture can define a room. They just should not be impulse buys when the rest of the house is still empty.\n\n## Storage makes furniture less risky to buy\n\nFurniture Storage is a big deal for builders because eligible furniture can be kept and reused later, even in a different house. That makes experimentation less painful than it used to be, especially when you are testing layouts or moving a theme from one home to another.\n\nStorage does not mean every old route is active again. It mainly changes how you manage pieces you already placed or own. For build planning, that means you can think more in terms of reusable sets instead of treating every house as a totally separate project.\n\n## Event and reward furniture should be treated carefully\n\nSome furniture categories come from older updates, login rewards, seasonal events, or limited reward windows. Furniture Sale, Halloween Event, Winter Event, Summer Festival, and Sugarfest-style groups can be more about timing and collection than normal always-open buying.\n\nThe safe approach is simple: treat regular Bucks furniture as build supply, and treat event or reward-looking pieces as harder to replace unless the current game clearly offers that route. That keeps you from casually selling or wasting a piece that might be more useful in a future themed build.\n\n## Furniture affects house trading, not normal item trading\n\nHouse Trading made furniture matter in a different way. When a house is traded, the furniture and expansions move with it, so a strong build can have value as a full house.\n\nThat does not make every couch or shape piece a normal trade item. It means the finished build matters: layout, detail, theme, usable rooms, and total effort can change how another player sees the house. Also, furniture from a traded house does not refund Bucks when sold, so buying a house just to strip the furniture is not the same as buying fresh pieces.\n\n## Build with a small plan before spending big\n\nA good furniture plan saves Bucks and usually makes the build look cleaner.\n\n- Pick the room job first: pet care, bedroom, kitchen, shop, display, roleplay, or decoration.\n- Use cheap shapes and free pieces to test the layout before buying expensive theme items.\n- Buy repeated pieces in small batches so you can adjust scale without wasting Bucks.\n- Save expensive displays, rare objects, and special systems for rooms that already have a clear purpose.\n- Keep an eye on the 4,000-item limit if the build uses lots of tiny shape pieces.\n- Be careful with old event and reward furniture because the original route may not be easy to repeat.",
    "description_json": {},
    "faq_json": [
      {
        "a": "Open editing mode inside your house, choose a furniture category or search for an item, then place it by paying the listed Bucks cost. Some items are free, and some older or reward pieces may come from special update routes.",
        "q": "How do you get furniture in Adopt Me?"
      },
      {
        "a": "Start with the room's job. Beds, cribs, showers, bowls, fridges, chairs, and tables make a house usable. After the room works, add theme pieces, displays, shapes, and decoration.",
        "q": "What furniture should I buy first for a new house?"
      },
      {
        "a": "Shape pieces let builders create custom walls, counters, shelves, props, signs, stairs, and detail work. They are usually cheap, but using too many tiny pieces can push a house toward the furniture item limit.",
        "q": "Why are shape pieces important in Adopt Me builds?"
      },
      {
        "a": "Furniture Storage lets eligible furniture from a home be stored and used later, even in a different house. It is useful when moving a theme, testing layouts, or keeping pieces instead of selling them.",
        "q": "What does Furniture Storage do?"
      },
      {
        "a": "Furniture is mainly part of house building. House Trading moves the furniture with the full house, but that is different from trading one furniture item like a pet, toy, stroller, or vehicle.",
        "q": "Can furniture be traded by itself?"
      },
      {
        "a": "Furniture is better understood by category, cost, function, and update route. Rarity is not the main planning value for most furniture entries.",
        "q": "Does furniture have rarity like pets?"
      },
      {
        "a": "Be careful with event or reward furniture. If the original route is gone or unclear, the piece may be harder to replace than normal Bucks furniture.",
        "q": "Should I sell old event furniture?"
      }
    ],
    "schema_ld_json": null,
    "thumb_url": "/Adopt%20Me/Furniture/space-fleet-bed.webp",
    "wiki_md": "Furniture shapes how Adopt Me houses work and feel. Room pieces support pet care and roleplay, shapes power custom builds, and event or reward furniture can matter because older routes may not be easy to repeat.",
    "wiki_sort_order": 4040,
    "is_published": true,
    "published_at": "2026-05-07T21:33:05.667+00:00",
    "created_at": "2026-05-07T21:33:06.280448+00:00",
    "updated_at": "2026-05-18T11:31:14.388798+00:00"
  },
  {
    "universe_id": 383310974,
    "wiki_slug": "adopt-me",
    "collection_slug": "gift-prizes",
    "code": "adopt-me-gift-prizes",
    "title": "All 87 Gift Prizes in Adopt Me",
    "seo_title": "All 87 Gift Prizes in Adopt Me",
    "meta_description": "Adopt Me gift prizes explained by refresh, gift odds, current rewards, older rotations, rarity tiers, and what to save or trade.",
    "intro_md": "Gift prizes are the toys, strollers, vehicles, plushes, and odd little collectibles that come out of Adopt Me's Small, Big, and Massive Gifts. The gift is the box you open. The prize is the item you keep after the roll.\n\nRefresh timing is the detail that changes everything. A reward from the active Gift Display is something players can still roll while that pool is running. A reward from an older refresh usually turns into trade or collection history because the original board has moved on.",
    "how_it_works_md": "Read a gift prize in three passes.\n\n1. Start with the refresh. The refresh tells you whether the item belongs to the active reward pool or an older Gift Display era.\n2. Then read the rarity. Rarity tells you the roll tier, and the gift odds explain how hard that tier is to hit.\n3. Finally, look at the prize type. A stroller, vehicle, plush, propeller, and throw toy all matter for different reasons.\n\nThis keeps the decision simple. Current prizes are for opening if you want to spend Bucks on rolls. Older prizes are more trade-aware because the original reward pool may no longer be available through normal gifts.",
    "description_md": "## How gift prizes work in Adopt Me\n\nThe regular Gift Display sells Small, Big, and Massive Gifts near Santa on Adoption Island. Each gift opens into a random reward from the active prize board, with the gift size changing the odds for each rarity tier.\n\n1. Buy or earn a Small, Big, or Massive Gift.\n2. Open the gift to roll a rarity tier.\n3. The game gives a prize from the current Gift Display pool for that tier.\n4. When the board refreshes, older rewards usually stop coming from normal gift openings.\n5. After that, trading is usually the main way to get older gift prizes.\n\nThat is why old unopened gifts can confuse players. Buying a gift during an old refresh does not lock that old reward pool forever. The active Gift Display decides what normal gifts can open into.\n\n## Gifts and gift prizes are different things\n\nA lot of trade mistakes start because players use the word gift for two different ideas. Separate the container from the reward first, then the rest of the system is easier to read.\n\n| Term | What it means in Adopt Me | Example |\n| --- | --- | --- |\n| Gift | The container you open | Small Gift, Big Gift, Massive Gift |\n| Gift prize | The item that comes out | Ladybug Plush, Donut Stroller, Micro Car |\n| Refresh | A prize board update | January 2026 Gifts Refresh |\n| Rarity | The roll tier inside the gift odds | Common, Rare, Ultra-Rare, Legendary |\n| Prize type | What the reward actually does | Toy, stroller, vehicle, propeller, pogo |\n\nThe gift size controls your odds. The refresh tells you when the prize belonged to the board. The prize type tells you whether the item is mostly for playing, roleplay, movement, or collecting.\n\n## Gift odds decide how risky each roll feels\n\nSmall Gift, Big Gift, and Massive Gift can all reward Gift Display prizes, but they do not feel the same when you are spending Bucks. A cheap roll gives more attempts. An expensive roll gives better odds for higher rarity tiers.\n\n| Gift | Cost | Legendary chance | Best use |\n| --- | --- | --- | --- |\n| Small Gift | 70 Bucks | 0.5% | Cheap rolls when you are fine with mostly common and uncommon rewards |\n| Big Gift | 199 Bucks | 1.5% | Middle-ground rolls with better rare and ultra-rare chances |\n| Massive Gift | 499 Bucks | 4% | Best high-tier odds, but still no guarantee of a legendary |\n\nMassive Gift removes common rolls, so it feels better when you want rare, ultra-rare, or legendary prizes. It also burns Bucks quickly. If you are opening gifts for fun, Small and Big Gifts are easier to spam. If you are chasing the top prize, Massive Gift is the strongest option but still a gamble.\n\n## Older refresh prizes become trade and collection history\n\nA gift refresh is a timestamp for the item. The January 2026 refresh added rewards such as Ladybug Plush, Bacon and Eggs Throw Toy, Avocado Robinado Plush, Donut Stroller, and Micro Car.\n\nOlder gift prizes tell a different story. Hovertible, Dolphin Cruiser, Motorized Sofa, Banana Car, Bunny Carriage, Cloud, Bathtub, and Mono-Moped are tied to previous Gift Display eras. Once those reward pools leave normal openings, the item stops being a simple Bucks roll and becomes something players usually look for through trading.\n\nThat is why rarity needs refresh context. A current ultra-rare prize may be easier to chase than an old common prize if the old prize no longer opens from regular gifts. Rarity tells you the roll tier. Refresh age tells you how annoying another copy may be to find.\n\n## Prize type changes why players care\n\nGift prizes are mixed on purpose. Some are silly toys, some are movement items, and some become memorable old vehicles or strollers. The item type often matters more than the rarity label when you are deciding whether to keep it.\n\n| Prize type | What it usually means | Examples from gift refreshes |\n| --- | --- | --- |\n| Plushes, rattles, discs, leashes, and throw toys | Mostly collection, pet interaction, and fun inventory pieces | Ladybug Plush, Ice Cream Rattle, Daisy Flying Disc, Book of Binding Leash |\n| Strollers and carriers | Roleplay items for carrying babies or pets around the map | Donut Stroller, Pea Pod Stroller, Cannon Stroller, Dapper Friend Carrier |\n| Vehicles, skateboards, scooters, and unicycles | Travel items and old flex pieces when the refresh is gone | Micro Car, Banana Car, Cloud, Bathtub, Mono-Moped |\n| Propellers, pogos, and grappling hooks | Movement-style toys that are fun to use even when they are not top-value trades | Galaxy Propeller, Bumblebee Grappling Hook, Chandelier Pogo Stick |\n\nA stroller can be more useful for roleplay than a random toy. A vehicle can matter because players remember the old refresh it came from. A plush can still be worth saving if it belongs to a reward pool that is no longer easy to roll.\n\n## What to open, save, or trade\n\nTreat every gift roll like a Bucks risk check before spending.\n\n- Open current gifts when you enjoy random rewards and have Bucks to spend.\n- Pick Massive Gifts when you care most about high-rarity odds, but do not expect a guaranteed legendary.\n- Save older gift prizes if you care about collecting, because their original reward pool may already be gone.\n- Be careful trading away old vehicles and strollers, since those are the gift prizes players tend to remember.\n- Do not judge a prize by rarity alone. Refresh age, item type, and how easy another copy is to get can matter more.\n- Before trading for an old prize, decide whether you want it to use, to display, or to hold as old Adopt Me history.",
    "description_json": {
      "Rare": "Rare gift prizes are where the pull starts feeling less disposable. These often include toys, strollers, or vehicles that players remember from a specific Gift Display refresh.",
      "Common": "Common gift prizes are the easiest tier to pull from a gift refresh. They are usually simple toys or small collectibles, but older common prizes can still matter when that refresh has left the Gift Display.",
      "Uncommon": "Uncommon prizes sit just above the basic roll. They are still frequent enough to trade around, but the exact refresh matters because older uncommons are no longer being pulled from current gifts.",
      "Legendary": "Legendary prizes are the chase rewards from a gift refresh. They are not guaranteed from opening gifts, so odds and refresh history matter before spending a pile of Bucks chasing one.",
      "Ultra-Rare": "Ultra-Rare prizes are harder pulls and usually worth checking before trading away. The rarity helps, but the refresh date and item type still decide how much players care.",
      "Legacy or uncategorized prizes": "A few old prize rows do not carry a clean rarity label in the local data. Treat these as legacy entries and read the item name and refresh source before comparing them with normal rarity sections."
    },
    "faq_json": [
      {
        "a": "Gift prizes are the reward items that come out of Small, Big, and Massive Gifts. The gift is the container, and the prize is the toy, stroller, vehicle, plush, propeller, or other item you receive after opening it.",
        "q": "What are gift prizes in Adopt Me?"
      },
      {
        "a": "Buy or earn a Small, Big, or Massive Gift, then open it. The gift rolls a rarity tier and rewards an item from the active Gift Display pool for that tier.",
        "q": "How do you get gift prizes?"
      },
      {
        "a": "Massive Gift has the best listed high-rarity odds. It costs 499 Bucks, has no common roll, and gives a 4% legendary chance. It is still a roll, so it does not guarantee the legendary prize.",
        "q": "Which Adopt Me gift has the best odds?"
      },
      {
        "a": "Normal Gift Display rewards are tied to the active prize board. When the board refreshes, older rewards usually stop coming from Small, Big, and Massive Gifts, even if the gift was bought before the refresh.",
        "q": "Can old gift prizes still come from old unopened gifts?"
      },
      {
        "a": "Rarity is only the roll tier. Refresh age, item type, and replacement difficulty also matter. An older common toy can be harder to replace than a newer higher-rarity reward if the older refresh is gone.",
        "q": "Does rarity decide the value of a gift prize?"
      },
      {
        "a": "The Gift Display reward pool has always mixed fun items with roleplay and movement items. Plushes and rattles are mostly collection pieces, strollers help with roleplay, and vehicles or boards can become memorable old reward items.",
        "q": "Why are gift prizes mixed across toys, strollers, and vehicles?"
      },
      {
        "a": "The January 2026 gift refresh added rewards such as Ladybug Plush, Bacon and Eggs Throw Toy, Avocado Robinado Plush, Donut Stroller, and Micro Car. Gift Display rewards can rotate, especially at the top tier, so refresh timing is the safer way to read the item history.",
        "q": "What is the January 2026 gift refresh?"
      }
    ],
    "schema_ld_json": null,
    "thumb_url": "/Adopt%20Me/Gift%20Prizes/ladybug-plush.webp",
    "wiki_md": "Gift prizes are the reward items behind Adopt Me's Small, Big, and Massive Gifts. Refresh timing matters because the same gift sizes can roll a new board later, while older plushes, strollers, and vehicles often become trading or collection pieces once their reward pool leaves.",
    "wiki_sort_order": 4060,
    "is_published": true,
    "published_at": "2026-05-07T21:33:05.667+00:00",
    "created_at": "2026-05-07T21:33:06.280448+00:00",
    "updated_at": "2026-05-19T06:59:27.220767+00:00"
  },
  {
    "universe_id": 383310974,
    "wiki_slug": "adopt-me",
    "collection_slug": "gifts",
    "code": "adopt-me-gifts",
    "title": "All 46 Gifts in Adopt Me",
    "seo_title": "All 46 Gifts in Adopt Me",
    "meta_description": "Openable gift boxes, chests, event boxes, prices, and odds for all 46 Adopt Me gifts, with notes on what to open, save, or trade.",
    "intro_md": "Gifts in Adopt Me are the boxes, chests, and bags you open for a reward. The name matters less than the reward pool: a Small Gift rolls normal Gift Display prizes, a Regal Chest rolls pet wear, and an old event box may be something you save for trading before you crack it open.",
    "how_it_works_md": "Read each gift in this order: reward pool, price or currency, odds, then availability. Reward pool tells you what can come out. Price and currency tell you how painful another attempt is. Odds tell you how risky the roll is. Availability decides whether opening the box removes something easy to replace or something tied to an older event.",
    "description_md": "## How gifts work before you open them\n\nMost gifts are chance containers. You get one from the Gift Display, the Accessory Shop, an event shop, a reward route, a premium option, or trading, then opening it rolls against the chances listed on that item. The odds decide the rarity tier or special result; the reward pool decides what kind of prize can appear.\n\nThe Gift Display is where most players first meet the system. Small Gift costs less and has the weakest high-rarity odds, Big Gift sits in the middle, and Massive Gift has the best legendary chance among the three. Massive still does not guarantee a legendary prize, so it is a better-odds roll, not a sure hit.\n\n## How to decide whether to open or save a gift\n\n1. Check the reward pool first. A chest, pet box, seasonal gift, and Bucks bag are not chasing the same outcome.\n2. Check the cost or original route. A current Bucks gift is easier to replace than an old event box that now depends on trading.\n3. Check the odds. A higher price can improve the chance spread, but random boxes can still miss.\n4. Decide if the unopened gift has collection or trade value. Old event boxes can be more interesting unopened when the original event route is gone.\n\n| Gift type | What to think about |\n| --- | --- |\n| Gift Display rolls | Best for normal prize rolls from the active Gift Display pool. |\n| Accessory and wing chests | Best when the goal is pet wear or wings, not toys or vehicles. |\n| Event pet boxes | Usually a choice between opening for the pet and saving the old container. |\n| Premium event boxes | The higher-cost route should be worth the better odds before opening. |\n| Special reward boxes | Read the reward details because a few boxes behave differently from normal chance gifts. |",
    "description_json": {
      "Event pet boxes": "These boxes came from seasonal or limited reward pools built around pets. Opening one chases the pet inside; saving one can matter when the original event has left and the unopened box itself becomes the collectible.",
      "Gift Display rolls": "Small, Big, and Massive Gifts are the normal Gift Display rolls on Adoption Island. The bigger gift shifts the odds toward rarer prizes, but every open still rolls from the active Gift Display pool.",
      "Special reward boxes": "These containers sit outside the usual shop pattern. Some are chance boxes with unusual odds, while the 1000 Bucks Silk Bag is a fixed Bucks payout instead of a normal prize roll.",
      "Accessory and wing chests": "Accessory Chests and Wing Chests roll pet wear or wings instead of normal Gift Display prizes. Pick these when the reward category matters more than chasing a toy or vehicle from the gift stand.",
      "Mixed seasonal gift boxes": "These gifts come from seasonal pools that do not all behave like pet-only boxes. Read them by event, odds, and reward type before treating price as the main signal.",
      "Standard and premium event boxes": "Monkey, Gorilla, Capuchin, and Gibbon events use paired boxes. The standard version is the cheaper route, while the premium version usually trades extra cost for better odds or special outcomes."
    },
    "faq_json": [
      {
        "a": "A gift is the container you open. A gift prize is the reward that comes out after the roll, such as a toy, vehicle, pet wear item, pet, or special reward.",
        "q": "What is the difference between gifts and gift prizes in Adopt Me?"
      },
      {
        "a": "Small Gift, Big Gift, and Massive Gift come from the Gift Display on Adoption Island. They cost 70, 199, and 499 Bucks in the current local data, with higher prices giving stronger odds for rarer prize tiers.",
        "q": "Where do normal Adopt Me gifts come from?"
      },
      {
        "a": "No. Massive Gift has the best listed legendary chance among the main Gift Display rolls, but it is still random. Better odds do not turn the gift into a guarantee.",
        "q": "Does the most expensive gift guarantee a legendary reward?"
      },
      {
        "a": "Opening an old event box removes the unopened container. If the original event shop or reward route is gone, keeping the box can matter for collection or trading even when the possible pet inside is tempting.",
        "q": "Why do old event boxes matter if they can be opened?"
      },
      {
        "a": "They open like gift containers, but their reward pools are different. Accessory Chests focus on pet wear, while Wing Chests focus on wings instead of the normal Gift Display prize pool.",
        "q": "Are Accessory Chests and Wing Chests the same as normal gifts?"
      },
      {
        "a": "Standard boxes are usually the cheaper roll. Premium boxes make more sense when the stronger odds or special rewards are worth the higher cost or premium route.",
        "q": "Should I open the standard or premium event box?"
      },
      {
        "a": "The 1000 Bucks Silk Bag is listed as a fixed Bucks payout instead of a normal random prize box. That makes it more predictable than gifts built around rarity odds.",
        "q": "Why is the 1000 Bucks Silk Bag different from most gifts?"
      }
    ],
    "schema_ld_json": null,
    "thumb_url": "/Adopt%20Me/Gifts/small-gift-a-href-https-static-wikia-nocookie-net-adoptme-images-b-b5-small-gift-png-revis.webp",
    "wiki_md": "Gifts are openable boxes, chests, and bags with their own reward pools. Normal Gift Display rolls are about Bucks and odds, while old event boxes are often a choice between opening for the pet and saving the container for trading.",
    "wiki_sort_order": 4070,
    "is_published": true,
    "published_at": "2026-05-07T21:33:05.667+00:00",
    "created_at": "2026-05-07T21:33:06.280448+00:00",
    "updated_at": "2026-05-18T13:06:49.634818+00:00"
  },
  {
    "universe_id": 383310974,
    "wiki_slug": "adopt-me",
    "collection_slug": "house-surfaces",
    "code": "adopt-me-house-surfaces",
    "title": "All 198 House Surfaces in Adopt Me",
    "seo_title": "All 198 House Surfaces in Adopt Me",
    "meta_description": "Adopt Me house surfaces explained by wall and floor type, Bucks price, matching options, and budget planning for custom homes.",
    "intro_md": "House surfaces are the wallpapers, paints, carpets, planks, tiles, and patterned finishes that set the base look of an Adopt Me home. Furniture fills the room, but walls and floors decide the color and texture before the build gets crowded.\n\nAdopt Me has 198 house surfaces split evenly between 99 wall choices and 99 floor choices. The cheapest finishes are good for testing a room idea, while the 350 and 400 Bucks designs are better saved for rooms where the theme is already locked in.",
    "how_it_works_md": "Read house surfaces by the job they do in the room. Walls control the backdrop, so they matter most behind furniture, displays, signs, and theme pieces. Floors control the base, so they matter most under pathways, seating, pet-care areas, and open space.\n\nAfter that, use price as your Bucks check. A 2 Bucks paint or carpet is safe for testing. A 350 or 400 Bucks finish should usually wait until the layout, furniture, and color plan already work. When a surface name appears in both categories, it can create a matched room; when it does not, pair by color or texture instead.",
    "description_md": "## How house surfaces work in Adopt Me\n\nHouse surfaces are changed from inside a home while editing the room. Walls and floors are separate choices, so a room can use a plain painted wall with a patterned floor, or a matched pair when the same name exists in both menus.\n\nThey are cosmetic build choices. A surface will not add a pet bed, shower, food bowl, lure, or display stand. It gives the room its backdrop and floor base before furniture, shapes, lights, and decorations do the functional work.\n\n## Price is mostly a room-planning signal\n\nMost surfaces are cheap enough to test, especially the basic paints and carpets. The higher-price finishes should be treated more like final theme pieces because changing your mind after buying them costs more Bucks.\n\n| Price range | How to use it | Examples |\n| --- | --- | --- |\n| 1-10 Bucks | Test colors, starter rooms, quick palette checks | Hearts, White Paint, colored carpets, Checkers, Stone Floor |\n| 24-60 Bucks | Normal room materials and cleaner finishes | Vent, planks, tiles, Oil Paint Splash Wall Treatment, bold paint colors |\n| 80-130 Bucks | Patterned rooms and stronger theme direction | striped wallpaper, Palm Leaves Wallpaper, Green Vines Wallpaper, stone bricks, plaid wallpaper |\n| 350-400 Bucks | Statement rooms after the layout is settled | Black Rose Design, White and Gold Rose Design, Black & Gold Striped Wallpaper |\n\nA cheap paint can still be the right choice when furniture, lighting, and props carry the room. Expensive wallpaper looks better when it supports a finished build instead of fighting with the rest of the decor.\n\n## Matching walls and floors\n\nSeventy-five surface names appear as both wall and floor options. Matching names are useful for clean themed rooms, photo rooms, shops, or roleplay spaces where the background should feel consistent.\n\nMatching is not required. Some of the best rooms use a plain wall with a textured floor, or a simple floor under a busy wallpaper. If a style only exists in one category, match by color or material instead of forcing the exact same name.\n\n## Buy premium finishes after the room has a job\n\nBefore spending on the highest-price surfaces, decide what the room is supposed to be: bedroom, nursery, shop, display room, kitchen, pet-care room, party space, or custom theme. That choice makes the wall and floor decision easier.\n\nUse cheap paints and carpets to test the layout first. Once the furniture placement works, premium finishes such as rose designs, gold stripes, brick, vines, road, grass, or water patterns can make the room feel intentional instead of expensive by accident.",
    "description_json": {
      "Walls": "Wall surfaces create the backdrop for beds, displays, shelves, signs, and decorations. Cheap paint is useful for trying a palette, while wallpaper, vines, bricks, rose designs, and premium striped finishes should usually support a finished room plan.",
      "Floors": "Floor surfaces set the base under furniture, paths, rugs, and room props. Carpets and simple colors are easy test choices, while planks, tiles, roads, grass, water, rose designs, and black-and-gold patterns are better when the room theme is already clear."
    },
    "faq_json": [
      {
        "a": "Enter a home, open editing mode, and choose a wall or floor finish from the house customization options. Each surface uses the listed Bucks price.",
        "q": "How do you get house surfaces in Adopt Me?"
      },
      {
        "a": "Yes. Walls and floors are separate surface categories. Some names appear in both categories, but the wall version and floor version are still separate choices.",
        "q": "Are walls and floors separate in Adopt Me?"
      },
      {
        "a": "Hearts is the cheapest listed wall surface at 1 Buck. Many basic paints and carpets cost 2 Bucks, which makes them good for testing room colors.",
        "q": "What is the cheapest house surface?"
      },
      {
        "a": "Black & Gold Striped Wallpaper is the highest listed surface at 400 Bucks for both wall and floor versions. Black Rose Design and White and Gold Rose Design are also expensive at 350 Bucks.",
        "q": "What is the most expensive house surface?"
      },
      {
        "a": "No. House surfaces are cosmetic. Beds, cribs, bowls, showers, lures, and other furniture pieces handle functional room jobs.",
        "q": "Do house surfaces help with pet or baby needs?"
      },
      {
        "a": "Yes. Many surface names appear as both wall and floor choices, including planks, tiles, vines, stone, rose designs, and several wallpapers. Matching is useful for themed rooms, but plain contrast can look cleaner in busy builds.",
        "q": "Can I match walls and floors?"
      },
      {
        "a": "Usually no. Test the room with cheap paint or carpet first, then buy premium finishes once the layout, furniture, and theme already make sense.",
        "q": "Should I buy expensive surfaces first?"
      }
    ],
    "schema_ld_json": null,
    "thumb_url": "/Adopt%20Me/House%20Surfaces/hearts.webp",
    "wiki_md": "House surfaces are the wall and floor finishes used to set the base style of an Adopt Me home. Cheap paints and carpets are good for testing rooms, while matching pairs and premium wallpapers help finish themed builds.",
    "wiki_sort_order": 4080,
    "is_published": true,
    "published_at": "2026-05-07T21:33:05.667+00:00",
    "created_at": "2026-05-07T21:33:06.280448+00:00",
    "updated_at": "2026-05-18T16:38:18.651744+00:00"
  },
  {
    "universe_id": 383310974,
    "wiki_slug": "adopt-me",
    "collection_slug": "pet-ages",
    "code": "adopt-me-pet-ages",
    "title": "All 6 Pet Ages in Adopt Me",
    "seo_title": "All 6 Pet Ages in Adopt Me",
    "meta_description": "Adopt Me pet ages explained from Newborn to Full Grown, including trick unlocks, Neon stages, Age-Up Potions, Pet Pens, and birthday rewards.",
    "intro_md": "Pet ages are the growth path every regular Adopt Me pet follows after it hatches. Newborn is the starting point, Full Grown is the finish line, and each stage in between shows how much raising work is left before that pet can be used for Neon progress.",
    "how_it_works_md": "Read pet ages as a progress path. The age name tells you where the pet is, `Trick unlocked` shows the normal command gained at that stage, and `Special tricks` shows alternate animations used by certain pets.\n\nFor Neon planning, Full Grown is the key regular stage. For Mega Neon planning, the matching Neon endpoint is Luminous. Age-Up Potions and Pet Pens can speed up the grind, but potions cannot be used on eggs or already fully-aged pets, and Pet Pens do not earn Friendship Levels.",
    "description_md": "## Pet ages start after an egg hatches\n\nOnce an egg becomes a pet, Needs move it through the normal age path. Feeding, showering, sleeping, school, camping, and other care prompts all push the pet forward until it reaches the next stage.\n\nEach regular age unlocks one normal trick. Some pets also have special animations, so the `Special tricks` field is best read as a pet-specific replacement list, not a promise that every pet can perform every listed animation.\n\n## Full Grown is the Neon checkpoint\n\nFull Grown matters because Neon making starts there. To make a Neon, you need four Full Grown pets of the same species and combine them in the Neon Cave under the main bridge.\n\nNeon pets keep aging too, but their stage names change. This mapping helps when you are tracking a normal pet, a Neon pet, or a Mega Neon project.\n\n| Regular pet stage | Neon pet stage |\n| --- | --- |\n| Newborn | Reborn |\n| Junior | Twinkle |\n| Pre-Teen | Sparkle |\n| Teen | Flare |\n| Post-Teen | Sunshine |\n| Full Grown | Luminous |\n\nA Luminous Neon is the Neon version of Full Grown. Four Luminous Neon pets of the same species can be combined into a Mega Neon, so long projects usually have two grind layers: finish the regular pets first, then finish the Neon pets.\n\n## Age-Up Potions save more time on harder pets\n\nA fully grown pet starts filling a Friendship Bar instead of moving through normal ages. Filling a full friendship level gives an Age-Up Potion, and each potion adds 30 Needs worth of progress to another pet.\n\nAge-Up Potions cannot be used on eggs or already fully-aged pets. They are usually more valuable on higher-rarity pets because those pets take more Needs to finish. Spending one on a Common pet can still be fine when you are rushing a Neon, but saving potions for Legendary or Ultra-Rare projects normally saves more grind.\n\n## Pet Pens help when you are not actively raising every pet\n\nPet Pens can passively age up to four pets from your house. They give progress while you are online and a smaller amount while you are offline, which makes them useful for background aging while you focus on another pet.\n\nThere are limits. Pets in a Pet Pen can only complete a full level before you need to visit them again, Neon pets can be aged there, and Friendship Levels cannot be earned inside the pen. Treat Pet Pens as background progress, not a full replacement for active raising.\n\n## Level-ups can also give birthday rewards\n\nThe Birthday Magic update made pet level-ups more rewarding. When a pet levels up, it can give a birthday gift with rewards such as Bucks, food, potions, gifts, chests, or Nursery eggs.\n\nPets that require more Needs to level have better chances at rarer birthday rewards. That gives higher-rarity age grinding a second payoff: you are working toward Full Grown or Neon progress while also rolling for better level-up rewards.",
    "description_json": {
      "Pet age stages": "These six stages run in order from Newborn to Full Grown. The card title is the age, `Trick unlocked` is the normal command gained at that stage, and `Special tricks` are alternate animations used by specific pets instead of the standard trick."
    },
    "faq_json": [
      {
        "a": "The six regular pet ages are Newborn, Junior, Pre-Teen, Teen, Post-Teen, and Full Grown. They run in that order after an egg hatches or a pet is obtained.",
        "q": "What are the six pet ages in Adopt Me?"
      },
      {
        "a": "Pets age up when you complete their Needs, such as food, sleep, shower, school, camping, and other care prompts. Enough completed Needs move the pet to the next age stage.",
        "q": "How do pets age up in Adopt Me?"
      },
      {
        "a": "Full Grown is the regular pet endpoint and the stage needed for Neon making. Four Full Grown pets of the same species can be combined in the Neon Cave to create one Neon pet.",
        "q": "Why is Full Grown important?"
      },
      {
        "a": "Neon pets use Reborn, Twinkle, Sparkle, Flare, Sunshine, and Luminous. Luminous is the Neon version of Full Grown.",
        "q": "What are the Neon age names?"
      },
      {
        "a": "An Age-Up Potion adds 30 Needs worth of progress to a pet. It cannot be used on eggs or pets that are already fully aged.",
        "q": "What does an Age-Up Potion do?"
      },
      {
        "a": "A fully grown pet fills a Friendship Bar when you complete Needs with it. Filling one friendship level rewards an Age-Up Potion.",
        "q": "How do you get Age-Up Potions?"
      },
      {
        "a": "Yes. Pet Pens can passively age up to four pets while you are online or offline, but they do not earn Friendship Levels and pets need to be visited after finishing a level in the pen.",
        "q": "Do Pet Pens age pets while you are away?"
      },
      {
        "a": "Special tricks are alternate animations used by specific pets. The normal trick list applies to regular age stages, while special tricks depend on the pet.",
        "q": "What are special tricks?"
      }
    ],
    "schema_ld_json": null,
    "thumb_url": null,
    "wiki_md": "Pet ages track growth from Newborn to Full Grown. Each stage unlocks a trick, Full Grown pets are needed for Neon making, and systems like Age-Up Potions, Friendship, and Pet Pens decide how fast a long pet project moves.",
    "wiki_sort_order": 4090,
    "is_published": true,
    "published_at": "2026-05-07T21:33:05.667+00:00",
    "created_at": "2026-05-07T21:33:06.280448+00:00",
    "updated_at": "2026-05-18T17:16:49.681914+00:00"
  },
  {
    "universe_id": 383310974,
    "wiki_slug": "adopt-me",
    "collection_slug": "pets",
    "code": "adopt-me-pets",
    "title": "All 601 Pets in Adopt Me",
    "seo_title": "All 601 Pets in Adopt Me",
    "meta_description": "Adopt Me pets list with 601 pets, source groups, rarity, availability, Robux routes, event status, and Neon or Mega context.",
    "intro_md": "Adopt Me pets sit at the center of collecting, aging, Neon projects, Mega Neon goals, and trading. Rarity gives a quick tier, but the route behind a pet usually matters more: a current egg pet, a Robux treat roll, and an old event pet all play very differently when you are trying to get another one.",
    "how_it_works_md": "A pet makes the most sense after you know how it entered the game, whether that route is still active, and what extra work is attached to that copy. Cost can mean Bucks, Robux, event currency, a bundle, or a chance item. Availability shows whether the original route is still listed. Rarity helps with tier, but source and availability explain why two pets with the same rarity can be very different to replace.",
    "description_md": "## How pets enter Adopt Me\n\nPets usually come from eggs, hatch pools, Robux purchases, premium treats, event shops, reward systems, boxes, activities, or trading. An egg pet depends on the pool it came from. A premium treat pet can depend on Robux and roll odds. An event pet often depends on a limited shop or currency that disappears after the update.\n\n## Why availability changes replacement difficulty\n\nAvailability tells you whether the original route is still around. A pet with an active hatch, shop, or treat route can usually be worked toward again, even when the odds are low. A pet from an old event, retired egg, or removed reward pool usually depends on trading with someone who already owns it.\n\n## How Neon, Mega, and potions change the same pet\n\nA normal pet, a Full Grown pet, a Neon, a Mega Neon, and a Fly/Ride version should not be treated as the same thing. A Neon needs four Full Grown pets of the same species, and a Mega Neon needs four Luminous Neon pets. Fly-A-Pet and Ride-A-Pet Potions attach to individual pets, so potion status changes that specific copy.\n\n## Why trading needs more than rarity\n\nLegendary is the highest normal rarity tier, but rarity alone does not explain replacement difficulty or demand. A low-rarity pet from an old egg can be harder to replace than a newer high-rarity pet with an active route. Use rarity for tier, then look at source, availability, cost, odds, age, Neon status, and potion status before judging a trade target.",
    "description_json": {
      "Egg and hatch-pool pets": "Egg and hatch-pool pets come from hatch routes instead of direct purchase. Current eggs can be worked toward again, while older egg pools usually matter because the original hatch route has moved on.",
      "Event and seasonal pets": "Event and seasonal pets come from limited updates such as Halloween, Winter, Lunar New Year, Sugar Festival, Easter, Summer, Pride, or April Fools. Once the event closes, the old shop, box, currency, or activity route usually closes with it.",
      "Temporary and special-case pets": "Temporary and special-case pets do not follow the normal egg, shop, or event pattern. Some have unusual availability or Neon and Mega rules, so their listed details matter more than a simple rarity tier.",
      "Robux shop and premium treat pets": "Robux shop and premium treat pets can be direct buys or chance rolls. A cost like Honey, Golden Clam, Golden Bone, or Golden Dandelion means the player is paying for the route, then the listed odds decide which pet appears."
    },
    "faq_json": [
      {
        "a": "Many old pets can still be traded between players, but their original egg, event, shop, or reward route may be gone. That is why an unavailable pet is usually a trading target rather than a normal hatch or purchase goal.",
        "q": "Can old Adopt Me pets still be obtained?"
      },
      {
        "a": "Legendary is the highest normal rarity tier, but it is only one part of the picture. Source, availability, event age, potion status, Neon or Mega status, and player demand can make two Legendary pets feel very different.",
        "q": "Does Legendary always mean the pet is worth more?"
      },
      {
        "a": "A percentage means the paid item rolls from a small pet pool. For example, a treat route can give a common outcome most of the time and a rarer pet at a much lower chance.",
        "q": "What does a percentage next to a Robux treat mean?"
      },
      {
        "a": "A Neon needs four Full Grown pets of the same species. A Mega Neon needs four Luminous Neon pets of that species. That extra aging and duplicate-pet work is why Neon and Mega versions are judged differently from normal pets.",
        "q": "What changes when a pet becomes Neon or Mega Neon?"
      },
      {
        "a": "Fly and Ride come from potions applied to an individual pet. A Fly pet can be flown, a Ride pet can be ridden, and one pet can have both. Potion status does not automatically apply to every copy of that species.",
        "q": "What does Fly or Ride mean on a pet?"
      },
      {
        "a": "A blank value means that detail is not clearly listed for that pet. Do not treat a blank as free, current, removed, or impossible unless another listed field explains the route.",
        "q": "What should a blank cost or availability value mean?"
      }
    ],
    "schema_ld_json": null,
    "thumb_url": "/Adopt%20Me/Pets/2021-uplift-butterfly.webp",
    "wiki_md": "Pets drive most Adopt Me collecting, aging, Neon projects, Mega Neon goals, and trading. Rarity helps with tier, but source and availability usually decide whether a pet is still repeatable or mostly depends on trading.",
    "wiki_sort_order": 4100,
    "is_published": true,
    "published_at": "2026-05-07T21:33:05.667+00:00",
    "created_at": "2026-05-07T21:33:06.280448+00:00",
    "updated_at": "2026-05-18T18:18:22.485779+00:00"
  },
  {
    "universe_id": 383310974,
    "wiki_slug": "adopt-me",
    "collection_slug": "potions",
    "code": "adopt-me-potions",
    "title": "All 33 Potions in Adopt Me",
    "seo_title": "All 33 Potions in Adopt Me",
    "meta_description": "Adopt Me potions explained by effect, source, cost, age progress, Ride/Fly use, Tim's cauldron crafting, and limited rewards.",
    "intro_md": "Potions in Adopt Me are effect items. Some change your avatar, some change a pet, some add aging progress, and a few are tied to eggs, gifts, events, or cauldrons.\n\nEffect is the detail that decides the use case. Ride-A-Pet and Fly-A-Pet permanently change one pet, age potions save task grinding, Tim's cauldron potions use ingredients from pet needs, and older gift potions are often more about collection history than everyday use.",
    "how_it_works_md": "Effect tells you whether the item changes a player, pet, egg, aging progress, or cauldron flow. Source tells you whether another copy is easy to get, tied to Robux, crafted from ingredients, old event-only, removed, or unknown. Cost and availability make the most sense after that.\n\nRarity helps only on some entries, especially age potions. For most potions, the stronger decision is whether the effect is permanent, temporary, premium, crafted, limited, or mostly collectible. Blank fields should be treated as unlisted details, not as proof that the potion is common or easy to replace.",
    "description_md": "## Potions are consumables with different targets\n\nA potion can affect the player, a pet, an egg, or a house cauldron setup. Big Head, Hyperspeed, Anti-gravity, Grow, Levitation, Water Walking, and Home Potion are player-side effects. Ride-A-Pet, Fly-A-Pet, Small Sip, Big Brew, Translucent Tea, age potions, and most Tim's cauldron potions are used on pets. Instant Hatch Potion is different because it applies to eggs.\n\nThat target matters before price or rarity. A cheap movement potion, a Robux Ride/Fly potion, a one-week Super Age-Up Potion, and an old Christmas gift potion all sit in the same broad potion space, but they solve very different problems.\n\n## Permanent effects need extra care\n\nRide-A-Pet Potion and Fly-A-Pet Potion are one-use items, but the pet keeps the ability after drinking them. Apply one only to a pet you actually want to ride or fly, because the potion itself is gone once the ability is applied.\n\nTemporary potions are easier to think about. Small Sip, Big Brew, and Translucent Tea change a pet's appearance for 10 minutes. Hyperspeed and Anti-gravity can stack for stronger movement effects. Tim's crafted potions focus on short utility, need control, Bucks or aging boosts, tricks, faces, polymorph effects, and teleporting home.\n\n## Age potions are for pet progress\n\nAge potions matter most when you are building Neons, Mega Neons, or finishing a slow pet. Tiny Age Potion adds 3 tasks, Age-Up Potion adds 30 tasks, Sugar Skull Potion adds 45 tasks, and Super Age-Up Potion gives 18,300 XP, enough to take a Legendary pet from Newborn to Full Grown.\n\nSuper Age-Up Potion sits above the normal age potion group because one use can cover a full Legendary age path. It was sold for one week at 225 Robux during the May 8, 2026 New Weather Needs update, is tradeable, and may return later. Treat it as a high-impact aging item instead of spending it casually on a pet that only needs a few tasks.\n\n## Tim's cauldron potions use need-drop ingredients\n\nTim's potion system came with the May 15, 2026 Potions Update. Completing pet needs can drop one of three ingredients: Tim's Eaten Sandwich, Definitely Not a Fork, or Is That a Mustache. Official notes list the three ingredients with identical 33% random drop rates.\n\nThose ingredients feed the crafting loop for Tim's Cauldron Potions. Future Sight shows a pet's next needs, Choosy and Preferred push need control, Bonus Bucks and Bonus Aging add short boosts, Secret Talent teaches tricks temporarily, Goofy and Polymorph are playful pet effects, Busy Body gives a random blue need, and Home Potion sends the player to their house's front door.\n\n## Source tells you how replaceable a potion is\n\nCurrent shop-style potions are easier to understand because the cost gives you a replacement path. Older event and gift potions are different. Snowflake Potion, Teleportation Potion, Cure All Potion, and Heart Potion came from older gifts, events, advent rewards, passes, or task routes, so their original source matters as much as the effect.\n\nRemoved and unknown entries need the most caution. Levitation Potion has a historical removed cost, not a current buy route. Water Walking Potion has unknown cost and origin in the current data, so it should be treated as an uncertain old item rather than a potion with a clear path.",
    "description_json": {
      "Age Potions": "Age potions are tied to pet progress. They matter most when you are raising pets toward Full Grown, Neon, or Mega Neon goals and want to skip part of the normal task grind.",
      "Gamepass Potion": "The gamepass potion adds a permanent ride or fly ability to one pet. Use it carefully because the potion is consumed when the ability is applied.",
      "Cauldron Potions": "Cauldron potions come from furniture cauldrons and are mostly useful for repeated fun effects. They are easier to remake when you own the right cauldron setup.",
      "Event/Gift Potions": "Event and gift potions usually depend on older rewards, seasonal shops, or special releases. Check the source before using one because some are much harder to replace than normal shop potions.",
      "Sky Castle Potions": "Sky Castle potions are avatar-effect potions bought from the Sky Castle. They are mostly about temporary body or movement effects, so price and effect matter more than collection value.",
      "Tim's Cauldron Potions": "Tim's cauldron potions come from Wizard Tim's potion system and use ingredients earned from pet needs. Their value comes from the pet-care effect, such as aging, Bucks, choosing needs, or temporary tricks.",
      "Legacy and special potions": "Legacy and special potions are the odd entries that do not fit the normal shop, cauldron, event, or gamepass route. Read the effect first, then treat availability as the main warning."
    },
    "faq_json": [
      {
        "a": "Potions create specific effects. Some change your avatar, some are fed to pets, some add pet aging progress, one hatches an egg, and some are brewed or crafted through cauldron systems.",
        "q": "What do potions do in Adopt Me?"
      },
      {
        "a": "Yes. The potion is used once, but the pet keeps the ride or fly ability after drinking it. Apply it carefully because the potion itself is consumed.",
        "q": "Are Ride-A-Pet and Fly-A-Pet Potions permanent?"
      },
      {
        "a": "Super Age-Up Potion gives an eligible pet 18,300 XP, enough to take a Legendary from Newborn to Full Grown. It was sold for one week at 225 Robux, is tradeable, and may return later.",
        "q": "What is Super Age-Up Potion used for?"
      },
      {
        "a": "Tim's ingredients come from completing pet needs. Official notes list Tim's Eaten Sandwich, Definitely Not a Fork, and Is That a Mustache with identical 33% random drop rates.",
        "q": "How do Tim's cauldron potion ingredients drop?"
      },
      {
        "a": "No. Tradeability depends on the potion. Some premium or limited potions can be traded, while Tiny Age Potion is known as non-tradable. Avoid assuming every age potion can be traded directly.",
        "q": "Are all Adopt Me potions tradeable?"
      },
      {
        "a": "The cauldron entries are furniture that brew potion effects. They belong with potion systems, but their useful detail is the brew timer and matching effect rather than a one-click consumable use.",
        "q": "Why are cauldrons grouped with potions?"
      },
      {
        "a": "Its origin and cost are not clearly listed in the current data. Keeping it under Unknown avoids guessing a source that may not be accurate.",
        "q": "Why does Water Walking Potion have an Unknown section?"
      }
    ],
    "schema_ld_json": null,
    "thumb_url": "/Adopt%20Me/Potions/big-head-potion.webp",
    "wiki_md": "Potions in Adopt Me cover player effects, pet effects, age progress, instant hatching, old event rewards, house cauldrons, and Tim's crafted potion system. Effect and source matter more than rarity because a permanent Ride/Fly potion, a crafted Tim potion, and an old gift potion are used for completely different decisions.",
    "wiki_sort_order": 4100,
    "is_published": true,
    "published_at": "2026-05-07T21:33:05.667+00:00",
    "created_at": "2026-05-07T21:33:06.280448+00:00",
    "updated_at": "2026-05-19T06:59:27.242065+00:00"
  },
  {
    "universe_id": 383310974,
    "wiki_slug": "adopt-me",
    "collection_slug": "star-rewards",
    "code": "adopt-me-star-rewards",
    "title": "All 29 Star Rewards in Adopt Me",
    "seo_title": "All 29 Star Rewards in Adopt Me",
    "meta_description": "Plan all 29 Adopt Me Star Rewards by Stars, reward page, reward type, rarity, and the Golden Egg/Diamond Egg login cycle.",
    "intro_md": "Star Rewards turn daily logins into Stars, then Stars turn into fixed prizes on the reward track. The big Star Reward egg goals are Golden Egg and Diamond Egg: Golden Egg closes the first page, Diamond Egg closes the second page, and both take a long streak cycle instead of a quick Bucks purchase.",
    "how_it_works_md": "Star cost shows how far into the current reward page a prize sits. Reward type tells you whether the prize is a toy, vehicle, pet, stroller, or pet accessory. Rarity helps with quick sorting, but the Golden Egg and Diamond Egg cycle is the main thing to understand when planning long-term Star Rewards.",
    "description_md": "## How login Stars become rewards\n\nStars come from the Daily Reward system, so Star Rewards are built around returning to Adopt Me over time. You save Stars, claim the reward once you reach its Star cost, and keep moving toward the page-ending egg. A low-cost prize is close to the start of the current reward page, while a 600-Star or 660-Star prize is a late-cycle goal.\n\nSome rewards can also ask for enough time played before the claim works. If the game says you have not played long enough, that reward may need both enough Stars and enough play time.\n\n## Why the two reward pages matter\n\nThe first page starts with rewards like Steel Drum and Drone Propeller, then builds toward pets, vehicles, Witch's Caravan, and Golden Egg at 660 Stars. Claiming Golden Egg resets Stars to 0 and moves the track to the second page.\n\nThe second page starts again at small Star costs with rewards like Magician's Wand Grappling Hook and Hovercraft. It adds prizes such as Froggy Stroller, Pomeranian, Orchid Racer, Orca, and Diamond Egg. Diamond Egg is the 660-Star goal on the second page and requires the Golden Egg to have been claimed at least once.\n\n| Reward page | What it leads to | Late-cycle examples |\n| --- | --- | --- |\n| First page of the Star Rewards | Golden Egg | Starfish, Witch's Caravan, Golden Egg |\n| Second page of the Star Rewards | Diamond Egg | Orchid Racer, Orca, Diamond Egg |\n\n## How reward type and rarity fit in\n\nReward type tells you what you are actually earning. Toys are the largest group, vehicles are spread through both pages, and pets are the main reason many players keep watching the track. Rarity is useful for quick scanning, but it does not show unlock order. Star cost and reward page explain the long-cycle path better than rarity alone.",
    "description_json": {
      "First page of the Star Rewards": "The first Star Rewards page starts with low-cost toys and builds toward pets, vehicles, and Golden Egg. Golden Egg is the 660-Star milestone that resets Stars to 0 and opens the next reward page.",
      "Second page of the Star Rewards": "The second Star Rewards page appears after Golden Egg has been claimed at least once. It starts over with cheaper rewards, adds prizes like Pomeranian and Orca, and ends with Diamond Egg at 660 Stars."
    },
    "faq_json": [
      {
        "a": "Stars come from Daily Rewards, especially streak milestones. They are separate from Bucks and Robux, so Star Rewards are earned by returning to the game over time.",
        "q": "How do you earn Stars in Adopt Me?"
      },
      {
        "a": "Golden Egg is the final reward on the first Star Rewards page. After claiming it, Stars reset to 0 and the reward track moves to the second page.",
        "q": "What happens after you claim the Golden Egg?"
      },
      {
        "a": "Diamond Egg is the 660-Star goal on the second Star Rewards page. The player must have claimed Golden Egg at least once before Diamond Egg becomes the page-ending egg.",
        "q": "How do you unlock the Diamond Egg?"
      },
      {
        "a": "No. Stars reset to 0 after the Golden Egg is obtained. That reset is why Golden Egg and Diamond Egg are long-cycle goals instead of normal repeat purchases.",
        "q": "Do Stars carry over after a page-ending egg?"
      },
      {
        "a": "No. The reward track mixes toys, vehicles, pets, one stroller, one pet accessory, and the Golden Egg/Diamond Egg milestones. Toys are the largest group in the current reward track.",
        "q": "Are all Star Rewards pets?"
      },
      {
        "a": "Some rewards can require enough time played before the claim works. If Adopt Me says you have not played long enough, keep playing and check the reward again later.",
        "q": "Why can a Star Reward be blocked even with enough Stars?"
      }
    ],
    "schema_ld_json": null,
    "thumb_url": "/Adopt%20Me/Star%20Rewards/steel-drum.webp",
    "wiki_md": "Star Rewards are the login-star track that turns steady Daily Reward progress into toys, vehicles, pets, and the Golden Egg/Diamond Egg milestones. Star cost shows how deep a reward sits in the current page, while the first-page and second-page split explains why the eggs take a long cycle to reach.",
    "wiki_sort_order": 4120,
    "is_published": true,
    "published_at": "2026-05-07T21:33:05.667+00:00",
    "created_at": "2026-05-07T21:33:06.280448+00:00",
    "updated_at": "2026-05-18T18:18:26.534693+00:00"
  },
  {
    "universe_id": 383310974,
    "wiki_slug": "adopt-me",
    "collection_slug": "strollers",
    "code": "adopt-me-strollers",
    "title": "All 102 Strollers in Adopt Me",
    "seo_title": "All 102 Strollers in Adopt Me",
    "meta_description": "See all 102 Adopt Me strollers with seats, prices, rarity, availability, gift rotation notes, and event sources.",
    "intro_md": "Adopt Me strollers carry babies and pets around the map, help with ride needs, and give family roleplay a cleaner way to move together. Most strollers only hold one pet or baby, but a few older prizes and event items have extra seats.\n\nSource matters as much as rarity. A current Baby Shop stroller can be bought again with Bucks, while an old gift reward or event stroller usually becomes a collector item that depends on trading.",
    "how_it_works_md": "Seat count shows practical carrying use. A stroller with more seats is useful when you want to carry multiple babies or pets, while an old gift or event source usually means the item is harder to replace than a current shop stroller.\n\nPrice makes the most sense beside the route. A Bucks price points to a shop-style item, Stars point to Star Rewards, and event currencies point to limited event shops. Blank or unusual availability values belong with the event/update note instead of being assumed current.",
    "description_md": "## How strollers work in play\n\nA stroller carries a baby or pet after you equip it. Strollers can also help complete the pet ride need, and pets may sometimes ask for a specific stroller for a 3x Bucks and XP bonus.\n\nSeat count is the practical stat. A one-seat stroller is enough for normal pet care, while multi-seat strollers are better for family roleplay or moving several pets and babies at once. Most listed strollers have one seat, but Double Stroller and Popsicle Stroller hold 2, Triple Stroller, Pea Pod Stroller, and Web Stroller hold 3, and Quad Stroller holds 4.\n\n## How players get strollers\n\nStrollers come from several routes: Baby Shop Bucks purchases, the free Default Stroller, Star Rewards, RGB Reward Box, weather shops, gift rotations, advent calendars, and seasonal event shops. The price field can mean Bucks, Stars, a reward box, a free login reward, or event currency such as Gingerbread, Candy Eggs, Tickets, Cherry Blossoms, or Doubloons.\n\nAvailability needs context. A plain available stroller can usually be earned through its listed route, but a weather stroller only appears during the matching weather. Event strollers often use the event/update field instead of a current availability mark because their original event shop or reward path has already passed.\n\n## Why source matters before rarity\n\nRarity helps identify the item tier, but it does not tell the whole story. Teacup Stroller is Legendary and still listed as a Baby Shop item, while Double Stroller is only Uncommon but no longer sold. Old gift and event strollers can be more interesting to collectors because the original route is gone.\n\nThe Default Stroller is a special case. Every player starts with one for free, and it is not a normal trade item, so it should not be compared with old stroller prizes the same way.",
    "description_json": {
      "Event Strollers": "Event strollers were tied to seasonal shops, advent calendars, update rewards, or event currencies. The event/update field is the important clue because it shows the original route and why many of these are now collector or trade items.",
      "Baby Shop Strollers": "Baby Shop strollers are normal Bucks purchases when they are still sold. Some older Baby Shop strollers have left the shop, so availability matters before treating a listed price as something you can still pay today.",
      "Gifts Display Strollers": "Gift Display strollers come from rotating gift reward pools such as Small, Big, Massive, or Admin Abuse boxes. When the board refreshes, old rewards usually stop being obtainable from current gifts unless they return later.",
      "Other Obtainable Strollers": "These strollers come from mixed routes outside the Baby Shop, including the free Default Stroller, Star Rewards, RGB Reward Box, and weather shops. Weather strollers only appear during their matching weather, so they are not always available like a normal shop item."
    },
    "faq_json": [
      {
        "a": "Strollers carry babies and pets around the map. They are useful for roleplay, moving pets during needs, and completing the ride need when a pet can be transported in a stroller.",
        "q": "What do strollers do in Adopt Me?"
      },
      {
        "a": "Most strollers have 1 seat. Double Stroller and Popsicle Stroller have 2 seats, Triple Stroller, Pea Pod Stroller, and Web Stroller have 3 seats, and Quad Stroller has 4 seats.",
        "q": "Which Adopt Me strollers carry more than one pet or baby?"
      },
      {
        "a": "Usually not through the current gift board. Gift rewards rotate, so older strollers from past gift refreshes usually depend on trading unless they return in a later rotation.",
        "q": "Are old gift strollers still obtainable?"
      },
      {
        "a": "Rarity helps with sorting, but source and availability matter more for replacement difficulty. A low-rarity stroller from an old event or removed shop can be harder to get than a higher-rarity stroller that is still sold.",
        "q": "Does rarity decide stroller value?"
      },
      {
        "a": "No. The Default Stroller is given to players for free when they join, and it should be treated differently from tradeable old stroller rewards.",
        "q": "Can the Default Stroller be traded?"
      }
    ],
    "schema_ld_json": null,
    "thumb_url": "/Adopt%20Me/Strollers/stroller.webp",
    "wiki_md": "Strollers carry babies and pets, help with ride needs, and add roleplay style to family movement. Seats show the practical use, while source and availability show whether a stroller is a current shop item, a rotating gift prize, a weather item, or an older event collectible.",
    "wiki_sort_order": 4130,
    "is_published": true,
    "published_at": "2026-05-07T21:33:05.667+00:00",
    "created_at": "2026-05-07T21:33:06.280448+00:00",
    "updated_at": "2026-05-18T18:18:26.648494+00:00"
  },
  {
    "universe_id": 383310974,
    "wiki_slug": "adopt-me",
    "collection_slug": "toys",
    "code": "adopt-me-toys",
    "title": "All 437 Toys in Adopt Me",
    "seo_title": "All 437 Toys in Adopt Me",
    "meta_description": "Compare 437 Adopt Me toys by role, interaction, source, price, and availability, from pet toys and grapples to old event items.",
    "intro_md": "Adopt Me toys are equipable items for pet play, movement, roleplay, trading, and event systems. The useful detail is what happens after a toy is equipped: a pet might fetch it, a player might bounce or glide, a stand might sell food, or an old event prop might mostly matter as a collectible.\n\nRarity helps identify the in-game tier, but toy role and source usually explain more. A current Pet Shop chew toy is easy to understand because it still has a shop route, while an old Halloween item like Tombstone Ghostify depends more on its retired event source and collector demand.",
    "how_it_works_md": "Interaction tells you what the toy does after it is equipped. For example, Leash connects a pet to the player, Standard Grappling Hook pulls the player toward a target point, Lemonade Stand lets players sell drinks, and Steel Drum plays music.\n\nA current shop item can usually be bought again with its listed currency. An older Halloween, Christmas, Summer Festival, or gift-refresh item may depend on trading even if its rarity looks low. A blank availability value means the obtainment text usually carries the better clue.",
    "description_md": "## How toys are obtained\n\nToys come from several routes. Current shop toys are bought with Bucks in places such as the Toy Shop, Pet Shop, Baby Shop, Camping Shop, Pool Shop, and weather shops. Star Rewards toys come from login stars, while some toys come from gifts, reward boxes, Robux purchases, gamepasses, and limited event shops.\n\nEvent toys need extra source context. A Christmas, Halloween, Lunar New Year, Pride, Spring Festival, or Summer Festival toy may have been bought with event currency, earned through an event activity, opened from a box, or given through an advent calendar. Once that route leaves, trading is often the only practical way to get another copy.\n\n## How price and availability work\n\nPrice does not always mean Bucks. A toy can cost Bucks, Robux, stars, Candy Corn, Doubloons, Cherry Blossoms, Candy Eggs, or another event currency. Some toys are chance-based instead, such as Priceless Jewel coming from Treasure Key during Summer Festival 2025.\n\nAvailability is useful when it is listed, but a blank value is not proof that a toy can still be earned. Many event items carry the real route in the obtainment text instead. When a toy came from an old event or removed shop refresh, that retired route is the stronger clue for replacement difficulty.\n\n## Why rarity is only one clue\n\nCommon, Uncommon, Rare, Ultra-Rare, and Legendary describe the item's in-game tier. They do not decide the whole story for toys. A simple current-shop Ultra-Rare toy can be easier to replace than a lower-rarity toy from a 2018 event, and many roleplay props are valuable mainly to collectors who want older items.\n\nThe interaction text is the fastest way to understand everyday use. Pet toys are for fetching, sitting, or leashing. Movement toys help with bouncing, gliding, jumping, floating, or pulling across the map. Stands, seats, instruments, paints, and event tools each need their obtainment details because they work differently from normal plushes and rattles.",
    "description_json": {
      "Movement toys": "Pogo sticks, balloons, propellers, kites, and float-style toys change how the player moves. They are practical for bouncing, jumping higher, floating, or quick roleplay movement around Adoption Island.",
      "Pet play and leashes": "These toys are used with pets. Throw toys, chew toys, balls, discs, and leashes make a pet chase, fetch, sit with, or stay visibly connected to the player.",
      "Roleplay and collectibles": "Plushes, rattles, flags, swords, wands, and old souvenir toys are mostly about roleplay, display, or collecting. Older event props can be harder to replace because many are no longer earned normally.",
      "Music and performance toys": "Instruments, music toys, and performance items add sound, dancing, or show-style actions. They are usually chosen for roleplay rather than progression.",
      "Event tools and special-use items": "Some toy-type items only make sense inside an event or special system. Keys, jewels, pet paints, Mega Neon paints, ingredients, and similar items can lose their original use after the event ends.",
      "Grapples, gliders, and teleport toys": "These toys move the player more directly than a normal balloon or pogo. Grapples pull toward a target point, gliders keep the player airborne, and teleport toys such as Magic House Door have special travel behavior.",
      "Stands, seats, and placeable utility": "These toys are placed or used like small tools on Adoption Island. Sales stands, benches, tents, sleeping bags, and special seats matter because they let players sell, sit, rest, or set up a roleplay scene."
    },
    "faq_json": [
      {
        "a": "Toys are equipable items with different actions. Some work with pets, some change movement, some play music or support roleplay, and some are event tools or collector items from older updates.",
        "q": "What do toys do in Adopt Me?"
      },
      {
        "a": "Some are still obtainable from shops, Star Rewards, gifts, Robux purchases, or active rotations. Many older event toys are not normally earned anymore, so trading may be the only practical route.",
        "q": "Are Adopt Me toys still obtainable?"
      },
      {
        "a": "No. Rarity is only the in-game tier. Source, age, event history, usefulness, and collector demand can matter more, especially for older toys such as Tombstone Ghostify or Flying Broomstick.",
        "q": "Does rarity decide whether a toy is valuable?"
      },
      {
        "a": "Blank availability usually means there is no simple available or unavailable value listed. The obtainment text often has the better clue because many event toys explain their route there instead.",
        "q": "Why do some toys have blank availability?"
      },
      {
        "a": "Throw toys, chew toys, balls, flying discs, and leashes are the main pet-focused toys. They usually make a pet chase, fetch, sit with the toy, or stay connected to the player.",
        "q": "Which toys are useful with pets?"
      }
    ],
    "schema_ld_json": null,
    "thumb_url": "/Adopt%20Me/Toys/floppy-bunny-plushie.webp",
    "wiki_md": "Toys in Adopt Me cover pet play, movement, roleplay, stands, instruments, event tools, and older collectibles. The toy action tells you how it is used, while older event and removed shop routes usually matter most when a toy becomes trade-dependent.",
    "wiki_sort_order": 4130,
    "is_published": true,
    "published_at": "2026-05-07T21:33:05.667+00:00",
    "created_at": "2026-05-07T21:33:06.280448+00:00",
    "updated_at": "2026-05-18T18:18:26.710907+00:00"
  },
  {
    "universe_id": 383310974,
    "wiki_slug": "adopt-me",
    "collection_slug": "vehicles",
    "code": "adopt-me-vehicles",
    "title": "All 270 Vehicles in Adopt Me",
    "seo_title": "All 270 Vehicles in Adopt Me",
    "meta_description": "All 270 Adopt Me vehicles by source, seats, price, availability, gifts, events, Star Rewards, premium routes, and trade context.",
    "intro_md": "Vehicles in Adopt Me are transport items first, but a lot of them also work as roleplay pieces, collection history, and trade items. A one-seat bike, scooter, or skateboard is mostly personal travel. A larger car, boat, carriage, shuttle, or train can carry friends, babies, pets, or a family roleplay group around the map.\n\nSource is the safest way to read a vehicle. Current dealership and shop vehicles are easier to replace because players can buy them again. Gift rewards, Robux bundles, Star Rewards, weather-shop vehicles, redemption items, and old event vehicles all have different routes, so rarity alone does not tell the full story.",
    "how_it_works_md": "Treat each vehicle card as two checks: how the vehicle is obtained and how it plays once you have it.\n\nThe source group tells the original route, such as dealership, gift, event, premium, Star Rewards, RGB box, redemption, or temporary event access. Price shows the listed cost or route detail when it is known, and that value may mean Bucks, Robux, Stars, event currency, a gift route, or a bundle.\n\nSeats tell whether the vehicle is mostly solo travel or useful for group movement. Availability tells whether the original route is still listed as active, removed, conditional, or unclear. Rarity is helpful for sorting, but source, availability, price route, and seats usually give the better player decision.",
    "description_md": "## How vehicles work in Adopt Me\n\nA vehicle is equipped from your inventory and used to move around the map. Most vehicles are about travel speed, looks, and roleplay instead of progression. They do not hatch pets or earn rewards by themselves, but they can make task running, trading meetups, house visits, and family roleplay feel smoother.\n\nSeats are the first play-use detail to understand. A one-seat Bicycle, Standard Unicycle, Cloud, or Rocket Sled is personal transport. A four-seat Family Car or Galleon works better when you are moving with other players. The Classic Boat has 8 seats, so its low rarity does not mean it is a small solo ride.\n\n## How players get vehicles\n\nAdopt Me vehicles come from several systems, and those systems change how easy another copy is to get.\n\n| Route | What it means for players | Examples |\n| --- | --- | --- |\n| Dealership and normal shops | Usually bought again with Bucks while the shop route exists | Bicycle, Tandem Bicycle, Family Car, Classic Boat |\n| Weather and recurring shops | Available only when that shop or weather rotation is active | Landsailer, Trireme, Snow Plow, Galleon |\n| Gift Display | Rolled from gift prize pools that can refresh over time | Micro Car, Motorized Sofa, Dolphin Cruiser, Cloud |\n| Events | Earned or bought during limited updates | Santa's Sleigh, Ghost Vehicle, Pumpkin Carriage |\n| Premium purchases | Bought with Robux, bundles, gamepasses, or sale packs | Luxury Car, GoKart, Street Drifter |\n| Rewards and boxes | Earned through Stars, RGB boxes, or special reward systems | Witch's Caravan, RGB Monster Truck, RGB UFO |\n| Redemption or temporary routes | Tied to special code, kiosk, or temporary event access | Shadow Dragon Skateboard, Toy Delivery Truck, Mystery Machine |\n\nA current shop vehicle is usually a practical buy. An old gift, event, premium, or redemption vehicle is more trade-aware because the original route may be gone.\n\n## Why availability beats rarity for replacing vehicles\n\nRarity is useful for quick scanning, but it does not prove speed, seat count, or trade value. A Common vehicle from an old reward pool can be harder to replace than a Legendary vehicle that is still sold or earned.\n\nAvailability tells whether the original route is still listed as active. A check mark means the vehicle is current or conditionally current. An X means the listed route is gone. A blank value should be treated carefully because it means the current status is not clearly listed for that vehicle.\n\nWeather-shop vehicles need extra context. Landsailer and Trireme belong to Desert weather, Snow Plow and Tundra Exploration Machine belong to Snow weather, Harvest Truck and Tractor belong to Fall weather, and Old Sailboat and Galleon belong to Rain weather. Those vehicles can be current without being available every time you join.\n\n## Gift and event vehicles need trade context\n\nGift vehicles are tied to prize boards, and those boards can refresh. When a vehicle leaves the active Gift Display, trading usually becomes the main route unless Adopt Me returns it in a future update. That is why old gift vehicles such as Cloud, Rocket Sled, Bathtub, Dogmobile, scooters, skateboards, and snowboards can feel different from current gift rewards.\n\nEvent vehicles have the same problem in a different form. Santa's Sleigh, Ghost Vehicle, Pumpkin Carriage, and many seasonal cars came from limited updates. Once the event shop, minigame, calendar, or currency is gone, the vehicle usually becomes a trading target instead of a normal purchase.\n\nTrade value should stay source-aware. Demand can move around, and community value sites can disagree, so the safer question is whether the vehicle's original route still exists, how old it is, and whether players want it for looks, seats, roleplay, or collection history.",
    "description_json": {
      "Event Vehicles": "Event vehicles came from limited updates, seasonal shops, calendars, minigames, or event currencies. Once that event route ends, trading is usually the realistic way to get the vehicle unless Adopt Me brings it back.",
      "Premium Vehicles": "Premium vehicles are tied to Robux purchases, bundles, packs, gamepasses, or sale routes. The price text matters because some premium vehicles are current purchases while older ones, such as old bundle or VIP items, may be trade-only now.",
      "Temporary Vehicle": "Mystery Machine is a special Scoob Event vehicle and the only item here with Event as its rarity label. That rarity label is separate from the broader Event Vehicles source group.",
      "Star Rewards Vehicles": "Star Rewards vehicles use Stars earned through the login reward path instead of Bucks or Robux. Vehicles such as Witch's Caravan, Hovercraft, Planetary Core Car, and Orchid Racer are long-term reward items rather than shop purchases.",
      "Gifts Display Vehicles": "Gift vehicles come from rotating gift prize pools. A reward from the active board can be chased through gifts, while older gift vehicles such as Cloud, Rocket Sled, Bathtub, Dogmobile, scooters, skateboards, and snowboards usually depend more on trading.",
      "RGB Reward Box Vehicles": "RGB Monster Truck and RGB UFO are tied to RGB Reward Box routes and trading. This small group is source-specific, so it should not be compared like normal dealership or gift vehicles.",
      "Other Obtainable Vehicles": "These vehicles come from current or recurring routes outside the main dealership, including Toy Shop, Camping Shop, Beach Shop, and weather shops. Weather vehicles such as Landsailer, Trireme, Snow Plow, Harvest Truck, Old Sailboat, and Galleon are conditionally available, not always on sale.",
      "Redemption Kiosk Vehicles": "Redemption Kiosk vehicles came through special redemption routes, not regular shops. Shadow Dragon Skateboard, Toy Delivery Truck, and Canine Cruiser are small-source items where the route matters more than the rarity label.",
      "Vehicle Dealership Vehicles": "Dealership vehicles are the cleanest baseline because many are normal Bucks purchases with clear seat counts. Cheap one-seat rides are simple personal travel, while larger entries like Family Car, Classic Helicopter, Classic Airplane, and Classic Boat are better for moving with friends or a roleplay family."
    },
    "faq_json": [
      {
        "a": "Vehicles are transport items. Players equip them from inventory and use them to move around the map, carry passengers, roleplay, or collect old and limited items.",
        "q": "What do vehicles do in Adopt Me?"
      },
      {
        "a": "Source is usually the first thing to understand because it tells whether the vehicle came from a shop, gifts, an event, a Robux purchase, Star Rewards, a reward box, redemption, or trading. After that, seats and availability tell how useful and replaceable it is.",
        "q": "What is the most important detail on an Adopt Me vehicle?"
      },
      {
        "a": "No. Rarity does not guarantee better speed, more seats, or higher trade value. A Common old vehicle can be harder to replace than a Legendary current vehicle if the old source is gone.",
        "q": "Do higher-rarity vehicles drive better?"
      },
      {
        "a": "Seats show passenger capacity. One-seat vehicles are mostly personal travel, while multi-seat vehicles are better for moving with friends, carrying babies or pets, and family roleplay.",
        "q": "What do seats mean for vehicles?"
      },
      {
        "a": "Usually through trading, if the item is tradeable and another player owns it. An unavailable label means the original shop, event, gift, bundle, or reward route is no longer listed as active.",
        "q": "Can unavailable vehicles still be obtained?"
      },
      {
        "a": "Weather-shop vehicles are tied to the matching weather rotation. Desert, Snow, Fall, and Rain vehicles can be current, but they are only sold when that weather shop is active.",
        "q": "How do weather-shop vehicles work?"
      },
      {
        "a": "Gift vehicles come from reward pools that can refresh. When a gift vehicle leaves the active board, it usually stops being a normal Bucks roll and becomes a trading or collection item.",
        "q": "Why are gift vehicles treated differently from shop vehicles?"
      }
    ],
    "schema_ld_json": null,
    "thumb_url": "/Adopt%20Me/Vehicles/bike.webp",
    "wiki_md": "Vehicles are Adopt Me transport items for travel, roleplay, collecting, and trading. Source matters more than rarity because a dealership vehicle can be bought again, while old gift, event, premium, redemption, or reward vehicles may depend on trading once their original route is gone.",
    "wiki_sort_order": 4140,
    "is_published": true,
    "published_at": "2026-05-07T21:33:05.667+00:00",
    "created_at": "2026-05-07T21:33:06.280448+00:00",
    "updated_at": "2026-05-18T18:18:26.756727+00:00"
  }
]
$adopt_me_wiki_catalog$::jsonb) as row(
    universe_id bigint,
    wiki_slug text,
    collection_slug text,
    code text,
    title text,
    seo_title text,
    meta_description text,
    intro_md text,
    how_it_works_md text,
    description_md text,
    description_json jsonb,
    faq_json jsonb,
    schema_ld_json jsonb,
    thumb_url text,
    wiki_md text,
    wiki_sort_order integer,
    is_published boolean,
    published_at timestamptz,
    created_at timestamptz,
    updated_at timestamptz
  )
),
resolved as (
  select
    wp.id as wiki_page_id,
    coalesce(payload.universe_id, wp.universe_id) as resolved_universe_id,
    payload.*
  from payload
  left join public.wiki_pages wp
    on wp.slug = payload.wiki_slug
)
insert into public.wiki_catalog_pages (
  wiki_page_id,
  universe_id,
  wiki_slug,
  collection_slug,
  code,
  title,
  seo_title,
  meta_description,
  intro_md,
  how_it_works_md,
  description_md,
  description_json,
  faq_json,
  schema_ld_json,
  thumb_url,
  wiki_md,
  wiki_sort_order,
  is_published,
  published_at,
  created_at,
  updated_at
)
select
  wiki_page_id,
  resolved_universe_id,
  wiki_slug,
  collection_slug,
  code,
  title,
  seo_title,
  meta_description,
  intro_md,
  how_it_works_md,
  description_md,
  coalesce(description_json, '{}'::jsonb),
  coalesce(faq_json, '[]'::jsonb),
  schema_ld_json,
  thumb_url,
  wiki_md,
  wiki_sort_order,
  is_published,
  published_at,
  coalesce(created_at, now()),
  coalesce(updated_at, now())
from resolved
on conflict (wiki_slug, collection_slug) do update set
  wiki_page_id = excluded.wiki_page_id,
  universe_id = excluded.universe_id,
  code = excluded.code,
  title = excluded.title,
  seo_title = excluded.seo_title,
  meta_description = excluded.meta_description,
  intro_md = excluded.intro_md,
  how_it_works_md = excluded.how_it_works_md,
  description_md = excluded.description_md,
  description_json = excluded.description_json,
  faq_json = excluded.faq_json,
  schema_ld_json = excluded.schema_ld_json,
  thumb_url = excluded.thumb_url,
  wiki_md = excluded.wiki_md,
  wiki_sort_order = excluded.wiki_sort_order,
  is_published = excluded.is_published,
  published_at = coalesce(public.wiki_catalog_pages.published_at, excluded.published_at);
