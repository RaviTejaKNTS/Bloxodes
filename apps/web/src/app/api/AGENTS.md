# API Routes Guide

Scope: `apps/web/src/app/api`.

These routes back interactive site features, search, tool data, session/progress storage, moderation-aware comments, consent state, health checks, and publish-time revalidation.

## Endpoint Groups

- Search and catalog data:
  - `search/all`
  - `search/games`
  - `roblox-music-ids`
  - `roblox-decal-ids`
  - `roblox-free-items`
  - `roblox-id-extractor`
- Platform clients:
  - `extension/roblox-game-codes`
  - `extension/roblox-game-stats`
  - `extension/auth/complete`, `extension/auth/exchange`, `extension/auth/session`, `extension/auth/logout`
  - `extension/codes/progress`
  - `mobile/home`
  - `mobile/codes`
  - `mobile/codes/[slug]`
  - `mobile/content/[kind]`
  - `mobile/content/[kind]/[slug]`
  - `mobile/quizzes/[code]/play`
  - `mobile/stats/games`, `mobile/stats/games/[universeId]`, `mobile/stats/games/[universeId]/chart`
- Mobile auth and progress (bearer token first, cookie fallback):
  - `mobile/auth/complete`, `mobile/auth/exchange`, `mobile/auth/session`, `mobile/auth/logout`
  - `mobile/codes/session`, `mobile/codes/progress`
  - `mobile/checklists/progress`
  - `mobile/quizzes/progress`
- User/session state:
  - `codes/session`, `codes/progress`
  - `checklists/session`, `checklists/progress`
  - `quizzes/session`, `quizzes/progress`
  - `account/avatar`
- Community and preferences:
  - `comments`
  - `comments/[id]`
  - `comments/session`
  - `consent`
- Ops:
  - `health`
  - `revalidate`

## Implementation Rules

- Validate all user input at the route boundary.
- Keep extension and mobile routes public-read unless a feature truly needs account state; never expose Supabase service role behavior through client routes.
- Extension account routes accept only Chromium identity callbacks and Bloxodes extension clients. Bearer sessions remain in extension-local storage and all database access stays server-side.
- Return small, stable typed JSON payloads for extension/mobile consumers because shipped clients can lag behind the website.
- For public client APIs, set explicit cache headers and `OPTIONS` support when the client can be cross-origin.
- For write endpoints, use shared helpers from:
  - `apps/web/src/lib/auth/session-user.ts`
  - `apps/web/src/lib/security/request.ts`
  - `apps/web/src/lib/security/rate-limit.ts`
- Make runtime behavior explicit with `dynamic`, `runtime`, or both when the endpoint depends on request-time state.
- Revalidate tags or paths after successful mutations.

## Revalidation Notes

- `/api/revalidate` is the central publish hook for codes, articles, authors, events, checklists, quizzes, wiki pages, tools, catalog, music, puzzle, and stats pages. It accepts single events and batched events from the Supabase revalidation worker.
- It builds the impacted URL set and Cloudflare `Cache-Tag` set, purges tags by default, and warms those URLs again so Cloudflare remains the primary public-page cache.
- Keep `apps/web/src/lib/public-cache-tags.ts` in sync with route families. Public pages must emit tags that match the tags purged here.
- If you add a new publishable content type, update the payload type union and path mapping here before relying on TTL expiry.

## Mutation Safety

- Keep trusted-origin checks for browser-originated writes.
- Preserve rate limits on comment or auth-related endpoints unless there is a clear reason to adjust them.
- Prefer shared normalization helpers over bespoke parsing inside each route.

## Extension And Mobile APIs

- `/api/extension/roblox-game-codes` resolves the public Roblox place ID and game name to a published Bloxodes codes page and returns a three-code preview plus the full page URL. `robloxUrl` remains an input only as a compatibility fallback for older installed extension clients; current clients must not send the full page URL.
- `/api/extension/roblox-game-stats` resolves a public Roblox place ID to a tracked universe and returns a compact seven-day player-history payload. `GET` is read-only; rate-limited `POST` verifies an unknown place with Roblox and idempotently adds it to the existing `NEW` stats workflow.
- Extension auth opens `/api/extension/auth/complete` in `chrome.identity.launchWebAuthFlow`; after Roblox sign-in, the authenticated callback returns a redirect-bound, short-lived, one-time code for an `app_sessions` bearer token. Do not add a second confirmation page inside the auth window because Chrome can leave it behind the main window and strand the popup. Session and logout routes accept that bearer token.
- `/api/extension/codes/progress` reads and updates the same `user_code_progress` rows as the website. Use `PATCH` for one code action so stale clients cannot overwrite unrelated progress; `PUT` exists for the extension's one-time local migration.
- `/api/mobile/home` aggregates the codes index plus per-kind section rails for the app home screen.
- `/api/mobile/codes` returns the paginated mobile codes index.
- `/api/mobile/codes/[slug]` returns active and expired codes for a mobile detail screen.
- `/api/mobile/content/[kind]` returns paginated mobile index cards for `catalog`, `wiki`, `tools`, `quizzes`, `checklists`, `events`, and `articles`.
- `/api/mobile/content/[kind]/[slug]` returns mobile detail sections and passes query/page controls through to native catalog sections. For `kind=catalog`, codes that match a published `wiki_collection_pages` row fall back to that collection so game wiki collections render natively.
- `/api/mobile/quizzes/[code]/play` returns the full `QuizData` (questions, options, correct option ids) for the native quiz player.
- `/api/mobile/stats/games` and its `[universeId]` + `[universeId]/chart` children wrap `apps/web/src/lib/stats.ts` with CORS headers for the app; the web `/api/stats/*` routes are unchanged.
- Mobile auth: the app opens `/api/mobile/auth/complete` in an auth browser session; after web Roblox login it redirects to `bloxodes://auth?code=<short-lived signed code>`. `/api/mobile/auth/exchange` swaps that code for an `app_sessions` bearer token. `/api/mobile/auth/session` and `/api/mobile/auth/logout` accept `Authorization: Bearer`.
- Mobile progress routes (`mobile/codes/progress`, `mobile/checklists/progress`, `mobile/quizzes/progress`) accept bearer tokens with a cookie fallback via `apps/web/src/lib/auth/mobile-session.ts`; they write the same `user_*_progress` tables as the web routes.
- Shared payload and state logic lives in `apps/web/src/lib/extension-codes.ts`, `apps/web/src/lib/extension-stats.ts`, `apps/web/src/lib/code-progress.ts`, `apps/web/src/lib/mobile-codes.ts`, and `apps/web/src/lib/mobile-content.ts`.
- Keep freshness badges aligned with the website by using `apps/web/src/lib/code-utils.ts` helpers instead of adding client-specific `is_new` rules.

## When Adding an Endpoint

1. Decide whether it is public-read, session-scoped, or a mutation.
2. Reuse existing data helpers from `apps/web/src/lib/*` where possible.
3. Add cache invalidation if the endpoint mutates data consumed by cached pages or loaders.
4. Document it in `agents/routes/agents.md`.
