-- Reviewed GTA V Story Mode checklist. No Roblox universe IDs; preserve task IDs on reruns.
begin;
do $seed$
declare
  payload jsonb := $content${
  "game_slug": "gta-5",
  "slug": "gta-5",
  "title": "GTA 5 Checklist",
  "seo_title": null,
  "seo_description": "Track GTA 5 Story Mode completion: story missions, Franklin’s side missions, races, collectibles and the other objectives needed for 100%.",
  "description_md": "Reach 100% in GTA 5 Story Mode by checking off the required missions and activities below. Complete one heist approach and one ending; you do not need every optional activity or gold medal.\n\nThe progress bar tracks your checked tasks, so its percentage can differ from GTA 5’s weighted completion percentage. Check **Stats > 100% Checklist** in the pause menu to confirm what your save has registered. GTA Online progress is separate.\n\nSome tasks group a mission chain or a choice of preparations. Introductory side-mission scenes and the 13 individual parachute jumps also make this board’s task count different from the game’s category totals. The Last One unlocks after 100% and is not required here.",
  "items": [
    {
      "key": "story-missions",
      "section_code": "1",
      "title": "Story missions",
      "description": "Complete your chosen story path. Optional family missions and gold medals are not required.",
      "is_required": false
    },
    {
      "key": "prologue",
      "section_code": "1.0.1",
      "title": "Prologue",
      "description": null,
      "is_required": true
    },
    {
      "key": "franklin-and-lamar",
      "section_code": "1.0.2",
      "title": "Franklin and Lamar",
      "description": null,
      "is_required": true
    },
    {
      "key": "repossession",
      "section_code": "1.0.3",
      "title": "Repossession",
      "description": null,
      "is_required": true
    },
    {
      "key": "complications",
      "section_code": "1.0.4",
      "title": "Complications",
      "description": null,
      "is_required": true
    },
    {
      "key": "father-son",
      "section_code": "1.0.5",
      "title": "Father/Son",
      "description": null,
      "is_required": true
    },
    {
      "key": "chop",
      "section_code": "1.0.6",
      "title": "Chop",
      "description": null,
      "is_required": true
    },
    {
      "key": "marriage-counseling",
      "section_code": "1.0.7",
      "title": "Marriage Counseling",
      "description": null,
      "is_required": true
    },
    {
      "key": "daddy-s-little-girl",
      "section_code": "1.0.8",
      "title": "Daddy’s Little Girl",
      "description": null,
      "is_required": true
    },
    {
      "key": "friend-request",
      "section_code": "1.0.9",
      "title": "Friend Request",
      "description": null,
      "is_required": true
    },
    {
      "key": "the-long-stretch",
      "section_code": "1.0.10",
      "title": "The Long Stretch",
      "description": null,
      "is_required": true
    },
    {
      "key": "casing-the-jewel-store",
      "section_code": "1.0.11",
      "title": "Casing the Jewel Store",
      "description": null,
      "is_required": true
    },
    {
      "key": "the-jewel-store-job-and-chosen-preparations",
      "section_code": "1.0.12",
      "title": "The Jewel Store Job and chosen preparations",
      "description": "Complete either approach: Carbine Rifles for Loud, or Bugstars Equipment and BZ Gas Grenades for Smart. Then finish the heist.",
      "is_required": true
    },
    {
      "key": "mr-philips",
      "section_code": "1.0.13",
      "title": "Mr. Philips",
      "description": null,
      "is_required": true
    },
    {
      "key": "trevor-philips-industries",
      "section_code": "1.0.14",
      "title": "Trevor Philips Industries",
      "description": null,
      "is_required": true
    },
    {
      "key": "nervous-ron",
      "section_code": "1.0.15",
      "title": "Nervous Ron",
      "description": null,
      "is_required": true
    },
    {
      "key": "crystal-maze",
      "section_code": "1.0.16",
      "title": "Crystal Maze",
      "description": null,
      "is_required": true
    },
    {
      "key": "friends-reunited",
      "section_code": "1.0.17",
      "title": "Friends Reunited",
      "description": null,
      "is_required": true
    },
    {
      "key": "fame-or-shame",
      "section_code": "1.0.18",
      "title": "Fame or Shame",
      "description": null,
      "is_required": true
    },
    {
      "key": "dead-man-walking",
      "section_code": "1.0.19",
      "title": "Dead Man Walking",
      "description": null,
      "is_required": true
    },
    {
      "key": "three-s-company",
      "section_code": "1.0.20",
      "title": "Three’s Company",
      "description": null,
      "is_required": true
    },
    {
      "key": "by-the-book",
      "section_code": "1.0.21",
      "title": "By the Book",
      "description": null,
      "is_required": true
    },
    {
      "key": "hood-safari",
      "section_code": "1.0.22",
      "title": "Hood Safari",
      "description": null,
      "is_required": true
    },
    {
      "key": "did-somebody-say-yoga",
      "section_code": "1.0.23",
      "title": "Did Somebody Say Yoga?",
      "description": null,
      "is_required": true
    },
    {
      "key": "scouting-the-port",
      "section_code": "1.0.24",
      "title": "Scouting the Port",
      "description": null,
      "is_required": true
    },
    {
      "key": "minisub",
      "section_code": "1.0.25",
      "title": "Minisub",
      "description": null,
      "is_required": true
    },
    {
      "key": "the-merryweather-heist-and-chosen-preparations",
      "section_code": "1.0.26",
      "title": "The Merryweather Heist and chosen preparations",
      "description": "Finish either Freighter or Offshore. Complete Cargobob if you choose Offshore.",
      "is_required": true
    },
    {
      "key": "the-hotel-assassination",
      "section_code": "1.0.27",
      "title": "The Hotel Assassination",
      "description": "This Lester mission is required during the story. The other four assassinations are listed below.",
      "is_required": true
    },
    {
      "key": "boiler-suits",
      "section_code": "1.0.28",
      "title": "Boiler Suits",
      "description": null,
      "is_required": true
    },
    {
      "key": "masks",
      "section_code": "1.0.29",
      "title": "Masks",
      "description": null,
      "is_required": true
    },
    {
      "key": "trash-truck",
      "section_code": "1.0.30",
      "title": "Trash Truck",
      "description": null,
      "is_required": true
    },
    {
      "key": "tow-truck",
      "section_code": "1.0.31",
      "title": "Tow Truck",
      "description": null,
      "is_required": true
    },
    {
      "key": "blitz-play",
      "section_code": "1.0.32",
      "title": "Blitz Play",
      "description": "Finish the operation after its preparations, including placing the getaway vehicle.",
      "is_required": true
    },
    {
      "key": "i-fought-the-law",
      "section_code": "1.0.33",
      "title": "I Fought the Law...",
      "description": null,
      "is_required": true
    },
    {
      "key": "eye-in-the-sky",
      "section_code": "1.0.34",
      "title": "Eye in the Sky",
      "description": null,
      "is_required": true
    },
    {
      "key": "mr-richards",
      "section_code": "1.0.35",
      "title": "Mr. Richards",
      "description": null,
      "is_required": true
    },
    {
      "key": "caida-libre",
      "section_code": "1.0.36",
      "title": "Caida Libre",
      "description": null,
      "is_required": true
    },
    {
      "key": "deep-inside",
      "section_code": "1.0.37",
      "title": "Deep Inside",
      "description": null,
      "is_required": true
    },
    {
      "key": "minor-turbulence",
      "section_code": "1.0.38",
      "title": "Minor Turbulence",
      "description": null,
      "is_required": true
    },
    {
      "key": "paleto-score-setup",
      "section_code": "1.0.39",
      "title": "Paleto Score Setup",
      "description": null,
      "is_required": true
    },
    {
      "key": "predator",
      "section_code": "1.0.40",
      "title": "Predator",
      "description": null,
      "is_required": true
    },
    {
      "key": "military-hardware",
      "section_code": "1.0.41",
      "title": "Military Hardware",
      "description": null,
      "is_required": true
    },
    {
      "key": "the-paleto-score",
      "section_code": "1.0.42",
      "title": "The Paleto Score",
      "description": null,
      "is_required": true
    },
    {
      "key": "derailed",
      "section_code": "1.0.43",
      "title": "Derailed",
      "description": null,
      "is_required": true
    },
    {
      "key": "monkey-business",
      "section_code": "1.0.44",
      "title": "Monkey Business",
      "description": null,
      "is_required": true
    },
    {
      "key": "hang-ten",
      "section_code": "1.0.45",
      "title": "Hang Ten",
      "description": null,
      "is_required": true
    },
    {
      "key": "surveying-the-score",
      "section_code": "1.0.46",
      "title": "Surveying the Score",
      "description": null,
      "is_required": true
    },
    {
      "key": "bury-the-hatchet",
      "section_code": "1.0.47",
      "title": "Bury the Hatchet",
      "description": null,
      "is_required": true
    },
    {
      "key": "pack-man",
      "section_code": "1.0.48",
      "title": "Pack Man",
      "description": null,
      "is_required": true
    },
    {
      "key": "fresh-meat",
      "section_code": "1.0.49",
      "title": "Fresh Meat",
      "description": null,
      "is_required": true
    },
    {
      "key": "the-ballad-of-rocco",
      "section_code": "1.0.50",
      "title": "The Ballad of Rocco",
      "description": null,
      "is_required": true
    },
    {
      "key": "cleaning-out-the-bureau",
      "section_code": "1.0.51",
      "title": "Cleaning out the Bureau",
      "description": null,
      "is_required": true
    },
    {
      "key": "architect-s-plans",
      "section_code": "1.0.52",
      "title": "Architect’s Plans",
      "description": null,
      "is_required": true
    },
    {
      "key": "the-bureau-raid-and-chosen-preparations",
      "section_code": "1.0.53",
      "title": "The Bureau Raid and chosen preparations",
      "description": "Finish Fire Crew or Roof Entry. Fire Crew requires Fire Truck and a getaway vehicle; you do not need to play both approaches.",
      "is_required": true
    },
    {
      "key": "the-wrap-up",
      "section_code": "1.0.54",
      "title": "The Wrap Up",
      "description": null,
      "is_required": true
    },
    {
      "key": "reuniting-the-family",
      "section_code": "1.0.55",
      "title": "Reuniting the Family",
      "description": null,
      "is_required": true
    },
    {
      "key": "legal-trouble",
      "section_code": "1.0.56",
      "title": "Legal Trouble",
      "description": null,
      "is_required": true
    },
    {
      "key": "lamar-down",
      "section_code": "1.0.57",
      "title": "Lamar Down",
      "description": null,
      "is_required": true
    },
    {
      "key": "meltdown",
      "section_code": "1.0.58",
      "title": "Meltdown",
      "description": null,
      "is_required": true
    },
    {
      "key": "planning-the-big-score",
      "section_code": "1.0.59",
      "title": "Planning the Big Score",
      "description": null,
      "is_required": true
    },
    {
      "key": "the-big-score-and-chosen-preparations",
      "section_code": "1.0.60",
      "title": "The Big Score and chosen preparations",
      "description": "Finish Subtle or Obvious. Subtle uses Stingers and the three Gauntlet cars; Obvious uses Driller, Sidetracked and a getaway vehicle.",
      "is_required": true
    },
    {
      "key": "finish-any-story-ending",
      "section_code": "1.0.61",
      "title": "Finish any story ending",
      "description": "Complete Something Sensible, The Time’s Come or The Third Way. Only your chosen ending is needed.",
      "is_required": true
    },
    {
      "key": "the-multi-target-assassination",
      "section_code": "1.0.62",
      "title": "The Multi Target Assassination",
      "description": "Required for 100% even though you can leave it until after the story.",
      "is_required": true
    },
    {
      "key": "the-vice-assassination",
      "section_code": "1.0.63",
      "title": "The Vice Assassination",
      "description": null,
      "is_required": true
    },
    {
      "key": "the-bus-assassination",
      "section_code": "1.0.64",
      "title": "The Bus Assassination",
      "description": null,
      "is_required": true
    },
    {
      "key": "the-construction-assassination",
      "section_code": "1.0.65",
      "title": "The Construction Assassination",
      "description": null,
      "is_required": true
    },
    {
      "key": "franklin-s-strangers-and-freaks",
      "section_code": "2",
      "title": "Franklin’s Strangers and Freaks",
      "description": "These tasks include prerequisite scenes. They do not correspond one-for-one to the game’s 20 required side-mission credits. The Last One is a reward after 100%, so it is excluded.",
      "is_required": false
    },
    {
      "key": "pulling-favors",
      "section_code": "2.0.1",
      "title": "Pulling Favors",
      "description": null,
      "is_required": true
    },
    {
      "key": "pulling-another-favor",
      "section_code": "2.0.2",
      "title": "Pulling Another Favor",
      "description": null,
      "is_required": true
    },
    {
      "key": "pulling-favors-again",
      "section_code": "2.0.3",
      "title": "Pulling Favors Again",
      "description": null,
      "is_required": true
    },
    {
      "key": "still-pulling-favors",
      "section_code": "2.0.4",
      "title": "Still Pulling Favors",
      "description": null,
      "is_required": true
    },
    {
      "key": "pulling-one-last-favor",
      "section_code": "2.0.5",
      "title": "Pulling One Last Favor",
      "description": null,
      "is_required": true
    },
    {
      "key": "finish-beverly-s-paparazzo-chain",
      "section_code": "2.0.6",
      "title": "Finish Beverly’s Paparazzo chain",
      "description": "Complete Paparazzo, The Sex Tape, The Partnership, The Meltdown, The Highness and Reality Check. This task includes the connecting scene as well as the missions.",
      "is_required": true
    },
    {
      "key": "finish-barry-s-grass-roots-chain",
      "section_code": "2.0.7",
      "title": "Finish Barry’s Grass Roots chain",
      "description": "As Franklin, complete Grass Roots - Franklin, The Pickup, The Drag and The Smoke-In. Include the final meeting at City Hall.",
      "is_required": true
    },
    {
      "key": "shift-work",
      "section_code": "2.0.8",
      "title": "Shift Work",
      "description": "Complete Hao’s introductory race as Franklin. The same race satisfies South Los Santos below, so you can check both entries.",
      "is_required": true
    },
    {
      "key": "exercising-demons-franklin",
      "section_code": "2.0.9",
      "title": "Exercising Demons - Franklin",
      "description": null,
      "is_required": true
    },
    {
      "key": "risk-assessment",
      "section_code": "2.0.10",
      "title": "Risk Assessment",
      "description": null,
      "is_required": true
    },
    {
      "key": "liquidity-risk",
      "section_code": "2.0.11",
      "title": "Liquidity Risk",
      "description": null,
      "is_required": true
    },
    {
      "key": "targeted-risk",
      "section_code": "2.0.12",
      "title": "Targeted Risk",
      "description": null,
      "is_required": true
    },
    {
      "key": "uncalculated-risk",
      "section_code": "2.0.13",
      "title": "Uncalculated Risk",
      "description": "Finish all 13 parachute jumps to open Dom’s final mission.",
      "is_required": true
    },
    {
      "key": "far-out",
      "section_code": "2.0.14",
      "title": "Far Out",
      "description": "Meet Omega as Franklin to start the spaceship-parts hunt.",
      "is_required": true
    },
    {
      "key": "the-final-frontier",
      "section_code": "2.0.15",
      "title": "The Final Frontier",
      "description": "After finding all 50 spaceship parts, return to Omega as Franklin.",
      "is_required": true
    },
    {
      "key": "a-starlet-in-vinewood",
      "section_code": "2.0.16",
      "title": "A Starlet in Vinewood",
      "description": "Collect all 50 letter scraps, then complete Franklin’s encounter with Dreyfuss.",
      "is_required": true
    },
    {
      "key": "hobbies-and-pastimes",
      "section_code": "3",
      "title": "Hobbies and pastimes",
      "description": null,
      "is_required": false
    },
    {
      "key": "shooting-range",
      "section_code": "3.1",
      "title": "Shooting range",
      "description": null,
      "is_required": false
    },
    {
      "key": "hand-guns-medal-in-all-three-challenges",
      "section_code": "3.1.1",
      "title": "Hand Guns: medal in all three challenges",
      "description": "Earn bronze or better in challenges 1, 2 and 3 for this category.",
      "is_required": true
    },
    {
      "key": "submachine-guns-medal-in-all-three-challenges",
      "section_code": "3.1.2",
      "title": "Submachine Guns: medal in all three challenges",
      "description": "Earn bronze or better in challenges 1, 2 and 3 for this category.",
      "is_required": true
    },
    {
      "key": "assault-rifles-medal-in-all-three-challenges",
      "section_code": "3.1.3",
      "title": "Assault Rifles: medal in all three challenges",
      "description": "Earn bronze or better in challenges 1, 2 and 3 for this category.",
      "is_required": true
    },
    {
      "key": "shotguns-medal-in-all-three-challenges",
      "section_code": "3.1.4",
      "title": "Shotguns: medal in all three challenges",
      "description": "Earn bronze or better in challenges 1, 2 and 3 for this category.",
      "is_required": true
    },
    {
      "key": "light-machine-guns-medal-in-all-three-challenges",
      "section_code": "3.1.5",
      "title": "Light Machine Guns: medal in all three challenges",
      "description": "Earn bronze or better in challenges 1, 2 and 3 for this category.",
      "is_required": true
    },
    {
      "key": "heavy-medal-in-all-three-challenges",
      "section_code": "3.1.6",
      "title": "Heavy: medal in all three challenges",
      "description": "Earn bronze or better in challenges 1, 2 and 3 for this category.",
      "is_required": true
    },
    {
      "key": "flight-school",
      "section_code": "3.2",
      "title": "Flight School",
      "description": null,
      "is_required": false
    },
    {
      "key": "training-take-off",
      "section_code": "3.2.1",
      "title": "Training Take Off",
      "description": "Earn bronze or better in this lesson.",
      "is_required": true
    },
    {
      "key": "runway-landing",
      "section_code": "3.2.2",
      "title": "Runway Landing",
      "description": "Earn bronze or better in this lesson.",
      "is_required": true
    },
    {
      "key": "inverted-flight",
      "section_code": "3.2.3",
      "title": "Inverted Flight",
      "description": "Earn bronze or better in this lesson.",
      "is_required": true
    },
    {
      "key": "knife-flight",
      "section_code": "3.2.4",
      "title": "Knife Flight",
      "description": "Earn bronze or better in this lesson.",
      "is_required": true
    },
    {
      "key": "flat-hatting",
      "section_code": "3.2.5",
      "title": "Flat Hatting",
      "description": "Earn bronze or better in this lesson.",
      "is_required": true
    },
    {
      "key": "touch-down",
      "section_code": "3.2.6",
      "title": "Touch Down",
      "description": "Earn bronze or better in this lesson.",
      "is_required": true
    },
    {
      "key": "loop-the-loop",
      "section_code": "3.2.7",
      "title": "Loop the Loop",
      "description": "Earn bronze or better in this lesson.",
      "is_required": true
    },
    {
      "key": "helicopter-course",
      "section_code": "3.2.8",
      "title": "Helicopter Course",
      "description": "Earn bronze or better in this lesson.",
      "is_required": true
    },
    {
      "key": "helicopter-speed-run",
      "section_code": "3.2.9",
      "title": "Helicopter Speed Run",
      "description": "Earn bronze or better in this lesson.",
      "is_required": true
    },
    {
      "key": "skydiving",
      "section_code": "3.2.10",
      "title": "Skydiving",
      "description": "Earn bronze or better in this lesson.",
      "is_required": true
    },
    {
      "key": "drop-zone",
      "section_code": "3.2.11",
      "title": "Drop Zone",
      "description": "Earn bronze or better in this lesson.",
      "is_required": true
    },
    {
      "key": "earn-your-wings",
      "section_code": "3.2.12",
      "title": "Earn Your Wings",
      "description": "Earn bronze or better in this lesson.",
      "is_required": true
    },
    {
      "key": "street-races",
      "section_code": "3.3",
      "title": "Street races",
      "description": "South Los Santos is the race in Shift Work; you can check both entries after completing it.",
      "is_required": false
    },
    {
      "key": "south-los-santos",
      "section_code": "3.3.1",
      "title": "South Los Santos",
      "description": "Complete the race in Shift Work as Franklin. This satisfies both entries, so check off Shift Work too.",
      "is_required": true
    },
    {
      "key": "city-circuit",
      "section_code": "3.3.2",
      "title": "City Circuit",
      "description": "Earn a medal as Franklin. Win the race to unlock the next event in Hao’s series.",
      "is_required": true
    },
    {
      "key": "airport",
      "section_code": "3.3.3",
      "title": "Airport",
      "description": "Earn a medal as Franklin. Win the race to unlock the next event in Hao’s series.",
      "is_required": true
    },
    {
      "key": "freeway",
      "section_code": "3.3.4",
      "title": "Freeway",
      "description": "Earn a medal as Franklin. Win the race to unlock the next event in Hao’s series.",
      "is_required": true
    },
    {
      "key": "vespucci-canals",
      "section_code": "3.3.5",
      "title": "Vespucci Canals",
      "description": "Earn a medal as Franklin. A top-three finish is enough for completion credit.",
      "is_required": true
    },
    {
      "key": "off-road-races",
      "section_code": "3.4",
      "title": "Off-road races",
      "description": null,
      "is_required": false
    },
    {
      "key": "canyon-cliffs",
      "section_code": "3.4.1",
      "title": "Canyon Cliffs",
      "description": "Finish in the top three.",
      "is_required": true
    },
    {
      "key": "ridge-run",
      "section_code": "3.4.2",
      "title": "Ridge Run",
      "description": "Finish in the top three.",
      "is_required": true
    },
    {
      "key": "mineward-spiral",
      "section_code": "3.4.3",
      "title": "Mineward Spiral",
      "description": "Finish in the top three.",
      "is_required": true
    },
    {
      "key": "valley-trail",
      "section_code": "3.4.4",
      "title": "Valley Trail",
      "description": "Finish in the top three.",
      "is_required": true
    },
    {
      "key": "lakeside-splash",
      "section_code": "3.4.5",
      "title": "Lakeside Splash",
      "description": "Finish in the top three.",
      "is_required": true
    },
    {
      "key": "eco-friendly",
      "section_code": "3.4.6",
      "title": "Eco Friendly",
      "description": "Finish in the top three.",
      "is_required": true
    },
    {
      "key": "sea-races",
      "section_code": "3.5",
      "title": "Sea races",
      "description": null,
      "is_required": false
    },
    {
      "key": "east-coast",
      "section_code": "3.5.1",
      "title": "East Coast",
      "description": "Finish in the top three on the Power Station course off the east coast.",
      "is_required": true
    },
    {
      "key": "north-east-coast",
      "section_code": "3.5.2",
      "title": "North East Coast",
      "description": "Finish in the top three on the El Gordo course near the lighthouse.",
      "is_required": true
    },
    {
      "key": "raton-canyon",
      "section_code": "3.5.3",
      "title": "Raton Canyon",
      "description": "Finish in the top three on the Lago Zancudo course through the Zancudo River.",
      "is_required": true
    },
    {
      "key": "los-santos",
      "section_code": "3.5.4",
      "title": "Los Santos",
      "description": "Finish in the top three on the Los Santos Port course.",
      "is_required": true
    },
    {
      "key": "triathlons",
      "section_code": "3.6",
      "title": "Triathlons",
      "description": null,
      "is_required": false
    },
    {
      "key": "vespucci-canals-triathlon",
      "section_code": "3.6.1",
      "title": "Vespucci Canals Triathlon",
      "description": "Finish in the top three.",
      "is_required": true
    },
    {
      "key": "alamo-sea-triathlon",
      "section_code": "3.6.2",
      "title": "Alamo Sea Triathlon",
      "description": "Finish in the top three.",
      "is_required": true
    },
    {
      "key": "coyote-cross-country-triathlon",
      "section_code": "3.6.3",
      "title": "Coyote Cross Country Triathlon",
      "description": "Finish in the top three.",
      "is_required": true
    },
    {
      "key": "base-jumps",
      "section_code": "3.7",
      "title": "Base jumps",
      "description": null,
      "is_required": false
    },
    {
      "key": "bank-bailout",
      "section_code": "3.7.1",
      "title": "Bank Bailout",
      "description": "Complete the parachute jump successfully.",
      "is_required": true
    },
    {
      "key": "what-goes-up",
      "section_code": "3.7.2",
      "title": "What Goes Up...",
      "description": "Complete the parachute jump successfully.",
      "is_required": true
    },
    {
      "key": "falling-mouse",
      "section_code": "3.7.3",
      "title": "Falling Mouse",
      "description": "Complete the parachute jump successfully.",
      "is_required": true
    },
    {
      "key": "aim-for-the-fairway",
      "section_code": "3.7.4",
      "title": "Aim for the Fairway",
      "description": "Complete the parachute jump successfully.",
      "is_required": true
    },
    {
      "key": "razor-rock-dive",
      "section_code": "3.7.5",
      "title": "Razor Rock Dive",
      "description": "Complete the parachute jump successfully.",
      "is_required": true
    },
    {
      "key": "helicopter-jumps",
      "section_code": "3.8",
      "title": "Helicopter jumps",
      "description": null,
      "is_required": false
    },
    {
      "key": "pacific-tour",
      "section_code": "3.8.1",
      "title": "Pacific Tour",
      "description": "Complete the parachute jump successfully.",
      "is_required": true
    },
    {
      "key": "photo-finish",
      "section_code": "3.8.2",
      "title": "Photo Finish",
      "description": "Complete the parachute jump successfully.",
      "is_required": true
    },
    {
      "key": "turbine-terror",
      "section_code": "3.8.3",
      "title": "Turbine Terror",
      "description": "Complete the parachute jump successfully.",
      "is_required": true
    },
    {
      "key": "the-decline",
      "section_code": "3.8.4",
      "title": "The Decline",
      "description": "Complete the parachute jump successfully.",
      "is_required": true
    },
    {
      "key": "runaway-train",
      "section_code": "3.8.5",
      "title": "Runaway Train",
      "description": "Complete the parachute jump successfully.",
      "is_required": true
    },
    {
      "key": "carving-the-mountain",
      "section_code": "3.8.6",
      "title": "Carving the Mountain",
      "description": "Complete the parachute jump successfully.",
      "is_required": true
    },
    {
      "key": "the-fall-of-the-alamo",
      "section_code": "3.8.7",
      "title": "The Fall of the Alamo",
      "description": "Complete the parachute jump successfully.",
      "is_required": true
    },
    {
      "key": "dammed-if-you-don-t",
      "section_code": "3.8.8",
      "title": "Dammed If You Don’t",
      "description": "Complete the parachute jump successfully.",
      "is_required": true
    },
    {
      "key": "sports-and-private-dance",
      "section_code": "3.9",
      "title": "Sports and private dance",
      "description": null,
      "is_required": false
    },
    {
      "key": "win-a-tennis-game",
      "section_code": "3.9.1",
      "title": "Win a tennis game",
      "description": "Play as Michael or Trevor. You can set the match length to one game.",
      "is_required": true
    },
    {
      "key": "win-a-darts-game",
      "section_code": "3.9.2",
      "title": "Win a darts game",
      "description": null,
      "is_required": true
    },
    {
      "key": "finish-nine-holes-at-par-or-better",
      "section_code": "3.9.3",
      "title": "Finish nine holes at par or better",
      "description": "Complete a full nine-hole golf round with an even-par or under-par total.",
      "is_required": true
    },
    {
      "key": "get-a-private-dance",
      "section_code": "3.9.4",
      "title": "Get a private dance",
      "description": "Complete one paid private dance at the Vanilla Unicorn.",
      "is_required": true
    },
    {
      "key": "random-events",
      "section_code": "4",
      "title": "Random events",
      "description": null,
      "is_required": false
    },
    {
      "key": "complete-any-14-random-events",
      "section_code": "4.0.1",
      "title": "Complete any 14 random events",
      "description": "Use the Random Events total under Stats > 100% Checklist to check how many qualifying events have registered. You choose which events to complete.",
      "is_required": true
    },
    {
      "key": "collectibles-and-stunts",
      "section_code": "5",
      "title": "Collectibles and stunts",
      "description": null,
      "is_required": false
    },
    {
      "key": "collect-all-50-spaceship-parts",
      "section_code": "5.0.1",
      "title": "Collect all 50 spaceship parts",
      "description": "Start Far Out with Franklin. After collecting the parts, return to Omega for The Final Frontier.",
      "is_required": true
    },
    {
      "key": "collect-all-50-letter-scraps",
      "section_code": "5.0.2",
      "title": "Collect all 50 letter scraps",
      "description": "The completed letter opens A Starlet in Vinewood for Franklin.",
      "is_required": true
    },
    {
      "key": "complete-25-different-stunt-jumps",
      "section_code": "5.0.3",
      "title": "Complete 25 different stunt jumps",
      "description": "Any 25 of the 50 successful stunt jumps count. All 50 are only needed for the separate stunt-jump achievement.",
      "is_required": true
    },
    {
      "key": "fly-under-25-different-bridges",
      "section_code": "5.0.4",
      "title": "Fly under 25 different bridges",
      "description": "Complete any 25 of the 50 Under the Bridge challenges.",
      "is_required": true
    },
    {
      "key": "complete-8-different-knife-flights",
      "section_code": "5.0.5",
      "title": "Complete 8 different knife flights",
      "description": "Complete any 8 of the 15 Knife Flight challenges. The Flight School lesson is a separate task.",
      "is_required": true
    },
    {
      "key": "other-activities",
      "section_code": "6",
      "title": "Other activities",
      "description": null,
      "is_required": false
    },
    {
      "key": "buy-five-businesses",
      "section_code": "6.0.1",
      "title": "Buy five businesses",
      "description": "Purchase five income-generating properties. Vehicle-storage properties and the automatically acquired Vanilla Unicorn do not count.",
      "is_required": true
    },
    {
      "key": "buy-a-vehicle-online",
      "section_code": "6.0.2",
      "title": "Buy a vehicle online",
      "description": "Purchase a vehicle through an in-game website.",
      "is_required": true
    },
    {
      "key": "walk-chop-and-play-fetch",
      "section_code": "6.0.3",
      "title": "Walk Chop and play fetch",
      "description": "Take Chop for a walk as Franklin and throw his ball.",
      "is_required": true
    },
    {
      "key": "complete-a-booty-call",
      "section_code": "6.0.4",
      "title": "Complete a Booty Call",
      "description": "Complete one of the game’s private visits with an eligible contact.",
      "is_required": true
    },
    {
      "key": "use-a-prostitute-service",
      "section_code": "6.0.5",
      "title": "Use a prostitute service",
      "description": "Complete one service in Story Mode.",
      "is_required": true
    },
    {
      "key": "hold-up-a-store",
      "section_code": "6.0.6",
      "title": "Hold up a store",
      "description": "Rob a convenience store and collect the cash.",
      "is_required": true
    },
    {
      "key": "visit-a-cinema-alone",
      "section_code": "6.0.7",
      "title": "Visit a cinema alone",
      "description": "Watch a movie without starting a friend activity.",
      "is_required": true
    },
    {
      "key": "visit-a-cinema-with-a-friend",
      "section_code": "6.0.8",
      "title": "Visit a cinema with a friend",
      "description": "Call a friend to hang out, then go to a movie together.",
      "is_required": true
    },
    {
      "key": "visit-a-bar-with-a-friend",
      "section_code": "6.0.9",
      "title": "Visit a bar with a friend",
      "description": "Start a friend hangout and go to a bar together.",
      "is_required": true
    },
    {
      "key": "visit-the-strip-club-with-a-friend",
      "section_code": "6.0.10",
      "title": "Visit the strip club with a friend",
      "description": "Go to the Vanilla Unicorn during a friend hangout.",
      "is_required": true
    },
    {
      "key": "play-darts-with-a-friend",
      "section_code": "6.0.11",
      "title": "Play darts with a friend",
      "description": "Play darts together during a friend hangout. This is separate from winning a darts game.",
      "is_required": true
    }
  ]
}$content$::jsonb;
  target_game uuid;
  target_page uuid;
begin
  select id into strict target_game from public.gta_games where slug=payload->>'game_slug';
  insert into public.gta_checklist_pages(game_id,slug,title,seo_title,seo_description,description_md,is_public,published_at)
  values(target_game,payload->>'slug',payload->>'title',payload->>'seo_title',payload->>'seo_description',payload->>'description_md',false,now())
  on conflict(slug) do update set title=excluded.title,seo_title=excluded.seo_title,seo_description=excluded.seo_description,description_md=excluded.description_md
  returning id into target_page;
  insert into public.gta_checklist_items(page_id,item_key,section_code,title,description,is_required)
  select target_page, item->>'key',item->>'section_code',item->>'title',item->>'description',(item->>'is_required')::boolean
  from jsonb_array_elements(payload->'items') item
  on conflict(page_id,item_key) do update set section_code=excluded.section_code,title=excluded.title,description=excluded.description,is_required=excluded.is_required;
  update public.gta_checklist_pages set is_public=true where id=target_page;
end;
$seed$;
commit;
