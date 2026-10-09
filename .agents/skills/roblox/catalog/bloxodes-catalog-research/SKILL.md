---
name: bloxodes-catalog-research
description: Research one approved global Bloxodes catalog page before writing. Use for catalog_pages production overlap, data/source state, item count, useful fields, image support, reader need, facts to use, facts to avoid, and gaps. Do not write final.json.
---

# Bloxodes Catalog Research

You're researching one approved global `/catalog` page so the writer can start from solid, player-ready facts. You hand back a `brief.md`. You don't write `final.json`.

## Output

```text
tmp/content-workspace/<topic-slug>/catalogs/<catalog-code>/brief.md
```

## Research steps

1. Check production for existing catalog coverage. Search by code, title, route, source URL and synonyms.
2. Look at the current row, local dataset, item examples, images and rendered route behavior when they're available.
3. Verify data and source quality, item count, useful fields and image support.
4. Decide what the page needs to explain beyond the item cards.
5. Find the closest successful Bloxodes page in the same search family. Record its exact browser-title pattern, H1 pattern, metadata structure and heading outline. Copy the pattern, not its unrelated wording.
6. Decide whether item counts and freshness values are stable enough for metadata. Don't lead the H1 with a value that can change after a refresh.

## Writing the brief for the writer

The writer copies the tone of what you hand them, so make the brief easy to turn into good copy. Read `.agents/skills/bloxodes-voice/SKILL.md` first.

- **Write facts in plain player language.** "Each item shows its price and where it drops," not "dataset exposes price and source fields."
- **Name the reader's real question** in `Reader need`. What did they search for, and what do they want to do next?
- **Point out hooks worth using:** a surprising true fact, a common mistake, the thing most players get wrong.
- **Keep sources, doubts and data notes private.** Put them under `Evidence checked` or `Open gaps or risks`, not in `Facts to use`. If a fact is shaky, say so once in plain words so the writer can add one short caveat or leave it out.
- **No research jargon in reader-facing parts.** Words like dataset, rows, source coverage and provenance stay in the evidence section.

## Brief shape

```text
Evidence checked:
- Existing Bloxodes coverage:
- Source/data coverage:
- Item count:
- Useful fields:
- Image support:

Catalog plan:
- Title:
- SEO title:
- Code:
- Reader need:
- Comparable page and pattern:
- Heading plan:
- Facts to use:
- Facts to avoid:
- Hooks worth using:
- Open gaps or risks:
```
