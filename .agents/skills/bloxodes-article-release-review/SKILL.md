---
name: bloxodes-article-release-review
description: Review locally completed Bloxodes article queue work, start a localhost preview, return links for human approval, publish only explicitly approved articles to production, and mark verified releases published or declined drafts rejected. Use when the user asks what generated articles await review, wants localhost links, approves queued articles for production, or rejects completed queued articles.
---

# Bloxodes Article Release Review

Keep managed-dev queue state separate from production article publication. Treat `completed` as locally written and QA-passed, not published.

## Scheduled runtime location

On the homelab, first check whether `/home/teja/.local/share/bloxodes-article-runtime/current` exists. Once installed, scheduled artifacts live under that runtime's persistent `tmp` directory, not the primary task checkout's old `tmp` copy. Inspect scheduled state and run exact-ID publication commands from the runtime directory. Manual task artifacts remain in their own worktree. Do not copy or regenerate a missing final merely because the primary checkout does not contain an automated run. A completed scheduled article may already have durable automatic publication authorization; inspect its publication intent before describing it as waiting for a new human decision. Review-only requests still do not grant new publication authorization.

## Code-controlled run evidence

For finals under tmp/article-pipeline/<run-id>/content/, also inspect the sibling run's state.json and editorial_review.json. A current run must be completed with final technical checks recorded before it is presented as ready. A retained final from a blocked run does not inherit an older approval. The runtime's owned preview may have stopped after QA; start or reuse a managed-dev Tailscale preview for human review. Do not restart research/writing just to serve accepted copy.

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
npm run dev:managed
```

Use the actual port reported by the server.

2. List every completed article awaiting a decision:

```bash
npm run articles:review:list -- --base-url http://127.0.0.1:<port> --limit 100 --json --dev-env-file <managed-dev-env>
```

3. Confirm each row has `result_slug`, `result_path`, and a matching managed-dev `articles` row. Check that each localhost URL returns the expected article. Do not rerun the writing workflow or production release checks.
4. During the existing page review, use [the shared editorial standard](../bloxodes-article-writing/references/editorial-standard.md) to flag generic headings, thin explanations, repeated caveats, or a poor opening/ending. Check the closest [Beebom format example](../bloxodes-article-writing/references/beebom-style-study.md) when a style decision is unclear. Mechanical QA alone does not establish editorial readiness. For new runs using the one-revision procedure, inspect the sibling `editorial-review.md` and the actual copy; missing or unapproved review is a blocker for those runs. Legacy completed articles without the note can be reviewed directly rather than rerun automatically. Report any issue for revision; do not silently rewrite or publish it.
5. Return a compact list containing title, queue ID, preview link, source links, and any missing-artifact or editorial blocker. On the homelab, bind to `0.0.0.0` and use the actual Tailscale host and port.
6. Ask the user to publish or reject exact titles/slugs. Stop without changing queue state.

## Homelab Artifacts

The managed-dev article row can render locally even when its `final.json` and repository-owned media exist only in `/home/teja/projects/Bloxodes` on the homelab.

Before publishing, ensure the current task worktree contains the selected row's exact `result_path` and sibling `media.json` when present remotely. Legacy repository-owned article media may still require `apps/web/public/articles/<slug>/`; new article source images remain in managed-dev Supabase Storage and are promoted from `media.json` instead.

- Load connection details from `.envs/infrastructure/homelab.env`; never print their values.
- Read and stage only the exact selected paths from `$HOMELAB_REPO_ROOT` into a temporary directory.
- Copy a missing artifact into the current task worktree.
- If the worktree artifact target exists with different content, stop and report the conflict. Never overwrite it.
- Never synchronize the whole homelab checkout, its `.env*`, `.grok`, `node_modules`, or unrelated generated articles.

## Publish Mode

The user's explicit approval in the current message authorizes production writes only for the selected articles.

1. Re-query every selected queue ID and require `workflow_mode = agent_runner` and `status = completed`. Preserve the managed-dev queue credential source; production commands must not replace it.
2. Resolve homelab artifacts using **Homelab Artifacts**.
3. Review the exact release allowlist: selected `final.json` files, sibling `media.json` manifests, plus only legacy repository-owned article media when present. Ignore unrelated worktree changes.
4. Follow the publication safeguards in `.agents/skills/bloxodes-release-e2e/SKILL.md` for the exact allowlist without treating this as authority to release anything else:
   - publish required legacy repository media/code first;
   - for each `media.json`, promote the exact approved managed-dev WebP bytes to the same production Storage object paths and rewrite `final.json` to production media URLs:

```bash
BLOXODES_ENV_PROFILE=production-preview NODE_ENV=production npm run collect:article-images -- --manifest <media.json> --file <final.json> --apply --allow-prod
```

   - run the selected article import production dry-run;
   - apply only the selected article rows;
   - dry-run, apply, and read back image provenance for each promoted manifest:

```bash
BLOXODES_ENV_PROFILE=production-preview NODE_ENV=production npm run sync:article-image-provenance -- --manifest <media.json> --allow-prod
BLOXODES_ENV_PROFILE=production-preview NODE_ENV=production npm run sync:article-image-provenance -- --manifest <media.json> --apply --allow-prod
```

   - require every production `article_source_images.public_url` and `content_md` image URL to match the promoted production Storage object;
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

For review, return reachable preview links (Tailscale on the homelab) and ask for exact decisions.

For publication or rejection, return:

- title, slug, and queue ID
- final queue status
- production URL for each published article
- rejection reason for each rejected article
- any rows deliberately left `completed` and why
