---
name: bloxodes-code-writing
description: Write or update Bloxodes code pages backed by the games table. Use for /codes/<game-slug> page copy, evergreen code reward/redeem/troubleshooting fields, Roblox link and source URL wiring, RobloxDen and Beebom code source checks, and workflows that must avoid manual active or expired code rows.
---

# Bloxodes Code Writing

## Start Here

Read:

- `agents/content/writing-core.md`
- `agents/content/research-policy.md`
- `agents/content/page-types/code-pages.md`
- `agents/content/final-edit.md`

Create or update the game-first workspace:

```text
tmp/content-workspace/<game-slug>/codes/
  todo.md
  research-notes.md
  final.json
```

Copy `agents/content/todo-templates/codes.md` into the folder as `todo.md` and update it as work progresses.

## What This Skill Is For

Use this for `/codes/<game-slug>` pages backed by the `games` row. The page copy explains the game, durable reward types, redemption, troubleshooting, and where new codes usually appear. The live `codes` table is owned by `scripts/codes/update-codes.ts`.

Do not create a codes page unless research confirms a real code system and supported source wiring.

Never inject code data by hand. This skill may write evergreen `games` row fields and source URLs only. Do not write current code names, active or expired code rows, current reward mappings, active counts, dates, or freshness claims into `final.json`, SQL, Supabase, Markdown, or public prose.

## Output Shape

Return valid JSON shaped for the `games` row:

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

## Hard Rules

- Use the editorial game slug only, such as `rivals`, not `rivals-codes`.
- Do not use `roblox_universes.slug` for `games.slug`; universe slugs are stats-only identifiers and may include universe IDs.
- Put the official Roblox experience URL in `roblox_link`.
- Put the RobloxDen codes page in `source_url`.
- Put the Beebom codes page in `source_url_2`.
- Leave `seo_title` null unless the user explicitly asks otherwise.
- Do not write active codes, expired codes, code names, code dates, code reward mappings, `first_seen_at`, or a manual `codes` array.
- Keep all copy evergreen. Explain the game, normal reward categories, redemption flow, official places codes usually appear, and common durable failure reasons. Do not mention current/active/latest codes in prose.
- After the row is saved with source URLs, run `npm run refresh:codes -- --slug <game-slug>`.

## Finish

Run final edit before saving `final.json`. After import, refresh codes and preview `/codes/<slug>` to confirm live code rows came from the refresh workflow.
