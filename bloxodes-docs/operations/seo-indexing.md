# SEO, indexing and analytics

Last verified: 2026-11-01

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

## Indexing APIs

- **Google Indexing API:** off. The VPS cron entry is commented out and `google-indexing.yml` is a manual fallback. A real submission needs `--apply` and `GOOGLE_INDEXING_API_ENABLED=true`. State tables `google_indexing_attempts` and `google_indexing_url_state` haven't changed since 2026-07-01.
- **IndexNow:** off (`INDEXNOW_ENABLED=false` on the live site). Don't run `indexnow:bootstrap` to test it; it isn't a dry run.

## Analytics

- The site loads GA4 and self-hosted Umami through separate public variables (`NEXT_PUBLIC_*`), injected by GitHub and Dokploy in production.
- Operator credentials: GA4, Search Console, Bing and Google OAuth in `.envs/operations/analytics.env`; Umami login and `UMAMI_WEBSITE_ID` in `.envs/operations/umami.env` (load with the `umami` overlay).
