# Articles

Use this guide for Bloxodes articles backed by the `articles` table.

Use this guide as a writing coach, not a fixed article template. The article shape should come from the reader's question, the update, the event, the mechanic, or the comparison. A good article feels intentional because each section answers the next natural question.

## Purpose

Articles should explain a game update, guide, event, system, or Roblox topic with more narrative depth than a catalog or wiki page. They still need to stay practical, source-aware, and player-first.

## Database Fields

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

## Article Types

Pick the primary type before writing:

- game guide
- event guide
- update explainer
- system explainer
- how-to
- troubleshooting
- comparison
- list
- Roblox codes support article

If the work is a `/codes/<slug>` page backed by the `games` table, use `agents/content/page-types/code-pages.md` instead of this article guide. Code pages are source-driven: never invent or manually enter codes.

If a normal article is about codes, verify active rewards and expired status with current sources. Do not invent codes.

## Structure

Choose structure based on reader intent, not a fixed template.

Common useful flow:

1. Lead with the current problem, update, event, or decision.
2. Explain what matters first.
3. Put steps, lists, or tables where they help.
4. Add caveats near the claim they affect.
5. Link to related Bloxodes pages naturally.
6. End with a useful takeaway only when needed.

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

- name the exact update, event, reward, mechanic, or problem
- say why it matters to the player now
- tell the reader what they can do with the article

## Source Rules

Use sources for:

- official announcements
- Roblox pages
- game/community links
- event dates
- code rewards
- item stats
- update claims
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

- Use H2 sections for main flow.
- Use H3 only for real subsections.
- Headings should read like clear sentence fragments, not rigid labels. Prefer `Why the event timer matters` over `Timer`.
- Put context before tables or lists.
- Do not place a table immediately under a heading unless the heading already gives full context.
- Keep paragraphs focused. One paragraph should explain one concept deeply enough before moving on.
- Use bullets for scan-heavy details.
- Use numbered lists only for steps.

## Final Checks

- Is the article based on current research?
- Does the opening say something useful immediately?
- Are claims sourced when they can change?
- Are links useful rather than decorative?
- Does each paragraph stay on one idea?
- Do headings give enough context before the paragraph starts?
- Does the article avoid generic Roblox filler?
- Are `sources` and `tags` filled honestly?
- Is `universe_id` linked when the article belongs to a specific game?
