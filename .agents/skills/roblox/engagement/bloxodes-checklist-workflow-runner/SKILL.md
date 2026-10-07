---
name: bloxodes-checklist-workflow-runner
description: Run one approved Bloxodes 100% completion checklist page with parent review, source-backed research, writing and GitHub verification. Record explicit user exceptions to the normal completion scope.
---

# Bloxodes Checklist Workflow Runner

Use one subagent for one checklist. The same subagent researches the player route, waits for parent approval, then writes `final.json`.

Follow `dev-docs/pipelines/content.md#standalone-checklist-scope`. Normally maintain one standalone verified 100% completion checklist page per game, with the supported edition or mode stated and sections inside one board. Check published pages and drafts and reuse the game's existing checklist. Record explicit user exceptions for additional pages or narrower checklists. Defer when full completion requirements cannot be verified. Collectible collection trackers remain separate.

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
3. Review full requirements, thresholds, exclusions, alternative paths, sections within one board, existing coverage, source proof and gaps. Interchangeable paths must use one explicit `A or B` leaf; separate mutually exclusive leaves and optional-leaf flags cannot produce achievable progress. Defer unsupported branching requirements.
4. Ask the same subagent to use `/bloxodes-checklist-writing` and create `final.json`.
5. Review that tasks are concrete actions players can complete.
6. Keep the reviewed `final.json` in the task workspace. For CI, stage an exact copy with its selected batch under `content/releases/<batch>/`, or use a reviewed immutable bundle accepted by the chosen job. Ignored `tmp/` files are not available on GitHub by themselves.
7. Use `Managed content QA` on GitHub with the exact committed batch or immutable private bundle. It stages an isolated development board, compares complete normalized page/task contents and repeats comparison after desktop/mobile browser checks.
8. Review the job's screenshots and reports for board coverage, ticking, reload, unticking and account saving. The receipt must match the selected input bytes and reviewed source SHA. Count-only or unrelated route checks do not pass this gate.
9. Return the exact final path and successful GitHub artifact links. Production publication requires explicit authorization and uses the same development QA gate before its first production write. If QA fails, return the files and actual failure. Do not run checks locally or call a dispatch published.

See `dev-docs/operations/deployment.md#managed-development-content-qa` for dispatch inputs, isolation, cleanup and receipt ownership.

## Parent Checks

- production overlap is checked
- checklist covers source-verified 100% completion, or records an explicit user exception
- the game has one standalone checklist page, or an explicit user exception authorizes additional pages
- one board contains the full required set, with interchangeable alternatives represented as one explicit `A or B` leaf
- parent rows and leaf tasks have consistent section codes
- task titles are concrete actions
- descriptions add useful context only when needed
- public copy reads in the Bloxodes house voice: simple English, calm playful gamer-buddy, light wit on real facts, no hype words or AI filler
- GitHub exact-row comparison and browser QA pass for the reviewed final
