# Article Pipeline

Status: Discovery and writer active; homelab checkout is behind production
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

On the latest verification date:

- discovery readiness and curation succeeded;
- production inventory contained 3,265 published pages across page families;
- managed-dev queue had work available;
- writer readiness passed; and
- the latest audited writer run succeeded, completing 6 of 6 claimed items.

An earlier HTTP 402 balance failure is historical, not the current service state. The remaining operational drift is the clean homelab checkout at `ef536f62`, which must be fast-forwarded only after the prepared repository change is approved and released.

## Production State

Production contained 419 articles on verification date. Article text/media must pass the focused final validators and human approval before publication.
