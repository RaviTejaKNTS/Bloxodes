# Bloxodes Content Writing System Plan

This plan defines the lightweight writing system we want to build for Bloxodes. The goal is to improve page copy without overwhelming the project with generated content, temporary research, or one-off prompt files.

## V2 Reset

The first version failed because it let `research-notes.md` become a database and schema checklist. That created field-first copy instead of useful game explanation.

The current standard is one-page-first:

- Build one gold-standard page before rewriting a batch.
- Research must explain the game system in plain English before implementation notes.
- Final copy must teach the topic, not describe Bloxodes, a dataset, or the catalog surface.
- A sentence fails if a normal player can ask "what does that mean?" and the surrounding copy does not answer it.
- Batch generation is paused until one page has been researched, written, previewed, and approved.
- Catalog pages now use a section-confirmation step: research first, propose the item-card section style, get user confirmation, then write final copy.

## Goal

Bloxodes content should feel like a useful Roblox live database written for players, not templated SEO filler.

The writing system should help us:

- write in simple English that players can follow quickly
- vary sentence rhythm so pages do not feel machine-generated
- make research more current, specific, and source-aware
- keep page copy practical instead of generic
- keep reusable style rules in git
- keep generated content and research notes out of git
- produce final content in the same shapes used by Supabase tables
- make the skills and memory docs themselves read in clear, conversational guidance so models are nudged toward the same fluid style we want in the output

## Research Basis

This system follows a few working patterns:

- Keep `SKILL.md` files thin, with strong trigger descriptions and clear references.
- Put reusable style, research, final edit, and page-type rules in tracked reference files.
- Keep generated content and research notes in ignored local workspaces.
- Require a final compression/edit pass before database import, but keep it internal.
- Shape final output like the destination Supabase fields, not loose prose.
- Keep the generated workflow to two files per page: `research-notes.md` and `final.json`.
- Make `research-notes.md` read like plain-language topic research, not a field checklist.
- Use `description_json` as short section-level context when catalog cards are divided into meaningful in-game groups.
- Add a mandatory FLOW pass after the first-pass `final.json` for catalog, game-catalog, article, and tool pages with body copy.
- Keep `description_md` focused on the whole mechanic or collection, and keep section-specific card notes in `description_json`.
- Write the guidance itself in simple editorial language. Be clear and specific, but avoid making the docs sound like robotic command stacks. Use examples only when they teach a reusable pattern.

The structure is adapted from the iGeeks editorial workflow, but changed for Bloxodes' public database model instead of WordPress posts.

## Tracked Files

Reusable guidance should live in git under `agents/content/`.

Suggested structure:

```text
  agents/content/
    PLAN.md
    PROCESS.md
    writing-core.md
    research-policy.md
    flow-pass.md
    final-edit.md
  page-types/
    catalog-pages.md
    game-catalog-pages.md
    wiki-pages.md
    articles.md
    tools.md
```

Keep these files short and operational. They should explain how to write, research, edit, and shape Bloxodes content. They should not contain generated page content.

Implemented files:

- `agents/content/PROCESS.md`
- `agents/content/writing-core.md`
- `agents/content/research-policy.md`
- `agents/content/flow-pass.md`
- `agents/content/final-edit.md`
- `agents/content/page-types/catalog-pages.md`
- `agents/content/page-types/game-catalog-pages.md`
- `agents/content/page-types/wiki-pages.md`
- `agents/content/page-types/articles.md`
- `agents/content/page-types/tools.md`

## Skills

Codex skills should be small entry points that point back to the tracked guidance files.

Initial skills to create:

```text
.agents/skills/
  bloxodes-writing-core/SKILL.md
  bloxodes-research/SKILL.md
  bloxodes-final-edit/SKILL.md
  bloxodes-catalog-writing/SKILL.md
  bloxodes-game-catalog-writing/SKILL.md
  bloxodes-wiki-writing/SKILL.md
  bloxodes-article-writing/SKILL.md
  bloxodes-tool-writing/SKILL.md
```

The first page-specific skills should be:

- `bloxodes-catalog-writing`
- `bloxodes-game-catalog-writing`
- `bloxodes-wiki-writing`
- `bloxodes-article-writing`
- `bloxodes-tool-writing`

Later page-specific skills can cover codes, lists, quizzes, and other content types.

Implemented initial skills under `.agents/skills/`:

- `bloxodes-writing-core`
- `bloxodes-research`
- `bloxodes-final-edit`
- `bloxodes-catalog-writing`
- `bloxodes-game-catalog-writing`
- `bloxodes-wiki-writing`
- `bloxodes-article-writing`
- `bloxodes-tool-writing`

## Local Content Workspace

Generated content, research notes, and intermediate working files should stay out of git.

Use the existing ignored `tmp/` folder:

```text
tmp/content-workspace/
  YYYY-MM-DD/
    catalog/
      page-code/
        research-notes.md
        final.json
    game-catalog/
      game-slug-collection/
        research-notes.md
        final.json
    wiki/
      game-slug/
        research-notes.md
        final.json
    articles/
      article-slug/
        research-notes.md
        final.json
    tools/
      tool-code/
        research-notes.md
        final.json
```

The `tmp/` directory is already ignored by `.gitignore`, so these files can be freely generated, revised, and deleted locally.

Do not add `brief.md`, `review.md`, fan-out plan files, draft JSON, separate article body files, or SEO files. Put the useful setup, research, source notes, writing requirements, unknowns, and final risk notes inside `research-notes.md`.

## Supabase Output Shape

For Supabase-backed catalog, game catalog, wiki, and tool-like content, final output should be shaped like the target table fields instead of loose prose.

Example `final.json` shape for catalog-style pages:

```json
{
  "title": "",
  "seo_title": "",
  "meta_description": "",
  "intro_md": "",
  "how_it_works_md": "",
  "description_json": {},
  "faq_json": []
}
```

Article-style pages should still use `final.json`. Put Markdown in `content_md` and include structured output through fields the `articles` table actually has, mainly `title`, `meta_description`, `tags`, and `sources`.

## Workflow

Use this flow for every serious rewrite:

1. Create a local folder under `tmp/content-workspace/YYYY-MM-DD/...`.
2. Research the topic deeply in plain language and save it in `research-notes.md`.
3. Confirm the notes explain what the thing is, how it works, important terms, item groups, real examples, and common mistakes.
4. For catalog and game-catalog pages, propose the item-card section style and wait for user confirmation.
5. Write researched first-pass content using the relevant page-specific skill.
6. Run the FLOW pass and rewrite the public fields so the page reads in a clear player-facing order.
7. Run the Bloxodes final edit gate inside the same workflow.
8. Save approved output to `final.json`.
9. Push only the approved final content into local Supabase.
10. Preview locally.
11. Promote to production only through the normal controlled Supabase process.

For catalog and game catalog work, apply this flow to one page first. Do not rewrite a whole game at once until the first page becomes the approved standard.

When catalog cards are divided into sections, choose the grouping that has the strongest in-game meaning. Rarity, item type, source, event, location, shop, tier, world, and unlock route are all possible. Do not default to the easiest dataset field if another grouping helps players understand the collection better. Put the short section setup in `description_json`, then keep `description_md` focused on whole-page mechanics instead of repeating those notes.

For catalog and game-catalog pages, the FLOW pass is not optional. It should check whether `description_md` explains the whole page, whether the page has a useful action/how-to/use section when the topic has player action behind it, whether tables or numbered steps would explain faster than paragraphs, and whether the headings guide the reader instead of reflecting database fields.

## Core Writing Principles

- Start with what the player needs from the page.
- Avoid generic setup lines and padded conclusions.
- Keep paragraphs short, but not robotic.
- Keep paragraphs focused on one concept with enough context to follow.
- Use specific game context when it changes how players use the page.
- Do not over-explain obvious Roblox basics.
- Do not make every page follow the exact same rhythm.
- Add practical judgment: what matters, what can be skipped, what changes often, what players usually misunderstand.
- Use sentence-style headings that tell readers what the section explains.
- Do not repeat the heading in the first sentence below it.
- Every sentence should explain, compare, guide, warn, redeem, decide, or help the player continue.
- Define unclear terms before using them as advice. `Source`, `seats`, `uses`, `availability`, `rarity`, `chance`, `refresh`, and similar field labels are not enough by themselves.

## Page Type Priorities

Build these first:

1. Catalog pages
2. Game-specific catalog pages
3. Wiki pages
4. Articles

Catalog and game-specific catalog pages matter first because they currently carry a lot of templated Supabase copy around structured data. Wiki pages matter because they are central game hubs. Articles matter because they need the most human rhythm and research discipline.

## Implementation Notes

- Keep generated content out of git.
- Keep reusable guidance in git.
- Keep skills thin and page-type-specific.
- Do not add new page-type skills until the first four are working well.
- Prefer structured output that can be inspected before writing to Supabase.
- Add scripts only after the manual workflow proves useful.
