---
name: bloxodes-code-writing
description: Prepare one Bloxodes codes page payload backed by the code_pages table. Use for /codes/<game-slug> evergreen page copy, Roblox link and source URL wiring, RobloxDen and Beebom source checks, and upsert:code-page payloads without manually entering code rows.
---

# Bloxodes Code Writing

A codes page has two jobs. The refresh script keeps the code list live, and your copy makes the page feel like it was written by someone who plays: what the rewards are good for, how to redeem without fumbling, and why a code didn't work. Your words have to stay true for months, so everything you write is evergreen.

## Hard rules

- Never write active codes, expired codes, code names, code dates, first-seen dates, active counts or current reward mappings. The script owns all of that.
- `code_pages.slug` is the game slug only, like `wizard-alchemy`. Never add `-codes`.
- Never use `roblox_universes.slug` for `code_pages.slug`.
- The Roblox experience URL goes in `roblox_link`.
- The RobloxDen codes page goes in `source_url`.
- The Beebom codes page goes in `source_url_2`.
- Keep `seo_title` null or empty unless the user explicitly asks for custom SEO title text.

## Read first

- The voice guide: `.agents/skills/bloxodes-voice/SKILL.md`, plus the "Codes pages" section of its `references/examples.md`.

## Workflow

1. Check production for an existing `code_pages` row and a live `/codes/<slug>` page.
2. Confirm the exact Roblox experience and whether the game really has a codes system.
3. Check the RobloxDen and Beebom source pages.
4. Create the workspace:

   ```text
   tmp/content-workspace/<game-slug>/codes/<game-slug>/
     brief.md
     payload.json
   ```

5. Write `brief.md` with the game identity, existing `code_pages` row, live `/codes/<slug>` page, source URLs and refresh action.
6. Write only evergreen `code_pages` fields in `payload.json`.
7. After importing or upserting the row, run `npm run refresh:codes -- --slug <game-slug>` when code rows should be filled in.

## How the copy should read

- **Open on the game and why codes matter in it.** What do rewards actually help with? "Garden Rush codes hand out free Seeds and the occasional Golden Egg, which is a big deal early on."
- **Redeem steps are plain and exact.** Numbered, one action each, using the game's real button and menu names. Never guess UI steps.
- **Troubleshooting is calm and practical.** Expired, case-sensitive, level-locked, one use per account: whatever actually applies to this game.
- **Evergreen, always.** No `latest`, `current`, `fresh`, `new` or `updated daily`, and no dates, counts or code names. The personality comes from knowing the game, not from promising freshness.
- **Never narrate how the page was made.** Follow Public Copy in root `AGENTS.md`.

Cover, in simple words:

- what the game is
- what code rewards usually help with
- how players normally redeem codes
- why a code might fail
- where new codes usually show up

## Field jobs

- `name`: the official game name as players know it.
- `slug`: the editorial game slug only. The route already adds `/codes/`.
- `robloxLink`: the official Roblox experience URL.
- `sourceUrls`: RobloxDen first when available, Beebom second when available.
- `seoTitle`: null unless the user asks for custom text.
- `seoDescription`: what the page helps with, in evergreen terms with no counts or dates. "Redeem Garden Rush codes for free Seeds and eggs. See how to use them, what they give and why a code might not work."
- `introMd`: the game and how codes fit its rewards or progression.
- `redeemMd`: verified redemption steps.
- `rewardsMd`: the kinds of rewards and how to use them well, never current code-name mappings.
- `troubleshootMd`: lasting reasons a code can fail.
- `findCodesMd`: the official places the game usually announces codes.

## Output shape

This is the `payload.json` shape for `npm run upsert:code-page -- --file <payload.json> --publish`:

```json
{
  "name": "",
  "slug": "",
  "publish": true,
  "sourceUrls": [],
  "robloxLink": null,
  "communityLink": null,
  "discordLink": null,
  "twitterLink": null,
  "youtubeLink": null,
  "coverImage": null,
  "seoTitle": null,
  "seoDescription": "",
  "introMd": "",
  "redeemMd": "",
  "rewardsMd": "",
  "troubleshootMd": "",
  "findCodesMd": ""
}
```

Never include a `codes` array.
