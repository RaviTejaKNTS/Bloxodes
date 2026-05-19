---
name: bloxodes-article-writing
description: Write or rewrite researched Bloxodes articles backed by the articles table. Use for Roblox game guides, event guides, update explainers, system explainers, how-tos, troubleshooting, comparisons, lists, article SEO, content_md, tags, sources, and article output that needs current research and player-first structure.
---

# Bloxodes Article Writing

## Start Here

Read:

- `agents/content/writing-core.md`
- `agents/content/research-policy.md`
- `agents/content/page-types/articles.md`
- `agents/content/final-edit.md`

If these files have not been read in the current task, read them before writing.

## What This Skill Is For

Use this for researched articles: guides, update explainers, event guides, system explainers, how-tos, troubleshooting, comparisons, lists, and Roblox support-style pieces.

Articles can be more narrative than catalog or wiki pages, but they still need to stay useful. The reader should understand the topic better after each section, not feel like they are being carried through SEO filler.

Use these inputs:

- `research-notes.md`
- article type
- exact niche question or angle
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
  "tags": [],
  "sources": []
}
```

Use Markdown in `content_md`.
Do not include `seo_title` for articles unless the `articles` schema changes.

## How To Write The Article

Verify unstable facts before writing. If the article covers an event, update, code reward, date, item stat, formula, or live game state, check current sources and record them in `research-notes.md`.

Research the exact question or angle before choosing structure. A how-to, a comparison, a troubleshooting piece, and an update explainer should not all share the same rhythm.

Start with the useful issue: the current update, the mechanic, the decision, the problem, or the reward the reader came to understand. Avoid broad Roblox setup and do not repeat the title in different words.

Use headings that tell the reader what the section explains. Put context before tables, lists, or steps. Use numbered lists for processes, bullets for scan-heavy details, and paragraphs when the reader needs explanation or judgment.

A light player perspective is welcome when the angle supports it, especially in guides or opinion-aware explainers. Keep it grounded. Do not invent authority, community consensus, or personal experience the research does not support.

Link only useful sources and related Bloxodes pages. Public article copy should explain the facts directly; it should not talk about how research was gathered.

## Finish

Run `bloxodes-final-edit` before saving `final.json`. Do not return preliminary copy for later cleanup, and do not create separate article or SEO draft files.
