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

**Voice & tone (Bloxodes house voice)**
- Write like a player who knows the game well, telling a friend how it works. Calm, warm, and a little playful — never formal, corporate, or hyped.
- Simple English first. Short sentences, everyday words a younger player gets instantly. Explain any game term in plain words right where it appears.
- Playful, not loud. Drop in a light, dry touch of wit — roughly one per short paragraph — and always wrap it around a real fact, like "protection that overstays its welcome." The fact leads; the wit rides along. Never force a joke, stack puns, or let a quip hide the info.
- Gamer-buddy warmth. Talk to the player as "you," use real in-game nouns, and sound like someone who actually plays — not a manual.
- Spark from rhythm, not adjectives. Energy comes from concrete detail, a strong first line, and varied sentence length — not from words like *ultimate, insane, amazing, epic, must-have, game-changer*. Ban those.
- Open on the real thing — the change, action, problem, or answer. No mood-setting, no suspense, no warm-up lines, no "Welcome to" or "In this game".
- Read the room. Keep the wit lighter, or drop it, when the reader is stressed — error fixes, "won't open", crashes, anything troubleshooting. Help first.
- Keep functional slots clean. Steps, table cells, and labels stay plain and direct. Let the playful voice live in intros, explanations, and blurbs.
- No filler or AI tics. Cut "Additionally", "Furthermore", "It's important to note", and "not just… but". Every sentence earns its place. Also ban vague filler like "this is a big change" or "this matters".

**Length and density**
- Every sentence must add value. No padding, no repetition, ever.
- If 300 words covers it fully, stop at 300. There's no minimum or maximum — the only test is whether more words add real depth.
- Never restate something already said elsewhere in the article, even in different phrasing.
- However, do not skip on any info. Do not asssume people already know something, make it clear for everyone to understand.
- We may not need an what it is headings, but definitely need to cover all such info in the article. We need to make a detailed article that can rank better than all competitors. If the article is missing any info, run a fan-out research query and fill it — never leave a gap.

**Readability and formatting**
- This sits on top of the value rule: every sentence must add value, and every sentence must also be easy to read.
- One idea per paragraph. Each paragraph covers a single point clearly, then stops. Never write a wall of text.
- Keep paragraphs short: aim for 1-3 short sentences. If a paragraph is growing past that, split it into two.
- Write short, plain sentences. Prefer one simple sentence over one long sentence with commas and "and"s. If a sentence runs long, break it in two.
- Use everyday words a younger Roblox player understands. Explain any necessary technical term in plain language right where it appears.
- Keep list and step items short — one action or fact per item, ideally one line. Never cram a paragraph into a single bullet or numbered step.
- If a step needs a little detail, use a short bolded lead (the action) followed by one short sentence of explanation, not a dense block.
- Put each distinct action on its own step. Do not chain several actions into one point.
- Leave white space between ideas so the page is easy to scan, not a dense block of text.

**Structure**
- Follow the provided outline, but adjust it if a different flow serves the reader better.
- Use fewer headings so the article stays scannable. If 2 headings can help the user, we can just use 2.
- However keep each section also small, do not cramp a lot of info into one section making it hard to read.
- Headings should read like sentences and reveal the core info, not tease it. Keep them short.
- Each section must build on the last, not re-explain it.
- One structured element per section, never a table and a list together. Keep it simple.
- Use tables and lists only for core, structured info (stats, steps, comparisons). Otherwise default to plain prose.
- Use numbered lists for step-by-step instructions.

**How-to-fix and troubleshooting articles**
- Give each fix its own `###` (H3) heading, grouped under one `##` (H2) like "How to fix it". This beats a long numbered list with nested sub-bullets, which gets hard to scan.
- The H3 is a short action ("Restart your device", "Update your graphics drivers"). Under it, write 1-3 short sentences, or a short numbered list only if the fix has ordered steps.
- Do not stack deep bullet hierarchies (bullets inside bullets inside steps). Keep each fix flat and simple.
- Order fixes easiest-first.
- Never repeat the same fix, cause, or explanation across sections. Each H3 covers one distinct thing. If two fixes overlap, merge them.
- Keep one short intro before the fixes, and an optional short closing section (e.g. when the problem is on Roblox's side and waiting is the answer). Do not pad with a separate "what is this error" section unless it adds real value.

**Accuracy (never ship wrong info)**
- Verify every platform claim before writing. Do real research; do not guess menu paths, toggles, limits, or behavior. If a label or path is uncertain, keep the wording generic instead of inventing specifics.
- Roblox experiences cannot be played in a web browser. The in-browser player was discontinued; roblox.com only launches the installed app. Never tell readers to "play in the browser" or "try the browser instead of the app" as a fix.
- Do not suggest actions that are not actually possible (e.g. disabling a system that cannot be disabled). Do not claim a fix works for a platform you have not verified it on.
- When unsure whether something is true, leave it out rather than risk misinformation.

**Game-specific pages**
- Include the game name in the title and slug. Use "Roblox" when it aids search or clarity.

**Gaps and links**
- If info is missing, run a fan-out research query and fill it — never leave a gap.
- Add at least 2 relevant internal links to existing Bloxodes pages. Use the same-game articles and related pages the brief listed; if the brief has none, query the production DB for other published articles on the same `universe_id` before writing.
- Link only to pages that actually exist. Use real, current slugs (article links are `/articles/<slug>`). Never invent a slug or link to a page you have not confirmed exists.
- Weave each internal link naturally, mid-sentence, as part of the flow. No "read this" or similar call-outs. Pick anchor text that matches what the reader gets, and place links where they genuinely help (related mechanic, income, next goal), not as filler.

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
- `universe_id`: Set whenever the article belongs to one Roblox game and that game has a `roblox_universes` row. Look it up (by name/slug, or reuse the id other same-game articles use) instead of leaving it null. Only leave it null if no universe row exists for the game.
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
