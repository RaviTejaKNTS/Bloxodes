# Developer Documentation and Environment Structure Plan

- Status: Implemented; retained as the dated decision record
- Created: 2026-08-11
- Last reviewed: 2026-08-13

## Decision

Bloxodes uses stable files under `dev-docs/` for verified current architecture and operations. Dated files under `docs/` are plans, investigations, audits, reports, and historical evidence that may be outdated or describe work that was never implemented.

Real workstation values live in the ignored `.envs/` tree. Committed variable-name contracts and safe examples live under `env/`. Workstation development uses the managed Supabase development project; the local Supabase CLI database is retired.

## Documentation Rules

1. Code and configuration are the source of truth for implemented behavior.
2. Path-scoped `AGENTS.md` files contain concise working rules.
3. `dev-docs/` contains canonical current-state descriptions with stable filenames and a `Last verified` date.
4. `docs/` contains dated point-in-time material using `docs/YYYY-MM-DD-topic.md` when practical.
5. Update an existing owning `dev-docs/` file in place. Do not create `v2`, `new`, replacement, or dated current-state copies.
6. Plans and unverified intentions remain in dated notes until implementation is checked.

## Environment Rules

- `.envs/targets/managed-dev.env` owns workstation development database and Storage credentials.
- `.envs/targets/production.env` is an explicit operator-only production preview/tool target.
- Production, GitHub Actions, Dokploy, VPS workers, and homelab services receive secrets from their execution platform.
- Process variables win over file-loaded values.
- Production never loads workstation files implicitly.
- Commands capable of production writes require an explicit production profile plus their own allow-production guard.
- Worktrees link the ignored `.envs/` directory without copying secrets into Git.
- Every stored key name must appear in a safe committed example, and secret files must remain private.

## Implemented Layout

```text
dev-docs/                    # stable current-state documentation
docs/YYYY-MM-DD-topic.md     # dated notes, plans, incidents, and audits

env/
  config.json                # profile and overlay contract
  examples/**.env.example    # committed key-name contract

.envs/                       # ignored real values
  targets/{managed-dev,production}.env
  shared/application.env
  integrations/{content,distribution}.env
  pipelines/{articles,indexing}.env
  operations/{analytics,umami}.env
  infrastructure/{cloudflare,dokploy,homelab,northflank,northflank-stats,vps}.env
  secrets/google-indexing-service-account.json
```

The canonical inventory and maintenance procedure are in `dev-docs/README.md` and `dev-docs/environment.md`.

## Deliberate Boundaries

- There is no local Supabase target or local database credential file.
- Managed development and production have separate data, credentials, and Storage origins.
- Production content is promoted through controlled commands rather than bulk database synchronization.
- Machine-consumed datasets belong under `data/` or an explicitly owned pipeline directory, not in rough documentation.
- Backup and recovery are a separate future workstream and are not covered by this decision record.
