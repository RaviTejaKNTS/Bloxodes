# Bloxodes docs

The one place for how Bloxodes works today: infrastructure, content pipelines and agents. If something here disagrees with running code or a live service, the live system wins. Fix the doc.

## How these docs work

- **One topic, one file.** Each file describes the current setup for its topic. There are no dated copies, plans, logs or "v2" files.
- **Replace, don't append.** When a setup changes, rewrite the section that covers it. Delete what is no longer true. Don't add a dated "update" section below the old text.
- **Current state only.** No rollout receipts, migration diaries or "as of" history. Git history keeps the past.
- **Known issues are current too.** If something is broken right now, say so in the owning file's "Known issues" section, and remove it once it's fixed.
- **Last verified.** Each file has a `Last verified` date near the top. Bump it only after you've checked the code or the live service.
- **New file only for a new topic.** Add it to the index below in the same change.

Plans, audits and one-off notes don't belong in the repo. Keep them in your task's `tmp/` or in Notion.

## How this fits with AGENTS.md and skills

- **`bloxodes-docs/`** is the one place system knowledge lives. It's the only thing that has to be kept current when the system changes.
- **Root `AGENTS.md`** stays lean: what Bloxodes is, the rules every agent checks on every task, and links here. Path `AGENTS.md` files hold rules for working in that folder.
- **Skills** (`.agents/skills/`) are step-by-step playbooks for a job. They link here for system facts instead of repeating them.

If you find the same fact in two places, keep it in its owner and replace the copy with a link.

## Index

**Start here**

- [Overview](overview.md): what Bloxodes is, the machines, and which machine runs what.
- [Environment](environment.md): env files, profiles, overlays and where secrets live.

**Agents**

- [How agents work](agents/how-agents-work.md): roles, delegation, briefs and the review loop.
- [Skills](agents/skills.md): the skill tree and how to write skills.

**Automation**

- [Schedules](automation/schedules.md): every recurring job on every machine, in one list.
- [`monitoring.json`](automation/monitoring.json): the name and description of every job on the Automation Monitor dashboard.
- [Notion queues](automation/notion-queues.md): Roblox Wiki Queue and Other Games Queue.

**Content pipelines**

- [Page standards](content/page-standards.md): titles, headings, depth, images and layout every page must meet.
- [Articles](content/articles.md)
- [Codes](content/codes.md)
- [Roblox wiki and collections](content/roblox-wiki.md)
- [Franchise games](content/franchise.md): GTA, Red Dead, Minecraft, ARC Raiders, Mario Kart and other non-Roblox titles.
- [Catalog](content/catalog.md)
- [Quizzes, checklists, events and tools](content/engagement.md)
- [Data refreshes](content/data-refreshes.md): puzzles, music, decals, Marketplace items and item stats.
- [Stats](content/stats.md): universe stats and monthly reports.
- [Stats metrics](content/stats-metrics.md): what each stats metric means and how charts bucket it.

**Infrastructure**

- [Machines](infrastructure/machines.md): homelab, MacBook Pro, MacBook Air and SSH access.
- [VPS](infrastructure/vps.md): Hostinger VPS, Dokploy, self-hosted Supabase and the stats worker.
- [Cloudflare and media](infrastructure/cloudflare.md)
- [Docker](infrastructure/docker.md)
- [Database](data/supabase.md): production and managed development, schema changes and table families.

**Operations**

- [Release](operations/release.md): PRs, checks, deploys, schema and content publication.
- [Cache](operations/cache.md): revalidation and cache warming.
- [SEO, indexing and analytics](operations/seo-indexing.md)
- [Monitoring](operations/monitoring.md): health checks and known failures.
- [Ads](operations/ads.md): Mediavine setup and page layout rules.

**Design**

- [Feature thumbnails](design/feature-thumbnails.md): the single-object thumbnail system for small feature images.
- Site UI and layout rules live in root `DESIGN.md`.
