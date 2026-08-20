# Top-50 wiki-gap batch: remaining work handoff (2026-08-20)

Branch: `tier-a-collections` (all work lives here; nothing pushed to production).
Managed-dev hubs already seeded for: sols-rng, dead-rails, dandys-world, tower-of-hell, bedwars.
Fully DONE (verified + committed): Dead Rails (6 collections), Sol's RNG (4), Dandy's World (3).
Blocked (recorded in backlog): Anime Origins Units.
Backlog doc: `Writing plans/published-wiki-collection-create-backlog-2026-08-09.md` (Top-50 wiki-gap batch section).
Scratchpad with raw harvests + helper scripts: `/private/tmp/claude-501/-Users-ravitejaknts-projects-Bloxodes/a3d59c87-4d5b-409e-bbcc-1d0f6be363e5/scratchpad/` (dies with the session; datasets in repo are complete, scratchpad only needed for re-harvesting).

## 1. Tower of Hell — fix one dataset bug, then verify (30 min)

State: datasets + 376/376 images committed (`data/Tower of Hell/`), hub seeded, finals written and copy-checked at `tmp/content-workspace/tower-of-hell/`.

KNOWN BUG (diagnosed, unfixed): `data/Tower of Hell/sections.json` has
`meta.display.sectionOrder = ["Vanilla Sections","Modded Sections","Purist Sections","Secret Sections"]`
but zero items actually landed in "Modded Sections" (the 41 modded pages were all also infobox `removed=Yes` or re-bucketed after the removed-filter). The verifier fails with:
`description_json key(s) do not match rendered sections: Modded Sections`.

Fix options (pick one):
- a) Remove "Modded Sections" from `sectionOrder` in the dataset AND remove the "Modded Sections" key from `description_json` in `tmp/content-workspace/tower-of-hell/collections/sections/final.json`, and drop the modded sentence from its `description_md`; or
- b) Re-bucket: some of the 30 "Secret Sections" and 328 vanilla rows genuinely belong to Modded (category `Modded Sections` on tower-of-hell.fandom.com); re-check membership before trusting (a).
Option (a) is safe and fast; the modded pool was mostly removed content.

Then:
```
kill dev server; rm -rf apps/web/.next; npm run dev:managed   # port 3000
npm run verify:game-collection-finals -- --base-url http://localhost:3000 --game tower-of-hell --final-json-root tmp/content-workspace/tower-of-hell/collections --collection sections --collection mutators
npm run audit:html-size -- --url http://localhost:3000/wiki/tower-of-hell/sections --fail-on-limit   # paginated: target weight 26_000 already set
npm run audit:html-size -- --url http://localhost:3000/wiki/tower-of-hell/mutators --fail-on-limit
# pagination checks on sections: /page/2 returns 200 + noindex,follow; not in /sitemaps/wiki.xml
```
Tick the two ToH backlog rows, commit.

## 2. BedWars — verify only (30 min)

State: datasets (kits 115, items 459) + images (572/574) committed, hub seeded, finals written and copy-checked at `tmp/content-workspace/bedwars/`. Pagination targets set: bedwars-kits 30_000, bedwars-items 26_000.

```
npm run verify:game-collection-finals -- --base-url http://localhost:3000 --game bedwars --final-json-root tmp/content-workspace/bedwars/collections --collection kits --collection items
npm run audit:html-size -- --url http://localhost:3000/wiki/bedwars/kits --fail-on-limit
npm run audit:html-size -- --url http://localhost:3000/wiki/bedwars/items --fail-on-limit
# pagination checks on both (see above)
```
Watch for the same empty-section class of error (kit sections: Fighter/Ranged/Support/Economy/Defender/Destroyer/Tank/Other all have items, so it should pass). `description_json` keys used in the finals: kits = Fighter, Economy, Destroyer, Other; items = Weapons, Blocks, Kit Items — all non-empty. Tick 2 rows, commit.

## 3. Steal an Egg + Grow a Chicken Fighter — finals, hubs, verify (1-2 h)

State: datasets committed and audited (`data/Steal an Egg/biomes.json` 9 rows imageless-by-design; `data/Grow a Chicken Fighter/eggs.json` 16 rows imageless-by-design). Registries wired. NOTHING ELSE exists yet: no briefs, no finals, no hub rows, universes NOT yet imported to managed dev.

Per game:
1. Import universe row prod→dev. The session used a scratchpad script; recreate simply: copy `roblox_universes` row (universe_id 10563114921 / 10338952197) from prod REST to dev REST, filtered to dev columns (env values in `.envs/targets/production.env` and the managed-dev env; see `dev-docs/environment.md`).
2. Write `tmp/content-workspace/<slug>/wiki/final.json` — shape: slug, title, seo_title, meta_description, universe_id, cover_image:null, tips_md, controls_json[], description_md (NOT game_description_md — seed script requires `description_md`). Copy shape from `tmp/content-workspace/bedwars/wiki/final.json`.
3. Write briefs + `final.json` per collection (`.agents/skills/bloxodes-game-collection-writing/SKILL.md` rules: no em dashes, q/a FAQ keys, "All {count} X in <Game>" title, no counts in prose, no self-reference).
   - steal-an-egg/biomes: display_name "Biomes". Source: Beebom https://beebom.com/all-steal-an-egg-biomes/ (guardians + speed floors already in the dataset).
   - grow-a-chicken-fighter/eggs: display_name "Eggs". Source: TechWiser https://techwiser.com/grow-a-chicken-fighter-eggs/ (hatch pools already in dataset).
4. `npm run content:check-copy -- <each final.json>`
5. `npm run seed:game-wiki-pages -- --game <slug> --final-json-root tmp/content-workspace`
6. Restart dev server (clear .next), then verifier + size gate per route.
7. Tick backlog rows (already ticked for these two — the datasets commit ticked them early; verify anyway), commit.

## 4. BlockSpin — full pipeline from scratch (2-3 h)

Universe 6765805766. Rows: Weapons, Vehicles. NOT started.
Sources (from the suggestions report `tmp/game-collection-suggestions/top50-wiki-gaps-2026-08-20.md`):
- Deltia's Gaming item guide (weapons + vehicles + equipment): https://deltiasgaming.com/block-spin-roblox-item-guide-list-of-vehicles-weapons-and-equipment/
- Fandom robloxblockspin.fandom.com is a 5-article shell but has a real Weapons page: https://robloxblockspin.fandom.com/wiki/Weapons
- Ignore block-spin.com and other AI-farm domains.
Two-source floor: re-verify rows across both sources before shipping; if the rosters disagree materially, block the row with a dated reason instead of guessing.
Pipeline: dataset v2 (`{meta, items[].item, items[].system}`, meta.schemaVersion 2, itemFields+columns+display with sectionOrder/cardFields/tableFields/fieldPresentation) → registry file `apps/web/src/lib/game-collections/games/blockspin.ts` + index.ts entry → audits → images (fandom weapons page may have some; Deltia images are copyrighted screenshots, prefer fandom or accept imageless) → briefs+finals → copy check → universe import + hub final + seed → verify + size gates → tick, commit.

## 5. Batch wrap-up (15 min)

- `npm run typecheck:web` (must exit 0)
- Add a batch results note under "## Top-50 wiki-gap batch" in the backlog doc (shipped/blocked per game, date, branch, "local only, not published").
- Commit docs. Publication stays with the owner via `$bloxodes-release-e2e` later.

## Conventions cheat-sheet (things that bit this session)

- Registry change => kill dev server + `rm -rf apps/web/.next` + restart, else new routes 404.
- v2 audit needs meta.schemaVersion=2, meta.columns, meta.itemFields covering every display field.
- Verifier failure "exited with code 1": run the underlying `npm run check:game-collection-data -- --game X --collection Y --final-json <path>` to see the real error.
- Empty sections listed in sectionOrder or description_json => verifier error (the ToH bug above).
- faq_json uses q/a keys. No em/en dashes anywhere (use " to " for ranges).
- `npm run content:check-copy` rejects "not just X but Y" contrast filler and page/catalog self-reference.
