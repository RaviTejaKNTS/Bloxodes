# Article Pipeline

Status: Codex Luna Max research/review with isolated Pi Luna Max prose writing prepared for release
Last verified: 2026-08-25
Evidence: code, guarded homelab checkout synchronization, systemd units/timer/journal, managed-development readiness, production inventory, and production article count

## Stages

1. Homelab discovery gathers source candidates.
2. Groq curation rejects unsupported/overlapping/event/collection topics and queues approved article ideas in managed development.
3. Codex runs research, image collection, parent review, import, verification, and rendered preview with `gpt-5.6-luna` at `max` reasoning. After brief and image approval, the parent invokes Pi for prose only, also using `openai-codex/gpt-5.6-luna` at `max` reasoning with ChatGPT authentication and a two-line non-coding system prompt.
4. Human release review previews selected work locally.
5. Approved final payloads and media publish through controlled production import/release flow.
6. Production revalidation refreshes articles, feeds, sitemaps, related content, and cache tags.

All approved articles require a separate nonzero image pass before writing, as defined by the article workflow skills and `scripts/content/check-article-image-readiness.ts`.

Parent prompts and subagent handoffs are intentionally thin: the workflow skill path plus the article packet only. Writing rules live in the writing skills. Public prose must state verified numbers once, use tables for repeated fields, and use surrounding prose only for player decisions and consequences. Tier-list work creates an independent Bloxodes order from explicit gameplay criteria, always renders the tier-list component even without images, and uses cue → table → added analysis under each tier heading.

`npm run articles:audit-copy:production -- --days 30` is the read-only production guard for source names, attribution, research/process narration, and editorial or consensus disclaimers. Use `--all` for the full published inventory. `content:check-copy` remains the required final-file gate before import.

Opinionated Roblox game-list articles remain ordinary `articles` rows. The reusable `roblox-game-card` fenced block carries a stable universe ID, square game icon, Roblox URL, and optional Bloxodes stats URL; all recommendation detail stays in the surrounding Markdown prose. The repo-local best-games workflow is split into discovery, selection/order, per-game research, and writing skills so the candidate set is not capped at a hardcoded count.

## Environments

- Managed-dev queue: remote non-production Supabase.
- Production overlap check: public read-only editorial inventory API.
- Production publication: explicit controlled import; never automatic from the homelab writer.
- Runtime contract: `.envs/pipelines/articles.env` locally and `/etc/bloxodes/article-automation.env` on homelab.
- Parent contract: `ARTICLE_WRITER_CODEX_BIN`, `ARTICLE_WRITER_CODEX_MODEL=gpt-5.6-luna`, and `ARTICLE_WRITER_CODEX_REASONING_EFFORT=max`.
- Prose contract: `ARTICLE_WRITER_PI_BIN`, `ARTICLE_WRITER_PI_PROVIDER=openai-codex`, `ARTICLE_WRITER_PI_MODEL=gpt-5.6-luna`, `ARTICLE_WRITER_PI_REASONING_EFFORT=max`, and `ARTICLE_WRITER_PI_TIMEOUT_MINUTES`. Pi 0.84.3 or newer is required because older releases do not expose `max` thinking.

## Writer Boundary

- Codex is invoked non-interactively with automatic approval review, workspace-scoped execution, JSONL events, and ephemeral session storage.
- The active batch has no Grok or alternate-model fallback. A Codex or Pi provider failure blocks/retries the job instead of changing models or reasoning effort.
- The parent prompt contains only the workflow skill plus queue selection, maximum, and worker. Research/image handoffs contain only a skill and article packet. Pi receives only its writing skill plus title, slug, type, and workspace.
- Pi runs with context-file, extension, discovered-skill, prompt-template, theme, and session loading disabled. Its tool allowlist is `read,write,edit,grep,find,ls`, and its working directory is the single article workspace.
- The Pi wrapper requires `brief.md` and `media.json`, writes `final.json`, validates its slug/content, then runs the public-copy and image-readiness gates. The Codex parent still owns the full verifier and browser preview.
- A later batch recovers stale `codex-homelab` processing claims only after the configured provider timeout plus a 30-minute margin.
- Writers leave `final.json.cover_image` null so managed-development import creates and uploads the edited cover from the game's thumbnail. Source-provided and pre-existing covers are not accepted as the final cover by the unattended batch prompt. A reviewed generated source may be passed explicitly to `import-content-final.ts --cover-source-file`; the importer still stores only its derived edited cover. The cover is a feature/metadata image only: it must not be injected into `content_md`, and production import rejects a cover URL repeated in body content. Use `--regenerate-covers` for an intentional edited-cover repair, which writes a fresh object path to avoid stale CDN bytes.

## Schedule and Health

Discovery timer runs four times daily (00:00, 06:00, 12:00, 18:00 local) and triggers the writer after successful curation.
The writer service runs a tiny live Pi Luna Max exact-response canary after local readiness and before starting the queue batch, so a present-but-expired ChatGPT token cannot pass unattended readiness.

On the latest installed-production verification date:

- discovery readiness and curation succeeded;
- production inventory contained 3,265 published pages across page families;
- managed-dev queue had work available;
- writer readiness passed; and
- the latest audited writer run succeeded, completing 6 of 6 claimed items.

That audited run used the preceding Grok-primary release. The new split workflow requires an authenticated Pi Luna Max access canary and one managed-development article canary after the released SHA and unit/env configuration reach the homelab.

An earlier HTTP 402 balance failure is historical, not the current service state. The homelab checkout was fast-forwarded to the approved production SHA through the guarded synchronization command on 2026-08-14.

## Production State

Production contained 419 articles on verification date. Article text/media must pass the focused final validators and human approval before publication.
