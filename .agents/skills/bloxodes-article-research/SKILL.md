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

Start by checking if we have already covered this article in production. Use the GET-only inventory command; never query production Supabase directly:

```bash
npm run articles:inventory:production -- --search "<game or topic>" --json
```

If the article belongs to a game:

1. Find the game's `universe_id` from the production inventory or the managed-dev `roblox_universes` mirror. Match on name/slug variations when needed. Record it because the writing step needs it.
2. List the game's existing published articles with `npm run articles:inventory:production -- --family article --universe-id <id> --json` (do not rely only on a loose title search, which misses articles whose slug or title spells the game differently).
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

## Tier-List Research

When the approved idea is a tier-list article, add a dedicated readiness pass:

1. Define one ranking scope and the criteria that matter inside it. Do not mix PvP, PvE, beginner value, and endgame value without explaining how they are weighted.
2. Build the complete expected item inventory before assigning tiers.
3. Turn the scope into independent player-outcome criteria, then rank from verified stats, mechanics, costs, requirements, and repeatable gameplay consequences. Record the evidence and the condition that could move each item.
4. Treat competitor rankings only as candidate discovery and a final disagreement check. Never use another site's order as the proposed tiers, ranking lens, scoring input, or fallback. If the proposed order exactly matches one competitor, re-evaluate and independently justify every placement or block the brief.
5. Record disagreements, update/version boundaries, mode-dependent placements, and uncertain items. Do not use consensus as placement evidence.
6. Check `data/<Game>/` and `apps/web/public/<Game>/` for canonical existing item rows and images. Record the exact public image path for every expected item, then plan source-image searches for gaps.
7. Mark the brief blocked if important item coverage or placement evidence is weak. Image gaps continue into the mandatory image pass; the final tier-list component uses text-only items after the parent accepts those targets as missing.

Add this to `brief.md` for tier-list work:

```text
Tier-list readiness:
- Ranking scope:
- Ranking criteria:
- Expected items and count:
- Independent scoring notes and player outcomes:
- Proposed Bloxodes tiers and placement evidence:
- Competitor-order comparison performed only after ranking:
- Disagreements or mode-dependent placements:
- Existing local dataset:
- Existing public image paths:
- Images found / missing:
- Ready for tier-list writing: yes/no
```

## Media Research

Every article requires a separate image pass and a nonzero visual target set. There is no optional-media classification. Images may be omitted only after the image pass cannot find reliable, accurate, helpful matches and the parent explicitly accepts every unresolved target as missing.

Define the visual plan like this:

1. List every expected visual target and the expected count before searching. The count must be at least one.
2. For locations, routes, NPCs, puzzle states, collectibles, menu states, ordered visual walkthroughs, complete rankings, and item sets, include every distinct target that an image would help identify. For other articles, choose the one to three highest-value screenshots, UI states, items, characters, or steps.
3. Give each target a stable lowercase ID and a planned article heading.
4. Check the lead source, but do not stop when its images are branded, unusable, incomplete, or unavailable.
5. Fan out per target to official game media, the game's wiki, reputable community wikis, and credible guide pages. Search exact game and target names plus spelling variants.
6. Record candidate source pages, exact-match evidence to confirm, provenance/source notes, and missing targets.
7. After parent brief approval, always send the work through `bloxodes-article-images` before writing.

### YouTube

Search for a walkthrough that closely matches the article promise: the same game system, error, or procedure.

Record:

- candidate URL
- match quality: `perfect`, `near`, or `none`
- why it matches or why it should be skipped
- whether the channel is official, known, or unknown

Only a `perfect` match may be embedded. A `near` match is research only. If nothing fits, record `none` and continue without a video.

### Images

Search every planned target even when prose could technically describe it. An image is useful when it helps the reader recognize a location, menu, state, item, character, result, or action faster or more accurately than prose alone.

Accept images only when they:

- show the useful detail clearly
- have no watermarks, large arrows, subscribe overlays, or competitor branding
- come from a reliable source page and match the exact game target or state

A clean, exact, genuine gameplay screenshot from a credible guide or wiki is usable when its provenance is recorded. Do not reject it only because another editorial site hosts it or the page does not state a general reuse license. If the source or file states an explicit attribution or license condition, record it for parent review before use. Do not add a public attribution caption automatically.

Do not hotlink or save article-owned images in the repository. The separate article-image pass records `media.json`, converts approved files to WebP, uploads them to Supabase Storage, and retains provenance. Normal articles usually need one to three planned targets; complete visual sets may need more.

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
- Why these visuals help the reader:
- Visual type (locations / steps / NPCs / puzzles / routes / collectibles / items / other):
- Expected visual targets and count (stable ID, label, planned heading):
- Image candidates by target (source page, what it shows, clean yes/no, exact-match evidence to confirm, rights note):
- Missing targets and searches attempted (at least two distinct query variants and two checked HTTP source-page URLs per target before `accepted_missing` can be proposed):
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
- define a nonzero expected visual set before discovery; never classify media as optional
- make gaps obvious so the parent can approve, refine, or block the article
