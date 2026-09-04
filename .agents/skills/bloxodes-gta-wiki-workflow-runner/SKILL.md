---
name: bloxodes-gta-wiki-workflow-runner
description: Run one approved Bloxodes GTA wiki hub through research, parent review, writing, managed-development verification, and browser review. Use for new or updated GTA wiki hubs. Never publish production content.
---

# Bloxodes GTA wiki workflow runner

Run one GTA wiki hub at a time. The parent owns scope, source judgment, final review, verification, and the decision to stop.

## Safety boundary

- Work only in `tmp/content-workspace/gta/<game-slug>/wiki/<game-slug>/`, GTA application files required by the request, and managed development.
- Use `gta_games`, `gta_wiki_pages`, and their GTA views. Never use `roblox_universes`, `wiki_pages`, Roblox APIs, or `/wiki/<game-slug>` routes.
- Do not apply production migrations, write production rows, upload production media, deploy, merge, or invoke a release skill without later explicit approval.

## Worker handoff

When subagents are available and authorized, give one worker one hub. The worker must not spawn nested workers.

Research handoff:

- Read `.agents/skills/bloxodes-gta-wiki-research/SKILL.md` completely.
- Write only `brief.md` and wait for parent approval.

Writing handoff after approval:

- Read `.agents/skills/bloxodes-gta-wiki-writing/SKILL.md` completely.
- Read the approved brief.
- Write `game.json` and `final.json` for that hub only.

If subagents are unavailable, keep the same research and writing gates as separate passes.

## Workflow

1. Confirm the exact GTA game, editorial slug, requested mode scope, and whether the work is new or an update.
2. Check managed development and production for conflicting GTA slugs or an existing hub.
3. Run `bloxodes-gta-wiki-research` and review the brief.
4. Approve only when identity, release status, mode boundary, source proof, controls decision, and related-page inventory are sound.
5. Run `bloxodes-gta-wiki-writing` against the approved brief.
6. Review `game.json` and `final.json` for accuracy, plain language, correct scope, valid controls, and no future-page promises.
7. Start or reuse `npm run dev:managed`.
8. Verify:

```bash
npm run verify:gta-wiki-final -- \
  --base-url http://localhost:<port> \
  --game <game-slug> \
  --workspace tmp/content-workspace/gta/<game-slug>/wiki/<game-slug>
```

9. Open `/gta/wiki/<game-slug>` in the Browser at desktop and mobile widths.
10. Check title hierarchy, normal Bloxodes margins, no eyebrow text, readable body width, GTA-only sidebar links, collection CTA layout, overflow, broken images, metadata, canonical URL, and structured data. Confirm the wide cover is used for cards/social metadata and a distinct square-friendly R2 image is used beside the title.
11. Return the workspace paths, localhost URL, verifier result, browser result, blocked facts, and remaining risks.

## Parent checks

- Exact game identity and editorial slug are correct.
- `game.json` and `final.json` use the same slug.
- Story Mode, GTA Online, edition, platform, and release-state boundaries are explicit.
- Unreleased-game copy contains no rumor or trailer inference stated as fact.
- Controls are verified or `[]`.
- Public copy does not mention workflow, sources, databases, or planned pages.
- `game.json` has distinct, source-backed `cover_image` and `hero_image` values served from `https://media.bloxodes.com/wiki/...`.
- The page follows the existing Bloxodes wiki design with no GTA theme or eyebrow.
- The managed-development verifier and desktop/mobile review pass.

Stop before production.
