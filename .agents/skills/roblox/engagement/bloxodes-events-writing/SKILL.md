---
name: bloxodes-events-writing
description: Write one Bloxodes events page final.json after brief approval. Use for /events/<game-slug> evergreen page copy backed by events_pages, metadata, source verification, and final.json output. Do not manually write timeline rows.
---

# Bloxodes Events Writing

An events page tracks one game's events over time. The importer handles the timeline. Your copy explains how events work in this game (what they usually bring, how long they last, why they're worth catching) in a way that stays true long after any single event ends.

Use this after `bloxodes-events-research` and parent approval. Timeline rows, live statuses, dates and guide links belong to `roblox_virtual_events` or another approved importer.

## Hard rules

- Never write current, upcoming or past event rows by hand.
- Never hard-code live event dates, reward timelines, statuses or active-event claims in `content_md`.
- No freshness phrases like `latest event`, `current event` or `updated daily`.
- If event data can't come from an approved importer, mark the page `do not create` or `blocked`.

## Read first

- The voice guide: `.agents/skills/bloxodes-voice/SKILL.md`, plus the "Events pages" section of its `references/examples.md`.
- The approved `brief.md`.

## Workflow

1. Read the approved brief.
2. Create or update:

   ```text
   tmp/content-workspace/<game-slug>/events/<game-slug>/
     brief.md
     final.json
   ```

3. Write evergreen page fields only.
4. Parse the JSON before returning.

## How the copy should read

- **Open on what events mean in this game.** Limited eggs, a seasonal boss, double XP weekends: whatever this game's events actually bring. "Garden Rush events usually bring a limited egg and a seed that won't be back for months."
- **Give players a reason to keep an eye out,** without pointing at a live event that will expire.
- **Talk about the game, not the page.** Never narrate how it was made. Follow Public Copy in root `AGENTS.md`.

## Field jobs

- `universe_id`: the exact game universe.
- `slug`: the editorial game slug.
- `title`: names the game's events page without hard-coding an event that will end.
- `seo_title`: close to the title unless search needs a cleaner version.
- `meta_description`: what event info players can track here, with a reason to check it.
- `content_md`: evergreen context for the game's events. Never repeat or invent timeline rows.
- `is_published`: publish only when the event source path is good enough.

## Output shape

```json
{
  "universe_id": 0,
  "slug": "",
  "title": "",
  "seo_title": "",
  "meta_description": "",
  "content_md": "",
  "is_published": true
}
```
