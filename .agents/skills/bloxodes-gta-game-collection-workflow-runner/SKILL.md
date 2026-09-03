---
name: bloxodes-gta-game-collection-workflow-runner
description: Run one or many approved Bloxodes GTA collections through research, data, images, writing, managed-development publication, verification, size checks, and browser review. Use for GTA wiki collection work. Never publish production.
---

# Bloxodes GTA game collection workflow runner

This is the parent workflow for approved GTA collections. The parent judges every gate and owns the final verification. Workers produce one collection at a time and do not decide their own approval.

## Scope and safety

- Work only on the GTA game and collection allowlist supplied by the user or approved roadmap.
- Use `/gta/wiki/<game-slug>/<collection-slug>` and `tmp/content-workspace/gta/<game-slug>/collections/<collection-slug>/`.
- Use `gta_games`, `gta_wiki_pages`, `gta_wiki_collection_pages`, `gta_wiki_collection_datasets`, and `gta_wiki_collection_items`.
- Never require `roblox_universes`, call Roblox APIs for item rows, write Roblox wiki tables, register `GAME_COLLECTIONS`, use `/wiki/...`, or run the Roblox collection verifier.
- Managed-development publication is part of the local preview workflow. Production publication is not. Do not pass `--allow-prod`, use a production env profile, apply production migrations, deploy, merge, push, or invoke a release skill.

## Worker model

When subagents are available and authorized:

1. Give one collection to one research/data/image worker.
2. That worker may not spawn nested workers or run this parent skill.
3. Require a parent response at the research, data, and image gates.
4. After image approval, use a new writing worker for `final.json`.
5. Queue remaining collections when worker slots are full.

If subagents are unavailable, perform the same gates as separate passes. Do not collapse research, data, images, and writing into one unreviewed generation step.

## Handoffs

Research worker:

- Read `.agents/skills/bloxodes-gta-game-collection-research/SKILL.md` fully.
- Write `brief.md` only and wait.

Data worker after research approval:

- Read `.agents/skills/bloxodes-gta-game-collection-data/SKILL.md` fully.
- Create or update `dataset.json` and `runtime-manifest.json`.
- Append data readiness to `brief.md` and wait.

Image worker after data approval:

- Read `.agents/skills/bloxodes-gta-game-collection-images/SKILL.md` fully.
- Gather media, create or update `images.json`, wire dataset image paths, append image readiness, and wait.

Writing worker after image approval:

- Read `.agents/skills/bloxodes-gta-game-collection-writing/SKILL.md` fully.
- Read the approved brief and dataset.
- Write only `final.json`, parse it, and return it for parent review.

## Workflow

1. Confirm the exact GTA game, hub row, collection list, order, mode scope, and editorial slugs.
2. Record the explicit collection allowlist. Do not add adjacent ideas.
3. Check managed development and production for exact collection duplicates or route conflicts.
4. Run the research gate for each collection.
5. Review roster proof, cross-checks, exclusions, game-mode and edition boundaries, useful fields, sections, pagination expectation, and image feasibility.
6. Approve, return for specific fixes, narrow with an explicit note, or block.
7. Run the data gate.
8. Review dataset count against sources, v2 shape, identity, public/system separation, sections, field consistency, display metadata, source URLs, runtime manifest, audits, and GTA dry plan.
9. Run the image gate.
10. Review exact-match coverage, file quality, source records, dataset wiring, missing-image decisions, and the image-required checker.
11. Run the writing gate with a fresh writer.
12. Review identity, title token, metadata, body, FAQs, hub blurb, section notes, tone, spoilers, and Story Mode/Online separation.
13. Start or reuse `npm run dev:managed`.
14. Verify the collection. This command intentionally writes the immutable revision, images, page copy, and dataset pointer to managed development so the local route can render the real runtime path:

```bash
npm run verify:gta-collection-final -- \
  --base-url http://localhost:<port> \
  --game <game-slug> \
  --collection <collection-slug> \
  --workspace tmp/content-workspace/gta/<game-slug>/collections/<collection-slug>
```

15. Run:

```bash
npm run audit:html-size -- \
  --url http://localhost:<port>/gta/wiki/<game-slug>/<collection-slug> \
  --fail-on-limit
```

16. Open the route in the Browser at desktop and mobile widths.
17. Check the wiki hub after publication. Its collection copy must appear before the shared image CTA, and the CTA must use real collection images.
18. Record the finished state in the approved roadmap or handoff document.

## Research gate

Approve only when:

- The exact game, mode, edition, and collection boundaries are clear.
- One source supports the complete roster and another source cross-checks it.
- Disputed or soft facts are marked and excluded from hard fields.
- The collection is durable and useful in the shared renderer.
- The proposed fields answer real lookup or comparison needs.
- Sections use game-native categories.
- Image collection is feasible or a text-only exception is justified.

## Data gate

Approve only when:

- `meta.schemaVersion` is `2` and identity matches the manifest.
- Every row has `item.name`, system slug, section, sort order, and planned image.
- `items[].system` contains only `slug`, `section`, `sortOrder`, and `image`.
- Public rows contain no source, scrape, verification, debug, or internal system keys.
- Item count, inclusion, exclusion, names, and section counts match the sources.
- Fields stay consistent across rows and unknown values remain empty instead of guessed.
- `meta.itemFields`, columns, display fields, section order, card/table fields, and field presentation agree.
- The generic audit and checker pass.
- `sync:gta-collection-runtime` dry plan passes without an apply flag.

## Image gate

Approve only when:

- Images identify the exact item, location, character, mission, or other row.
- Images are not logos, page screenshots, unrelated thumbnails, fan art, or AI substitutes.
- Source URLs and caveats are recorded.
- Files exist under the workspace `media/` folder and paths are wired to `items[].system.image`.
- Missing images are fixed or explicitly accepted item by item.
- The image-required checker passes.

## Writing gate

Approve only when:

- `display_name` is a short reusable label.
- `title` uses `All {count} <Collection> in <Game>` where natural and clarifies Story Mode when needed.
- No prose states a collection or section count.
- Public copy explains the game system, not the site or workflow.
- `description_json` keys match real section labels.
- FAQs use `q` and `a`.
- `wiki_md` is specific, useful, and count-free.
- Spoilers are kept out of metadata and intro.
- GTA Online facts do not leak into Story Mode collections.
- JSON parses and identity matches the runtime manifest.

## Browser and pagination gate

Check:

- Normal Bloxodes margins, typography, cards, list view, controls, and spacing.
- No eyebrow text or custom GTA theme.
- GTA sidebar has no Roblox Wiki link or empty GTA tools link.
- No horizontal overflow or broken images at desktop and mobile widths.
- Search, section dropdown, and card/list switch work.
- Every source-backed public field appears in both card and list views as intended.
- Pagination page 2 returns 200 when required and uses `noindex, follow`.
- Section navigation can reach a section that starts on another page.
- Paginated URLs stay out of `/sitemaps/gta.xml`.
- Canonical, metadata, JSON-LD, and base collection route are correct.

## Finish

Return:

- Collections completed, blocked, and still queued.
- Workspace paths and managed-development routes.
- Source roster count, dataset count, and image coverage for each collection.
- Audit, checker, dry-plan, verifier, size-gate, pagination, and browser results.
- Accepted image or source gaps.
- Exact files changed outside ignored workspaces.
- A clear statement that production was untouched.

Do not call a collection complete while any required gate is unresolved.
