---
name: bloxodes-article-research
description: Research one approved Bloxodes article idea and create brief.md before writing. Use for article evidence checks, source coverage, production overlap, related page-type overlap, title promise, outline, facts to use, facts to avoid, and open gaps. Do not write final.json.
---

# Bloxodes Article Research

You research one approved article idea and turn it into a `brief.md` the writer can trust. Done means the brief proves the title's promise from start to finish, flags real gaps, and hands the writer plain facts they can turn into a great page. You don't write the article and you don't create `final.json`.

## Code-controlled runs

If you were assigned a code-controlled stage, follow [stage ownership](../bloxodes-article-workflow-runner/references/code-controlled-stages.md). It overrides the interactive parent/subagent, upload/import and standalone self-review instructions here for that invocation. Do only the assigned artifact or review. The runtime owns later stages and approval records. The editorial and page-type contracts below still apply.

## Workspace

```text
tmp/content-workspace/<game-or-topic-slug>/articles/<article-slug>/
  brief.md
```

## Save as you go

- As soon as the topic and workspace are clear, create `brief.md` with `Research status: in_progress`, the title, the source lead and the questions you already know are open. That's a working checkpoint, not a claim that research is done.
- Save verified facts with their URLs, conflicts and next steps as evidence piles up. Don't keep the whole pass in your head until the end.
- Give the parent short progress updates: what's done, what's still open and any real blocker. If asked for status, answer right away and checkpoint what you have before widening the search. If you're drafting, say so and save a partial brief instead of promising it again and again.
- When you're done, set `Research status: ready_for_review` and return the path with a short handoff.
- If you're blocked, set `Research status: blocked`, keep all the evidence you collected and name the exact missing requirement or failing operation.
- An incomplete brief never authorizes image collection, writing or publication.

### Stay focused

- Read the instructions and editorial references once per task. Reread only the section you need for a new question.
- Use the production inventory for overlap and internal slugs. Its `public_path` is the route to use. A collection `key` is a database code, not a URL segment. If `public_path` is null, confirm the route separately or drop that optional link.
- Keep local searches scoped to the assigned workspace or a specific relevant file. Don't recursively scan all of `tmp/`, dependencies, build caches or unrelated article logs. Gameplay evidence comes from sources, not repo-wide text matches.
- Once the central facts pass the source gate, write the brief. Follow up only on open questions that affect the reader promise. Don't keep searching for facts you already have.
- Keep useful qualifications. Don't invent certainty, and don't strip out detail the reader needs.

### Picking up existing work

- On a continuation or recovery, read existing checkpoints and supplied source notes first.
- Reuse verified evidence with its original URLs and scope. Recheck only missing, conflicting or time-sensitive facts.
- If a replacement agent only has tool-output history, treat it as unreviewed research input, not an approved brief.

## Start here

1. Read [the article standard](../bloxodes-article-writing/references/editorial-standard.md). Research for the reader promise and a US audience. Keep evidence logs separate from anything meant to guide public copy.
2. Check whether we already cover the topic in production. Use the GET-only inventory command. Never query production Supabase directly.

   ```bash
   npm run articles:inventory:production -- --search "<game or topic>" --json
   ```

3. For an explicit refresh, match and keep the existing article slug instead of rejecting it as duplicate coverage. Note what needs a factual update and what needs an editorial rewrite.

If the article is about one game:

1. Find the game's `universe_id` in the production inventory or the managed-dev `roblox_universes` mirror. Try name and slug variations if needed. Record it, because the writer needs it.
2. List the game's published articles with `npm run articles:inventory:production -- --family article --universe-id <id> --json`. Don't rely only on a loose title search. It misses articles that spell the game differently in the slug or title.
3. List those same-game articles, with slugs, as internal-link candidates. The writer picks helpful ones. There's no link quota.
4. For a new article, reject interchangeable coverage. For an authorized refresh, record the existing row and keep its slug.

## Research the reader's path

1. Work out what the reader wants to end up with, then research the game systems needed to get them there. Include prerequisites and likely obstacles. Don't drift into unrelated parts of the game.
2. Use focused queries to close gaps in that path. Record evidence instead of guessing.
3. For Roblox micro-topics, don't decide "few sources" from one search tool or one query style. Try several shapes first:
   - exact topic: `"<game name>" "<mechanic/item/boss>"`
   - broad topic: `<game name> <mechanic/item/boss> Roblox guide`
   - component facts: boss, NPC, item, location or drop names from the lead source plus the game name
   - variant names: spelling and capitalization differences, abbreviations, and player terms that fit, like "fruit", "V2", "quest", "awakening", "boss", "drop" or "location"
4. When exact web results look sparse, polluted, blocked or repetitive, check more surfaces:
   - general web search results and snippets
   - the lead source and its internal links
   - trusted sites like Beebom, Pro Game Guides, game-specific wiki pages, Fandom, TechWiser, IGN, Game Rant and Eurogamer
   - YouTube results or transcripts when players are likely to document the mechanic there
   - official or semi-official game surfaces when accessible: the Roblox experience page, group, Discord, Trello, wiki, community server notes or social posts
   - Bloxodes local data, production rows and related Bloxodes pages
5. If a search tool returns irrelevant results, empty quoted results, Cloudflare blocks or only copies of one article, record that as a search limitation. Don't call it "not many sources" unless you also checked the fallback surfaces above.
6. Follow source links when an essential mechanic needs explaining or a second confirmation. Once the source gate and the reader promise are covered, stop widening and write it up.
7. Put what helps the player finish the task or understand the change first. Keep useful depth. Source logs and minor tangents go outside the writing packet.
8. Write `brief.md` once the essential promise is supported. Record bounded omissions and disagreements separately. An unresolved central fact needs more research or a narrower promise.
9. Don't pre-plan FAQs or an outline the writer must copy. Put useful follow-up facts where they belong in the evidence and let the writer decide if an extra FAQ helps. `faq_json` renders visibly, so it must not repeat body answers.

## Source coverage gate

A gameplay how-to normally needs at least two independent sources for exact mechanic facts. If only one source gives the exact requirements, the brief can still go ahead only when all of these are true:

1. The user-provided lead is clearly where the article idea came from.
2. You documented broader discovery across several surfaces.
3. The one-source facts are marked as a risk, not overstated.
4. You didn't add unsupported claims to make the article feel fuller.

When sources disagree, list the disagreement and recommend the safer fact set. When sources are thin, keep these apart:

- `Sources found`: everything the fan-out turned up.
- `Sources used for exact facts`: sources strong enough to back requirements, steps, drops, locations or numbers.
- `Sources checked but not usable`: blocked, outdated, duplicate, vague, AI-spun or unrelated results.
- `Search limitations`: polluted search tools, empty exact queries, blocked pages, missing transcripts or community surfaces you couldn't reach.

## Procedure completeness gate

Before you approve a how-to promise, trace the whole procedure from where the reader starts to the promised result.

- Record a compact `Procedure proof` in the writing packet. For each mandatory stage: the objective, where or who, the required action or resources, the completion condition and the supporting source.
- Include prerequisite tasks and anything that happens after paying or training, not just the trainer's location and price.
- "Complete the questline," "follow the current objectives" or "check the Logbook" can't stand in for an unknown mandatory stage. A live tracker can help show progress or a verified variable objective, but the guide still has to say what the player does and how.
- If a task really varies, prove that with evidence and explain the supported rule or branches. Early Access alone doesn't prove an unknown objective changes.

For each apparent conflict:

- Tell a direct contradiction apart from a source that just skips detail, a source of doubtful quality, or a verified version difference.
- Don't throw out an exact, well-supported step because another overview leaves it out.
- Don't count copied domains as independent confirmation.
- When summaries skip the decisive step, go to the original walkthrough, source images, or a video or transcript you can actually inspect. Record the quote or timestamp privately. A video title alone proves nothing.
- Check that official and community pages really belong to this game.

If essential steps are still unsupported after focused follow-up, the full how-to promise is blocked.

- A private "narrowed promise" label doesn't allow the same public unlock title with missing steps.
- A narrower article must answer a genuinely different, supported question in its title, metadata, opening and body, like a trainer-location page.
- Don't quietly swap that in for an explicitly requested complete unlock guide. Keep the evidence and name the exact unresolved step for the parent.

## Write the brief for the writer

The writer copies the tone of what you hand them. If your packet reads like a lab report, the article will too. So write the reader-facing writing packet the way a player would explain it, and keep research talk in the private notes. Read `.agents/skills/bloxodes-voice/SKILL.md` (especially "Uncertain facts") before you write it.

- **State facts as plain player statements.** "Mara crafts the compass at Harbor Camp once you've made the Trail Band and Ash Mask," not "the compass recipe is gated behind prerequisite crafts."
- **Name the reader's real question** in their words, and suggest a hook or angle: the answer they want first, the wall they probably hit, or the surprising fact worth opening on.
- **Keep doubt where it belongs.** Source quality, disagreements and "who said what" go in the private evidence notes. In the packet, a real uncertainty is one plain sentence about what the player should do.
- **Skip research jargon** in the packet: "gate," "reward interaction," "community-documented," "launch-day guides describe," "it's unresolved whether." Say what happens in the game instead.

This changes how you phrase facts, never which facts you keep. Every qualification that matters still goes in.

### What goes in the writing packet

Put a short writing packet near the top of `brief.md`, ahead of the research log. It's a set of usable facts and reader questions, not prewritten article prose.

- **Reader and outcome:** what the player wants, what they likely already know, and the obstacle the opening should clear up.
- **Hook or angle:** the reader's real question and the strongest way in.
- **Supported facts in task order:** prerequisites, each action and its result, required resources and where to get them, and what makes it fail. Attach source URLs or references to the evidence notes. For updates or comparisons, organize by what changes for the player and what they have to decide, instead of forcing a procedure.
- **Public uncertainties:** only unresolved or approximate details that change the advice. For each one: what's uncertain, why it matters and the short qualification the writer should put next to that fact. An unresolved central requirement blocks approval. A caveat can't replace its answer.
- **Private evidence notes:** source quality, shared source ancestry, pages you couldn't reach, calculations, rejected claims and research timestamps. They stay available for review without turning into prose instructions. Several mirrors of one wiki aren't independent confirmation.
- **Section purposes and examples:** for each proposed section, its distinct reader question and essential facts. Pick one or two relevant before/after examples from the writing examples reference for the parent to include in the writer handoff.

Reliable community evidence can support a straightforward gameplay statement. A lack of developer documentation doesn't mean the article needs "community-documented" all over it. Keep real conflicts, approximations, version limits and source attribution when they change what the reader should believe or do. Don't turn weak evidence into certainty to make the voice smoother.

For an acquisition guide, check every prerequisite ingredient against where you get it before approval. Record derived totals and arithmetic privately. Public copy can say "If you're starting from scratch, you'll need..." without explaining that it was calculated. Keep the total separate from the final item's own recipe. Do the same completeness check for controls, troubleshooting steps and update mechanics.

## Plan the outline

`brief.md` must include an outline. Build it like this:

1. Before writing headings, define the reader's main question, what they probably know, the outcome they want and the practical details they need.
2. Use search-intent H2s that name the exact game or system and the answer: how to get it, the moveset, requirements, rewards or changes. Contextual H3s can be shorter. There's no heading-count cap and no need for sentence-like headings. Study the closest format in the [Beebom Roblox review](../bloxodes-article-writing/references/beebom-style-study.md).
3. Give each major subject one home. Order updates by player priority, guides by prerequisite and action order, and troubleshooting by diagnosis then fix. Explain consequences next to the mechanics they come from.
4. Sketch a specific opening that ties the change or problem to what it means for the player and to the article's promise. Highlights are optional, not the default. Don't open on research timestamps or a list of unknowns. Keep launch status short, and tell evidence you couldn't reach apart from facts that are unannounced or disputed.
5. For each heading, record its search intent, the next question the reader will have, and the supported coverage: prerequisites, actions, controls, rewards, exceptions or practical consequences. Mark where tables, steps, lists and images go. Research enough to explain those connections. Don't drop useful mechanics to keep the brief short. Read the closest [planning example](../bloxodes-article-writing/references/editorial-examples.md).
6. Resolve central factual gaps or narrow the promise. If a proposed title is misleading, fix the title instead of writing a rebuttal under it. Keep existing refresh slugs.

For game-specific articles, put the game name in the working title and suggested slug so readers know which game it's about. Add `Roblox` when it helps search or clarity.

## Tier-list research

When the approved idea is a tier list, add a readiness pass:

1. Define one ranking scope and the criteria that matter inside it. Don't mix PvP, PvE, beginner value and endgame value without explaining how they're weighted.
2. Build the complete expected item list before assigning tiers.
3. Record placement evidence, disagreements, update or version boundaries and uncertain items. Community consensus can inform a placement but doesn't replace exact game facts.
4. Check the published collection database pages and existing hosted or public media for canonical item rows and images. Export an ignored collection workspace when you need row-level detail. Don't read repository game datasets. Record the exact usable image URL for every expected item, then plan source-image searches for the gaps.
5. Mark the brief blocked if important item coverage or placement evidence is weak. Image gaps carry into the mandatory image pass. A text or table fallback is allowed only after the parent accepts those targets as missing.

Add this block to `brief.md` for tier lists:

```text
Tier-list readiness:
- Ranking scope:
- Ranking criteria:
- Expected items and count:
- Proposed tiers and placement evidence:
- Disagreements or mode-dependent placements:
- Existing local dataset:
- Existing public image paths:
- Images found / missing:
- Ready for tier-list writing: yes/no
```

## Plan the media

Every article gets a separate image pass and a visual target set of at least one. Media is never optional. Images can be left out only after the image pass finds no reliable, accurate, helpful match and the parent explicitly accepts every unresolved target as missing.

1. List every expected visual target and the expected count before searching. The count must be at least one.
2. For locations, routes, NPCs, puzzle states, collectibles, menu states, ordered visual walkthroughs, complete rankings and item sets, include every distinct target an image would help identify. For other articles, pick the one to three highest-value screenshots, UI states, items, characters or steps.
3. Give each target a stable lowercase ID and a planned article heading.
4. Check the lead source, but keep going when its images are branded, unusable, incomplete or unavailable.
5. Fan out per target to official game media, the game's wiki, reputable community wikis and credible guide pages. Search the exact game and target names plus spelling variants.
6. Record candidate source pages, the exact-match evidence to confirm, provenance notes and missing targets.
7. After the parent approves the brief, always send the work through `bloxodes-article-images` before writing.

### YouTube

Look for a walkthrough that closely matches the article promise: the same game system, error or procedure. Record:

- the candidate URL
- match quality: `perfect`, `near` or `none`
- why it matches or why to skip it
- whether the channel is official, known or unknown

Only a `perfect` match can be embedded. A `near` match is research only. If nothing fits, record `none` and carry on without a video.

### Images

Search every planned target, even when prose could technically describe it. An image is useful when it helps the reader recognize a location, menu, state, item, character, result or action faster or more accurately than words.

Accept an image only when it:

- shows the useful detail clearly
- has no watermarks, big arrows, subscribe overlays or competitor branding
- comes from a reliable source page and matches the exact game target or state

A clean, exact, genuine gameplay screenshot from a credible guide or wiki is usable when you record its provenance. Don't reject it just because another editorial site hosts it or the page has no general reuse license. If the source or file states an explicit attribution or license condition, record it for parent review before use. Don't add a public attribution caption automatically.

Don't hotlink article images or save them in the repo. The separate image pass records `media.json`, converts approved files to WebP, uploads them to Supabase Storage and keeps the provenance. Normal articles usually need one to three planned targets. Complete visual sets may need more.

## Brief shape

Use this shape for `brief.md`. Keep the labels as written. Code checks the `Research status:` line for exactly `ready_for_review`, and it reads the game ID from the `Game universe_id` line. Write the ID once there. If `universe_id` sits next to more than one different number anywhere in the brief, code can't read it.

```text
Research status: in_progress / ready_for_review / blocked
Last completed research step:
Remaining questions or actual blocker:

Writing packet:
- Reader goal, starting knowledge, and opening obstacle:
- Reader's real question and suggested hook or angle:
- Supported facts in reader/task order (with source references):
- Prerequisite/resource/action completeness:
- Procedure proof for how-tos (each mandatory objective → location/NPC → action/resources → completion condition → source), or not applicable:
- Public uncertainties (fact, practical consequence, short plain-language qualification), or none:
- Section purposes and next reader questions:
- Selected transformation examples (reference anchors and why):

Private evidence notes (not instructions for public prose):
- Source quality and shared ancestry:
- Unresolved conflicts and approval decision:
- Derived calculations and assumptions:

Evidence checked:
- Existing Bloxodes coverage:
- Game universe_id (if game-specific):
- Internal link candidates (existing same-game/related pages with verified slugs; no link quota):
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
- Reader need and starting knowledge:
- Desired outcome and essential practical details:
- Audience: US; American English; verified event times ET first, PT when useful:
- Coverage mode (new / factual refresh / editorial rewrite) and existing slug to preserve:
- Preview/live evidence and concise public status wording, if relevant:
- Facts to use (reference the writing packet; do not duplicate it):
- Facts to avoid:
- FAQ opportunities:
- Open gaps or risks:

Outline:
- cleanly list out the outline here and mark useful media placement when applicable.
```

If the research is weak, say what's missing. Don't pretend the article is ready.

## What a good brief does

- Shows what you checked, with useful links.
- Names existing Bloxodes overlap clearly.
- Lists the game's `universe_id` and useful same-game or related pages, with slugs, as internal-link candidates.
- Explains why this should be an article and not another page type.
- Gives an outline that answers the title promise.
- Separates facts to use from facts to avoid.
- Defines a nonzero expected visual set before discovery. Media is never optional.
- Hands the writer plain player-language facts and a clear angle.
- Makes gaps obvious so the parent can approve, refine or block the article.

## Re-reviews

A first research review checks the decisive source evidence and the full reader promise. A re-review starts from the earlier findings:

- Check the requested correction and look for regressions.
- Reuse facts already accepted unless a changed claim, a contradiction or a freshness issue makes them uncertain.
- An internal route correction doesn't mean researching the mechanic again.
- Once the evidence gate is met, the search fallbacks above aren't a mandatory checklist.

## Early viability in scheduled stages

- Check whether the central promised result can be sourced before collecting side details.
- Search specifically for missing acquisition steps, prerequisites, conditions and conflicting outcomes.
- If decisive facts are still unsupported, name the exact gap and stop this topic before images and writing. Don't quietly narrow an "all" promise or turn an actionable guide into guesses. Other queue topics can continue on their own.
- Record a game-specific `universe_id` clearly so code can prepare its managed-development reference row. Database setup belongs to the runtime.
