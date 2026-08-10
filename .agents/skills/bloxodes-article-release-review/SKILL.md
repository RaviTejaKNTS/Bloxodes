---
name: bloxodes-article-release-review
description: Review locally completed Bloxodes article queue work, start a localhost preview, return links for human approval, publish only explicitly approved articles to production, and mark verified releases published or declined drafts rejected. Use when the user asks what generated articles await review, wants localhost links, approves queued articles for production, or rejects completed queued articles.
---

# Bloxodes Article Release Review

Keep managed-dev queue state separate from production article publication. Treat `completed` as locally written and QA-passed, not published.

## Queue Lifecycle

- `pending`: waiting for the writer
- `processing`: claimed by the writer
- `completed`: local final, import, verifier, and browser preview passed; awaiting human decision
- `published`: exact production article and URL were verified
- `rejected`: the user reviewed a completed article and declined publication
- `skipped`: automation declined a lead before human release review
- `failed`: terminal operational failure

Never change a row to `published` merely because the user approved it. Publish first, verify production, then close the managed-dev queue row.

## Resolve The Request

1. If the user asks to see, check, or review waiting articles without an explicit release decision, run **Review Mode** only.
2. If the user explicitly approves named slugs, queue IDs, links from the last review batch, or all articles in that exact batch, run **Publish Mode** for only that allowlist.
3. If the user explicitly declines named completed articles, run **Reject Mode** for only that allowlist.
4. If the selection is ambiguous, do not mutate either database. Return the completed rows and ask which exact articles to publish or reject.

Do not treat newly completed rows that appeared after a review as included in “publish all.”

## Review Mode

1. Start or reuse the local web app with managed-dev Supabase:

```bash
npm run dev:local
```

Use the actual port reported by the server.

2. List every completed article awaiting a decision:

```bash
npm run articles:review:list -- --base-url http://127.0.0.1:<port> --limit 100 --json --dev-env-file <managed-dev-env>
```

3. Confirm each row has `result_slug`, `result_path`, and a matching managed-dev `articles` row. Check that each localhost URL returns the expected article. Do not rerun the writing workflow or production release checks.
4. Return a compact list containing title, queue ID, localhost link, source links, and any missing-artifact blocker.
5. Ask the user to publish or reject exact titles/slugs. Stop without changing queue state.

## Homelab Artifacts

The managed-dev article row can render locally even when its `final.json` and repository-owned media exist only in `/home/teja/projects/Bloxodes` on the homelab.

Before publishing, ensure the current task worktree contains the selected row's exact `result_path` and `apps/web/public/articles/<slug>/` directory when present remotely.

- Load connection details from `.env.homelab`; never print their values.
- Read and stage only the exact selected paths from `$HOMELAB_REPO_ROOT` into a temporary directory.
- Copy a missing artifact into the current task worktree.
- If a local target exists with different content, stop and report the conflict. Never overwrite it.
- Never synchronize the whole homelab checkout, its `.env*`, `.grok`, `node_modules`, or unrelated generated articles.

## Publish Mode

The user's explicit approval in the current message authorizes production writes only for the selected articles.

1. Re-query every selected queue ID and require `workflow_mode = agent_runner` and `status = completed`. Preserve the managed-dev queue credential source; production commands must not replace it.
2. Resolve homelab artifacts using **Homelab Artifacts**.
3. Review the exact release allowlist: selected `final.json` files plus only their required repository-owned article media. Ignore unrelated worktree changes.
4. Follow the publication safeguards in `.agents/skills/bloxodes-release-e2e/SKILL.md` for the exact allowlist without treating this as authority to release anything else:
   - publish required repository media/code first;
   - run the selected article import production dry-run;
   - apply only the selected article rows;
   - read back each production article;
   - verify each exact `/articles/<slug>` URL and sitemap entry.
5. If the production row and URL already match because an earlier queue close failed, do not republish. Verify them and continue.
6. Only after production verification succeeds, update the same managed-dev queue row:

```bash
npm run articles:queue:update -- --queue-id <uuid> --status published --production-url https://bloxodes.com/articles/<slug> --dev-env-file <managed-dev-env> --apply
```

7. If publication fails, leave the queue row `completed`, record the blocker in the response, and allow a safe retry. Never mark it `failed` for a production release failure.

## Reject Mode

Require an explicit decision for each selected completed row. Use the user's reason when supplied; otherwise use `Declined during human publication review.`

```bash
npm run articles:queue:update -- --queue-id <uuid> --status rejected --reason "<reason>" --dev-env-file <managed-dev-env> --apply
```

Do not delete local files, managed-dev article rows, media, or source provenance. Rejection is an auditable queue decision and remains part of topic deduplication.

## Final Receipt

For review, return localhost links and ask for exact decisions.

For publication or rejection, return:

- title, slug, and queue ID
- final queue status
- production URL for each published article
- rejection reason for each rejected article
- any rows deliberately left `completed` and why
