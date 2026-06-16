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
- [ ] Check production DB or public production URLs before assuming any page or topic is new.
- [ ] Check local docs/source URL candidates only after the production coverage gate.

## Existing Coverage

- [ ] Run the production coverage gate first: search by universe ID, slug, title, route, old slugs, source URLs, item/system names, and topic synonyms.
- [ ] Check existing Bloxodes rows/pages by universe ID, slug, title, old slugs, and source URLs.
- [ ] Confirm whether the coverage audit is using live production, local Supabase, or the public site; use `NODE_ENV=production` for live DB checks, and do not recommend new topics from local-only evidence.
- [ ] Audit codes, wiki, checklist, quiz, tools, catalogs, articles, and local datasets.
- [ ] Mark existing pages as `[we already have a page]` only when the page is truly present for the correct game.
- [ ] Reject duplicate article/catalog/tool/checklist/quiz/wiki ideas already covered in production, then look for uncovered topics.
- [ ] Note missing or stale page/data work in the next-action column, not as a blocker status.

## Codes Check

- [ ] Verify whether the game has a real codes system and supported RobloxDen/Beebom source wiring.
- [ ] Confirm codes data would be automation-owned only; do not collect current code names, counts, dates, or reward mappings.
- [ ] Decide `[must create]`, `[have to create]`, `[we already have a page]`, or `[does not have codes system]`.
- [ ] Record source URL gaps instead of guessing.

## Catalog Pages

- [ ] Research all durable core in-game item collections that deserve catalog pages.
- [ ] Gather catalog evidence from online sources: developer sources, Roblox experience pages, community wikis/databases, guides, videos, screenshots, changelogs, and competitor/source pages.
- [ ] Do not use Roblox API item availability as the data source or blocker; APIs are only for identity, metadata, thumbnails, or cross-checks.
- [ ] Exclude current season tracks, one-off event rewards, ranked season rewards, generic update summaries, servers, gamepasses, badges, developer products, and platform metadata.
- [ ] Mark UGC only as a special catalog exception when the game has meaningful UGC items.
- [ ] For each catalog, record route, code, status label, items/systems included, player need, card fields/grouping, existing page/data, and next action.
- [ ] Use `[must create]`, `[have to create]`, or `[we already have a page]`; do not use `blocked` because data still needs to be gathered.
- [ ] Mark which catalog should be built first and what item/source/image work it needs.

## Articles, Tools, Wiki, Checklist, Quiz

- [ ] List article topics that make coverage complete without repeating codes, wiki, catalogs, checklist, quiz, or tools.
- [ ] Include priority, ranking, mechanic, comparison, mistake, progression, route, location, unlock, opinionated, experience-based, tutorial, and player-advice article angles when they fit.
- [ ] Reject Discord/Trello/wiki link pages and `All <core items>` article ideas; those belong outside articles, usually as wiki/catalog coverage.
- [ ] If every article idea is a how-to guide, rerun topic discovery across non-how-to search intents before finalizing.
- [ ] Identify tool opportunities only after checking real input/output value, gameplay need, and competing tools; otherwise mark `[no tool recommended]`.
- [ ] Mark wiki, checklist, and quiz as `[create]` or `[we already have a page]`.
- [ ] Skip event pages in this workflow; add only a short note if event evidence exists.

## Finish

- [ ] Write a ranked build order and name the first catalog/page to build next.
- [ ] Record sources checked and unresolved ambiguity.
- [ ] Include next action for every `[must create]`, `[have to create]`, and `[create]` recommendation.
- [ ] Return a concise summary with the research notes path.
