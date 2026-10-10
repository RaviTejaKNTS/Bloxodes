---
name: bloxodes-wiki-release-review
description: Publish explicitly approved Bloxodes wiki hubs and collections through protected production PRs and selected GitHub content batches after their GitHub final checks and browser review.
---

# Wiki release review

You publish explicitly approved wiki hubs and collections through protected production PRs and selected GitHub content batches, after their GitHub final checks and browser review.

## Before you start

- Read `AGENTS.md`, `scripts/AGENTS.md`, the matching wiki and collection authoring skills, and `dev-docs/operations/deployment.md`.
- Stay in the T3-assigned task checkout.
- Checks, builds and browser verification run on GitHub.

## Review what you're releasing

1. Use the games the user named.
2. Inspect their actual wiki finals, collection finals, datasets, media and QA evidence.
3. Read the public copy against `.agents/skills/bloxodes-voice/SKILL.md`: an answer-first opening, a player's voice, no template openings, research voice, hype, filler or repeated facts, and headings that say what's under them. Report any problems before release.
4. Read the exact existing production rows to tell creates from updates.
5. Don't require a planning tracker, and don't include an unapproved game.

## Approval

- Approval is per game.
- An explicit request to release all ready games covers that ready set.
- Existing scheduled authorization applies only to its exact live queue request.
- Review-only requests grant no new publication permission.

## Code first

- Release required renderer or config changes through the task's PR targeting `production`.
- Link the PR to T3 and require `Required PR checks`.
- Never push directly to production, and never publish dependent rows before compatible code is live.

## Content batch

1. Prepare an exact content batch using `roblox-wiki` and `roblox-collection`, or the matching non-Roblox publishers.
2. Put the reviewed hub before its collections.
3. Use immutable private bundles for datasets and media. Don't commit ignored workspaces or binary collections just for deployment.
4. `dispatchContentBundle` owns the private upload and hash-bound dispatch. Wiki automation uses `dispatchWiki` and its exact queue request.

## What GitHub does

1. It first stages the exact frozen inputs in managed development and records browser QA.
2. Production requires the matching successful receipt.
3. It runs the existing publishers' dry-runs, then writes only the selected hubs, datasets and media.
4. It verifies database pointers and counts, revalidates the selected URLs and checks public readback.

Runtime pages keep reading Supabase revisions and hosted media. A dispatch is not completion.

## Failures and limits

- Preserve failed batches for a guarded retry.
- Don't mark a wiki request published before CI writes its verified receipt.
- Don't change installed services, env files or detached runtimes during this release.

## Hand off

Use `bloxodes-release-e2e` for the repository release, exact-SHA synchronization and finished-task cleanup. Keep the active task checkout until T3 releases it.
