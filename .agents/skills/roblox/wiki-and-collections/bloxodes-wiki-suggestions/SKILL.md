---
name: bloxodes-wiki-suggestions
description: Suggest Bloxodes wiki hub page opportunities for one Roblox game. Use when the user asks whether a game should have a /wiki/<game-slug> hub page before writing it.
---

# Bloxodes Wiki Suggestions

You're deciding whether Bloxodes should create or skip a wiki hub page for one Roblox game. You're done when you return one clear call, backed by the sources you checked. Don't write the page here.

## Start

1. **Pin down the exact game:** name, universe ID, root place ID, creator, official Roblox URL and editorial slug.
2. **Check existing Bloxodes `wiki_pages`** for that universe ID. Don't recommend a page we already cover.

## Source check

Search broadly enough to understand the game. Use public sources that explain the core loop, progression, controls, systems and the questions players actually ask.

Put the proof in your final reply, not hidden in a file:

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

If the source check is incomplete, don't decide. Return `[source discovery incomplete]` with the missing checks.

## What counts

Recommend a wiki hub only when the game has enough stable gameplay information to help players beyond a short article.

Skip games with thin public information, mostly temporary content, or only code or update interest.

When you recommend `[create]`, describe the hub's angle the way a player would search it: what the game is, how it plays, what to do first. Use real search wording from your keyword checks, not a template like "Complete Guide to Everything in X."

## Output

Start with `Evidence checked`, then return only wiki hub recommendations:

- `[create]` stable game wiki hub with enough source evidence
- `[we already have a page]` production already covers it
- `[skip]` weak, temporary, already better handled by another page type, or not enough source-backed gameplay information
- `[source discovery incomplete]` required source checks were not completed

Keep it short and include the source proof behind the decision.
