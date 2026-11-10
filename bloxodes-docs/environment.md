# Environment

Last verified: 2026-11-09

How env values are stored, changed, loaded and protected. Never print env values, commit them or paste them into docs or logs.

## Change a value

Infisical Cloud, project `bloxodes`, environment `prod`, is the one source. Each folder feeds one place. Change values there, with the value on stdin and never in a command line:

```sh
ssh homelab '~/.local/bin/infisical-env list bloxodes --keys'        # folders, places and key names
printf %s "$VALUE" | ssh homelab '~/.local/bin/infisical-env set bloxodes /pipelines/articles KEY'
ssh homelab '~/.local/bin/infisical-env unset bloxodes /pipelines/articles KEY'
ssh homelab '~/.local/bin/infisical-env apply bloxodes /vps/web-app'  # redeploy so Dokploy uses its new values now
```

`set` writes the place at once; changes made in the Infisical web app arrive within five minutes. Don't edit the homelab files, GitHub secrets, Dokploy or the VPS env files by hand. A rotated key needs a `set` in every folder that holds it. How the sync works, conflicts and recovery: Cockpit `workflow/infisical.md`.

## Where values live

| Store | Holds | Infisical folder |
| --- | --- | --- |
| Homelab `/srv/data/projects/Bloxodes/.envs/` | Workstation env files, mode `0600`, written by the sync. | The matching folder, such as `/pipelines/articles` |
| Mac `.envs/` (Pro and Air) | Read-only mirrors, mode `0400`. Homelab pushes to the Pro every two minutes; the Air pulls. Don't edit, chmod or recreate them. Stray edits are moved to `~/.local/state/env-mirror/local-edits/` and replaced. | None, copies of the homelab files |
| `env/examples/` | Committed variable names and safe defaults. Every real variable needs an example. | None |
| `env/config.json` | Profile and overlay definitions. | None |
| GitHub secrets and variables | CI, deploy, schema and publication credentials. | `/github/secrets`, `/github/variables` |
| GitHub `production` and `franchise-artwork` environments | Publication and artwork credentials. | `/github/production/secrets`, `/github/franchise-artwork/secrets` |
| Dokploy | Production web runtime env, and the Umami and Vaultwarden composes. Used from the next deploy. | `/vps/web-app`, `/vps/umami`, `/vps/vaultwarden` |
| VPS `/home/ravitejaknts/bloxodes-stats-worker/env.stats-worker` | Stats worker env, read by each job. | `/vps/stats-worker` |
| VPS `/home/ravitejaknts/bloxodes-supabase/.env` | Self-hosted Supabase env, used when the containers are recreated. Don't copy it into the repo. | `/vps/supabase` |
| Homelab `/etc/bloxodes/article-automation.env` | Article discovery runtime env, mode `0640`. | `/homelab/article-automation` |

Each T3 worktree links `.envs` to its machine's main checkout, so every worktree sees the same files.

## Layout

```text
.envs/
  shared/application.env
  integrations/{content,distribution}.env
  targets/{managed-dev,production}.env
  pipelines/{articles,codes,indexing}.env
  operations/{analytics,umami}.env
  infrastructure/{cloudflare,devices,dokploy,homelab,northflank-stats,vps}.env
  secrets/google-indexing-service-account.json
```

- **targets/** hold database and media credentials for one target only.
- **pipelines/codes.env** holds `NOTION_CODES_QUEUE_TOKEN`, the Notion integration key the homelab codes finder uses for the [Codes Queue](automation/notion-queues.md#codes-queue). The finder's unit reads it and `targets/production.env` straight from the homelab's `.envs`.
- **infrastructure/devices.env** holds machine hosts, users and sudo passwords. It's copied from Infisical `cockpit /devices`, not from the `bloxodes` project. Pipe a sudo password to `sudo -S`; never print it.
- **infrastructure/vps.env** holds the VPS operator login.

## Profiles

Pick one with `BLOXODES_ENV_PROFILE`.

| Profile | Loads | Default when |
| --- | --- | --- |
| `managed-dev` | shared application, content and distribution integrations, managed-dev target | local development |
| `production-preview` | same, with the production target | never; choose it explicitly |
| `process-only` | no files | `NODE_ENV=production` or `test`, all CI, the VPS worker |

`BLOXODES_ENV_OVERLAYS` adds files for one command, comma separated: `analytics`, `articles`, `cloudflare`, `dokploy`, `homelab`, `indexing`, `northflank-stats`, `umami`, `vps`. Overlays load even under `process-only`.

Process variables always win over file values. Within files, the first file wins.

## Roblox wiki publisher

`content:publish`, `content:status` and `content:candidates` pick the `managed-dev` or `production-preview` profile from `--target` (default `managed-dev`) and fail if the loaded credentials don't match the target. Production adds the `vps` overlay for a read-only schema-ledger check. They use `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE` and the `WIKI_R2_*` names from `integrations/content.env`; production also needs `REVALIDATE_SECRET` and `VPS_SUPABASE_STUDIO_*`. No new names.

The Content Factory has no env files. Its `bin/publisher` runs these commands from the device's main checkout (`/srv/data/projects/Bloxodes` or `~/projects/Bloxodes`), using that checkout's `.envs`.

## Rules

- A profile is not permission. Scripts that can write production also need their own `--allow-prod` or `--apply` flags.
- `NEXT_PUBLIC_*` and Expo public variables reach the browser. Never put service-role keys or `sb_secret_*` there.
- There is no local Supabase. Don't start one or create a `local.env`.
- `npm run env:doctor` checks layout, modes and example coverage without printing values. CI runs `env:doctor -- --ci`.

## Known issues

- `WIKI_MEDIA_PUBLIC_BASE_URL` sits in `env/examples/retired.env.example` but `apps/web/src/lib/wiki-media.ts` still reads it as an optional override.
- Legacy names `HOSTINGER_Token`, `VPS_ADMIN_PASSWORD1` and the `ARTICLE_WRITER_PI_*` group remain in private profiles with no code consumer.
