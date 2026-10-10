---
name: bloxodes-franchise-wiki-workflow-runner
description: Run one or many approved non-Roblox franchise wiki hubs through research, parent review, writing, managed-development verification, and Browser review. Never publish production.
---

# Bloxodes franchise wiki workflow runner

You're the parent for approved title hubs in a non-Roblox franchise namespace, one hub at a time. You own scope, source judgment, final review, verification and the call to stop. Done means a verified hub on managed development that reads well on desktop and mobile.

- For Roblox titles, use the Roblox wiki runner instead.
- This workflow stops before production.

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

Before delegating, resolve one context record for the whole run:

- franchise name and namespace
- approved game/title allowlist and editorial slugs
- hub route pattern and workspace root
- game and wiki tables/views
- official-source hierarchy
- campaign, online-service, expansion, edition and platform boundaries
- final verifier, GitHub QA operation kind and namespace, and the hub route
- any progress endpoint/table and sitemap/cache/revalidation ownership

These are placeholders for the target franchise, not values to guess. If the route, table or verifier doesn't exist, stop at the exact infrastructure blocker, or run only an explicitly authorized setup phase. Never quietly fall back to Roblox or another franchise's runtime.

## Parent and worker rules

When subagents are available and authorized, give one worker one title. Workers can't spawn nested workers or run this parent workflow.

**Research handoff**

- Read `.agents/skills/bloxodes-franchise-wiki-research/SKILL.md` completely.
- Write only the title's `brief.md`.
- Wait for parent approval.

**Writing handoff** (after approval)

- Read `.agents/skills/bloxodes-franchise-wiki-writing/SKILL.md` completely.
- Read `.agents/skills/bloxodes-voice/SKILL.md` and the "Wiki hubs" section of `.agents/skills/bloxodes-voice/references/examples.md`. That's how the hub should sound.
- Read the approved brief.
- Write `game.json` and `final.json` for that title only.

If subagents aren't available, keep research and writing as separate parent-reviewed passes.

## Workflow

1. If the user gave no approved title list, run the franchise wiki suggestions step first and get the parent's title allowlist. Never turn a broad franchise request into unreviewed pages.
2. Confirm each exact title, slug, title kind, parent title, scope, and whether the work is new or an update.
3. Check managed development and production for conflicting rows, slugs and routes.
4. Run the research gate for one title.
5. Approve only when identity, release status, scope boundary, source proof, the controls decision and the related-page inventory are sound, and the brief gives the writer plain player-language facts, the reader's main question and any hooks.
6. Run the writing gate against the approved brief.
7. Review metadata, copy, controls, tips, scope and the no-future-promise rule, and check the voice (see "Parent checks").
8. Stage the reviewed workspace for CI in a selected batch under `content/releases/<batch>/` (operation kind `franchise-wiki` with the franchise namespace), or in a reviewed immutable bundle. Don't start a local preview or run the verifier locally.
9. Run `Managed content QA` on GitHub with the exact committed batch or bundle. It stages the hub in managed development, builds the site and renders the route on desktop and mobile. Don't pass production or allow-production flags. This skill stops before production.
10. Review the job's screenshots and reports: title hierarchy, normal Bloxodes margins, readable body width, target-franchise navigation and search scope, collection links, overflow, images, metadata, canonical URL and structured data. If the reports don't cover one of these, report it as an open QA gap instead of testing locally.
11. Return workspace paths, the GitHub artifact links, the QA result, blocked facts and remaining risks.

## Parent checks

Accuracy and scope:

- Exact title identity and editorial slug are correct.
- Story/campaign, online-service, expansion, edition, platform and release-state boundaries are explicit.
- Unreleased copy states no rumor, leak or trailer inference as fact.
- Controls are verified or `[]`.
- Public copy never mentions workflow, sources, databases or planned pages.
- The page follows the existing Bloxodes wiki design without a forced franchise theme.
- The GitHub `Managed content QA` job and the desktop/mobile screenshot review pass.

Voice, checked against `bloxodes-voice`:

- **Answer first.** `description_md` opens on what the player actually does and how the game moves forward, not on popularity or a "welcome" line.
- **Player voice.** Real game nouns, short sentences, the occasional sharp line. No manual or report tone.
- **Complete, not just clean.** Tips name real buildings, items, prices or unlocks with a reason, and the description names the actual systems. If the brief lacks those specifics, send it back for research. Short and vague is a fail.
- **No templates or research voice.** No "In this guide", "X is a popular game where", "according to sources", "reportedly" or hype words.
- **Useful tips.** Each tip changes what a player does. No "make sure to have fun" filler.
- **No repeats** between the description, tips and any FAQs.
- **Headings** say what's under them in words a player would search.

Fix small wording issues yourself. Send it back to the writer when the gaps are bigger.
