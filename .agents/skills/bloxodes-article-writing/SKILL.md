---
name: bloxodes-article-writing
description: Write one Bloxodes article final.json from an approved brief.md. Use after bloxodes-article-research and parent approval for Roblox how-tos, focused guides, comparisons, news tests approved for /articles, content_md, tags, sources, and article metadata.
---

# Bloxodes Article Writing

Read `agents/content-writing/agents.md` first.

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

- Article need to be written in simple language and clean flow for people to follow along the article. You are writing for roblox players who need help or want to know info, you need to provide that cleanly.
- Open with the exact thing that changed, the action, or the problem. You need to directly get into the topic without any suspense or mood-setting lines.
- Do not use vague lines like `this is a big change`, `this matters`, or `the shift is bigger than it looks`.
- Most importantly, every sentence should add value to the user, in easy to understand pace and style.
- If the article can be done in less than 300 words, go for it. There are no hard rules on word count. But article needs depth, again opt for it. Think of it like how can I tell more clearly without fluffing it up
- The outline already provided, you are flexible enough to make needed changes if that helps flow. But use fewer headings that help user to quickly scan the entire article and structure easily
- Headings should be sentence like and should give away the needed core info. Keep the sentence reasonably small for people to read clearly.
- The body below the headings should not repeat the same info, instead they need to build on it and add more depth to it.
- Use tables and lists when useful to present the information cleanly.
- Use numbered lists when providing step by step instructions.
- Do not include two structured elements like tables and lists inside same section. keep things simple.
- Prefer para and always communicate with the user. tables, lists, etc should be useful only for info that are like core of the topic and makes sense to include in that structure. Else clear communication with simple english should be prioritized.
- For game-specific articles, include the game name in the title and slug so people know which game the article is about. Use `Roblox` wording when it helps search or clarity.
- If you find any missing gaps in info, research the needed part with a fan out query rather than leaving the gap in our article.
- Add related internal links in a clean flow. No specific mentions like "read this". Just casually include the internal links of this game or needed bloxodes pages.
- Do not mention research, sources checked, competitors, databases, or internal notes in public article copy.
- Do not use self-referential wording like `this article`, `this guide`, `this page`, `this catalog`, `this dataset`, or `this database`. Just explain the game topic directly.

Once done, read the article again as a normal reader. Cut any sentence that does not add value, make sure the article solved the reader's requirement.


## Writing and Field Jobs

Write `final.json` only.

- `title`: State the exact reader question, action, story, or guide promise in human search language. Include the game name for game-specific articles.
- `slug`: Use a short stable editorial slug for the article topic. Include the game name for game-specific articles.
- `meta_description`: Summarize the answer or reader outcome in one specific search snippet.
- `content_md`: Answer the title fully. Use headings only for real sections and keep source-gathering language out of public copy.
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
