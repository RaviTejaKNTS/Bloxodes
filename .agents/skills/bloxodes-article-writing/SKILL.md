---
name: bloxodes-article-writing
description: Write or rewrite researched evergreen Bloxodes articles backed by the articles table. Use for focused Roblox how-tos, specific item/quest/mode/map/mechanic guides, narrow comparisons, article SEO, content_md, tags, sources, and article output that must avoid overlap with codes, events, wiki hubs, and catalog pages.
---

# Bloxodes Article Writing

## Start Here

Read:

- `agents/content/writing-core.md`
- `agents/content/research-policy.md`
- `agents/content/page-types/articles.md`
- `agents/content/final-edit.md`

If these files have not been read in the current task, read them before writing.

If the target is a `/codes/<slug>` page backed by the `games` table, stop and use `bloxodes-code-writing` instead. Code pages are source-driven and must not manually include active code rows, expired code rows, code dates, or current-code reward mappings in article fields or metadata.

Create or update the workspace before writing:

```text
tmp/content-workspace/<game-or-topic-slug>/articles/<article-slug>/
  todo.md
  research-notes.md
  final.json
```

Copy `agents/content/todo-templates/article.md` into the folder as `todo.md` and update it as work progresses.

## What This Skill Is For

Use this for researched evergreen articles: focused how-tos, specific item or quest guides, mode/map/mechanic explainers, narrow comparisons, and durable troubleshooting that does not belong on a codes page.

Articles can be more narrative than catalog or wiki pages, but they still need to stay useful. The reader should understand the topic better after each section, not feel like they are being carried through SEO filler.

Do not edit shared article routes, templates, page chrome, cards, CTAs, sidebars, ads, sitemap/feed code, or unrelated copy while using this skill unless the user explicitly asks for implementation work. Article work owns the `articles` row, approved cover asset, source list, and import/verification path. If preview exposes a shared UI issue, report it separately and stop.

Hard pass on overlap:

- no current codes, code troubleshooting, or code reward articles
- no event articles, event timelines, or current event reward guides
- no broad "beginner guide"
- no broad "maps explained", "skins explained", or collection overview topics that should be catalog/wiki copy
- no current update/news article; permanent mechanics should be framed as evergreen how-to or system guides

Use these inputs:

- `research-notes.md`
- article type
- exact niche question or angle
- overlap check against codes, events, wiki, catalog, checklist, quiz, and tool pages
- target game or universe if relevant
- related Bloxodes pages
- source links for unstable claims

## Output Shape

Return:

```json
{
  "title": "",
  "slug": "",
  "meta_description": "",
  "content_md": "",
  "cover_image": null,
  "author_id": null,
  "universe_id": null,
  "tags": [],
  "sources": []
}
```

For game-linked articles, generate the article slug from the article topic/title. Do not copy `roblox_universes.slug`; universe slugs are stats-only identifiers and may include universe IDs.

Use Markdown in `content_md`.
Do not include `seo_title` for articles unless the `articles` schema changes.

## Article Metadata And Feature Images

Use the same publishing shape as `scripts/articles/generate-articles.ts` and `scripts/content/import-content-final.ts`.

Article titles should be SEO-friendly without feeling like database labels. Keep the primary keyword near the front, then add a short human outcome when it helps the card feel worth opening, such as `Slime RNG Rebirth Guide: When Resetting Is Worth It` or `Slime RNG Items Guide: What to Use, Save, and Spend First`. Avoid clickbait, fake urgency, or subtitles so long that the card becomes hard to scan.

Every article needs an author. If the workflow is importing reviewed `final.json` and no explicit author is provided, the importer must pick one author randomly from `authors`, matching the generator behavior. Do not leave `author_id` null for a published article.

Every game article needs a feature image. Use the linked Roblox universe thumbnail as the source image, then create an edited 1200x675 WebP cover like the generator: crop to 16:9, apply a dark overlay, and place a short centered title such as `Rebirth Guide` or `Power Fruits Guide`. Do not use a raw Roblox thumbnail as the article cover unless cover generation is blocked and the gap is recorded.

The feature image should also appear inside `content_md` before the first H2, matching `generate-articles.ts`. After import, verify both `/articles` and `/articles/<slug>` show the same author and edited cover.

## How To Write The Article

Verify unstable facts before writing. If the article covers an item stat, formula, unlock condition, durable mechanic, price, route, or live game state, check current sources and record them in `research-notes.md`. If the topic depends on current codes or events, stop and use the proper automation-owned page workflow instead of writing an article.

Research the exact question or angle before choosing structure. A how-to, a narrow comparison, and a troubleshooting piece should not all share the same rhythm. If the topic cannot be stated as one specific player question, it is probably not ready.

Start with the useful issue: the specific mechanic, item, quest, map, mode, decision, or problem the reader came to understand. Avoid broad Roblox setup and do not repeat the title in different words.

Use headings that tell the reader what the section explains. Put context before tables, lists, or steps. Use numbered lists for processes, bullets for scan-heavy details, and paragraphs when the reader needs explanation or judgment.

A light player perspective is welcome when the angle supports it, especially in guides or opinion-aware explainers. Keep it grounded. Do not invent authority, community consensus, or personal experience the research does not support.

Link only useful sources and related Bloxodes pages. Public article copy should explain the facts directly; it should not talk about how research was gathered.

## Finish

Run `bloxodes-final-edit` before saving `final.json`. Do not return preliminary copy for later cleanup, and do not create separate article or SEO draft files.
