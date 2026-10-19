# Environment

Last verified: 2026-10-19

How env files are stored, loaded and protected. Never print env values, commit them or paste them into docs or logs.

## Where values live

| Store | Holds |
| --- | --- |
| Homelab `/srv/data/projects/Bloxodes/.envs/` | The only editable copy of workstation env files. Edit here only, mode `0600`. |
| Mac `.envs/` (Pro and Air) | Read-only mirrors, mode `0400`. Homelab pushes to the Pro every two minutes; the Air pulls. Don't edit, chmod or recreate them. Stray edits are moved to `~/.local/state/env-mirror/local-edits/` and replaced. |
| `env/examples/` | Committed variable names and safe defaults. Every real variable needs an example. |
| `env/config.json` | Profile and overlay definitions. |
| GitHub secrets and environments | CI, deploy, schema and publication credentials. |
| Dokploy | Production web runtime env. |
| VPS `/home/ravitejaknts/bloxodes-stats-worker/env.stats-worker` | Stats worker env. |
| VPS `/home/ravitejaknts/bloxodes-supabase/.env` | Self-hosted Supabase env. Don't copy it into the repo. |
| Homelab `/etc/bloxodes/article-automation.env` | Article automation runtime env, mode `0640`. |

Each T3 worktree links `.envs` to its machine's main checkout, so every worktree sees the same files.

## Layout

```text
.envs/
  shared/application.env
  integrations/{content,distribution}.env
  targets/{managed-dev,production}.env
  pipelines/{articles,indexing}.env
  operations/{analytics,umami}.env
  infrastructure/{cloudflare,devices,dokploy,homelab,northflank,northflank-stats,vps}.env
  secrets/google-indexing-service-account.json
```

- **targets/** hold database and media credentials for one target only.
- **infrastructure/devices.env** holds machine hosts, users and sudo passwords. Pipe a sudo password to `sudo -S`; never print it.
- **infrastructure/vps.env** holds the VPS operator login.

## Profiles

Pick one with `BLOXODES_ENV_PROFILE`.

| Profile | Loads | Default when |
| --- | --- | --- |
| `managed-dev` | shared application, content and distribution integrations, managed-dev target | local development |
| `production-preview` | same, with the production target | never; choose it explicitly |
| `process-only` | no files | `NODE_ENV=production` or `test`, all CI, the VPS worker |

`BLOXODES_ENV_OVERLAYS` adds files for one command, comma separated: `analytics`, `articles`, `cloudflare`, `dokploy`, `homelab`, `indexing`, `northflank`, `northflank-stats`, `umami`, `vps`. Overlays load even under `process-only`.

Process variables always win over file values. Within files, the first file wins.

## Rules

- A profile is not permission. Scripts that can write production also need their own `--allow-prod` or `--apply` flags.
- `NEXT_PUBLIC_*` and Expo public variables reach the browser. Never put service-role keys or `sb_secret_*` there.
- There is no local Supabase. Don't start one or create a `local.env`.
- `npm run env:doctor` checks layout, modes and example coverage without printing values. CI runs `env:doctor -- --ci`.

## Known issues

- `WIKI_MEDIA_PUBLIC_BASE_URL` sits in `env/examples/retired.env.example` but `apps/web/src/lib/wiki-media.ts` still reads it as an optional override.
- Legacy names `HOSTINGER_Token`, `Northflank_API_Token`, `VPS_ADMIN_PASSWORD1` and the `ARTICLE_WRITER_PI_*` group remain in private profiles with no code consumer.
