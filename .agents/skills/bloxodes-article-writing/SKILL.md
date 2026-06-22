---
name: bloxodes-article-writing
description: Write one Bloxodes article final.json from an approved brief.md. Use after bloxodes-article-research and parent approval for Roblox how-tos, focused guides, comparisons, news tests approved for /articles, content_md, faq_json, tags, sources, and article metadata.
---

# Bloxodes Article Writing

Use this after `brief.md` is approved. Do not use this for first-pass research; use `bloxodes-article-research`.

Use this for one article only. Do not handle batches here; use `bloxodes-article-workflow-runner`.

## Workspace

```text
tmp/content-workspace/<game-or-topic-slug>/articles/<article-slug>/
  brief.md
  final.json
```

## Before Writing

Read the approved `brief.md`.

If the brief is missing, weak, unapproved, or has unresolved source gaps, stop and ask for the article research step to be fixed first.

## Writing Rules

**Voice and opening**
- Write in simple, clean language for Roblox players who want help or info fast.
- Open with the actual change, action, or problem. No mood-setting, no suspense, no warm-up lines.
- Ban vague filler like "this is a big change," "this matters," or "the shift is bigger than it looks."

**Length and density**
- Every sentence must add value. No padding, no repetition, ever.
- If 300 words covers it fully, stop at 300. There's no minimum or maximum — the only test is whether more words add real depth.
- Never restate something already said elsewhere in the article, even in different phrasing.
- However, do not skip on any info. Do not asssume people already know something, make it clear for everyone to understand.
- We may not need an what it is headings, but definitely need to cover all such info in the article. We need to make a detailed article that can rank better than all competitors. If the article is missing any info, run a fan-out research query and fill it — never leave a gap.

**Structure**
- Follow the provided outline, but adjust it if a different flow serves the reader better.
- Use fewer headings so the article stays scannable. If 2 headings can help the user, we can just use 2.
- However keep each section also small, do not cramp a lot of info into one section making it hard to read.
- Headings should read like sentences and reveal the core info, not tease it. Keep them short.
- Each section must build on the last, not re-explain it.
- One structured element per section, never a table and a list together. Keep it simple.
- Use tables and lists only for core, structured info (stats, steps, comparisons). Otherwise default to plain prose.
- Use numbered lists for step-by-step instructions.

**Game-specific pages**
- Include the game name in the title and slug. Use "Roblox" when it aids search or clarity.

**Gaps and links**
- If info is missing, run a fan-out research query and fill it — never leave a gap.
- Weave in internal links naturally, mid-sentence, as part of the flow. No "read this" or similar call-outs.

**What never appears in copy**
- No mentions of research, sources, competitors, databases, or internal notes.
- No self-referential words: "this article," "this guide," "this page," "this catalog," "this dataset," "this database." Just talk about the game.

**Final pass**
- Re-read as a reader, not the writer. Cut anything that doesn't earn its place. Confirm the article actually solves what the reader came for.

## Writing and Field Jobs

Write `final.json` only.

- `title`: State the exact reader question, action, story, or guide promise in human search language. Include the game name for game-specific articles.
- `slug`: Use a short stable editorial slug for the article topic. Include the game name for game-specific articles.
- `meta_description`: Summarize the answer or reader outcome in one specific search snippet.
- `content_md`: Answer the title fully. Use headings only for real sections and keep source-gathering language out of public copy.
- `faq_json`: Add 2-4 useful questions only when they cover follow-up points not already answered in the article. Keep answers short, clear, and source-backed. Use `[]` if FAQs would repeat the body.
- `cover_image`: final image URL or path.
- `author_id`: Set when known, or let the import path assign it if that is the project flow.
- `universe_id`: Set only when the article belongs to one Roblox game.
- `tags`: Use specific reusable labels, not loose keyword stuffing.
- `sources`: Keep the URLs that support important facts. Do not pad with weak repeats.

Parse-check JSON before returning.

## Output Shape

```json
{
  "title": "",
  "slug": "",
  "meta_description": "",
  "content_md": "",
  "faq_json": [],
  "cover_image": null,
  "author_id": null,
  "universe_id": null,
  "tags": [],
  "sources": [],
  "is_published": true
}
```

Do not include `seo_title`; the articles table does not use it.

For game-linked articles, use the article topic and game name for the slug. Do not use `roblox_universes.slug`.

If the article topic is about some specific roblox game, then you must include universe id.

Before returning final.json, run or mentally apply the public-copy rules: avoid self-referential phrases like "this article/guide/page/catalog", avoid "row-by-row/full reference" framing, avoid "not just" contrast filler, and write the copy as direct player help.
