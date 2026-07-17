---
name: bloxodes-release-e2e
description: Release completed Bloxodes work from the current worktree through the correct production path, including scoped checks, commit, PR, required quality gate, merge, deployment or database publication, live verification, local production synchronization, and safe branch/worktree cleanup. Use only when the user explicitly invokes `$bloxodes-release-e2e` or explicitly asks for an `e2e` or `end-to-end` production release. Do not use for ordinary requests to push, commit, open a PR, deploy, or publish unless the user explicitly says e2e/end-to-end.
---

# Bloxodes Release E2E

Finish one completed worktree without making the user manage Git, GitHub, deployment, local synchronization, or cleanup. Select the smallest correct release path and preserve every intended change while excluding secrets and disposable files.

## Read First

1. Read `AGENTS.md` and every closer `AGENTS.md` that governs changed files.
2. Read `docs/testing/content-release-runbook.md`.
3. For database publication, read and follow the relevant Bloxodes content skill. Also read `supabase/AGENTS.md` for schema or migration work.
4. Treat those sources as authoritative when commands or release requirements differ from this orchestration skill.

## Invocation And Authority

Treat explicit invocation as authorization to complete the normal release operations for the already-scoped work:

- commit the intended files;
- push the temporary branch;
- create or reuse a ready pull request;
- wait for required checks and merge after they pass;
- let the existing production workflow deploy when selected;
- perform an explicitly prepared database publication when it is part of the task;
- verify production;
- synchronize the local `production` worktree; and
- delete only the released temporary branch and current worktree when safe.

Do not pause for confirmation between those routine steps. Do not expand the task, publish unrelated queued content, weaken a check, force a merge, or make unrelated infrastructure changes.

## Completion Contract

Do not call the release complete until every applicable statement is true:

- GitHub `production` contains the intended repository changes.
- The selected production deployment completed and the live SHA/database health are correct, or the change was correctly classified as requiring no web image deployment.
- Every intended database write was read back and its exact public URL was verified.
- The main local `production` worktree matches `origin/production` without altering unrelated local work.
- The released temporary branch and release worktree are removed; the main production worktree is retained.
- No intended work was discarded and no unrelated file was released.

## 1. Establish The Worktree And Scope

1. Record the current root, branch, HEAD, status, and all registered worktrees:

```bash
git rev-parse --show-toplevel
git branch --show-current
git rev-parse HEAD
git status --short
git worktree list --porcelain
```

2. Locate the worktree whose branch is `refs/heads/production`. This is the main local production worktree to synchronize after merging. If it cannot be identified, stop.
3. If the current worktree is already a temporary task worktree, use it. Never create a nested or second worktree for the same task.
4. If the current worktree is the main `production` worktree, create one temporary release branch and worktree before staging or committing:
   - build and record the explicit release allowlist first;
   - fetch `origin` and use `origin/production` as the clean branch/worktree base;
   - create the temporary branch with the repository's required branch prefix;
   - transfer only allowlisted tracked changes, new files, directories, and symlinks into the temporary worktree;
   - preserve file modes and symlink targets;
   - compare the transferred paths with their source versions before removing them from local production;
   - restore or move only the transferred allowlisted paths out of the production worktree, leaving every unrelated local change untouched; and
   - continue the release from the temporary worktree.

Do not use a stash, whole-repository copy, broad patch, or another agent's branch to perform this transfer. Other worktrees and branches may contain unfinished changes; they must not enter the release branch unless they are explicitly on the allowlist.
5. Inspect tracked changes, untracked files, staged changes, commits ahead of `origin/production`, and task-related ignored outputs. Avoid recursively listing `node_modules` or build caches.
6. Build an explicit release allowlist. Never use `git add .` or `git add -A`.
7. Treat `.env*`, `node_modules`, `.next`, coverage, logs, test reports, and generated caches as local-only. Never commit them.
8. Inspect `tmp/` carefully. A content payload there may be needed for a database publication, but `tmp/` must not be committed merely to preserve it.
9. Stop when an untracked, ignored, staged, or committed file has unclear ownership or purpose. If unrelated changes exist on local production, leave them exactly where they are. Stop later if they prevent a safe production fast-forward.

If the worktree has a detached HEAD, create one appropriately named temporary branch for the current task. Do not create a second worktree.

## 2. Classify The Release

Choose one path from the actual changes and task outcome:

### Repository release

Use for tracked code, bundled datasets, public assets, scripts, docs, workflows, mobile, extension, or Supabase migration files. Create a PR and require `quality`.

Only web code, `data/`, `apps/web/src/data/`, `apps/web/public/`, Docker, or dependency changes select a web image deployment. For docs or other non-web changes, confirm the deploy classifier skipped the web deployment; do not force a meaningless deploy.

### Database-only publication

Use when production already has the renderer, data, and assets and the only intended live change is database-owned content. Follow the existing content skill: production dry-run, scoped write, readback, targeted revalidation, and exact URL verification. Do not create an empty PR.

### Mixed release

Use when a database page depends on new code, bundled data, or assets. Complete the repository PR and verify the exact deployed SHA first. Only then publish the database row and verify the URL. Never reverse this order.

A new migration file is a repository change even when its runtime effect is database-only. Merge its PR before applying the controlled production migration.

## 3. Run Proportional Checks

Reuse valid checks already run against the current commit. Run missing checks selected by the changed files and closest `AGENTS.md`.

- Web code: relevant focused tests locally; use lint, web typecheck, coverage, and production build as selected by PR `quality`.
- Bundled datasets/public assets: relevant dataset verification; let PR `quality` run the dataset audit and production build.
- Extension or mobile: run their domain-specific typecheck/package checks.
- Database content: run the content script's dry-run before any production write.

Do not run a full sitemap crawl, broad production SEO scan, broad cache warm, Playwright suite, or published-content audit merely because this skill was invoked. Those remain explicit manual diagnostics.

Stop on a relevant failure. Do not weaken checks or label a failure unrelated without concrete evidence.

## 4. Commit And Open The PR

Skip this section only for a true database-only publication with no intended repository changes.

1. Fetch `origin` and confirm the release branch is based on the intended `production` history. Resolve divergence before release; stop on ambiguous conflicts.
2. Stage only the allowlisted paths or hunks.
3. Review `git diff --cached --stat` and `git diff --cached`.
4. Commit with a focused message. Do not amend unrelated existing commits.
5. Push the current temporary branch.
6. Create a ready PR targeting `production`, or reuse the PR for the same branch and scope.
7. Wait for the required `quality` result. Inspect and fix relevant failures, then update the same PR.
8. Confirm the PR is mergeable and contains only intended changes.
9. Merge using the repository's normal merge strategy and remove the remote branch when GitHub can do so safely.
10. Capture the PR URL, merge commit SHA, and final `origin/production` SHA.

Do not use admin bypasses or merge while required checks are pending or failing.

## 5. Verify Deployment

For a selected web image deployment:

1. Follow `.github/workflows/dokploy-production-deploy.yml` for the merge commit.
2. Wait until Dokploy reports the exact merge/image SHA live.
3. Require `/api/health` to report application health and a healthy database.
4. Require the workflow's targeted smoke checks to pass.
5. Confirm the expected Cloudflare behavior: one automatic purge for runtime code, no full purge for dataset-only changes, and no broad crawl or warm.
6. Verify any task-specific live URL or asset narrowly.

For a correctly skipped web deployment, record why it was skipped. GitHub `production` may be newer than the SHA shown by `/api/health`; that is expected for non-web changes.

Do not continue to a dependent database publication when the required web deployment is not healthy.

## 6. Publish Database Work

Run this section only when the completed task explicitly includes a prepared database change.

1. Use the matching content or database workflow instead of inventing SQL or payloads.
2. Confirm the production target and exact slug/row scope.
3. Run the production dry-run and review create/update behavior.
4. Apply only the approved idempotent write or forward-only migration.
5. Read the affected production rows back.
6. Let normal targeted revalidation purge and warm affected paths.
7. Run `npm run verify:published-url -- --path <exact-path>` for each published page, or the equivalent domain-specific verifier.

The invocation does not authorize publishing unrelated drafts, queued pages, or ambiguous rows. Stop if the database target is not explicit from the completed task.

## 7. Synchronize Local Production

After GitHub merge, operate from the identified main production worktree:

1. Reinspect it. Never stash, reset, overwrite, commit, or transfer unrelated local production changes.
2. Fetch `origin production`.
3. Fast-forward local `production` to `origin/production` only when Git can do so without touching unrelated local changes:

```bash
git -C <production-worktree> merge --ff-only origin/production
```

4. Verify local `production` and `origin/production` resolve to the same SHA. If unrelated local changes remain, verify their path list is unchanged from the preflight snapshot.

For a database-only release without a repository merge, still confirm local `production` is clean and synchronized before cleanup.

## 8. Preserve Work And Clean Up

Cleanup is the final mutation.

1. Reinspect the release worktree for tracked, staged, untracked, and task-related ignored files.
2. Confirm every intended source/data change is in the merge commit or every intended database payload has been successfully published and read back.
3. Treat environment symlinks created by `npm run setup:worktree`, installed dependencies, build output, caches, logs, and test reports as disposable.
4. Treat content workspace files as disposable only after their production write and verification succeeded and no unfinished work depends on them.
5. Stop on any unknown or unfinished file. Never use `git clean -fdx`.
6. From the main production worktree, remove only the temporary release worktree. Never remove the main production worktree. Try normal `git worktree remove` first. Use force only when the remaining files were individually inspected and proven to be disposable local setup/output files.
7. Delete the merged local branch with safe deletion (`git branch -d`). Delete the remote temporary branch if GitHub did not already remove it.
8. Never remove or modify another worktree or branch, including preserved infrastructure work.

## Stop Conditions

Stop and ask the user with the exact blocker when any of these occurs:

- unrelated or ambiguous work is present;
- a secret or environment file appears staged;
- a relevant check fails;
- the branch has unresolved conflicts or unexpected commits;
- `quality` fails or the PR cannot merge normally;
- the selected deployment does not reach the expected healthy SHA;
- a production database dry-run/readback differs from the expected scope;
- local `production` is dirty, divergent, or cannot fast-forward; or
- worktree cleanup could discard unfinished or unknown files.

## Final Report

Return a compact release receipt containing:

- release path used;
- local checks and required `quality` result;
- PR URL and merge commit SHA, when applicable;
- deployed image SHA and database health, or the reason deployment was correctly skipped;
- database readback and verified URLs, when applicable;
- local `production` synchronization SHA;
- deleted worktree and branch; and
- confirmation that no broad crawl/warm ran automatically.
