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
- [ ] Check production DB or public production URLs first for the same title, slug, universe ID, tags, source URLs, item/mechanic name, and search intent.
- [ ] Verify this is not a `/codes/<slug>` page workflow.
- [ ] Verify the topic is evergreen and does not belong to events, codes, wiki, catalog, checklist, quiz, or tool pages.
- [ ] Search production articles and related page families by slug, title, universe ID, tags, sources, and topic synonyms to avoid duplicates.
- [ ] If production already covers the intent, mark it `[we already have a page]` or `do not create`, and choose a new uncovered angle instead of writing a duplicate.

## Research

- [ ] Answer the exact reader question in `research-notes.md`.
- [ ] Reject generic beginner, current update, event, and codes topics that belong to another page type.
- [ ] Verify unstable facts: item stats, unlocks, mechanics, formulas, prices, routes, or live game state.
- [ ] Record source URLs and unresolved facts.
- [ ] Build the simplest outline that answers the title. Do not force an H2 outline when the topic only needs one or two sections.

## Write

- [ ] Write `final.json` in the `articles` shape with title, slug, metadata, `content_md`, tags, sources, author handling, and universe ID when relevant.
- [ ] Keep the article as short as the topic allows. If the answer is complete around 300 words, do not pad it.
- [ ] For how-to topics, start with the action or steps. Do not add a broad `What is...` section first unless a short definition is needed.
- [ ] Use as few headings as possible and merge or remove tiny headings that do not carry the core topic.
- [ ] Create or plan the edited 1200x675 feature image for game articles.
- [ ] Inject the feature image before the first H2 when applicable.
- [ ] Add useful internal links without turning the article into link filler.

## Verify

- [ ] Run FLOW pass when the article has meaningful body copy.
- [ ] Run final edit.
- [ ] Confirm the article stands behind the title, has no padded sections, and reads cleanly from start to finish.
- [ ] Validate JSON and Markdown.
- [ ] After import, verify `/articles` and `/articles/<slug>` show the same title, author, cover, and content.
