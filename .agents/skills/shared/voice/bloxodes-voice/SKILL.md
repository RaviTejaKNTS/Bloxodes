---
name: bloxodes-voice
description: The Bloxodes house voice for every public word we publish. Read it before writing, editing or reviewing any page copy (articles, wiki hubs, collections, catalogs, codes, quizzes, checklists, events, tools, titles, meta descriptions, FAQs) and before writing a research brief a writer will use.
---

# Bloxodes Voice

Bloxodes sounds like your friend who has put way too many hours into the game. They know the answer, they give it to you fast, and they explain the tricky part like they're sitting next to you on the couch. Relaxed, sharp, a little fun, never a manual.

That's the whole voice. The rest of this guide is how to hit it on every page.

Quick taste of the difference:

> **Robotic:** The Ember Compass is a rare crafting item in Ember Isles. Players must complete prerequisite crafts in order to access the recipe.
>
> **Bloxodes:** Want into the Ash Vault? You need an Ember Compass, and Mara won't even show you the recipe until you've done her first two crafts. Here's the fastest way through all three.

Same facts. One sounds like a wiki stub, the other sounds like a player who wants you to win.

Most game names, NPCs and numbers in this guide and its examples are made up. Treat every example as a writing move, never as a game fact.

## What we want

- **Answer first.** The first two sentences should tell the reader something they came for. Background can wait.
- **Plain words, short sentences.** A 12-year-old and a 30-year-old should both get it on the first read. If a game term needs explaining, explain it right there in a few words.
- **Talk to "you."** Use contractions. Write the way you'd say it in voice chat, minus the "um."
- **Real game nouns.** The NPC's name, the button, the price, the island, the drop rate. Specific beats clever every time.
- **A bit of spark.** One good line in a section beats a joke in every sentence. The fun comes from a sharp, true observation about the game ("Range is a weird first buy: you get to stand farther from a stack you're still feeding one block at a time"), not from exclamation marks or big adjectives.
- **Opinions the facts can back.** "Skip it until you have the Iron Rod" helps more than "players may wish to consider." Be decisive when the evidence is clear.
- **Help with what comes next.** Think one step ahead: what goes wrong, what it costs, where to go after. That's what makes a guide feel like it was written by someone who plays.
- **Varied rhythm.** Mix short sentences with medium ones. Start paragraphs differently. Read it back and make sure it doesn't sound like a list wearing a paragraph costume.

## What we never want

| Never | Looks like | Do this instead |
| --- | --- | --- |
| Template openings | "Welcome to...", "In this guide, we'll...", "Are you looking for...", "X is a popular Roblox game where...", "If you're a fan of..." | Open on the answer, the problem or the payoff (see Openings). |
| Manual voice | "Players can utilize the menu to...", "This feature allows users to...", "The system provides..." | "Open the menu and..." Say what the player does. |
| Research voice | "according to sources", "is reported to", "community-documented", "launch-day guides describe", "it's unresolved whether", "a common tip, not a studio rule" | State what's known. Put a real doubt in plain words, once (see Uncertain facts). |
| Hype | ultimate, insane, epic, amazing, must-have, game-changer, unleash, dive in, embark, look no further, take your game to the next level | Let a concrete detail do the work. |
| AI filler | Additionally, Furthermore, Moreover, It's worth noting, It's important to note, In conclusion, Overall, "not just X but Y", "whether you're a beginner or a pro", "the world of" | Cut it. The sentence almost always works without it. |
| Fake experience | "When I played...", "In our testing...", "We spent hours..." | Use the facts you have. Never invent a session, test or result. |
| Forced fun | stacked puns, a quip in every paragraph, emoji, "!!!" | One light line wrapped around a real fact, or none. |
| Self-reference | "Bloxodes", "this page", "this catalog", "this dataset", "our list", "use the cards below" | Talk about the game. (An article can say "this guide" once if it helps.) |
| Process talk | sources, briefs, research, datasets, manifests, workflows, checks we ran | Keep it in the brief. Readers only see the game. |
| Em dashes | "the boss — and its loot —" | Use a comma, colon, parentheses or two sentences. This applies to every field, including titles, FAQs and alt text. |
| Freshness claims on evergreen pages | latest, current, fresh, new, updated daily, "this month" | Codes and events pages stay timeless. Scripts own the live data. |
| Repeats | intro, body and FAQ all saying the same thing | Give each fact one home. |

A few game terms happen to use banned words (Dandy's World's Research, GTA's Source Cargo). Those are fine. The repo checker `scripts/content/check-public-copy.ts` also blocks "this catalog/page/dataset" wording, "Bloxodes" in copy, and "not just/not only".

## Openings

The opening is where templated writing shows the most. Pick whichever of these fits the topic, and don't use the same one on every page.

1. **Hand over the answer.** "Bulk Pickup is the first upgrade worth buying. Every other upgrade is wasted while you're still carrying one block per trip."
2. **Name the wall the player hit.** "Reached the Ember trainer but the training option is grayed out? You skipped Mara's harbor delivery."
3. **Lead with the payoff.** "The Storm Rod doubles your catch rate during rain, and in Ember Isles it rains a lot."
4. **Lead with a surprising true fact.** "The cheapest pet in Garden Rush has the best sell bonus in the game. Nobody buys it."

What to avoid:

- Restating the title: "To get the Ember Compass, you need to complete the Ember Compass questline."
- Throat-clearing about the game's popularity, Roblox in general, or what the page will cover.
- A one-line changelog: "Update 12 adds a new island, a new rod and bug fixes."
- Teasing without telling: "There's a secret most players miss..." (then three paragraphs later, the secret).

After the hook, a sentence or two of useful context is welcome. Then get into it.

## Titles, headings and SEO

SEO and voice aren't fighting. Search engines and readers want the same thing: a page that clearly answers the question someone typed.

**Titles** lead with the exact thing people search for, including the game name. Add a short hook only if it's useful and there's room.

| Templated | Better |
| --- | --- |
| Ember Isles Ember Compass Guide: Everything You Need to Know | How to Get the Ember Compass in Ember Isles |
| The Ultimate Garden Rush Pet Guide | Best Pets in Garden Rush, Ranked by Sell Bonus |
| Tower Brawl Update 7: All New Features and Changes | Tower Brawl Update 7: Frost Units, New Map and Every Balance Change |

**Meta descriptions** are one or two plain sentences: what the reader gets, plus a reason to click. Aim for roughly 140 to 160 characters. No "Learn everything about..." and no keyword lists.

> Weak: "Learn everything about the Ember Compass in Ember Isles, including how to get it and more."
> Better: "Mara won't show the Ember Compass recipe until you finish two other crafts. Here's the full route, every material and where to farm it."

**Headings:**

- Main H2s say what the section answers in words a player would search: "How to Unlock Crafting in Ember Isles", "Ember Compass Materials and Where to Farm Them", "Magnet Fruit Moveset in Blox Fruits".
- Use the game name where it makes a natural search phrase, usually in the first few main H2s. Don't paste it onto every heading.
- Under a clear H2, H3s can be short: "Magnetic Pull", "Tier 2 Recipes".
- Mix the shapes. If every heading is "How to X in Game," the page reads like a form. Use action headings, plain topic headings and the odd question, whatever fits each section.
- No dead labels: Overview, Introduction, Details, Key Features, Final Thoughts, Conclusion, a bare "Tips and Tricks."
- No cute headings that hide the topic: "The Plot Thickens", "Let's Get Cooking."

| Templated or vague | Better |
| --- | --- |
| Overview | What Changed in Tower Brawl Update 7 |
| How to Get Materials in Ember Isles / How to Craft in Ember Isles / How to Use the Compass in Ember Isles | Where to Farm Cinder Shards / Crafting the Ember Compass / What the Compass Unlocks |
| Abilities | Storm Rod Abilities and Controls |
| Final Thoughts | (cut it, or end on a useful last section) |

## Sentences that read clean

Most robotic copy comes from long sentences stuffed with abstract nouns. Break them up and put a person and an action in each one.

> Robotic: "Upon completion of the prerequisite quests, the player will gain access to the vendor's expanded inventory, which includes several rods."
>
> Clean: "Finish both harbor quests and the vendor opens up. That's where the better rods are."

> Robotic: "The utilization of Bulk Place results in a reduction of the number of placement actions required."
>
> Clean: "Bulk Place drops more blocks per click, so you spend less time at the stack."

Quick habits:

- One idea per sentence. Two at most.
- Verbs over nouns: "craft" not "the crafting of," "upgrade" not "perform an upgrade."
- Cut words that add nothing: "in order to" becomes "to," "is able to" becomes "can," "at this point in time" becomes "now."
- Read it out loud in your head. If you'd run out of breath or sound like a terms-of-service page, rewrite it.

## Turning the energy up and down

Personality lives in some places and stays out of others.

| Where | Energy | Notes |
| --- | --- | --- |
| Intros, wiki descriptions, collection intros, recommendation prose, blurbs | Up | The hook, a sharp observation, an opinion. |
| Guide body, explanations, FAQ answers | Medium | Friendly and clear. A light line now and then. |
| Steps, table cells, card fields, checklist tasks, quiz questions and options, tool labels | Plain | Short and exact. No jokes where someone needs one precise answer. |
| Troubleshooting, errors, crashes, account or safety topics | Calm | The reader is stressed. Help first, wit off. |
| Titles and meta descriptions | Search first | Clear wording that matches the query, with a small hook if it fits. |

## Uncertain facts

Some facts are fuzzy: estimated drop rates, a timer nobody has confirmed, a price that changed in a patch. Say what the reader needs once, in plain words, next to the advice it affects. Never narrate the research.

| Sounds like a research report | Sounds like a player |
| --- | --- |
| "Current community-documented behavior suggests an approximately ten-minute duration. This is not an official timer." | "The portal stays open for about ten minutes, and leaving the area can close it early. Get your group ready first." |
| "Bulk Pickup's first Coin price is not settled, so pay what the panel shows." | "Bulk Pickup's first price can vary, so check the stall before you save up." |
| "Launch-day guides also describe offline crafting." | "Crafts keep running while you're offline." (If the brief verifies it. If it doesn't, leave it out.) |
| "A common tip, not a studio rule, is Bulk Pickup first." | "Most players grab Bulk Pickup first, and it's the right call: it speeds up every trip." |
| "Times and costs below follow launch-day guides. Double-check after patches." | "Patches sometimes tweak these numbers, so trust the in-game menu if one looks off." (Once per page, only if it matters.) |

Rules of thumb:

- If a fact is solid, state it. Don't hedge solid facts.
- If a fact is shaky but matters, give the best number and one short, useful caveat.
- If a fact is shaky and doesn't matter, leave it out.
- If the central answer is missing, don't write around it. Send it back to research.
- Never say who said it ("sources say," "players report," "the wiki lists"). Readers don't care where the fact came from, only whether they can use it.
- The exceptions are credit and attribution that help the reader. Crediting the developer or an official announcement ("the developer confirmed a fix is coming") is fine. In news and data reports, attribute company figures and any allegation to whoever made them ("Roblox says...", "the lawsuit claims..."). That's accuracy, not process talk. The monthly Roblox report's methodology endnote is the one place a page explains how its numbers were gathered.

## Formatting

- **Short paragraphs.** Two to four sentences is the comfortable range. Split when the idea changes.
- **Tables** for things people compare (prices, stats, drop rates, controls). Say what to look for before the table, and add a line after it if there's a useful takeaway. Don't narrate every row.
- **Numbered steps** for things done in order. One action per step.
- **Bullets** for parallel facts. Not for everything.
- **Bold** sparingly: a key item name in a long step, or the one warning that matters. If half the paragraph is bold, nothing is.
- **No walls of text** and no one-line paragraphs stacked ten deep.

## Facts and honesty

- Every fact comes from the approved brief or data. The voice never adds facts.
- Opinions must follow from facts. "Bulk Pickup first, because every other upgrade waits on it" is fine. "This is the best game on Roblox" isn't.
- First person ("I'd skip it early") is fine now and then for a quick opinion. Never use it to claim play time, tests or results that didn't happen. "We" never means Bloxodes.
- Use American English. Dates look like "September 5, 2026." Times are 12-hour with Eastern first, Pacific when it helps: "2 p.m. ET (11 a.m. PT)." Convert with date-aware time zones, not fixed EST/PST offsets.
- Codes and events pages stay evergreen: no code names, counts, dates or "latest" claims in prose.

## Before you hand it in

Read the whole thing as a player who just searched the title. Then check:

1. Do the first two sentences give me something I came for?
2. Would a player actually say these sentences to a friend?
3. Does every heading tell me what's under it, and do they avoid one repeated pattern?
4. Is there anything here that sounds like a report, a manual or a sales page?
5. Did I say any fact twice (intro, body, table, FAQ)?
6. Is every caveat useful, said once and in plain words?
7. Any em dashes, hype words, filler words or self-references?
8. Does it end on something useful (the next step, the choice, the payoff) and not a recap?

## Page-type examples

[references/examples.md](references/examples.md) has before/after examples for every page type: article intros and sections, troubleshooting, tier lists, best-games picks, wiki hubs, collections, catalogs, codes, quizzes, checklists, events, tools and FAQs. Read the section for your page before drafting. Learn the move, then write your own words. Don't reuse the example sentences.

Each page-type writing skill still owns its fields, output shape and data rules. This guide owns how the words sound.
