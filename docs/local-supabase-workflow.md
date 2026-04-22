# Local Supabase Workflow

This repo now supports a local-first Supabase workflow without changing production env names.

## What stays the same in production

- Dokploy can keep injecting the current `SUPABASE_*`, `SITE_URL`, `AUTH_SESSION_SECRET`, and related env vars.
- The app still reads the same production env variable names.
- Build-time env for Docker/Dokploy stays unchanged.

## First-time local setup

1. Start a Docker-compatible runtime such as Docker Desktop or OrbStack.
2. Copy `.env.local.example` to `.env.local`.
3. Start the local Supabase stack:

```bash
npm run supabase:start
```

4. Copy the local Supabase values into `.env.local`:

```bash
npm run supabase:status:env
```

Use the local `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE` shown by the CLI.

5. Reset the local database from migrations and local seeds:

```bash
npm run supabase:reset
```

6. Start the app:

```bash
npm run dev
```

The local stack uses:

- API: `http://127.0.0.1:54321`
- DB: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- Studio: `http://127.0.0.1:54323`

## Normal development flow

1. Make schema changes locally.
2. Save them as migrations in `supabase/migrations/`.
3. Rebuild from scratch locally:

```bash
npm run supabase:reset
```

4. Test the app and any affected scripts locally.
5. Push migrations to remote only when local checks pass.

## Safe push flow

Preview what would be applied:

```bash
npm run supabase:push:dry
```

Push when ready:

```bash
supabase db push
```

Use a staging/preview Supabase environment before production when possible.

## Script env behavior

Most scripts in `scripts/` now load env through `scripts/shared/load-env.ts`.

The load order matches a local-friendly pattern:

1. `.env.development.local` or `.env.production.local`
2. `.env.local`
3. `.env.development` or `.env.production`
4. `.env`

Important:

- existing process env vars always win
- local files do not override injected production env vars
- this keeps Dokploy/GitHub Actions behavior intact while making local script work safer

## Handy commands

```bash
npm run supabase:start
npm run supabase:stop
npm run supabase:status
npm run supabase:status:env
npm run supabase:reset
npm run supabase:push:local
npm run supabase:push:dry
```
