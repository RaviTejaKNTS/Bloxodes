# Wiki Pages

Use this guide for game hub pages at `/wiki/<slug>` backed by `wiki_pages` plus related data from `roblox_universes`, codes, catalog pages, tools, articles, checklists, quizzes, and events.

Treat the wiki as a live hub. The best copy here is calm, useful orientation. It should help the reader understand what kind of game they are looking at and what parts of the hub matter, without trying to turn every related section into a paragraph.

## Purpose

A wiki page is the center page for a Roblox game on Bloxodes. It should orient the player, then let live related sections carry the current details.

For new game coverage, prefer writing the wiki after catalog-led discovery or the first core catalog data pass. The hub should be grounded in real systems, item collections, routes, and gameplay loops, not only the Roblox description and generic genre assumptions.

The wiki hub is not a full article dump. It should connect the reader to:

- live Roblox metadata
- active codes
- catalog collections
- events
- tools
- articles
- checklists
- quizzes
- social/developer details

Connection happens through the UI and related sections. Public copy should explain the game and its systems, not tell the reader to click cards.

Codes and events remain automation-owned on the wiki too. The wiki can mention that the game has codes or events when related sections exist, but it should not hard-code current code names, active-code counts, live event statuses, current event dates, or temporary reward timelines.

## Scope Guard

Wiki work owns the `wiki_pages` row, the companion `roblox_universes.game_description_md` update when explicitly part of the wiki workflow, and related row verification. Do not edit shared wiki routes, hub layouts, related-card components, navigation, CTAs, sidebars, ads, sitemap/feed code, or unrelated page copy unless the user explicitly asks for implementation work.

If preview exposes bad shared hub copy or a route/rendering issue, record it separately and ask before changing shared UI.

## Rendered Page Contract

Before writing, map every visible wiki area to the field or related table that renders it. A wiki page is not complete just because the `wiki_pages` row is filled.

- `wiki_pages` owns `title`, `seo_title`, `meta_description`, `tips_md`, `controls_json`, `cover_image`, publish fields, and the linked `universe_id`.
- `roblox_universes.game_description_md` owns the visible game summary/description on the wiki hub.
- `roblox_universes` owns live game metadata such as creator, genre, visits, favorites, created/updated dates, device support, social links, media, badges, passes, and servers.
- Catalog sections render from related catalog pages. Their short hub blurbs come from each catalog page's `wiki_md`.
- Codes, events, tools, articles, checklists, quizzes, and other game/developer sections render only when the related rows exist.

Record this map in `research-notes.md`. If the visible game summary is empty, update `roblox_universes.game_description_md` through the local seed/import workflow or explicitly record why it is intentionally blank. Do not hide a missing summary with extra tips.

## Minimum Useful Wiki

A finished wiki hub must answer the basic player questions even when some related sections do not exist yet:

- What is this game?
- What does the player do in a normal session?
- What are the core progression, combat, collection, reward, or role systems?
- What should a new or returning player check first?
- Which controls were researched, verified, and written into `controls_json`?
- Which related sections exist locally, and which expected sections are missing?
- What should the wiki skip because related cards already carry that live detail?

If these questions are not answered in `research-notes.md`, companion game description, tips, controls, or rendered related sections, the wiki is still incomplete.

## Database Fields

Create or update:

```text
tmp/content-workspace/<game-slug>/wiki/
  todo.md
  research-notes.md
  final.json
```

Copy `agents/content/todo-templates/wiki.md` into the folder as `todo.md` before research starts.

Write in this shape:

```json
{
  "slug": "",
  "title": "",
  "seo_title": "",
  "meta_description": "",
  "tips_md": "",
  "controls_json": [
    { "action": "Interact", "desktop": "E" }
  ],
  "cover_image": null,
  "universe_id": null
}
```

Most rich content on the page comes from related data, not from long wiki body fields.

The visible game summary is companion data, not a `wiki_pages` field. When it needs work, write or update `roblox_universes.game_description_md` separately and record that action in `research-notes.md`. Workspace `final.json` may include a clearly named `game_description_md` value for review, but the import or seed script must write it to `roblox_universes`, not `wiki_pages`.

## Game Metadata Labels

Avoid confusing game metadata with wiki freshness.

Use:

- `Game created on <date>`
- `Game last updated on <date>`

Use a separate page freshness label for Bloxodes content, such as the existing updated timestamp component.

## What To Put In Tips

`tips_md` must contain exactly 3-4 short, concrete gameplay tips specific to the game. Do not write fewer than 3 tips, more than 4 tips, or a long checklist that competes with related catalog cards.

Even short wiki copy needs context. A tip should make one clear point, explain why it matters, and avoid jumping through several systems in one bullet.

Good tips mention:

- important timers
- shops or rotations
- progression gates
- common mistakes
- collection priorities
- event dependencies
- systems that affect value or rewards

Bad tips:

- "Have fun."
- "Check back often."
- "Explore the game to learn more."
- "Use codes to get rewards." unless it explains what codes affect in that game

## Controls JSON

`controls_json` is required wiki data. Research the game's controls before the wiki is marked complete, then write the verified controls into `controls_json`. Do not guess, and do not leave controls empty as a normal completion path.

Use reliable evidence: in-game control prompts, official Roblox/developer instructions, source-backed gameplay pages, screenshots, or another documented verification pass. Record the source or verification note in `research-notes.md`. If the available evidence only verifies desktop controls, write the desktop controls and record which device controls remain unverified. If no useful controls can be verified, mark the wiki `blocked` or `needs controls research` instead of publishing or calling the page complete.

Good entries should be simple:

```json
[
  { "action": "Sprint", "desktop": "Shift" },
  { "action": "Interact", "desktop": "E", "mobile": "Tap the prompt" }
]
```

Avoid stuffing controls with generic Roblox defaults unless they were checked for the target game. Controls should help the player use the actual experience, not only document platform assumptions.

## Related Data Awareness

The wiki page currently loads:

- up to 3 active codes from the linked code page
- tools for the same universe
- related articles
- checklists
- catalog pages linked by `universe_id` and code prefix
- quizzes
- events page summary
- up to 7 event timeline entries
- ranking badges
- media
- badges
- game passes
- servers
- other games from the same developer

Write `meta_description` and `tips_md` knowing the page is a live hub. Do not repeat everything already shown in related sections.

## Catalog Section Copy

When catalog pages appear on a wiki hub, their `wiki_md` should read like a short explanation of that collection inside the game.

Ownership rule: `wiki_md` belongs to the catalog page workflow, not the wiki page workflow. Write or improve it when working on the matching catalog page because that is where the collection research happens. When writing a wiki page, do not rewrite every catalog blurb inside the wiki output; focus on the game's description, page freshness, controls, tips, and hub-level context. If a catalog blurb is bad, treat that as a separate one-page catalog rewrite.

Good `wiki_md`:

```markdown
Eggs decide which pet pool each hatch can pull from. Current eggs are easy to replace, while retired and event eggs usually matter because players can only get them through trading.
```

Bad `wiki_md`:

```markdown
Use the Eggs catalog to compare egg prices, legendary chances, and availability.
```

Rules:

- Explain what the collection is in the game.
- Explain why it matters to collecting, trading, progression, building, or rewards.
- Mention the main variables players care about only when they add context.
- Keep each blurb focused on one connected idea.
- Use player-perspective language when it helps: practical `you` and `your` guidance is better than stiff database narration.
- Do not write `Use the X catalog`, `check the catalog`, `open the catalog`, `this catalog`, `this page`, `dataset`, or `Bloxodes`.
- Do not repeat the same sentence shape across every collection.

## Event Timeline Copy

For event sections:

- Keep ordering linear.
- Recent or current events should be easiest to scan.
- Status labels should be meaningful: upcoming, running, completed.
- Use Pacific time labels when the route displays PT.
- Do not write a table if a timeline is the chosen UI pattern.

## Wiki Page Output Example

```json
{
  "title": "Grow a Garden Wiki",
  "seo_title": "Grow a Garden Wiki",
  "meta_description": "Grow a Garden wiki hub with active codes, events, catalog links, gameplay tips, and Roblox universe details.",
  "tips_md": "- Seed Shop stock refreshes every 5 minutes, so short check-ins matter more than long waiting sessions.\n- Pet eggs rotate on their own timer, which makes source and availability important when comparing pets.\n- Mutations and weather can change crop value, so value planning depends on timing as much as planting.",
  "controls_json": [
    { "action": "Interact", "desktop": "E" }
  ]
}
```

## Final Checks

- Does the page feel like a hub, not a full article?
- Does the rendered field contract show where title, meta, game summary, tips, controls, metadata, and related sections come from?
- Is `roblox_universes.game_description_md` useful, or is the decision to leave it blank recorded?
- Does the page answer what the game is, what players do, and which systems matter?
- Does it avoid repeating related cards and sections?
- Are catalog section blurbs coming from catalog-page `wiki_md` instead of being newly written in the wiki page pass?
- If a catalog blurb is weak, did you move that work into a separate catalog-page workflow?
- Are game created/updated dates clearly game metadata?
- Are tips specific and useful?
- Is the meta description specific to this game's hub?
- Are controls researched, source-noted, accurate, and rendered on the page?
- Are catalog sections linked through `universe_id` and catalog code patterns?
- Did local DB readback include both `wiki_pages` and the linked `roblox_universes` row?
- Did local render verification confirm title, metadata, game summary, tips, controls, related sections, and images when applicable?
- Would a player know where to go next from this hub?
