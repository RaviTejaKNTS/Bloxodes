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
6. Submit the reviewed inputs through the assigned task PR and selected CI batch described in `dev-docs/operations/deployment.md`. GitHub owns managed-development validation and browser QA.
7. Run the verifier on GitHub against its managed-development preview:

```bash
npm run verify:engagement-finals -- --base-url <ci-preview-base-url> --file <final.json>
```

8. Review the GitHub browser screenshots and reports for the exact `/checklists/<slug>` page and its single board.
9. Return paths, GitHub verification/artifact links, any available reviewed preview URL and remaining gaps.

## Parent Checks

- production overlap is checked
- checklist covers source-verified 100% completion, or records an explicit user exception
- one board contains the full required set with achievable alternatives
- parent rows and leaf tasks have consistent section codes
- task titles are concrete actions
- descriptions add useful context only when needed
- public copy reads in the Bloxodes house voice: simple English, calm playful gamer-buddy, light wit on real facts, no hype words or AI filler
- GitHub verifier and browser QA pass
