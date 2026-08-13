# Environment System

Status: Active
Last verified: 2026-08-13
Evidence: 126 unique legacy key/value pairs verified losslessly; 119 stored variable names covered by committed examples; local, managed-dev, production-preview, and process-only profiles executed

## Storage Model

```text
env/                         # committed contracts only
  config.json
  examples/**.env.example

.envs/                       # ignored real values; mode 600
  targets/
    local.env
    managed-dev.env
    production.env
  shared/application.env
  integrations/{content,distribution}.env
  pipelines/{articles,indexing}.env
  operations/{analytics,umami}.env
  infrastructure/{cloudflare,dokploy,homelab,northflank,northflank-stats,vps}.env
  secrets/google-indexing-service-account.json
```

Real secrets are never committed. `env/examples/` is the variable-name and safe-default contract. Deployed production values remain in GitHub Actions secrets/variables, Dokploy runtime/build configuration, the VPS worker env file, the Supabase self-hosted env, or `/etc/bloxodes/article-automation.env` on the homelab.

## Profiles

- `local`: true local Supabase at `127.0.0.1:54321`; generated with `npm run env:sync-local` from the running CLI stack.
- `managed-dev`: remote non-production `*.supabase.co` project used by article queue/writer workflows.
- `production-preview`: workstation preview against self-hosted production; explicit selection only.
- `process-only`: loads no files. This is the default for `NODE_ENV=production` and `NODE_ENV=test`.

Select a profile with `BLOXODES_ENV_PROFILE`. Development defaults to `local`; production/test never fall back to workstation files.

## Overlays

Set comma-separated `BLOXODES_ENV_OVERLAYS` when a command needs additional credentials:

- `analytics`
- `articles`
- `cloudflare`
- `dokploy`
- `homelab`
- `indexing`
- `northflank`
- `northflank-stats`
- `vps`

Process variables always win because dotenv loading uses `override: false`.

For a workstation command that intentionally targets production, set both `BLOXODES_ENV_PROFILE=production-preview` and the command's existing `NODE_ENV=production`/`--allow-prod` guards. On GitHub, Dokploy, VPS, and homelab, continue injecting runtime variables; do not select a workstation profile.

## Commands

- `npm run env:migrate`: one-time migration command; classify legacy root files into `.envs/` without deleting the sources. It refuses to run after legacy cleanup.
- `npm run env:verify`: one-time proof that every legacy key/value pair and the Google JSON secret survived migration. The Google file path is intentionally relocated from `.env.secrets/` to `.envs/secrets/`.
- `npm run env:check`: ensure every real stored variable name has a committed example and secret files are not group/world readable.
- `npm run env:sync-local`: derive current local publishable/secret API keys from the running Bloxodes Supabase CLI stack without printing them.
- `npm run dev:local`: use the true local target and refuse non-local Supabase.
- `npm run dev:managed`: use the managed-development target and refuse anything outside HTTPS `*.supabase.co`.
- `npm run dev:prod`: use the explicit production target for a read-only operator preview.

## Value Ownership

- Targets contain only database/media endpoint credentials for that target.
- Shared application contains cross-target web/auth settings.
- Integrations contain content research/generation and distribution providers.
- Pipelines contain workload-specific credentials and controls.
- Infrastructure contains operator access for one platform.
- Non-dotenv private material lives under `.envs/secrets/`.

Do not create a pipeline env file merely for symmetry. Codes, catalog, stats, and content scripts normally consume the selected target plus process-injected schedule tuning; their non-secret defaults stay in code or checked-in cron manifests.

## Worktrees

The Codex template runs `scripts/dev/setup-worktree.sh`. New worktrees link the single ignored `.envs/` directory from the main checkout rather than linking many ambiguous root `.env*` files. Existing files are never overwritten.

For this migration worktree, `.envs/` is intentionally an isolated copy so changes cannot modify the active main checkout.

## External Runtime Contracts

- GitHub/Dokploy web build: variables are injected through one aggregate BuildKit secret and process env; the image does not contain the secret file.
- Local Compose web build/runtime: the same production profile is assembled from shared application, content integrations, distribution integrations, and the production target. Build inputs use four BuildKit secret mounts because `.envs/` is excluded from the Docker context; runtime uses the same four `env_file` entries.
- Dokploy runtime: application secrets are configured on the deployed service.
- VPS worker: `/home/codex-admin/bloxodes-stats-worker/env.stats-worker`, mode 600.
- Homelab: `/etc/bloxodes/article-automation.env`, root-owned, group-readable by the service group, mode 640.
- Self-hosted Supabase: `/home/codex-admin/bloxodes-supabase/.env`; do not copy this full vendor/runtime contract into the repository.

## Legacy Aliases

The migration preserves exact values and therefore preserves these old names: `HOSTINGER_Token`, `Northflank_API_Token`, and `Umami_website_id`. Committed examples label them as legacy. Normalize them only together with all consumers and external stores.

## Safety

- Never print env values during audits.
- Never expose `SUPABASE_SERVICE_ROLE` or `sb_secret_*` to browser/mobile/extension code.
- `NEXT_PUBLIC_*` and Expo public variables are client-visible.
- Production-capable scripts must retain URL/host guards and explicit allow-production flags.
- A profile name is not authorization; command-specific write safeguards still apply.
