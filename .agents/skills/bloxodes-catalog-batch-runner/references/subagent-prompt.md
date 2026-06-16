# Catalog Subagent Prompt Template

Use this template when assigning one catalog page to one subagent. Replace every placeholder before sending.

```text
You are responsible for exactly one Bloxodes game catalog page. Do not create or expand into any other page.

Target:
- Game: <GAME_NAME>
- Game slug: <GAME_SLUG>
- Universe ID: <UNIVERSE_ID>
- Collection: <COLLECTION_NAME>
- Collection slug: <COLLECTION_SLUG>
- Catalog code: <GAME_SLUG>-<COLLECTION_SLUG>
- Route: /wiki/<GAME_SLUG>/<COLLECTION_SLUG>
- Workspace: tmp/content-workspace/<GAME_SLUG>/catalogs/<COLLECTION_SLUG>/
- Parent batch tracker: tmp/content-workspace/<GAME_SLUG>/catalogs/batch-todo.md
- Discovery notes: tmp/content-workspace/<GAME_SLUG>/discovery/research-notes.md

Approved scope:
<APPROVED_SCOPE>

Known exclusions:
<KNOWN_EXCLUSIONS>

Required files and skills to read:
- .agents/skills/bloxodes-game-catalog-writing/SKILL.md
- .agents/skills/bloxodes-research/SKILL.md
- .agents/skills/bloxodes-flow-edit/SKILL.md
- .agents/skills/bloxodes-final-edit/SKILL.md
- agents/content/todo-templates/game-catalog.md
- agents/content/page-types/game-catalog-pages.md
- agents/wiki-catalog-workflow.md
- agents/content/research-policy.md
- agents/content/writing-core.md
- agents/content/flow-pass.md
- agents/content/final-edit.md
- the discovery notes listed above

Write scope:
- You may create/update only your catalog workspace:
  tmp/content-workspace/<GAME_SLUG>/catalogs/<COLLECTION_SLUG>/
- You may create/update only data/images for this collection when approved:
  data/<GAME_DATA_DIR>/<COLLECTION_DATA_FILE>
  apps/web/public/<GAME_IMAGE_DIR>/<COLLECTION_IMAGE_DIR>/
- Do not edit another collection.
- Do not edit shared route/config/collector files unless I explicitly approve that file ownership later. If shared config is needed, propose the exact change in research-notes.md.

Phase 1: planning only
1. Copy agents/content/todo-templates/game-catalog.md to your workspace as todo.md.
2. Create or update research-notes.md.
3. Research this one collection deeply enough to explain it as a game system.
4. Complete the player-usefulness gate: identify the primary player task, decisions supported, and what the reader should be able to do in-game after reading.
5. Build the required fact matrix: reader need, required facts, source status, local data/card status, and public placement. If source-backed useful facts are missing locally, mark `needs dataset update`.
6. Run a competitor/source usefulness check when SEO or traffic potential matters. Record useful questions, facts, sections, and where Bloxodes is weaker or stronger.
7. Audit local data, source count, item count, rendered/title count when available, image coverage, route/config state, row state, and required fact coverage.
8. Propose the data action, title promise, grouping axis, card fields, image plan, route/config plan, public content plan, and risks.
9. Stop. Do not write final.json, update datasets/images, import Supabase rows, or edit shared files until I approve the plan.

Your Phase 1 response must include:
- status: ready for approval | needs revision | blocked
- durable scope decision and exclusions
- primary player task and what the reader can do after reading
- required fact matrix with source/local/public placement status
- competitor/source usefulness coverage when relevant
- source list and confidence
- local/source/rendered/title counts, or what still needs checking
- image coverage and image-quality plan
- data action: ready as-is | needs dataset update | needs image update | blocked
- proposed visible title, seo_title, and exact title promise
- grouping axis and why it is best for players
- card fields to show and raw fields to hide
- intro_md / description_json / description_md / FAQ / wiki_md plan, with how_it_works_md left empty for normal wiki catalog pages
- public-copy plan: game/items only, no source/research/workflow/process caveats, short intro, player-question headings, natural same-universe links, and 3-4 non-repeating FAQs
- exact files you expect to edit in Phase 2
- questions or risks for parent review

Phase 2 starts only after I reply with approval.
When approved, complete only this catalog page:
- update approved data/images
- write final.json
- run FLOW pass
- run final edit
- verify JSON shape, counts, image paths, card fields, section labels, route/config assumptions, metadata, FAQ, and wiki_md
- update your todo.md and research-notes.md with verification results

Final response after Phase 2 must include:
- status: complete | blocked | needs parent fix
- files changed
- data count, source count, image coverage, and missing image count
- title and route
- verification checks run and results
- anything the parent must integrate, especially shared route/config changes

Non-negotiables:
- This is one catalog page only.
- Do not create codes/events data.
- Do not recommend temporary season pass reward tracks, one-off event reward lists, current ranked rewards, gamepasses, badges, servers, developer products, or platform metadata as catalogs.
- If an event/season/bundle/code/ranked source created durable items, keep that as an item field inside this catalog.
- UGC is allowed only if this target is the approved UGC exception.
- Do not hide missing data or weak images with generic public copy.
- Public copy must be evergreen and player-useful.
```
