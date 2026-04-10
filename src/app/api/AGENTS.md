# API Routes Guide

Scope: `src/app/api`.

These routes back interactive site features, search, tool data, session/progress storage, moderation-aware comments, consent state, health checks, and publish-time revalidation.

## Endpoint Groups

- Search and catalog data:
  - `search/all`
  - `search/games`
  - `roblox-music-ids`
  - `roblox-free-items`
  - `roblox-id-extractor`
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
- For write endpoints, use shared helpers from:
  - `src/lib/auth/session-user.ts`
  - `src/lib/security/request.ts`
  - `src/lib/security/rate-limit.ts`
- Make runtime behavior explicit with `dynamic`, `runtime`, or both when the endpoint depends on request-time state.
- Revalidate tags or paths after successful mutations.

## Revalidation Notes

- `/api/revalidate` is the central publish hook for codes, articles, lists, authors, events, checklists, quizzes, wiki pages, tools, catalog, and music pages.
- It also coordinates Cloudflare purge behavior.
- If you add a new publishable content type, update the payload type union and the path/tag mapping here before relying on ISR to catch up eventually.

## Mutation Safety

- Keep trusted-origin checks for browser-originated writes.
- Preserve rate limits on comment or auth-related endpoints unless there is a clear reason to adjust them.
- Prefer shared normalization helpers over bespoke parsing inside each route.

## When Adding an Endpoint

1. Decide whether it is public-read, session-scoped, or a mutation.
2. Reuse existing data helpers from `src/lib/*` where possible.
3. Add cache invalidation if the endpoint mutates data consumed by cached pages or loaders.
4. Document it in `agents/routes/agents.md`.
