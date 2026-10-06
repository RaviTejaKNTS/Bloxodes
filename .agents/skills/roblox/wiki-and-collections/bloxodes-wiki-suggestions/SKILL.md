---
name: bloxodes-wiki-suggestions
description: Suggest Bloxodes wiki hub page opportunities for one Roblox game. Use when the user asks whether a game should have a /wiki/<game-slug> hub page before writing it.
---

# Bloxodes Wiki Suggestions

Use this to decide whether Bloxodes should create or skip a wiki hub page for one Roblox game. Do not write the page here.

## Start

1. Resolve the exact game: name, universe ID, root place ID, creator, official Roblox URL, and editorial slug.
2. Check existing Bloxodes `wiki_pages` for that universe ID. Do not recommend a page we already cover.

## Source Check

Search broadly enough to understand the game. Use public sources that explain the core loop, progression, controls, systems, and player questions.

Do not hide the research in a file. Put the proof in the final reply:

```text
Evidence checked:
- Bloxodes existing wiki page:
- official Roblox page:
- creator/update sources:
- BloxInformer:
- Fandom/game wiki:
- guide sites:
- keyword searches:
```

If the source check is incomplete, do not decide. Return `[source discovery incomplete]` with the missing checks.

## What Counts

Recommend a wiki hub only when the game has enough stable gameplay information to help players beyond a short article.

Skip games with thin public information, mostly temporary content, or only code/update interest.

## Output

Start with `Evidence checked`, then return only wiki hub recommendations:

- `[create]` stable game wiki hub with enough source evidence
- `[we already have a page]` production already covers it
- `[skip]` weak, temporary, already better handled by another page type, or not enough source-backed gameplay information
- `[source discovery incomplete]` required source checks were not completed

Keep the answer short and include the source proof that supports the decision.
