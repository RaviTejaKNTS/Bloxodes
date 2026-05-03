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
| `/api/codes/progress` | `GET`, `PUT` | `src/app/api/codes/progress/route.ts` | Per-user used-code progress read/write. |
| `/api/codes/session` | `GET` | `src/app/api/codes/session/route.ts` | Session snapshot for code pages. |
| `/api/comments` | `POST` | `src/app/api/comments/route.ts` | Create moderated comments with guest or signed-in author support. |
| `/api/comments/[id]` | `PATCH`, `DELETE` | `src/app/api/comments/[id]/route.ts` | Edit or delete the current user's comments. |
| `/api/comments/session` | `GET` | `src/app/api/comments/session/route.ts` | Signed-in user payload for comment forms. |
| `/api/consent` | `GET` | `src/app/api/consent/route.ts` | Consent state resolution. |
| `/api/extension/roblox-game-codes` | `GET`, `OPTIONS` | `apps/web/src/app/api/extension/roblox-game-codes/route.ts` | Public Chrome extension lookup for a Roblox game page, returning a three-code preview and full Bloxodes URL. |
| `/api/health` | `GET` | `src/app/api/health/route.ts` | Runtime health endpoint. |
| `/api/mobile/codes` | `GET`, `OPTIONS` | `apps/web/src/app/api/mobile/codes/route.ts` | Public mobile app payload for the paginated codes index. |
| `/api/mobile/codes/[slug]` | `GET`, `OPTIONS` | `apps/web/src/app/api/mobile/codes/[slug]/route.ts` | Public mobile app payload for a code detail page with active and expired codes. |
| `/api/quizzes/progress` | `GET`, `PUT` | `src/app/api/quizzes/progress/route.ts` | Per-user quiz progress and last score state. |
| `/api/quizzes/session` | `GET` | `src/app/api/quizzes/session/route.ts` | Session snapshot for quiz UI. |
| `/api/revalidate` | `POST` | `src/app/api/revalidate/route.ts` | Publish-triggered ISR and Cloudflare purge entrypoint. |
| `/api/roblox-free-items` | `GET` | `src/app/api/roblox-free-items/route.ts` | Paginated free-item browser data. |
| `/api/roblox-id-extractor` | `GET` | `src/app/api/roblox-id-extractor/route.ts` | Resolve Roblox URLs and IDs with Roblox API plus Supabase fallbacks. |
| `/api/roblox-music-ids` | `GET` | `src/app/api/roblox-music-ids/route.ts` | Paginated/searchable music ID catalog data. |
| `/api/search/all` | `GET` | `src/app/api/search/all/route.ts` | Site-wide aggregated search. |
| `/api/search/games` | `GET` | `src/app/api/search/games/route.ts` | Lightweight games search for UI autocomplete. |

## Auth Routes

| Route | Methods | File | Purpose |
| --- | --- | --- | --- |
| `/auth/roblox/login` | `GET` | `src/app/auth/roblox/login/route.ts` | Start Roblox OAuth login flow. |
| `/auth/roblox/callback` | `GET` re-export | `src/app/auth/roblox/callback/route.ts` | Stable callback entrypoint that re-exports the login callback handler. |
| `/auth/roblox/callback/login` | `GET` | `src/app/auth/roblox/callback/login/route.ts` | OAuth callback, user upsert, and app-session creation. |

## Feed And Sitemap Routes

| Route | Methods | File | Purpose |
| --- | --- | --- | --- |
| `/feed.xml` | `GET` | `src/app/feed.xml/route.ts` | RSS feed for recent articles, codes, lists, events, and checklists. |
| `/robots.txt` | route module | `src/app/robots.ts` | Robots directives built from site config. |
| `/sitemap.xml` | `GET` | `src/app/sitemap.xml/route.ts` | Top-level sitemap index builder. |
| `/sitemaps/main.xml` | `GET` | `src/app/sitemaps/main.xml/route.ts` | Static route sitemap. |
| `/sitemaps/articles.xml` | `GET` | `src/app/sitemaps/articles.xml/route.ts` | Articles sitemap. |
| `/sitemaps/authors.xml` | `GET` | `src/app/sitemaps/authors.xml/route.ts` | Authors sitemap. |
| `/sitemaps/catalog.xml` | `GET` | `src/app/sitemaps/catalog.xml/route.ts` | Catalog sitemap. |
| `/sitemaps/checklists.xml` | `GET` | `src/app/sitemaps/checklists.xml/route.ts` | Checklists sitemap. |
| `/sitemaps/codes.xml` | `GET` | `src/app/sitemaps/codes.xml/route.ts` | Codes sitemap. |
| `/sitemaps/events.xml` | `GET` | `src/app/sitemaps/events.xml/route.ts` | Events sitemap. |
| `/sitemaps/lists.xml` | `GET` | `src/app/sitemaps/lists.xml/route.ts` | Lists sitemap. |
| `/sitemaps/quizzes.xml` | `GET` | `src/app/sitemaps/quizzes.xml/route.ts` | Quizzes sitemap. |
| `/sitemaps/tools.xml` | `GET` | `src/app/sitemaps/tools.xml/route.ts` | Tools sitemap. |
| `/sitemaps/wiki.xml` | `GET` | `src/app/sitemaps/wiki.xml/route.ts` | Wiki sitemap. |
