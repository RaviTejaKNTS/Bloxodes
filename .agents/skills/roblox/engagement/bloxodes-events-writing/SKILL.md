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

## Voice & Tone

Bloxodes house voice: write like a player who knows the game well, telling a friend how it works. Calm, warm, and a little playful, never formal, corporate, or hyped.

- Simple English first. Short sentences, everyday words a younger player gets instantly. Explain any game term in plain words right where it appears.
- Do not use em dashes. Replace any em dash with a colon, comma, parentheses, or two short sentences. This applies to every output field: title, metadata, body, FAQ, and all JSON values.
- Playful, not loud. Drop in a light, dry touch of wit (roughly one per short paragraph) and always wrap it around a real fact, like "protection that overstays its welcome." The fact leads; the wit rides along. Never force a joke, stack puns, or let a quip hide the info.
- Gamer-buddy warmth. Talk to the player as "you," use real in-game nouns, and sound like someone who actually plays, not a manual.
- Spark from rhythm, not adjectives. Energy comes from concrete detail, a strong first line, and varied sentence length, not from words like *ultimate, insane, amazing, epic, must-have, game-changer*. Ban those.
- Open on the real thing: the event or what players want to track. No "In this game…", "Welcome to…", or mood-setting warm-ups.
- Keep it evergreen. The playful voice never reaches for a live event, date, or "happening now" hook that will expire.
- No filler or AI tics. Cut "Additionally", "Furthermore", "It's important to note", and "not just… but". Every sentence earns its place.

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
