# Code Pages

Use this guide for `/codes/<game-slug>` pages backed by the `games` row plus live `codes` rows.

Code pages are not manually maintained code lists. The public article fields explain the game, rewards, redemption, troubleshooting, and official places to watch. The active and expired code rows must come from the codes refresh pipeline.

Non-negotiable: never inject code data by hand. Do not write code names, active/expired rows, reward mappings tied to a current code, first-seen dates, expiry dates, active counts, or "latest/current/fresh" claims into JSON, SQL, Supabase, Markdown, or prose. The only content work is evergreen `games` row copy and source URL wiring; the automation owns live code data.

## Required Shape

Create or update:

```text
tmp/content-workspace/<game-slug>/codes/
  todo.md
  research-notes.md
  final.json
```

Copy `agents/content/todo-templates/codes.md` into the folder as `todo.md` before research starts.

```json
{
  "name": "",
  "slug": "",
  "is_published": true,
  "roblox_link": "",
  "source_url": "",
  "source_url_2": "",
  "seo_title": null,
  "seo_description": "",
  "intro_md": "",
  "redeem_md": "",
  "rewards_md": "",
  "troubleshoot_md": "",
  "find_codes_md": ""
}
```

Do not include `codes`, `expired_codes`, `firstSeenAt`, `first_seen_at`, or any manual code rows in code-page output.

## Hard Rules

- The slug is the editorial game slug only. Use `wizard-alchemy`, not `wizard-alchemy-codes`, because the route already says `/codes/`. Do not copy `roblox_universes.slug`.
- `roblox_link` must be the official Roblox experience URL.
- `source_url` must be the RobloxDen codes page URL.
- `source_url_2` must be the Beebom codes page URL.
- Keep `seo_title` empty or null unless the user explicitly asks for a custom SEO title.
- Never manually enter active codes, expired codes, rewards tied to specific code names, or code dates.
- Run `npm run refresh:codes -- --slug <game-slug>` after the row has the source URLs. That script reads `source_url` and `source_url_2`, scrapes supported providers, upserts active codes, expires missing codes, and updates the code data.

If RobloxDen or Beebom is missing for a new game, record the gap and ask how to proceed. Do not fill the gap by manually typing code rows from another site.

## Evergreen Article Copy

The article fields must survive between code refresh runs. Bloxodes updates the code system, not every code article every few days, so public prose and metadata must not freeze itself to today's code state.

Do not write:

- active code names in `intro_md`, `rewards_md`, `troubleshoot_md`, `find_codes_md`, or metadata
- exact dates, month/year labels, or date-stamped meta descriptions
- active-code counts
- `latest`, `current`, `fresh`, `updated daily`, or similar freshness promises
- reward tables that map current code names to rewards

Good code-page copy explains durable facts:

- what the game is
- what code rewards usually affect
- how to redeem codes
- why redemption might fail
- where official new codes usually appear

## Rewards Section

`rewards_md` should normally use a table, but the table should compare reward types, not live code names.

Good columns:

- `Reward type`
- `What it affects`
- `Smart way to use it`

Bad columns:

- `Current codes that give it`
- `Active code`
- `Added date`

## Workflow

1. Research the game and source pages.
2. Insert or update only the `games` row with evergreen article fields and the correct source URLs.
3. Keep `seo_title` empty or null.
4. Do not insert code rows.
5. Run `npm run refresh:codes -- --slug <game-slug>`.
6. Verify the code page locally and confirm the code table came from the refresh script, not from manual JSON, SQL, or copied source text.

The final check should name both things separately: article fields are evergreen, and live codes were sourced by `scripts/codes/update-codes.ts`.
