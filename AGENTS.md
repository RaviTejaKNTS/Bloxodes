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

Follow the agent system in your global instructions (the "Agent system" section, managed in the Cockpit repo). It says which model each role is and how work is handed over, checked and reported. This guide only says which role does which work here. If that section is missing, for example in GitHub Actions, do the work yourself and say so.

The main agent is the `lead`: the agent the owner talks to in T3. Full detail: [how agents work](bloxodes-docs/agents/how-agents-work.md).

| Work | Role |
| --- | --- |
| Planning, agents, skills, docs, content and SEO review, git and releases | `lead` |
| Coding, bug fixes, code-heavy pipelines, technical research | `coder` |
| Code reviews and audits | `reviewer` |
| Every public page; reviews of research, data and images | `writer` |
| Research, data collection, scraping, images, fact and editorial review | `researcher`, always at its higher effort |

**Do it yourself:** quick reads, status checks, lookups, one-file fixes and questions; content and SEO review of every page agents make, including fixing their prose; `AGENTS.md`, `bloxodes-docs/` and `.agents/skills/`; git, PRs, PR watching, merges and releases. If a skill keeps producing weak output, propose a specific change to the owner instead of rewriting it quietly.

- In T3, run content runners stage by stage yourself and give each stage to its role, per `bloxodes-model-routing`. Public copy only ever comes from the `writer`.
- Briefs also name the skills (`bloxodes-voice` for writing), the game slug and queue row. Tell agents to run checks on GitHub.
- Parallel agents never work on the same game.
- Agents that aren't on Codex can wait on approval prompts only visible in their own thread. Check with `t3_thread_read` and tell the owner if one is waiting.

## Rules for every task

**Workspace**

- Stay in the worktree T3 assigned to your thread. Don't create other branches, worktrees or threads for the same task.
- Scratch work goes in the worktree's `tmp/`. It's yours alone and is deleted with the worktree.
- Never delete a worktree. T3's reaper removes it after its thread has been settled for 3 days.
- Work on the machine where the task started. Ask the owner before moving work elsewhere.

**Checks and releases**

- Run checks, tests, builds, content validation and browser QA on GitHub, never locally. Local work is reading, authoring and editing. One exception: the publish command, `content:publish`, checks and publishes Roblox and franchise wiki bundles and article bundles from an up-to-date main checkout ([doc](bloxodes-docs/content/roblox-wiki.md#publishing)).
- Commit, push or publish only when your task says so. Commit only your task's files.
- Before a code PR, have a `reviewer` review the diff.
- Open PRs against `production` and link them to T3. Merge only after `Required PR checks` passes and the owner has approved the release. Never push to `production` directly or bypass protection.
- Use `bloxodes-release-e2e` only when a release is explicitly requested.

**Scripts that run by themselves**

- Before you add or change a timer, cron job, worker, T3 schedule or scheduled workflow, read `workflow/runners.md` in the Cockpit checkout (`~/projects/cockpit` on the Macs, `/srv/data/projects/cockpit` on the homelab) and follow it. It has to survive restarts, crashes and overloads.
- List it in `bloxodes-docs/automation/monitoring.json` and [schedules](bloxodes-docs/automation/schedules.md) in the same change.

**Data and secrets**

- Never print, log or commit secrets. Change env values only in Infisical, with `infisical-env set`; a homelab sync writes them to the env files, the VPS, Dokploy and GitHub. Mac copies are read-only. See [environment](bloxodes-docs/environment.md).
- Author against managed development. Production changes only through GitHub's release and publication jobs, or `content:publish` for Roblox and franchise wiki bundles and article bundles.
- There is no local Supabase. Don't start one.
- `roblox_universes.slug` is a stats slug. Never copy it into editorial slugs (`code_pages.slug`, `wiki_pages.slug`, `wiki_collection_pages.wiki_slug`, `quiz_pages.code` and the like).
- Notion queue rows are never deleted. Set a status instead.

**Public copy**

- Every page meets [page standards](bloxodes-docs/content/page-standards.md): readable titles with counts, headings that tell the reader what's in each section, full data, required cover and thumbnail images, and the same layout as the Roblox page of the same type.
- Every public word follows `bloxodes-voice`: a player who knows the game explaining it to a friend. Answer first, short sentences, real game nouns, no hype, filler or em dashes.
- Never say where a fact came from or how the page was made ("according to our research", "this source-backed list"). The only exception is credit that helps the reader, like "the developer confirmed a fix". `scripts/content/check-public-copy.ts` enforces this.

**Docs**

- Only the main agent edits `AGENTS.md`, `bloxodes-docs/` and `.agents/skills/`. Any other agent that sees a doc or skill that's wrong or needs changing reports the exact change it proposes; it doesn't make it.
- `bloxodes-docs/` is the source of truth. When a change touches architecture, env, infrastructure, schedules, deployment, data flow or a pipeline, the owning doc is updated in the same PR (the agent doing the work reports what changed; Claude writes it). Replace what's no longer true; don't append history.
- Keep this file lean: only rules every agent needs every time, plus links. Detail belongs in `bloxodes-docs/` or a skill.
- Don't commit plans, audits, reports or logs. Keep them in `tmp/` or Notion.
- Write skills and docs the way `.agents/skills/README.md` describes: plain, scannable, exact where it matters.
