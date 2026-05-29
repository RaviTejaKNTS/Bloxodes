# Game Page Discovery Todo

Status: not started
Updated: YYYY-MM-DD
Workspace: `tmp/content-workspace/<game-slug>/discovery/`

## Use With

- Skill: `bloxodes-game-page-discovery`
- Core docs: `agents/content/PROCESS.md`, `agents/content/research-policy.md`
- Page docs as needed: `agents/content/page-types/*.md`

## Setup

- [ ] Confirm canonical game name, slug, place ID, universe ID, creator, and official Roblox URL.
- [ ] Create or update `research-notes.md` in this folder.
- [ ] Note ambiguous similarly named games so coverage does not merge the wrong title.
- [ ] Check local docs/source URL candidates before assuming the game is new.

## Existing Coverage

- [ ] Check existing Bloxodes rows/pages by universe ID, slug, title, old slugs, and source URLs.
- [ ] Confirm whether the coverage audit is using live production, local Supabase, or the public site; use `NODE_ENV=production` for live DB checks.
- [ ] Audit codes, wiki, events, checklist, quiz, tools, catalogs, and articles.
- [ ] Mark each page `skip`, `update`, `create`, `do not create`, or `blocked` with a short reason.
- [ ] Separate content gaps from data, image, route, or source-wiring blockers.

## Eligibility Checks

- [ ] Verify whether the game has a real codes system and supported RobloxDen/Beebom source wiring.
- [ ] Confirm codes data would be automation-owned only; do not collect current code names, counts, dates, or reward mappings.
- [ ] Verify whether the game has trackable events through `roblox_virtual_events` or another approved importer.
- [ ] Confirm events data would be automation-owned only; do not collect manual timeline rows or live event claims for prose.
- [ ] Record missing or weak source evidence instead of guessing.

## Catalog-Led Pass

- [ ] Research durable core in-game item collections first.
- [ ] Exclude current season tracks, one-off event rewards, ranked season rewards, generic update summaries, servers, gamepasses, badges, developer products, and platform metadata.
- [ ] Mark UGC only as a special catalog exception when the game has meaningful UGC items.
- [ ] For each catalog idea, record route, code, source count, local data state, image needs, primary player task, required facts, missing useful facts, grouping axis, card fields, and status.
- [ ] Separate core catalogs from later/data-heavy catalogs, UGC exceptions, second-pass ideas, and `do not create` ideas.
- [ ] Mark which catalog should become the first gold-standard page and why, including why its data can satisfy the player-usefulness gate.

## Second-Pass Page Opportunities

- [ ] Defer wiki/checklist/quiz/tool/article recommendations that depend on catalog data until that data exists.
- [ ] Identify tool opportunities only after checking real input/output value, gameplay need, and competing tools; otherwise hard-pass or mark potential future.
- [ ] Decide whether one combined checklist is useful only after enough durable systems are known.
- [ ] Decide whether a quiz has enough stable facts and outline easy/medium/hard areas.
- [ ] List only focused evergreen article opportunities that do not overlap codes, events, wiki, tools, checklists, quizzes, or catalogs.

## Finish

- [ ] Write a ranked two-pass build order and name the first gold-standard catalog/data/useful-facts step.
- [ ] Record sources checked and unresolved facts.
- [ ] Include next action for every `create`, `update`, and `blocked` recommendation.
- [ ] Return a concise summary with the research notes path.
