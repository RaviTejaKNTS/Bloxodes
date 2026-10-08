# Worktree tmp simplification

Status: Open plan, owner decision pending
Date: 2026-10-08

## Target model

- Env files stay in the main checkout at `/srv/data/projects/Bloxodes/.envs/`. Worktrees link to them, so env changes survive after a worktree is closed.
- Work happens in worktrees.
- `tmp/` is local scratch for agents: helper scripts, drafts and working copies. Finished work is published to the database, so `tmp/` can be deleted with the worktree.
- No shared drafts and no content claims.

## Current state that conflicts

- `scripts/dev/setup-worktree.mjs` links six `tmp/` folders back to the main checkout: `content-workspace`, `game-plans`, `game-collection-suggestions`, `game-collection-runs`, `shared-history` and `content-claims`.
- The root `AGENTS.md` describes shared drafts in those folders and requires `npm run claim:shared-content` before editing a game. `CLAUDE.md` asks delegation briefs to state whether a claim is needed.
- `scripts/dev/claim-shared-content.mjs`, with its `package.json` script, implements the claims.
- `scripts/dev/worktree-cleanup-storage.mjs` and `scripts/ci/__tests__/worktree-storage.test.mjs` archive `tmp/` scratch and refuse cleanup while a claim exists.
- About 44 docs and skills under `.agents/`, `dev-docs/`, `agents/` and `scripts/` refer to `tmp/content-workspace` paths.
- Delegated Codex agents cannot write through the `tmp/` symlinks, because the targets are outside their checkout. On 2026-10-08 this stopped two GTA VI build rounds.

## Proposed changes

1. **Worktree setup:** link only `.envs`. Create a plain empty `tmp/`.
2. **Claims:** remove the claim script, its npm script and the claim check in cleanup. Cleanup deletes the worktree and its `tmp/` without archiving. The `CLAUDE.md` rule that parallel agents must not work on the same game stays as the only guard.
3. **Docs and skills:** replace shared-draft and claim wording with: "Scratch goes in your worktree's `tmp/`. It is deleted with the worktree. The database is the record."
4. **Main checkout `tmp/` (about 5.3 GB on 2026-10-08):** delete it after current work is published. The largest folders are `content-workspace` (2.1 GB), `release-audit` (1.1 GB) and `gta-production-build-output-2026-09-26` (1.1 GB).

## Open decision

`tmp/content-workspace` holds per-page source ledgers, which record where each fact came from. The database stores the published pages, not these ledgers. Decide whether to:

- keep only the small text files (briefs, datasets, source ledgers), for example in git or the database, or
- delete everything.

The GTA VI post-launch rebuild is the main case where the ledgers might be reused.

## Order

Finish the GTA VI pre-launch run, then make changes 1–3 in one PR, then do the cleanup in step 4.

## Related fix already made

On 2026-10-08 the four `WIKI_R2_*` media keys were copied from `/etc/bloxodes/wiki-automation.env` into `.envs/integrations/content.env`, so the `managed-dev` profile can upload collection media. Update `dev-docs/environment.md` to match when this plan is carried out.
