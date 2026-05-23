# Bloxodes Final Edit

Use this as a mandatory quality gate during the same writing workflow and again before writing to local Supabase.

The final edit is internal. It does not create `review.md`; it either improves `final.json`, marks the work blocked, or records unresolved risk inside `research-notes.md`.

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
2. Confirm the page type and target fields.
3. For catalog and game-catalog pages, confirm the data and image audit exists and is resolved.
4. Confirm the FLOW pass happened when the page has `description_md`, `how_it_works_md`, article body, or tool explanation.
5. Remove generic opening lines.
6. Remove unsupported claims.
7. Cut repeated ideas across fields.
8. Replace broad field claims with exact game or dataset details.
9. Keep the useful answer close to the top.
10. Add missing context where the copy jumps too quickly between mechanics, fields, or item groups.
11. Split paragraphs that mix unrelated concepts.
12. Check headings are clear sentence-style fragments, not rigid one-word labels.
13. Check Markdown and JSON are valid.
14. Check the final output can be pasted or upserted without reshaping.

## Understanding Questions

For every paragraph, ask:

- Does this teach the game system, tool result, article topic, or item group?
- Could a reader explain the idea back after reading it once?
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
- catalog or game-catalog final copy that skipped the FLOW pass
- catalog `description_md` that repeats card-section notes instead of explaining the whole collection or mechanic
- catalog `description_md` with no useful action/use/how-to section when the collection has a clear player action behind it
- random headings that do not create a clear reader path
- count-based titles that disagree with local dataset or rendered card counts without an intentional explanation
- fake authority such as `players say`, `experts believe`, or `reports suggest` without a named source
- inflated wording such as `serves as`, `stands as`, `pivotal`, `underscores`, `showcases`, `evolving landscape`
- vague tails such as `highlighting its importance`, `making it valuable`, `ensuring a smoother experience`

For `wiki_md`, also fail if the line reads like a link-card caption instead of a game-system explanation.

## Markdown Checks

- Clean paragraph breaks.
- Sentence-case headings.
- Headings should usually explain what the section covers, not use one-word labels such as `Sources`, `Value`, `Tips`, or `Overview`.
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
- For catalog and game-catalog pages, the data and image audit in `research-notes.md` is resolved before import. Missing items, stale fields, and image gaps must be fixed or explicitly accepted.
- The confirmed `description_json` keys match the route's actual section labels. If the route renders `Other`, `Rarity`, or another unexpected group while the notes are written for different sections, the page fails final edit.
- The confirmed card/table fields match the route's actual rendered fields. If the cards are still showing raw descriptions, raw `pros`/`cons`, nested stats, source HTML, vague meta text, or unexplained yes/no values, the page fails final edit even if the prose is good.
- `controls_json` is filled only when controls are known and useful.
- Only include fields the destination table owns.

## Page-Specific Final Checks

### Code Page

- The output writes only `games` row fields. It does not include a manual `codes` array, `expired_codes`, code names, `first_seen_at`, or code dates.
- `slug` is the game slug only, such as `wizard-alchemy`, with no `-codes` suffix.
- `roblox_link` is the Roblox experience URL.
- `source_url` is the RobloxDen codes page URL and `source_url_2` is the Beebom codes page URL.
- `seo_title` is empty or null unless the user explicitly asked for a custom value.
- `seo_description`, `intro_md`, `rewards_md`, `troubleshoot_md`, and `find_codes_md` are evergreen. They do not include active code names, exact dates, month/year labels, active-code counts, or freshness claims such as `latest`, `current`, `fresh`, or `updated daily`.
- `rewards_md` may use a table, but the table explains durable reward types and player use. It must not map current code names to rewards.
- The completion note confirms that live code rows must come from `npm run refresh:codes -- --slug <game-slug>`, not from manual entry.

### Catalog

- `intro_md` explains what the collection is in the game.
- `research-notes.md` includes local item count, source count, rendered count, title count, image coverage, and any missing/extra/stale items.
- If the data audit found missing items or missing images, the local dataset/image wiring was updated or the remaining gap was explicitly accepted.
- If the page is sectioned, research notes record the confirmed section style before final writing.
- Research notes record the confirmed card data shape before final writing: fields to show, fields to hide, and route changes needed.
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
- The title count, dataset count, and rendered card count align or have a written reason for the difference.
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
- Tips are specific enough to be useful.
- Related sections can carry live detail, but the wiki copy must still give context.
- The wiki output does not include catalog-page fields such as `wiki_md`; those belong to the catalog or game-catalog workflow.
- If related catalog blurbs are weak, the fix is a separate catalog-page rewrite, not a wiki-page rewrite.

### Article

- The first paragraph gives useful context immediately.
- The article has source-backed claims where needed.
- Headings fit the story and reader flow.
- Paragraphs do not jump between unrelated points too quickly.
- `sources` includes the important URLs.
- `tags` are useful for grouping, not decoration.

### Tool

- The intro says what input/result the tool gives and why it matters.
- `how_it_works_md` explains the formula, assumptions, or user flow in plain language.
- FAQs answer real calculation, input, assumption, or result questions.

## Completion Rule

Do not call content ready unless:

- `research-notes.md` has real human topic research before implementation notes.
- Catalog and game-catalog research includes a resolved data and image audit.
- Catalog, game-catalog, article, and tool pages with body copy have gone through the FLOW pass.
- `final.json` is valid JSON in the target table shape.
- Public copy passes the hard blockers.
- Important terms are defined or naturally clear.
- Any remaining uncertainty is recorded in `research-notes.md`.
- Catalog and game-catalog pages have explicit data-state confirmation, explicit section confirmation, explicit card-data confirmation, rendered-count proof, rendered-section proof, rendered-card proof, image proof when images matter, local DB readback after import, and local page proof before the work is called complete.
