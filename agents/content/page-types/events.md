# Event Pages

Use this guide for Bloxodes event hubs at `/events/<slug>` backed by `events_pages` plus timeline rows from `roblox_virtual_events`.

An event page should exist only when a game has real trackable events. Normal update churn is not enough. The page needs event names, status, dates or phases, rewards, mechanics, or a Roblox virtual event feed that can keep the timeline meaningful.

Non-negotiable: never inject event timeline data by hand. Do not write current event rows, active/upcoming/past status, live dates, reward timelines, one-off current event claims, or "latest/current" event wording into page prose or manual JSON. Event rows must come from `roblox_virtual_events` or another approved importer. The page copy is evergreen orientation; the timeline surface is automation-owned.

## Scope Guard

Event-page work owns the `events_pages` row and approved event importer/timeline data path. Do not edit shared event routes, timeline components, generic event cards, page chrome, sidebars, CTAs, ads, sitemap/feed code, or unrelated page copy unless the user explicitly asks for route or component work.

If preview shows a template or renderer issue, report it separately and keep the current task limited to event data/content.

## Database Fields

Create or update:

```text
tmp/content-workspace/<game-slug>/events/
  todo.md
  research-notes.md
  final.json
```

Copy `agents/content/todo-templates/events.md` into the folder as `todo.md` before research starts.

Write page copy in this shape:

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

The timeline itself comes from `roblox_virtual_events`. Do not invent event rows when the event data cannot be sourced, and do not copy live event rows into `content_md`.

## Eligibility

Before writing, decide whether event coverage should exist at all.

Good reasons:

- the Roblox virtual events API has current, upcoming, or past events for the universe
- official developer posts name events, phases, dates, rewards, or event mechanics
- a reliable community wiki has event timelines that can be checked against official or in-game evidence

Weak reasons:

- the game updates often but has no named events
- a code site mentions an "update" without event mechanics
- players loosely call every patch an event

If event evidence is weak, mark the page `do not create` or `blocked` in `research-notes.md`.

## Writing Rules

Keep `content_md` short and useful. The route already shows current, upcoming, and past timeline sections when event rows exist, so page copy should orient the reader instead of repeating the whole timeline.

Use stable language around dates. If a date, time zone, reward, or status is uncertain, record the uncertainty in research notes and avoid a hard public claim.

Do not promise that the page has every current event unless the source feed proves it. Prefer practical evergreen phrasing about tracked events, event rewards, and where the game tends to announce details. Avoid wording that will be stale when the next event starts or ends.

## Final Checks

- `events_pages.slug` is the editorial game slug, not `roblox_universes.slug`.
- `universe_id` matches the canonical Roblox game.
- Event rows are sourced from Roblox/developer/community evidence, not invented.
- `meta_description` is specific and under 160 characters.
- `/events/<slug>` renders current/upcoming/past sections correctly.
- `/events` and `/sitemaps/events.xml` include the page when published.
