# Articles

Last verified: 2026-11-16

Articles are guides, explainers and tier lists at `/articles/<slug>`. Topics are found and curated on the homelab; the articles are written and published by the Content Factory's T3 article run. The owner can also ask for one by hand.

## Automatic articles (Content Factory)

Every 6 hours (about 01:19, 07:19, 13:19 and 19:19 IST) the T3 schedule "Bloxodes articles every 6 hours (Content Factory)" runs the factory's `article-main` skill on the MacBook Pro:

1. The main agent (Codex `gpt-6.1-sol`) takes up to 3 `Pending` rows from the Notion [Article Queue](../automation/notion-queues.md#article-queue) and claims them (`Processing`). If fewer than 3 are good, it finds its own topics: questions players ask about games whose Bloxodes wiki pages were added or updated in the last 7 days (from the `wiki` and `games` sitemaps), that no article, wiki or collection page already answers. It adds each one, already claimed, with `articles:queue:add` (`scripts/articles/add-article-queue-item.ts`), which refuses topics already in the queue or on the site: topic key, idempotency key, title similarity of 0.8 or more, or the same question about the same game in other words ([duplicate topics](../automation/notion-queues.md#duplicate-topics)). It exits 0 when it adds a row, 3 for a duplicate and 1 for an error. Without `--apply` it only shows the row it would add.
2. A Luna builder researches each topic into `brief.md`, saves the source pages the writer works from, and gathers its images into `media.json`, uploaded straight to production Storage (`bloxodes-media`) with `collect:article-images --target production --apply --allow-prod`.
3. A Haiku 5.5 writer writes the article from `prompts/haiku-article.md`, the brief, the source pages and the game's related live pages from `articles:related`, with 2 to 5 links to them (see [links](#links)). It runs through the factory's `bin/haiku-write`, a plain API call with no system prompt and no tools, which saves the reply.
4. The main agent builds `final.json`, checks Haiku's facts against the brief, places the images, and runs `content:check-copy`, `check:article-image-readiness` and `content:check-article-links`.
5. `bin/article publish` copies the article into the MacBook Pro checkout's `tmp/content-workspace/content-factory/<slug>/`, marks the row `Completed` and publishes an `article@1` bundle with `content:publish`: a production dry run, then the production apply. The publisher marks the row `Published`, with Live page and Published date, only after it has checked the live page.

The factory's article content lives in its `content/articles/<slug>/`.

## Links

Every article links 2 to 5 related Bloxodes pages inside its text, where they help the reader: the game's wiki hub, collections, codes page and other articles. Roblox articles published from 2026-11-01 and game articles from 2026-11-04 until this change went out with none, because the factory writer was never given the pages; the [backfill](#adding-links-to-live-articles) fixes them.

- **Related pages:** `articles:related -- (--universe-id N | --namespace X --game-slug Y --kind game|franchise) [--exclude-slug S] [--json]` lists the game's live pages with titles, types and exact URLs: hub, parent franchise hub, codes, collections, tools, checklists, quizzes, catalogs, maps, then up to 15 articles, newest first. Only pages that answer a direct 200 on bloxodes.com are listed (no redirects). It reads the production editorial inventory plus read-only production queries, because the public inventory leaves out non-Roblox collections. The factory's `bin/article related` turns it into the lines its writer prompts take.
- **The check:** `content:check-article-links -- --file final.json (--universe-id N | --namespace X --game-slug Y --kind game|franchise)` reads every Markdown link in the body and FAQ, except images and code. Root-relative paths and `bloxodes.com` URLs are internal. It fails a link that isn't a direct 200 (it prints the status and redirect target), a link to the article itself or one of its numbered pages, and an article with no internal link when the game has related live pages. It warns above 5. Links to other sites aren't checked. `content:publish` runs the same check before it writes `article@1`, `game-article@1` and `article-links@1` bundles, in dry runs and applies, including updates.

### Adding links to live articles

`article-links@1` bundles change only the links in a live Roblox or game article (`contracts/article-links/v1/schema.ts`, `scripts/content/article-link-repair.ts`). The bundle says which (`articleKind` `roblox`, or `game` with its namespace and game). They never touch queue rows, author, `published_at`, cover, FAQ questions or any other field.

1. `articles:links:missing -- [--since-roblox 2026-11-01] [--since-game 2026-11-04] --json` lists live articles with no internal link.
2. `articles:links:prepare -- --slug S --out NEW_FOLDER` finds the slug in `articles` or `game_article_pages` and reads the live article into `before.json`, `final.json` and `bundle.json` (with the SHA-256 of `before.json`). It refuses an existing folder.
3. Add the links in `final.json` (the factory has Haiku do it with `prompts/haiku-links.md`). `articles:links:verify-unchanged -- --before before.json --after final.json` fails unless the only change is link markup around existing words in the body or FAQ answers.
4. `content:publish -- --bundle NEW_FOLDER --target production --update-published` checks that `before.json` still matches the live article and that only `content_md` and `faq_json` changed. Add `--apply --allow-prod` to write. The apply holds the article publication lock, writes only those two fields with an `updated_at` condition, after checking the article's identity (and for a game article its namespace and game) hasn't changed, then revalidates and checks the live page. A stale baseline fails; an exact rerun is safe.

## Topic discovery (homelab)

Four times a day (00:00, 06:00, 12:00, 18:00 IST) the homelab runs curation first, so a full backlog always drains, then discovery:

1. **Discover:** `articles:discover` (`scripts/articles/discover-article-topics.ts`) collects dated Roblox editorial leads.
2. **Curate:** `articles:curate` (`curate-article-topics.ts`) uses Groq to accept `guide`, `tier_list` and `explainer` topics and reject overlaps with production pages and the queue. Accepted topics become `Pending` rows in the Notion Article Queue. Curation also puts due `Blocked` rows and `Processing` claims older than 6 hours back to `Pending`, and marks unfinished duplicate rows `Skipped` (`duplicate`). It never edits a `Completed` or `Published` row.
That's all the homelab does for articles. The Content Factory writes and publishes them (above), with `content:publish` from the MacBook Pro checkout. The homelab writer, publication and audit units were removed on 2026-10-30. `articles:automation:audit` still works by hand.

The queue is the Notion Article Queue. Discovery candidates and curation runs are in one local state file, `/srv/data/bloxodes-automation-runtime/state/articles/state.json` (`ARTICLE_DISCOVERY_STATE_DIR`), outside the runtime's `current` release so it survives runtime updates. Discovery and curation share a kernel `flock` on `.writer.lock` in that folder (needs Python 3 with `fcntl` on PATH), released when the process dies. Writes are atomic, and it keeps 90 days and 200 runs. At 5,000 candidates it keeps the newest and logs how many older undecided ones it dropped; candidates in an unfinished curation plan are always kept. Nothing here uses managed development.

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
- To change a published article, add `--update-published` to the production command. Without it, a bundle that differs from the live article is refused, so rerunning an old bundle can't overwrite a live article or an owner's edit. An update keeps the row, slug, author, `published_at` and queue row. With `cover_image` null it also keeps the cover, even if the first body image changed. `game-article@1` works the same way: a published game article that differs is refused without the flag, an identical one is only verified, and an update keeps author, `published_at` and, unless `final.json` sets one, the cover.
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
- **Publishing:** `content:publish` with a `game-article@1` bundle (`contracts/game-article/v1/README.md`), with no GitHub job. A bundle with `queueId` is bound to its [Game Article Queue](../automation/notion-queues.md#game-article-queue) row and marks it `Published` after the live check; older bundles have none. The game and its parent must already be published. The publisher picks the author on each database and keeps it on reruns. With no `cover_image`, it uses the first body image, then the game's cover. Updating a published article keeps its author, `published_at` and, unless `final.json` sets a new one, its cover.
- **Content Factory:** the T3 schedule "Bloxodes game articles every 6 hours (Content Factory)" runs the `game-article-main` skill, up to 3 articles a run. It takes `Pending` rows from the Notion [Game Article Queue](../automation/notion-queues.md#game-article-queue), the owner's first. When fewer than 3 good rows wait, it finds topics itself for the non-Roblox games on Bloxodes players are searching for most right now, checks them with `articles:similar`, adds them with `game-articles:queue:add` (Added by `Agent`), claims and writes them. Same quality rules as before: the game must be on Bloxodes, no duplicate of a live article or wiki page, confirmed facts only, and no forced topics. The writer gets the game's related pages and links them. `bin/article game-publish` publishes. News is allowed, and the `news` tag marks it.
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

- None known.
