# Articles

Use this guide for Bloxodes articles backed by the `articles` table.

Use this guide as a writing coach, not a fixed article template. The article shape should come from the reader's question, the update, the event, the mechanic, or the comparison. A good article feels intentional because each section answers the next natural question.

## Purpose

Articles should answer a focused evergreen player question with more narrative depth than a catalog or wiki page. They still need to stay practical, source-aware, and player-first.

Articles are not the place to duplicate other page types. Do not create articles for current codes, code troubleshooting, events, event timelines, current update news, broad catalog explanations, or generic "beginner guide" topics. Use codes pages for code help, events pages for event timelines, wiki hubs for broad orientation, and catalog pages for item collections.

## Scope Guard

Article work owns the `articles` row, approved cover asset, internal source list, and article import/verification path. Do not edit article route templates, shared article chrome, cards, sidebars, CTAs, comments, ads, feed/sitemap code, or unrelated page copy while writing or publishing an article unless the user directly asks for that implementation change.

If preview shows a shared template problem, record it as a separate issue. Do not silently fix it inside the article task.

## Database Fields

Create or update:

```text
tmp/content-workspace/<game-or-topic-slug>/articles/<article-slug>/
  todo.md
  research-notes.md
  final.json
```

Copy `agents/content/todo-templates/article.md` into the folder as `todo.md` before research starts.

Write in this shape:

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

`content_md` is the article body. Keep source URLs in `sources`; public article copy should explain the facts directly instead of talking about source gathering.

The current `articles` table does not have `seo_title`. Use the visible `title` as the article title and make `meta_description` carry the search preview.

Article ingestion writes only to the `articles` table. Do not write reviewed article content into article views or index projections; those are read paths and should derive from the same saved article row.

## Article Scope Gate

Pick the exact evergreen player job before writing. Good article topics are narrow and durable:

- how-to
- specific quest/objective guide
- specific item unlock or obtainment guide
- specific mode, map, boss, route, or mechanic guide
- stable farming or progression process
- focused comparison only when the comparison is not already answered by cards/tables
- priority, ranking, mistake, route, worth-it, or what-to-skip topics where the article adds player judgment beyond the data
- troubleshooting only for a durable gameplay/account/input problem that does not belong on a codes page

If the work is a `/codes/<slug>` page backed by the `games` table, use `bloxodes-code-writing` and `agents/content/page-types/code-pages.md` instead of this article guide. Code pages are source-driven: never invent or manually enter codes.

Before approving an article topic, check the production database or public production page for the same title, slug, universe ID, tags, source URLs, item/mechanic name, and search-intent wording. Also check related catalogs, wiki pages, tools, checklists, quizzes, codes pages, and events pages for the same intent. This is the first action after identifying the game/topic. If production already covers it, do not write a duplicate; update the existing page only if the user asked for a refresh, or find a new uncovered angle.

Do not write normal articles about current codes, events, Discord/Trello/wiki links, or complete item lists. If a user asks for one, redirect the work to the proper codes/events/wiki/catalog workflow or mark it as not recommended. `All <core items>` belongs to a catalog page, not an article.

Before approving an article topic, explicitly check overlap:

- Does a catalog page already answer this with item cards or tables?
- Is the topic only a complete item list that should become a catalog page?
- Does a wiki hub already cover the broad system?
- Does a codes page cover the redemption/troubleshooting need?
- Does an events page own the timeline/reward status?
- Is the angle specific enough to be useful after the next update?

If the answer is weak, mark the article `do not create` or `blocked until catalog data`.

## Structure

Choose structure based on reader intent, not a fixed template.

Use only the flow the topic needs:

1. Lead with the specific problem, objective, mechanic, item, mode, map, or action.
2. Explain the next thing the player needs to know.
3. Put steps, lists, or tables where they make the answer easier to scan.
4. Add caveats near the claim they affect.
5. Link to related Bloxodes pages naturally when the link helps the next step.
6. End with a useful takeaway only when the article actually needs one.

Write the smallest complete article that answers the title. If the article is done in two sections or around 300 words, leave it there. Do not add extra headings, background, recap sections, or padded explanation just because longer articles look more complete.

The outline should be easy to scan before the reader starts reading. Use as few headings as possible, merge small side points into stronger sections, and cut headings that only exist because the draft felt too short.

Do not move so quickly that the reader loses the thread. A good article gives enough setup before switching from the main question to mechanics, steps, rewards, dates, exceptions, or opinions.

## Opening Rules

The first paragraph should give useful context immediately.

Avoid:

- broad Roblox setup
- mood-setting
- suspense
- "In this article..."
- repeating the title

Better:

- name the exact item, quest, mode, map, mechanic, unlock path, reward, or problem
- say why it matters to the player now
- move straight into the action or answer the title promises

For how-to articles, begin with the how-to. Do not put a `What is...` section before the steps unless the player needs a short definition to understand the action. When setup is needed, keep it to one or two useful sentences and then move.

## Source Rules

Use sources for:

- official announcements
- Roblox pages
- game/community links
- item stats
- durable mechanic claims
- formulas or tool logic
- screenshots or media claims

Use the best source for the claim in the internal `sources` field, not every page that repeated it. Do not write source-gathering language in the article body.

## Internal Links

Internal links should help the reader continue:

- wiki hub
- catalog page
- codes page
- event page
- tool
- related guide

Do not add self-referential wording like "in our article" just to place a link.

## SEO Rules

- `title`: useful and natural.
- Keep the visible `title` search-friendly but not lifeless. Put the main keyword first, then add a short reader outcome when it improves the headline, such as `Slime RNG Rebirth Guide: When Resetting Is Worth It` or `Slime RNG Items Guide: What to Use, Save, and Spend First`.
- `slug`: lowercase, stable, and not date-stuffed unless the topic is inherently dated.
- `meta_description`: usually 145-160 characters, specific to the reader outcome.
- `tags`: specific and reusable.

## Author And Feature Image Rules

Published articles must have an author. When importing reviewed article JSON without an explicit `author_id`, use the same behavior as `scripts/articles/generate-articles.ts`: pick one author randomly from the `authors` table and save that ID on the article row. Do not publish article rows with `author_id = null`.

Game articles must have an edited feature image. Start from the linked Roblox universe thumbnail, crop it to 1200x675, apply the same dark overlay style used by `scripts/articles/generate-articles.ts`, and place a short centered overlay title. The overlay should be 3-6 words when possible, such as `Beginner Guide`, `Rebirth Guide`, `Items Guide`, or `Power Fruits Guide`.

Do not store the raw Roblox thumbnail as the article cover when an edited cover can be generated. Use `cover_image` for the edited image path or URL, then inject the feature image into `content_md` before the first H2 so the detail page has the same visual treatment as generated articles.

After import, verify the card and detail page together:

- `/articles` shows the simplified title, edited cover, and assigned author.
- `/articles/<slug>` shows the same title, edited cover, and same author.
- Open Graph image uses the edited cover.

## Markdown Rules

- Use H2 sections only for the main flow the article truly needs.
- Use H3 only for real subsections in deeper articles.
- Headings should read like clear sentence fragments, not rigid labels. Prefer `Why the event timer matters` over `Timer`.
- Avoid many tiny headings. Merge weak sections into stronger ones when that makes the article easier to follow.
- Put context before tables or lists.
- Do not place a table immediately under a heading unless the heading already gives full context.
- Keep paragraphs focused. One paragraph should explain one concept deeply enough before moving on.
- Use bullets for scan-heavy details.
- Use numbered lists only for steps.
- Do not force a table, list, conclusion, intro section, or extra H2 when paragraphs already answer the title cleanly.

## Final Checks

- Is the article based on current research?
- Does the opening say something useful immediately?
- For how-to articles, does the article start with the action instead of a broad `What is...` setup?
- Does the article answer the title without padding?
- Could the article be shorter while staying complete?
- Are the headings only the core sections the topic needs?
- Are claims sourced when they can change?
- Are links useful rather than decorative?
- Does each paragraph stay on one idea?
- Do headings give enough context before the paragraph starts?
- Does the article avoid generic Roblox filler?
- Are `sources` and `tags` filled honestly?
- Is `universe_id` linked when the article belongs to a specific game?
