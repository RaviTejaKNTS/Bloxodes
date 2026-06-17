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
- [ ] Choose discovery mode: catalog-only for catalog-page asks, or full coverage only when the user asks for all page families.
- [ ] Create or update `research-notes.md` in this folder.
- [ ] Note ambiguous similarly named games so coverage does not merge the wrong title.
- [ ] Check production DB or public production URLs before assuming any page or topic is new.
- [ ] Check local docs/source URL candidates only after the production coverage gate.

## Catalog-Only Mode

Use this section when the user asks what catalog pages can be made for a game, asks to check catalog pages, or asks for wiki catalog recommendations. Skip the full `Codes Check` and `Articles, Tools, Wiki, Checklist, Quiz` sections unless the user explicitly asks for full coverage.

- [ ] Check production `wiki_catalog_pages` first by universe ID, `wiki_slug`, `collection_slug`, `code`, title, route, old slug, and topic synonyms.
- [ ] Check public production URLs for existing `/wiki/<game-slug>/<collection-slug>` pages.
- [ ] Check `catalog_pages` only for global Roblox catalog overlap that would make a game-specific page duplicate.
- [ ] Check local datasets and route/config support after the production duplicate gate.
- [ ] Research trusted online sources for durable in-game collections: official/developer sources, Roblox experience page, game-specific wiki pages, Fandom or Miraheze when relevant, Game8, BloxInformer, Beebom, community databases, serious guide pages, videos/screenshots, and changelogs.
- [ ] Exclude current season tracks, one-off event rewards, ranked season rewards, generic update summaries, servers, gamepasses, badges, developer products, raw Roblox media, and platform metadata.
- [ ] Return only catalog decisions with `[create]`, `[we already have a page]`, or `[skip]`; do not use `maybe`, `could do`, `can do`, `potential`, or `nice to have`.
- [ ] For each catalog, record route, code, collection, items/systems included, player need, fields/grouping, existing page/data, and next data/source task.
- [ ] Add one short skipped-scope note for rejected gamepasses, badges, products, servers, events, raw media, global catalog duplicates, or weak ideas.
- [ ] Name the first catalog to build next and stop.

## Existing Coverage

- [ ] Run the production coverage gate first: search by universe ID, slug, title, route, old slugs, source URLs, item/system names, and topic synonyms.
- [ ] Check existing Bloxodes rows/pages by universe ID, slug, title, old slugs, and source URLs.
- [ ] Confirm whether the coverage audit is using live production, local Supabase, or the public site; use `NODE_ENV=production` for live DB checks, and do not recommend new topics from local-only evidence.
- [ ] For full coverage, audit codes, wiki, checklist, quiz, tools, catalogs, articles, and local datasets. For catalog-only mode, audit only catalog coverage, global catalog overlap, and local dataset/config support.
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
