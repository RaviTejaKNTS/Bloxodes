# Mobile App Guide

Scope: `apps/mobile`.

This workspace contains the Expo React Native app for Bloxodes Android and iOS builds.

## Defaults

- Keep mobile data access behind public Bloxodes web APIs. Do not connect the app directly to Supabase.
- Match the web app's quiet Bloxodes style: readable surfaces, restrained borders, small-radius cards, and the same navigation order.
- Keep V1 focused on codes index and code detail screens. Other sidebar items can be present as disabled navigation until their screens are implemented.
- Prefer shared types and small API clients before duplicating response shapes across screens.
- Keep platform-specific code out of screen components unless it is truly needed.
- Use `EXPO_PUBLIC_BLOXODES_API_URL` for local/staging API testing. The default is production `https://bloxodes.com`.
- When testing against a local web server from a physical phone, use the computer's LAN IP instead of `localhost`.
- Keep auth out of mobile V1 unless a user-facing feature needs it. Future login/follow/notification work should use Bloxodes APIs, not direct Supabase.

## Commands

- `npm run dev -w @bloxodes/mobile`: start Expo.
- `npm run android -w @bloxodes/mobile`: start Expo and open Android target.
- `npm run ios -w @bloxodes/mobile`: start Expo and open iOS target.
- `npm run typecheck -w @bloxodes/mobile`: TypeScript check.

## API Contract

The app currently reads:

- `GET /api/mobile/codes`
- `GET /api/mobile/codes/[slug]`

Use `EXPO_PUBLIC_BLOXODES_API_URL` to point at a local or staging web server during development. The default is `https://bloxodes.com`.

## Current UI Scope

- Left navigation uses the same Bloxodes order: Catalog, Tools, Wiki, Codes, Quizzes, Lists, Checklists, Events, Articles.
- Only Codes is enabled for V1.
- Codes index supports pagination and refresh.
- Code detail shows active and expired codes, copy actions, and a link back to the website when available.
