# API Routes Guide

Scope: `apps/web/src/app/api`.

These routes back interactive site features, search, tool data, session/progress storage, moderation-aware comments, consent state, health checks, and publish-time revalidation.

## Endpoint Groups

- Search and catalog data:
  - `search/all`
  - `search/games`
  - `roblox-music-ids`
  - `roblox-free-items`
  - `roblox-id-extractor`
- Platform clients:
  - `extension/roblox-game-codes`
  - `mobile/codes`
  - `mobile/codes/[slug]`
  - `mobile/content/[kind]`
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

- `/api/extension/roblox-game-codes` resolves Roblox place/game context to a published Bloxodes codes page and returns a three-code preview plus the full page URL.
- `/api/mobile/codes` returns the paginated mobile codes index.
- `/api/mobile/codes/[slug]` returns active and expired codes for a mobile detail screen.
- `/api/mobile/content/[kind]` returns paginated mobile index cards for `tools`, `quizzes`, `checklists`, and `events`.
- Shared payload logic lives in `apps/web/src/lib/extension-codes.ts`, `apps/web/src/lib/mobile-codes.ts`, and `apps/web/src/lib/mobile-content.ts`.
- Keep freshness badges aligned with the website by using `apps/web/src/lib/code-utils.ts` helpers instead of adding client-specific `is_new` rules.

## When Adding an Endpoint

1. Decide whether it is public-read, session-scoped, or a mutation.
2. Reuse existing data helpers from `apps/web/src/lib/*` where possible.
3. Add cache invalidation if the endpoint mutates data consumed by cached pages or loaders.
4. Document it in `agents/routes/agents.md`.
