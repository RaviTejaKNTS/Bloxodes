# Bloxodes Content Writing System Plan

This plan defines the lightweight writing system we want to build for Bloxodes. The goal is to improve page copy without overwhelming the project with generated drafts, temporary research, or one-off prompt files.

## Goal

Bloxodes content should feel like a useful Roblox live database written for players, not templated SEO filler.

The writing system should help us:

- write in simple English that players can follow quickly
- vary sentence rhythm so pages do not feel machine-generated
- make research more current, specific, and source-aware
- keep page copy practical instead of generic
- keep reusable style rules in git
- keep generated drafts and research notes out of git
- produce final content in the same shapes used by Supabase tables

## Tracked Files

Reusable guidance should live in git under `agents/content/`.

Suggested structure:

```text
agents/content/
  PLAN.md
  PROCESS.md
  writing-core.md
  research-policy.md
  final-edit.md
  page-types/
    catalog-pages.md
    game-catalog-pages.md
    wiki-pages.md
    articles.md
```

Keep these files short and operational. They should explain how to write, research, edit, and shape Bloxodes content. They should not contain generated page drafts.

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
```

The first page-specific skills should be:

- `bloxodes-catalog-writing`
- `bloxodes-game-catalog-writing`
- `bloxodes-wiki-writing`
- `bloxodes-article-writing`

Later page-specific skills can cover tools, codes, lists, quizzes, and other content types.

## Local Draft Workspace

Generated content, research notes, and intermediate drafts should stay out of git.

Use the existing ignored `tmp/` folder:

```text
tmp/content-workspace/
  YYYY-MM-DD/
    catalog/
      page-code/
        brief.md
        research-notes.md
        draft.json
        final.json
        review.md
    game-catalog/
      game-slug-collection/
        brief.md
        research-notes.md
        draft.json
        final.json
        review.md
    wiki/
      game-slug/
        brief.md
        research-notes.md
        draft.json
        final.json
        review.md
    articles/
      article-slug/
        brief.md
        research-notes.md
        article.md
        final.md
        seo.json
        review.md
```

The `tmp/` directory is already ignored by `.gitignore`, so these files can be freely generated, revised, and deleted locally.

## Supabase Output Shape

For Supabase-backed catalog, game catalog, wiki, and tool-like content, final drafts should be shaped like the target table fields instead of loose prose.

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

Article-style pages may use Markdown for the body, but should still include structured SEO output.

## Workflow

Use this flow for every serious rewrite:

1. Create a local folder under `tmp/content-workspace/YYYY-MM-DD/...`.
2. Write a short `brief.md` with page type, URL/code/slug, target reader, and content goal.
3. Research current facts and save them in `research-notes.md`.
4. Draft content using the relevant page-specific skill.
5. Run the Bloxodes final edit pass.
6. Save approved output to `final.json` or `final.md`.
7. Push only the approved final content into local Supabase.
8. Preview locally.
9. Promote to production only through the normal controlled Supabase process.

## Core Writing Principles

- Start with what the player needs from the page.
- Avoid generic setup lines and padded conclusions.
- Keep paragraphs short, but not robotic.
- Use specific game context when it changes how players use the page.
- Do not over-explain obvious Roblox basics.
- Do not make every page follow the exact same rhythm.
- Add practical judgment: what matters, what can be skipped, what changes often, what players usually misunderstand.
- Use headings that tell readers what the section does.
- Do not repeat the heading in the first sentence below it.
- Every sentence should explain, compare, guide, warn, redeem, decide, or help the player continue.

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
