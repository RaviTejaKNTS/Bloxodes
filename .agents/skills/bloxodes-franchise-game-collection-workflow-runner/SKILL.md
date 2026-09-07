---
name: bloxodes-franchise-game-collection-workflow-runner
description: Run one or many approved non-Roblox franchise collections through research, data, images, writing, managed-development publication, verification, size checks, and Browser review. Never publish production.
---

# Bloxodes franchise game collection workflow runner

This is the parent workflow for approved collections in one non-Roblox franchise namespace. The parent judges every gate and owns final verification. Workers produce one collection at a time and do not decide their own approval.

## Required context

Keep one context record for the run:

- franchise name and namespace
- approved title and collection allowlist
- game and collection slugs, title kinds, parent titles, and mode/content boundaries
- hub and collection route patterns
- collection workspace root and media root
- game, wiki, collection, dataset, item, and progress tables/views
- official-source hierarchy and image policy
- data audit, checker, runtime sync, final verifier, HTML-size, and export commands
- managed-development base URL and Browser route
- sitemap, search, cache, revalidation, and progress ownership

Do not guess a route, table, command, or source policy. If the target runtime is not implemented, stop at the exact infrastructure blocker or use only an explicitly authorized setup phase. Do not silently use Roblox or another franchise's runtime.

## Scope and safety

- Work only on the approved title and collection allowlist.
- Keep campaign, online service, expansion, mode, edition, platform, and release-generation scopes separate.
- Use managed development for authoring and preview. Never apply production migrations, write production rows, upload production media, deploy, merge, push, or invoke a release skill from this workflow.
- If application or schema work is required, report it as a separate explicitly authorized dependency rather than changing it silently.

## Worker model

When subagents are available and authorized:

1. Give one collection to one research/data/image worker.
2. That worker may not spawn nested workers or run this parent skill.
3. Require parent approval at research, data, and image gates.
4. After image approval, use a new writing worker for final.json.
5. Queue remaining collections when worker slots are full.

If subagents are unavailable, perform the same gates as separate passes. Do not collapse research, data, images, and writing into one unreviewed generation step.

## Handoffs

Research worker:

- Read .agents/skills/bloxodes-franchise-game-collection-research/SKILL.md completely.
- Write brief.md only and wait.

Data worker after research approval:

- Read .agents/skills/bloxodes-franchise-game-collection-data/SKILL.md completely.
- Create or update dataset.json and runtime-manifest.json.
- Append data readiness to brief.md and wait.

Image worker after data approval:

- Read .agents/skills/bloxodes-franchise-game-collection-images/SKILL.md completely.
- Gather media, create or update images.json, wire dataset image paths, append image readiness, and wait.

Writing worker after image approval:

- Read .agents/skills/bloxodes-franchise-game-collection-writing/SKILL.md completely.
- Read the approved brief and dataset.
- Write only final.json, parse it, and return it for parent review.

## Workflow

1. If the user supplied no approved title or collection list, run the franchise wiki and collection suggestions steps first. Obtain explicit parent allowlists before creating pages.
2. Confirm each exact title, collection, slug, content scope, page type, order, and whether the work is new or an update.
3. Check managed development and production for exact duplicates and route conflicts.
4. Run the research gate for each collection.
5. Review roster proof, cross-checks, exclusions, mode and edition boundaries, fields, sections, page type, pagination expectation, and image feasibility.
6. Approve, return for specific fixes, narrow with an explicit note, or block.
7. Run the data gate.
8. Review v2 shape, item counts, identity, public/system separation, sections, fields, display metadata, source URLs, runtime manifest pageType, audits, and runtime dry plan.
9. Run the image gate.
10. Review exact-match coverage, file quality, source records, dataset wiring, missing-image decisions, and the image-required checker.
11. Run the writing gate with a fresh writer.
12. Review identity, title token, metadata, body, FAQs, hub blurb, section notes, tone, spoilers, and scope separation.
13. Start or reuse the managed-development preview.
14. Run the context-provided final verifier:

~~~bash
<collection-verifier-command> --base-url <managed-dev-base-url> --game <game-slug> --collection <collection-slug> --workspace <workspace>
~~~

The verifier may publish the immutable revision and page copy to managed development so the real route can render. It must not authorize production.

15. Run the context-provided HTML-size gate:

~~~bash
<html-size-command> --url <collection-route> --fail-on-limit
~~~

16. Open the route in Browser at desktop and mobile widths.
17. For database collections, verify the section dropdown, list/card switching, section navigation, pagination page 2, noindex/follow behavior, and sitemap exclusion for paginated URLs.
18. For collectible collections, verify the clean collectible renderer, local-first anonymous progress, account-saved progress when supported, search/filter/reset behavior, no card/list database switch, and page 2 returning 404 with the base URL canonical.
19. Check the title hub after collection publication. Its collection copy must appear before the shared image CTA and the CTA must use real collection images.
20. Record the finished state in the approved roadmap or handoff document when that document is in scope.

## Research gate

Approve only when:

- title, collection, mode, edition, platform, and release boundaries are clear
- one source supports the complete roster and another cross-checks it
- disputed facts are marked and excluded from hard fields
- the collection is durable and useful in the shared renderer
- page type matches the player task
- fields answer real lookup or comparison needs
- sections use game-native categories
- image collection is feasible or a text-only exception is justified

## Data gate

Approve only when:

- meta.schemaVersion is 2 and identity matches the manifest
- every row has item.name, system slug, section, sort order, and planned image
- items[].system contains only slug, section, sortOrder, and image
- public rows contain no source, scrape, verification, debug, or internal system keys
- item count, inclusion, exclusion, names, and section counts match sources
- field consistency, display metadata, field presentations, sourceUrls, and pageType agree
- the generic audit and checker pass
- the context runtime-sync dry plan passes without an apply flag

## Image gate

Approve only when:

- images identify the exact item, location, character, mission, or other row
- images are not logos, screenshots, unrelated thumbnails, fan art, or AI substitutes
- source URLs and caveats are recorded
- files exist under workspace media and paths are wired to items[].system.image
- missing images are fixed or explicitly accepted item by item
- the image-required checker passes

## Writing gate

Approve only when:

- display_name is a short reusable label
- title uses All {count} <Collection> in <Game> when natural
- no prose states a collection or section count
- public copy explains the game system, not the site or workflow
- description_json keys match real section labels
- FAQs use q and a
- wiki_md is specific, useful, and count-free
- spoilers are kept out of metadata and intro
- separate content scopes do not leak into one another
- JSON parses and identity matches the runtime manifest

## Finish

Return:

- collections completed, blocked, and still queued
- workspace paths and managed-development routes
- source roster count, dataset count, and image coverage for each collection
- audit, checker, dry-plan, verifier, size-gate, pagination, collectible, and Browser results
- accepted image or source gaps
- exact files changed outside ignored workspaces
- a clear statement that production was untouched

Do not call a collection complete while any required gate is unresolved.
