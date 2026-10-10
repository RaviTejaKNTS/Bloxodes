---
name: bloxodes-checklist-workflow-runner
description: Run one approved Bloxodes 100% completion checklist page with parent review, source-backed research, writing and GitHub verification. In T3 Code each stage goes to its assigned model (Luna for research and a fact check of every task; Haiku 5.5 for research review and writing). Record explicit user exceptions to the normal completion scope.
---

# Bloxodes Checklist Workflow Runner

You run one checklist from research to GitHub-verified QA. One subagent does the work: it researches the player route, waits for your approval of the brief, then writes `final.json`. You review both stages.

**In T3 Code** (you have the `delegate_task` tool and the owner runs checklists here), follow the "Checklists" stage table in `.agents/skills/bloxodes-model-routing/SKILL.md` instead of the subagent handoff below. Luna researches and fact-checks every task and threshold in the editorial review. Haiku 5.5 reviews the research and writes. Outside T3 Code, the flow below applies.

## Scope

Follow `dev-docs/pipelines/content.md#standalone-checklist-scope`.

- Normally, keep one standalone, verified 100% completion checklist page per game. State the supported edition or mode, and put sections inside one board.
- Check published pages and drafts, and reuse the game's existing checklist.
- Record explicit user exceptions for additional pages or narrower checklists.
- Defer when the full completion requirements can't be verified.
- Collectible collection trackers stay separate.

## Subagent handoff

Every message to the subagent sets its role and the exact skill.

First message:

- You are the subagent for one checklist only.
- Do not run `/bloxodes-checklist-workflow-runner`.
- Do not create or call other subagents.
- Start with `/bloxodes-checklist-research`.
- Skill file: `.agents/skills/bloxodes-checklist-research/SKILL.md`.
- Return `brief.md` only and wait for parent approval.

After you approve the brief, send the same subagent:

- Continue with `/bloxodes-checklist-writing`.
- Skill file: `.agents/skills/bloxodes-checklist-writing/SKILL.md`.
- Read the voice guide first: `.agents/skills/bloxodes-voice/SKILL.md`.
- Create `final.json` for the approved brief only.

## Workflow

1. Confirm the game, universe ID, edition or mode, and the full completion scope or the explicit user exception.
2. Ask the subagent to use `/bloxodes-checklist-research` and return `brief.md`.
3. Review the brief: full requirements, thresholds, exclusions, alternative paths, sections within one board, existing coverage, source proof and gaps.
   - Interchangeable paths must use one explicit `A or B` leaf. Separate mutually exclusive leaves and optional-leaf flags can't produce achievable progress.
   - Defer unsupported branching requirements.
4. Ask the same subagent to use `/bloxodes-checklist-writing` and create `final.json`.
5. Review that tasks are concrete actions players can complete, and check the copy (see Parent checks).
6. Keep the reviewed `final.json` in the task workspace. For CI, stage an exact copy with its selected batch under `content/releases/<batch>/`, or use a reviewed immutable bundle accepted by the chosen job. Ignored `tmp/` files aren't available on GitHub by themselves.
7. Run `Managed content QA` on GitHub with the exact committed batch or immutable private bundle. It stages an isolated development board, compares the complete normalized page and task contents, and repeats that comparison after desktop and mobile browser checks.
8. Review the job's screenshots and reports for board coverage, ticking, reload, unticking and account saving. The receipt must match the selected input bytes and the reviewed source SHA. Count-only or unrelated route checks don't pass this gate.
9. Return the exact final path and the successful GitHub artifact links.
   - Production publication needs explicit authorization, and it goes through the same development QA gate before its first production write.
   - If QA fails, return the files and the actual failure.
   - Don't run checks locally, and don't call a dispatch published.

For dispatch inputs, isolation, cleanup and receipt ownership, see `dev-docs/operations/deployment.md#managed-development-content-qa`.

## Parent checks

Scope and structure:

- Production overlap is checked.
- The checklist covers source-verified 100% completion, or records an explicit user exception.
- The game has one standalone checklist page, or an explicit user exception authorizes more.
- One board holds the full required set, with interchangeable alternatives as one explicit `A or B` leaf.
- Parent rows and leaf tasks have consistent section codes.

Copy, checked against `.agents/skills/bloxodes-voice/SKILL.md`:

- Task titles are concrete actions, short, plain and exact. No jokes in tasks.
- Descriptions add useful context only when needed.
- The intro and description open with what the board tracks, in a player's voice. No template openings, research voice, hype or AI filler.
- No fact repeated between the description and the tasks.
- Every task and threshold matches the approved brief.

Verification:

- GitHub exact-row comparison and browser QA pass for the reviewed final.
