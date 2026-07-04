# Mobile App Guide

Scope: `apps/mobile`.

This workspace contains the Expo React Native app for Bloxodes Android and iOS builds. It uses expo-router with a bottom tab bar and native screens for codes, catalog, wiki + collections, tools, quizzes, checklists, events, stats, and search.

## Defaults

- Keep mobile data access behind `apps/web/src/app/api/mobile/*`. Do not connect the app directly to Supabase, and do not consume web-only `/api/*` routes that lack CORS headers.
- Match the web app's quiet Bloxodes style: DESIGN.md tokens live in `src/theme.ts`, and the theme provider (light/dark/system, persisted) is `src/theme-context.tsx`.
- Progress is local-first: used codes, checklist checks, and quiz results persist to AsyncStorage (`src/storage.ts` + `src/progress.ts`) and merge with the signed-in account when a session exists. Login is optional.
- Auth is bearer-token based. `src/auth.tsx` opens `/api/mobile/auth/complete` in an auth browser session, catches the `bloxodes://auth?code=...` redirect, exchanges the code at `/api/mobile/auth/exchange`, and stores the session token in SecureStore. All progress fetchers attach `Authorization: Bearer` via `src/api.ts`.
- On the Expo web target, auth falls back to the site's cookie session (`requestPlainJson` sends `credentials: "include"`).
- Keep shared fetchers and response types in `src/api.ts` / `src/types.ts`; do not duplicate payload shapes inside screens.
- `src/links.ts` maps bloxodes.com URLs to in-app routes (including `/wiki/<game>/<collection>` to the `<game>-<collection>` catalog code). Pages without a native screen open in the browser.
- Use `EXPO_PUBLIC_BLOXODES_API_URL` for local/staging API testing. The default is production `https://bloxodes.com`. When testing against a local web server from a physical phone, use the computer's LAN IP instead of `localhost`.

## Structure

- `app/_layout.tsx`: providers (SafeArea, Theme, Auth) plus the themed root stack.
- `app/(tabs)/`: bottom tabs — Home (`index`), Codes, Browse, Stats, Account.
- `app/codes/[slug].tsx`: code detail with copy actions and synced used-code checkboxes.
- `app/section/[kind]/index.tsx`: generic section index (catalog, wiki, tools, quizzes, checklists, events) with search and infinite scroll.
- `app/section/[kind]/[slug].tsx`: generic detail renderer with per-section pagination; wiki hub sections deep-link to codes/quiz/checklist/collection screens.
- `app/quiz/[code].tsx`: native quiz player (difficulty picker, scoring, account sync).
- `app/checklist/[slug].tsx`: interactive checklist with progress bar and account sync.
- `app/stats/[universeId].tsx`: game stats detail with an SVG player-count chart.
- `src/components/`: `ui.tsx` primitives and `content.tsx` content cards/section renderers.

## Workspace Notes

- The repo root pins `react-native` via npm `overrides` so the whole workspace resolves the Expo SDK's expected version; keep `react-native` in this package.json as an exact version that matches the override.
- `babel.config.js` resolves `babel-preset-expo` through `expo`'s own dependency chain so the preset copy that ships with the SDK (and can see `expo-router`) is always used, regardless of npm hoisting.
- `tsconfig.json` pins `react`/`react-native` type resolution to this workspace's copies via `paths`; `app.json` sets `experiments.tsconfigPaths: false` so Metro ignores those tsc-only mappings.

## Commands

- `npm run dev -w @bloxodes/mobile`: start Expo.
- `npm run web:local -w @bloxodes/mobile`: Expo web against `http://localhost:3000`.
- `npm run android -w @bloxodes/mobile`: start Expo and open Android target.
- `npm run ios -w @bloxodes/mobile`: start Expo and open iOS target.
- `npm run typecheck -w @bloxodes/mobile`: TypeScript check.

## API Contract

The app reads:

- `GET /api/mobile/home`
- `GET /api/mobile/codes`, `GET /api/mobile/codes/[slug]`
- `GET /api/mobile/content/[kind]`, `GET /api/mobile/content/[kind]/[slug]`
- `GET /api/mobile/quizzes/[code]/play`
- `GET /api/mobile/stats/games`, `GET /api/mobile/stats/games/[universeId]`, `GET /api/mobile/stats/games/[universeId]/chart`
- `GET /api/search/all`

Authenticated (bearer token, cookie fallback):

- `GET /api/mobile/auth/session`, `POST /api/mobile/auth/exchange`, `POST /api/mobile/auth/logout`
- `GET|PUT /api/mobile/codes/progress`
- `GET|PUT /api/mobile/checklists/progress`
- `GET|PUT /api/mobile/quizzes/progress`

Articles and puzzles are intentionally out of scope for the app; those links open on bloxodes.com.
