---
name: bloxodes-events-writing
description: Write or update Bloxodes event pages backed by events_pages. Use for /events/<game-slug> evergreen page copy, metadata, source verification, and deciding when an events page should not be created. Do not manually write timeline rows.
---

# Bloxodes Events Writing

Read `agents/content-writing/agents.md` first.

Events pages explain how event tracking works for a game. Timeline rows, live statuses, dates, and guide links belong to `roblox_virtual_events` or another approved importer.

## Hard Rules

- Do not manually write current, upcoming, or past event rows.
- Do not hard-code live event dates, reward timelines, statuses, or active event claims in `content_md`.
- Do not use freshness phrases such as `latest event`, `current event`, or `updated daily`.
- If event data cannot come from an approved importer, mark the page `do not create` or `blocked`.

## Workflow

1. Check production for an existing events page and related timeline rows.
2. Verify the game identity and whether it has enough event history or event tracking value.
3. Create workspace:

```text
tmp/content-workspace/<game-slug>/events/<game-slug>/
  research-notes.md
  final.json
```

4. Write `research-notes.md` with the source path for timeline data, existing coverage, and whether the page should exist.
5. Write evergreen page fields only.
6. Parse JSON before import.

## Field Jobs

- `universe_id`: Link the events page to the exact game universe.
- `slug`: Use the editorial game slug.
- `title`: Name the game event page without hard-coding a live event that will expire.
- `seo_title`: Keep it close to the title unless search needs a cleaner version.
- `meta_description`: Say what event information the page helps players track.
- `content_md`: Give evergreen context for the event page. Do not repeat or invent timeline rows.
- `is_published`: Publish only when the event source path is good enough.

## Output Shape

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

Public copy should tell players what the event page helps them check without listing live rows manually.
