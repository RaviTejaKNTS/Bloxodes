# Bloxodes Mobile

Expo React Native app for the Bloxodes Android and iOS clients.

## Current Scope

V1 is intentionally small and database-like:

- Codes index
- Code detail page
- Active and expired codes
- Copy code action
- Native index cards for Catalog, Tools, Wiki, Quizzes, Lists, Checklists, Events, and Articles
- Search powered by the website search endpoint
- Bloxodes-style left navigation
- Sign-in handoff to the existing Bloxodes Roblox OAuth web flow

The app reads public JSON from the web app:

- `GET /api/mobile/codes`
- `GET /api/mobile/codes/[slug]`
- `GET /api/mobile/content/[kind]`
- `GET /api/search/all`

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
