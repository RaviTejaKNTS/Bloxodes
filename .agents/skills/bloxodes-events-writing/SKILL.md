---
name: bloxodes-events-writing
description: Write or update Bloxodes event pages backed by events_pages and roblox_virtual_events. Use for /events/<game-slug> page copy, event eligibility research, Roblox virtual event timeline checks, event metadata, current/upcoming/past event source verification, and deciding when not to create an events page.
---

# Bloxodes Events Writing

## Start Here

Read:

- `agents/content/writing-core.md`
- `agents/content/research-policy.md`
- `agents/content/page-types/events.md`
- `agents/content/final-edit.md`

Create or update the game-first workspace:

```text
tmp/content-workspace/<game-slug>/events/
  todo.md
  research-notes.md
  final.json
```

Copy `agents/content/todo-templates/events.md` into the folder as `todo.md` and update it as work progresses.

## What This Skill Is For

Use this for `/events/<game-slug>` pages backed by `events_pages` and timeline data in `roblox_virtual_events`.

The first job is eligibility. Do not create an event page only because a game updates often. Recommend or write one only when the game has trackable Roblox/developer/community event evidence.

Never inject event data by hand. This skill may write evergreen `events_pages` copy and metadata only. Current/upcoming/past event rows, live status, dates, rewards, and timelines must come from `roblox_virtual_events` or another approved importer. Do not write "current event", "latest event", exact live dates, or one-off event reward claims into public copy.

## Output Shape

Return valid JSON shaped for `events_pages`:

```json
{
  "universe_id": null,
  "slug": "",
  "title": "",
  "seo_title": "",
  "meta_description": "",
  "content_md": "",
  "is_published": true
}
```

Event timeline rows belong in `roblox_virtual_events` and must be sourced. Do not invent event rows from thin public copy, and do not copy timeline rows into `content_md`.

## Writing Guidance

Keep `content_md` short and evergreen. The route already renders current, upcoming, and past event sections from event rows, so the page copy should explain how events work for that game, what players usually track, and where uncertainty remains.

Use careful date language. If dates, time zones, rewards, or statuses are unclear, record that in `research-notes.md` and avoid hard public claims.

## Finish

Run final edit before saving `final.json`. After import, preview `/events/<slug>`, `/events`, and sitemap coverage when the page is published.
