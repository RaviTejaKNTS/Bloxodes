-- Seed the San Andreas, Vice City, and current GTA Online checklist snapshots.
-- Each payload is linked to gta_games by slug. Re-running this migration keeps
-- stable item keys, removes stale rows, and republishes the same page safely.
begin;
do $seed$
declare
  payloads jsonb := $content$[
  {
    "game_slug": "gta-san-andreas",
    "slug": "gta-san-andreas",
    "title": "GTA San Andreas Checklist",
    "seo_title": null,
    "seo_description": "Track GTA San Andreas Story Mode completion with the required missions, asset work, vehicle challenges, races, schools, properties, imports, and collectibles.",
    "description_md": "Reach 100% in GTA San Andreas Story Mode by checking off the required missions and activities below. This route covers the original game and the console and PC Definitive Edition. GTA Online and multiplayer content are outside this board.\n\nMission and race counts vary between guides because some branches, cutscenes, and story-completed races are grouped differently. This board uses named tasks, keeps the required Zero RC, Wang Cars, and Caligula's strands in the route once, and links location-heavy collectibles to their separate pages. See the [GTA San Andreas wiki](/gta/wiki/gta-san-andreas) for the game hub.\n\nUse Pause Menu > Stats to confirm the game's own 100% counter. The progress bar tracks your checked tasks, so its percentage can differ from the weighted in-game total. Save regularly in the Definitive Edition, where crashes can still spoil a good afternoon.",
    "items": [
      {
        "key": "story-missions",
        "section_code": "1",
        "title": "Story missions",
        "description": "Complete every named Story Mode mission in this route, including the required Zero RC, Wang Cars, and Caligula's strands. See the [Story Missions collection](/gta/wiki/gta-san-andreas/story-missions) for mission details.",
        "is_required": false
      },
      {
        "key": "story-los-santos",
        "section_code": "1.1",
        "title": "Los Santos",
        "description": "Complete each named mission in this phase.",
        "is_required": false
      },
      {
        "key": "story-mission-001-in-the-beginning",
        "section_code": "1.1.1",
        "title": "In the Beginning",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-002-big-smoke",
        "section_code": "1.1.2",
        "title": "Big Smoke",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-003-sweet-and-kendl",
        "section_code": "1.1.3",
        "title": "Sweet & Kendl",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-004-ryder",
        "section_code": "1.1.4",
        "title": "Ryder",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-005-tagging-up-turf",
        "section_code": "1.1.5",
        "title": "Tagging Up Turf",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-006-cleaning-the-hood",
        "section_code": "1.1.6",
        "title": "Cleaning the Hood",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-007-drive-thru",
        "section_code": "1.1.7",
        "title": "Drive-Thru",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-008-nines-and-ak-s",
        "section_code": "1.1.8",
        "title": "Nines and AK's",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-009-drive-by",
        "section_code": "1.1.9",
        "title": "Drive-By",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-010-sweet-s-girl",
        "section_code": "1.1.10",
        "title": "Sweet's Girl",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-011-cesar-vialpando",
        "section_code": "1.1.11",
        "title": "Cesar Vialpando",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-012-og-loc",
        "section_code": "1.1.12",
        "title": "OG Loc",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-013-running-dog",
        "section_code": "1.1.13",
        "title": "Running Dog",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-014-wrong-side-of-the-tracks",
        "section_code": "1.1.14",
        "title": "Wrong Side of the Tracks",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-015-just-business",
        "section_code": "1.1.15",
        "title": "Just Business",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-016-home-invasion",
        "section_code": "1.1.16",
        "title": "Home Invasion",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-017-catalyst",
        "section_code": "1.1.17",
        "title": "Catalyst",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-018-robbing-uncle-sam",
        "section_code": "1.1.18",
        "title": "Robbing Uncle Sam",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-019-high-stakes-low-rider",
        "section_code": "1.1.19",
        "title": "High Stakes, Low-Rider",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-020-life-s-a-beach",
        "section_code": "1.1.20",
        "title": "Life's a Beach",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-021-madd-dogg-s-rhymes",
        "section_code": "1.1.21",
        "title": "Madd Dogg's Rhymes",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-022-management-issues",
        "section_code": "1.1.22",
        "title": "Management Issues",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-023-house-party",
        "section_code": "1.1.23",
        "title": "House Party",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-024-burning-desire",
        "section_code": "1.1.24",
        "title": "Burning Desire",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-025-gray-imports",
        "section_code": "1.1.25",
        "title": "Gray Imports",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-026-doberman",
        "section_code": "1.1.26",
        "title": "Doberman",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-027-los-sepulcros",
        "section_code": "1.1.27",
        "title": "Los Sepulcros",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-028-reuniting-the-families",
        "section_code": "1.1.28",
        "title": "Reuniting the Families",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-029-the-green-sabre",
        "section_code": "1.1.29",
        "title": "The Green Sabre",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-countryside",
        "section_code": "1.2",
        "title": "Countryside",
        "description": "Complete each named mission in this phase.",
        "is_required": false
      },
      {
        "key": "story-mission-030-badlands",
        "section_code": "1.2.1",
        "title": "Badlands",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-031-first-date",
        "section_code": "1.2.2",
        "title": "First Date",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-032-tanker-commander",
        "section_code": "1.2.3",
        "title": "Tanker Commander",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-033-body-harvest",
        "section_code": "1.2.4",
        "title": "Body Harvest",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-034-king-in-exile",
        "section_code": "1.2.5",
        "title": "King in Exile",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-035-first-base",
        "section_code": "1.2.6",
        "title": "First Base",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-036-local-liquor-store",
        "section_code": "1.2.7",
        "title": "Local Liquor Store",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-037-gone-courting",
        "section_code": "1.2.8",
        "title": "Gone Courting",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-038-against-all-odds",
        "section_code": "1.2.9",
        "title": "Against All Odds",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-039-made-in-heaven",
        "section_code": "1.2.10",
        "title": "Made in Heaven",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-040-small-town-bank",
        "section_code": "1.2.11",
        "title": "Small Town Bank",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-041-wu-zi-mu",
        "section_code": "1.2.12",
        "title": "Wu Zi Mu",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-042-farewell-my-love",
        "section_code": "1.2.13",
        "title": "Farewell, My Love...",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-043-are-you-going-to-san-fierro",
        "section_code": "1.2.14",
        "title": "Are You Going to San Fierro?",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-san-fierro",
        "section_code": "1.3",
        "title": "San Fierro",
        "description": "Complete each named mission in this phase.",
        "is_required": false
      },
      {
        "key": "story-mission-wear-flowers-in-your-hair",
        "section_code": "1.3.1",
        "title": "Wear Flowers in Your Hair",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-555-we-tip",
        "section_code": "1.3.2",
        "title": "555 We Tip",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-deconstruction",
        "section_code": "1.3.3",
        "title": "Deconstruction",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-air-raid",
        "section_code": "1.3.4",
        "title": "Air Raid",
        "description": "Start the required Zero RC mission strand. Complete Supply Lines... and New Model Army in this route as well.",
        "is_required": true
      },
      {
        "key": "story-mission-supply-lines",
        "section_code": "1.3.5",
        "title": "Supply Lines...",
        "description": "Complete this required Zero RC mission even though it is presented as an asset branch.",
        "is_required": true
      },
      {
        "key": "story-mission-new-model-army",
        "section_code": "1.3.6",
        "title": "New Model Army",
        "description": "Complete this required Zero RC mission to finish the Zero RC branch.",
        "is_required": true
      },
      {
        "key": "story-mission-photo-opportunity",
        "section_code": "1.3.7",
        "title": "Photo Opportunity",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-jizzy",
        "section_code": "1.3.8",
        "title": "Jizzy",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-t-bone-mendez",
        "section_code": "1.3.9",
        "title": "T-Bone Mendez",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-mike-toreno",
        "section_code": "1.3.10",
        "title": "Mike Toreno",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-mountain-cloud-boys",
        "section_code": "1.3.11",
        "title": "Mountain Cloud Boys",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-ran-fa-li",
        "section_code": "1.3.12",
        "title": "Ran Fa Li",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-lure",
        "section_code": "1.3.13",
        "title": "Lure",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-amphibious-assault",
        "section_code": "1.3.14",
        "title": "Amphibious Assault",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-the-da-nang-thang",
        "section_code": "1.3.15",
        "title": "The Da Nang Thang",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-outrider",
        "section_code": "1.3.16",
        "title": "Outrider",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-snail-trail",
        "section_code": "1.3.17",
        "title": "Snail Trail",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-ice-cold-killa",
        "section_code": "1.3.18",
        "title": "Ice Cold Killa",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-back-to-school",
        "section_code": "1.3.19",
        "title": "Back to School",
        "description": "Complete this required story mission, then use the Schools section to pass every school at bronze or better.",
        "is_required": true
      },
      {
        "key": "story-mission-pier-69",
        "section_code": "1.3.20",
        "title": "Pier 69",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-toreno-s-last-flight",
        "section_code": "1.3.21",
        "title": "Toreno's Last Flight",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-yay-ka-boom-boom",
        "section_code": "1.3.22",
        "title": "Yay Ka-Boom-Boom",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-zeroing-in",
        "section_code": "1.3.23",
        "title": "Zeroing In",
        "description": "Complete the first required Wang Cars mission. Test Drive, Customs Fast Track, and Puncture Wounds follow in this route.",
        "is_required": true
      },
      {
        "key": "story-mission-test-drive",
        "section_code": "1.3.24",
        "title": "Test Drive",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-customs-fast-track",
        "section_code": "1.3.25",
        "title": "Customs Fast Track",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-puncture-wounds",
        "section_code": "1.3.26",
        "title": "Puncture Wounds",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-desert",
        "section_code": "1.4",
        "title": "Desert and Verdant Meadows",
        "description": "Complete each named mission in this phase.",
        "is_required": false
      },
      {
        "key": "story-mission-066-monster",
        "section_code": "1.4.1",
        "title": "Monster",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-067-highjack",
        "section_code": "1.4.2",
        "title": "Highjack",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-068-interdiction",
        "section_code": "1.4.3",
        "title": "Interdiction",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-069-verdant-meadows",
        "section_code": "1.4.4",
        "title": "Verdant Meadows",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-070-learning-to-fly",
        "section_code": "1.4.5",
        "title": "Learning to Fly",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-071-n-o-e",
        "section_code": "1.4.6",
        "title": "N.O.E.",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-072-stowaway",
        "section_code": "1.4.7",
        "title": "Stowaway",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-073-black-project",
        "section_code": "1.4.8",
        "title": "Black Project",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-074-green-goo",
        "section_code": "1.4.9",
        "title": "Green Goo",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-las-venturas",
        "section_code": "1.5",
        "title": "Las Venturas",
        "description": "Complete each named mission in this phase.",
        "is_required": false
      },
      {
        "key": "story-mission-075-fender-ketchup",
        "section_code": "1.5.1",
        "title": "Fender Ketchup",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-076-explosive-situation",
        "section_code": "1.5.2",
        "title": "Explosive Situation",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-077-you-ve-had-your-chips",
        "section_code": "1.5.3",
        "title": "You've Had Your Chips",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-078-don-peyote",
        "section_code": "1.5.4",
        "title": "Don Peyote",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-079-architectural-espionage",
        "section_code": "1.5.5",
        "title": "Architectural Espionage",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-080-key-to-her-heart",
        "section_code": "1.5.6",
        "title": "Key to Her Heart",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-081-dam-and-blast",
        "section_code": "1.5.7",
        "title": "Dam and Blast",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-082-cop-wheels",
        "section_code": "1.5.8",
        "title": "Cop Wheels",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-083-up-up-and-away",
        "section_code": "1.5.9",
        "title": "Up, Up and Away!",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-084-intensive-care",
        "section_code": "1.5.10",
        "title": "Intensive Care",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-085-the-meat-business",
        "section_code": "1.5.11",
        "title": "The Meat Business",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-086-fish-in-a-barrel",
        "section_code": "1.5.12",
        "title": "Fish in a Barrel",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-087-madd-dogg",
        "section_code": "1.5.13",
        "title": "Madd Dogg",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-088-freefall",
        "section_code": "1.5.14",
        "title": "Freefall",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-089-misappropriation",
        "section_code": "1.5.15",
        "title": "Misappropriation",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-090-high-noon",
        "section_code": "1.5.16",
        "title": "High Noon",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-091-saint-mark-s-bistro",
        "section_code": "1.5.17",
        "title": "Saint Mark's Bistro",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-092-breaking-the-bank-at-caligula-s",
        "section_code": "1.5.18",
        "title": "Breaking the Bank at Caligula's",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-093-a-home-in-the-hills",
        "section_code": "1.5.19",
        "title": "A Home in the Hills",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-return-los-santos",
        "section_code": "1.6",
        "title": "Return to Los Santos",
        "description": "Complete each named mission in this phase.",
        "is_required": false
      },
      {
        "key": "story-mission-094-vertical-bird",
        "section_code": "1.6.1",
        "title": "Vertical Bird",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-095-home-coming",
        "section_code": "1.6.2",
        "title": "Home Coming",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-096-cut-throat-business",
        "section_code": "1.6.3",
        "title": "Cut Throat Business",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-097-beat-down-on-b-dup",
        "section_code": "1.6.4",
        "title": "Beat Down on B Dup",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-098-grove-4-life",
        "section_code": "1.6.5",
        "title": "Grove 4 Life",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-099-riot",
        "section_code": "1.6.6",
        "title": "Riot",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-100-los-desperados",
        "section_code": "1.6.7",
        "title": "Los Desperados",
        "description": null,
        "is_required": true
      },
      {
        "key": "story-mission-101-end-of-the-line",
        "section_code": "1.6.8",
        "title": "End of the Line",
        "description": null,
        "is_required": true
      },
      {
        "key": "assets-and-businesses",
        "section_code": "2",
        "title": "Assets and businesses",
        "description": "Complete the required asset missions and buy the three required businesses. Zero RC and Wang Cars mission work is already listed once in Story missions.",
        "is_required": false
      },
      {
        "key": "courier-assets",
        "section_code": "2.1",
        "title": "Courier assets",
        "description": "Finish all four levels at each courier location.",
        "is_required": false
      },
      {
        "key": "courier-robois-food-mart",
        "section_code": "2.1.1",
        "title": "Complete Roboi's Food Mart courier levels",
        "description": "Complete all four levels at Roboi's Food Mart in Los Santos.",
        "is_required": true
      },
      {
        "key": "courier-hippy-shopper",
        "section_code": "2.1.2",
        "title": "Complete Hippy Shopper courier levels",
        "description": "Complete all four levels at Hippy Shopper in San Fierro.",
        "is_required": true
      },
      {
        "key": "courier-burger-shot",
        "section_code": "2.1.3",
        "title": "Complete Burger Shot courier levels",
        "description": "Complete all four levels at Burger Shot in Las Venturas.",
        "is_required": true
      },
      {
        "key": "other-asset-missions",
        "section_code": "2.2",
        "title": "Other asset missions",
        "description": "These mission chains have a fixed number of levels.",
        "is_required": false
      },
      {
        "key": "trucking-missions",
        "section_code": "2.2.1",
        "title": "Complete all 8 Trucking missions",
        "description": "Finish all eight RS Haul trucking missions.",
        "is_required": true
      },
      {
        "key": "quarry-missions",
        "section_code": "2.2.2",
        "title": "Complete all 7 Quarry missions",
        "description": "Finish all seven Hunter Quarry missions.",
        "is_required": true
      },
      {
        "key": "valet-missions",
        "section_code": "2.2.3",
        "title": "Complete all 5 Valet missions",
        "description": "Finish all five Vank Hoff Hotel valet levels.",
        "is_required": true
      },
      {
        "key": "business-purchases",
        "section_code": "2.3",
        "title": "Required business purchases",
        "description": "Buy each business below. These purchases are separate from the mission rows that unlock or use them.",
        "is_required": false
      },
      {
        "key": "buy-zero-rc-shop",
        "section_code": "2.3.1",
        "title": "Buy the Zero RC Shop",
        "description": "Purchase the Zero RC Shop for $30,000.",
        "is_required": true
      },
      {
        "key": "buy-wang-cars",
        "section_code": "2.3.2",
        "title": "Buy Wang Cars",
        "description": "Purchase Wang Cars for $50,000.",
        "is_required": true
      },
      {
        "key": "buy-verdant-meadows-airfield",
        "section_code": "2.3.3",
        "title": "Buy Verdant Meadows Airfield",
        "description": "Purchase Verdant Meadows Airfield for $80,000.",
        "is_required": true
      },
      {
        "key": "vehicle-missions",
        "section_code": "3",
        "title": "Vehicle missions",
        "description": "Reach the listed level targets. Continuous-run requirements are called out in each task.",
        "is_required": false
      },
      {
        "key": "vehicle-sub-missions",
        "section_code": "3.1",
        "title": "Vehicle sub-missions",
        "description": "Complete all six required vehicle sub-mission types.",
        "is_required": false
      },
      {
        "key": "firefighter-level-12",
        "section_code": "3.1.1",
        "title": "Complete Firefighter level 12",
        "description": "Reach and complete level 12 in one continuous run.",
        "is_required": true
      },
      {
        "key": "freight-train-level-2",
        "section_code": "3.1.2",
        "title": "Complete Freight Train level 2",
        "description": "Reach and complete both Freight Train levels.",
        "is_required": true
      },
      {
        "key": "paramedic-level-12",
        "section_code": "3.1.3",
        "title": "Complete Paramedic level 12",
        "description": "Reach and complete level 12 in one continuous run.",
        "is_required": true
      },
      {
        "key": "pimping-level-10",
        "section_code": "3.1.4",
        "title": "Complete Pimping level 10",
        "description": "Reach and complete level 10 in one continuous run.",
        "is_required": true
      },
      {
        "key": "taxi-50-fares",
        "section_code": "3.1.5",
        "title": "Complete 50 Taxi fares",
        "description": "Complete 50 fares in total. The fares can be cumulative.",
        "is_required": true
      },
      {
        "key": "vigilante-level-12",
        "section_code": "3.1.6",
        "title": "Complete Vigilante level 12",
        "description": "Reach and complete level 12 in one continuous run.",
        "is_required": true
      },
      {
        "key": "vehicle-challenges",
        "section_code": "3.2",
        "title": "Vehicle challenges",
        "description": "Complete every hidden vehicle challenge below.",
        "is_required": false
      },
      {
        "key": "bmx-challenge",
        "section_code": "3.2.1",
        "title": "Complete the BMX Challenge",
        "description": "Collect all 19 coronas.",
        "is_required": true
      },
      {
        "key": "nrg-500-challenge",
        "section_code": "3.2.2",
        "title": "Complete the NRG-500 Challenge",
        "description": "Collect all 18 coronas.",
        "is_required": true
      },
      {
        "key": "chiliad-challenge",
        "section_code": "3.2.3",
        "title": "Complete the Chiliad Challenge",
        "description": "Win all three courses: Scotch Bonnet, Birdseye Winder, and Cobra Run.",
        "is_required": true
      },
      {
        "key": "races-and-stadiums",
        "section_code": "4",
        "title": "Races and stadiums",
        "description": "Win the named race events and meet each stadium threshold. The Lowrider Race, Badlands A, and Badlands B are completed by required story missions, so they are represented there and are not repeated below.",
        "is_required": false
      },
      {
        "key": "races-los-santos-races",
        "section_code": "4.1",
        "title": "Los Santos races",
        "description": "Win each race in this location.",
        "is_required": false
      },
      {
        "key": "race-little-loop",
        "section_code": "4.1.1",
        "title": "Little Loop",
        "description": "Win this street race.",
        "is_required": true
      },
      {
        "key": "race-backroad-wanderer",
        "section_code": "4.1.2",
        "title": "Backroad Wanderer",
        "description": "Win this street race.",
        "is_required": true
      },
      {
        "key": "race-city-circuit",
        "section_code": "4.1.3",
        "title": "City Circuit",
        "description": "Win this street race.",
        "is_required": true
      },
      {
        "key": "race-vinewood",
        "section_code": "4.1.4",
        "title": "Vinewood",
        "description": "Win this street race.",
        "is_required": true
      },
      {
        "key": "race-freeway",
        "section_code": "4.1.5",
        "title": "Freeway",
        "description": "Win this street race.",
        "is_required": true
      },
      {
        "key": "race-into-the-country",
        "section_code": "4.1.6",
        "title": "Into the Country",
        "description": "Win this street race.",
        "is_required": true
      },
      {
        "key": "races-san-fierro-races",
        "section_code": "4.2",
        "title": "San Fierro races",
        "description": "Win each race in this location.",
        "is_required": false
      },
      {
        "key": "race-dirtbike-danger",
        "section_code": "4.2.1",
        "title": "Dirtbike Danger",
        "description": "Win this street race.",
        "is_required": true
      },
      {
        "key": "race-bandito-county",
        "section_code": "4.2.2",
        "title": "Bandito County",
        "description": "Win this street race.",
        "is_required": true
      },
      {
        "key": "race-go-go-karting",
        "section_code": "4.2.3",
        "title": "Go-Go Karting",
        "description": "Win this street race.",
        "is_required": true
      },
      {
        "key": "race-san-fierro-fastlane",
        "section_code": "4.2.4",
        "title": "San Fierro Fastlane",
        "description": "Win this street race.",
        "is_required": true
      },
      {
        "key": "race-san-fierro-hills",
        "section_code": "4.2.5",
        "title": "San Fierro Hills",
        "description": "Win this street race.",
        "is_required": true
      },
      {
        "key": "race-country-endurance",
        "section_code": "4.2.6",
        "title": "Country Endurance",
        "description": "Win this street race.",
        "is_required": true
      },
      {
        "key": "races-las-venturas-races",
        "section_code": "4.3",
        "title": "Las Venturas races",
        "description": "Win each race in this location.",
        "is_required": false
      },
      {
        "key": "race-sf-to-lv",
        "section_code": "4.3.1",
        "title": "SF to LV",
        "description": "Win this street race.",
        "is_required": true
      },
      {
        "key": "race-dam-rider",
        "section_code": "4.3.2",
        "title": "Dam Rider",
        "description": "Win this street race.",
        "is_required": true
      },
      {
        "key": "race-desert-tricks",
        "section_code": "4.3.3",
        "title": "Desert Tricks",
        "description": "Win this street race.",
        "is_required": true
      },
      {
        "key": "race-lv-ringroad",
        "section_code": "4.3.4",
        "title": "LV Ringroad",
        "description": "Win this street race.",
        "is_required": true
      },
      {
        "key": "airport-checkpoint-races",
        "section_code": "4.4",
        "title": "Las Venturas Airport checkpoint races",
        "description": "Complete all six aircraft checkpoint races.",
        "is_required": false
      },
      {
        "key": "airport-race-world-war-ace",
        "section_code": "4.4.1",
        "title": "World War Ace",
        "description": "Complete this Las Venturas Airport checkpoint race.",
        "is_required": true
      },
      {
        "key": "airport-race-barnstorming",
        "section_code": "4.4.2",
        "title": "Barnstorming",
        "description": "Complete this Las Venturas Airport checkpoint race.",
        "is_required": true
      },
      {
        "key": "airport-race-military-service",
        "section_code": "4.4.3",
        "title": "Military Service",
        "description": "Complete this Las Venturas Airport checkpoint race.",
        "is_required": true
      },
      {
        "key": "airport-race-chopper-checkpoint",
        "section_code": "4.4.4",
        "title": "Chopper Checkpoint",
        "description": "Complete this Las Venturas Airport checkpoint race.",
        "is_required": true
      },
      {
        "key": "airport-race-whirly-bird-waypoint",
        "section_code": "4.4.5",
        "title": "Whirly Bird Waypoint",
        "description": "Complete this Las Venturas Airport checkpoint race.",
        "is_required": true
      },
      {
        "key": "airport-race-heli-hell",
        "section_code": "4.4.6",
        "title": "Heli Hell",
        "description": "Complete this Las Venturas Airport checkpoint race.",
        "is_required": true
      },
      {
        "key": "stadium-events",
        "section_code": "4.5",
        "title": "Stadium events",
        "description": "Meet the listed result or score for each event.",
        "is_required": false
      },
      {
        "key": "stadium-8-track",
        "section_code": "4.5.1",
        "title": "Finish first in 8-Track",
        "description": "Place first in the 8-Track event.",
        "is_required": true
      },
      {
        "key": "stadium-blood-bowl",
        "section_code": "4.5.2",
        "title": "Complete Blood Bowl",
        "description": "Complete the first Blood Bowl event and meet its 60-second target.",
        "is_required": true
      },
      {
        "key": "stadium-dirt-track",
        "section_code": "4.5.3",
        "title": "Finish first in Dirt Track",
        "description": "Place first in the Dirt Track event.",
        "is_required": true
      },
      {
        "key": "stadium-kickstart",
        "section_code": "4.5.4",
        "title": "Score 26 points in Kickstart",
        "description": "Score at least 26 points in the Kickstart event.",
        "is_required": true
      },
      {
        "key": "schools-gun-gyms",
        "section_code": "5",
        "title": "Schools, gun range, and gyms",
        "description": "Pass the required schools at bronze or better, finish the four Ammu-Nation weapon challenges, and learn all three fighting styles.",
        "is_required": false
      },
      {
        "key": "vehicle-schools",
        "section_code": "5.1",
        "title": "Vehicle schools",
        "description": "Earn at least bronze in every test at each school. Mobile editions may omit or rename a few tests.",
        "is_required": false
      },
      {
        "key": "driving-school-bronze",
        "section_code": "5.1.1",
        "title": "Earn bronze in all Driving School tests",
        "description": "Earn at least bronze in all 12 Driving School tests.",
        "is_required": true
      },
      {
        "key": "boat-school-bronze",
        "section_code": "5.1.2",
        "title": "Earn bronze in all Boat School tests",
        "description": "Earn at least bronze in all 5 Boat School tests.",
        "is_required": true
      },
      {
        "key": "bike-school-bronze",
        "section_code": "5.1.3",
        "title": "Earn bronze in all Bike School tests",
        "description": "Earn at least bronze in all 6 Bike School tests.",
        "is_required": true
      },
      {
        "key": "flight-school-bronze",
        "section_code": "5.1.4",
        "title": "Earn bronze in all Flight School tests",
        "description": "Earn at least bronze in all 10 Flight School tests. The flight school also gates the airfield story route.",
        "is_required": true
      },
      {
        "key": "ammu-nation-range",
        "section_code": "5.2",
        "title": "Ammu-Nation shooting range",
        "description": "Complete all three rounds for all four weapons in one session.",
        "is_required": false
      },
      {
        "key": "shooting-range-pistol",
        "section_code": "5.2.1",
        "title": "Complete the Pistol challenge",
        "description": "Complete all three rounds of the Pistol challenge. Complete all four weapon challenges in one session; the AK-47 challenge unlocks after Yay Ka-Boom-Boom.",
        "is_required": true
      },
      {
        "key": "shooting-range-micro-smg",
        "section_code": "5.2.2",
        "title": "Complete the Micro SMG challenge",
        "description": "Complete all three rounds of the Micro SMG challenge. Complete all four weapon challenges in one session; the AK-47 challenge unlocks after Yay Ka-Boom-Boom.",
        "is_required": true
      },
      {
        "key": "shooting-range-shotgun",
        "section_code": "5.2.3",
        "title": "Complete the Shotgun challenge",
        "description": "Complete all three rounds of the Shotgun challenge. Complete all four weapon challenges in one session; the AK-47 challenge unlocks after Yay Ka-Boom-Boom.",
        "is_required": true
      },
      {
        "key": "shooting-range-ak-47",
        "section_code": "5.2.4",
        "title": "Complete the AK-47 challenge",
        "description": "Complete all three rounds of the AK-47 challenge. Complete all four weapon challenges in one session; the AK-47 challenge unlocks after Yay Ka-Boom-Boom.",
        "is_required": true
      },
      {
        "key": "gym-styles",
        "section_code": "5.3",
        "title": "Gym fighting styles",
        "description": "Learn the fighting style taught at each gym. Gym equipment workouts are optional.",
        "is_required": false
      },
      {
        "key": "gym-ganton-boxing",
        "section_code": "5.3.1",
        "title": "Learn Boxing at Ganton Gym",
        "description": "Learn the Boxing style from the trainer at Ganton Gym.",
        "is_required": true
      },
      {
        "key": "gym-cobra-kung-fu",
        "section_code": "5.3.2",
        "title": "Learn Kung Fu at Cobra Martial Arts Gym",
        "description": "Learn the Kung Fu style from the trainer at Cobra Martial Arts Gym.",
        "is_required": true
      },
      {
        "key": "gym-below-the-belt-muay-thai",
        "section_code": "5.3.3",
        "title": "Learn Muay Thai at Below the Belt Gym",
        "description": "Learn the Muay Thai style from the trainer at Below the Belt Gym.",
        "is_required": true
      },
      {
        "key": "import-export",
        "section_code": "6",
        "title": "Import/export",
        "description": "Deliver all 30 requested vehicles across the three Easter Basin Docks lists.",
        "is_required": false
      },
      {
        "key": "import-export-lists",
        "section_code": "6.1",
        "title": "Easter Basin Docks lists",
        "description": "Complete every list below. Each list contains ten vehicles.",
        "is_required": false
      },
      {
        "key": "import-export-list-1",
        "section_code": "6.1.1",
        "title": "Complete Import/Export List 1",
        "description": "Deliver all 10 vehicles on List 1 to Easter Basin Docks.",
        "is_required": true
      },
      {
        "key": "import-export-list-2",
        "section_code": "6.1.2",
        "title": "Complete Import/Export List 2",
        "description": "Deliver all 10 vehicles on List 2 to Easter Basin Docks.",
        "is_required": true
      },
      {
        "key": "import-export-list-3",
        "section_code": "6.1.3",
        "title": "Complete Import/Export List 3",
        "description": "Deliver all 10 vehicles on List 3 to Easter Basin Docks.",
        "is_required": true
      },
      {
        "key": "properties-and-collectibles",
        "section_code": "7",
        "title": "Properties and collectibles",
        "description": "Buy the required safehouses and collect every Gang Tag, Snapshot, Horseshoe, and Oyster. Exact locations stay on the linked collection pages.",
        "is_required": false
      },
      {
        "key": "property-purchases",
        "section_code": "7.1",
        "title": "Property purchases",
        "description": "The safehouse roster includes free save points, but only the 29 listed purchases count here.",
        "is_required": false
      },
      {
        "key": "buy-29-safehouses-and-hotel-suites",
        "section_code": "7.1.1",
        "title": "Purchase all 29 safehouses and hotel suites",
        "description": "Buy all 24 required safehouses and 5 hotel suites. The 8 automatically unlocked save points in the 37-row [Safehouses collection](/gta/wiki/gta-san-andreas/safehouses) do not need a purchase.",
        "is_required": true
      },
      {
        "key": "collectibles",
        "section_code": "7.2",
        "title": "Collectibles",
        "description": "Use the linked Bloxodes collection pages for exact locations and item progress.",
        "is_required": false
      },
      {
        "key": "spray-100-gang-tags",
        "section_code": "7.2.1",
        "title": "Spray all 100 Gang Tags",
        "description": "Spray every tag after Tagging Up Turf. Track exact locations in the [Gang Tags collection](/gta/wiki/gta-san-andreas/gang-tags).",
        "is_required": true
      },
      {
        "key": "take-50-snapshots",
        "section_code": "7.2.2",
        "title": "Take all 50 Snapshots",
        "description": "Photograph all 50 Snapshot locations. Track exact locations in the [Snapshots collection](/gta/wiki/gta-san-andreas/snapshots).",
        "is_required": true
      },
      {
        "key": "collect-50-horseshoes",
        "section_code": "7.2.3",
        "title": "Collect all 50 Horseshoes",
        "description": "Collect all 50 Horseshoes in Las Venturas. Track exact locations in the [Horseshoes collection](/gta/wiki/gta-san-andreas/horseshoes).",
        "is_required": true
      },
      {
        "key": "collect-50-oysters",
        "section_code": "7.2.4",
        "title": "Collect all 50 Oysters",
        "description": "Collect all 50 Oysters across San Andreas. Track exact locations in the [Oysters collection](/gta/wiki/gta-san-andreas/oysters).",
        "is_required": true
      }
    ]
  },
  {
    "game_slug": "gta-vice-city",
    "slug": "gta-vice-city",
    "title": "GTA Vice City Checklist",
    "seo_title": null,
    "seo_description": "Track GTA Vice City Story Mode completion: missions, businesses, races, challenges, collectibles, properties, and the other objectives needed for 100%.",
    "description_md": "Reach 100% in GTA Vice City Story Mode by checking off the missions, businesses, side activities, properties, and collectibles below. This route covers the original 2002 game and the same durable completion set in later mobile and Definitive Edition versions.\n\nThe board counts semantic tasks, so its progress can differ from the game's weighted percentage. Use the in-game Stats and completion screen to confirm what your save has registered. In The Beginning... automatically triggers An Old Friend, and Autocide has double weight in some breakdowns.\n\nThe five harder Checkpoint Charlie repeats, the bus minigame, Keepie-Uppy, rating goals, and other achievement-only tasks are optional. GTA Online and Vice City Stories are separate games. See the [GTA Vice City wiki](/gta/wiki/gta-vice-city) for the supporting mission and location collections.",
    "items": [
      {
        "key": "story-missions",
        "section_code": "1",
        "title": "Story missions",
        "description": "Complete every named story branch and both final missions. The Avery and Cortez branches are required for 100%, even though some are optional for reaching the finale. See the [mission list](/gta/wiki/gta-vice-city/missions) for full mission notes.",
        "is_required": false
      },
      {
        "key": "opening-and-early-jobs",
        "section_code": "1.1",
        "title": "Opening and early jobs",
        "description": null,
        "is_required": false
      },
      {
        "key": "opening-scenes",
        "section_code": "1.1.1",
        "title": "Complete the opening scenes",
        "description": "Finish In The Beginning... and the automatically triggered An Old Friend. These two scenes share one story credit.",
        "is_required": true
      },
      {
        "key": "the-party",
        "section_code": "1.1.2",
        "title": "The Party",
        "description": null,
        "is_required": true
      },
      {
        "key": "back-alley-brawl",
        "section_code": "1.1.3",
        "title": "Back Alley Brawl",
        "description": null,
        "is_required": true
      },
      {
        "key": "jury-fury",
        "section_code": "1.1.4",
        "title": "Jury Fury",
        "description": null,
        "is_required": true
      },
      {
        "key": "riot",
        "section_code": "1.1.5",
        "title": "Riot",
        "description": null,
        "is_required": true
      },
      {
        "key": "four-iron",
        "section_code": "1.1.6",
        "title": "Four Iron",
        "description": null,
        "is_required": true
      },
      {
        "key": "demolition-man",
        "section_code": "1.1.7",
        "title": "Demolition Man",
        "description": null,
        "is_required": true
      },
      {
        "key": "two-bit-hit",
        "section_code": "1.1.8",
        "title": "Two Bit Hit",
        "description": null,
        "is_required": true
      },
      {
        "key": "cortez-diaz-and-mainland",
        "section_code": "1.2",
        "title": "Cortez, Diaz, and the mainland",
        "description": null,
        "is_required": false
      },
      {
        "key": "treacherous-swine",
        "section_code": "1.2.1",
        "title": "Treacherous Swine",
        "description": null,
        "is_required": true
      },
      {
        "key": "mall-shootout",
        "section_code": "1.2.2",
        "title": "Mall Shootout",
        "description": null,
        "is_required": true
      },
      {
        "key": "guardian-angels",
        "section_code": "1.2.3",
        "title": "Guardian Angels",
        "description": null,
        "is_required": true
      },
      {
        "key": "the-chase",
        "section_code": "1.2.4",
        "title": "The Chase",
        "description": null,
        "is_required": true
      },
      {
        "key": "phnom-penh-86",
        "section_code": "1.2.5",
        "title": "Phnom Penh '86",
        "description": null,
        "is_required": true
      },
      {
        "key": "the-fastest-boat",
        "section_code": "1.2.6",
        "title": "The Fastest Boat",
        "description": null,
        "is_required": true
      },
      {
        "key": "supply-and-demand",
        "section_code": "1.2.7",
        "title": "Supply & Demand",
        "description": null,
        "is_required": true
      },
      {
        "key": "sir-yes-sir",
        "section_code": "1.2.8",
        "title": "Sir, Yes Sir!",
        "description": null,
        "is_required": true
      },
      {
        "key": "death-row",
        "section_code": "1.2.9",
        "title": "Death Row",
        "description": null,
        "is_required": true
      },
      {
        "key": "all-hands-on-deck",
        "section_code": "1.2.10",
        "title": "All Hands on Deck!",
        "description": null,
        "is_required": true
      },
      {
        "key": "rub-out",
        "section_code": "1.2.11",
        "title": "Rub Out",
        "description": null,
        "is_required": true
      },
      {
        "key": "final-missions",
        "section_code": "1.3",
        "title": "Final missions",
        "description": null,
        "is_required": false
      },
      {
        "key": "cap-the-collector",
        "section_code": "1.3.1",
        "title": "Cap the Collector",
        "description": "Complete this mission after the business requirements open the final chapter.",
        "is_required": true
      },
      {
        "key": "keep-your-friends-close",
        "section_code": "1.3.2",
        "title": "Keep Your Friends Close...",
        "description": "Complete the final mission.",
        "is_required": true
      },
      {
        "key": "gang-missions",
        "section_code": "2",
        "title": "Gang missions",
        "description": "Complete all 13 missions for Umberto Robina, Auntie Poulet, Love Fist, and Mitch Baker. These contact branches count toward 100%.",
        "is_required": false
      },
      {
        "key": "umberto-robina",
        "section_code": "2.1",
        "title": "Umberto Robina",
        "description": null,
        "is_required": false
      },
      {
        "key": "stunt-boat-challenge",
        "section_code": "2.1.1",
        "title": "Stunt Boat Challenge",
        "description": null,
        "is_required": true
      },
      {
        "key": "cannon-fodder",
        "section_code": "2.1.2",
        "title": "Cannon Fodder",
        "description": null,
        "is_required": true
      },
      {
        "key": "naval-engagement",
        "section_code": "2.1.3",
        "title": "Naval Engagement",
        "description": null,
        "is_required": true
      },
      {
        "key": "trojan-voodoo",
        "section_code": "2.1.4",
        "title": "Trojan Voodoo",
        "description": null,
        "is_required": true
      },
      {
        "key": "auntie-poulet",
        "section_code": "2.2",
        "title": "Auntie Poulet",
        "description": null,
        "is_required": false
      },
      {
        "key": "juju-scramble",
        "section_code": "2.2.1",
        "title": "Juju Scramble",
        "description": null,
        "is_required": true
      },
      {
        "key": "bombs-away",
        "section_code": "2.2.2",
        "title": "Bombs Away!",
        "description": null,
        "is_required": true
      },
      {
        "key": "dirty-lickins",
        "section_code": "2.2.3",
        "title": "Dirty Lickin's",
        "description": null,
        "is_required": true
      },
      {
        "key": "love-fist",
        "section_code": "2.3",
        "title": "Love Fist",
        "description": null,
        "is_required": false
      },
      {
        "key": "love-juice",
        "section_code": "2.3.1",
        "title": "Love Juice",
        "description": null,
        "is_required": true
      },
      {
        "key": "psycho-killer",
        "section_code": "2.3.2",
        "title": "Psycho Killer",
        "description": null,
        "is_required": true
      },
      {
        "key": "publicity-tour",
        "section_code": "2.3.3",
        "title": "Publicity Tour",
        "description": null,
        "is_required": true
      },
      {
        "key": "mitch-baker",
        "section_code": "2.4",
        "title": "Mitch Baker",
        "description": null,
        "is_required": false
      },
      {
        "key": "alloy-wheels-of-steel",
        "section_code": "2.4.1",
        "title": "Alloy Wheels of Steel",
        "description": null,
        "is_required": true
      },
      {
        "key": "messing-with-the-man",
        "section_code": "2.4.2",
        "title": "Messing with the Man",
        "description": null,
        "is_required": true
      },
      {
        "key": "hog-tied",
        "section_code": "2.4.3",
        "title": "Hog Tied",
        "description": null,
        "is_required": true
      },
      {
        "key": "assets-and-businesses",
        "section_code": "3",
        "title": "Assets and businesses",
        "description": "Buy all eight purchasable businesses and complete their required missions. Vercetti Estate and Phil's Place are automatic properties, so they have mission tasks but no purchase task. Use the [asset list](/gta/wiki/gta-vice-city/assets) for property details.",
        "is_required": false
      },
      {
        "key": "businesses-to-buy",
        "section_code": "3.1",
        "title": "Businesses to buy",
        "description": null,
        "is_required": false
      },
      {
        "key": "buy-viceport-boatyard",
        "section_code": "3.1.1",
        "title": "Buy Viceport Boatyard",
        "description": "Purchase Viceport Boatyard for $10,000.",
        "is_required": true
      },
      {
        "key": "buy-cherry-popper",
        "section_code": "3.1.2",
        "title": "Buy Cherry Popper Ice Cream Factory",
        "description": "Purchase Cherry Popper Ice Cream Factory for $20,000.",
        "is_required": true
      },
      {
        "key": "buy-pole-position-club",
        "section_code": "3.1.3",
        "title": "Buy Pole Position Club",
        "description": "Purchase Pole Position Club for $30,000.",
        "is_required": true
      },
      {
        "key": "buy-kaufman-cabs",
        "section_code": "3.1.4",
        "title": "Buy Kaufman Cabs",
        "description": "Purchase Kaufman Cabs for $40,000.",
        "is_required": true
      },
      {
        "key": "buy-sunshine-autos",
        "section_code": "3.1.5",
        "title": "Buy Sunshine Autos",
        "description": "Purchase Sunshine Autos for $50,000.",
        "is_required": true
      },
      {
        "key": "buy-interglobal-film-studio",
        "section_code": "3.1.6",
        "title": "Buy InterGlobal Film Studio",
        "description": "Purchase InterGlobal Film Studio for $60,000.",
        "is_required": true
      },
      {
        "key": "buy-print-works",
        "section_code": "3.1.7",
        "title": "Buy Print Works",
        "description": "Purchase Print Works for $70,000.",
        "is_required": true
      },
      {
        "key": "buy-malibu-club",
        "section_code": "3.1.8",
        "title": "Buy Malibu Club",
        "description": "Purchase Malibu Club for $120,000.",
        "is_required": true
      },
      {
        "key": "vercetti-estate-missions",
        "section_code": "3.2",
        "title": "Vercetti Estate missions",
        "description": "These three missions are the estate's required asset work and are also part of the takeover route.",
        "is_required": false
      },
      {
        "key": "shakedown",
        "section_code": "3.2.1",
        "title": "Shakedown",
        "description": null,
        "is_required": true
      },
      {
        "key": "bar-brawl",
        "section_code": "3.2.2",
        "title": "Bar Brawl",
        "description": null,
        "is_required": true
      },
      {
        "key": "cop-land",
        "section_code": "3.2.3",
        "title": "Cop Land",
        "description": null,
        "is_required": true
      },
      {
        "key": "pole-position-club",
        "section_code": "3.3",
        "title": "Pole Position Club",
        "description": null,
        "is_required": false
      },
      {
        "key": "spend-300-at-pole-position",
        "section_code": "3.3.1",
        "title": "Spend $300 at Pole Position",
        "description": "After buying the club, spend at least $300 in the private dance room.",
        "is_required": true
      },
      {
        "key": "boatyard",
        "section_code": "3.4",
        "title": "Boatyard",
        "description": null,
        "is_required": false
      },
      {
        "key": "checkpoint-charlie",
        "section_code": "3.4.1",
        "title": "Complete Checkpoint Charlie",
        "description": "Complete the first legitimate timed run. The five harder repeats are optional revenue challenges.",
        "is_required": true
      },
      {
        "key": "cherry-popper",
        "section_code": "3.5",
        "title": "Cherry Popper Ice Cream Factory",
        "description": null,
        "is_required": false
      },
      {
        "key": "distribution",
        "section_code": "3.5.1",
        "title": "Complete Distribution",
        "description": "Deliver 50 ice creams in one run.",
        "is_required": true
      },
      {
        "key": "sunshine-autos",
        "section_code": "3.6",
        "title": "Sunshine Autos",
        "description": "Complete all four Import Garage lists. The older one-list wording is not enough for the modern 100% route.",
        "is_required": false
      },
      {
        "key": "sunshine-import-list-1",
        "section_code": "3.6.1",
        "title": "Complete Sunshine Autos list 1",
        "description": "Finish every vehicle request in Import Garage List 1.",
        "is_required": true
      },
      {
        "key": "sunshine-import-list-2",
        "section_code": "3.6.2",
        "title": "Complete Sunshine Autos list 2",
        "description": "Finish every vehicle request in Import Garage List 2.",
        "is_required": true
      },
      {
        "key": "sunshine-import-list-3",
        "section_code": "3.6.3",
        "title": "Complete Sunshine Autos list 3",
        "description": "Finish every vehicle request in Import Garage List 3.",
        "is_required": true
      },
      {
        "key": "sunshine-import-list-4",
        "section_code": "3.6.4",
        "title": "Complete Sunshine Autos list 4",
        "description": "Finish every vehicle request in Import Garage List 4.",
        "is_required": true
      },
      {
        "key": "kaufman-cabs",
        "section_code": "3.7",
        "title": "Kaufman Cabs",
        "description": null,
        "is_required": false
      },
      {
        "key": "vip",
        "section_code": "3.7.1",
        "title": "V.I.P.",
        "description": null,
        "is_required": true
      },
      {
        "key": "friendly-rivalry",
        "section_code": "3.7.2",
        "title": "Friendly Rivalry",
        "description": null,
        "is_required": true
      },
      {
        "key": "cabmageddon",
        "section_code": "3.7.3",
        "title": "Cabmageddon",
        "description": null,
        "is_required": true
      },
      {
        "key": "interglobal-film-studio",
        "section_code": "3.8",
        "title": "InterGlobal Film Studio",
        "description": null,
        "is_required": false
      },
      {
        "key": "recruitment-drive",
        "section_code": "3.8.1",
        "title": "Recruitment Drive",
        "description": null,
        "is_required": true
      },
      {
        "key": "dildo-dodo",
        "section_code": "3.8.2",
        "title": "Dildo Dodo",
        "description": null,
        "is_required": true
      },
      {
        "key": "marthas-mug-shot",
        "section_code": "3.8.3",
        "title": "Martha's Mug Shot",
        "description": null,
        "is_required": true
      },
      {
        "key": "g-spotlight",
        "section_code": "3.8.4",
        "title": "G-Spotlight",
        "description": null,
        "is_required": true
      },
      {
        "key": "malibu-club",
        "section_code": "3.9",
        "title": "Malibu Club",
        "description": null,
        "is_required": false
      },
      {
        "key": "no-escape",
        "section_code": "3.9.1",
        "title": "No Escape?",
        "description": null,
        "is_required": true
      },
      {
        "key": "the-shootist",
        "section_code": "3.9.2",
        "title": "The Shootist",
        "description": null,
        "is_required": true
      },
      {
        "key": "the-driver",
        "section_code": "3.9.3",
        "title": "The Driver",
        "description": null,
        "is_required": true
      },
      {
        "key": "the-job",
        "section_code": "3.9.4",
        "title": "The Job",
        "description": null,
        "is_required": true
      },
      {
        "key": "phils-place",
        "section_code": "3.10",
        "title": "Phil's Place",
        "description": null,
        "is_required": false
      },
      {
        "key": "gun-runner",
        "section_code": "3.10.1",
        "title": "Gun Runner",
        "description": null,
        "is_required": true
      },
      {
        "key": "boomshine-saigon",
        "section_code": "3.10.2",
        "title": "Boomshine Saigon",
        "description": null,
        "is_required": true
      },
      {
        "key": "print-works",
        "section_code": "3.11",
        "title": "Print Works",
        "description": null,
        "is_required": false
      },
      {
        "key": "spilling-the-beans",
        "section_code": "3.11.1",
        "title": "Spilling the Beans",
        "description": null,
        "is_required": true
      },
      {
        "key": "hit-the-courier",
        "section_code": "3.11.2",
        "title": "Hit the Courier",
        "description": null,
        "is_required": true
      },
      {
        "key": "phone-assassinations",
        "section_code": "4",
        "title": "Phone assassinations",
        "description": "Complete all five named phone missions. Autocide is one mission task here, although the game's weighted counter gives it two points.",
        "is_required": false
      },
      {
        "key": "road-kill",
        "section_code": "4.0.1",
        "title": "Road Kill",
        "description": null,
        "is_required": true
      },
      {
        "key": "waste-the-wife",
        "section_code": "4.0.2",
        "title": "Waste the Wife",
        "description": null,
        "is_required": true
      },
      {
        "key": "autocide",
        "section_code": "4.0.3",
        "title": "Autocide",
        "description": "Complete this once as a named mission. It is weighted twice in some 100% breakdowns.",
        "is_required": true
      },
      {
        "key": "check-out-at-the-check-in",
        "section_code": "4.0.4",
        "title": "Check Out at the Check In",
        "description": null,
        "is_required": true
      },
      {
        "key": "loose-ends",
        "section_code": "4.0.5",
        "title": "Loose Ends",
        "description": null,
        "is_required": true
      },
      {
        "key": "activity-challenges",
        "section_code": "5",
        "title": "Vehicle and activity challenges",
        "description": "Finish each threshold, race, and challenge below. These are separate from the vehicle and chopper reference collections.",
        "is_required": false
      },
      {
        "key": "vehicle-missions",
        "section_code": "5.1",
        "title": "Vehicle missions",
        "description": null,
        "is_required": false
      },
      {
        "key": "firefighter-level-12",
        "section_code": "5.1.1",
        "title": "Reach level 12 in Firefighter",
        "description": "Complete level 12 in one run.",
        "is_required": true
      },
      {
        "key": "paramedic-level-12",
        "section_code": "5.1.2",
        "title": "Reach level 12 in Paramedic",
        "description": "Complete level 12 in one run.",
        "is_required": true
      },
      {
        "key": "vigilante-level-12",
        "section_code": "5.1.3",
        "title": "Reach level 12 in Vigilante",
        "description": "Complete level 12 in one run. Brown Thunder with the Hunter also counts.",
        "is_required": true
      },
      {
        "key": "pizza-boy-level-10",
        "section_code": "5.1.4",
        "title": "Reach level 10 in Pizza Boy",
        "description": "Complete level 10 in one run.",
        "is_required": true
      },
      {
        "key": "taxi-100-fares",
        "section_code": "5.1.5",
        "title": "Complete 100 taxi fares",
        "description": "Reach 100 total passengers across your taxi runs.",
        "is_required": true
      },
      {
        "key": "off-road-challenges",
        "section_code": "5.2",
        "title": "Off-road challenges",
        "description": null,
        "is_required": false
      },
      {
        "key": "cone-crazy",
        "section_code": "5.2.1",
        "title": "Complete Cone Crazy",
        "description": "Beat the course timer.",
        "is_required": true
      },
      {
        "key": "pcj-playground",
        "section_code": "5.2.2",
        "title": "Complete PCJ Playground",
        "description": "Finish the checkpoint course.",
        "is_required": true
      },
      {
        "key": "test-track",
        "section_code": "5.2.3",
        "title": "Complete Test Track",
        "description": "Finish the dirt-track course.",
        "is_required": true
      },
      {
        "key": "trial-by-dirt",
        "section_code": "5.2.4",
        "title": "Complete Trial By Dirt",
        "description": "Finish the dirt-track course.",
        "is_required": true
      },
      {
        "key": "rc-top-fun",
        "section_code": "5.3",
        "title": "RC Top Fun",
        "description": null,
        "is_required": false
      },
      {
        "key": "rc-bandit-race",
        "section_code": "5.3.1",
        "title": "Win RC Bandit Race",
        "description": "Win the RC Bandit race.",
        "is_required": true
      },
      {
        "key": "rc-baron-race",
        "section_code": "5.3.2",
        "title": "Win RC Baron Race",
        "description": "Win the RC Baron race.",
        "is_required": true
      },
      {
        "key": "rc-raider-pickup",
        "section_code": "5.3.3",
        "title": "Complete RC Raider Pickup",
        "description": "Collect every checkpoint. Some guides call this RC Raider Checkpoint.",
        "is_required": true
      },
      {
        "key": "street-races",
        "section_code": "5.4",
        "title": "Street races",
        "description": null,
        "is_required": false
      },
      {
        "key": "terminal-velocity",
        "section_code": "5.4.1",
        "title": "Win Terminal Velocity",
        "description": null,
        "is_required": true
      },
      {
        "key": "ocean-drive",
        "section_code": "5.4.2",
        "title": "Win Ocean Drive",
        "description": null,
        "is_required": true
      },
      {
        "key": "border-run",
        "section_code": "5.4.3",
        "title": "Win Border Run",
        "description": null,
        "is_required": true
      },
      {
        "key": "capital-cruise",
        "section_code": "5.4.4",
        "title": "Win Capital Cruise",
        "description": null,
        "is_required": true
      },
      {
        "key": "tour",
        "section_code": "5.4.5",
        "title": "Win Tour!",
        "description": null,
        "is_required": true
      },
      {
        "key": "vc-endurance",
        "section_code": "5.4.6",
        "title": "Win V.C. Endurance",
        "description": null,
        "is_required": true
      },
      {
        "key": "hyman-stadium",
        "section_code": "5.5",
        "title": "Hyman Stadium",
        "description": null,
        "is_required": false
      },
      {
        "key": "hotring",
        "section_code": "5.5.1",
        "title": "Win Hotring",
        "description": "Place first in the Hotring event.",
        "is_required": true
      },
      {
        "key": "bloodring",
        "section_code": "5.5.2",
        "title": "Survive Bloodring for 60 seconds",
        "description": "Stay in the event until the 60-second target is reached.",
        "is_required": true
      },
      {
        "key": "dirtring",
        "section_code": "5.5.3",
        "title": "Complete Dirtring",
        "description": "Collect the checkpoints before the timer runs out.",
        "is_required": true
      },
      {
        "key": "chopper-checkpoints",
        "section_code": "5.6",
        "title": "Chopper Checkpoints",
        "description": null,
        "is_required": false
      },
      {
        "key": "ocean-beach-chopper-checkpoint",
        "section_code": "5.6.1",
        "title": "Complete Ocean Beach Chopper Checkpoint",
        "description": null,
        "is_required": true
      },
      {
        "key": "vice-point-chopper-checkpoint",
        "section_code": "5.6.2",
        "title": "Complete Vice Point Chopper Checkpoint",
        "description": null,
        "is_required": true
      },
      {
        "key": "little-haiti-chopper-checkpoint",
        "section_code": "5.6.3",
        "title": "Complete Little Haiti Chopper Checkpoint",
        "description": null,
        "is_required": true
      },
      {
        "key": "downtown-chopper-checkpoint",
        "section_code": "5.6.4",
        "title": "Complete Downtown Chopper Checkpoint",
        "description": null,
        "is_required": true
      },
      {
        "key": "rifle-range",
        "section_code": "5.7",
        "title": "Rifle range",
        "description": null,
        "is_required": false
      },
      {
        "key": "rifle-range-45-hits",
        "section_code": "5.7.1",
        "title": "Score 45 hits at the rifle range",
        "description": "Score at least 45 hits in one game.",
        "is_required": true
      },
      {
        "key": "collectibles-properties-and-robberies",
        "section_code": "6",
        "title": "Collectibles, properties, and robberies",
        "description": "Finish the fixed collectible and exploration totals. Use the [Hidden Packages](/gta/wiki/gta-vice-city/hidden-packages), [Rampages](/gta/wiki/gta-vice-city/rampages), [Unique Stunt Jumps](/gta/wiki/gta-vice-city/unique-stunt-jumps), [Store Robberies](/gta/wiki/gta-vice-city/store-robberies), and [Safehouses](/gta/wiki/gta-vice-city/safehouses) collections for locations.",
        "is_required": false
      },
      {
        "key": "hidden-packages",
        "section_code": "6.1",
        "title": "Hidden Packages",
        "description": "Collect all 100 packages. The board uses ten milestones, while the collection keeps every location.",
        "is_required": false
      },
      {
        "key": "hidden-packages-1-10",
        "section_code": "6.1.1",
        "title": "Collect 10 hidden packages, batch 1 of 10",
        "description": "Collect any ten uncounted packages. This milestone covers packages 1 to 10 in the board's ten-batch model.",
        "is_required": true
      },
      {
        "key": "hidden-packages-11-20",
        "section_code": "6.1.2",
        "title": "Collect 10 hidden packages, batch 2 of 10",
        "description": "Collect any ten uncounted packages. This milestone covers packages 11 to 20 in the board's ten-batch model.",
        "is_required": true
      },
      {
        "key": "hidden-packages-21-30",
        "section_code": "6.1.3",
        "title": "Collect 10 hidden packages, batch 3 of 10",
        "description": "Collect any ten uncounted packages. This milestone covers packages 21 to 30 in the board's ten-batch model.",
        "is_required": true
      },
      {
        "key": "hidden-packages-31-40",
        "section_code": "6.1.4",
        "title": "Collect 10 hidden packages, batch 4 of 10",
        "description": "Collect any ten uncounted packages. This milestone covers packages 31 to 40 in the board's ten-batch model.",
        "is_required": true
      },
      {
        "key": "hidden-packages-41-50",
        "section_code": "6.1.5",
        "title": "Collect 10 hidden packages, batch 5 of 10",
        "description": "Collect any ten uncounted packages. This milestone covers packages 41 to 50 in the board's ten-batch model.",
        "is_required": true
      },
      {
        "key": "hidden-packages-51-60",
        "section_code": "6.1.6",
        "title": "Collect 10 hidden packages, batch 6 of 10",
        "description": "Collect any ten uncounted packages. This milestone covers packages 51 to 60 in the board's ten-batch model.",
        "is_required": true
      },
      {
        "key": "hidden-packages-61-70",
        "section_code": "6.1.7",
        "title": "Collect 10 hidden packages, batch 7 of 10",
        "description": "Collect any ten uncounted packages. This milestone covers packages 61 to 70 in the board's ten-batch model.",
        "is_required": true
      },
      {
        "key": "hidden-packages-71-80",
        "section_code": "6.1.8",
        "title": "Collect 10 hidden packages, batch 8 of 10",
        "description": "Collect any ten uncounted packages. This milestone covers packages 71 to 80 in the board's ten-batch model.",
        "is_required": true
      },
      {
        "key": "hidden-packages-81-90",
        "section_code": "6.1.9",
        "title": "Collect 10 hidden packages, batch 9 of 10",
        "description": "Collect any ten uncounted packages. This milestone covers packages 81 to 90 in the board's ten-batch model.",
        "is_required": true
      },
      {
        "key": "hidden-packages-91-100",
        "section_code": "6.1.10",
        "title": "Collect 10 hidden packages, batch 10 of 10",
        "description": "Collect any ten uncounted packages. This milestone covers packages 91 to 100 in the board's ten-batch model.",
        "is_required": true
      },
      {
        "key": "rampages",
        "section_code": "6.2",
        "title": "Rampages",
        "description": "All 35 rampages are required. The existing collection has each location.",
        "is_required": false
      },
      {
        "key": "all-35-rampages",
        "section_code": "6.2.1",
        "title": "Complete all 35 rampages",
        "description": "Complete every rampage across Vice City.",
        "is_required": true
      },
      {
        "key": "unique-stunt-jumps",
        "section_code": "6.3",
        "title": "Unique Stunt Jumps",
        "description": "Complete all 36 jumps. Use the existing collection for the exact locations.",
        "is_required": false
      },
      {
        "key": "unique-stunt-jump-1",
        "section_code": "6.3.1",
        "title": "Complete Unique Stunt Jump #1",
        "description": "Land the jump successfully.",
        "is_required": true
      },
      {
        "key": "unique-stunt-jump-2",
        "section_code": "6.3.2",
        "title": "Complete Unique Stunt Jump #2",
        "description": "Land the jump successfully.",
        "is_required": true
      },
      {
        "key": "unique-stunt-jump-3",
        "section_code": "6.3.3",
        "title": "Complete Unique Stunt Jump #3",
        "description": "Land the jump successfully.",
        "is_required": true
      },
      {
        "key": "unique-stunt-jump-4",
        "section_code": "6.3.4",
        "title": "Complete Unique Stunt Jump #4",
        "description": "Land the jump successfully.",
        "is_required": true
      },
      {
        "key": "unique-stunt-jump-5",
        "section_code": "6.3.5",
        "title": "Complete Unique Stunt Jump #5",
        "description": "Land the jump successfully.",
        "is_required": true
      },
      {
        "key": "unique-stunt-jump-6",
        "section_code": "6.3.6",
        "title": "Complete Unique Stunt Jump #6",
        "description": "Land the jump successfully.",
        "is_required": true
      },
      {
        "key": "unique-stunt-jump-7",
        "section_code": "6.3.7",
        "title": "Complete Unique Stunt Jump #7",
        "description": "Land the jump successfully.",
        "is_required": true
      },
      {
        "key": "unique-stunt-jump-8",
        "section_code": "6.3.8",
        "title": "Complete Unique Stunt Jump #8",
        "description": "Land the jump successfully.",
        "is_required": true
      },
      {
        "key": "unique-stunt-jump-9",
        "section_code": "6.3.9",
        "title": "Complete Unique Stunt Jump #9",
        "description": "Land the jump successfully.",
        "is_required": true
      },
      {
        "key": "unique-stunt-jump-10",
        "section_code": "6.3.10",
        "title": "Complete Unique Stunt Jump #10",
        "description": "Land the jump successfully.",
        "is_required": true
      },
      {
        "key": "unique-stunt-jump-11",
        "section_code": "6.3.11",
        "title": "Complete Unique Stunt Jump #11",
        "description": "Land the jump successfully.",
        "is_required": true
      },
      {
        "key": "unique-stunt-jump-12",
        "section_code": "6.3.12",
        "title": "Complete Unique Stunt Jump #12",
        "description": "Land the jump successfully.",
        "is_required": true
      },
      {
        "key": "unique-stunt-jump-13",
        "section_code": "6.3.13",
        "title": "Complete Unique Stunt Jump #13",
        "description": "Land the jump successfully.",
        "is_required": true
      },
      {
        "key": "unique-stunt-jump-14",
        "section_code": "6.3.14",
        "title": "Complete Unique Stunt Jump #14",
        "description": "Land the jump successfully.",
        "is_required": true
      },
      {
        "key": "unique-stunt-jump-15",
        "section_code": "6.3.15",
        "title": "Complete Unique Stunt Jump #15",
        "description": "Land the jump successfully.",
        "is_required": true
      },
      {
        "key": "unique-stunt-jump-16",
        "section_code": "6.3.16",
        "title": "Complete Unique Stunt Jump #16",
        "description": "Land the jump successfully.",
        "is_required": true
      },
      {
        "key": "unique-stunt-jump-17",
        "section_code": "6.3.17",
        "title": "Complete Unique Stunt Jump #17",
        "description": "Land the jump successfully.",
        "is_required": true
      },
      {
        "key": "unique-stunt-jump-18",
        "section_code": "6.3.18",
        "title": "Complete Unique Stunt Jump #18",
        "description": "Land the jump successfully.",
        "is_required": true
      },
      {
        "key": "unique-stunt-jump-19",
        "section_code": "6.3.19",
        "title": "Complete Unique Stunt Jump #19",
        "description": "Land the jump successfully.",
        "is_required": true
      },
      {
        "key": "unique-stunt-jump-20",
        "section_code": "6.3.20",
        "title": "Complete Unique Stunt Jump #20",
        "description": "Land the jump successfully.",
        "is_required": true
      },
      {
        "key": "unique-stunt-jump-21",
        "section_code": "6.3.21",
        "title": "Complete Unique Stunt Jump #21",
        "description": "Land the jump successfully.",
        "is_required": true
      },
      {
        "key": "unique-stunt-jump-22",
        "section_code": "6.3.22",
        "title": "Complete Unique Stunt Jump #22",
        "description": "Land the jump successfully.",
        "is_required": true
      },
      {
        "key": "unique-stunt-jump-23",
        "section_code": "6.3.23",
        "title": "Complete Unique Stunt Jump #23",
        "description": "Land the jump successfully.",
        "is_required": true
      },
      {
        "key": "unique-stunt-jump-24",
        "section_code": "6.3.24",
        "title": "Complete Unique Stunt Jump #24",
        "description": "Land the jump successfully.",
        "is_required": true
      },
      {
        "key": "unique-stunt-jump-25",
        "section_code": "6.3.25",
        "title": "Complete Unique Stunt Jump #25",
        "description": "Land the jump successfully.",
        "is_required": true
      },
      {
        "key": "unique-stunt-jump-26",
        "section_code": "6.3.26",
        "title": "Complete Unique Stunt Jump #26",
        "description": "Land the jump successfully.",
        "is_required": true
      },
      {
        "key": "unique-stunt-jump-27",
        "section_code": "6.3.27",
        "title": "Complete Unique Stunt Jump #27",
        "description": "Land the jump successfully.",
        "is_required": true
      },
      {
        "key": "unique-stunt-jump-28",
        "section_code": "6.3.28",
        "title": "Complete Unique Stunt Jump #28",
        "description": "Land the jump successfully.",
        "is_required": true
      },
      {
        "key": "unique-stunt-jump-29",
        "section_code": "6.3.29",
        "title": "Complete Unique Stunt Jump #29",
        "description": "Land the jump successfully.",
        "is_required": true
      },
      {
        "key": "unique-stunt-jump-30",
        "section_code": "6.3.30",
        "title": "Complete Unique Stunt Jump #30",
        "description": "Land the jump successfully.",
        "is_required": true
      },
      {
        "key": "unique-stunt-jump-31",
        "section_code": "6.3.31",
        "title": "Complete Unique Stunt Jump #31",
        "description": "Land the jump successfully.",
        "is_required": true
      },
      {
        "key": "unique-stunt-jump-32",
        "section_code": "6.3.32",
        "title": "Complete Unique Stunt Jump #32",
        "description": "Land the jump successfully.",
        "is_required": true
      },
      {
        "key": "unique-stunt-jump-33",
        "section_code": "6.3.33",
        "title": "Complete Unique Stunt Jump #33",
        "description": "Land the jump successfully.",
        "is_required": true
      },
      {
        "key": "unique-stunt-jump-34",
        "section_code": "6.3.34",
        "title": "Complete Unique Stunt Jump #34",
        "description": "Land the jump successfully.",
        "is_required": true
      },
      {
        "key": "unique-stunt-jump-35",
        "section_code": "6.3.35",
        "title": "Complete Unique Stunt Jump #35",
        "description": "Land the jump successfully.",
        "is_required": true
      },
      {
        "key": "unique-stunt-jump-36",
        "section_code": "6.3.36",
        "title": "Complete Unique Stunt Jump #36",
        "description": "Land the jump successfully.",
        "is_required": true
      },
      {
        "key": "store-robberies",
        "section_code": "6.4",
        "title": "Store Robberies",
        "description": "Rob all 15 listed stores. The existing collection keeps the exact locations.",
        "is_required": false
      },
      {
        "key": "all-15-store-robberies",
        "section_code": "6.4.1",
        "title": "Rob all 15 stores",
        "description": "Complete the robbery at each of the 15 listed stores.",
        "is_required": true
      },
      {
        "key": "purchasable-safehouses",
        "section_code": "6.5",
        "title": "Purchasable safehouses",
        "description": "Buy the seven properties that count toward 100%. Ocean View Hotel and Vercetti Estate are automatic properties.",
        "is_required": false
      },
      {
        "key": "ocean-heights-apartment",
        "section_code": "6.5.1",
        "title": "Buy Ocean Heights Apartment",
        "description": null,
        "is_required": true
      },
      {
        "key": "1102-washington-street",
        "section_code": "6.5.2",
        "title": "Buy 1102 Washington Street",
        "description": null,
        "is_required": true
      },
      {
        "key": "links-view-apartment",
        "section_code": "6.5.3",
        "title": "Buy Links View Apartment",
        "description": null,
        "is_required": true
      },
      {
        "key": "el-swanko-casa",
        "section_code": "6.5.4",
        "title": "Buy El Swanko Casa",
        "description": null,
        "is_required": true
      },
      {
        "key": "3321-vice-point",
        "section_code": "6.5.5",
        "title": "Buy 3321 Vice Point",
        "description": null,
        "is_required": true
      },
      {
        "key": "skumole-shack",
        "section_code": "6.5.6",
        "title": "Buy Skumole Shack",
        "description": null,
        "is_required": true
      },
      {
        "key": "hyman-condo",
        "section_code": "6.5.7",
        "title": "Buy Hyman Condo",
        "description": null,
        "is_required": true
      }
    ]
  },
  {
    "game_slug": "gta-online",
    "slug": "gta-online",
    "title": "GTA Online Career Progress Checklist",
    "seo_title": "GTA Online Career Progress Checklist",
    "seo_description": "Track source-verified GTA Online Career Progress challenges on PS5, Xbox Series X|S, and PC Enhanced in a dated 2026 snapshot.",
    "description_md": "Track the permanent Career Progress system in GTA Online with a source-verified snapshot checked on September 10, 2026. This board covers challenge cards and challenge sets Rockstar exposes for PS5, Xbox Series X|S, and PC Enhanced. Older console editions and PC Legacy do not have this Career Progress feature.\n\nCareer Progress is the closest finite target for GTA Online, but it is not a single game-wide 100% counter. Rockstar adds new content packs over time, and some cards remember earlier progress while others start clean. Check the Career tab in the pause menu or the [GTA Online wiki](/gta/wiki/gta-online) for your character's live status.\n\nThe page keeps Career Progress separate from Awards, weekly challenges, rotating bonuses, and the fixed collectible routes in the [GTA Online wiki](/gta/wiki/gta-online). A few recent update notices confirm a challenge set without publishing every card's wording, so those update rows stay grouped and carry their source note. The board is a manual tracker, with no Rockstar account sync.",
    "items": [
      {
        "key": "businesses-and-criminal-careers",
        "section_code": "1",
        "title": "Businesses and criminal careers",
        "description": "Complete the persistent Career Progress cards tied to businesses and long-term criminal operations. The source pages show four tiers, while the leaves below use only challenge wording verified in the public Rockstar snapshot.",
        "is_required": false
      },
      {
        "key": "gunrunning",
        "section_code": "1.1",
        "title": "Gunrunning",
        "description": "Career Progress is shown alongside the Gunrunning business details. The [GTA Online wiki](/gta/wiki/gta-online) keeps this strand separate from Awards.",
        "is_required": false
      },
      {
        "key": "gunrunning-set-up-bunker",
        "section_code": "1.1.1",
        "title": "Set up a Bunker",
        "description": "Complete the Gunrunning Tier 1 Career Progress challenge by setting up a Bunker.",
        "is_required": true
      },
      {
        "key": "gunrunning-resupply",
        "section_code": "1.1.2",
        "title": "Complete a Resupply mission",
        "description": "Complete one Gunrunning Resupply mission for the Tier 1 challenge.",
        "is_required": true
      },
      {
        "key": "gunrunning-research",
        "section_code": "1.1.3",
        "title": "Complete a research project",
        "description": "Finish one Bunker Research project for the Gunrunning Tier 1 challenge.",
        "is_required": true
      },
      {
        "key": "further-adventures-in-finance-and-felony",
        "section_code": "1.2",
        "title": "Further Adventures in Finance and Felony",
        "description": "Rockstar's Executive strand names these Tier 1 actions for the Career Progress board.",
        "is_required": false
      },
      {
        "key": "executive-become-ceo",
        "section_code": "1.2.1",
        "title": "Become the CEO of an Organization",
        "description": "Register as the CEO of your own Organization. Rockstar names this as one of the Tier 1 Career Progress actions.",
        "is_required": true
      },
      {
        "key": "executive-onboard-associate",
        "section_code": "1.2.2",
        "title": "Onboard an Associate",
        "description": "Hire or onboard an Associate for your Organization. This is one of Rockstar's named Tier 1 Executive Career Progress actions.",
        "is_required": true
      },
      {
        "key": "executive-vip-work",
        "section_code": "1.2.3",
        "title": "Complete a VIP Work mission",
        "description": "Launch and complete one VIP Work mission as an Executive. Rockstar lists it as the third Tier 1 action.",
        "is_required": true
      },
      {
        "key": "money-fronts",
        "section_code": "1.3",
        "title": "Money Fronts",
        "description": "Use the current Money Fronts business names and the in-game Career tab for the Tier 1 card text.",
        "is_required": false
      },
      {
        "key": "money-fronts-meet-mr-faber",
        "section_code": "1.3.1",
        "title": "Meet Mr Faber",
        "description": "Meet Mr Faber for the first Money Fronts Tier 1 Career Progress challenge.",
        "is_required": true
      },
      {
        "key": "money-fronts-acquire-car-wash",
        "section_code": "1.3.2",
        "title": "Acquire the Hands On Car Wash",
        "description": "Purchase the Hands On Car Wash, the central property in the Money Fronts operation.",
        "is_required": true
      },
      {
        "key": "money-fronts-complete-front-job",
        "section_code": "1.3.3",
        "title": "Complete a Money Fronts job",
        "description": "Complete any job at the Hands On Car Wash, Smoke on the Water, or Higgins Helitours. Rockstar treats these alternatives as one Tier 1 challenge.",
        "is_required": true
      },
      {
        "key": "the-contract",
        "section_code": "1.4",
        "title": "The Contract",
        "description": "The Contract strand lists the Tier 1 Career Progress challenges below.",
        "is_required": false
      },
      {
        "key": "the-contract-set-up-agency",
        "section_code": "1.4.1",
        "title": "Set up the Agency",
        "description": "Set up an Agency for The Contract Tier 1 Career Progress challenge.",
        "is_required": true
      },
      {
        "key": "the-contract-security-contract",
        "section_code": "1.4.2",
        "title": "Complete a Security Contract",
        "description": "Complete one Security Contract from your Agency.",
        "is_required": true
      },
      {
        "key": "the-contract-meet-vip",
        "section_code": "1.4.3",
        "title": "Meet the VIP",
        "description": "Meet the VIP for The Contract Tier 1 Career Progress challenge.",
        "is_required": true
      },
      {
        "key": "the-chop-shop",
        "section_code": "1.5",
        "title": "The Chop Shop",
        "description": "The Chop Shop strand lists the current Tier 1 Salvage Yard challenges below.",
        "is_required": false
      },
      {
        "key": "chop-shop-set-up-salvage-yard",
        "section_code": "1.5.1",
        "title": "Set up a Salvage Yard",
        "description": "Acquire and set up a Salvage Yard for The Chop Shop Tier 1 Career Progress challenge.",
        "is_required": true
      },
      {
        "key": "chop-shop-meet-yusuf-amir",
        "section_code": "1.5.2",
        "title": "Meet with Yusuf Amir",
        "description": "Meet Yusuf Amir to begin the Salvage Yard operation.",
        "is_required": true
      },
      {
        "key": "chop-shop-salvage-yard-robbery",
        "section_code": "1.5.3",
        "title": "Complete a Salvage Yard Robbery",
        "description": "Complete one Salvage Yard Robbery from the Planning Wall.",
        "is_required": true
      },
      {
        "key": "heists-and-specialist-operations",
        "section_code": "2",
        "title": "Heists and specialist operations",
        "description": "Track persistent operation cards and their tier progression. Prep work, property gates, player-count rules, and difficulty conditions stay in the card description when Rockstar states them.",
        "is_required": false
      },
      {
        "key": "cayo-perico-heist",
        "section_code": "2.1",
        "title": "The Cayo Perico Heist",
        "description": "Use the [GTA Online heists guide](/gta/wiki/gta-online/heists) for the operation, then use the Career tab for its three public Tier 1 challenge cards. Awards are separate and excluded here.",
        "is_required": false
      },
      {
        "key": "cayo-perico-meet-miguel",
        "section_code": "2.1.1",
        "title": "Meet Miguel Madrazo in The Music Locker",
        "description": "Meet Miguel Madrazo inside The Music Locker for the first Cayo Perico Tier 1 Career Progress challenge.",
        "is_required": true
      },
      {
        "key": "cayo-perico-set-up-kosatka",
        "section_code": "2.1.2",
        "title": "Set up a Kosatka",
        "description": "Set up a Kosatka submarine for The Cayo Perico Heist.",
        "is_required": true
      },
      {
        "key": "cayo-perico-find-madrazo-files",
        "section_code": "2.1.3",
        "title": "Find the Madrazo files",
        "description": "Find where the Madrazo files are being held during the Cayo Perico setup route.",
        "is_required": true
      },
      {
        "key": "a-superyacht-life",
        "section_code": "2.2",
        "title": "A Superyacht Life",
        "description": "Rockstar's A Superyacht Life strand confirms this Tier 1 action and the four-tier Career Progress route.",
        "is_required": false
      },
      {
        "key": "superyacht-complete-mission",
        "section_code": "2.2.1",
        "title": "Complete an A Superyacht Life mission",
        "description": "Complete any A Superyacht Life mission. Rockstar names this as the Tier 1 action and the Captain Cap reward trigger.",
        "is_required": true
      },
      {
        "key": "geralds-last-play",
        "section_code": "2.3",
        "title": "Gerald's Last Play",
        "description": "Gerald's Last Play lists one public Tier 1 Career Progress challenge.",
        "is_required": false
      },
      {
        "key": "geralds-last-play-mission",
        "section_code": "2.3.1",
        "title": "Complete a Last Play mission for Gerald",
        "description": "Complete one Last Play mission for Gerald.",
        "is_required": true
      },
      {
        "key": "series-and-contact-modes",
        "section_code": "3",
        "title": "Series and contact modes",
        "description": "These cards are broad entry challenges. The mode page defines the activity, while the Career Progress card decides whether a qualifying completion registers.",
        "is_required": false
      },
      {
        "key": "racing",
        "section_code": "3.1",
        "title": "Racing",
        "description": "The Racing strand shows a public Tier 1 Career Progress challenge.",
        "is_required": false
      },
      {
        "key": "racing-participate",
        "section_code": "3.1.1",
        "title": "Participate in any Race",
        "description": "Finish participation in any qualifying Race. Winning is not required for this public Tier 1 card.",
        "is_required": true
      },
      {
        "key": "deathmatches",
        "section_code": "3.2",
        "title": "Deathmatches",
        "description": "The Deathmatches strand shows a public Tier 1 Career Progress challenge. Its Awards remain separate.",
        "is_required": false
      },
      {
        "key": "deathmatch-participate",
        "section_code": "3.2.1",
        "title": "Participate in any Deathmatch",
        "description": "Participate in a qualifying Deathmatch. The public Tier 1 card does not require a win.",
        "is_required": true
      },
      {
        "key": "madrazo-dispatch-services",
        "section_code": "3.3",
        "title": "Madrazo Dispatch Services",
        "description": "The Dispatch Services strand shows the public Tier 1 card and its four-tier Career Progress structure.",
        "is_required": false
      },
      {
        "key": "dispatch-complete-mission",
        "section_code": "3.3.1",
        "title": "Complete a Dispatch Mission for Martin Madrazo",
        "description": "Complete one Dispatch Mission for Martin Madrazo.",
        "is_required": true
      },
      {
        "key": "current-update-challenge-sets",
        "section_code": "4",
        "title": "Current update challenge sets",
        "description": "These rows keep named live-service additions visible in the 2026 snapshot. Rockstar's update notices confirm the persistent Career Progress challenge set, but do not publish every individual card in the public article. Keep each row grouped until the official Career Progress surface exposes the exact card text.",
        "is_required": false
      },
      {
        "key": "cluckin-bell-farm-raid",
        "section_code": "4.1",
        "title": "The Cluckin' Bell Farm Raid",
        "description": "Rockstar's Cluckin' Bell announcement confirms new Career Progress challenges and rewards for PS5 and Xbox Series X|S. The public article does not expose individual card wording.",
        "is_required": false
      },
      {
        "key": "cluckin-bell-career-progress-set",
        "section_code": "4.1.1",
        "title": "Complete the Cluckin' Bell Career Progress challenge set",
        "description": "Complete all currently displayed persistent Career Progress cards for The Cluckin' Bell Farm Raid. Use the in-game Career tab for the exact card list and keep the Cluckin' Bell Tee and Outfit rewards separate from the Weekly Challenge.",
        "is_required": true
      },
      {
        "key": "agents-of-sabotage",
        "section_code": "4.2",
        "title": "Agents of Sabotage",
        "description": "Rockstar's Agents of Sabotage update notes confirm Career Progress challenges for the Garment Factory and FIB Files. The public notes do not print every card.",
        "is_required": false
      },
      {
        "key": "agents-of-sabotage-career-progress-set",
        "section_code": "4.2.1",
        "title": "Complete the Agents of Sabotage Career Progress challenge set",
        "description": "Complete all currently displayed persistent Career Progress cards for the FIB Files and Agents of Sabotage. Verify the exact objectives in the Career tab because file names, counts, and reward details can change with updates.",
        "is_required": true
      },
      {
        "key": "oscar-guzman-flies-again",
        "section_code": "4.3",
        "title": "Oscar Guzman Flies Again",
        "description": "Rockstar's Oscar Guzman update notice confirms new Career Progress rewards on PS5, Xbox Series X|S, and PC Enhanced. The public notice does not print every card.",
        "is_required": false
      },
      {
        "key": "oscar-guzman-career-progress-set",
        "section_code": "4.3.1",
        "title": "Complete the Oscar Guzman Career Progress challenge set",
        "description": "Complete all currently displayed persistent Career Progress cards for Oscar Guzman Flies Again. Check the Career tab for the exact Hangar and Arms Trafficking objectives before marking the set complete.",
        "is_required": true
      },
      {
        "key": "kortz-center-heist",
        "section_code": "4.4",
        "title": "The Kortz Center Heist",
        "description": "Rockstar's Kortz Center announcement confirms Career Progress challenges for PS5, Xbox Series X|S, and PC Enhanced and names the Tier 4 reward.",
        "is_required": false
      },
      {
        "key": "kortz-center-tier-four",
        "section_code": "4.4.1",
        "title": "Complete all Tier 4 Kortz Center challenges",
        "description": "Complete all of The Kortz Center Heist's Tier 4 Career Progress challenges. Rockstar says this grants the Vapid Caracara (Armored) on PS5, Xbox Series X|S, and PC Enhanced.",
        "is_required": true
      }
    ]
  }
]$content$::jsonb;
  payload jsonb;
  target_game uuid;
  target_page uuid;
begin
  for payload in select value from jsonb_array_elements(payloads) loop
    select id into strict target_game
    from public.gta_games
    where slug = payload->>'game_slug';

    insert into public.gta_checklist_pages(
      game_id, slug, title, seo_title, seo_description, description_md, is_public, published_at
    )
    values (
      target_game,
      payload->>'slug',
      payload->>'title',
      payload->>'seo_title',
      payload->>'seo_description',
      payload->>'description_md',
      false,
      now()
    )
    on conflict (slug) do update set
      game_id = excluded.game_id,
      title = excluded.title,
      seo_title = excluded.seo_title,
      seo_description = excluded.seo_description,
      description_md = excluded.description_md,
      published_at = coalesce(public.gta_checklist_pages.published_at, now())
    returning id into target_page;

    delete from public.gta_checklist_items existing
    where existing.page_id = target_page
      and not exists (
        select 1
        from jsonb_array_elements(payload->'items') item
        where item->>'key' = existing.item_key
      );

    insert into public.gta_checklist_items(
      page_id, item_key, section_code, title, description, is_required
    )
    select
      target_page,
      item->>'key',
      item->>'section_code',
      item->>'title',
      item->>'description',
      (item->>'is_required')::boolean
    from jsonb_array_elements(payload->'items') item
    on conflict (page_id, item_key) do update set
      section_code = excluded.section_code,
      title = excluded.title,
      description = excluded.description,
      is_required = excluded.is_required;

    update public.gta_checklist_pages
    set is_public = true,
        published_at = coalesce(published_at, now())
    where id = target_page;
  end loop;
end;
$seed$;
commit;
