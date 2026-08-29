# Environment System

Status: Active
Last verified: 2026-08-29
Evidence: ignored value store and permissions, committed examples/config, loader guards, worktree linkage, workstation `env:doctor`/`env:check`, and homelab validation of the managed-development runtime plus guarded production release target

## Storage Model

```text
env/                         # committed contracts only
  config.json
  examples/**.env.example

.envs/                       # ignored real values; mode 600
  targets/
    managed-dev.env
    production.env
  shared/application.env
  integrations/{content,distribution}.env
  pipelines/{articles,indexing}.env
  operations/{analytics,umami}.env
  infrastructure/{cloudflare,dokploy,homelab,northflank,northflank-stats,vps}.env
  secrets/google-indexing-service-account.json
```

Real secrets are never committed. `env/examples/` is the variable-name and safe-default contract. Deployed production values remain in GitHub Actions secrets/variables, Dokploy runtime/build configuration, the VPS worker env file, the Supabase self-hosted env, or protected `/etc/bloxodes/*-automation.env` files on the homelab.

## Profiles

- `managed-dev`: remote non-production HTTPS `*.supabase.co` project used by all workstation web development, scripts, previews, content imports, and article queue/writer workflows.
- `production-preview`: workstation preview against self-hosted production; explicit selection only.
- `process-only`: loads no files. This is the default for `NODE_ENV=production` and `NODE_ENV=test`.

Select a profile with `BLOXODES_ENV_PROFILE`. Development defaults to `managed-dev`; production/test never fall back to workstation files. The retired local Supabase CLI database has no profile or env file and must not be used.

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
- `umami`
- `vps`

Process variables always win because dotenv loading uses `override: false`.

For a workstation command that intentionally targets production, set both `BLOXODES_ENV_PROFILE=production-preview` and the command's existing `NODE_ENV=production`/`--allow-prod` guards. On GitHub, Dokploy, VPS, and homelab, continue injecting runtime variables; do not select a workstation profile.

## Commands

- `npm run env:doctor`: verify the full workstation layout, private modes, committed example coverage, target host/key consistency, profile order, ignored Git boundary, and absence of retired root/local-Supabase files without printing values.
- `npm run env:check`: ensure every real stored variable name has a committed example and secret files are not group/world readable.
- `npm run dev` or `npm run dev:managed`: start the workstation Next.js app against managed development and refuse anything outside HTTPS `*.supabase.co`.
- `npm run dev:prod`: use the explicit production target for a read-only operator preview.
- `npm run supabase:migrations:check`: validate the committed migration chain and convergence policy without a database connection.
- `npm run supabase:managed-dev:check`: run guarded, read-only managed-development schema/API readiness checks.
- `npm run platform:sync:check`: read-only comparison of Git, live deployment, homelab, VPS image, and production migration state.

## Value Ownership

- Targets contain only database/media endpoint credentials for that target.
- Shared application contains cross-target web/auth settings, including the public GA measurement ID used by workstation builds. Public production analytics IDs are injected by GitHub/Dokploy. `ADMIN_API_TOKEN` also lives here: it enables `/api/admin/*` for the personal `apps/admin-extension`; leaving it unset disables those routes, and the production value is set only on the Dokploy runtime service.
- Integrations contain content research/generation and distribution providers.
- Pipelines contain workload-specific credentials and controls.
- The article pipeline owns `ARTICLE_AUTO_PUBLISH` and the release polling/path controls. The path may point to ignored `.envs/targets/production.env`; its values remain target-owned and are parsed only by the post-model release parent.
- The wiki pipeline owns `WIKI_DEV_SUPABASE_*`, fixed Luna Max controls, and the production target-file path. Its service env also contains only the bucket-scoped `WIKI_R2_*` keys for `bloxodes-wiki`; production database values stay in the target file and are removed from the model child environment.
- Infrastructure contains operator access for one platform.
- The `cloudflare` overlay contains the single bucket-scoped `WIKI_R2_*` credential set for `bloxodes-wiki`. Only the guarded publisher loads it. Managed development and production keep separate Supabase credentials and publication pointers while both use canonical `https://media.bloxodes.com/wiki/*` public media URLs.
- `operations/analytics.env` owns GA4 account/property, Search Console, Bing Webmaster, and Google OAuth operator values. It must contain neither Umami values nor duplicated `NEXT_PUBLIC_*` web configuration.
- `operations/umami.env` exclusively owns the self-hosted Umami operator username, password, and canonical `UMAMI_WEBSITE_ID`. Production web builds receive the public `NEXT_PUBLIC_UMAMI_HOST_URL` and matching `NEXT_PUBLIC_UMAMI_WEBSITE_ID` from GitHub/Dokploy rather than loading operator credentials.
- Non-dotenv private material lives under `.envs/secrets/`.

Do not create a pipeline env file merely for symmetry. Codes, catalog, stats, and content scripts normally consume the selected target plus process-injected schedule tuning; their non-secret defaults stay in code or checked-in cron manifests.

## Worktrees

The Codex template runs `scripts/dev/setup-worktree.sh`. New worktrees link the single ignored `.envs/` directory from the main checkout rather than linking many ambiguous root `.env*` files. Existing files are never overwritten. The `.envs` path itself and its contents are both ignored so a worktree symlink cannot appear in a commit.

The homelab checkout mirrors the complete private `.envs/` profile tree for feature, content, and operator work. Host-specific executable paths may differ between the Mac and Linux checkouts; the homelab systemd jobs continue to use the separate protected `/etc/bloxodes/article-automation.env` runtime file.

## External Runtime Contracts

- GitHub/Dokploy web build: variables are injected through one aggregate BuildKit secret and process env; the image does not contain the secret file.
- Local Compose web build/runtime: the same production profile is assembled from shared application, content integrations, distribution integrations, and the production target. Build inputs use four BuildKit secret mounts because `.envs/` is excluded from the Docker context; runtime uses the same four `env_file` entries.
- Dokploy runtime: application secrets are configured on the deployed service.
- VPS worker: `/home/codex-admin/bloxodes-stats-worker/env.stats-worker`, mode 600.
- Homelab: `/etc/bloxodes/article-automation.env` and `/etc/bloxodes/wiki-automation.env`, root-owned, group-readable by `teja`, mode 640. They contain managed-development worker values and release controls, but no production Supabase credential values.
- Homelab model authentication: the `teja` service account's protected Codex home plus `/home/teja/.pi/agent/auth.json` for Pi's independent ChatGPT Plus/Pro login, never the article env file. Treat both as passwords and never copy them between hosts. The article env owns only binary paths, the hard-pinned Luna Max provider/model/reasoning settings, timeouts, and queue controls.
- Self-hosted Supabase: `/home/codex-admin/bloxodes-supabase/.env`; do not copy this full vendor/runtime contract into the repository.

## Legacy Aliases

The migration preserves these remaining old names: `HOSTINGER_Token` and `Northflank_API_Token`. Committed examples label them as legacy. Normalize them only together with all consumers and external stores. The former `Umami_website_id` alias was normalized to `UMAMI_WEBSITE_ID` on 2026-08-14 and must not be reintroduced.

## Safety

- Never print env values during audits.
- Never stage `.envs`, an env value file, or a credential JSON. `env/examples/` is the only committed env surface.
- Never expose `SUPABASE_SERVICE_ROLE` or `sb_secret_*` to browser/mobile/extension code.
- `NEXT_PUBLIC_*` and Expo public variables are client-visible.
- Production-capable scripts must retain URL/host guards and explicit allow-production flags.
- Automated article release must sanitize inherited managed-development variables before spawning production commands and must load the production target only after all model processes have exited.
- A profile name is not authorization; command-specific write safeguards still apply.
