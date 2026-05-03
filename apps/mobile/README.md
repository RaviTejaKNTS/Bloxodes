# Bloxodes Mobile

Expo React Native app for the Bloxodes Android and iOS clients.

## Current Scope

V1 is intentionally small:

- Codes index
- Code detail page
- Active and expired codes
- Copy code action
- Bloxodes-style left navigation with non-codes sections disabled for now

The app reads public JSON from the web app:

- `GET /api/mobile/codes`
- `GET /api/mobile/codes/[slug]`

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

## Checks

```bash
npm run typecheck:mobile
```
