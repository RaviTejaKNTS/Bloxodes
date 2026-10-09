# Bloxodes Article Standard

This is the article layer on top of the house voice. Read the voice guide first: `.agents/skills/bloxodes-voice/SKILL.md` (examples in `references/examples.md`). It covers how articles sound. This file covers what a good Bloxodes article has to deliver. It applies to research, writing, editing and review. Specialized skills (tech, tier list, best games, monthly report) add their own data, media and block rules on top.

None of this is a template. Pick the outline, heading mix, opening and ending that fit the topic. If two of our articles on different topics have the same shape, ask whether the second one really needed it.

## The reader comes first

Before outlining, answer three questions for yourself:

1. What did the reader search for?
2. What do they already know?
3. What should they be able to do or decide when they finish?

Everything in the article serves those answers. Write for a US audience in American English.

## Title and opening

- The title names the exact topic and what the article delivers, in the words people search. Game-specific articles include the game name. If a proposed title promises something the evidence can't deliver, fix the title. Don't apologize for it in the body.
- On refreshes, keep the existing slug unless a route change is approved.
- The opening gets to the point: the change, the goal or the obstacle, plus a reason to care. A few connected sentences of useful context are welcome. Then a natural lead-in to the rest.
- Key highlights, "At a glance" boxes and quick-answer blocks are optional tools. Use one only when it helps people scan, and don't repeat it in the next paragraph.
- Repeating the title as a sentence ("To unlock X, complete its questline") is not an opening.

## Structure and headings

- Give each subject one home. Order sections the way the reader needs them: by player priority for updates, by prerequisites then actions for how-tos, by quick fixes first for troubleshooting.
- Main H2s use real search language and make sense on their own: "Blox Fruits Update 30 First Sea Rework", "How to Get the Ember Compass in Ember Isles", "Magnet Fruit Moveset in Blox Fruits". Name the game where it forms a natural search phrase, but don't stamp it on every heading.
- Under a clear H2, H3s can be short ("Magnetic Pull", "Tier 2 Recipes"). Keep capitalization consistent and leave off trailing periods.
- Vary heading shapes. A page of identical "How to X in Game" headings reads like a form.
- Only promise "every" or "all" when the section really has all of them.
- A separate event, progression system or reward mechanic gets its own section. Don't bury it to save a heading.

## Depth

- There's no word target and no brevity target. Match depth to the promise and the evidence. A big update deserves several full sections. A simple answer can be short.
- Develop each subject until it answers the next obvious question: how does it work, where do I go, what do I press, what happens if I hold it, what do I get, what can go wrong.
- Name the real NPCs, landmarks, controls, costs, rewards and exceptions the brief supports. "Adds stronger attacks and better movement" isn't enough when the brief says exactly what changes.
- A how-to explains every required stage through the final result. "Follow the current objectives" or "complete the questline" never replaces the actual tasks. If the brief doesn't have them, send it back to research.
- Cut filler, not explanation.

## Prose, tables, steps and lists

- Tables for comparable facts. Numbered steps for ordered actions. Lists for parallel facts. Prose for explaining.
- Set up a complex table with a sentence about what matters, and add a takeaway after it when there is one. Don't re-read every row.
- Every table row must fit its column, and every column must add something new. A "Why it matters" column has to state a real consequence. If there's little to compare, write a short paragraph instead.
- Include tap and hold differences, conditions and outcomes in the cells instead of squeezing different behavior into vague wording.
- A troubleshooting section has to add a new clue, failure case or fix. Repeating the prerequisites under a new heading doesn't count.
- Write player actions, not process labels: who to talk to, what to collect, what unlocks next. Never "gates," "sequences" or "reward interactions."
- Connect ideas that depend on each other: the prerequisite before the recipe, the meter before the move that spends it, the reward before the advice on whether it's worth it.

## Endings

A substantial article lands on something useful: the next move, the choice that's left, or what the reward lets you do. A separate "Conclusion" heading is usually unnecessary. A closing question is optional and only works if it invites something relevant. Short answers can just stop when they're done.

## Evidence and uncertainty

- Research confidence stays in the brief. The article says what's known in plain words.
- If release status matters (announced, in testing, live), set it once near the top and keep tense consistent.
- "The developer hasn't announced this" needs evidence. Not being able to load a page only means research couldn't check it.
- A community source isn't a reason to hedge every sentence. Hedge only real conflicts, estimates or version limits that change the advice, once, next to that advice. Don't remove real uncertainty to make the copy smoother, and don't present weak evidence as fact.
- Resolve central missing facts before writing. If the promise has to shrink, the title, meta description, opening and body all have to reflect it.
- Developer credit and verified official links are fine. Narrating the research, database checks or approvals is not. See Public Copy in root `AGENTS.md` and the voice guide.
- Study the best competing articles for the questions they answer, how they're organized and how deep they go. Write independently from verified facts. Never copy their prose or unsupported claims.

## Using the brief's details

When the brief gives a useful named event, tool, condition or option, use it where it helps the reader act. Don't swap it for generic advice about goals or bonuses. For "when to use" topics, timing details often matter more than another warning. You don't have to use every researched detail. Leave out background that doesn't help.

## Dates and times

- Written US dates: "September 5, 2026." 12-hour times: "2 p.m. ET."
- For verified releases or events, give Eastern Time first and Pacific when useful. Convert with date-aware `America/New_York` and `America/Los_Angeles` zones, checking daylight saving and date rollovers. Never assume EST or PST year-round.
- Don't default to the author's, server's or agent's time zone. IST only belongs in a deliberately international schedule.
- Leave out unverified exact times. A public "checked at" time only belongs on a live-status question where it really helps, in ET.

## Links

- Link to verified existing Bloxodes pages where they help with the mechanic, requirement, choice or next step being discussed. Put the link on words already in the sentence. No minimum count, no closing link list, no invented URLs.
- "This guide" or "this article" is fine once for orientation. Never use it in place of an answer. Avoid catalog or database self-description.

## FAQs

`faq_json` renders a visible FAQ after the body and supplies FAQ structured data. It's the only place FAQs go. Never add an FAQ section to `content_md`. Keep a question only if its answer adds something the body doesn't already say. A complete body often means `faq_json: []`.

## Benchmark

The [Beebom study](beebom-style-study.md) shows how strong Roblox guides cover search intent, structure and depth. Use it for structure and coverage. Our voice comes from the voice guide, not from Beebom.

## Final review

Before calling an article done:

- Read it as the player who searched the title. Does the opening help right away? Do the main headings name the game and the intent? Does each explanation anticipate the next question?
- Run the voice guide's "Before you hand it in" check.
- Check tables, transitions, supported advice and the ending. A correct outline with thin sections or a list-like voice is not done.
- Cut forced humor, repeated caveats, decorative links and FAQs that repeat the body.
- JSON, media, route and browser checks are separate. Passing them doesn't mean the article explains its topic well.
- Approved-brief articles get [one editorial revision](editorial-review.md): specific feedback, revised copy, a final read. Keep facts and media. Prose fixes don't trigger new research. Focused factual refreshes keep their narrow scope.
