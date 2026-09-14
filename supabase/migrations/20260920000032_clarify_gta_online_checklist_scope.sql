begin;
-- Preserve existing task IDs and progress; clarify the selected coverage.
update public.gta_checklist_pages
set title = 'GTA Online Career Progress: Selected Tasks',
    seo_title = 'GTA Online Career Progress Checklist: Selected Tasks',
    seo_description = 'Track selected GTA Online Career Progress objectives for PS5, Xbox Series X|S, and PC Enhanced. This partial checklist does not cover every tier or challenge.',
    description_md = $copy$Track selected Career Progress objectives in GTA Online on PS5, Xbox Series X|S, and PC Enhanced. This is a partial checklist checked on September 10, 2026, not a complete list of Career Progress challenges or tiers. It combines individual introductory objectives with a few grouped challenge sets. Older console editions and PC Legacy do not have this Career Progress feature.

Checking every task here completes this Bloxodes list only. It does not mean you have completed all of Career Progress. Rockstar adds challenges over time, and some objectives recognize earlier progress while others must be repeated. Use your character's in-game Career tab to check the complete challenge list, tier requirements, rewards, and recorded progress.

This board keeps Career Progress separate from Awards, weekly challenges, rotating bonuses, and collectible routes. Use the [GTA Online wiki](/gta/wiki/gta-online) for game guides and the [heists collection](/gta/wiki/gta-online/heists) for heist references. These pages do not show your character's live status. This is a manual tracker with no Rockstar account sync.$copy$
where slug = 'gta-online';
commit;
