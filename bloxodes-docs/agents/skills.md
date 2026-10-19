# Skills

Last verified: 2026-10-19

Skills are step-by-step playbooks agents load for a job. They live in `.agents/skills/`, grouped by kind of work. The flat `bloxodes-*` entries at the top of that folder are relative symlinks to the grouped folders, so skill names stay stable. Claude loads the same skills through `.claude/skills/`.

## The tree

| Folder | Skills |
| --- | --- |
| `shared/voice` | `bloxodes-voice`: the house voice for every public word. Every writing skill builds on it. |
| `shared/routing` | `bloxodes-model-routing`: which stage goes to Luna and which to Haiku 5.5 in T3. |
| `shared/release-and-review` | `bloxodes-release-e2e` (publishing), `bloxodes-article-release-review`, `bloxodes-wiki-release-review`, `bloxodes-simplify-journey-dom` (ad-friendly page layout). |
| `roblox/articles` | Article suggestions, research, images, writing, runner; tech article writing; tier list writing; best-games research and writing; monthly Roblox report. |
| `roblox/wiki-and-collections` | Wiki hub and collection suggestions, research, data, images, writing, refresh and runners. |
| `roblox/codes` | Codes page writing and runner. |
| `roblox/catalog` | Catalog research, writing and runner. |
| `roblox/engagement` | Quizzes, checklists and events (research, writing, runners) and engagement suggestions. |
| `roblox/tools` | Tool suggestions, research, writing and runner. |
| `franchise/planning` | `bloxodes-franchise-plan`: start every new non-Roblox title here. |
| `franchise/wiki-and-collections` | Franchise wiki and collection skills, the same stages as Roblox. |
| `franchise/reference-pages` | Maps, quizzes, catalogs and checklists for non-Roblox games. |
| `franchise/codes`, `franchise/tools` | Non-Roblox codes and tools pages. |

## How runners work

A `*-workflow-runner` skill runs a whole page through its stages, usually suggestions, research, data, images, writing and review. In T3 the main agent runs each stage and hands it to the model that [model routing](../../.agents/skills/shared/routing/bloxodes-model-routing/SKILL.md) assigns. Research and drafts stay in ignored `tmp/` workspaces. Public content goes out only through `bloxodes-release-e2e`.

## Writing skills and docs

Agents copy the tone of what they read, so skills and docs follow the same spirit as our public copy. `.agents/skills/README.md` has the full guide. In short:

- Open with the job and what "done" looks like.
- Use short sections, bullets for rules, numbered lists for steps and tables for comparisons.
- Talk to the agent as "you". Plain words, no hype, no em dashes.
- Say what we want first, then what to avoid. Save "never" for real hard rules.
- One rule, one place. Link to the owner instead of copying a block.
- Keep commands, paths, fields and thresholds exact, in code formatting.
- Writing skills point to `bloxodes-voice`.

When you add a grouped skill, add its flat symlink in `.agents/skills/` and `.claude/skills/`.
