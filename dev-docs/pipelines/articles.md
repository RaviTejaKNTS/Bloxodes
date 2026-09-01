# Article Pipeline

Status: Codex-primary writer with deterministic headless browser QA, retry-safe queue cleanup, and guarded exact-row automatic production release
Last verified: 2026-09-01
Evidence: homelab readiness with a real Playwright/Chrome smoke test, six-article rendered-browser pass, exact-ID production release with six live 200 responses, zero remaining processing claims, and writer dry-run/nested-run checks

## Stages

1. Homelab discovery gathers source candidates.
2. Groq curation rejects unsupported/overlapping/event/collection topics and queues approved article ideas in managed development.
3. Codex runs the managed-dev queue batch with `gpt-5.6-luna` at `xhigh` reasoning, including research/image/writing subagents, edited-cover import, verification, and rendered preview. Grok 4.5 remains installed as a one-attempt fallback for classified Codex account/provider failures.
4. The batch wrapper records the exact queue IDs it selected and runs the provider only for those rows.
5. Completed rows from that batch automatically publish through the controlled production import/release flow. The release remains an exact-ID allowlist, verifies content, media provenance, and live canonical URLs, and closes each queue row only after verification.
6. Production revalidation refreshes articles, feeds, sitemaps, related content, and cache tags.

All approved articles require a separate nonzero image pass before writing, as defined by the article workflow skills and `scripts/content/check-article-image-readiness.ts`.

Opinionated Roblox game-list articles remain ordinary `articles` rows. The reusable `roblox-game-card` fenced block carries a stable universe ID, square game icon, Roblox URL, and optional Bloxodes stats URL; all recommendation detail stays in the surrounding Markdown prose. The repo-local best-games workflow is split into discovery, selection/order, per-game research, and writing skills so the candidate set is not capped at a hardcoded count.

## Environments

- Managed-dev queue: remote non-production Supabase.
- Production overlap check: public read-only editorial inventory API.
- Production publication: automatic only for rows completed by the current homelab batch; every release uses an explicit queue-ID allowlist and guarded production verification.
- Runtime contract: `.envs/pipelines/articles.env` locally and `/etc/bloxodes/article-automation.env` on homelab.
- Writer provider contract: `ARTICLE_WRITER_CODEX_BIN`, `ARTICLE_WRITER_CODEX_MODEL`, and `ARTICLE_WRITER_CODEX_REASONING_EFFORT` configure the primary; `ARTICLE_WRITER_GROK_FALLBACK`, `ARTICLE_WRITER_GROK_BIN`, and `ARTICLE_WRITER_GROK_MODEL` configure the retained fallback.
- Release contract: `ARTICLE_AUTO_PUBLISH=true` enables the post-provider release; `ARTICLE_RELEASE_PRODUCTION_ENV_FILE`, `ARTICLE_RELEASE_VERIFY_ATTEMPTS`, and `ARTICLE_RELEASE_VERIFY_DELAY_MS` configure the production target and bounded live-route verification.

## Writer Fallback Boundary

- Codex is invoked non-interactively with automatic approval review, workspace-scoped execution, JSONL events, and ephemeral session storage.
- Grok fallback is eligible only after Codex authentication, quota/rate-limit, model-availability, or provider/network failure. Timeouts, validation failures, browser failures, and article-quality failures do not trigger it.
- The batch passes its exact selected queue IDs to the provider, counts activity only among those IDs, and subtracts touched rows from the fallback target. If every slot already has activity, fallback is withheld rather than overlapping partial work.
- Only one Grok fallback runs per batch, under the same host lock and managed-development-only child environment.
- A later batch recovers stale `codex-homelab` or `grok-homelab` processing claims only after the configured provider timeout plus a 30-minute margin.
- The wrapper immediately clears unfinished selected claims after provider, browser, verifier, or release failure and sets a retryable `blocked` state with a 180-minute backoff.
- Writers leave `final.json.cover_image` null so managed-development import creates and uploads the edited cover from the game's thumbnail. Source-provided and pre-existing covers are not accepted as the final cover by the unattended batch prompt. A reviewed generated source may be passed explicitly to `import-content-final.ts --cover-source-file`; the importer still stores only its derived edited cover. The cover is a feature/metadata image only: it must not be injected into `content_md`, and production import rejects a cover URL repeated in body content. Use `--regenerate-covers` for an intentional edited-cover repair, which writes a fresh object path to avoid stale CDN bytes.
- Article-image provenance is matched by the article-owned uploaded object path, not only by the original source URL, so two useful article images that happen to share a source URL remain separate rows.

## Schedule and Health

Discovery timer runs four times daily (00:00, 06:00, 12:00, 18:00 local) and triggers the writer after successful curation.

On 2026-09-01:

- discovery readiness and curation succeeded;
- production inventory contained 3,720 published pages across page families;
- managed-dev queue had work available;
- writer readiness passed with a real headless Chrome smoke test;
- six recovered articles passed rendered-browser QA and exact-ID production release, with six live 200 responses; and
- no `processing` article claims remained after recovery.

The six-article recovery also verified the deterministic browser gate and the retry cleanup path. The next scheduled writer run is 18:00 local time.

An earlier HTTP 402 balance failure is historical, not the current service state. The homelab checkout was fast-forwarded to the approved production SHA through the guarded synchronization command on 2026-08-14.

## Production State

Production contained 419 articles on verification date. Article text/media must pass the focused final validators and guarded production verification before publication. Human review remains available through `articles:review:list`, while the unattended homelab path publishes only its own newly completed exact-ID allowlist.
