-- Remove website instructions from reviewed Roblox collection copy.
-- The renderer ignores legacy how_it_works_md; retain it here so game details are not lost.
-- Match each original field independently to preserve edits made after the October 15 inventory.
-- Existing row triggers update search and enqueue collection and wiki-hub revalidation.
with repairs as (
  select * from jsonb_to_recordset($repair$
[
  {
    "code": "1-speed-evolve-animals",
    "changes": {
      "wiki_md": {
        "expected_md5": "5aeb4d19064f356f2c1db05673c674bb",
        "value": "The animal forms are the heart of +1 Speed Evolve. You evolve through a set chain of seven forms using Wins, from Squirrel to Deer, and can add optional gamepass forms on top."
      }
    }
  },
  {
    "code": "1-speed-evolve-auras",
    "changes": {
      "wiki_md": {
        "expected_md5": "743afd6d69a9a5ac6d349e5bbf76799f",
        "value": "Auras are wearable glow effects in +1 Speed Evolve that add a multiplicative speed layer on top of your evolution, rebirth, and trail bonuses."
      }
    }
  },
  {
    "code": "1-speed-evolve-trails",
    "changes": {
      "wiki_md": {
        "expected_md5": "ef28be1cf6ef3a686e6e4be1205a694c",
        "value": "Trails are equippable Robux game passes that add a speed multiplier on top of your animal form, rebirth tier, and group boost."
      }
    }
  },
  {
    "code": "1-speed-keyboard-escape-auras",
    "changes": {
      "intro_md": {
        "expected_md5": "18c8bc2280139cdb463b15f88f9330c2",
        "value": "Glow Aura, Wind Aura, Water Aura and Fire Aura are Robux game-pass purchases in +1 Speed Keyboard Escape. Compare their costs and availability, and check the live offer before assuming one gives a stronger effect than another."
      }
    }
  },
  {
    "code": "100-days-at-sea-npcs-and-mobs",
    "changes": {
      "intro_md": {
        "expected_md5": "ecbb57abb5b39ca43dd68a95f79c1f22",
        "value": "NPCs and mobs are the people and creatures you meet while sailing in 100 Days at Sea. Rescue survivors, visit traders for gear, and prepare for hostiles that guard islands, board your raft at night or hunt you in open water."
      }
    }
  },
  {
    "code": "99-nights-in-the-forest-classes",
    "changes": {
      "intro_md": {
        "expected_md5": "6178882d0aa0e2f6836e456a32e7a8d8",
        "value": "Classes shape a 99 Nights in the Forest run before the first tree is chopped. Each class changes your starting tools, early priorities and the level requirements you chase during longer runs. Seasonal and event classes have different unlock routes, while removed classes are outside the active unlock pool."
      }
    }
  },
  {
    "code": "99-nights-in-the-forest-crafting",
    "changes": {
      "intro_md": {
        "expected_md5": "ff53f586eeddb24c413fc472a7891d13",
        "value": "Crafting in 99 Nights in the Forest turns materials into survival tools, defenses, travel shortcuts and camp upgrades. Crafting Bench tiers, the Tool Workshop Anvil and the Meteor Anvil handle different recipes. Start with the station and its unlock requirements, then gather materials for the result you need."
      }
    }
  },
  {
    "code": "99-nights-in-the-forest-entities",
    "changes": {
      "intro_md": {
        "expected_md5": "216da2fd28aad2653dd9c7058c981f0b",
        "value": "Monsters, cultists and animals can make a 99 Nights in the Forest route dangerous or worth the risk. Some animals provide food or taming opportunities, traders exchange resources for upgrades, and rescue NPCs lead you toward guarded caves. Decide whether to fight, flee, tame or trade before you approach."
      }
    }
  },
  {
    "code": "99-nights-in-the-forest-food",
    "changes": {
      "intro_md": {
        "expected_md5": "ad51ffa35f1098ae79a6bdf8cf2298c5",
        "value": "Food keeps a 99 Nights in the Forest run alive. Hunger drains over time, falls faster while sprinting and eventually causes starvation damage when empty. Plan which food to eat and which ingredients to save for cooking or taming before leaving camp."
      }
    }
  },
  {
    "code": "99-nights-in-the-forest-locations",
    "changes": {
      "intro_md": {
        "expected_md5": "4bbefada8602cf1a1edc95c2b5b82cc5",
        "value": "The forest changes between runs in 99 Nights in the Forest, so locations are route decisions rather than fixed map pins. Cabins, towers, ponds, cultist stops and biome structures have different loot, interactions and risks. Choose a stop for what it can help you find and how safely you can reach it."
      }
    }
  },
  {
    "code": "99-nights-in-the-forest-tameable-animals",
    "changes": {
      "intro_md": {
        "expected_md5": "4d06dae099e0576318dc67d293c9c566",
        "value": "Animal taming in 99 Nights in the Forest uses flutes and food. Play the Taming Flute near an animal, finish the minigame, feed the requested food and repeat until its faces turn into hearts. Harder animals need better flute tiers and more preparation, so gather their food before leaving camp."
      }
    }
  },
  {
    "code": "99-nights-in-the-forest-tools",
    "changes": {
      "intro_md": {
        "expected_md5": "6cae049095147e878adcd7a9bf649c36",
        "value": "Tools and utility gear shape a 99 Nights in the Forest run. Sacks carry loot, axes clear wood, rods and flutes open food and pet routes, and crafted devices help with travel and survival. Hard Mode and admin tools have different access rules from normal run gear."
      }
    }
  },
  {
    "code": "99-nights-in-the-forest-weapons",
    "changes": {
      "intro_md": {
        "expected_md5": "db34ea63f5d7336ca6c2e074e4bd0ce0",
        "value": "Weapons help you handle wolves, cultists, rescue routes, raids and larger fights in 99 Nights in the Forest. Melee, ranged and limited-use weapons have different combat roles, ammo needs and class restrictions. Removed and admin-only weapons are separate from the gear you can pursue in a normal run."
      }
    }
  },
  {
    "code": "anime-expeditions-enemies",
    "changes": {
      "intro_md": {
        "expected_md5": "e15410543a4d78a5e63229e3e08db8e6",
        "value": "Anime Expeditions enemies appear on Story maps and in Spirit City Raid. Basic, Elite and Boss types affect Enemy Index unlock chances and rewards. Choose the map and enemy type around the Story push, Infinite farm or Raid run you want to complete."
      }
    }
  },
  {
    "code": "bedwars-items",
    "changes": {
      "intro_md": {
        "expected_md5": "b94741f533f5b52ad262f77f53272c8d",
        "value": "BedWars match items include swords, tools, blocks, ammo, consumables and utility gear such as balloons and teleporters. Iron, Gold, Diamonds and Emeralds pay for different purchases. Know which currency you need before returning to the shop."
      }
    }
  },
  {
    "code": "berry-avenue-rp-jobs",
    "changes": {
      "intro_md": {
        "expected_md5": "76db66cd36bc8cebe177f57958324354",
        "value": "Jobs in Berry Avenue RP give your character a role around town. Pick one from the phone and head to the building or area that fits the scene. You can switch roles whenever you want."
      }
    }
  },
  {
    "code": "berry-avenue-rp-locations",
    "changes": {
      "intro_md": {
        "expected_md5": "4a9cef0747f9eaca4ab8e774eab9fee0",
        "value": "Berry Avenue RP is split into themed districts with shops, cafes, schools, hotels, civic buildings and landmarks. Choose a place around the roleplay you want, whether you are shopping, eating, working, studying or traveling."
      },
      "wiki_md": {
        "expected_md5": "9d35f87b621f889b9533e85b195b39eb",
        "value": "Berry Avenue RP is a roleplay town, so knowing the map matters. The Heart has the school, hospital and shops. French, Greek, Swiss and Korean districts have their own themes, and the airport takes you to Paris."
      }
    }
  },
  {
    "code": "blox-fruits-accessories",
    "changes": {
      "intro_md": {
        "expected_md5": "9acfb7df32dc39bfea452013a7d1890f",
        "value": "Accessories in Blox Fruits add stat bonuses to your build. Rarity is one clue, but the full bonus combination decides whether an accessory fits the way you fight."
      }
    }
  },
  {
    "code": "blox-fruits-aura-visuals",
    "changes": {
      "intro_md": {
        "expected_md5": "e15e2ed92f1830fe8d993e5e2c5cc0ef",
        "value": "Aura visuals in Blox Fruits progress from Stage 0 to Stage 5, changing small patches of limb coverage into full-body Aura. Colors and skins are a separate cosmetic layer, while Aura stages carry combat progression."
      }
    }
  },
  {
    "code": "blox-fruits-bosses",
    "changes": {
      "intro_md": {
        "expected_md5": "04bca5d26b1b90a838456cd065a0b8a6",
        "value": "Bosses in Blox Fruits provide quest progress, EXP, Money, mastery and rare rewards. Sea, location, level and spawn conditions decide whether a fight is a quick farm or a longer progression goal. Sea-event enemies such as Terrorshark and Leviathan depend on sailing conditions rather than ordinary island boss spawns."
      }
    }
  },
  {
    "code": "blox-fruits-crafting-recipes",
    "changes": {
      "wiki_md": {
        "expected_md5": "6320bf0352e1c78237ca56e2870189e9",
        "value": "Crafting recipes convert materials into potions, bait, scrolls, and utility outputs. Choose the station first, then gather the full ingredient combination for the result you want."
      }
    }
  },
  {
    "code": "blox-fruits-fruits",
    "changes": {
      "intro_md": {
        "expected_md5": "55313c829223140bfe5a254f97ecd188",
        "value": "Fruits change your attacks, movement, grinding route, raids and PvP options in Blox Fruits. Rocket, Light, Buddha, Portal, Dough, Dragon and Leopard support different ways to play. Mutation variants, replaced names and admin-only forms have different availability, so check the route before chasing a price."
      }
    }
  },
  {
    "code": "blox-fruits-npcs",
    "changes": {
      "intro_md": {
        "expected_md5": "660fa8289b5eda0624e266cae4355110",
        "value": "NPCs connect the Blox Fruits map to quests, shops, trainers, travel, unlocks and fights. Service characters handle purchases and progression, while enemies and bosses bring their own levels, spawn conditions and combat requirements. Know the Sea and location before setting out for a particular character."
      }
    }
  },
  {
    "code": "blox-fruits-quests",
    "changes": {
      "intro_md": {
        "expected_md5": "d3124021ec9f17ad0eeb9f5a975616f9",
        "value": "Blox Fruits quests are the repeatable leveling route across First Sea, Second Sea and Third Sea. Accept a quest from an island NPC, defeat the target, collect EXP and Money, then repeat or move on when your level is high enough. Race upgrades, summoning, subclasses and item chains follow their own quest routes."
      }
    }
  },
  {
    "code": "brookhaven-rp-emotes",
    "changes": {
      "intro_md": {
        "expected_md5": "6fae1e5fd7f92262e353a1d85da18017",
        "value": "Emotes give your Brookhaven RP character different ways to act out a scene. Choose an animation that fits the role you are playing."
      },
      "wiki_md": {
        "expected_md5": "f2275b93c62082991de735af4f0ab39b",
        "value": "Emotes give your Brookhaven RP character different ways to act out a scene. Choose an animation that fits the role you are playing."
      },
      "faq_json": {
        "expected": [
          {
            "a": "It includes every emotes entry currently collected for Brookhaven RP, with the item fields that are available in the dataset.",
            "q": "What is included in this Brookhaven RP emotes catalog?"
          },
          {
            "a": "Blank values mean that detail was not listed clearly for that entry. We keep the item visible and avoid filling missing stats with guesses.",
            "q": "Why are some values blank?"
          },
          {
            "a": "Use the card view for quick visual browsing and the list view when you want to compare category across many entries.",
            "q": "How should I use this page?"
          }
        ],
        "value": []
      }
    }
  },
  {
    "code": "brookhaven-rp-gamepasses",
    "changes": {
      "intro_md": {
        "expected_md5": "2b7e36db48293805d454aa497eb3a250",
        "value": "Brookhaven RP gamepasses unlock paid benefits and options. Compare the cost with the unlocks you will actually use before spending Robux."
      },
      "wiki_md": {
        "expected_md5": "b143c24cce4db616537d21cbe09dc813",
        "value": "Brookhaven RP gamepasses unlock paid benefits and options. Compare the cost with the unlocks you will actually use before spending Robux."
      },
      "faq_json": {
        "expected": [
          {
            "a": "It includes every gamepasses entry currently collected for Brookhaven RP, with the item fields that are available in the dataset.",
            "q": "What is included in this Brookhaven RP gamepasses catalog?"
          },
          {
            "a": "Blank values mean that detail was not listed clearly for that entry. We keep the item visible and avoid filling missing stats with guesses.",
            "q": "Why are some values blank?"
          },
          {
            "a": "Use the card view for quick visual browsing and the list view when you want to compare Number, category, cost, benefits, and Reason across many entries.",
            "q": "How should I use this page?"
          }
        ],
        "value": []
      }
    }
  },
  {
    "code": "brookhaven-rp-houses",
    "changes": {
      "intro_md": {
        "expected_md5": "bfe115aeccc3f583dadabb105cc743fa",
        "value": "Houses give your Brookhaven RP roleplay a home base. House types, costs and unlock requirements differ, so choose one that fits your scene and what you can access."
      },
      "wiki_md": {
        "expected_md5": "25375b37270530310633057ff6ed8adb",
        "value": "Houses give your Brookhaven RP roleplay a home base. House types, costs and unlock requirements differ, so choose one that fits your scene and what you can access."
      },
      "faq_json": {
        "expected": [
          {
            "a": "It includes every houses entry currently collected for Brookhaven RP, with the item fields that are available in the dataset.",
            "q": "What is included in this Brookhaven RP houses catalog?"
          },
          {
            "a": "Blank values mean that detail was not listed clearly for that entry. We keep the item visible and avoid filling missing stats with guesses.",
            "q": "Why are some values blank?"
          },
          {
            "a": "Use the card view for quick visual browsing and the list view when you want to compare Number, category, type, Requirement Cost, and notes across many entries.",
            "q": "How should I use this page?"
          }
        ],
        "value": []
      }
    }
  },
  {
    "code": "brookhaven-rp-inventory-items",
    "changes": {
      "intro_md": {
        "expected_md5": "2edc058c46f425c9728628b2168cce1e",
        "value": "Inventory items give you tools and roleplay objects in Brookhaven RP. Their category and any cost or unlock requirement help you choose what fits your next scene."
      },
      "wiki_md": {
        "expected_md5": "3d44775b25d4f70617d59dbcf0f2cef9",
        "value": "Inventory items give you tools and roleplay objects in Brookhaven RP. Their category and any cost or unlock requirement help you choose what fits your next scene."
      },
      "faq_json": {
        "expected": [
          {
            "a": "It includes every inventory items entry currently collected for Brookhaven RP, with the item fields that are available in the dataset.",
            "q": "What is included in this Brookhaven RP inventory items catalog?"
          },
          {
            "a": "Blank values mean that detail was not listed clearly for that entry. We keep the item visible and avoid filling missing stats with guesses.",
            "q": "Why are some values blank?"
          },
          {
            "a": "Use the card view for quick visual browsing and the list view when you want to compare Number, category, Cost Requirement, and Description Notes across many entries.",
            "q": "How should I use this page?"
          }
        ],
        "value": []
      }
    }
  },
  {
    "code": "brookhaven-rp-jobs",
    "changes": {
      "intro_md": {
        "expected_md5": "edf688d36396e6caaa5a3c2cbb2abfb1",
        "value": "Jobs give your Brookhaven RP character a role in the town. The associated building and any requirements help you decide where to start the scene."
      },
      "wiki_md": {
        "expected_md5": "aae5e94456e4d60fe8ffc73987bc7d4e",
        "value": "Jobs give your Brookhaven RP character a role in the town. The associated building and any requirements help you decide where to start the scene."
      },
      "faq_json": {
        "expected": [
          {
            "a": "It includes every jobs entry currently collected for Brookhaven RP, with the item fields that are available in the dataset.",
            "q": "What is included in this Brookhaven RP jobs catalog?"
          },
          {
            "a": "Blank values mean that detail was not listed clearly for that entry. We keep the item visible and avoid filling missing stats with guesses.",
            "q": "Why are some values blank?"
          },
          {
            "a": "Use the card view for quick visual browsing and the list view when you want to compare Number, category, requirements, and notes across many entries.",
            "q": "How should I use this page?"
          }
        ],
        "value": []
      }
    }
  },
  {
    "code": "brookhaven-rp-locations",
    "changes": {
      "intro_md": {
        "expected_md5": "f267ee488fad83210fc3b1965ef63a75",
        "value": "Brookhaven RP locations give you places to set up jobs, visits and other roleplay scenes. Each area has its own purpose and position on the map."
      },
      "wiki_md": {
        "expected_md5": "bb6512fbe17cac4fe76b34e1eb3fcc6b",
        "value": "Brookhaven RP locations give you places to set up jobs, visits and other roleplay scenes. Each area has its own purpose and position on the map."
      },
      "faq_json": {
        "expected": [
          {
            "a": "It includes every locations entry currently collected for Brookhaven RP, with the item fields that are available in the dataset.",
            "q": "What is included in this Brookhaven RP locations catalog?"
          },
          {
            "a": "Blank values mean that detail was not listed clearly for that entry. We keep the item visible and avoid filling missing stats with guesses.",
            "q": "Why are some values blank?"
          },
          {
            "a": "Use the card view for quick visual browsing and the list view when you want to compare type, location, Introduced, and description across many entries.",
            "q": "How should I use this page?"
          }
        ],
        "value": []
      }
    }
  },
  {
    "code": "brookhaven-rp-map-themes",
    "changes": {
      "intro_md": {
        "expected_md5": "16b9d82d51e00fe69877dfba66de40ea",
        "value": "Map themes change the setting around Brookhaven RP. The effect, cost and unlock requirement matter when choosing a theme for your roleplay."
      },
      "wiki_md": {
        "expected_md5": "85a572ee236c569614eadd9c7b9b3e9a",
        "value": "Map themes change the setting around Brookhaven RP. The effect, cost and unlock requirement matter when choosing a theme for your roleplay."
      },
      "faq_json": {
        "expected": [
          {
            "a": "It includes every map themes entry currently collected for Brookhaven RP, with the item fields that are available in the dataset.",
            "q": "What is included in this Brookhaven RP map themes catalog?"
          },
          {
            "a": "Blank values mean that detail was not listed clearly for that entry. We keep the item visible and avoid filling missing stats with guesses.",
            "q": "Why are some values blank?"
          },
          {
            "a": "Use the card view for quick visual browsing and the list view when you want to compare Number, Requirement Cost, and notes across many entries.",
            "q": "How should I use this page?"
          }
        ],
        "value": []
      }
    }
  },
  {
    "code": "brookhaven-rp-props",
    "changes": {
      "intro_md": {
        "expected_md5": "6467235394149d8d92d173d2b3aeeba4",
        "value": "Props help you set up Brookhaven RP roleplay scenes. Choose objects that fit the setting and the role you want to play."
      },
      "wiki_md": {
        "expected_md5": "0d07e06681370341d1aa87828c64bd77",
        "value": "Props help you set up Brookhaven RP roleplay scenes. Choose objects that fit the setting and the role you want to play."
      },
      "faq_json": {
        "expected": [
          {
            "a": "It includes every props entry currently collected for Brookhaven RP, with the item fields that are available in the dataset.",
            "q": "What is included in this Brookhaven RP props catalog?"
          },
          {
            "a": "Blank values mean that detail was not listed clearly for that entry. We keep the item visible and avoid filling missing stats with guesses.",
            "q": "Why are some values blank?"
          },
          {
            "a": "Use the card view for quick visual browsing and the list view when you want to compare category across many entries.",
            "q": "How should I use this page?"
          }
        ],
        "value": []
      }
    }
  },
  {
    "code": "brookhaven-rp-roleplay-outfits",
    "changes": {
      "intro_md": {
        "expected_md5": "5d6a5f4f7d12806c1a12a85a46239dde",
        "value": "Roleplay outfits help you dress for a job or scene in Brookhaven RP. Outfit themes and their associated buildings can help you choose a role."
      },
      "wiki_md": {
        "expected_md5": "c2e42b49b2a2f780ad7b7f60c405319b",
        "value": "Roleplay outfits help you dress for a job or scene in Brookhaven RP. Outfit themes and their associated buildings can help you choose a role."
      },
      "faq_json": {
        "expected": [
          {
            "a": "It includes every roleplay outfits entry currently collected for Brookhaven RP, with the item fields that are available in the dataset.",
            "q": "What is included in this Brookhaven RP roleplay outfits catalog?"
          },
          {
            "a": "Blank values mean that detail was not listed clearly for that entry. We keep the item visible and avoid filling missing stats with guesses.",
            "q": "Why are some values blank?"
          },
          {
            "a": "Use the card view for quick visual browsing and the list view when you want to compare Number and building across many entries.",
            "q": "How should I use this page?"
          }
        ],
        "value": []
      }
    }
  },
  {
    "code": "brookhaven-rp-secrets",
    "changes": {
      "intro_md": {
        "expected_md5": "f3e048c7d8ad92aff5441513c7ba6bfa",
        "value": "Brookhaven RP secrets involve hidden details and interactions around the town. Follow the steps for the secret you want to investigate."
      },
      "wiki_md": {
        "expected_md5": "543da208c5c8726dcf7da8e2f457a568",
        "value": "Brookhaven RP secrets involve hidden details and interactions around the town. Follow the steps for the secret you want to investigate."
      },
      "faq_json": {
        "expected": [
          {
            "a": "It includes every secrets entry currently collected for Brookhaven RP, with the item fields that are available in the dataset.",
            "q": "What is included in this Brookhaven RP secrets catalog?"
          },
          {
            "a": "Blank values mean that detail was not listed clearly for that entry. We keep the item visible and avoid filling missing stats with guesses.",
            "q": "Why are some values blank?"
          },
          {
            "a": "Use the card view for quick visual browsing and the list view when you want to compare Summary and Steps across many entries.",
            "q": "How should I use this page?"
          }
        ],
        "value": []
      }
    }
  },
  {
    "code": "brookhaven-rp-vehicles",
    "changes": {
      "intro_md": {
        "expected_md5": "55b2cd229844157341991b3f8d418ae7",
        "value": "Vehicles in Brookhaven RP differ in type, seating and unlock requirements. Pick one that fits your group and the roleplay you have planned."
      },
      "wiki_md": {
        "expected_md5": "4bb9ea53705e500810f404a0d74d05c1",
        "value": "Vehicles in Brookhaven RP differ in type, seating and unlock requirements. Pick one that fits your group and the roleplay you have planned."
      },
      "faq_json": {
        "expected": [
          {
            "a": "It includes every vehicles entry currently collected for Brookhaven RP, with the item fields that are available in the dataset.",
            "q": "What is included in this Brookhaven RP vehicles catalog?"
          },
          {
            "a": "Blank values mean that detail was not listed clearly for that entry. We keep the item visible and avoid filling missing stats with guesses.",
            "q": "Why are some values blank?"
          },
          {
            "a": "Use the card view for quick visual browsing and the list view when you want to compare Number, category, type, Requirement Cost, and notes across many entries.",
            "q": "How should I use this page?"
          }
        ],
        "value": []
      }
    }
  },
  {
    "code": "brookhaven-rp-weather-and-disasters",
    "changes": {
      "intro_md": {
        "expected_md5": "d24b741917ff88c01929600a8c87ad8f",
        "value": "Weather and disasters change the setting for Brookhaven RP roleplay. The conditions, requirements and availability differ between effects."
      },
      "wiki_md": {
        "expected_md5": "b343eafad6c90270b46b5073e81de3dd",
        "value": "Weather and disasters change the setting for Brookhaven RP roleplay. The conditions, requirements and availability differ between effects."
      },
      "faq_json": {
        "expected": [
          {
            "a": "It includes every weather and disasters entry currently collected for Brookhaven RP, with the item fields that are available in the dataset.",
            "q": "What is included in this Brookhaven RP weather and disasters catalog?"
          },
          {
            "a": "Blank values mean that detail was not listed clearly for that entry. We keep the item visible and avoid filling missing stats with guesses.",
            "q": "Why are some values blank?"
          },
          {
            "a": "Use the card view for quick visual browsing and the list view when you want to compare Number, category, and description across many entries.",
            "q": "How should I use this page?"
          }
        ],
        "value": []
      }
    }
  },
  {
    "code": "build-a-ring-farm-eggs",
    "changes": {
      "intro_md": {
        "expected_md5": "524b3570455b12e93c700fcbd27689f0",
        "value": "Eggs hatch into random pets from their own pools in Build A Ring Farm. Prices, purchase routes and possible pets differ between eggs. Choose an egg around the pet ability or income boost your farm needs."
      }
    }
  },
  {
    "code": "build-a-ring-farm-pets",
    "changes": {
      "intro_md": {
        "expected_md5": "3d73d348c3470f9f8de46d4fd111e82f",
        "value": "Pets multiply the income on their Build A Ring Farm floor and use an ability on a timer. Some drop fertilizer, grow plants or upgrade mutations. Choose a pet around both its income boost and the ability your farm needs."
      }
    }
  },
  {
    "code": "build-a-ring-farm-seeds",
    "changes": {
      "intro_md": {
        "expected_md5": "2163dcd14677564274d3d53c656c6e0c",
        "value": "Buy or roll a seed in Build A Ring Farm, plant it on a ring zone, wait for it to grow, then harvest it for Cash. Rarity affects the income you can expect, but cost, grow time and roll odds also matter before you commit a slot."
      }
    }
  },
  {
    "code": "capybaras-vs-plants-bosses",
    "changes": {
      "intro_md": {
        "expected_md5": "7d9f9ee3a2cfa14bb8a46f5bbea31771",
        "value": "The Boss Summoner in Capybaras VS Plants starts with Scarlet Carrot at 500 HP, then steps up to Red Potato at 4,000 HP and Dark Tomato at 20,000 HP. That health jump matters when you choose the next fight, and Red Potato can also drop as a plant after you defeat it."
      },
      "wiki_md": {
        "expected_md5": "f80502d4e8ce2d0bd9004119e30a5440",
        "value": "The Boss Summoner in Capybaras VS Plants starts with Scarlet Carrot at 500 HP, then steps up to Red Potato at 4,000 HP and Dark Tomato at 20,000 HP. That health jump matters when you choose the next fight, and Red Potato can also drop as a plant after you defeat it."
      },
      "description_md": {
        "expected_md5": "acf14e4e4913a418b342082482da7406",
        "value": ""
      },
      "faq_json": {
        "expected": [
          {
            "a": "Start with the fields that change the player's decision: Summoner Order, Roster Status, HP, Progression, and card summary. Rarity helps with sorting, but source, effect, requirement, price, or availability usually explains the real value.",
            "q": "Which Capybaras VS Plants bosses fields matter most?"
          },
          {
            "a": "Blank values mean that detail was not listed clearly for that entry. The item stays visible, but missing stats are not filled with guesses.",
            "q": "Why are some values blank?"
          },
          {
            "a": "Yes. A low-rarity item from an old event, removed shop, limited reward, or rare drop can be harder to get than a higher-rarity item that is still sold or farmed normally.",
            "q": "Can a low-rarity item still be hard to replace?"
          }
        ],
        "value": []
      }
    }
  },
  {
    "code": "capybaras-vs-plants-plants",
    "changes": {
      "intro_md": {
        "expected_md5": "9b90e8085e3d2bf482615764f5912b13",
        "value": "Defeat plants in Capybaras VS Plants and place their drops on your plot to earn money, including while you are offline. Regular encounters such as Broccoli and Carrot are separate from the Boss Summoner progression."
      },
      "wiki_md": {
        "expected_md5": "7599fb7c4d6f5e9aee23d513c5d444ca",
        "value": "Defeat plants in Capybaras VS Plants and place their drops on your plot to earn money, including while you are offline. Regular encounters such as Broccoli and Carrot are separate from the Boss Summoner progression."
      },
      "description_md": {
        "expected_md5": "acf14e4e4913a418b342082482da7406",
        "value": ""
      },
      "faq_json": {
        "expected": [
          {
            "a": "Start with the fields that change the player's decision: Plant Type, rarity, encounter, Income Role, and card summary. Rarity helps with sorting, but source, effect, requirement, price, or availability usually explains the real value.",
            "q": "Which Capybaras VS Plants plants fields matter most?"
          },
          {
            "a": "Blank values mean that detail was not listed clearly for that entry. The item stays visible, but missing stats are not filled with guesses.",
            "q": "Why are some values blank?"
          },
          {
            "a": "Yes. A low-rarity item from an old event, removed shop, limited reward, or rare drop can be harder to get than a higher-rarity item that is still sold or farmed normally.",
            "q": "Can a low-rarity item still be hard to replace?"
          }
        ],
        "value": []
      }
    }
  },
  {
    "code": "clean-the-library-shelf-sections",
    "changes": {
      "intro_md": {
        "expected_md5": "01ed05b33a822fc5a3b3fbba102c5aef",
        "value": "The library in Clean The Library is split into themed shelf sections, and every book on the floor belongs on one of them. Each section has a code made of a floor number and a letter, like 1A or 2C, and each section is tied to one Roblox theme such as Studio, Simulators, DevEx, or Brainrot. Your job is to grab a book, read its theme, and walk it to the matching shelf."
      }
    }
  },
  {
    "code": "clean-the-supermarket-upgrades",
    "changes": {
      "intro_md": {
        "expected_md5": "5d267ceaac59e96976e11a87dcb29e70",
        "value": "Sorting groceries earns Cash for upgrades in Clean the Supermarket. Permanent Keys change how you move and carry, while Abilities help when a section gets messy. Choose an upgrade around the part of your shift that is slowing you down."
      }
    }
  },
  {
    "code": "creatures-of-sonaria-creatures",
    "changes": {
      "intro_md": {
        "expected_md5": "008b8abb0be4d1697cde1f9b811940ce",
        "value": "Creatures are the species you spawn, grow, fight, nest and trade in Creatures of Sonaria. Tier affects the size bracket, combat stats, storage cost and gacha pools. Diet and mobility determine whether a species fits life on land, in water or in the air."
      }
    }
  },
  {
    "code": "creatures-of-sonaria-environment",
    "changes": {
      "intro_md": {
        "expected_md5": "e242be873aeb197a13ca6b377342bb99",
        "value": "Sonaria runs on three stacked layers: a global season clock, short random weather, and rarer map-wide disasters. Seasons set your food multiplier and unlock certain weather. Weather shifts every few minutes with buffs, debuffs, or shelter checks. Disasters hit harder, can stack, and block weather-change tokens until they end."
      }
    }
  },
  {
    "code": "creatures-of-sonaria-material-palettes",
    "changes": {
      "intro_md": {
        "expected_md5": "a0bc7f873342ed72a1f6c557eb788ab2",
        "value": "Material palettes retexture your creature: foil crinkles, magma rock, forcefield shells, gold trophy shine, and full themed looks. They work alongside [color palettes](/wiki/creatures-of-sonaria/color-palettes), which only change hue slots. The appearance, obtainment route and whether death costs an Appearance Change Token matter when choosing a material."
      }
    }
  },
  {
    "code": "creatures-of-sonaria-status-effects",
    "changes": {
      "intro_md": {
        "expected_md5": "fe4cb91dcf85c82da8ecc1642506e2d1",
        "value": "Status effects are the temporary buffs and debuffs that shape every fight and survival run in Creatures of Sonaria. Bleed stops your regen until you stand still, Fortify wipes most debuffs for a short immunity window, and blizzard hypothermia punishes anyone who stays out in the open. The effect, stacking rules and recovery method determine how you handle each ailment."
      }
    }
  },
  {
    "code": "dead-rails-items",
    "changes": {
      "intro_md": {
        "expected_md5": "b32e553e59c8d4283fe14fdacee2a2b4",
        "value": "Healing, tools and light sources help you survive a Dead Rails journey. Puzzle items open routes, while junk and valuables can become money at the next stop. Inventory space is limited, so decide which pickups deserve room on the train."
      }
    }
  },
  {
    "code": "demonology-cursed-objects",
    "changes": {
      "intro_md": {
        "expected_md5": "08c2a836eb6c5dacd8131debb8dcf7ed",
        "value": "Cursed Objects are special tools you find at a job site in Demonology. Each one helps you find, summon, or talk to the ghost, but using it drains your energy and can set off a Cursed Hunt you cannot stop."
      }
    }
  },
  {
    "code": "demonology-equipment",
    "changes": {
      "intro_md": {
        "expected_md5": "fc642efe3b94e654474593a4d4888ef1",
        "value": "Equipment in Demonology helps you find evidence, survive hunts and earn money. You can carry up to three items at a time, so choose the tools that matter most for the ghost you are trying to identify. Price and unlock level determine which loadouts you can afford as you progress."
      }
    }
  },
  {
    "code": "demonology-evidence",
    "changes": {
      "intro_md": {
        "expected_md5": "050422a558236544c379e116c36b163b",
        "value": "Demonology has eight evidence types, and each ghost leaves three. Take the right tools into a job and watch for the signs that confirm each piece of evidence. Once you have three confirmed, your journal narrows the possibilities to one ghost."
      }
    }
  },
  {
    "code": "demonology-ghosts",
    "changes": {
      "intro_md": {
        "expected_md5": "f51a86b66dec256cb033495df33e5e61",
        "value": "Each Demonology match hides a ghost with three evidence types chosen from eight possibilities. Use your tools to identify the evidence, then watch how the ghost moves and hunts when the clues leave you uncertain. Evidence and behavior together help you decide which ghost you are facing."
      }
    }
  },
  {
    "code": "demonology-maps",
    "changes": {
      "intro_md": {
        "expected_md5": "b7c8f9a2560bbc86825553ca384e0a92",
        "value": "Demonology contracts take you to Job Sites with different sizes, layouts and unlock levels. You start with small homes and unlock larger, harder sites as your level rises. Choose a site for your level and the kind of hunt you want to attempt."
      }
    }
  },
  {
    "code": "drag-drive-simulator-motorcycles",
    "changes": {
      "intro_md": {
        "expected_md5": "cc667cf43e85ddb21160baab3d7dd371",
        "value": "Motorcycles in Drag Drive Simulator have different RP prices and dealership routes. Confirm the model and price in the live garage before saving for a purchase."
      }
    }
  },
  {
    "code": "dress-to-impress-hairstyles",
    "changes": {
      "intro_md": {
        "expected_md5": "69ac9e296aa15249ae04101f86b8ca8f",
        "value": "Hairstyles change a Dress To Impress outfit before the runway round. The Feminine, Masculine and Bangs Hair Station areas have different options, and some styles have unlock requirements or toggles. Choose the hair shape for your outfit before spending time on the finishing details."
      }
    }
  },
  {
    "code": "dungeon-quest-weapons",
    "changes": {
      "intro_md": {
        "expected_md5": "dd83c0817716b7481c16172b408fd4dc",
        "value": "Weapons in Dungeon Quest Reborn have different classes, dungeon routes and upgrade choices. Check the live item card for Physical, Spell, Req Lvl, Upgrades and drop details before choosing a weapon for your build."
      }
    }
  },
  {
    "code": "evade-special-rounds",
    "changes": {
      "intro_md": {
        "expected_md5": "3f74aa33d573feab9e70b9ada3a31cb6",
        "value": "Special rounds change Evade's normal nextbot loop. Every third round, the game can swap in flipped controls, black fog, bigger or faster bots, or a flood of named nextbots. Higher reward multipliers usually mean a harder rule set, so match your loadout and movement to the special that just rolled."
      }
    }
  },
  {
    "code": "evomon-monsters",
    "changes": {
      "intro_md": {
        "expected_md5": "556d4ebcf1e114cd9c35de54fa9b0827",
        "value": "Evomon are creatures you catch, raise and battle, with elements such as Fire, Water and Grass. Evolution paths, catch locations and base stats help you choose a team. Pick creatures for their traits and the battles you want to take on."
      }
    }
  },
  {
    "code": "fling-things-and-people-maps",
    "changes": {
      "intro_md": {
        "expected_md5": "fe1dbb75f7b896c6f543980f351bcb2f",
        "value": "The whole server shares one island. You navigate by landmark names, not by menus: spawn on the Plains, climb the snowy mountain, cut through the train cave, or claim a house plot when you want grab protection. Outdoor biomes, the poison factory side and quieter hideouts give you different places to explore."
      }
    }
  },
  {
    "code": "forsaken-milestones",
    "changes": {
      "intro_md": {
        "expected_md5": "b6e051fcf478d0d2d39ecd5197adc005",
        "value": "Forsaken milestone rewards unlock as you level each character. The standard checkpoints are levels 25, 50, 75 and 100 for Survivors and Killers. These rewards follow character progress rather than the other skin unlock routes."
      }
    }
  },
  {
    "code": "grow-a-garden-2-mutations",
    "changes": {
      "intro_md": {
        "expected_md5": "82bd8107f2a0a96b45d4e8159c27697e",
        "value": "Mutations raise crop value in Grow a Garden 2. Gold, Rainbow, Electric, Frozen, Starstruck and Bloodlit have different multipliers and triggers. Electric is a strong value target, while weather mutations depend on the right event appearing."
      }
    }
  },
  {
    "code": "grow-a-garden-2-night-stealing",
    "changes": {
      "intro_md": {
        "expected_md5": "3ef46d6f7fbbed58d90f6bbcb6858a0d",
        "value": "Night stealing in Grow a Garden 2 uses pets, gear and crates with different roles. Some help you steal, some improve visibility, and others defend fruit against other players. Choose what your garden needs before investing in another item."
      }
    }
  },
  {
    "code": "grow-a-garden-crafting-recipes",
    "changes": {
      "intro_md": {
        "expected_md5": "7af2dc2e4b4f8bea87b650d4bf84eb78",
        "value": "Crafting in Grow a Garden turns seeds, eggs, currencies and other ingredients into new items. Some crafts need farmable materials, while others use event currency or offer a paid shortcut. Plan around the full ingredient cost and craft time before committing resources."
      }
    }
  },
  {
    "code": "grow-a-garden-crop-mutations",
    "changes": {
      "intro_md": {
        "expected_md5": "6dafc9116918abadb0ddd122a367ef2c",
        "value": "Crop mutations change how plants look and how much they sell for in Grow a Garden. Weather, pets, fertilizers, sprays, special seeds and admin events can all produce different effects. The multiplier and obtainment route help you decide which mutation to pursue."
      }
    }
  },
  {
    "code": "grow-a-garden-crops",
    "changes": {
      "intro_md": {
        "expected_md5": "813a74e4d4737db2a558e12d607786be",
        "value": "Crops drive the Grow a Garden economy. Their sale value, weight, harvest behavior and mutation potential shape what you earn from each planting. Balance reliable crops against rarer plants whose seeds are harder to obtain."
      }
    }
  },
  {
    "code": "grow-a-garden-currencies",
    "changes": {
      "intro_md": {
        "expected_md5": "e486d779b0a8fa2725776f12a3400471",
        "value": "Grow a Garden uses different currencies for different parts of progression. Sheckles fund the standard shop loop, Garden Coins support ascension upgrades, and seasonal currencies belong to their own systems. Match the currency to the upgrade you want before you start farming."
      }
    }
  },
  {
    "code": "grow-a-garden-eggs",
    "changes": {
      "intro_md": {
        "expected_md5": "5f73d4597427e8584d11f1378ff7b079",
        "value": "Eggs determine which pets you can hatch in Grow a Garden and how long the hatch takes. The Pet Egg Shop rotates its stock, while exotic and limited eggs have different obtainment routes. Choose the pet you want, then work back to its egg and availability."
      }
    }
  },
  {
    "code": "grow-a-garden-food",
    "changes": {
      "intro_md": {
        "expected_md5": "8fae2c83fee7aca03b3fd8d384323148",
        "value": "Cooking in Grow a Garden turns crops into food instead of a direct sale. Dishes have their own recipes, cooking times and weights. Save ingredients for the dish you want before selling the harvest."
      }
    }
  },
  {
    "code": "grow-a-garden-gears",
    "changes": {
      "intro_md": {
        "expected_md5": "fc1bb592984f8840e769058e80e9680d",
        "value": "Gear in Grow a Garden can speed up growth, change your plot or support mutation farming. Sprinklers, utility tools and other items have different uses, and the Gear Shop rotates its stock. Choose the tool for your farming plan rather than buying only for rarity."
      }
    }
  },
  {
    "code": "grow-a-garden-merchants",
    "changes": {
      "intro_md": {
        "expected_md5": "6713ce1227b4d55cccd283cf005234e9",
        "value": "Merchants in Grow a Garden can sell specialized stock, limited items and rewards outside the ordinary shop loop. Their inventories and availability differ. Find the seller tied to the item you want before waiting on a standard shop refresh."
      }
    }
  },
  {
    "code": "grow-a-garden-npcs",
    "changes": {
      "intro_md": {
        "expected_md5": "b4f0d048efd8bfecd89825b7321748ab",
        "value": "NPCs in Grow a Garden run shops, offer quests and exchanges, or take part in limited systems. Their role determines which character you need to visit for an item or unlock. Event characters can have a narrower purpose than the everyday shopkeepers."
      }
    }
  },
  {
    "code": "grow-a-garden-pet-mutations",
    "changes": {
      "intro_md": {
        "expected_md5": "fba6938cc9fee419be319ed60a4a9e31",
        "value": "Pet mutations in Grow a Garden can change XP gain, passive effects and the value of a companion. Different traits support different goals. Choose a mutation around the pet ability or progression you want to improve."
      }
    }
  },
  {
    "code": "grow-a-garden-pets",
    "changes": {
      "intro_md": {
        "expected_md5": "0d1d2ab47dd438e0cd6d16814a56c3b9",
        "value": "Pets in Grow a Garden can improve hatching, mutation odds, passive profit and harvesting strategies. Their abilities and obtainment routes matter as much as rarity. Choose a pet around the part of your garden you want to improve."
      }
    }
  },
  {
    "code": "grow-a-garden-seed-packs",
    "changes": {
      "intro_md": {
        "expected_md5": "a79278e98b07825ee1d77762ef543582",
        "value": "Seed packs in Grow a Garden can contain event plants, seasonal seeds and other rewards outside the ordinary shop loop. Some packs are earned, some cost currency, and others belong to limited offers. Check the contents and obtainment route before chasing a particular plant."
      }
    }
  },
  {
    "code": "grow-a-garden-seeds",
    "changes": {
      "intro_md": {
        "expected_md5": "3f9e80b8fa3dc4230a451076214aaf1c",
        "value": "Seeds in Grow a Garden come through shops, crafting, packs, merchants and events. That route decides how reliably you can plant a crop, even when two crops have similar profit potential. Plan your growing around seeds you can actually obtain."
      }
    }
  },
  {
    "code": "grow-a-garden-shops",
    "changes": {
      "intro_md": {
        "expected_md5": "fa439bbc85b1ebf1e0af3e42bbf43faf",
        "value": "Grow a Garden shops have different currencies, stock pools and refresh cycles. The Seed Shop, Gear Shop and Pet Egg Shop serve different parts of your garden. Plan stock checks around the item you need and the shop that sells it."
      }
    }
  },
  {
    "code": "grow-a-garden-weather",
    "changes": {
      "intro_md": {
        "expected_md5": "fab29348a048addfda772e34f353e655",
        "value": "Weather in Grow a Garden can speed up growth, trigger mutations and change what happens on your plot. Some patterns belong to normal play, while others depend on events or admin activity. Time your farming around the boost or mutation you want."
      }
    }
  },
  {
    "code": "jujutsu-shenanigans-achievements",
    "changes": {
      "intro_md": {
        "expected_md5": "48da5a6dd4f75f133b7feb8175310948",
        "value": "Jujutsu Shenanigans achievements are permanent Trophy-menu goals for kill milestones, mode clears, unusual fight interactions and character-specific challenges. Daily and Weekly Quests share the menu but are rotating Cash tasks, so they follow a different completion loop."
      }
    }
  },
  {
    "code": "jujutsu-shenanigans-build-blocks",
    "changes": {
      "intro_md": {
        "expected_md5": "2487eb246d22f3495db29688b1e6bf4d",
        "value": "Build Mode blocks and tools let you create arenas, moveset rooms, team games, hazards, teleports and NPC fights in Jujutsu Shenanigans private servers. Structure pieces shape the space, while inputs, outputs and logic blocks control what happens inside it."
      }
    }
  },
  {
    "code": "jujutsu-shenanigans-domains",
    "changes": {
      "intro_md": {
        "expected_md5": "105db937c7e102b70853204785bc1a87",
        "value": "Domains in Jujutsu Shenanigans depend on the character, awakening and domain-border rules. Some trap enemies in a damaging or disabling space, while others create a gambling window, trial, short sequence or invasion path through another domain."
      }
    }
  },
  {
    "code": "jujutsu-shenanigans-emotes",
    "changes": {
      "intro_md": {
        "expected_md5": "a7446e37f45e7b64654522a2729001e4",
        "value": "Jujutsu Shenanigans emotes include taunts, poses, movement animations, partner prompts and small interactions. Most come from the random shop pool, while others require codes, events, secrets, badges, quests or staff access. The unlock route matters when you are chasing a particular animation."
      }
    }
  },
  {
    "code": "jujutsu-shenanigans-gamemodes",
    "changes": {
      "intro_md": {
        "expected_md5": "9e63117afdba0bc2f0664de382f6b9e1",
        "value": "Jujutsu Shenanigans modes change the fight. Public servers offer open map combat, Duels use small-team rounds, Ranked adds Elo, and Roulette runs short minigames. Custom modes focus on private-server control and Workshop movesets."
      }
    }
  },
  {
    "code": "jujutsu-shenanigans-titles",
    "changes": {
      "wiki_md": {
        "expected_md5": "5ef2e3eb673c178fe8b63766926397c1",
        "value": "Titles are visible Jujutsu Shenanigans labels equipped from the inventory and shown in chat or above a player's name. Leaderboard titles mark active kill-board rank, staff and team titles mark reserved roles, and custom or creator titles include unusual grants such as CONTENT CREATOR and its Free Cam permission."
      }
    }
  },
  {
    "code": "kick-a-lucky-block-mutations",
    "changes": {
      "intro_md": {
        "expected_md5": "251beffc654a728d95f46e5e9d2f750e",
        "value": "Mutations change how much a Kick a Lucky Block brainrot can earn. Normal is the 1x baseline, while stronger mutations raise the income multiplier."
      }
    }
  },
  {
    "code": "kick-a-lucky-block-weights",
    "changes": {
      "intro_md": {
        "expected_md5": "50d951ace776d71445f97ac23bf40116",
        "value": "Weights raise your kick power in Kick a Lucky Block. Start with the free Wooden Stick, then buy stronger weights as your Cash grows. The power gain and shop cost matter more than rarity alone when choosing the next upgrade."
      }
    }
  },
  {
    "code": "murder-mystery-2-radios",
    "changes": {
      "intro_md": {
        "expected_md5": "4667300d040ff075bd62ac250e082f09",
        "value": "Radios let you play music IDs in Murder Mystery 2 lobbies, but broadcasting requires the Radio Gamepass. The radio model changes the appearance rather than adding that permission. Designs come through coin shops and event routes, including older radios that are no longer obtainable."
      }
    }
  },
  {
    "code": "murderers-vs-sheriffs-crates",
    "changes": {
      "intro_md": {
        "expected_md5": "f9c206dd08c975e0847b3d9a24c8507f",
        "value": "PRO and GOD boxes in Murderers VS Sheriffs are Robux purchases. Their tiers and prices differ. Confirm the reward offer in the game before buying, since a box name alone does not establish its contents or odds."
      }
    }
  },
  {
    "code": "murderers-vs-sheriffs-death-effects",
    "changes": {
      "intro_md": {
        "expected_md5": "ac357d68dab27ca46321021f8ddbce98",
        "value": "Death effects in Murderers VS Sheriffs are cosmetic kill visuals. They do not make a weapon stronger, but they change the elimination animation and can matter for collecting, bundles and trading."
      }
    }
  },
  {
    "code": "murderers-vs-sheriffs-weapons",
    "changes": {
      "intro_md": {
        "expected_md5": "75d193d2ee5030270e59fb68dfbb1e16",
        "value": "Weapons in Murderers VS Sheriffs are knife and gun skins you collect, equip, buy and trade. Death effects are separate cosmetics, so check which item a bundle or trade offer actually includes."
      }
    }
  },
  {
    "code": "pet-simulator-99-keys",
    "changes": {
      "wiki_md": {
        "expected_md5": "3f3faf4d65f1a497a731e9de512c0494",
        "value": "Keys open Pet Simulator 99's locked rooms, from the Area 3 Castle and Prison to the Backrooms and rebirth-gated secret rooms. Most arrive as upper and lower halves that combine into the finished key, halves trade between players, and spending keys levels the Keys Mastery. Match each key to its door before spending it."
      }
    }
  },
  {
    "code": "push-rock-for-brainrots-brainrots",
    "changes": {
      "intro_md": {
        "expected_md5": "9cbb6cdbf8802e6781f5ee258ed879e4",
        "value": "Rescued Brainrots earn Cash in Push Rock for Brainrots. Stronger rock lanes lead to higher-rarity targets such as Strawberry Elephant and Quesadilla Crocodilla, so your next rescue depends on both its income and whether your Strength can reach it."
      },
      "wiki_md": {
        "expected_md5": "5ad66ad5282960fc2204bc7629e4a363",
        "value": "Rescued Brainrots earn Cash in Push Rock for Brainrots. Stronger rock lanes lead to higher-rarity targets such as Strawberry Elephant and Quesadilla Crocodilla, so your next rescue depends on both its income and whether your Strength can reach it."
      },
      "description_md": {
        "expected_md5": "acf14e4e4913a418b342082482da7406",
        "value": ""
      },
      "faq_json": {
        "expected": [
          {
            "a": "Start with the fields that change the player's decision: rarity, income, Route, availability, section, and card summary. Rarity helps with sorting, but source, effect, requirement, price, or availability usually explains the real value.",
            "q": "Which Push Rock for Brainrots brainrots fields matter most?"
          },
          {
            "a": "Blank values mean that detail was not listed clearly for that entry. The item stays visible, but missing stats are not filled with guesses.",
            "q": "Why are some values blank?"
          },
          {
            "a": "Yes. A low-rarity item from an old event, removed shop, limited reward, or rare drop can be harder to get than a higher-rarity item that is still sold or farmed normally.",
            "q": "Can a low-rarity item still be hard to replace?"
          }
        ],
        "value": []
      }
    }
  },
  {
    "code": "push-rock-for-brainrots-rocks",
    "changes": {
      "intro_md": {
        "expected_md5": "f04d7153311915b02fd831e4f58d80c4",
        "value": "Rocks block routes to Brainrots in Push Rock for Brainrots. Strength lets you move the boulders, while rarity gates lead to different rescue areas. If a rock barely moves, improve Strength before trying the route again."
      },
      "wiki_md": {
        "expected_md5": "a7a1499a9e7fad5630bca9232ad53a1d",
        "value": "Rocks block routes to Brainrots in Push Rock for Brainrots. Strength lets you move the boulders, while rarity gates lead to different rescue areas. If a rock barely moves, improve Strength before trying the route again."
      },
      "description_md": {
        "expected_md5": "acf14e4e4913a418b342082482da7406",
        "value": ""
      },
      "faq_json": {
        "expected": [
          {
            "a": "Start with the fields that change the player's decision: Gate Type, Unlocks, Route, availability, section, and card summary. Rarity helps with sorting, but source, effect, requirement, price, or availability usually explains the real value.",
            "q": "Which Push Rock for Brainrots rocks fields matter most?"
          },
          {
            "a": "Blank values mean that detail was not listed clearly for that entry. The item stays visible, but missing stats are not filled with guesses.",
            "q": "Why are some values blank?"
          },
          {
            "a": "Yes. A low-rarity item from an old event, removed shop, limited reward, or rare drop can be harder to get than a higher-rarity item that is still sold or farmed normally.",
            "q": "Can a low-rarity item still be hard to replace?"
          }
        ],
        "value": []
      }
    }
  },
  {
    "code": "push-rock-for-brainrots-upgrades",
    "changes": {
      "intro_md": {
        "expected_md5": "d8d592fd733a5895962ad00cf2ecb864",
        "value": "Strength moves bigger rocks, Carry reduces return trips, and Rebirth trades short-term progress for long-term multipliers in Push Rock for Brainrots. Buy Strength when a gate blocks you, then Carry once the journey home is slowing your rescues."
      },
      "wiki_md": {
        "expected_md5": "7115493bdd95e164267734688b3c889a",
        "value": "Strength moves bigger rocks, Carry reduces return trips, and Rebirth trades short-term progress for long-term multipliers in Push Rock for Brainrots. Buy Strength when a gate blocks you, then Carry once the journey home is slowing your rescues."
      },
      "description_md": {
        "expected_md5": "acf14e4e4913a418b342082482da7406",
        "value": ""
      },
      "faq_json": {
        "expected": [
          {
            "a": "Start with the fields that change the player's decision: Upgrade Type, effect, cost, currency, Priority, section, and card summary. Rarity helps with sorting, but source, effect, requirement, price, or availability usually explains the real value.",
            "q": "Which Push Rock for Brainrots upgrades fields matter most?"
          },
          {
            "a": "Blank values mean that detail was not listed clearly for that entry. The item stays visible, but missing stats are not filled with guesses.",
            "q": "Why are some values blank?"
          },
          {
            "a": "Yes. A low-rarity item from an old event, removed shop, limited reward, or rare drop can be harder to get than a higher-rarity item that is still sold or farmed normally.",
            "q": "Can a low-rarity item still be hard to replace?"
          }
        ],
        "value": []
      }
    }
  },
  {
    "code": "restaurant-tycoon-3-rating-categories",
    "changes": {
      "intro_md": {
        "expected_md5": "55fd2d8abd17f244ed5115ad586a4477",
        "value": "Your Restaurant Tycoon 3 star rating adds up fixed contributions from each rating factor. Improve the categories holding you back to work toward five stars over your door."
      }
    }
  },
  {
    "code": "rivals-maps",
    "changes": {
      "intro_md": {
        "expected_md5": "7fe0e224fd177e9dfc3a05efa68b9a4f",
        "value": "RIVALS maps change how a duel plays. Regular maps support normal public matches, big maps fit larger lobbies, and experimental maps may change. Legacy maps and Baseplate belong to private-server play."
      }
    }
  },
  {
    "code": "rivals-ugc",
    "changes": {
      "intro_md": {
        "expected_md5": "c03b61c089f0eeae0d9542ea2baf9502",
        "value": "RIVALS UGC items are Roblox avatar accessories and clothing from Nosniy Games. Buying an official item counts toward the RIVALS UGC reward track. Check the creator, item type, price and sale status before purchasing."
      }
    }
  },
  {
    "code": "sailor-piece-auras",
    "changes": {
      "intro_md": {
        "expected_md5": "c6a92f79ff8d06e9137862161b682c8d",
        "value": "Auras in Sailor Piece add a visual effect and a stat buff, with damage bonuses that generally rise with rarity. Most come from the Aura Crate, while others use quests or seasonal events. Check whether an aura is still obtainable before chasing a collector item."
      }
    }
  },
  {
    "code": "sailor-piece-bloodlines",
    "changes": {
      "intro_md": {
        "expected_md5": "fb1bc9f4892a0ef185e43b30e8224c52",
        "value": "Bloodlines are rerolled stat packages in Sailor Piece that support damage, HP, luck, weapon scaling or sustain. Some also serve as recipe or quest requirements, so the best choice can depend on more than damage."
      }
    }
  },
  {
    "code": "sailor-piece-guilds",
    "changes": {
      "intro_md": {
        "expected_md5": "bd9a1621d32d208cf0b2ed48fc809884",
        "value": "Guild progression in Sailor Piece starts with a Guild Key, then turns into shared upgrades. Keys come from rare drops, while upgrades add bonuses after the guild exists."
      }
    }
  },
  {
    "code": "sell-lemons-income-sources",
    "changes": {
      "intro_md": {
        "expected_md5": "fefbb002ef633aa0f1610b6ca3382c05",
        "value": "Income sources form the Sell Lemons progression ladder. The Lemon Stand starts with clicking, then deliveries, wholesale sales, trading, research and automation add other ways to earn Cash. Choose the next building around its unlock requirements and the manager or automation route it opens."
      }
    }
  },
  {
    "code": "sell-lemons-locations",
    "changes": {
      "intro_md": {
        "expected_md5": "bf682f874a077a56e32f4e1e36de34cc",
        "value": "Sell Lemons locations change your progression route. The starting plot, Depot path, hill climb, sewer maze, UFO route and First Tier staircase open different parts of the game. Orange X, LemonX and Moon belong to the endgame route."
      }
    }
  },
  {
    "code": "slime-rng-slimes",
    "changes": {
      "intro_md": {
        "expected_md5": "c796955b83c9ad743c68c54a471c9041",
        "value": "Slimes are rolled team units in Slime RNG. Their odds, rarity, variant, Power and Health affect both collection goals and enemy fights. Choose a pull for what it adds to your team as well as its rarity."
      }
    }
  },
  {
    "code": "the-forge-armors",
    "changes": {
      "intro_md": {
        "expected_md5": "8b663b63376050fb61378f591163a306",
        "value": "Armor in The Forge is split into helmets, chestplates and leggings. Ore quantity affects the weight class, while ore quality affects the resulting stats. Build a set that keeps you alive in your next area before spending rare materials on enhancement."
      }
    }
  },
  {
    "code": "the-forge-blueprints",
    "changes": {
      "intro_md": {
        "expected_md5": "de7d72a6b2165ccf3a1018859228f7f1",
        "value": "Blueprints unlock special crafting goals in The Forge. Their routes include events, questlines, hidden vendors and shops such as Fungi's. Check whether you can still obtain the blueprint before farming materials for its gear."
      }
    }
  },
  {
    "code": "the-forge-enemies",
    "changes": {
      "intro_md": {
        "expected_md5": "f3875de0e226df693637b61f477daea7",
        "value": "Enemies in The Forge test your gear and supply Gold, XP, essences and other drops. Their health, damage and rewards decide whether an area is worth farming. Choose a target for the material you need as well as the fight you can survive."
      }
    }
  },
  {
    "code": "the-forge-essences",
    "changes": {
      "intro_md": {
        "expected_md5": "4a6fad01042de2b19a98d21920b2abf9",
        "value": "Essences drop from enemies and bosses and fuel equipment upgrades at the Enhancer in The Forge. Higher tiers support stronger gear, and enhancing far enough also matters for rune slots. Save valuable stacks for equipment you expect to keep."
      }
    }
  },
  {
    "code": "the-forge-locations",
    "changes": {
      "intro_md": {
        "expected_md5": "9f671a62cf8b61a45399fa95c372099c",
        "value": "Locations in The Forge determine the ores, enemies, NPCs and quest routes you can reach. Later islands and hidden areas change both the rewards and the gear you need to survive. Choose your destination around the material or unlock you are chasing."
      }
    }
  },
  {
    "code": "the-forge-npcs",
    "changes": {
      "intro_md": {
        "expected_md5": "5f32bc07601cee570ca211223999686a",
        "value": "NPCs run shops, teach systems and open progression routes in The Forge. Miner Fred handles pickaxe progression, Maria sells potions, and the Wizard helps with race rerolls and travel. The Enhancer and Runemaker matter when you start investing in equipment you want to keep."
      }
    }
  },
  {
    "code": "the-forge-ores",
    "changes": {
      "intro_md": {
        "expected_md5": "88d7b2f31cc23fcfe2ea0eb4b2044d99",
        "value": "Ores shape every weapon and armor craft in The Forge. Ore quantity helps determine weight class, while quality, multipliers and traits affect the result. Choose materials for the recipe you want before selling a rare find for Gold."
      }
    }
  },
  {
    "code": "the-forge-pickaxes",
    "changes": {
      "intro_md": {
        "expected_md5": "b7db09bb2bdf820931438cf49bd53294",
        "value": "Mining power decides which rocks you can break in The Forge, mining speed affects how quickly you farm, and luck helps you find better ores. Pickaxes come through shops, quests, hidden rooms and later-island objectives. Choose your next upgrade around the rocks you need to mine and the route you can reach."
      }
    }
  },
  {
    "code": "the-forge-potions",
    "changes": {
      "intro_md": {
        "expected_md5": "d114a441b078445264b3f5c097327728",
        "value": "Potions give short boosts to healing, damage, movement, mining speed or luck in The Forge. Maria's Shop is a common place to buy them. Save a strong consumable for a difficult fight or focused farming session so its duration does not run out while you wander."
      }
    }
  },
  {
    "code": "the-forge-quests",
    "changes": {
      "intro_md": {
        "expected_md5": "59ac5eb833b38c2dc377bc4ce4095394",
        "value": "Quests in The Forge unlock rooms, keys, equipment and later progression. Early tasks around Sensei Moro teach the basics, while chains tied to Bard, Goblin King and other NPCs lead into secrets and special rewards. The Lost Guitar route gives the Unknown Key, and Demon Skal's later chain leads to the Demonite Key."
      }
    }
  },
  {
    "code": "the-forge-races",
    "changes": {
      "intro_md": {
        "expected_md5": "e2175462eb1772176beb5fd82c64a7de",
        "value": "Races in The Forge change stats such as damage, health, movement, luck and stamina efficiency. You roll for a race rather than choosing one directly, and stronger options can be much rarer. Decide which bonus your build needs before spending rerolls on another attempt."
      }
    }
  },
  {
    "code": "the-forge-runes",
    "changes": {
      "intro_md": {
        "expected_md5": "7738a6fd5cb3dfdd175212cffa0ca0a7",
        "value": "Runes add combat, mining and utility effects to equipment in The Forge. They are gear-specific, so a pickaxe rune belongs on a pickaxe and a weapon rune belongs on a weapon. Save valuable runes for gear worth keeping once enhancement and slots become part of your build."
      }
    }
  },
  {
    "code": "the-forge-skills",
    "changes": {
      "intro_md": {
        "expected_md5": "1335e7476163e05a8bd0c5b94f233bb1",
        "value": "Skills are achievement-linked passive boosts equipped through the Achievements menu in The Forge. Mining, combat, forging and other milestones unlock bonuses such as mine power, damage, luck and movement speed. You can equip one skill boost at a time, so match it to the activity you are doing."
      }
    }
  },
  {
    "code": "the-forge-totems",
    "changes": {
      "intro_md": {
        "expected_md5": "8e13532056a6e0c699d27af151a658c6",
        "value": "Totems give short boosts to luck, damage, health sustain, XP or mining in The Forge. Their roughly five-minute duration makes timing important. Use one when you are ready for a focused farming route, difficult fight or progression push."
      }
    }
  },
  {
    "code": "the-forge-weapons",
    "changes": {
      "intro_md": {
        "expected_md5": "891a35c654d3d774d15c1ea59af6ec29",
        "value": "The Forge turns mined ores into weapons with different damage, speed and range. Mixing materials changes the likely result, and the percentage menu shows your odds before you commit. Plan the recipe before spending premium ore on a weapon your build cannot use well."
      }
    }
  },
  {
    "code": "unbox-asmr-crates",
    "changes": {
      "intro_md": {
        "expected_md5": "d60596c3accdaadf8755494d29776c89",
        "value": "Buy crates from the Unbox ASMR conveyor with Cash and open them for toys. Conveyor upgrades improve your chances of higher-rarity crates, so reinvesting early earnings can help you move beyond Common pulls."
      },
      "wiki_md": {
        "expected_md5": "0df3e52369b3f038282c3e9f938ac9da",
        "value": "Buy crates from the Unbox ASMR conveyor with Cash and open them for toys. Conveyor upgrades improve your chances of higher-rarity crates, so reinvesting early earnings can help you move beyond Common pulls."
      },
      "description_md": {
        "expected_md5": "acf14e4e4913a418b342082482da7406",
        "value": ""
      },
      "faq_json": {
        "expected": [
          {
            "a": "Start with the fields that change the player's decision: rarity, currency, How To Get, availability, Contents Notes, and card summary. Rarity helps with sorting, but source, effect, requirement, price, or availability usually explains the real value.",
            "q": "Which Unbox ASMR crates fields matter most?"
          },
          {
            "a": "Blank values mean that detail was not listed clearly for that entry. The item stays visible, but missing stats are not filled with guesses.",
            "q": "Why are some values blank?"
          },
          {
            "a": "Yes. A low-rarity item from an old event, removed shop, limited reward, or rare drop can be harder to get than a higher-rarity item that is still sold or farmed normally.",
            "q": "Can a low-rarity item still be hard to replace?"
          }
        ],
        "value": []
      }
    }
  },
  {
    "code": "unbox-asmr-toys",
    "changes": {
      "intro_md": {
        "expected_md5": "ab7916c1b8b9284f71cd60ada83edce5",
        "value": "ASMR toys earn Cash when you place them on your Unbox ASMR plot and interact with them. Chocolate Keyboard is an early option, while higher-rarity conveyor crates can give you toys such as Wax Taba Paw. Rebirth can remove toys, so plan around what you need to keep."
      },
      "wiki_md": {
        "expected_md5": "f7e6e485f9bc71b9f20afe6788c5b77f",
        "value": "ASMR toys earn Cash when you place them on your Unbox ASMR plot and interact with them. Chocolate Keyboard is an early option, while higher-rarity conveyor crates can give you toys such as Wax Taba Paw. Rebirth can remove toys, so plan around what you need to keep."
      },
      "description_md": {
        "expected_md5": "acf14e4e4913a418b342082482da7406",
        "value": ""
      },
      "faq_json": {
        "expected": [
          {
            "a": "Start with the fields that change the player's decision: rarity, source, Keeps On Rebirth, and card summary. Rarity helps with sorting, but source, effect, requirement, price, or availability usually explains the real value.",
            "q": "Which Unbox ASMR toys fields matter most?"
          },
          {
            "a": "Blank values mean that detail was not listed clearly for that entry. The item stays visible, but missing stats are not filled with guesses.",
            "q": "Why are some values blank?"
          },
          {
            "a": "Yes. A low-rarity item from an old event, removed shop, limited reward, or rare drop can be harder to get than a higher-rarity item that is still sold or farmed normally.",
            "q": "Can a low-rarity item still be hard to replace?"
          }
        ],
        "value": []
      }
    }
  },
  {
    "code": "unbox-asmr-weather-events",
    "changes": {
      "intro_md": {
        "expected_md5": "4bd52faeb70db8abfe8bfc76805d108a",
        "value": "Unbox ASMR weather creates short farming windows. Cash Rush doubles Cash, Luck doubles Conveyor Luck and Crate Luck, and Honey adds Honey Crates to the conveyor. Each lasts five minutes, so choose what to farm as soon as the event starts."
      },
      "wiki_md": {
        "expected_md5": "556d5f984b3eb4dee09cf26f4f084466",
        "value": "Unbox ASMR weather creates short farming windows. Cash Rush doubles Cash, Luck doubles Conveyor Luck and Crate Luck, and Honey adds Honey Crates to the conveyor. Each lasts five minutes, so choose what to farm as soon as the event starts."
      },
      "description_md": {
        "expected_md5": "acf14e4e4913a418b342082482da7406",
        "value": ""
      },
      "faq_json": {
        "expected": [
          {
            "a": "Start with the fields that change the player's decision: Boost, duration, effect, Visual, Affects, best use, and card summary. Rarity helps with sorting, but source, effect, requirement, price, or availability usually explains the real value.",
            "q": "Which Unbox ASMR weather events fields matter most?"
          },
          {
            "a": "Blank values mean that detail was not listed clearly for that entry. The item stays visible, but missing stats are not filled with guesses.",
            "q": "Why are some values blank?"
          },
          {
            "a": "Yes. A low-rarity item from an old event, removed shop, limited reward, or rare drop can be harder to get than a higher-rarity item that is still sold or farmed normally.",
            "q": "Can a low-rarity item still be hard to replace?"
          }
        ],
        "value": []
      }
    }
  },
  {
    "code": "untitled-boxing-game-emotes",
    "changes": {
      "intro_md": {
        "expected_md5": "e9a08004074d586e69819b83782a8dea",
        "value": "Emotes in Untitled Boxing Game differ in rarity, spin routes and special properties. Limited emotes depend on their availability, so the unlock route matters as much as the animation."
      }
    }
  },
  {
    "code": "untitled-boxing-game-gloves",
    "changes": {
      "intro_md": {
        "expected_md5": "68093f97af9cf51e9c10809d8db26e7d",
        "value": "Gloves in Untitled Boxing Game come through crate, ranked, event, Original and Beta routes. Their availability and obtainment route matter when you choose a cosmetic or plan a trade."
      }
    }
  },
  {
    "code": "untitled-boxing-game-knockout-effects",
    "changes": {
      "intro_md": {
        "expected_md5": "456942849462fa4bb3ed9f2d99709201",
        "value": "Knockout effects in Untitled Boxing Game are cosmetic animations that play when a fighter is dropped or finished. Default animations, daily-shop effects and limited event rewards have different unlock routes."
      }
    }
  },
  {
    "code": "untitled-boxing-game-styles",
    "changes": {
      "intro_md": {
        "expected_md5": "130b970759b922be3a1388c251193c63",
        "value": "Fighting styles in Untitled Boxing Game differ in rarity and spin odds. Check whether a style is obtainable before spending spins chasing it."
      }
    }
  },
  {
    "code": "untitled-boxing-game-titles",
    "changes": {
      "intro_md": {
        "expected_md5": "5898f74a0025ad624317a18373ff07fa",
        "value": "Titles in Untitled Boxing Game mark achievements, style progression and ranked play. Seasonal and special titles have their own requirements, so choose a title around the milestone you want to pursue."
      }
    }
  }
]
$repair$::jsonb) as r(code text, changes jsonb)
)
update public.wiki_collection_pages as page
set
  intro_md = case when repair.changes ? 'intro_md' and md5(page.intro_md) = repair.changes->'intro_md'->>'expected_md5'
    then repair.changes->'intro_md'->>'value' else page.intro_md end,
  wiki_md = case when repair.changes ? 'wiki_md' and md5(page.wiki_md) = repair.changes->'wiki_md'->>'expected_md5'
    then repair.changes->'wiki_md'->>'value' else page.wiki_md end,
  description_md = case when repair.changes ? 'description_md' and md5(page.description_md) = repair.changes->'description_md'->>'expected_md5'
    then repair.changes->'description_md'->>'value' else page.description_md end,
  faq_json = case when repair.changes ? 'faq_json' and page.faq_json = repair.changes->'faq_json'->'expected'
    then repair.changes->'faq_json'->'value' else page.faq_json end
from repairs as repair
where page.code = repair.code
  and (
    (repair.changes ? 'intro_md' and md5(page.intro_md) = repair.changes->'intro_md'->>'expected_md5')
    or (repair.changes ? 'wiki_md' and md5(page.wiki_md) = repair.changes->'wiki_md'->>'expected_md5')
    or (repair.changes ? 'description_md' and md5(page.description_md) = repair.changes->'description_md'->>'expected_md5')
    or (repair.changes ? 'faq_json' and page.faq_json = repair.changes->'faq_json'->'expected')
  );
