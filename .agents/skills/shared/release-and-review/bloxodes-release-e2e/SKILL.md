---
name: bloxodes-release-e2e
description: Publish completed, user-approved Bloxodes work through a production PR and GitHub release jobs. Verify the deployed SHA or selected database content, synchronize clean local production, and clean up finished tasks after T3 releases their checkout. Use only for an explicit e2e or end-to-end production release request.
---

# Bloxodes release

You take completed, user-approved work to production: a PR into `production`, GitHub release jobs, verified deployment or content readback, a synced main checkout and cleanup of the finished task.

## Ground rules

- Stay in the T3-assigned task worktree.
- Use `dev-docs/operations/deployment.md` for current job ownership and credentials.
- Don't run local installs, checks, tests, builds or browser QA.

## Authority

- An explicit release request authorizes the current task's reviewed files and selected content.
- It doesn't authorize other drafts, whole-database copying, env edits, service changes, interrupted jobs or runtime activation.
- Preserve detached automation and rollback checkouts.

## Repository release

1. Inspect HEAD, the branch, status and the exact task diff. Preserve unrelated changes. Never create a second task checkout.
2. Stage only the explicit allowlist. Keep ignored env files, credentials, reports and build output out of git. Commit and push the task branch without force.
3. Open a PR targeting `production`. Link it to T3 immediately. Don't push directly to production or bypass protection.
   - Use an independent internal Codex review before opening a code PR.
   - Ready code PRs also get the selective GitHub review. Docs and skills-only PRs skip the paid action.
   - After fixes, request a fresh review with `gh workflow run codex-review.yml --ref production -f pull_request=<number>` and inspect its exact-head feedback. Don't expect every push to start a review.
4. Let `Pull request checks` run. Fix failures through task commits. GitHub owns dependency installs, managed-development schema verification, tests, builds and browser screenshots. Guidance-only PRs skip heavy work.
5. Use T3 `watch_pull_request` and end the turn while awaiting checks. A wake is evidence to inspect, not approval to merge. Require `Required PR checks` to pass and confirm the approved scope.
6. Merge with a merge commit so task ancestry stays available for cleanup. GitHub deletes the remote branch after merge.
7. The production workflow applies schema before the dependent web deployment.
   - It uses the same migration bytes verified in managed development, production history proof, rollback planning, exact-SHA gates and ledger readback.
   - Additions must work with the running app.
   - Remove obsolete columns or tables in a later release, after the old app stops using them.
8. For web changes, require the immutable merged SHA at `/api/health?scope=deploy` with a healthy database. Guidance, scripts and database content don't need a web build. Don't add a full crawl or purge.

## Selected database content

When new code is needed, release it first. Use the fixed publishers in `scripts/ci/content-contract.mjs`.

- **Committed batches** live at `content/releases/<batch>/batch.json`, with their reviewed files inside that directory. GitHub validates changed batches against development. After merge, run `node scripts/ci/dispatch-content.mjs <batch-path> <production-sha> apply`.
- **Larger or automated batches** use `dispatchContentBundle` in `scripts/ci/dispatch-content-bundle.ts`. It stores an immutable, private, hash-addressed bundle in managed development and dispatches the same production CI job. The bundle holds only selected finals, datasets, media and approval evidence. No source code, SQL, env files or user progress.
- **Article queue publication** uses the exact queue IDs through the article dispatcher. Wiki automation keeps its exact durable publishing request. Legacy processing requests also need their live lease. Only CI closes their publication receipts, after media, database and public readback pass.
- **`Publish selected content`** proves every selected publisher before writing, publishes its media and data, revalidates exact events and verifies each exact URL. It shares the production release lane and requires compatible live code.
- **Verification-only batches** can check existing URLs without writing. Don't create canary game pages or rewrite real content to test the pipeline.

Leave failed queue publication unfinished, and keep its frozen bundle for a guarded retry. A dispatch is not a published receipt.

## Synchronization and cleanup

1. Fast-forward the clean main `production` checkout to the merged SHA. Never reset a dirty checkout. No dependency install or local platform check is part of synchronization.
2. Keep the active T3 task checkout while this thread uses it.
3. After checking that the task is settled in T3 with no active run, release its shared game claims first.
4. Then, from another checkout, run `npm run cleanup:task-worktree -- --worktree <exact-finished-path> --released-sha <full-sha>`. Inspect its plan, then add `--apply --inactive-confirmed`.

What the cleanup helper does:

- It supports T3 HDD paths.
- It refuses checkout-owned private env files and unknown ignored data.
- It archives private scratch files with hash readback before removing the clean merged task.

Remote branches disappear automatically after merge. Unfinished tasks and detached runtimes stay.

Don't synchronize or activate installed automation runtimes as a side effect. A separate, explicit runtime change must preserve active jobs and their owned env.

## Receipt

Report the PR, merged SHA, required checks, deployment or content readback, main-checkout synchronization and any remaining credential or runtime boundary. Don't call a dispatch or an unverified rollout complete.
