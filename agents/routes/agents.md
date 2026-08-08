# Route Handlers Inventory

Authoritative workflow guidance lives in:

- `apps/web/src/app/AGENTS.md`
- `apps/web/src/app/api/AGENTS.md`

This file is the inventory for API, auth, feed, and sitemap routes.

## API Routes

| Route | Methods | File | Purpose |
| --- | --- | --- | --- |
| `/api/account/avatar` | `GET` | `src/app/api/account/avatar/route.ts` | Signed-in avatar/display-name payload for account UI. |
| `/api/checklists/progress` | `GET`, `PUT` | `src/app/api/checklists/progress/route.ts` | Per-user checklist progress read/write. |
| `/api/checklists/session` | `GET` | `src/app/api/checklists/session/route.ts` | Session snapshot for checklist UI. |
| `/api/codes/progress` | `GET`, `PUT`, `PATCH` | `src/app/api/codes/progress/route.ts` | Per-user used-code progress read/write; PATCH applies one used/restored action without overwriting concurrent progress. |
| `/api/codes/session` | `GET` | `src/app/api/codes/session/route.ts` | Session snapshot for code pages. |
| `/api/comments` | `POST` | `src/app/api/comments/route.ts` | Create moderated comments with guest or signed-in author support. |
| `/api/comments/[id]` | `PATCH`, `DELETE` | `src/app/api/comments/[id]/route.ts` | Edit or delete the current user's comments. |
| `/api/comments/session` | `GET` | `src/app/api/comments/session/route.ts` | Signed-in user payload for comment forms. |
| `/api/consent` | `GET` | `src/app/api/consent/route.ts` | Consent state resolution. |
| `/api/extension/roblox-game-codes` | `GET`, `OPTIONS` | `apps/web/src/app/api/extension/roblox-game-codes/route.ts` | Public Chrome extension lookup for a Roblox game page, returning a three-code preview and full Bloxodes URL. |
| `/api/extension/roblox-game-stats` | `GET`, `POST`, `OPTIONS` | `apps/web/src/app/api/extension/roblox-game-stats/route.ts` | Seven-day player-history lookup by Roblox place ID; rate-limited POST verifies and enrolls unknown games in the existing universe stats pipeline. |
| `/api/extension/auth/complete` | `GET` | `apps/web/src/app/api/extension/auth/complete/route.ts` | Browser-mediated Roblox sign-in and automatic short-lived handoff to the Chromium identity callback. |
| `/api/extension/auth/exchange` | `POST`, `OPTIONS` | `apps/web/src/app/api/extension/auth/exchange/route.ts` | Exchanges a redirect-bound, one-time extension handoff for an `app_sessions` bearer token. |
| `/api/extension/auth/session` | `GET`, `OPTIONS` | `apps/web/src/app/api/extension/auth/session/route.ts` | Returns the extension user for a valid bearer session. |
| `/api/extension/auth/logout` | `POST`, `OPTIONS` | `apps/web/src/app/api/extension/auth/logout/route.ts` | Revokes the current extension bearer session. |
| `/api/extension/codes/progress` | `GET`, `PUT`, `PATCH`, `OPTIONS` | `apps/web/src/app/api/extension/codes/progress/route.ts` | Reads and incrementally updates the signed-in user's used-code progress shared with the website. |
| `/api/feedback` | `POST` | `src/app/api/feedback/route.ts` | Same-origin site feedback submissions from the header drawer with optional contact email. |
| `/api/health` | `GET` | `src/app/api/health/route.ts` | Runtime health endpoint. |
| `/api/articles/editorial-inventory` | `GET` | `apps/web/src/app/api/articles/editorial-inventory/route.ts` | Cached, GET-only production inventory of published page families, titles, route keys, and universe IDs for external duplicate and internal-link checks; exposes no mutation or production credential. |
| `/api/mobile/auth/complete` | `GET` | `apps/web/src/app/api/mobile/auth/complete/route.ts` | Mobile login completion: reads the web session cookie and redirects to `bloxodes://auth` with a short-lived signed handoff code (or to web login when signed out). |
| `/api/mobile/auth/exchange` | `POST`, `OPTIONS` | `apps/web/src/app/api/mobile/auth/exchange/route.ts` | Exchanges a mobile handoff code for an `app_sessions` bearer token plus the user profile. |
| `/api/mobile/auth/session` | `GET`, `OPTIONS` | `apps/web/src/app/api/mobile/auth/session/route.ts` | Current mobile user via `Authorization: Bearer` with cookie fallback. |
| `/api/mobile/auth/logout` | `POST`, `OPTIONS` | `apps/web/src/app/api/mobile/auth/logout/route.ts` | Revokes the bearer session. |
| `/api/mobile/home` | `GET`, `OPTIONS` | `apps/web/src/app/api/mobile/home/route.ts` | Aggregated home feed: codes index plus events, catalog, wiki, tools, quizzes, and checklists rails. |
| `/api/mobile/codes` | `GET`, `OPTIONS` | `apps/web/src/app/api/mobile/codes/route.ts` | Public mobile app payload for the paginated codes index. |
| `/api/mobile/codes/[slug]` | `GET`, `OPTIONS` | `apps/web/src/app/api/mobile/codes/[slug]/route.ts` | Public mobile app payload for a code detail page with active and expired codes. |
| `/api/mobile/codes/session` | `GET`, `OPTIONS` | `apps/web/src/app/api/mobile/codes/session/route.ts` | Mobile session snapshot; bearer token first, cookie fallback. |
| `/api/mobile/codes/progress` | `GET`, `PUT`, `OPTIONS` | `apps/web/src/app/api/mobile/codes/progress/route.ts` | Per-user used-code progress for the app; bearer token first, cookie fallback. |
| `/api/mobile/checklists/progress` | `GET`, `PUT`, `OPTIONS` | `apps/web/src/app/api/mobile/checklists/progress/route.ts` | Per-user checklist progress for the app (bearer/cookie), same `user_checklist_progress` table as the web route. |
| `/api/mobile/quizzes/progress` | `GET`, `PUT`, `OPTIONS` | `apps/web/src/app/api/mobile/quizzes/progress/route.ts` | Per-user quiz progress for the app (bearer/cookie), same `user_quiz_progress` table as the web route. |
| `/api/mobile/quizzes/[code]/play` | `GET`, `OPTIONS` | `apps/web/src/app/api/mobile/quizzes/[code]/play/route.ts` | Full quiz play payload (questions, options, correct option ids) for the native quiz player. |
| `/api/mobile/content/[kind]` | `GET`, `OPTIONS` | `apps/web/src/app/api/mobile/content/[kind]/route.ts` | Public mobile app payload for paginated catalog, wiki, tools, quizzes, checklists, events, and articles index cards. |
| `/api/mobile/content/[kind]/[slug]` | `GET`, `OPTIONS` | `apps/web/src/app/api/mobile/content/[kind]/[slug]/route.ts` | Public mobile app payload for a content detail page, including queryable native catalog sections; catalog codes fall back to published wiki collection pages. |
| `/api/mobile/stats/games` | `GET`, `OPTIONS` | `apps/web/src/app/api/mobile/stats/games/route.ts` | CORS-enabled stats games table wrapper for the app. |
| `/api/mobile/stats/games/[universeId]` | `GET`, `OPTIONS` | `apps/web/src/app/api/mobile/stats/games/[universeId]/route.ts` | CORS-enabled stats game summary with latest rank for the app; player count and playing rank are null after 24 hours without a player refresh. |
| `/api/mobile/stats/games/[universeId]/chart` | `GET`, `OPTIONS` | `apps/web/src/app/api/mobile/stats/games/[universeId]/chart/route.ts` | CORS-enabled player-count chart wrapper for the app. |
| `/api/quizzes/progress` | `GET`, `PUT` | `src/app/api/quizzes/progress/route.ts` | Per-user quiz progress and last score state. |
| `/api/quizzes/session` | `GET` | `src/app/api/quizzes/session/route.ts` | Session snapshot for quiz UI. |
| `/api/revalidate` | `POST` | `src/app/api/revalidate/route.ts` | Publish-triggered ISR and Cloudflare purge entrypoint. |
| `/api/roblox-free-items` | `GET` | `src/app/api/roblox-free-items/route.ts` | Paginated free-item browser data. |
| `/api/roblox-decal-ids` | `GET` | `src/app/api/roblox-decal-ids/route.ts` | Paginated/searchable Roblox decal ID catalog data. |
| `/api/roblox-id-extractor` | `GET` | `src/app/api/roblox-id-extractor/route.ts` | Resolve Roblox URLs and IDs with Roblox API plus Supabase fallbacks. |
| `/api/roblox-music-ids` | `GET` | `src/app/api/roblox-music-ids/route.ts` | Paginated/searchable music ID catalog data. |
| `/api/roblox-mesh-ids` | `GET` | `src/app/api/roblox-mesh-ids/route.ts` | Paginated/searchable Roblox Mesh ID catalog data. |
| `/api/search/all` | `GET` | `src/app/api/search/all/route.ts` | Site-wide aggregated search. |
| `/api/search/games` | `GET` | `src/app/api/search/games/route.ts` | Lightweight games search for UI autocomplete. |
| `/api/stats/games` | `GET` | `src/app/api/stats/games/route.ts` | Public stats game table payload with search, sort, genre, and minimum-player filters. |
| `/api/stats/creators` | `GET` | `src/app/api/stats/creators/route.ts` | Public stats creator leaderboard payload with search, sort, and creator-type filters. |
| `/api/stats/items` | `GET` | `src/app/api/stats/items/route.ts` | Public stats item table payload with search, sort, category, sale-state, creator, and resale filters. |
| `/api/stats/platform/chart` | `GET` | `src/app/api/stats/platform/chart/route.ts` | Public platform stats chart payload for lazy-loaded range and resolution changes. |
| `/api/stats/visit-share` | `GET` | `src/app/api/stats/visit-share/route.ts` | Public top-game daily visit-share chart payload for lazy-loaded range changes on `/stats`. |
| `/api/stats/games/[universeId]` | `GET` | `src/app/api/stats/games/[universeId]/route.ts` | Public stats summary for one Roblox universe; player count and playing rank are null after 24 hours without a player refresh. |
| `/api/stats/games/[universeId]/chart` | `GET` | `src/app/api/stats/games/[universeId]/chart/route.ts` | Public chart payload for lazy-loaded hourly, daily, and monthly stats views. |

## Auth Routes

| Route | Methods | File | Purpose |
| --- | --- | --- | --- |
| `/auth/roblox/login` | `GET` | `src/app/auth/roblox/login/route.ts` | Start Roblox OAuth login flow; accepts sanitized `next` and `source` paths for return/login-source tracking. |
| `/auth/roblox/callback` | `GET` re-export | `src/app/auth/roblox/callback/route.ts` | Stable callback entrypoint that re-exports the login callback handler. |
| `/auth/roblox/callback/login` | `GET` | `src/app/auth/roblox/callback/login/route.ts` | OAuth callback, user upsert, app-session creation, and login-source path storage. |

## Feed And Sitemap Routes

| Route | Methods | File | Purpose |
| --- | --- | --- | --- |
| `/feed.xml` | `GET` | `src/app/feed.xml/route.ts` | RSS feed for recent articles, codes, events, puzzles, and checklists. |
| `/robots.txt` | route module | `src/app/robots.ts` | Robots directives built from site config. |
| `/sitemap.xml` | `GET` | `src/app/sitemap.xml/route.ts` | Top-level sitemap index builder. |
| `/sitemaps/main.xml` | `GET` | `src/app/sitemaps/main.xml/route.ts` | Static route sitemap. |
| `/sitemaps/articles.xml` | `GET` | `src/app/sitemaps/articles.xml/route.ts` | Articles sitemap, including `/articles/games/[slug]` hubs and `/articles/games/roblox`. |
| `/sitemaps/authors.xml` | `GET` | `src/app/sitemaps/authors.xml/route.ts` | Authors sitemap. |
| `/sitemaps/catalog.xml` | `GET` | `src/app/sitemaps/catalog.xml/route.ts` | Catalog sitemap. |
| `/sitemaps/checklists.xml` | `GET` | `src/app/sitemaps/checklists.xml/route.ts` | Checklists sitemap. |
| `/sitemaps/codes.xml` | `GET` | `src/app/sitemaps/codes.xml/route.ts` | Codes sitemap. |
| `/sitemaps/events.xml` | `GET` | `src/app/sitemaps/events.xml/route.ts` | Events sitemap. |
| `/sitemaps/puzzles.xml` | `GET` | `src/app/sitemaps/puzzles.xml/route.ts` | Indexable current puzzle-answer pages sitemap. Dated puzzle archives are excluded because they are noindex reference pages. |
| `/sitemaps/quizzes.xml` | `GET` | `src/app/sitemaps/quizzes.xml/route.ts` | Quizzes sitemap. |
| `/sitemaps/stats.xml` | `GET` | `src/app/sitemaps/stats.xml/route.ts` | Sole sitemap owner for stats routes, with real index-refresh `lastmod` values, the approved games-list SEO matrix, and the top 1,000 eligible individual game pages. |
| `/sitemaps/tools.xml` | `GET` | `src/app/sitemaps/tools.xml/route.ts` | Tools sitemap. |
| `/sitemaps/wiki.xml` | `GET` | `src/app/sitemaps/wiki.xml/route.ts` | Wiki sitemap. |
