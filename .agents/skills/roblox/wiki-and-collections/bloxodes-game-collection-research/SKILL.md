---
name: bloxodes-game-collection-research
description: Research one approved Bloxodes game collection before data or writing. Use for /wiki/game-slug/collection-slug source proof, production overlap, collection scope, item-system understanding, useful card fields, section layout, image/source gaps, and whether the collection should proceed. Do not write final.json.
---

# Bloxodes Game Collection Research

You're researching one approved game collection so the data, image and writing stages know exactly what to build. You're done when `brief.md` shows the source proof, the scope, the fields players need, the section layout and the page type, plus any gaps.

This is research only. Don't write `final.json`.

Use the game and collection names to find their suggestions and workspace in the inherited task context, or use the default workspace below. Keep any supplied workspace override. This skill owns its stage, so don't spawn subagents. Return the stage artifacts when you're done.

## Useful coverage

Build the most accurate, up-to-date collection the sources support. Combine rows across sources, merge duplicates and leave unresolved values empty or null. Record missing rows, conflicting claims and follow-ups in the brief so the collection can improve later.

A source saying 97 items while listing 98, an incomplete roster, no official confirmation or uncertain update coverage aren't reasons to block on their own. Don't invent facts or claim complete live coverage. Block only when there truly isn't enough supported material for a worthwhile player-facing page.

## Output

Write one file:

```text
tmp/content-workspace/<game-slug>/collections/<collection-slug>/brief.md
```

## Research steps

1. **Pin down the exact game:** universe ID, official Roblox URL and editorial game slug.
2. **Check production for overlap.** Look at existing `wiki_collection_pages` in the production db for that universe so you don't duplicate a collection.
3. **Research the collection online.** Search broadly and use the strongest sources you can find: the game wiki, Fandom, BloxInformer, Beebom, Game8, Pro Game Guides, official pages, update logs and useful creator or community references.
4. **Check strong competitor pages** to learn search intent, common player questions and expected coverage. Don't copy their wording or treat their unverified claims as facts.
5. **Go past the first result.** Open useful internal links until you understand how the game system works.
6. **Decide** whether the collection is durable, useful and source-backed.
7. **Pick the fields players need,** like source, location, price, rarity, chance, requirement, damage, role, availability or effect. Those are examples. Choose fields that fit this game and this collection.
8. **Plan the sections before data work starts.** Use sections that help players compare items, not sections that just mirror source tables.
9. **Choose the page type before data work starts:**
   - `collectible` for finite, player-completed goals like collectibles, locations, quests, badges or route steps.
   - `database` for reference rosters players browse and compare.

   This is a presentation choice, not a new table or route family.

## Gather sources

The collection page gets built from the sources you find, so list every one. Later stages combine several sources to fill gaps and verify facts. If a source turned out not to be useful, note that too.

## Writing the brief for the writer

Later, a writer turns your brief into the page intro, section notes and wiki blurb. Read `.agents/skills/bloxodes-voice/SKILL.md` first so you know what the page should sound like, then give them good material.

- **Write facts in player language.** "Mythic boats only come from the Storm Crate" is ready to use. "Mythic-tier acquisition is restricted to premium crate sources" isn't.
- **Name the reader's real question.** Why does someone look up this collection? Picking the best one, finding where to get one, tracking what's left?
- **Flag hooks worth using.** The choice that matters most, a common mistake, a surprising true fact about the system.
- **Keep doubts and sources private.** Source quality, conflicts and uncertainty go in `Known gaps or risks` and the source list, not mixed into facts the writer will copy.
- **Leave research jargon out of reader-facing lines.** No "reportedly," "community-documented" or "sources say" in anything the writer might reuse.

## Brief shape

Create `brief.md` in this shape:

```text
Evidence checked:
- Existing Bloxodes coverage:
- Source coverage:
- Collection scope:
- Why this should be a collection:

Sources to use:
- Source 1:
- Source 2:
- Source 3:
- etc.

Data plan:
- Page type: `database` or `collectible`:
- Item count expected:
- Useful fields:
- Grouping:
- Image needs:
- Known gaps or risks:

Page layout plan:
- Section field:
- Section order:
- Section labels:
- Why these sections help players:
- Card title field:
- Card description field:
- Card key-value fields:
- Hidden/source-only fields:
- Image field:
- Sort order:
- Section note needs:
- Renderer/config changes needed: yes/no
- Collectible rationale and progress key: (required only for `collectible`)

Writer notes:
- Reader's real question:
- Hooks worth using:
- Key facts in player language:
```

Return a usable brief with the supported scope and known gaps. Block only when the supported material can't make a worthwhile collection.
