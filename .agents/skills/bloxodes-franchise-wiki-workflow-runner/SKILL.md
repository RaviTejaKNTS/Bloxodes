---
name: bloxodes-franchise-wiki-workflow-runner
description: Run one or many approved non-Roblox franchise wiki hubs through research, parent review, writing, managed-development verification, and Browser review. Never publish production.
---

# Bloxodes franchise wiki workflow runner

Run one approved title hub at a time. The parent owns scope, source judgment, final review, verification, and the decision to stop. This runner is for non-Roblox franchise namespaces; use the Roblox wiki runner for Roblox titles.

## Required context

Before delegating, resolve and keep one context record for the whole run:

- franchise name and namespace
- approved game/title allowlist and editorial slugs
- hub route pattern and workspace root
- game and wiki tables/views
- official-source hierarchy
- campaign, online-service, expansion, edition, and platform boundaries
- managed-development command, final verifier, local preview base, and Browser route
- any progress endpoint/table and sitemap/cache/revalidation ownership

These are placeholders for the target franchise, not values to guess. If the route, table, or verifier does not exist, stop at the exact infrastructure blocker or run only the explicitly authorized setup phase. Do not silently use Roblox or another franchise's runtime.

## Parent and worker rules

When subagents are available and authorized, give one worker one title. The worker must not spawn nested workers or run this parent workflow.

Research handoff:

- Read .agents/skills/bloxodes-franchise-wiki-research/SKILL.md completely.
- Write only the title's brief.md.
- Wait for parent approval.

Writing handoff after approval:

- Read .agents/skills/bloxodes-franchise-wiki-writing/SKILL.md completely.
- Read the approved brief.
- Write game.json and final.json for that title only.

If subagents are unavailable, keep research and writing as separate parent-reviewed passes.

## Workflow

1. If the user supplied no approved title list, run the franchise wiki suggestions step first and obtain the parent's title allowlist. Do not turn a broad franchise request into unreviewed pages.
2. Confirm each exact title, slug, title kind, parent title, scope, and whether the work is new or an update.
3. Check managed development and production for conflicting rows, slugs, and routes.
4. Run the research gate for one title.
5. Approve only when identity, release status, scope boundary, source proof, controls decision, and related-page inventory are sound.
6. Run the writing gate against the approved brief.
7. Review metadata, copy, controls, tips, scope, and no-future-promise rules.
8. Start or reuse the target managed-development preview command. Bind it according to the repository instructions.
9. Run the context-provided final verifier:

~~~bash
<wiki-verifier-command> --base-url <managed-dev-base-url> --game <game-slug> --workspace <workspace>
~~~

Do not pass production or allow-production flags unless a later, explicit release workflow authorizes them. This skill stops before production.

10. Open the verified hub route in Browser at desktop and mobile widths.
11. Check title hierarchy, normal Bloxodes margins, readable body width, target-franchise navigation/search scope, collection links, overflow, images, metadata, canonical URL, and structured data.
12. Return workspace paths, managed-development URL, verifier result, Browser result, blocked facts, and remaining risks.

## Parent checks

- Exact title identity and editorial slug are correct.
- Story/campaign, online-service, expansion, edition, platform, and release-state boundaries are explicit.
- Unreleased copy contains no rumor, leak, or trailer inference stated as fact.
- Controls are verified or [].
- Public copy does not mention workflow, sources, databases, or planned pages.
- The page follows the existing Bloxodes wiki design without a forced franchise theme.
- The managed-development verifier and desktop/mobile review pass.
