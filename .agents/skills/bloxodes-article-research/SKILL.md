---
name: bloxodes-article-research
description: Research one approved Bloxodes article idea and create brief.md before writing. Use for article evidence checks, source coverage, production overlap, related page-type overlap, title promise, outline, facts to use, facts to avoid, and open gaps. Do not write final.json.
---

# Bloxodes Article Research

Use this for one approved article idea. Research only. Do not write the article and do not create `final.json`.

## Workspace

```text
tmp/content-workspace/<game-or-topic-slug>/articles/<article-slug>/
  brief.md
```

## Start

Start by checking if we have already covered this article on the production db. This is to make sure we are not writing an existing article.

If the article belongs to a game:

1. Find the game's `roblox_universes` row first (match on `name`/`slug`; the visible game name may differ from the prompt's wording, so try variations). Record its `universe_id` — the writing step needs it.
2. List the game's existing published articles by querying `articles` on that `universe_id` (do not rely only on a loose `ilike '%keyword%'` on title — that misses articles whose slug or title spells the game differently).
3. Treat those same-game articles as internal-link candidates and list them in the brief, with slugs, so the writing step can link to at least 2 real pages.
4. Confirm none of them already cover this exact topic before continuing.

## Research

1. Do a deep dive into the topic and the game if the topic is about a specific game. Try to get a good understanding of what will be useful for people in this topic.

2. Do fan out queries to fill up any gaps, do not speculate anything, confirm all the info you have researched.

3. For Roblox micro-topics, do not conclude "few sources" from one search tool or one query style. Run multiple query shapes before deciding source coverage is thin:
   - exact topic: `"<game name>" "<mechanic/item/boss>"`.
   - broad topic: `<game name> <mechanic/item/boss> Roblox guide`.
   - component facts: combine boss/NPC/item/location/drop names from the lead source with the game name.
   - variant names: try common spelling/capitalization differences, abbreviations, and "fruit", "V2", "quest", "awakening", "boss", "drop", "location", or other player terms that fit the topic.

4. Check multiple discovery surfaces when exact web results look sparse, polluted, blocked, or repetitive:
   - general web search results and snippets
   - the provided lead source and its internal links
   - trusted sites like Beebom, Pro Game Guides, game-specific wiki pages, Fandom, TechWiser, IGN, Game Rant, and Eurogamer
   - YouTube/video search results or transcripts when players are likely to document the mechanic there
   - official or semi-official game surfaces when accessible, such as the Roblox experience page, group, Discord, Trello, wiki, community server notes, or social posts
   - Bloxodes local data, production rows, and related Bloxodes pages

5. If a search tool returns irrelevant results, empty quoted results, Cloudflare blocks, or only duplicate copies of one article, record that as a search limitation. Do not phrase it as "there are not many sources" unless the fallback surfaces above were also checked.

6. Do not stop at first indexed results, dig deeper, click though internal links of the sources to get a holistic understanding.

7. Once done, understand what will be useful for people reading this article and what can be skipped. We write simple, clean and easy to understand and quick to read kind of articles. So make sure our research is helpful for that.

8. Only once you have searched all the sources and only when you think there are no gaps in the info, then continue and write `brief.md`.

9. Note useful FAQ questions only when they answer real follow-up points that do not fit naturally inside the article body.

## Source Coverage Gate

For gameplay how-to articles, the brief should normally have at least two independent sources for exact mechanic facts. If only one source gives the exact requirements, the brief can still proceed only when:

1. the user-provided lead is clearly the source of the article idea,
2. broader discovery was documented across multiple surfaces,
3. the one-source facts are marked as a risk instead of being overstated, and
4. no unsupported extra claims are added to make the article feel fuller.

When sources disagree, list the disagreement and recommend the safer fact set. When sources are thin, separate these ideas clearly:

- `Sources found`: sources discovered during fan-out.
- `Sources used for exact facts`: sources strong enough to support requirements, steps, drops, locations, or numbers.
- `Sources checked but not usable`: blocked, outdated, duplicate, vague, AI-spun, or unrelated results.
- `Search limitations`: search-tool pollution, empty exact queries, blocked pages, missing transcripts, or inaccessible community surfaces.

## Article Outline

In the `brief.md`, you need to include the article outline. Follow these rules:

1. We keep the structure of the article simple to scan through. If two headings are good enough, we just roll with them.
2. A article should not have more than 3 H2s unless very much needed for the topic. For example, a listicle may need more headings which is fine, but a casual explainer or how to, having 2 headings can be more than good enough.
3. So use fewer headings that are simple to read and almost sentence like (not generic SEO headings).
4. Headings can give away the info without people needing to dig into the text.
5. In outline, you just need to provide headings and a small one to two lines of what needs to be included under it.
6. If required, you can suggest to include table, lists or numbered lists that can go into any section when it makes sense.
7. For example, when writing how to, do not write "What it is" headings when it is obvious. Things can simply go into intro, directly to point without any fluff. So your outline should respect that.

Title need to be in simple human language, small but full sentence, people seeing this title on search should understand and open our page.

For game-specific articles, include the game name in the working title and suggested slug so readers know which game the guide is about. You can use `Roblox` wording when it helps search or clarity.

## Media Research

Media is optional. Use it only when it removes friction for the reader.

### YouTube

Search for a walkthrough that closely matches the article promise: the same game system, error, or procedure.

Record:

- candidate URL
- match quality: `perfect`, `near`, or `none`
- why it matches or why it should be skipped
- whether the channel is official, known, or unknown

Only a `perfect` match may be embedded. A `near` match is research only. If nothing fits, record `none` and continue without a video.

### Images

Look for images only when they clarify a menu, panel, UI state, map region, or other step that prose cannot show cleanly.

Accept images only when they:

- show the useful detail clearly
- have no watermarks, large arrows, subscribe overlays, or competitor branding
- have a defensible source or usage basis, preferably an official asset or our own capture

Do not assume a wiki or competitor image is free to reuse. Record the source URL, what the image shows, cleanliness result, rights/source note, and whether it should be hosted.

Hosted body images belong at:

```text
apps/web/public/articles/<article-slug>/<descriptive-name>.webp
```

Save a suitable image with:

```bash
npm run content:save-article-image -- --slug <article-slug> --url <source-url> --name <file-stem> --alt "useful UI fact"
```

Prefer zero to three body images. Cover images are separate and may remain null for the import flow to generate.

## Brief Shape

For `brief.md` Use this shape:

```text
Evidence checked:
- Existing Bloxodes coverage:
- Game universe_id (if game-specific):
- Internal link candidates (existing same-game/related pages with slugs, 2+):
- Source/competitor coverage:
- Sources found:
- Sources used for exact facts:
- Sources checked but not usable:
- Search limitations:
- Related page-type overlap:
- Useful uncovered angle:

Media plan:
- YouTube match quality (perfect / near / none):
- YouTube candidate URL and reason:
- Image candidates (source URL, what it shows, clean yes/no, rights note):
- Images to host (0-3, with planned file stems):
- Cover image plan (null / generated / hosted cover.webp):

Article plan:
- Working title:
- Suggested slug:
- Title promise:
- Reader need:
- Facts to use:
- Facts to avoid:
- FAQ opportunities:
- Open gaps or risks:

Outline:
- cleanly list out the outline here and mark useful media placement when applicable.

```

If research is weak, say what is missing. Do not pretend the article is ready.

## Good Briefs

- show what was checked
- include useful links
- name existing Bloxodes overlap clearly
- list the game's `universe_id` and 2+ existing same-game/related pages (with slugs) as internal-link candidates
- explain why this should be an article, not another page type
- give an outline that answers the title promise
- separate facts to use from facts to avoid
- keep the media plan optional and evidence-based
- make gaps obvious so the parent can approve, refine, or block the article
