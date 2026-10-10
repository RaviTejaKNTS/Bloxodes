# Content skills

The real skill folders are grouped by the kind of work they do. The flat `bloxodes-*` entries in this folder are relative symlinks, so existing automation and skill names keep working.

- `shared/voice`: `bloxodes-voice`, the house voice for every public word. Every writing skill builds on it.
- `shared/routing`: `bloxodes-model-routing`, which stages go to Luna and which to Haiku 5.5 when a runner runs in T3 Code.
- `roblox/articles`: articles, pipeline stages and best-games writing.
- `roblox/wiki-and-collections`: Roblox wiki hubs and game collections.
- `roblox/catalog`, `roblox/codes`, `roblox/tools`, `roblox/engagement`: the other Roblox page types.
- `games/wiki-and-collections`: shared non-Roblox wiki hubs and collections.
- `games/wiki-and-collections/gta`: GTA source and mode specialists.
- `games/codes`, `games/tools`, `games/reference-pages`, `games/planning`: other non-Roblox pages and planning.
- `shared/release-and-review`: release and review workflows.

Keep existing skill names. When you add a grouped skill that needs discovery, add a flat relative symlink here (and in `.claude/skills/` if Claude should load it). Research stays in ignored workspaces, and public content lives in its owning tables.

## How we write skills and docs

Agents copy the tone of what they read. If a skill reads like a legal contract, the pages it produces will too. So skills and docs follow the same spirit as our public copy: clear, friendly, direct and easy to scan.

- **Open with the job.** One or two plain sentences on what the skill is for and what "done" looks like.
- **Scannable structure.** Short sections, clear headings, bullets for rules, numbered lists for ordered steps, tables for comparisons.
- **Talk to the agent as "you."** Contractions are fine. Plain words beat formal ones ("use," not "utilize").
- **Say what we want first,** then what to avoid. Save "never" for real hard rules, and give a short reason when it isn't obvious.
- **One rule, one place.** Don't paste the same block into several skills. Link to the owner instead. The voice lives in `bloxodes-voice`, article standards in `bloxodes-article-writing/references/editorial-standard.md`, and repo rules in the closest `AGENTS.md`.
- **Show, don't just tell.** A short before/after example teaches more than a paragraph of rules.
- **Keep the exact stuff exact.** Commands, paths, field names, JSON shapes, thresholds and env names stay precise and in code formatting.
- **No em dashes,** no hype and no filler, same as public copy.
- **Writing-facing skills point to `bloxodes-voice`.** Research skills write briefs in plain player language so the writer starts from good material.
