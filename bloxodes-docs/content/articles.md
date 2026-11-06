# Articles

Last verified: 2026-11-04

Articles are guides, explainers and tier lists at `/articles/<slug>`. Topics are found and curated on the homelab; the articles are written and published by the Content Factory's T3 article run. The owner can also ask for one by hand.

## Automatic articles (Content Factory)

Every 6 hours (about 00:00, 06:00, 12:00 and 18:00 IST) the T3 schedule "Bloxodes articles every 6 hours (Content Factory)" runs the factory's `article-main` skill on the MacBook Pro:

1. The main agent (Codex `gpt-6.1-sol`) takes up to 3 `pending` rows from `article_generation_queue` and claims them (`processing`). If fewer than 3 are good, it finds its own topics: questions players ask about games whose Bloxodes wiki pages were added or updated in the last 7 days (from the `wiki` and `games` sitemaps), that no article, wiki or collection page already answers. It adds each one, already claimed, with `articles:queue:add` (`scripts/articles/add-article-queue-item.ts`), which refuses topics already in the queue or in the production article inventory (same title match as curation: topic key, idempotency key, or title similarity of 0.8 or more). It exits 0 when it adds a row, 3 for a duplicate and 1 for an error. Without `--apply` it only shows the row it would add.
2. A Luna builder researches each topic into `brief.md`, saves the source pages the writer works from, and gathers its images into `media.json`, uploaded to managed-dev Storage with `collect:article-images`.
3. A Haiku 5.5 writer writes the article from `prompts/haiku-article.md`, the brief and the source pages. It runs through the factory's `bin/haiku-write`, a plain API call with no system prompt and no tools, which saves the reply.
4. The main agent builds `final.json`, checks Haiku's facts against the brief, places the images, and runs `content:check-copy` and `check:article-image-readiness`.
5. `bin/article publish` copies the article into the MacBook Pro checkout's `tmp/content-workspace/content-factory/<slug>/`, marks the row `completed` and publishes an `article@1` bundle with `content:publish`. The publisher marks the row `published` only after it has checked production.

The factory's article content lives in its `content/articles/<slug>/`.

## Topic discovery (homelab)

Four times a day (00:00, 06:00, 12:00, 18:00 IST) the homelab runs:

1. **Discover:** `articles:discover` (`scripts/articles/discover-article-topics.ts`) collects dated Roblox editorial leads.
2. **Curate:** `articles:curate` (`curate-article-topics.ts`) uses Groq to accept `guide`, `tier_list` and `explainer` topics and reject overlaps with existing pages.
That's all the homelab does for articles. The Content Factory writes and publishes them (above), with `content:publish` from the MacBook Pro checkout. The homelab writer, publication and audit units were removed on 2026-10-30. `articles:automation:audit` still works by hand.

Queue and curation rows live in managed development (`article_discovery_candidates`, `article_curation_runs`, `article_generation_queue`).

### Stages

This code-controlled pipeline still works for manual runs (`articles:writer:local`). Nothing schedules it.


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

Articles publish through `content:publish` with `article@1` bundles, with no GitHub job. It checks the bundle, moves images to production storage, writes the article, reads it back, revalidates and checks the live URL. Only then is the queue row closed.

Owner edit to a finished article from the old writer pipeline:

- `articles:approval:owner-edit -- --queue-id <id> --expected-final-hash <sha> --operator <name> --reason <text> --apply` approves an owner edit to a completed, unpublished article's `content/final.json`, after checking its exact hash, its unchanged brief and media, the copy check and the earlier approvals. It keeps that evidence.

It doesn't publish. Publish the matching bundle with `content:publish` afterwards.

### Direct publishing

`content:publish` takes an article bundle (`contracts/article/v1/`). The Content Factory's `bin/article publish` uses it for new articles, and `bin/article update` for published ones.

| Command | Does |
| --- | --- |
| `npm run content:publish -- --bundle <abs-folder>` | Dry run: schema, slug, queue row, game identity, copy, image readiness, images that decode and videos that resolve. No writes. |
| `... --target managed-dev --apply` | Writes the article to managed development and reads it back. |
| `... --target production --apply --allow-prod` | Uses the wiki production guard, moves images to production storage, writes the article, reads it back, revalidates and checks the live page, then marks the queue row `published`. |
| `npm run content:status -- --article <slug> [--target production]` | The article's state on that target. |

- A new article's queue row must be `completed`, and `final.json` must match its `result_path` byte for byte.
- Rerun the same bundle after a failure. A failed publish leaves the row retryable. On production, a published article that matches the bundle is verified without being rewritten. The exception is a row still `completed` after a failed first publish: the same content is written again, keeping the author, date and cover, so the publish can finish. On managed development, `--apply` always writes the bundle.
- To change a published article, add `--update-published` to the production command. Without it, a bundle that differs from the live article is refused, so rerunning an old bundle can't overwrite a live article or an owner's edit. An update keeps the row, slug, author, `published_at` and queue row. With `cover_image` null it also keeps the cover, even if the first body image changed. The flag applies only to `article@1`; `game-article@1` bundles update without it.
- It holds a lock under `tmp/content-publish/article/`, so a parallel publish can report `Article publication is busy`. Retry when it does.
- It has no browser check. It checks the live status, titles, canonical URL, description, body text, cover, body images, and video iframes and availability. It doesn't check layout or overflow on desktop and phone, JavaScript errors, hydration, lazy loading or video playback, so the run opens the live page itself.

### Runtime releases

The homelab runs article discovery, codes discovery and site health from a packaged release at `/srv/data/bloxodes-automation-runtime/current`, not the repo checkout. Merging code doesn't change it. To ship code there: run `automation-runtime.yml` on GitHub to package dependencies, then the reviewed prepare and install scripts select the new release. Don't touch the installed env, timers or running jobs while doing it.

## Articles for other games

Non-Roblox articles live in `game_article_pages`, the `game_*` partner of `articles`. They use the same `/articles/<slug>` URL, page design and pagination. The article reader checks `articles` first, then `site_routes`. A slug can't be used by both tables, and the `articles` table doesn't change.

- **Lists:** `published_articles_view` merges both tables for `/articles`, author pages, the feed and the sitemap.
- **Game archive:** `/articles/games/<game-slug>`, one per game (`/articles/games/gta-6`), from `game_article_game_summary`. A Roblox archive keeps its URL if a slug clashes, and the publisher refuses the clash.
- **News:** a row with the `news` tag. There's no `/news` route, and every row needs a game.
- **Publishing:** `content:publish` with a `game-article@1` bundle (`contracts/game-article/v1/README.md`), with no queue row and no GitHub job. The game and its parent must already be published. The publisher picks the author on each database and keeps it on reruns. With no `cover_image`, it uses the first body image, then the game's cover.
- **Content Factory:** the `game-article-main` skill writes these from `content/game-articles/topics.md` (requested topics, then priority games) or topics it finds, with `bin/article game-existing` to find duplicates and the game, and `bin/article game-publish`. News is allowed, and the `news` tag marks it.
- **Revalidation:** `game_content` events refresh the page, every numbered page, both lists, the archive, the author page, the feed and the sitemap.

## Manual articles

Use `bloxodes-article-workflow-runner` with its research, images and writing skills. In T3 the stages follow [model routing](../../.agents/skills/shared/routing/bloxodes-model-routing/SKILL.md). Variants:

- **Tech and troubleshooting:** `bloxodes-tech-article-writing`.
- **Tier lists:** `bloxodes-tier-list-writing`.
- **Best-games lists:** the `bloxodes-best-games-*` skills (competitor, discovery, selection, per-game research, writing). These are normal `articles` rows that use `roblox-game-card` blocks.

Publish with `bloxodes-release-e2e`.

## Writing standard

- Voice: `bloxodes-voice`.
- Article rules: `.agents/skills/roblox/articles/bloxodes-article-writing/references/editorial-standard.md`.
- `scripts/shared/article-editorial-standard.ts` feeds both into automated prompts, so any checkout that runs the code pipeline needs those skill files.

`content:publish` checks an article's copy and image readiness before it writes anything. A failed check stops the publish: fix the bundle and rerun it.

Every article needs a real image pass before writing (`scripts/content/check-article-image-readiness.ts`).

## Data

Other-game articles are in `game_article_pages` (see above). Production `articles` (909 rows, 883 published on 2026-10-19), plus authors and `article_source_images` provenance. The old production article queue (three rows, last touched in August) isn't used.

## Known issues

- None known. A Content Factory claim that produces no article stays `processing`; nothing releases it, so check for old `processing` rows (`locked_by = t3-content-factory`) when a topic goes missing.
