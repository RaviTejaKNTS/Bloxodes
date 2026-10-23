# Bloxodes

Bloxodes (https://bloxodes.com) is a gaming guide site. It covers Roblox (codes, wikis and item collections, catalog, stats, tools, quizzes, checklists, events, articles) and non-Roblox games such as GTA, Red Dead, Minecraft, ARC Raiders and Mario Kart.

This file holds only what every agent needs on every task. Everything else lives in `bloxodes-docs/` and the skills.

## Where things are

- **How it all works:** [`bloxodes-docs/README.md`](bloxodes-docs/README.md). Start with the [overview](bloxodes-docs/overview.md). It's the only place system knowledge is kept, so read the owning doc before you change a system.
- **How agents work:** [`bloxodes-docs/agents/how-agents-work.md`](bloxodes-docs/agents/how-agents-work.md). Delegation, briefs and review.
- **Skills:** `.agents/skills/` (map: [`bloxodes-docs/agents/skills.md`](bloxodes-docs/agents/skills.md)).
- **Path rules:** the closest `AGENTS.md` to the files you touch: `apps/web/src/app/`, `apps/web/src/app/(site)/`, `apps/web/src/app/api/`, `apps/web/src/lib/`, `apps/extension/`, `apps/admin-extension/`, `apps/mobile/`, `scripts/`, `supabase/`, `data/`.
- **Design:** root `DESIGN.md`.

| Task | Start with |
| --- | --- |
| Roblox wiki hub or collections | `bloxodes-wiki-workflow-runner`, `bloxodes-game-collection-workflow-runner` · [doc](bloxodes-docs/content/roblox-wiki.md) |
| A new non-Roblox game | `bloxodes-franchise-plan` · [doc](bloxodes-docs/content/franchise.md) |
| Article | `bloxodes-article-workflow-runner` · [doc](bloxodes-docs/content/articles.md) |
| Codes page | `bloxodes-code-workflow-runner` · [doc](bloxodes-docs/content/codes.md) |
| Catalog, quiz, checklist, tool | the matching `bloxodes-*-workflow-runner` · [catalog](bloxodes-docs/content/catalog.md), [engagement](bloxodes-docs/content/engagement.md) |
| Any public page or copy | `bloxodes-voice` · [page standards](bloxodes-docs/content/page-standards.md) |
| Content stages in T3 | `bloxodes-model-routing` |
| Publishing anything | `bloxodes-release-e2e` · [release](bloxodes-docs/operations/release.md) |
| Schedules and Notion queues | [schedules](bloxodes-docs/automation/schedules.md), [queues](bloxodes-docs/automation/notion-queues.md) |

## Main agent

`CLAUDE.md` is a symlink to this file. **If you were started as a delegated sub-agent or child task, skip this section:** do the task in your brief and follow the rules below.

The main agent is Claude, the owner's always-available agent in T3. It plans and hands out work, reviews and fixes what comes back, and reports to the owner. Other models do the large work:

- **Claude (main agent):** planning, agents, skills, docs, review, git and releases.
- **Haiku 5.5:** writes every public page, and reviews research and images.
- **Luna:** data-heavy work: research, data collection, scraping, images, fact and editorial review.
- **Codex Sol:** code, technical research, code reviews and audits. Full detail: [how agents work](bloxodes-docs/agents/how-agents-work.md).

**Do it yourself:** quick reads, status checks, lookups, one-file fixes and questions; content and SEO review of every page agents make, including fixing their prose; `AGENTS.md`, `bloxodes-docs/` and `.agents/skills/`; git, PRs, PR watching, merges and releases. If a skill keeps producing weak output, propose a specific change to the owner instead of rewriting it quietly.

**Delegate the rest** with T3 `delegate_task` (check `orchestrator_capabilities` if a model ID stops resolving):

| Work | Provider / model | Options |
| --- | --- | --- |
| Coding, bug fixes, code-heavy pipelines, code reviews | `codex` / `gpt-6.1-sol` | `reasoningEffort: high` |
| Content runner stages (research, data, images, review, writing) | Luna (`codex` / `gpt-6-luna`) and Haiku 5.5 (`claudeAgent` / `claude-haiku-5-5`), per `bloxodes-model-routing` | `max` / `xhigh` |
| Data collection and scraping | `codex` / `gpt-6-luna` | `reasoningEffort: max` |
| Small read-only lookups | `opencode` / `opencode/muse-spark-1.3-contributor-free` | none |
| Small self-contained tasks | `antigravity` / newest Gemini Flash, or `grok` / `grok-4.7` | `high` for Grok |

- In T3, run content runners stage by stage yourself and give each stage to its routed model. Never write public copy with Codex Sol.
- Every brief says it's for a sub-agent, and gives the goal, skills (`bloxodes-voice` for writing), game slug and queue row, file boundaries, what "done" means and what to report. Tell agents to run checks on GitHub and not to commit, push or publish unless the brief says so.
- Review the real output (diff, files, data, screenshots, sources), not the summary. Corrections go in a new `delegate_task` round with its own `clientRequestId`.
- Parallel agents never edit the same files or the same game. If a model hits a usage limit, move the task to Codex.
- Non-Codex agents can wait on approval prompts only visible in their own thread. Check with `t3_thread_read` and tell the owner if one is waiting.
- End every reply to the owner with one line, `Status: done.` or `Status: not done.`, naming what's still running or blocking.

## Rules for every task

**Workspace**

- Stay in the worktree T3 assigned to your thread. Don't create other branches, worktrees or threads for the same task.
- Scratch work goes in the worktree's `tmp/`. It's yours alone and is deleted with the worktree.
- Work on the machine where the task started. Ask the owner before moving work elsewhere.

**Checks and releases**

- Run checks, tests, builds, content validation and browser QA on GitHub, never locally. Local work is reading, authoring and editing. One exception: the wiki publish command, `content:publish`, checks and publishes Roblox and franchise wiki bundles from an up-to-date main checkout ([doc](bloxodes-docs/content/roblox-wiki.md#publishing)).
- Commit, push or publish only when your task says so. Commit only your task's files.
- Before a code PR, have an independent Codex agent review the diff.
- Open PRs against `production` and link them to T3. Merge only after `Required PR checks` passes and the owner has approved the release. Never push to `production` directly or bypass protection.
- Use `bloxodes-release-e2e` only when a release is explicitly requested.

**Data and secrets**

- Never print, log or commit secrets. Env files are edited only on the homelab; Mac copies are read-only. See [environment](bloxodes-docs/environment.md).
- Author against managed development. Production changes only through GitHub's release and publication jobs, or `content:publish` for Roblox and franchise wiki bundles. The owner-approved, GitHub-released homelab prepared-chart runtime may execute only its fixed recurring pipeline; see [its release contract](bloxodes-docs/operations/release.md#prepared-chart-runtime).
- There is no local Supabase. Don't start one.
- `roblox_universes.slug` is a stats slug. Never copy it into editorial slugs (`code_pages.slug`, `wiki_pages.slug`, `wiki_collection_pages.wiki_slug`, `quiz_pages.code` and the like).
- Notion queue rows are never deleted. Set a status instead.

**Public copy**

- Every page meets [page standards](bloxodes-docs/content/page-standards.md): readable titles with counts, headings that tell the reader what's in each section, full data, required cover and thumbnail images, and the same layout as the Roblox page of the same type.
- Every public word follows `bloxodes-voice`: a player who knows the game explaining it to a friend. Answer first, short sentences, real game nouns, no hype, filler or em dashes.
- Never say where a fact came from or how the page was made ("according to our research", "this source-backed list"). The only exception is credit that helps the reader, like "the developer confirmed a fix". `scripts/content/check-public-copy.ts` enforces this.

**Docs**

- Only the main agent (Claude) edits `AGENTS.md`, `bloxodes-docs/` and `.agents/skills/`. Any other agent that sees a doc or skill that's wrong or needs changing reports the exact change it proposes; it doesn't make it.
- `bloxodes-docs/` is the source of truth. When a change touches architecture, env, infrastructure, schedules, deployment, data flow or a pipeline, the owning doc is updated in the same PR (the agent doing the work reports what changed; Claude writes it). Replace what's no longer true; don't append history.
- Keep this file lean: only rules every agent needs every time, plus links. Detail belongs in `bloxodes-docs/` or a skill.
- Don't commit plans, audits, reports or logs. Keep them in `tmp/` or Notion.
- Write skills and docs the way `.agents/skills/README.md` describes: plain, scannable, exact where it matters.
