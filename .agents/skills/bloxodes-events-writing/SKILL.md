---
name: bloxodes-events-writing
description: Write one Bloxodes events page final.json after brief approval. Use for /events/<game-slug> evergreen page copy backed by events_pages, metadata, source verification, and final.json output. Do not manually write timeline rows.
---

# Bloxodes Events Writing

Use this after `bloxodes-events-research` and parent approval. Timeline rows, live statuses, dates, and guide links belong to `roblox_virtual_events` or another approved importer.

## Hard Rules

- Do not manually write current, upcoming, or past event rows.
- Do not hard-code live event dates, reward timelines, statuses, or active event claims in `content_md`.
- Do not use freshness phrases such as `latest event`, `current event`, or `updated daily`.
- If event data cannot come from an approved importer, mark the page `do not create` or `blocked`.

## Workflow

1. Read the approved `brief.md`.
2. Create or update:

```text
tmp/content-workspace/<game-slug>/events/<game-slug>/
  brief.md
  final.json
```

3. Write evergreen page fields only.
4. Parse JSON before returning.

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
