# Articles

Last verified: 2026-11-16

Articles are guides, explainers and tier lists at `/articles/<slug>`. Topics are found and curated on the homelab; the articles are written and published by the Content Factory's T3 article run. The owner can also ask for one by hand.

## Automatic articles (Content Factory)

Every 6 hours (about 00:00, 06:00, 12:00 and 18:00 IST) the T3 schedule "Bloxodes articles every 6 hours (Content Factory)" runs the factory's `article-main` skill on the MacBook Pro:

1. The main agent (Codex `gpt-6.1-sol`) takes up to 3 `Pending` rows from the Notion [Article Queue](../automation/notion-queues.md#article-queue) and claims them (`Processing`). If fewer than 3 are good, it finds its own topics: questions players ask about games whose Bloxodes wiki pages were added or updated in the last 7 days (from the `wiki` and `games` sitemaps), that no article, wiki or collection page already answers. It adds each one, already claimed, with `articles:queue:add` (`scripts/articles/add-article-queue-item.ts`), which refuses topics already in the queue or in the production article inventory (same title match as curation: topic key, idempotency key, or title similarity of 0.8 or more). It exits 0 when it adds a row, 3 for a duplicate and 1 for an error. Without `--apply` it only shows the row it would add.
2. A Luna builder researches each topic into `brief.md`, saves the source pages the writer works from, and gathers its images into `media.json`, uploaded straight to production Storage (`bloxodes-media`) with `collect:article-images --target production --apply --allow-prod`.
3. A Haiku 5.5 writer writes the article from `prompts/haiku-article.md`, the brief and the source pages. It runs through the factory's `bin/haiku-write`, a plain API call with no system prompt and no tools, which saves the reply.
4. The main agent builds `final.json`, checks Haiku's facts against the brief, places the images, and runs `content:check-copy` and `check:article-image-readiness`.
5. `bin/article publish` copies the article into the MacBook Pro checkout's `tmp/content-workspace/content-factory/<slug>/`, marks the row `Completed` and publishes an `article@1` bundle with `content:publish`: a production dry run, then the production apply. The publisher marks the row `Published`, with Live page and Published date, only after it has checked the live page.

The factory's article content lives in its `content/articles/<slug>/`.

## Topic discovery (homelab)

Four times a day (00:00, 06:00, 12:00, 18:00 IST) the homelab runs:

1. **Discover:** `articles:discover` (`scripts/articles/discover-article-topics.ts`) collects dated Roblox editorial leads.
2. **Curate:** `articles:curate` (`curate-article-topics.ts`) uses Groq to accept `guide`, `tier_list` and `explainer` topics and reject overlaps with production pages and the queue. Accepted topics become `Pending` rows in the Notion Article Queue. Curation also puts due `Blocked` rows and `Processing` claims older than 6 hours back to `Pending`, and marks later duplicate rows `Skipped` (`duplicate`).
That's all the homelab does for articles. The Content Factory writes and publishes them (above), with `content:publish` from the MacBook Pro checkout. The homelab writer, publication and audit units were removed on 2026-10-30. `articles:automation:audit` still works by hand.

The queue is the Notion Article Queue. Discovery candidates and curation runs are in one local state file, `/srv/data/bloxodes-automation-runtime/state/articles/state.json` (`ARTICLE_DISCOVERY_STATE_DIR`), outside the runtime's `current` release so it survives runtime updates. Writes are atomic, and it keeps 90 days, at most 5,000 candidates and 200 runs. Nothing here uses managed development.

The old managed-development tables (`article_generation_queue`, `article_discovery_candidates`, `article_curation_runs`) are kept but no longer written by the factory path. `articles:queue:migrate-to-notion` (dry run by default, `--apply` to write, `--include-published` for published history) copied the open rows on 2026-11-16; it's idempotent through the `Dev queue ID` property and prints an `id_map` from old to new IDs.

### Stages

This code-controlled pipeline is legacy. Nothing schedules it, and it still uses the old managed-development queue table: `articles:pipeline`, `articles:writer:local`, `articles:writer:homelab`, `articles:writer:batch`, `articles:review:list`, `articles:approval:owner-edit` and `articles:automation:audit`. Its rows can't publish through the Notion queue.


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

`content:publish` takes an article bundle (`contracts/article/v1/`). The Content Factory's `bin/article publish` uses it for new articles, and `bin/article update` for published ones. Monthly stats reports use the same command with their own `stats-report@1` contract; they aren't article rows. See [stats](stats.md#monthly-reports).

| Command | Does |
| --- | --- |
| `npm run content:publish -- --bundle <abs-folder>` | Dry run against production: schema, slug, Notion queue row, game identity, copy, image readiness, images that decode and videos that resolve. No writes. |
| `... --target production --apply --allow-prod` | Uses the wiki production guard, writes the article, reads it back, revalidates and checks the live page, then marks the Notion row `Published`. |
| `npm run content:status -- --article <slug>` | The article's state on production. |

`--target managed-dev` still exists for manual use only. The production preflight refuses body or cover URLs that point at managed-development Storage.

- A new article's Notion row must be `Completed`, and `final.json` must match its Result path byte for byte. The bundle's `queueId` is the Notion page ID.
- Rerun the same bundle after a failure. A failed publish leaves the row retryable. On production, a published article that matches the bundle is verified without being rewritten. The exception is a row still `completed` after a failed first publish: the same content is written again, keeping the author, date and cover, so the publish can finish.
- To change a published article, add `--update-published` to the production command. Without it, a bundle that differs from the live article is refused, so rerunning an old bundle can't overwrite a live article or an owner's edit. An update keeps the row, slug, author, `published_at` and queue row. With `cover_image` null it also keeps the cover, even if the first body image changed. The flag applies only to `article@1`; `game-article@1` bundles update without it.
- It holds a lock under `tmp/content-publish/article/`, so a parallel publish can report `Article publication is busy`. Retry when it does.
- It has no browser check. It checks the live status, titles, canonical URL, description, body text, cover, body images, and video iframes and availability. It doesn't check layout or overflow on desktop and phone, JavaScript errors, hydration, lazy loading or video playback, so the run opens the live page itself.

### Images

`collect:article-images --manifest <media.json> --target production --apply --allow-prod` downloads each verified image, converts it to WebP and uploads it to the production `bloxodes-media` bucket. Images already in production are reused, not uploaded again. For an older manifest that still points at managed-development Storage, add `--file <final.json>`: it collects the original source image again and rewrites the body URLs, so review those images before publishing.

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
