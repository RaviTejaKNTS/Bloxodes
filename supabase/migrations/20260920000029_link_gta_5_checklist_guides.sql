-- Add verified internal references without changing checklist task identities.
-- Tennis wording follows the completed-match requirement, including one-game matches.
begin;
update public.gta_checklist_items i set title=v.title, description=v.description
from (values
  ('story-missions', 'Story missions', 'Complete your chosen story path. Optional family missions and gold medals are not required. See the [story mission list](/gta/wiki/gta-5/story-missions) for mission details, including optional missions and alternative approaches.'),
  ('the-jewel-store-job-and-chosen-preparations', 'The Jewel Store Job and chosen preparations', 'Complete either approach: Carbine Rifles for Loud, or Bugstars Equipment and BZ Gas Grenades for Smart. Then finish the heist. See the [heist details](/gta/wiki/gta-5/heists) for approaches and crew choices.'),
  ('the-merryweather-heist-and-chosen-preparations', 'The Merryweather Heist and chosen preparations', 'Finish either Freighter or Offshore. Complete Cargobob if you choose Offshore. See the [heist details](/gta/wiki/gta-5/heists) for approaches and crew choices.'),
  ('the-bureau-raid-and-chosen-preparations', 'The Bureau Raid and chosen preparations', 'Finish Fire Crew or Roof Entry. Fire Crew requires Fire Truck and a getaway vehicle; you do not need to play both approaches. See the [heist details](/gta/wiki/gta-5/heists) for approaches and crew choices.'),
  ('the-big-score-and-chosen-preparations', 'The Big Score and chosen preparations', 'Finish Subtle or Obvious. Subtle uses Stingers and the three Gauntlet cars; Obvious uses Driller, Sidetracked and a getaway vehicle. See the [heist details](/gta/wiki/gta-5/heists) for approaches and crew choices.'),
  ('franklin-s-strangers-and-freaks', 'Franklin’s Strangers and Freaks', 'These tasks include prerequisite scenes. They do not correspond one-for-one to the game’s 20 required side-mission credits. The Last One is a reward after 100%, so it is excluded. The [Strangers and Freaks list](/gta/wiki/gta-5/strangers-and-freaks) also includes optional missions for the other characters.'),
  ('hobbies-and-pastimes', 'Hobbies and pastimes', 'Complete the activities below. The [hobbies and pastimes list](/gta/wiki/gta-5/hobbies-and-pastimes) also covers optional activities.'),
  ('win-a-tennis-game', 'Win a tennis match', 'Play as Michael or Trevor and finish the whole match. Set its length to one game for a short match; winning one game in a longer unfinished match is not enough.'),
  ('complete-any-14-random-events', 'Complete any 14 random events', 'Use the Random Events total under Stats > 100% Checklist to check how many qualifying events have registered. You choose which events to complete. Use the [random event list](/gta/wiki/gta-5/random-events) to find encounters.'),
  ('collect-all-50-spaceship-parts', 'Collect all 50 spaceship parts', 'Start Far Out with Franklin. After collecting the parts, return to Omega for The Final Frontier. Find each piece in the [spaceship part locations](/gta/wiki/gta-5/spaceship-parts).'),
  ('collect-all-50-letter-scraps', 'Collect all 50 letter scraps', 'The completed letter opens A Starlet in Vinewood for Franklin. Use the [letter scrap locations](/gta/wiki/gta-5/letter-scraps) to find the remaining pages.'),
  ('complete-25-different-stunt-jumps', 'Complete 25 different stunt jumps', 'Any 25 of the 50 successful stunt jumps count. All 50 are only needed for the separate stunt-jump achievement. Choose your jumps from the [stunt jump locations](/gta/wiki/gta-5/stunt-jumps).'),
  ('fly-under-25-different-bridges', 'Fly under 25 different bridges', 'Complete any 25 of the 50 Under the Bridge challenges. Choose your route from the [bridge locations](/gta/wiki/gta-5/under-the-bridge).'),
  ('complete-8-different-knife-flights', 'Complete 8 different knife flights', 'Complete any 8 of the 15 Knife Flight challenges. The Flight School lesson is a separate task. Find the gaps in the [knife flight locations](/gta/wiki/gta-5/knife-flights).'),
  ('buy-five-businesses', 'Buy five businesses', 'Purchase five income-generating properties. Vehicle-storage properties and the automatically acquired Vanilla Unicorn do not count. Check prices and owners in the [property list](/gta/wiki/gta-5/properties).')
) as v(item_key,title,description), public.gta_checklist_pages p
where i.page_id=p.id and p.slug='gta-5' and i.item_key=v.item_key;
update public.gta_checklist_pages set description_md='Reach 100% in GTA 5 Story Mode by checking off the required missions and activities below. Complete one heist approach and one ending; you do not need every optional activity or gold medal.

The progress bar tracks your checked tasks, so its percentage can differ from GTA 5’s weighted completion percentage. Check **Stats > 100% Checklist** in the pause menu to confirm what your save has registered. GTA Online progress is separate.

Some tasks group a mission chain or a choice of preparations. Introductory side-mission scenes and the 13 individual parachute jumps also make this board’s task count different from the game’s category totals. The Last One unlocks after 100% and is not required here.

The [GTA 5 wiki](/gta/wiki/gta-5) links to more game details. Collection checkmarks are saved separately from this completion checklist.' where slug='gta-5';
commit;
