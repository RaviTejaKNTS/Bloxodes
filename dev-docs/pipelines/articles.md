# Article Pipeline

Status: Codex Luna Max research/review, isolated Pi Luna Max prose, and exact-row automated release implemented
Last verified: 2026-08-26
Evidence: code and 31 focused tests, exact-ID release dry run against a published queue row, healthy exact-SHA production deployment, guarded homelab synchronization and full readiness, plus the earlier Codex/Pi article, image-response, rendered-preview, copy-audit, and Groq curation canaries

## Stages

1. Homelab discovery gathers source candidates.
2. Groq curation rejects unsupported/overlapping/event/collection topics and queues approved article ideas in managed development.
3. Codex runs research, image collection, parent review, import, verification, and rendered preview with `gpt-5.6-luna` at `max` reasoning. After brief and image approval, the parent invokes Pi for prose only, also using `openai-codex/gpt-5.6-luna` at `max` reasoning with ChatGPT authentication and a two-line non-coding system prompt.
4. Before the model starts, the batch wrapper captures the exact newest pending queue-ID selection. After the model exits, it intersects that selection with rows completed after the batch start and passes only those IDs to the guarded release orchestrator.
5. The orchestrator promotes the approved media bytes, imports each exact article row with a deterministic edited cover, syncs provenance, reads production back, and polls the live URL and expected H1 before closing the queue row as `published`.
6. Production revalidation refreshes articles, feeds, sitemaps, related content, and cache tags.

`ARTICLE_AUTO_PUBLISH=true` is the unattended default. Set it to `false` or pass `articles:writer:batch -- --skip-production-release` to retain the previous localhost human-review path. Release failures are isolated per queue ID and remain `completed`, so an operator can inspect and retry the exact failed rows without republishing unrelated completed work.

All approved articles require a separate nonzero image pass before writing, as defined by the article workflow skills and `scripts/content/check-article-image-readiness.ts`. Every verified image must use an article-owned Supabase Storage URL with a matching `uploaded_path`; root-relative collection or repository paths do not satisfy article readiness. The final verifier downloads every unique body-image URL and requires a non-empty `image/*` response. Browser review scrolls through lazy-loaded sections and checks that every requested content image has nonzero rendered dimensions.

Parent prompts and subagent handoffs are intentionally thin: the workflow skill path plus the article packet only. Writing rules live in the writing skills. Public prose must state verified numbers once, use tables for repeated fields, and use surrounding prose only for player decisions and consequences. Tier-list work creates an independent Bloxodes order from explicit gameplay criteria, always renders the tier-list component even without images, and uses cue → table → added analysis under each tier heading.

`npm run articles:audit-copy:production -- --days 30` is the read-only production guard for source names, attribution, research/process narration, and editorial or consensus disclaimers. Use `--all` for the full published inventory. `content:check-copy` remains the required final-file gate before import.

Opinionated Roblox game-list articles remain ordinary `articles` rows. The reusable `roblox-game-card` fenced block carries a stable universe ID, square game icon, Roblox URL, and optional Bloxodes stats URL; all recommendation detail stays in the surrounding Markdown prose. The repo-local best-games workflow is split into discovery, selection/order, per-game research, and writing skills so the candidate set is not capped at a hardcoded count.

## Environments

- Managed-dev queue: remote non-production Supabase.
- Production overlap check: public read-only editorial inventory API.
- Production publication: automatic only for the exact current-batch queue-ID allowlist after all writing and preview checks have succeeded; manual release remains available.
- Runtime contract: `.envs/pipelines/articles.env` locally and `/etc/bloxodes/article-automation.env` on homelab.
- Production release target: ignored `.envs/targets/production.env`, opened by the parent release process only after Codex/Pi exit. It is never placed in the model child environment or `/etc/bloxodes/article-automation.env`.
- Parent contract: `ARTICLE_WRITER_CODEX_BIN`, `ARTICLE_WRITER_CODEX_MODEL=gpt-5.6-luna`, and `ARTICLE_WRITER_CODEX_REASONING_EFFORT=max`.
- Prose contract: `ARTICLE_WRITER_PI_BIN`, `ARTICLE_WRITER_PI_PROVIDER=openai-codex`, `ARTICLE_WRITER_PI_MODEL=gpt-5.6-luna`, `ARTICLE_WRITER_PI_REASONING_EFFORT=max`, and `ARTICLE_WRITER_PI_TIMEOUT_MINUTES`. Pi 0.84.3 or newer is required because older releases do not expose `max` thinking.

## Writer Boundary

- Codex is invoked non-interactively with automatic approval review, workspace-scoped execution, JSONL events, and ephemeral session storage.
- The active batch has no Grok or alternate-model fallback. A Codex or Pi provider failure blocks/retries the job instead of changing models or reasoning effort.
- The parent prompt contains only the workflow skill plus queue selection, maximum, and worker. Research/image handoffs contain only a skill and article packet. Pi receives only its writing skill plus title, slug, type, and workspace.
- The workflow runner performs the selected article steps directly inside the parent turn. It never invokes `articles:writer:batch` recursively because the outer homelab batch already owns the single-writer lock.
- Pi runs with context-file, extension, discovered-skill, prompt-template, theme, and session loading disabled. Its tool allowlist is `read,write,edit,grep,find,ls`, and its working directory is the single article workspace.
- The Pi wrapper requires `brief.md` and `media.json`, writes `final.json`, validates its slug/content, then runs the public-copy and image-readiness gates. The Codex parent still owns the full verifier and browser preview.
- The release command requires one or more exact UUIDs, rejects duplicate or non-completed rows, caps each run at 20 IDs, and never discovers a broad completed backlog. Production Storage and Data API children run with a sanitized process-only environment plus explicit host and media-origin guards.
- The first verified source image in `media.json` is the deterministic cover input after production promotion. This handles articles whose linked universe has no usable Roblox thumbnail while keeping the derived cover separate from body content.
- Article image provenance upserts use the article-owned uploaded object path as the idempotent key; two distinct manifest entries may share a source URL without collapsing into one production row.
- Groq curation keeps the selected candidate set intact when the provider reports an HTTP 413 token-cap rejection. It reduces the completion allowance from the reported limit/request delta plus a safety margin and retries the same request; the live 8,017-token failure completed at 7,679 tokens after this guard reduced `max_tokens` to 2,707.
- A later batch recovers stale `codex-homelab` processing claims only after the configured provider timeout plus a 30-minute margin.
- Writers leave `final.json.cover_image` null so managed-development import creates and uploads the edited cover from the game's thumbnail. Source-provided and pre-existing covers are not accepted as the final cover by the unattended batch prompt. A reviewed generated source may be passed explicitly to `import-content-final.ts --cover-source-file`; the importer still stores only its derived edited cover. The cover is a feature/metadata image only: it must not be injected into `content_md`, and production import rejects a cover URL repeated in body content. Use `--regenerate-covers` for an intentional edited-cover repair, which writes a fresh object path to avoid stale CDN bytes.

## Schedule and Health

Discovery timer runs four times daily (00:00, 06:00, 12:00, 18:00 local) and triggers the writer after successful curation.
The writer service runs a tiny live Pi Luna Max exact-response canary after local readiness and before starting the queue batch, so a present-but-expired ChatGPT token cannot pass unattended readiness.

On the latest installed-production verification date:

- production inventory contained 3,584 published pages across page families;
- managed-development and production-inventory readiness passed;
- Codex CLI reported `gpt-5.6-luna` at `max`;
- Pi 0.84.3 reported `openai-codex/gpt-5.6-luna` at `max` with ChatGPT authentication;
- the live Pi exact-response canary passed;
- `grow-a-chicken-fighter-hot-egg-event-guide` completed through research, 2/2 image upload/insertion, Pi writing, managed-development import/readback, route verification, and real Chrome/Playwright preview; and
- the production public-copy audit scanned 172 articles from the last 30 days with 0 affected articles and 0 findings. The Runaways tier-list article also had 0 findings in its exact-slug audit.

The earlier article canary was reviewed and published through the manual release workflow. Future unattended batches use the same controlled primitives through the exact-ID orchestrator.

An earlier HTTP 402 balance failure is historical, not the current service state. The homelab checkout was fast-forwarded to the approved production SHA through the guarded synchronization command on 2026-08-25.

## Production State

Production contained 419 articles on verification date. Article text/media must pass the focused final validators, rendered preview, production readback, and live-page checks before the queue row is closed.
