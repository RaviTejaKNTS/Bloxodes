# SEO, indexing and analytics

Last verified: 2026-11-16

## Sitemaps, feed and search

- Next routes build `/sitemap.xml` and per-family sitemaps from published production data. `/sitemaps/games.xml` lists every published non-Roblox page at its stored URL, the same way for every game. The old `/sitemaps/gta.xml`, `red-dead.xml` and `minecraft.xml` permanently redirect to it.
- `/feed.xml` (`apps/web/src/app/feed.xml/route.ts`) lists published articles, codes, checklists, events, puzzles, shared game pages, GTA and Minecraft adapters and the monthly reports that are listed in it by hand.
- Content events refresh search, sitemaps and the feed. Code or static data changes need a web deploy.
- Collection pagination pages are `noindex` and stay out of sitemaps.
- `/sitemaps/moved.xml` is a temporary recrawl sitemap, linked from `/sitemap.xml`. It lists every old page-linked game URL (`site_routes` rows with `status = 'old'`, `source = 'game'`, a `page_id`), which all redirect, so search engines revisit them and pick up the new URLs. It returns 503 rather than a partial list. Remove the route, `lib/moved-game-sitemap.ts` and the index entry on 2027-01-02 (`MOVED_GAME_SITEMAP_REMOVE_ON`); the redirect rows stay.

## Google index policy

Since October 2025 Google has indexed only our homepage. So we give Google an allowlist of our strongest pages and ask it to skip the rest. Bing and other engines are unaffected.

- The allowlist is `apps/web/src/lib/seo/google-index-policy.ts`.
  - `GOOGLE_INDEXABLE_PATHS`: exact paths (home, trust pages, authors, stats hubs and reports, tools, wiki and codes indexes, top codes pages).
  - `/catalog` and `/articles` allow everything beneath them.
  - `GOOGLE_INDEXABLE_GAMES`: per game, its wiki hub and everything under it, plus listed codes, quiz and checklist slugs.
- The proxy adds `X-Robots-Tag: googlebot: noindex, follow` to every HTML URL that isn't allowed, including query variants. It depends only on the URL, never the user agent.
- To add a game, add one typed entry to `GOOGLE_INDEXABLE_GAMES` with its confirmed slugs. An entry only lifts the Google block; it never overrides a page's own noindex.
- Don't set `googleBot: { index: true }` in page metadata.
- Sitemaps still list Google-blocked pages.
- Google gets only family sitemaps that hold allowed pages: main, codes, articles, tools, checklists, quizzes, wiki, authors, catalog and stats. `games`, `events`, `puzzles` and `moved` have none and stay unsubmitted, and so does the `/sitemap.xml` index, which lists them. Bing gets the index.

## Indexing APIs

- **Google Indexing API:** off. The VPS cron entry is commented out, and GitHub has no workflow or settings for it. A real submission runs `indexing:google` with `--apply` and needs `GOOGLE_INDEXING_API_ENABLED=true` in `.envs/pipelines/indexing.env`. State tables `google_indexing_attempts` and `google_indexing_url_state` haven't changed since 2026-07-01.
- **IndexNow:** for newly published pages only, once `INDEXNOW_ENABLED=true` is set for the web app in Infisical. Non-production never submits.
  - A database trigger on each content table records a page the first time it is published and adds its URL to `indexnow_urls` as `pending`. Pages that were already published when this shipped are `known` and are never sent. Updates, republishes and renames don't create a new submission. The trigger never blocks a content write; if it fails it logs a warning and that page isn't queued.
  - Every `/api/revalidate` call checks up to 100 pending URLs after it has answered (see [cache](cache.md)). A URL is sent once its live page returns 200 HTML, isn't `noindex` for Bing, and has one canonical pointing at itself.
  - A URL is sent at most once. A send that fails or times out is stored as `failed` with its reason in `detail` and is not retried, because Bing may already have it. A pending URL that hasn't passed in 30 days becomes `expired`.
  - `/api/health` (operational scope) reports failed sends from the last 24 hours and pending URLs older than 24 hours. Only a recent failed send makes it unhealthy.
  - Per-game Roblox stats pages (`/stats/games/...`) are not covered.
  - Don't run `indexnow:bootstrap`; it submits the whole sitemap and isn't a dry run.

## Analytics

- The site loads GA4 and self-hosted Umami through separate public variables (`NEXT_PUBLIC_*`), injected by GitHub and Dokploy in production.
- Search Console writes, such as sitemap changes, use service account `indexing@bloxodes.iam.gserviceaccount.com` (Full user, key at `.envs/secrets/google-indexing-service-account.json`). The saved Google OAuth token is read-only.
- Operator credentials: GA4, Search Console, Bing and Google OAuth in `.envs/operations/analytics.env`; Umami login and `UMAMI_WEBSITE_ID` in `.envs/operations/umami.env` (load with the `umami` overlay).
