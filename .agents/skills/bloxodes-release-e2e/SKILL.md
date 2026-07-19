---
name: bloxodes-release-e2e
description: Quickly publish already-completed and user-approved Bloxodes work from the current task worktree directly to production, wait only for the required deployment or database publication, verify the exact live result, synchronize local production, and leave the task worktree open for immediate follow-up changes. Use only when the user explicitly invokes `$bloxodes-release-e2e` or asks for an e2e/end-to-end production release.
---

# Bloxodes Release E2E

Publish completed work. Do not restart its creation, review, or testing workflow.

## Authority

An explicit invocation means:

- the user considers the current task complete and approved;
- its normal final checks have already passed;
- publish only the current task's intended files;
- use a direct non-force push to `production` by default;
- deploy or publish the prepared database change when applicable; and
- keep the task worktree and branch after release for immediate fixes.

Do not search for tracker rows, old logs, approval files, or ignored/temp output. Do not open a PR unless the user explicitly asks for one.

## 1. Confirm Scope

1. Record the current worktree, branch, HEAD, status, and registered worktrees.
2. Stay in the current task worktree. Never create a second worktree when already in one.
3. If invoked from the main `production` worktree with changes, create one temporary task worktree from `origin/production` and transfer only the explicit release allowlist.
4. Build the allowlist from the work completed in this chat. Ignore unrelated files, worktrees, branches, `.env*`, `node_modules`, build output, reports, caches, and `tmp/` unless a specific database payload in `tmp/` is part of this release.
5. Stop only for an unclear allowlisted file, a staged secret, an overlapping change, or a real merge conflict.

Never use `git add .`, `git add -A`, a broad stash, force push, or another agent's branch.

## 2. Fast Release Check

Treat the invocation as confirmation that content and code final checks passed.

1. Review the allowlisted diff.
2. Run `git diff --check`.
3. Run at most one tiny change-specific syntax or smoke check only if the release process itself changed a file after final approval.

Do not rerun content verifiers, dataset validation, Browser inspection, HTML-size checks, pagination checks, lint, typecheck, coverage, builds, Playwright, crawls, SEO audits, or database-wide audits.

## 3. Publish Repository Files

Skip this section for a true database-only publication.

1. Fetch `origin production` and confirm the task commit can update it without force. Rebase the clean task branch when needed; stop on conflicts.
2. Stage only the allowlist and review the staged file list and diff.
3. Commit with a focused message when uncommitted work remains.
4. Push the task HEAD directly to GitHub production without force:

```bash
git push origin HEAD:production
```

5. Use a PR only when the user explicitly requests one. Do not choose a PR merely because the change touches workflows, many files, or content.

If GitHub protection rejects the direct push, report that exact configuration blocker. Do not silently start a slower PR workflow.

## 4. Wait For The Required Live Change

- Docs, skills, scripts, mobile, extension, and Supabase-only repository changes: confirm the production classifier skipped the web deploy.
- Web code, bundled data, or public assets: wait for the production workflow to build and deploy the published SHA, then require `/api/health` to report that SHA and a healthy database.
- Database-only content: do not trigger a web build.
- Mixed code/content: deploy code, data, and assets first; publish the database row second.
- Schema required by new code: apply a backward-compatible migration before dependent code. Stop instead of guessing when ordering is unclear.

Do not add a broad crawl, cache warm, full Cloudflare purge, or extra route-family scan. The deployment workflow owns its small mapped health/smoke checks.

## 5. Publish Prepared Database Work

Run only when the completed task explicitly includes a prepared database change.

1. Use the existing page-type seed/import command.
2. Run its production dry-run.
3. Apply only the named idempotent rows or migration.
4. Read back the affected production rows.
5. Verify each exact public URL with `verify:published-url` or the page-type equivalent.

For article imports, rely on `import:content-final` for the small release-time media check: it reads back each saved article, rejects a missing or local feature image, and fetches that exact cover once. Then verify only the exact published article URL; do not rerun article final checks.

Do not publish unrelated drafts or queued content.

## 6. Synchronize And Stay Available

1. Fast-forward the main local `production` worktree to `origin/production` without touching unrelated work.
2. Verify both resolve to the same SHA.
3. Keep the current task worktree and local task branch intact, even when clean and fully published.
4. Return the task to the user for immediate follow-up changes in the same chat and worktree.

Remove the task worktree or branch only when the user explicitly says the task is finished and asks for cleanup. Never remove another agent's worktree.

## Final Receipt

Report only:

- published scope and production SHA;
- whether deployment was skipped or the deployed SHA/health;
- database rows and exact URLs when applicable;
- local production synchronization SHA;
- current task worktree/branch retained for follow-up; and
- any real blocker.
