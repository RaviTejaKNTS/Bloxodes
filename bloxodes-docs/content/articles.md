# Articles

Last verified: 2026-10-19

Articles are guides, explainers and tier lists at `/articles/<slug>`. Topics are found and curated on the homelab; the articles are written and published by the Content Factory's T3 article run. The owner can also ask for one by hand.

## Automatic articles (Content Factory)

Four times a day (01:00, 07:00, 13:00, 19:00 IST) the T3 schedules "Bloxodes articles <time> (Content Factory)" run the factory's `article-main` skill on the MacBook Pro:

1. The main agent (Codex `gpt-6.1-sol`) takes up to 3 `pending` rows from `article_generation_queue` and claims them (`processing`).
2. A Luna builder researches each topic into `brief.md` and gathers its images into `media.json`, uploaded to managed-dev Storage with `collect:article-images`.
3. A Haiku 5.5 writer, run headless through the factory's `bin/haiku-write` from an empty folder in safe mode, writes the article from `prompts/haiku-article.md`.
4. The main agent builds `final.json`, checks Haiku's facts against the brief, places the images, and runs `content:check-copy` and `check:article-image-readiness`.
5. `bin/article publish` copies the article into the MacBook Pro checkout's `tmp/content-workspace/content-factory/<slug>/`, marks the row `completed`, writes the publication intent and runs `articles:publication:drain`, which dispatches `publish-content.yml` as below.

The factory's article content lives in its `content/articles/<slug>/`.

## Topic discovery (homelab)

Four times a day (00:00, 06:00, 12:00, 18:00 IST) the homelab runs:

1. **Discover:** `articles:discover` (`scripts/articles/discover-article-topics.ts`) collects dated Roblox editorial leads.
2. **Curate:** `articles:curate` (`curate-article-topics.ts`) uses Groq to accept `guide`, `tier_list` and `explainer` topics and reject overlaps with existing pages.
3. **Write (paused):** `articles:writer:batch -- --apply --limit 6` (`run-homelab-article-batch.ts`) used to take up to six curated topics through the stage pipeline below. Discovery no longer starts it; see [schedules](../automation/schedules.md#homelab-systemd).
4. **Publish:** every 15 minutes `articles:publication:drain -- --apply` sends finished homelab articles to GitHub for publication. The drain is per checkout: it only sees intents in its own `tmp/article-publication/`.
5. **Audit:** `articles:automation:audit` reports blocked jobs and schedule problems.

Queue and curation rows live in managed development (`article_discovery_candidates`, `article_curation_runs`, `article_generation_queue`). Run state lives in the runtime's `tmp/article-pipeline/` and `tmp/article-publication/`.

### Stages

`scripts/articles/article-pipeline.ts` runs each topic through:

research → research review → images → image review → image upload → writing → editorial review → copy check → image check → import and browser checks (on GitHub)

Default models (`article-stage-config.ts`):

| Stage | Model |
| --- | --- |
| Research, images, editorial review | Codex `gpt-6-luna`, max |
| Research review, image review, writing and revisions | Claude `claude-haiku-5-5`, xhigh |

If Claude fails for account or provider reasons, that stage falls back to Luna. Env groups `ARTICLE_STAGE_<STAGE>_PROVIDER/MODEL/EFFORT/TIMEOUT_MINUTES` override the defaults (see `env/examples/pipelines/articles.env.example`).

Models only write their own files. Code does the queue claims, uploads, imports and publishing. Each stage gets one substantive correction. If it's still not right, the job stops as blocked for a person to look at; retries don't reset that budget. Provider or technical failures retry after three hours, at most twice.

### Publishing

The drain freezes the approved article (final, media, brief and approval hashes) into a private bundle and dispatches `publish-content.yml`. GitHub stages it in managed development, checks images and embeds on desktop and mobile, publishes it, reads it back, revalidates and checks the live URL. Only then is the queue row closed. A green dispatch alone isn't a publication.

Owner recovery commands:

- `articles:publication:drain -- --retry-exhausted --queue-id <id> --operator <name> --reason <text> --apply` resets a publication that ran out of attempts.
- `articles:approval:owner-edit -- --queue-id <id> --expected-final-hash <sha> --operator <name> --reason <text> --apply` approves an owner edit to a finished article's `content/final.json`. It works for any authorized unpublished article without an unresolved GitHub dispatch, clears a copy block and keeps the attempt count.

Neither publishes by itself. The next normal drain does.

### Runtime releases

The homelab runs a packaged release at `/srv/data/bloxodes-automation-runtime/current`, not the repo checkout. Merging code doesn't change it. To ship article code to the homelab: run `automation-runtime.yml` on GitHub to package dependencies, then the reviewed prepare and install scripts select the new release. Don't touch the installed env, timers or running jobs while doing it.

## Manual articles

Use `bloxodes-article-workflow-runner` with its research, images and writing skills. In T3 the stages follow [model routing](../../.agents/skills/shared/routing/bloxodes-model-routing/SKILL.md). Variants:

- **Tech and troubleshooting:** `bloxodes-tech-article-writing`.
- **Tier lists:** `bloxodes-tier-list-writing`.
- **Best-games lists:** the `bloxodes-best-games-*` skills (competitor, discovery, selection, per-game research, writing). These are normal `articles` rows that use `roblox-game-card` blocks.

Publish with `bloxodes-release-e2e`.

## Writing standard

- Voice: `bloxodes-voice`.
- Article rules: `.agents/skills/roblox/articles/bloxodes-article-writing/references/editorial-standard.md`.
- `scripts/shared/article-editorial-standard.ts` feeds both into automated prompts, so the homelab runtime needs those skill files.

Before a finished article is frozen for publication, the drain re-checks its copy. Bad copy stays blocked and is reported once per final hash, without spending a publication attempt.

Every article needs a real image pass before writing (`scripts/content/check-article-image-readiness.ts`).

## Data

Production `articles` (909 rows, 883 published on 2026-10-19), plus authors and `article_source_images` provenance. The old production article queue (three rows, last touched in August) isn't used.

## Known issues

- The audit service exits with status 1 because some jobs are blocked at editorial, research or image stages. That's a "needs attention" signal, not a broken schedule.
