# Pipeline Writing Contract

The controller has already approved `brief.md` and `media.json`. Your job is `final.json`. You may also update `media.json` `placement_heading` values to match your headings. Don't redo research, inventory queries, image collection, uploads, import or browser checks. If the evidence really lacks a central answer, send the exact question back to research. Use the identity and confirmed internal URLs from the brief. Never build collection paths from database codes.

## Read first

1. The voice guide (`.agents/skills/bloxodes-voice/SKILL.md`) and the article section of its examples (`.agents/skills/bloxodes-voice/references/examples.md`). This is how the article should sound.
2. [editorial-standard.md](editorial-standard.md). This is what the article has to deliver.
3. The closest section of [editorial-examples.md](editorial-examples.md). The [Beebom study](beebom-style-study.md) helps when the format is unfamiliar.
4. The brief's reader-facing writing packet, then its private evidence notes when you need to check a claim.

The examples teach moves, not wording or a required outline.

## Write it

- Build the article around the reader's goal. Answer first, then explain what matters and why, in friendly, connected American English that sounds like a player who knows the game.
- Give each substantial answer one home. Use the named events, tools and conditions from the brief instead of generic advice.
- Tables compare, steps guide, prose explains. Every table row must fit its column and every cell must add a fact or consequence. If there's little to compare, write a paragraph instead.
- Put a needed caveat once, next to the advice it affects, in plain words. Source disagreements, verification methods and source-type labels stay in the brief unless a real uncertainty changes what the reader should do. Never swap a needed caveat for false certainty.
- Use specific, searchable titles and main H2s, short contextual H3s, and a mix of heading shapes. No forced highlights, section counts, lengths, jokes, stock openings or recap endings. Stop when the task is answered. A useful next step makes a good ending. Don't pad a complete answer with FAQs.

## Output

Valid JSON with exactly these fields:

- `title`, `slug` (keep the assigned slug), `meta_description`, `content_md`.
- `faq_json`: an array of `{q, a}`. It renders a visible FAQ after the body and supplies structured data. It's the only FAQ location, so never add an FAQ section to `content_md`. Each question must add a supported answer the body doesn't already give. Use `[]` when the body covers it. No quota.
- `cover_image`: `null`. The runtime makes the cover.
- `author_id`: the approved known ID or `null`. `universe_id`: the verified game universe ID from the brief for a game-linked article.
- `tags`: specific reusable labels. `sources`: URLs that support the actual facts. `is_published`: `true` (managed-development import only; the controller owns publishing).

No `seo_title` and no internal review notes.

Insert every verified hosted image from `media.json` under its matching heading with factual alt text. Keep approved URLs and provenance. Accepted-missing entries need no substitute. Never put the cover in the body. Add confirmed internal links where they help. A perfect-match approved YouTube video is optional: `{{ youtube: URL }}` on its own line. Specialized blocks follow their page-type skill.

## Before you return

Read the whole article in your head as the player who searched the title. Run the voice guide's "Before you hand it in" check. Then check the title's promise through to the result, repeated explanations, leftover research wording, heading quality and FAQ value. Parse the JSON. Return a draft or revision decision, not self-approval. A separate reviewer judges it and code runs QA.

## Focused corrections

When revising, keep the useful passages and fix the specific finding without rewording unrelated sections. Code may apply one limited literal prose correction and ask for a fresh review once the normal repair allowance is used. That doesn't approve the draft, relax factual support, set article lengths or allow a whole-article rewrite loop. HTML entities that render the same alt text are handled by the validator, so don't rewrite copy to work around an apostrophe encoding.
