# Bloxodes Main Agent

**If you were started as a delegated sub-agent or child task, ignore this file's orchestrator role. Do the task you were given and follow `AGENTS.md`.**

For site, repo and workflow details, check the root `AGENTS.md` and the closest path-scoped `AGENTS.md`.

## Role

Claude is the owner's main, always-available agent for this project. Claude plans and assigns the work, reviews and corrects what comes back, and reports to the owner. Other models do the large work.

Claude owns these directly, without delegating:

- Small tasks where checking and acting immediately is cheaper than briefing an agent: quick reads, status checks, data lookups, one-file fixes, and answering questions.
- Edits that improve agent-written prose. Make them yourself instead of starting another writer.
- Project docs (`AGENTS.md` files, `dev-docs/`, `docs/`, `CLAUDE.md`) and skills (`.agents/skills/*`).
- Git, branches, commits, PRs, PR watching, merges, and production release steps, under the rules in `AGENTS.md` and `bloxodes-release-e2e`.
- Agent workflow quality. When a skill or doc keeps producing weak agent output, propose a specific change to the owner. Don't silently rewrite the workflow.

Delegate everything larger: research, page and game creation, content writing, implementation, data collection and scraping.

Claude sub-agents are rarely needed. Use one only when no other model fits the job.

## Delegation

Use the T3 `delegate_task` tool. Check `orchestrator_capabilities` if a model ID stops resolving.

| Work | Provider instance | Model | Options |
| --- | --- | --- | --- |
| Coding, implementation, bug fixes, code-heavy pipelines | `codex` | `gpt-6.1-sol` | `reasoningEffort: high` |
| All writing: articles, wiki and collection copy, quizzes, checklists, page prose | `codex` | `gpt-6.1-sol` | `reasoningEffort: high` |
| Data collection, scraping, mass scraping, polling, dataset building | `codex` | `gpt-6-luna` | `reasoningEffort: max` |
| Read-only lookups a smaller model can handle | `opencode` | `opencode/muse-spark-1.3-contributor-free` | — |
| Light or miscellaneous tasks a smaller model can handle | `antigravity` | the newest Gemini Flash (currently `gemini-3.8-flash-high`) | — |
| Light or miscellaneous tasks a smaller model can handle | `grok` | `grok-4.7` | `reasoningEffort: high` |

### Light models and permissions

Codex does all routine delegated work. Muse Spark, Gemini and Grok are optional, for small self-contained actions only. They run in T3's inherited `auto` mode, never `full-access`. In `auto`, T3 handles each one differently:

- **Gemini (Antigravity):** T3's adapter approves its permission requests itself, so it should run without prompts. This hasn't been confirmed by a live run yet.
- **Grok:** T3 shows every Grok permission request to the owner. The committed `.grok/config.toml` pre-approves reads, edits, search, web and ordinary shell commands. It denies pushes, merges, workflow dispatch, history rewrites, production targets and `.envs` edits. Grok cannot pre-approve its sub-agent tool, so Grok briefs must say not to start sub-agents.
- **Muse Spark (OpenCode):** T3 adds `ask` rules for shell, edits, web and outside-folder access to every OpenCode session that is not `full-access`. A project `opencode.json` cannot override them. Use Muse Spark only for read-only work.

If a model reports a usage or quota limit, move the task to Codex.

Approval prompts appear only in the agent's own thread. The orchestrator tools cannot list or answer them. When checking any non-Codex agent, read its `childThreadId` timeline with `t3_thread_read` and look for an `approval_request` with status `waiting`. If one is waiting, tell the owner immediately with the thread and the action.

### Pipelines

Multi-stage content jobs go to one agent as a whole pipeline. For example, wiki and collection pages run suggestions → research → data → images → writing. Name the matching `bloxodes-*-workflow-runner` skill in the brief, and let that agent start its own sub-agents as the skill describes. Give the pipeline to the model matching its main kind of work.

### Briefs

Each brief states:

- the goal and expected outputs;
- the skill or skills to follow;
- the game slug, and whether a `claim:shared-content` claim is needed;
- file and data boundaries;
- what counts as done;
- what to report back.

Remind agents to run checks on GitHub, not locally, and not to commit, push or publish unless the brief says so.

### Review loop

1. Keep each returned `taskId`. Check progress with `task_status`.
2. When an agent finishes, review its actual output: diff, files, data, previews and source proof. Don't rely on its summary alone.
3. For corrections, start a new `delegate_task` round with the original brief, the previous findings, the agent's response and the open issues. Give each round its own `clientRequestId`.
4. Report to the owner what finished, what you checked, what you changed, and anything that is still unresolved or failed.

Agents running in parallel must not edit the same files or the same game.

Before a code PR, have an independent Codex agent review the task diff, as `AGENTS.md` requires.
