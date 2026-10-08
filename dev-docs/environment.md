# Environment System

Status: Active
Last verified: 2026-10-08
Path layout rechecked 2026-10-08 against live T3 registrations, Git worktree metadata, service paths and env links. Other component verification boundaries remain as documented.
Evidence: HDD storage layout, private env filenames/modes, compatibility paths and T3 setup ownership inspected on October 7. Selective-review workflow secret boundaries and existing GitHub API-key metadata were also inspected on October 7. Runtime activation readback verified unchanged protected env hashes, ownership, modes and HDD/shared-profile links. Ignored value store, loader guards and workstation/homelab `env:doctor`/`env:check` retain their August 19 verification boundary.

## GitHub CI ownership

Task setup links existing ignored env storage and creates scratch directories. It performs no install/build/check. GitHub checks use process-only injected managed-development credentials and `env:doctor -- --ci`; they do not need workstation `.envs` files. `env/examples/ci.env.example` documents CI-only names.

Managed SQL uses a project-targeted Supabase access token rather than a database password or copied OAuth session. Production migrations use separate HTTPS Studio credentials inside the production GitHub environment. Collection CI needs the four existing `WIKI_R2_*` values. Preserve installed env files and services. See `operations/deployment.md` for rollout and credential verification status.

Selective PR code reviews reuse the existing GitHub repository `OPENAI_API_KEY` through `openai/codex-action`. The key is injected only into the review job, with no database, media, deployment or revalidation credentials. A separate feedback job has PR comment permission and no API key. This does not change the key's existing article-generation uses or any installed env file. See [selective code review](operations/deployment.md#selective-code-review) for trigger and cost boundaries.

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

Real secrets are never committed. `env/examples/` is the variable-name and safe-default contract. Deployed production values remain in GitHub Actions secrets/variables, Dokploy runtime/build configuration, the VPS worker env file, the Supabase self-hosted env, or the protected article/wiki automation env files under `/etc/bloxodes/` on the homelab.

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
- The homelab preview uses `http://teja-homelab.tail13b5bd.ts.net:3000` (direct-IP fallback `http://100.86.117.125:3000`). `apps/web/next.config.js` explicitly allows those development origins plus `127.0.0.1`; Next's default origin guard otherwise blocks the development WebSocket and can leave client components unhydrated. This setting applies only to development, with production host/security rules unchanged. Verified during wiki preview QA on 2026-09-05.
- `npm run dev:prod`: use the explicit production target for a read-only operator preview.
- `npm run supabase:migrations:check`: validate the committed migration chain and convergence policy without a database connection.
- `npm run supabase:managed-dev:check`: run guarded, read-only managed-development schema/API readiness checks.
- `npm run platform:sync:check`: read-only comparison of Git, live deployment, homelab, VPS image, and production migration state.

## Value Ownership

- Targets contain only database/media endpoint credentials for that target.
- Shared application contains cross-target web/auth settings, including the public GA measurement ID used by workstation builds. Public production analytics IDs are injected by GitHub/Dokploy. `ADMIN_API_TOKEN` also lives here: it enables `/api/admin/*` for the personal `apps/admin-extension`; leaving it unset disables those routes, and the production value is set only on the Dokploy runtime service.
- Integrations contain content research/generation and distribution providers.
- Pipelines contain workload-specific credentials and controls.
- Infrastructure contains operator access for one platform.
- `operations/analytics.env` owns GA4 account/property, Search Console, Bing Webmaster, and Google OAuth operator values. It must contain neither Umami values nor duplicated `NEXT_PUBLIC_*` web configuration.
- `operations/umami.env` exclusively owns the self-hosted Umami operator username, password, and canonical `UMAMI_WEBSITE_ID`. Production web builds receive the public `NEXT_PUBLIC_UMAMI_HOST_URL` and matching `NEXT_PUBLIC_UMAMI_WEBSITE_ID` from GitHub/Dokploy rather than loading operator credentials.
- Non-dotenv private material lives under `.envs/secrets/`.

Do not create a pipeline env file merely for symmetry. Codes, catalog, stats, and content scripts normally consume the selected target plus process-injected schedule tuning; their non-secret defaults stay in code or checked-in cron manifests.

## Worktrees

The canonical homelab store is `/srv/data/projects/Bloxodes/.envs/`. T3 project and thread paths use the canonical HDD locations; the former home-project compatibility link has been removed. T3 runs `scripts/dev/setup-worktree.sh` automatically and waits for its dependency-free Node helper. New worktrees link this one store, so all 16 private env/service-account files stay in sync. Setup reads env metadata, checks the required managed-development files, and never prints values. Files must remain private with no group/other access; nested symlinks are rejected. Existing local files or incorrect links stay intact and stop setup until reconciled. The `.envs` path itself and its contents are ignored. Setup does not change `/etc/bloxodes/`, GitHub secrets or provider login storage.

The homelab checkout mirrors the complete private `.envs/` profile tree for feature, content, and operator work. Host-specific executable paths may differ between the Mac and Linux checkouts; systemd jobs use separate protected `/etc/bloxodes/article-automation.env` and `/etc/bloxodes/wiki-automation.env` runtime files. The wiki model child receives only managed-development and shared-media values.

## External Runtime Contracts

- GitHub/Dokploy web build: variables are injected through one aggregate BuildKit secret and process env; the image does not contain the secret file.
- Local Compose web build/runtime: the same production profile is assembled from shared application, content integrations, distribution integrations, and the production target. Build inputs use four BuildKit secret mounts because `.envs/` is excluded from the Docker context; runtime uses the same four `env_file` entries.
- Dokploy runtime: application secrets are configured on the deployed service.
- VPS worker: `/home/codex-admin/bloxodes-stats-worker/env.stats-worker`, mode 600.
- Homelab: `/etc/bloxodes/article-automation.env`, root-owned, group-readable by the service group, mode 640.
- Homelab Codex authentication: the `teja` service account's protected Codex home (currently ChatGPT-managed authentication), never the article env file. Treat its auth material like a password; readiness calls only `codex login status` and never prints tokens. The article env owns only the Codex binary/model/reasoning settings and the Grok fallback controls.
- Self-hosted Supabase: `/home/codex-admin/bloxodes-supabase/.env`; do not copy this full vendor/runtime contract into the repository.

## Legacy Aliases

The migration preserves these remaining old names: `HOSTINGER_Token` and `Northflank_API_Token`. Committed examples label them as legacy. Normalize them only together with all consumers and external stores. The former `Umami_website_id` alias was normalized to `UMAMI_WEBSITE_ID` on 2026-08-14 and must not be reintroduced.

`env/examples/retired.env.example` records retired variable names that remain in protected operator profiles. Current loaders do not consume them. Keeping the blank name contract lets operators remove private values separately without deleting or exposing those values during a repository release.

## Safety

- Never print env values during audits.
- Never stage `.envs`, an env value file, or a credential JSON. `env/examples/` is the only committed env surface.
- Never expose `SUPABASE_SERVICE_ROLE` or `sb_secret_*` to browser/mobile/extension code.
- `NEXT_PUBLIC_*` and Expo public variables are client-visible.
- Production-capable scripts must retain URL/host guards and explicit allow-production flags.
- A profile name is not authorization; command-specific write safeguards still apply.

## Article stage environment ownership (September 6, 2026)

The code-controlled article runtime gives model tasks only tool/user paths, locale/network settings, a read-only inventory URL and ARTICLE_PIPELINE_STAGE. It forces process-only loading and excludes database, queue and publication credentials. The code-owned media/import/verification stages receive managed-development credentials; publication keeps its existing explicit runtime owner. This is environment minimization, not a claim that the CLI shell cannot read any other host file.

Optional pipeline controls are ARTICLE_PIPELINE_STAGE_TIMEOUT_MINUTES (45), ARTICLE_PIPELINE_PREVIEW_PORT (3100), and ARTICLE_PIPELINE_PREVIEW_BASE_URL (an existing managed-dev localhost/Tailscale URL). Defaults are in code and committed examples; no protected env values were changed. Host env:doctor passed on September 6 after this change.

The September 6 manual article run verified that deterministic article upload/import/QA stages must use NODE_ENV=development while retaining BLOXODES_ENV_PROFILE=process-only and the validated managed-development credentials. Model stages retain their minimized process-only environment. The import production guard remains unchanged; managed runs do not use --allow-prod.

### Legacy isolated article runtime

This earlier runtime is retained for rollback. Installed article and wiki units now use the shared HDD runtime below.

The prepared article release links the existing ignored `.envs` tree and uses `/etc/bloxodes/article-automation.env`; it does not copy secrets into Git or model environments. Releases have independent dependencies and persistent state under `/home/teja/.local/share/bloxodes-article-runtime`. Preparation validates the existing profile contract; activation requires the reviewed host installer. No new secret values are required.

Wiki automatic publication: the builder and Codex remain under `bloxodes-wiki-model` with no production credential access. The separate `bloxodes-wiki-publisher.service` uses the existing `teja` operator account, has no extra capabilities, runs trusted publication code only, and reads the existing protected production env. `/etc/bloxodes/wiki-automation.env` continues to hold development/media values and a production env file path, never production credentials. Queue receipts carry exact publication requests and errors between services. No approval-bypass flag is passed to Codex.

### Shared article/wiki runtime ownership

The installed `bloxodes-automation-runtime` release links the existing protected primary-checkout `.envs` tree. Activation readback confirmed both protected env files retained their bytes, owner, group and mode. No credential values changed or new credentials were required.

Units set `BLOXODES_AUTOMATION_RUNTIME=1` and `BLOXODES_CI_QA=1`. CI mode keeps authoring/media work on the worker and moves final checks, builds and rendered verification to GitHub. No local preview is started. Source, dependencies and persistent state live under `/srv/data/bloxodes-automation-runtime`; old artifact paths remain aliases. The wiki builder retains its restricted model account and cannot read `.envs`; the publisher retains the operator account. State and legacy artifact-path aliases are documented in [homelab operations](infrastructure/homelab.md#github-qa-runtime-activation).

October 1, 2026, scoped production repair: the authorized automation work corrected a malformed Dokploy runtime line separator joining `CLOUDFLARE_ZONE_ID` to a warm-after-purge assignment. A hash-guarded update preserved every other parsed runtime value, build argument/secret setting and the immutable image; same-image deploy/database health and authenticated Cloudflare tag revalidation passed. No workstation or protected homelab env values changed. See the existing deployment owner for exact verification scope.

October 1 publisher verification additionally stores the existing production web `REVALIDATE_SECRET` in ignored `.envs/targets/production.env`; every prior target value is preserved. Trusted publication reads it explicitly. Neither protected development automation env nor model credentials receive the secret; the restricted wiki account remains unable to read `.envs`. `env:doctor` and contract checks verify this ownership.

Host resolver repair is owned by [homelab operations](infrastructure/homelab.md#host-dns-repair-verified-october-1-2026). NetworkManager now uses the two independently tested public DNS servers, while Tailscale keeps split private-name resolution. No networking service or content job was stopped.

## October 2 worker and operator verification

The free-item candidate Python importer uses existing process credentials under `BLOXODES_ENV_PROFILE=process-only`. It never searches workstation env files in that profile. Other runs load the existing target file, strip dotenv quotes, then apply process values; production candidate imports still require `ALLOW_PROD_FREE_ITEMS_IMPORT=true`. The protected VPS overlay now names the tested `codex-admin` operator. No secret values were added or transferred. Environment doctor and contract checks passed.

The Docker worker sets `BLOXODES_ENV_PROFILE=process-only` by default, and the host wrapper explicitly enforces it after loading the worker env file. This also covers Python jobs, which do not use the Node loader's implicit production profile. The wrapper regression fixture rejects real job launches missing that process-only setting.

Managed checklist QA creates a random runner-only `AUTH_SESSION_SECRET` and temporary development users/sessions. These values are not workstation secrets and are not published as artifacts. Cleanup deletes only those accounts and this run's isolated checklist rows. Development QA can access the approved shared R2 media keys but receives no production database target.
