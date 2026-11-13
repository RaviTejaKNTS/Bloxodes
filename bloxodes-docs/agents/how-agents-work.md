# How agents work

Last verified: 2026-11-13

Bloxodes is built and run mostly by AI agents in T3 Code. This file explains who does what, how work gets handed out and checked, and the rules every agent follows.

## Roles

The shared agent system decides which model each role is and how work is handed over, checked and reported. It is the "Agent system" section of every agent's global instructions, managed in the Cockpit repo (`workflow/agent-roles.md` there). This file covers only what is particular to Bloxodes.

| Role | Does here |
| --- | --- |
| `lead` | The main agent, in the owner's T3 thread. Plans, delegates, reviews, edits public copy, and handles git, PRs and releases. The only agent that edits skills, docs and `AGENTS.md`. Talks to the owner. |
| `coder` | Implementation, bug fixes, code-heavy pipelines, technical research. Never writes public copy. |
| `reviewer` | Code reviews and audits. |
| `researcher` | Research, data collection, scraping, images, editorial and fact review. Always at its higher effort. Never writes public copy. |
| `writer` | Writes every public page, plus research review, image review and the one revision round. |

Nightly and other scheduled runs are T3 schedules with their own fixed models. See [schedules](../automation/schedules.md).

The main agent's rules are in the "Main agent" section of root `AGENTS.md` (`CLAUDE.md` is a symlink to it). Every agent follows root `AGENTS.md` and the closest `AGENTS.md` to the files it touches.

## Handing out work

- **Content runners** (`bloxodes-*-workflow-runner`): in T3, the main agent runs the stages itself and hands each stage to the role in [model routing](../../.agents/skills/shared/routing/bloxodes-model-routing/SKILL.md).
- **Other multi-stage jobs:** give the whole pipeline to one agent and name the runner skill. Say in the brief that it may start its own sub-agents as the skill describes.
- **Parallel agents** must not work on the same game.
- **Separate checkout:** use `isolation: "worktree"`. It starts from the parent's last commit; uncommitted edits don't carry over.

## Writing a brief

On top of what the agent system asks for, a Bloxodes brief names:

- the skills to follow (writing work always includes `bloxodes-voice`);
- the game slug, and for a Roblox wiki run its Roblox Wiki Queue row.

Remind agents to run checks on GitHub, not locally. Keep content-run prompts short: name the skills and trust them. Don't restate skill rules in the brief.

## Reviewing the result

1. Keep each `taskId`. Check progress with `task_status`. A child that leaves a background command running never finishes; see "When a child looks stuck" in the model-routing skill.
2. Fix prose yourself. Send work back only when it needs new research, data, images or code.
3. Report to the owner: what finished, what you checked, what you changed, and what is still open.

## Content and SEO review

A page that renders without errors isn't ready yet. The main agent reviews every page an agent produces as an editor:

- **Reader value:** does it answer what a gamer searched for, quickly, before any background?
- **Accuracy:** facts match the brief's sources. Nothing speculative, stale or invented.
- **Coverage gaps:** compare with the pages ranking for the target query. Note anything players need that we miss: items, fields, steps, locations, images, FAQs.
- **SEO depth:** too thin to compete, a weak title or meta description, headings that miss search intent, missing internal links to related Bloxodes pages.
- **Voice:** a player who knows the game talking to a friend. Answer-first opening, clean short sentences, real game nouns, a bit of fun, and no templated openings, repeated heading patterns, research wording, hype or filler. Judge against `bloxodes-voice` and its page-type examples, plus the matching `bloxodes-*-writing` skill.

Agent drafts are the starting point. Fix the writing yourself: tighten, restructure, add missing details from the brief's sources, fill small gaps. Send it back only when the gap needs new research, data, images or code. List what you found and what you changed in the review report.

The `coder` owns the technical side: rendering, data loading, metadata wiring, checks and builds.

## Approval prompts

Approval prompts only appear in the child's own thread. To check a child that isn't on Codex, read its thread with `t3_thread_read` and look for a waiting `approval_request`. Tell the owner right away if one is waiting.

## Rules every agent follows

- Stay in the worktree T3 assigned. Don't create branches or worktrees for the same task.
- Run checks, tests, builds and browser QA on GitHub, not locally.
- Commit, push or publish only when the task says so. Never push to `production` directly.
- Never print, log or commit secrets. Change env values only in Infisical; see [environment](../environment.md#change-a-value).
- Children don't start sub-agents, commit or publish unless their brief allows it, and they stay in their folder.
- Work on the machine where the task started. Ask the owner before moving work to another machine.
- Notion queue rows are never deleted. Set their status instead. See [Notion queues](../automation/notion-queues.md).

## Docs and skills

Only the main agent edits skills, docs and `AGENTS.md`. Other agents, nightly runs included, report the exact change they'd propose and leave the file alone. Delegated audits can gather facts for a doc, but the main agent writes it.

The main agent owns `bloxodes-docs/`, the `AGENTS.md` files (`CLAUDE.md` is a symlink to root `AGENTS.md`) and `.agents/skills/`. When a workflow changes, update the owning doc or skill in the same PR. If a skill keeps producing weak output, propose a specific change to the owner instead of rewriting it silently. See [skills](skills.md).
