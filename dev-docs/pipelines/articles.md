# Article Pipeline

Status: Codex-primary writer prepared locally; installed homelab remains on the last verified production release
Last verified: 2026-08-14
Evidence: code, guarded homelab checkout synchronization, systemd units/timer/journal, managed-development readiness, production inventory, and production article count

## Stages

1. Homelab discovery gathers source candidates.
2. Groq curation rejects unsupported/overlapping/event/collection topics and queues approved article ideas in managed development.
3. Codex runs the managed-dev queue batch with `gpt-5.6-luna` at `xhigh` reasoning, including research/image/writing subagents, edited-cover import, verification, and rendered preview. Grok 4.5 remains installed as a one-attempt fallback for classified Codex account/provider failures.
4. Human release review previews selected work locally.
5. Approved final payloads and media publish through controlled production import/release flow.
6. Production revalidation refreshes articles, feeds, sitemaps, related content, and cache tags.

All approved articles require a separate nonzero image pass before writing, as defined by the article workflow skills and `scripts/content/check-article-image-readiness.ts`.

## Environments

- Managed-dev queue: remote non-production Supabase.
- Production overlap check: public read-only editorial inventory API.
- Production publication: explicit controlled import; never automatic from the homelab writer.
- Runtime contract: `.envs/pipelines/articles.env` locally and `/etc/bloxodes/article-automation.env` on homelab.
- Writer provider contract: `ARTICLE_WRITER_CODEX_BIN`, `ARTICLE_WRITER_CODEX_MODEL`, and `ARTICLE_WRITER_CODEX_REASONING_EFFORT` configure the primary; `ARTICLE_WRITER_GROK_FALLBACK`, `ARTICLE_WRITER_GROK_BIN`, and `ARTICLE_WRITER_GROK_MODEL` configure the retained fallback.

## Writer Fallback Boundary

- Codex is invoked non-interactively with automatic approval review, workspace-scoped execution, JSONL events, and ephemeral session storage.
- Grok fallback is eligible only after Codex authentication, quota/rate-limit, model-availability, or provider/network failure. Timeouts, validation failures, browser failures, and article-quality failures do not trigger it.
- The batch counts queue rows touched since Codex started and subtracts them from the fallback target. If every slot already has activity, fallback is withheld rather than overlap partial work.
- Only one Grok fallback runs per batch, under the same host lock and managed-development-only child environment.
- A later batch recovers stale `codex-homelab` or `grok-homelab` processing claims only after the configured provider timeout plus a 30-minute margin.
- Writers leave `final.json.cover_image` null so managed-development import creates and uploads the edited cover. Source-provided and pre-existing covers are not accepted as the final cover by the unattended batch prompt.

## Schedule and Health

Discovery timer runs four times daily (00:00, 06:00, 12:00, 18:00 local) and triggers the writer after successful curation.

On the latest installed-production verification date:

- discovery readiness and curation succeeded;
- production inventory contained 3,265 published pages across page families;
- managed-dev queue had work available;
- writer readiness passed; and
- the latest audited writer run succeeded, completing 6 of 6 claimed items.

That audited run used the preceding Grok-primary release. The Codex-primary implementation passed its local tests and a read-only Luna xhigh model-access canary on 2026-08-17. It still requires a one-article managed-development canary before the batch limit is returned to six on the homelab; the queue was empty during this change.

An earlier HTTP 402 balance failure is historical, not the current service state. The homelab checkout was fast-forwarded to the approved production SHA through the guarded synchronization command on 2026-08-14.

## Production State

Production contained 419 articles on verification date. Article text/media must pass the focused final validators and human approval before publication.
