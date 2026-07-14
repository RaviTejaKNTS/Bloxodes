# Bloxodes Mobile

Expo React Native app for the Bloxodes Android and iOS clients.

## Current Scope

An expo-router app with a bottom tab bar (Home, Codes, Browse, Stats, Account) and native screens for the main Bloxodes sections:

- Home feed with codes, events, catalog, wiki, quiz, and checklist rails
- Codes index and detail with copy actions and used-code tracking
- Catalog pages, wiki hubs, and game collection pages rendered natively with per-section pagination
- Tools and events detail pages
- Native quiz player with difficulty selection and scoring
- Interactive checklists with progress tracking
- Live game stats with sortable lists and player-count charts
- Global search powered by the website search endpoint
- Optional Roblox sign-in: progress is stored locally first and merges with the Bloxodes account when signed in

Articles and puzzles intentionally open on bloxodes.com instead of rendering natively.

The app reads JSON from the web app's `/api/mobile/*` routes (see `AGENTS.md` for the full contract) plus `GET /api/search/all`.

## Run Locally

From the repo root:

```bash
npm run dev:mobile
```

Then:

- Open `http://localhost:8081` for a browser preview, or
- Scan the Expo QR code with Expo Go on a physical phone, or
- Press `i` for iOS Simulator, or
- Press `a` for Android Emulator.

You can also launch directly:

```bash
npm run ios
npm run android
```

## API Base URL

By default, the app uses production:

```txt
https://bloxodes.com
```

To test against a local web server:

```bash
EXPO_PUBLIC_BLOXODES_API_URL=http://192.168.1.20:3000 npm run dev:mobile
```

Use your computer's LAN IP for physical devices. `localhost` points at the phone itself, not the Mac running the Next.js server.

For simulator-only testing on the same Mac, `http://localhost:3000` is usually fine.

## Store Builds

The app includes Expo Application Services profiles in `eas.json`.

```bash
eas build --platform android --profile production
eas build --platform ios --profile production
eas submit --platform android --profile production
eas submit --platform ios --profile production
```

Before production submission, confirm App Store Connect and Play Console metadata, screenshots, privacy/data-safety answers, age/content rating, support URL, and signing credentials.

## Checks

```bash
npm run typecheck:mobile
```
