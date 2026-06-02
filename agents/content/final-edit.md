# Bloxodes Final Edit

Use this as a mandatory quality gate during the same writing workflow and again before writing to local Supabase.

The final edit is internal. It does not create `review.md`; it either improves `final.json`, marks the work blocked, or records unresolved risk inside `research-notes.md`. Update the page folder's `todo.md` during this gate; if the folder has no tracker, copy `agents/content/todo-templates/final-verification.md` into the folder first.

For catalog, game-catalog, article, and tool pages with meaningful body copy, the final edit assumes the FLOW pass has already rewritten the draft. If the FLOW pass has not happened, stop and run `agents/content/flow-pass.md` first. Final edit is the gate after flow, not a replacement for flow.

## Goal

Prevent weak content from leaving the workflow. The page-specific skill should already write in Bloxodes voice; this file confirms the result is practical, specific, human, and shaped for the target database fields.

Use this pass like an editor sitting with the draft. Do not only scan for banned phrases. Read for understanding, flow, and usefulness. If the sentence is technically allowed but still sounds vague, stiff, or unexplained, fix it.

## Absolute Blocker

If a normal player can ask "what does that mean?" after a sentence, the sentence fails.

This applies even when the sentence avoids banned phrases. A sentence can be rule-compliant and still useless.

Bad:

```markdown
Source explains whether a vehicle is easy to replace.
```

Better:

```markdown
A vehicle from the current car showroom can be bought again with Bucks or Robux. A vehicle from an old gift rotation or holiday event usually depends on trading because the original reward pool is gone.
```

## Core Pass

1. Re-read the player-facing research sections in `research-notes.md`.
2. Re-read `todo.md` and confirm required gates through the current stage are checked or explicitly blocked.
3. Confirm the page type and target fields.
4. For catalog and game-catalog pages, confirm the data and image audit exists and is resolved.
5. For catalog and game-catalog pages, confirm the player-usefulness gate and required fact matrix exist and are resolved.
6. Confirm the FLOW pass happened when the page has `description_md`, `how_it_works_md`, article body, or tool explanation.
7. Remove generic opening lines.
8. Remove unsupported claims.
9. Cut repeated ideas across fields.
10. Replace broad field claims with exact game or dataset details.
11. Keep the useful answer close to the top.
12. Add missing context where the copy jumps too quickly between mechanics, fields, or item groups.
13. Split paragraphs that mix unrelated concepts.
14. Check headings are clear sentence-style fragments, not rigid one-word labels.
15. Check Markdown and JSON are valid.
16. Check the visible title and `seo_title` are unique, well-defined, count-accurate, and fully supported by the page body.
17. Check the final output can be pasted or upserted without reshaping.

## Understanding Questions

For every paragraph, ask:

- Does this teach the game system, tool result, article topic, or item group?
- Could a reader explain the idea back after reading it once?
- Could a reader act in-game from this page without needing another guide for the same promised task?
- Does the paragraph define unclear terms before using them as advice?
- Does it use at least one real item, mechanic, reward, source, example, or player action when the topic needs proof?
- Does it explain what the player actually does in the game?
- Does it explain why a value matters instead of naming the value?
- Does every sentence add information, context, comparison, warning, instruction, or next-step clarity?
- Could this paragraph fit any Roblox page? If yes, rewrite or cut it.
- Is this fact supported by the dataset or source notes?
- Is this idea already in another field?
- Does this paragraph stay on one concept?
- Does the paragraph move too fast for a new player to follow?
- Is the heading repeated in the first line below it?
- Does the section exist for a reader reason, or only because a field or row made the writer think of it?

## Hard Fail Patterns

Fail the final edit and rewrite before import if public copy contains:

- website-first copy: `Use the <collection> catalog`, `check the catalog`, `open the catalog`, `browse the catalog`, `this catalog`, `this page`, `the dataset`, `on Bloxodes`
- field-command glue: `Read category first`, `Check rarity first`, `Use source first`
- AI-ish contrast filler: `not just`, `not only`
- vague field-first claims without definition: `source explains`, `availability explains`, `rarity explains`, `seats explain`, `price explains`, `uses explain`, `field matters`, `value context`
- unexplained values such as `Yes`, `No`, `3`, `common`, `available`, or `limited` in public prose without a visible label or gameplay explanation
- catalog cards or tables that render raw long descriptions, raw HTML, raw `pros`/`cons`, nested object dumps, vague meta descriptions, or unlabeled values that do not help the player compare items
- catalog research that found missing items, mismatched counts, or missing expected images but continued to final copy without a resolved data action
- catalog research that found source-backed player-useful facts, such as prices, stats, upgrade steps, shops, chances, requirements, locations, or route order, but continued to final copy without adding them to data/cards/body or marking them unavailable
- catalog or game-catalog copy that explains why data is missing more prominently than it explains what the player should do
- game-catalog scope that turns current season tracks, one-off event rewards, ranked season rewards, gamepasses, badges, servers, developer products, broad update summaries, or raw Roblox media into catalog pages
- catalog or game-catalog final copy that skipped the FLOW pass
- catalog `description_md` that repeats card-section notes instead of explaining the whole collection or mechanic
- catalog `description_md` with no useful action/use/how-to section when the collection has a clear player action behind it
- wiki catalog titles that stop at `All <N> <Collection> in <Game>` when research found a real player question to answer
- generic catalog headings such as `How classes work`, `How tools work`, `Overview`, `Value`, or `Source` when the section can say the decision it helps with
- catalog or game-catalog titles that promise how to get items, locations, drops, chances, brewing, crafting, effects, value, or comparison when the body, cards, and FAQ do not answer that promise in enough detail
- random headings that do not create a clear reader path
- count-based titles that disagree with local dataset or rendered card counts without an intentional explanation
- fake authority such as `players say`, `experts believe`, or `reports suggest` without a named source
- inflated wording such as `serves as`, `stands as`, `pivotal`, `underscores`, `showcases`, `evolving landscape`
- vague tails such as `highlighting its importance`, `making it valuable`, `ensuring a smoother experience`

For `wiki_md`, also fail if the line reads like a link-card caption instead of a game-system explanation.

## Markdown Checks

- Clean paragraph breaks.
- Sentence-case headings.
- Headings should usually explain what the section covers, not use one-word labels such as `Sources`, `Value`, `Tips`, or `Overview`, or generic labels such as `How classes work`.
- The paragraph after a heading should deepen the idea, not repeat it.
- One paragraph should explain one connected concept.
- Copy should use player-perspective language: practical `you` and `your` guidance with Roblox-gamer judgment, not stiff help-center narration.
- Lists only when they improve scanning.
- No public mention of research, source gathering, internal checks, scraping, prompts, AI, database, or dataset.
- No chat artifacts such as `Let's dive in`, `Here is`, or `I hope this helps`.

## JSON Checks

- Valid JSON only.
- FAQ entries use `{ "q": "", "a": "" }`.
- `description_json` values are useful ordered blocks, not raw paragraphs dumped because Markdown felt hard.
- For catalog and game-catalog pages, `description_json` values are short section-level notes tied to the confirmed item-card grouping.
- `description_md` does not repeat the same section notes already carried by `description_json`.
- `description_md` has gone through the FLOW pass and reads as whole-page explanation, not a pile of unrelated mini sections.
- `description_md` includes a useful action/use/how-to section when the catalog item type has a player action behind it.
- `title` and `seo_title` match the approved title promise. For wiki catalog pages, this usually means `All <N> <Item Or Collection> in <Game>: <real player SEO question>`. If they promise obtainment, locations, drops, chances, brewing, crafting, effects, bonuses, value, priority, or comparison, the page body must fully answer that promise.
- The primary player task and required fact matrix are answered by visible card fields, body sections, FAQs, or an explicit unavailable/blocked note in research.
- For catalog and game-catalog pages, the data and image audit in `research-notes.md` is resolved before import. Missing items, stale fields, and image gaps must be fixed or explicitly accepted.
- The confirmed `description_json` keys match the route's actual section labels. If the route renders `Other`, `Rarity`, or another unexpected group while the notes are written for different sections, the page fails final edit.
- The confirmed card/table fields match the route's actual rendered fields. If the cards are still showing raw descriptions, raw `pros`/`cons`, nested stats, source HTML, vague meta text, or unexplained yes/no values, the page fails final edit even if the prose is good.
- `controls_json` is researched, source-noted, accurate, and not empty for a completed wiki page.
- Only include fields the destination table owns.

## Page-Specific Final Checks

### Code Page

- The output writes only `games` row fields. It does not include a manual `codes` array, `expired_codes`, code names, `first_seen_at`, or code dates.
- `slug` is the editorial game slug only, such as `wizard-alchemy`, with no `-codes` suffix.
- `slug` is not copied from `roblox_universes.slug`; universe slugs are stats-only identifiers and may include universe IDs.
- `roblox_link` is the Roblox experience URL.
- `source_url` is the RobloxDen codes page URL and `source_url_2` is the Beebom codes page URL.
- `seo_title` is empty or null unless the user explicitly asked for a custom value.
- `seo_description`, `intro_md`, `rewards_md`, `troubleshoot_md`, and `find_codes_md` are evergreen. They do not include active code names, exact dates, month/year labels, active-code counts, or freshness claims such as `latest`, `current`, `fresh`, or `updated daily`.
- `rewards_md` may use a table, but the table explains durable reward types and player use. It must not map current code names to rewards.
- The completion note confirms that live code rows must come from `npm run refresh:codes -- --slug <game-slug>`, not from manual entry.

### Events Page

- The output writes only evergreen `events_pages` fields.
- `content_md` does not contain manual current/upcoming/past event rows, live status, exact live dates, current reward timelines, or one-off current event claims.
- Public copy does not use stale wording such as `latest event`, `current event`, or "updated" promises that automation cannot support.
- Research notes confirm timeline data comes from `roblox_virtual_events` or another approved importer, or the page is marked `blocked` / `do not create`.

### Catalog

- `intro_md` explains what the collection is in the game.
- `research-notes.md` includes local item count, source count, rendered count, title count, image coverage, and any missing/extra/stale items.
- `research-notes.md` includes the player-usefulness gate, required fact matrix, and competitor/source coverage check when search competition matters.
- The page answers what the player can do after reading it.
- If the data audit found missing items or missing images, the local dataset/image wiring was updated or the remaining gap was explicitly accepted.
- If the page is sectioned, research notes record the confirmed section style before final writing.
- Research notes record the confirmed card data shape before final writing: fields to show, fields to hide, and route changes needed.
- Research notes record the confirmed title promise before final writing, including what content coverage is required to satisfy it.
- The confirmation is explicit. A note saying the user asked to write the page is not section-style confirmation.
- The route's actual section labels have been checked against `description_json`.
- The route's actual card/table fields have been checked against the approved card data plan.
- Cards and tables contain clean comparison data, not raw prose, raw arrays, nested objects, HTML, or unlabeled yes/no values.
- `description_json` explains the confirmed sections in concise player language when section notes are used.
- `description_md` gives whole-page context about mechanics, obtainment, value, availability, or player mistakes without repeating section-level notes.
- `description_md` includes at least one clear action section, such as how to get, find, unlock, farm, grow, hatch, roll, craft, equip, travel, compare, or use the items, unless research notes explain why the collection is passive.
- `how_it_works_md` explains how to understand the item data in gameplay terms, not as field commands.
- `wiki_md` is short but still concrete.
- FAQs are real player questions.

### Game Catalog

- The copy reflects local dataset fields and real item examples.
- The copy reflects the final local dataset after any approved data update, not the stale dataset from the start of research.
- The copy and cards reflect source-backed facts required by the player task, such as prices, currencies, shops, damage, chances, upgrade paths, locations, requirements, limits, roles, or availability when those facts are central to the page.
- The title count, dataset count, and rendered card count align or have a written reason for the difference.
- The title is not only a generic wiki label unless the collection is truly a simple list. It should reflect the strongest player intent, and the page should deliver that promise in detail.
- Images are present when expected, or the missing image count is recorded and accepted.
- Confusing fields are defined in gameplay terms.
- The item-card section style is based on real in-game meaning, not only the easiest dataset sort.
- The item-card data shape is based on player usefulness, not on whatever fields happen to exist in the dataset.
- `description_md` has enough depth when the system needs it. Do not compress complex systems into two vague paragraphs.
- The FLOW pass has rewritten awkward section order, random headings, and choppy transitions before final edit.
- The page teaches the collection before asking the reader to compare values.
- A multi-page job only starts after one approved gold-standard page.

### Wiki

- The hub orients the player around the game loop and important systems.
- `research-notes.md` records the rendered wiki contract: which visible sections come from `wiki_pages`, linked `roblox_universes`, and related page tables.
- The visible game summary from `roblox_universes.game_description_md` is useful, or the reason it is intentionally blank is recorded.
- The wiki answers what the game is, what a normal session looks like, which systems matter, and what a new or returning player should check first.
- Tips are specific enough to be useful.
- Controls are researched and filled when the wiki is completed. If accurate controls cannot be verified, the wiki is blocked or needs controls research; it is not complete.
- Related codes, events, catalogs, tools, articles, checklists, quizzes, media, badges, passes, servers, and developer sections have been checked for local existence.
- Related sections can carry live detail, but the wiki copy must still give context.
- The wiki output does not include catalog-page fields such as `wiki_md`; those belong to the catalog or game-catalog workflow.
- If related catalog blurbs are weak, the fix is a separate catalog-page rewrite, not a wiki-page rewrite.
- Local DB readback confirms the saved `wiki_pages` row and the linked `roblox_universes` row.
- Local render verification confirms the title, metadata, game summary, tips, controls, related sections, and images when applicable.

### Article

- The first paragraph gives useful context immediately.
- The topic is focused and evergreen, not generic news, current event coverage, codes troubleshooting, broad beginner content, or a catalog/wiki duplicate.
- Research notes include an overlap check against codes, events, wiki, catalogs, tools, checklists, and quizzes.
- The article has source-backed claims where needed.
- The visible title is natural, SEO-friendly, and not a flat database label. Keep the main keyword near the front, and use a short outcome phrase when it helps the reader understand why to open it.
- `author_id` is set before import. If no author was specified, the importer should randomly choose one from `authors`.
- `cover_image` is an edited article feature image, not a raw game thumbnail, unless the reason is recorded.
- The feature image is injected into `content_md` before the first H2 when the article uses the generated article visual style.
- The `/articles` card and `/articles/<slug>` detail page show the same author name and same edited cover after import or revalidation.
- Headings fit the story and reader flow.
- Paragraphs do not jump between unrelated points too quickly.
- `sources` includes the important URLs.
- `tags` are useful for grouping, not decoration.

### Tool

- The intro says what input/result the tool gives and why it matters.
- `how_it_works_md` explains the formula, assumptions, or user flow in plain language.
- FAQs answer real calculation, input, assumption, or result questions.

### Checklist

- The output includes a `checklist_pages` shaped page row and `checklist_items` shaped task rows.
- The slug is the editorial game slug only, such as `wizard-alchemy`.
- The slug is not copied from `roblox_universes.slug`.
- The visible title is spelled correctly and usually follows `<Game> Checklist`.
- `seo_description` and `description_md` are not empty for a new checklist.
- Parent section rows use `section_code` depth 1, subsection rows use depth 2, and checkable tasks use depth 3 or deeper.
- Parent rows have useful descriptions that explain the player-facing purpose of the section.
- Leaf task titles are concrete actions a player can complete.
- Leaf task descriptions are compact and useful when present.
- No `title` value starts with a Markdown bullet or decorative prefix.
- The leaf task count matches the planned size or has an intentional reason for being larger or smaller.
- Local Supabase readback confirms `item_count` and `leaf_item_count`.
- The local `/checklists/<slug>` route and `/checklists` index have been rendered before the checklist is called complete.

### Quiz

- The output includes a `quiz_pages` shaped metadata row when page metadata changes and a valid `QuizData` pool when questions change.
- The code is the editorial game slug only, such as `wizard-alchemy`, with no `-quiz` suffix.
- The code is not copied from `roblox_universes.slug`.
- `description_md` is compact and useful; it should not become a separate guide or answer key.
- The detail route does not reintroduce a “what this quiz covers” / about section.
- Each difficulty has enough questions for the intended public attempt. Current Bloxodes quiz attempts use 5 easy, 5 medium, and 5 hard questions, so keep at least 10 per difficulty when possible.
- Easy questions are beginner-friendly and not trick questions.
- Medium questions require real game familiarity.
- Hard questions are genuinely pro-level and supported by checked facts, such as exact values, drops, formulas, thresholds, route comparisons, or multi-step reasoning.
- Question rhythm is varied in a natural way. Normal `What`, `Which`, `Who`, and `Where` questions are allowed, but the pool should not collapse into one repeated sentence shape.
- Every question has four clean options, every `correctOptionId` exists in its question, and distractors are plausible without being ambiguous.
- Answer options are balanced inside each question. The correct answer must not be the unique obvious longest or most detailed option, and short joke-like distractors must be rewritten into plausible same-system alternatives.
- The local `/quizzes/<slug>` route and `/quizzes` index have been rendered when metadata or question pools change.

## Completion Rule

Do not call content ready unless:

- `research-notes.md` has real human topic research before implementation notes.
- Catalog and game-catalog research includes a resolved data and image audit.
- Catalog and game-catalog research includes a resolved player-usefulness gate and required fact matrix.
- Catalog, game-catalog, article, and tool pages with body copy have gone through the FLOW pass.
- `final.json` is valid JSON in the target table shape.
- Public copy passes the hard blockers.
- Important terms are defined or naturally clear.
- Any remaining uncertainty is recorded in `research-notes.md`.
- Wiki pages have rendered-field proof, companion universe-description proof or an explicit blank decision, related-section proof, local DB readback for `wiki_pages` and linked `roblox_universes`, and local page proof before the work is called complete.
- Catalog and game-catalog pages have explicit data-state confirmation, explicit section confirmation, explicit card-data confirmation, rendered-count proof, rendered-section proof, rendered-card proof, image proof when images matter, local DB readback after import, and local page proof before the work is called complete.
