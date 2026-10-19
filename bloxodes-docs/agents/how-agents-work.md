# How agents work

Last verified: 2026-10-19

Bloxodes is built and run mostly by AI agents in T3 Code. This file explains who does what, how work gets handed out and checked, and the rules every agent follows.

## Roles

| Role | Who | Does |
| --- | --- | --- |
| Main agent | Claude, in the owner's T3 thread | Plans, delegates, reviews, edits public copy, and handles git, PRs and releases. The only agent that edits skills, docs and `AGENTS.md`. Talks to the owner. |
| Code and technical work | Codex `gpt-6.1-sol`, reasoning `high` | Implementation, bug fixes, code-heavy pipelines, technical research, code reviews and audits. |
| Data-heavy content work | Codex `gpt-6-luna`, reasoning `max` | Research, data collection, scraping, images, editorial and fact review. Never writes public copy. |
| Writing | Claude `claude-haiku-5-5`, effort `xhigh` | Writes every public page, plus research review, image review and the one revision round. |
| Light tasks | Gemini Flash (Antigravity), Grok 4.7, Muse Spark (OpenCode, read-only) | Small self-contained actions only. |
| Nightly runs | T3 schedules on the MacBook Pro, parent model Codex `gpt-6.1-sol` high | Roblox wiki and franchise games. See [schedules](../automation/schedules.md). |

The main agent's rules are in the "Main agent" section of root `AGENTS.md` (`CLAUDE.md` is a symlink to it). Every agent follows root `AGENTS.md` and the closest `AGENTS.md` to the files it touches.

## Handing out work

The main agent uses T3's `delegate_task` tool. Check `orchestrator_capabilities` if a model ID stops working.

- **Small things** (quick reads, status checks, one-file fixes, questions): the main agent does them itself.
- **Bigger things** (research, page creation, implementation, data collection): delegate.
- **Content runners** (`bloxodes-*-workflow-runner`): in T3, the main agent runs the stages itself and hands each stage to the model in [model routing](../../.agents/skills/shared/routing/bloxodes-model-routing/SKILL.md). Codex Sol never writes public copy.
- **Other multi-stage jobs:** give the whole pipeline to one agent and name the runner skill. That agent may start its own sub-agents as the skill describes.
- **Parallel agents** must not edit the same files or the same game.
- **Separate checkout:** use `isolation: "worktree"`. It starts from the parent's last commit; uncommitted edits don't carry over.

If a model hits a usage limit, move the task to Codex.

## Writing a brief

Every brief says:

- that the agent is a sub-agent working for the main agent;
- the goal and the expected outputs;
- the skills to follow (writing work always includes `bloxodes-voice`);
- the game slug, and for a Roblox wiki run its Roblox Wiki Queue row;
- which files and data it may touch;
- what "done" means and what to report back.

Remind agents to run checks on GitHub, not locally, and not to commit, push or publish unless the brief says so. Keep content-run prompts short: name the skills and trust them. Don't restate skill rules in the brief.

## Reviewing the result

1. Keep each `taskId`. Check progress with `task_status`. A child that leaves a background command running never finishes; see "When a child looks stuck" in the model-routing skill.
2. Review the real output: diff, files, data, screenshots and sources. Don't trust the summary alone.
3. For fixes, start a new `delegate_task` round with the original brief, the findings, the agent's reply and the open issues. Give each round its own `clientRequestId`.
4. Fix prose yourself. Send work back only when it needs new research, data, images or code.
5. Report to the owner: what finished, what you checked, what you changed, and what is still open.

Before a code PR, an independent Codex agent reviews the diff.

## Content and SEO review

A page that renders without errors isn't ready yet. The main agent reviews every page an agent produces as an editor:

- **Reader value:** does it answer what a gamer searched for, quickly, before any background?
- **Accuracy:** facts match the brief's sources. Nothing speculative, stale or invented.
- **Coverage gaps:** compare with the pages ranking for the target query. Note anything players need that we miss: items, fields, steps, locations, images, FAQs.
- **SEO depth:** too thin to compete, a weak title or meta description, headings that miss search intent, missing internal links to related Bloxodes pages.
- **Voice:** a player who knows the game talking to a friend. Answer-first opening, clean short sentences, real game nouns, a bit of fun, and no templated openings, repeated heading patterns, research wording, hype or filler. Judge against `bloxodes-voice` and its page-type examples, plus the matching `bloxodes-*-writing` skill.

Agent drafts are the starting point. Fix the writing yourself: tighten, restructure, add missing details from the brief's sources, fill small gaps. Send it back only when the gap needs new research, data, images or code. List what you found and what you changed in the review report.

Codex owns the technical side: rendering, data loading, metadata wiring, checks and builds.

## Light models and permissions

- **Gemini (Antigravity):** T3 approves its permission requests, so it should run without prompts.
- **Grok:** T3 shows every permission request to the owner. `.grok/config.toml` pre-approves reads, edits, search, web and ordinary shell commands, and denies pushes, merges, workflow dispatch, history rewrites, production targets and `.envs` edits. Grok can't pre-approve sub-agents, so Grok briefs must say not to start any.
- **Muse Spark (OpenCode):** T3 asks for approval on shell, edits, web and outside-folder access. Use it for read-only work.

Approval prompts only appear in the child's own thread. To check a non-Codex child, read its thread with `t3_thread_read` and look for a waiting `approval_request`. Tell the owner right away if one is waiting.

## Rules every agent follows

- Stay in the worktree T3 assigned. Don't create branches or worktrees for the same task.
- Run checks, tests, builds and browser QA on GitHub, not locally.
- Commit, push or publish only when the task says so. Never push to `production` directly.
- Never print, log or commit secrets. Env files are edited only on the homelab.
- Children don't start sub-agents, commit or publish unless their brief allows it, and they stay in their folder.
- Work on the machine where the task started. Ask the owner before moving work to another machine.
- Notion queue rows are never deleted. Set their status instead. See [Notion queues](../automation/notion-queues.md).

## Docs and skills

Only the main agent (Claude) edits skills, docs and `AGENTS.md`. Other agents, nightly runs included, report the exact change they'd propose and leave the file alone. Delegated audits can gather facts for a doc, but Claude writes it.

The main agent owns `bloxodes-docs/`, the `AGENTS.md` files (`CLAUDE.md` is a symlink to root `AGENTS.md`) and `.agents/skills/`. When a workflow changes, update the owning doc or skill in the same PR. If a skill keeps producing weak output, propose a specific change to the owner instead of rewriting it silently. See [skills](skills.md).
