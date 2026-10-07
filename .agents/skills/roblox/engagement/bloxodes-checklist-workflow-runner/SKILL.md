---
name: bloxodes-checklist-workflow-runner
description: Run one approved Bloxodes 100% completion checklist page with parent review, source-backed research, writing and GitHub verification. Record explicit user exceptions to the normal completion scope.
---

# Bloxodes Checklist Workflow Runner

Use one subagent for one checklist. The same subagent researches the player route, waits for parent approval, then writes `final.json`.

Follow `dev-docs/pipelines/content.md#standalone-checklist-scope`. Normally require verified 100% completion for the exact game and edition or mode, with one board per detail page. Record explicit user exceptions for narrower checklists. Defer when full completion requirements cannot be verified. Collectible collection trackers remain separate.

## Subagent Handoff

Every subagent message must set the role and exact skill:

- You are the subagent for one checklist only.
- Do not run `/bloxodes-checklist-workflow-runner`.
- Do not create or call other subagents.
- Start with `/bloxodes-checklist-research`.
- Skill file: `.agents/skills/bloxodes-checklist-research/SKILL.md`.
- Return `brief.md` only and wait for parent approval.

After the parent approves the brief, send the same subagent:

- Continue with `/bloxodes-checklist-writing`.
- Skill file: `.agents/skills/bloxodes-checklist-writing/SKILL.md`.
- Create `final.json` for the approved brief only.

## Workflow

1. Confirm the game, universe ID, edition or mode and full completion scope, or the explicit user exception.
2. Ask the subagent to use `/bloxodes-checklist-research` and return `brief.md`.
3. Review full requirements, thresholds, exclusions, alternative paths, sections within one board, existing coverage, source proof and gaps.
4. Ask the same subagent to use `/bloxodes-checklist-writing` and create `final.json`.
5. Review that tasks are concrete actions players can complete.
6. Keep the reviewed `final.json` in the task workspace. For CI, stage an exact copy with its selected batch under `content/releases/<batch>/`, or use a reviewed immutable bundle accepted by the chosen job. Ignored `tmp/` files are not available on GitHub by themselves.
7. Require a managed-development GitHub job that consumes that exact final, starts a development-backed preview and runs the existing verifier before production publication:

```bash
npm run verify:engagement-finals -- --base-url http://127.0.0.1:3000 --file content/releases/<batch>/final.json
```

The verifier checks copy, imports the reviewed final into its selected database, checks saved rows and fetches the rendered route. Its job must use only managed-development credentials and preserve the importer's production guard. The loopback URL above belongs to the GitHub runner, not the workstation or a public preview.

8. Require desktop/mobile browser QA for the exact `/checklists/<slug>` page, including the single board, ticks and reload. Review the job's screenshots and reports. A generic smoke of unrelated routes is insufficient.
9. Return the exact final path and successful GitHub verification/artifact links. If the job is unavailable, return the authored files and the explicit QA blocker, then stop before production dispatch. Do not report verification as passed.

## Current GitHub QA gap

PR CI currently dry-runs committed content batches against managed development. It does not apply the reviewed final, run `verify:engagement-finals`, or render the selected checklist. The selected-content publication workflow targets production, so its browser artifacts cannot satisfy prepublication QA.

A managed-development job with the input, target, verifier and browser steps above must be implemented and verified before this workflow can complete a new checklist. Keep production publication blocked until that evidence exists. Do not run the missing checks locally or publish to production to obtain it. See `dev-docs/operations/deployment.md` for the current CI contract.

## Parent Checks

- production overlap is checked
- checklist covers source-verified 100% completion, or records an explicit user exception
- one board contains the full required set with achievable alternatives
- parent rows and leaf tasks have consistent section codes
- task titles are concrete actions
- descriptions add useful context only when needed
- public copy reads in the Bloxodes house voice: simple English, calm playful gamer-buddy, light wit on real facts, no hype words or AI filler
- GitHub verifier and browser QA pass
