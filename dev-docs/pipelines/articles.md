# Article Pipeline

Status: Discovery active; automated writer blocked by exhausted Grok balance
Last verified: 2026-08-13
Evidence: code, systemd units/timer/journal, managed-dev readiness, production inventory, and production article count

## Stages

1. Homelab discovery gathers source candidates.
2. Groq curation rejects unsupported/overlapping/event/collection topics and queues approved article ideas in managed development.
3. Grok writer claims managed-dev queue items, runs research/image/writing workflows, and produces reviewable results.
4. Human release review previews selected work locally.
5. Approved final payloads and media publish through controlled production import/release flow.
6. Production revalidation refreshes articles, feeds, sitemaps, related content, and cache tags.

All approved articles require a separate nonzero image pass before writing, as defined by the article workflow skills and `scripts/content/check-article-image-readiness.ts`.

## Environments

- Managed-dev queue: remote non-production Supabase.
- Production overlap check: public read-only editorial inventory API.
- Production publication: explicit controlled import; never automatic from the homelab writer.
- Runtime contract: `.envs/pipelines/articles.env` locally and `/etc/bloxodes/article-automation.env` on homelab.

## Schedule and Health

Discovery timer runs four times daily (00:00, 06:00, 12:00, 18:00 local) and triggers the writer after successful curation.

On verification date:

- discovery readiness and curation succeeded;
- production inventory contained 3,265 published pages across page families;
- managed-dev queue had pending work;
- writer readiness passed;
- Grok Build failed with HTTP 402 because usage balance was exhausted.

Restore the external balance/account before expecting writer recovery; changing env keys will not fix the current failure.

## Production State

Production contained 419 articles on verification date. Article text/media must pass the focused final validators and human approval before publication.
