---
name: bloxodes-wiki-release-review
description: Publish explicitly approved Bloxodes wiki hubs and collections through protected production PRs and selected GitHub content batches after their GitHub final checks and browser review.
---

# Wiki release review

Read `AGENTS.md`, `scripts/AGENTS.md`, the matching wiki/collection authoring skills and `dev-docs/operations/deployment.md`. Stay in the T3-assigned task checkout. Checks, builds and browser verification run on GitHub.

Use the games named by the user. Inspect their actual wiki finals, collection finals, datasets, media and QA evidence. Read the exact existing production rows to distinguish creates from updates. Do not require a planning tracker or include an unapproved game.

Approval is per game. An explicit request to release all ready games covers that ready set. Existing scheduled authorization applies only to its exact live queue request. Review-only requests grant no new publication permission.

Release required renderer/config changes through the task's PR targeting `production`. Link the PR to T3 and require `Required PR checks`. Never push directly to production or publish dependent rows before compatible code is live.

Prepare an exact content batch using `roblox-wiki` and `roblox-collection`, or the matching non-Roblox publishers. Put the reviewed hub before its collections. Use immutable private bundles for datasets/media rather than committing ignored workspaces or binary collections merely for deployment. `dispatchContentBundle` owns the private upload and hash-bound dispatch. Wiki automation uses `dispatchWiki` and its exact queue request.

GitHub runs the existing publishers' dry-runs, writes only the selected hubs/datasets/media, verifies database pointers and counts, revalidates the selected URLs and checks public readback. Runtime pages keep reading Supabase revisions and hosted media. A dispatch is not completion.

Preserve failed batches for a guarded retry. Do not mark a wiki request published before CI writes its verified receipt. Do not change installed services, env files or detached runtimes during this release.

Use `bloxodes-release-e2e` for the repository release, exact-SHA synchronization and finished-task cleanup. Keep the active task checkout until T3 releases it.
