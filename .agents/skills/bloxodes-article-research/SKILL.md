---
name: bloxodes-article-research
description: Research one approved Bloxodes article idea and create brief.md before writing. Use for article evidence checks, source coverage, production overlap, related page-type overlap, title promise, outline, facts to use, facts to avoid, and open gaps. Do not write final.json.
---

# Bloxodes Article Research

## Code-controlled execution

When assigned a code-controlled stage, follow [stage ownership](../bloxodes-article-workflow-runner/references/code-controlled-stages.md). It overrides interactive parent/subagent, upload/import, and standalone self-review instructions for that invocation. Complete only the assigned artifact or review; the runtime owns subsequent stages and approval records. Preserve the editorial and page-type contracts below.

Use this for one approved article idea. Research only. Do not write the article and do not create `final.json`.

## Workspace

```text
tmp/content-workspace/<game-or-topic-slug>/articles/<article-slug>/
  brief.md
```

## Checkpoints and focused research

- Once the assigned topic and workspace are resolved, create `brief.md` with `Research status: in_progress`, the title, source lead, and known unresolved questions. This is a working checkpoint, not a claim of research completion. Save verified facts with supporting URLs, conflicts, and next steps as meaningful evidence accumulates; do not leave the whole pass only in model context until the end.
- Give the parent concise progress updates that name completed work, remaining questions, and any actual blocker. If asked for status, answer promptly and checkpoint the evidence already gathered before widening the search. If drafting, say so and save a partial brief rather than repeatedly promising to write it.
- Read applicable instructions and editorial references once per task; reread only the section needed to resolve a new question. Use the production inventory for overlap and internal slugs. Its `public_path` is the route to use; collection `key` is a database code, not a URL segment. If public_path is null, confirm the route separately or omit that optional link. Keep local searches scoped to the assigned workspace or an identified relevant file; do not recursively scan all of `tmp/`, dependencies, build caches, or unrelated article logs to research gameplay. Gameplay evidence comes from sources, not repository-wide text matches.
- Once the central facts meet the source gate, synthesize the brief. Follow up only on unresolved questions that affect the reader promise; do not keep expanding searches for already-supported facts. Preserve useful qualifications instead of inventing certainty or removing necessary detail.
- On continuation or recovery, read existing checkpoints and supplied source notes first. Reuse verified evidence with its original URLs and scope; recheck only missing, conflicting, or time-sensitive facts. If a replacement has only tool-output history, treat it as unreviewed research input, not an approved brief.
- When complete, set `Research status: ready_for_review` and return the path with a concise handoff. If blocked, set `Research status: blocked`, retain all collected evidence, and state the exact missing requirement or failing operation. An incomplete brief must never authorize image collection, writing, or publication.

## Start

Read [the shared article editorial standard](../bloxodes-article-writing/references/editorial-standard.md). Research for the reader promise and a US audience; keep evidence logs separate from instructions for public copy.

For an explicit refresh, match and preserve the existing article slug instead of rejecting it as duplicate coverage. Identify what requires a factual update versus an editorial rewrite.

Start by checking if we have already covered this article in production. Use the GET-only inventory command; never query production Supabase directly:

```bash
npm run articles:inventory:production -- --search "<game or topic>" --json
```

If the article belongs to a game:

1. Find the game's `universe_id` from the production inventory or the managed-dev `roblox_universes` mirror. Match on name/slug variations when needed. Record it because the writing step needs it.
2. List the game's existing published articles with `npm run articles:inventory:production -- --family article --universe-id <id> --json` (do not rely only on a loose title search, which misses articles whose slug or title spells the game differently).
3. Treat those same-game articles as internal-link candidates and list them in the brief, with slugs, so the writer can choose helpful links without a quota.
4. For new articles, reject interchangeable coverage. For an authorized refresh, record the existing row and preserve its slug.

## Research

1. Identify the reader outcome and research the game systems needed to explain it. Include prerequisites and likely obstacles; do not expand into unrelated game coverage.

2. Use focused queries to resolve gaps in that reader journey. Record supporting evidence rather than speculating.

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

6. Follow relevant source links when an essential mechanic needs explanation or corroboration. Once the source gate and reader promise are supported, synthesize rather than widening research indefinitely.

7. Prioritize information that helps the player finish the task or understand the change. Preserve useful depth; source logs and minor tangents belong outside the writing packet.

8. Write `brief.md` once the essential reader promise is supported. Record bounded omissions and disagreements separately; unresolved central facts require more research or a narrower promise.

9. Do not preallocate FAQs or an outline the writer must reproduce. Record useful follow-up facts where they belong in the evidence; the writer decides whether an additional FAQ is needed. faq_json renders visibly, so body answers must not be repeated there.

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

## Procedure Completeness Gate

Before approving a how-to promise, trace the entire required procedure from the reader's starting state to the promised result. Record a compact `Procedure proof` in the writing packet: objective, where/who, required action or resources, completion condition, and supporting source for each mandatory stage. Include prerequisite tasks and post-payment/training objectives, not only the trainer location and price.

“Complete the questline,” “follow the current objectives,” or “check the Logbook” cannot fill an unknown mandatory stage. A live tracker can help identify progress or a verified variable objective, but the guide must still explain what the player does and how. If a task genuinely varies, establish that variability with evidence and explain the supported rule or branches. Early Access alone is not proof that an unknown objective changes.

For each alleged conflict, distinguish a direct contradiction from one source omitting detail, uncertain source quality, or a verified version difference. Do not discard an exact, well-supported step just because another overview omits it. Conversely, do not treat copied domains as independent confirmation. Follow the original walkthrough, source images, or inspectable video/transcript when the decisive step is absent from summaries. Record the relevant quotation or timestamp privately; a video title alone proves nothing. Verify that official/community pages actually belong to this game.

If essential steps remain unsupported after focused follow-up, the full how-to promise is blocked. A private label such as “narrowed promise” does not authorize the same public unlock title with missing steps. A narrower article must answer a genuinely different, supported question in its title, metadata, opening, and body, such as a trainer-location page. Do not silently substitute that for an explicitly requested complete unlock guide. Retain the evidence and identify the exact unresolved step for the parent.

## Writing Handoff: Facts, Decisions, and Private Evidence

Put a concise writing packet near the start of `brief.md`, ahead of the research log. It is a set of usable facts and reader questions, not prewritten article prose:

- **Reader and outcome:** what the player wants, what they likely already know, and the obstacle the introduction should explain.
- **Supported facts in task order:** prerequisites, each action and its result, required resources and where to get them, and failure conditions. Attach source URLs or references to the evidence notes. For updates or comparisons, organize by player consequence and decision instead of forcing a procedure.
- **Public uncertainties:** only unresolved or approximate details that change the advice. For each, state what is uncertain, why it matters, and the narrow qualification needed beside that fact. An unresolved central requirement prevents approval; a caveat cannot replace its answer.
- **Private evidence notes:** source quality, shared source ancestry, inaccessible pages, calculations, rejected claims, and research timestamps. These remain available for review without becoming prose instructions. Multiple mirrors of one wiki are not independent corroboration.
- **Section purposes and examples:** for each proposed section, give its distinct reader question and essential facts; select one or two relevant transformation examples from the writing examples reference for the parent to include in the writer handoff.

Reliable community evidence can support a straightforward gameplay statement. Lack of developer documentation alone does not require phrases such as “community-documented” throughout the article. Preserve actual conflicts, approximations, version limits, and source-specific attribution when they affect what the reader should believe or do. Do not convert weak evidence into certainty to improve the voice.

For an acquisition guide, check every prerequisite ingredient against its acquisition source before approval. Record derived totals and arithmetic privately; public copy can say “If you're starting from scratch, you'll need…” without narrating that it was calculated. Keep a total separate from the final item's recipe. Check equivalent completeness for controls, troubleshooting steps, and update mechanics.

## Article Outline

In the `brief.md`, you need to include the article outline. Follow these rules:

1. Define the reader's primary question, likely starting knowledge, desired outcome, and essential practical details before headings.
2. Use search-intent H2s that identify the exact game/system and answer (acquisition, moveset, requirements, rewards, or changes). Contextual H3s can be shorter. There is no heading-count cap and no requirement for sentence-like headings. Study the closest format in the [Beebom Roblox review](../bloxodes-article-writing/references/beebom-style-study.md).
3. Give each major subject one home. Use player priority for updates, prerequisite/action order for guides, and diagnosis/fix order for troubleshooting. Explain consequences alongside the relevant mechanics.
4. Outline a specific opening that connects the change or problem to its player impact and the article promise. Highlights are optional, not the default. Do not open on research timestamps or a list of unknowns. Keep launch status concise and distinguish inaccessible evidence from unannounced or disputed facts.
5. For each heading, record its search intent, the next useful reader question, and supported coverage: prerequisites, actions, controls, rewards, exceptions, or practical consequences. Include appropriate table, steps, list, and image placements. Research enough to explain those connections; do not drop useful mechanics to keep the brief short. Read the closest [planning example](../bloxodes-article-writing/references/editorial-examples.md).
6. Resolve central factual gaps or narrow the promise. Fix misleading proposed titles instead of writing a rebuttal underneath them. Preserve existing refresh slugs.

For game-specific articles, include the game name in the working title and suggested slug so readers know which game the guide is about. You can use `Roblox` wording when it helps search or clarity.

## Tier-List Research

When the approved idea is a tier-list article, add a dedicated readiness pass:

1. Define one ranking scope and the criteria that matter inside it. Do not mix PvP, PvE, beginner value, and endgame value without explaining how they are weighted.
2. Build the complete expected item inventory before assigning tiers.
3. Record placement evidence, disagreements, update/version boundaries, and uncertain items. A community consensus may inform a placement but does not replace exact game facts.
4. Check the published collection database pages and existing hosted/public media for canonical item rows and images. Export an ignored collection workspace when row-level inspection is needed; do not read repository game datasets. Record the exact usable image URL for every expected item, then plan source-image searches for gaps.
5. Mark the brief blocked if important item coverage or placement evidence is weak. Image gaps continue into the mandatory image pass; text/table fallback is allowed only after the parent accepts those targets as missing.

Add this to `brief.md` for tier-list work:

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
Research status: in_progress / ready_for_review / blocked
Last completed research step:
Remaining questions or actual blocker:

Writing packet:
- Reader goal, starting knowledge, and opening obstacle:
- Supported facts in reader/task order (with source references):
- Prerequisite/resource/action completeness:
- Procedure proof for how-tos (each mandatory objective → location/NPC → action/resources → completion condition → source), or not applicable:
- Public uncertainties (fact, practical consequence, narrow qualification), or none:
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

If research is weak, say what is missing. Do not pretend the article is ready.

## Good Briefs

- show what was checked
- include useful links
- name existing Bloxodes overlap clearly
- list the game's `universe_id` and useful existing same-game/related pages (with slugs) as internal-link candidates
- explain why this should be an article, not another page type
- give an outline that answers the title promise
- separate facts to use from facts to avoid
- define a nonzero expected visual set before discovery; never classify media as optional
- make gaps obvious so the parent can approve, refine, or block the article

## Focused independent re-review

A first research review checks decisive source evidence and the full reader promise. A re-review uses the retained earlier findings, checks the requested correction and regressions, and reuses facts already accepted unless a changed claim, contradiction, or freshness issue makes them uncertain. An internal route correction does not require researching the mechanic again. Do not turn source search fallbacks into a mandatory checklist when the evidence gate has already been met.
