# Article Todo

Status: not started
Updated: YYYY-MM-DD
Workspace: `tmp/content-workspace/<game-or-topic-slug>/articles/<article-slug>/`

## Use With

- Skill: `bloxodes-article-writing`
- Core docs: `agents/content/page-types/articles.md`, `agents/content/research-policy.md`
- Rewrite/edit: `agents/content/flow-pass.md`, `agents/content/final-edit.md`

## Setup

- [ ] Confirm article angle, target slug, article type, universe ID if game-specific, and related Bloxodes pages.
- [ ] Copy this file as `todo.md` before writing or updating `research-notes.md`.
- [ ] Verify this is not a `/codes/<slug>` page workflow.
- [ ] Verify the topic is evergreen and does not belong to events, codes, wiki, catalog, checklist, quiz, or tool pages.
- [ ] Search existing articles by slug, title, universe ID, tags, and sources to avoid duplicates.

## Research

- [ ] Answer the exact reader question in `research-notes.md`.
- [ ] Reject generic beginner, current update, event, and codes topics that belong to another page type.
- [ ] Verify unstable facts: item stats, unlocks, mechanics, formulas, prices, routes, or live game state.
- [ ] Record source URLs and unresolved facts.
- [ ] Build the H2 outline before writing `content_md`.

## Write

- [ ] Write `final.json` in the `articles` shape with title, slug, metadata, `content_md`, tags, sources, author handling, and universe ID when relevant.
- [ ] Create or plan the edited 1200x675 feature image for game articles.
- [ ] Inject the feature image before the first H2 when applicable.
- [ ] Add useful internal links without turning the article into link filler.

## Verify

- [ ] Run FLOW pass when the article has meaningful body copy.
- [ ] Run final edit.
- [ ] Validate JSON and Markdown.
- [ ] After import, verify `/articles` and `/articles/<slug>` show the same title, author, cover, and content.
