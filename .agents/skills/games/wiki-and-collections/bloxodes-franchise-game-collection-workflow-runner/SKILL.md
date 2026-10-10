---
name: bloxodes-franchise-game-collection-workflow-runner
description: Run one or many approved non-Roblox franchise collections through research, data, images, writing, managed-development publication, verification, size checks, and Browser review. Never publish production.
---

# Bloxodes franchise game collection workflow runner

You're the parent for approved collections in one non-Roblox franchise namespace. Workers build one collection at a time through research, data, images and writing. You judge every gate, own final verification and decide when a collection is done. Workers never approve their own work.

This workflow stops at managed development. It never touches production.

## Shared game storage

- **Tables:** managed development uses `games`, `game_wiki_pages`, `game_collection_pages`, `game_collection_datasets`, `game_collection_items`, `game_code_pages`, `game_codes` and `game_tool_pages`. Roblox stays separate.
- **Namespace:** scope every read and write by namespace. Use `gameDatabase(client, namespace)` for existing logical suffixes.
- **Kinds:** `games.kind` is only `franchise` or `game`. `parent_id` links a game to its franchise. Mode and edition labels describe content; they never add kinds.
- **Routes:** read the wiki row's `canonical_path` before planning collection links. A standalone game's wiki is `/<namespace>/wiki`. A franchise has its own wiki hub plus child game wikis. Keep Minecraft's edition URLs as they are.
- **Pages:** publish reviewed game, wiki, codes page and registered tool payloads with `publish:game-pages -- --namespace <slug> --file <reviewed.json>`. It's a dry run by default, and `--apply` writes only to development. Combined payloads need explicit IDs. Publish identity first, then the wiki, then collections.
- **Collections:** publish with `sync:shared-game-collection-runtime`, passing `--namespace` and the reviewed runtime manifest. Keep immutable dataset/media publication and pointer readback. Preserve drafts, revisions, sources, fields and media. Never edit published items.
- **Workspaces:** research stays in ignored workspaces.
- **Who owns what:** these general wiki and collection workflows cover standalone games and franchises. GTA specialists keep their mode, source, map and collectible rules under `namespace = 'gta'`.

## Required context

Keep one context record for the whole run:

- franchise name and namespace
- approved title and collection allowlist
- game and collection slugs, title kinds, parent titles and mode/content boundaries
- hub and collection route patterns
- collection workspace root and media root
- game, wiki, collection, dataset, item and progress tables/views
- official-source hierarchy and image policy
- data audit, checker, runtime sync, final verifier, HTML-size and export commands
- managed-development base URL and Browser route
- sitemap, search, cache, revalidation and progress ownership

Don't guess a route, table, command or source policy. If the target runtime isn't implemented, stop at the exact infrastructure blocker, or use only an explicitly authorized setup phase. Never quietly fall back to Roblox or another franchise's runtime.

## Scope and safety

- Work only on the approved title and collection allowlist.
- Keep campaign, online service, expansion, mode, edition, platform and release-generation scopes separate.
- Use managed development for authoring and preview.
- Never apply production migrations, write production rows, upload production media, deploy, merge, push or invoke a release skill from this workflow.
- If application or schema work is needed, report it as a separate, explicitly authorized dependency. Don't change it silently.

## Worker model

When subagents are available and authorized:

1. Give one collection to one research/data/image worker.
2. That worker can't spawn nested workers or run this parent skill.
3. Require parent approval at the research, data and image gates.
4. After image approval, use a new writing worker for `final.json`.
5. Queue the remaining collections when worker slots are full.

If subagents aren't available, run the same gates as separate passes. Never collapse research, data, images and writing into one unreviewed generation step.

## Handoffs

**Research worker**

- Read `.agents/skills/bloxodes-franchise-game-collection-research/SKILL.md` completely.
- Write `brief.md` only, then wait.

**Data worker** (after research approval)

- Read `.agents/skills/bloxodes-franchise-game-collection-data/SKILL.md` completely.
- Create or update `dataset.json` and `runtime-manifest.json`.
- Append data readiness to `brief.md`, then wait.

**Image worker** (after data approval)

- Read `.agents/skills/bloxodes-franchise-game-collection-images/SKILL.md` completely.
- Gather media, create or update `images.json`, wire dataset image paths, append image readiness, then wait.

**Writing worker** (after image approval)

- Read `.agents/skills/bloxodes-franchise-game-collection-writing/SKILL.md` completely.
- Read `.agents/skills/bloxodes-voice/SKILL.md` and the "Game collections" section of `.agents/skills/bloxodes-voice/references/examples.md`. That's how the copy should sound.
- Read the approved brief and dataset.
- Write only `final.json`, parse it and return it for parent review.

## Workflow

1. If the user gave no approved title or collection list, run the franchise wiki and collection suggestions steps first. Get explicit parent allowlists before creating pages.
2. Confirm each exact title, collection, slug, content scope, page type, order, and whether the work is new or an update.
3. Check managed development and production for exact duplicates and route conflicts.
4. Run the research gate for each collection.
5. Review roster proof, cross-checks, exclusions, mode and edition boundaries, fields, sections, page type, pagination expectation and image feasibility.
6. Approve, return for specific fixes, narrow with an explicit note, or block.
7. Run the data gate.
8. Review v2 shape, item counts, identity, public/system separation, sections, fields, display metadata, source URLs, runtime manifest `pageType`, audits and the runtime dry plan.
9. Run the image gate.
10. Review exact-match coverage, file quality, source records, dataset wiring, missing-image decisions and the image-required checker.
11. Run the writing gate with a fresh writer.
12. Review identity, title token, metadata, body, FAQs, hub blurb, section notes, voice, spoilers and scope separation (see "Writing gate").
13. Stage the reviewed workspace and runtime manifest for CI in a selected batch under `content/releases/<batch>/` (operation kind `franchise-collection` with the franchise namespace), or in a reviewed immutable bundle. Don't start a local preview, or run the verifier or HTML-size gate locally.
14. Run `Managed content QA` on GitHub with the exact committed batch or bundle. It publishes the immutable revision and page copy to managed development so the real route can render. It never authorizes production.
15. Review the job's screenshots and reports at desktop and mobile widths, including the HTML-size result.
16. For `database` collections, confirm the section dropdown, list/card switching, section navigation, pagination page 2, noindex/follow behavior and sitemap exclusion for paginated URLs.
17. For `collectible` collections, confirm the clean collectible renderer, local-first anonymous progress, account-saved progress when supported, search/filter/reset behavior, no card/list database switch, and page 2 returning 404 with the base URL canonical.
18. If the reports don't cover an interaction in steps 16 or 17, report it as an open QA gap instead of testing locally.
19. Check the title hub after collection publication. Its collection copy must appear before the shared image CTA, and the CTA must use real collection images.
20. Record the finished state in the approved roadmap or handoff doc when that doc is in scope.

## Research gate

Approve only when:

- title, collection, mode, edition, platform and release boundaries are clear
- one source supports the complete roster and another cross-checks it
- disputed facts are marked and kept out of hard fields
- the collection is durable and useful in the shared renderer
- the page type matches the player task
- fields answer real lookup or comparison needs
- sections use game-native categories
- image collection is feasible, or a text-only exception is justified
- the writer notes give plain player-language facts, the reader's real question and any hooks, with source talk and doubts kept in the private evidence sections

## Data gate

Approve only when:

- `meta.schemaVersion` is `2` and identity matches the manifest
- every row has `item.name`, a system slug, a section, a sort order and a planned image
- `items[].system` contains only `slug`, `section`, `sortOrder` and `image`
- public rows contain no source, scrape, verification, debug or internal system keys
- public values are short and exact, with no research wording like "reportedly" or "unconfirmed"
- item count, inclusion, exclusion, names and section counts match the sources
- field consistency, display metadata, field presentations, `sourceUrls` and `pageType` agree
- the generic audit and checker pass
- the context runtime-sync dry plan passes without an apply flag

## Image gate

Approve only when:

- images identify the exact item, location, character, mission or other row
- images aren't logos, screenshots, unrelated thumbnails, fan art or AI substitutes
- source URLs and caveats are recorded
- files exist under the workspace media folder and paths are wired to `items[].system.image`
- missing images are fixed or explicitly accepted item by item
- the image-required checker passes

## Writing gate

Check accuracy and structure:

- `display_name` is a short reusable label
- the title uses `All {count} <Collection> in <Game>` when natural
- no prose states a collection or section count
- `description_json` keys match real section labels
- FAQs use `q` and `a`
- `wiki_md` is specific, useful and count-free
- spoilers stay out of metadata and the intro
- separate content scopes don't leak into each other
- JSON parses and identity matches the runtime manifest

Then read it as a player and check it against `bloxodes-voice`:

- **Answer first.** The intro opens on something the player came for, not on the game's popularity or what the page covers.
- **Player voice.** It sounds like someone who plays, with real game nouns and an opinion the facts back. No manual or report tone.
- **Complete, not just clean.** The body uses the dataset's real numbers to answer what players need to choose well: early, mid and late picks and best-value options when the collection has a progression or price, plus how the system unlocks and the common mistakes, at least as well as the top-ranking guides. A few short "check the cost" sections is a fail.
- **No templates or research voice.** No "Welcome to", "In this guide", "according to sources", "reportedly" or hype words.
- **Public copy explains the game system,** never the site, sources, workflow or database.
- **No repeats.** Intro, section notes, FAQs and hub blurb each add something new.
- **Headings** say what's under them in words a player would search, without one repeated pattern.

Fix small wording issues yourself. Send it back to the writer when the gaps are bigger.

## Finish

Return:

- collections completed, blocked and still queued
- workspace paths and managed-development routes
- source roster count, dataset count and image coverage for each collection
- audit, checker, dry-plan, verifier, size-gate, pagination, collectible and Browser results
- accepted image or source gaps
- exact files changed outside ignored workspaces
- a clear statement that production was untouched

A collection isn't complete while any required gate is unresolved.
