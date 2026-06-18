---
name: bloxodes-code-writing
description: Prepare one Bloxodes codes page payload backed by the code_pages table. Use for /codes/<game-slug> evergreen page copy, Roblox link and source URL wiring, RobloxDen and Beebom source checks, and upsert:code-page payloads without manually entering code rows.
---

# Bloxodes Code Writing

Code pages are source-wired pages. The script owns active codes, expired codes, rewards tied to code names, dates, and counts.

## Hard Rules

- Do not manually write active codes, expired codes, code names, code dates, first-seen dates, active counts, or current reward mappings.
- `code_pages.slug` is the game slug only, such as `wizard-alchemy`. Do not add `-codes`.
- Do not use `roblox_universes.slug` for `code_pages.slug`.
- Put the Roblox experience URL in `roblox_link`.
- Put the RobloxDen codes page in `source_url`.
- Put the Beebom codes page in `source_url_2`.
- Keep `seo_title` null or empty unless the user explicitly asks for custom SEO title text.

## Workflow

1. Check production for an existing `code_pages` row and live `/codes/<slug>` page.
2. Verify the exact Roblox experience and whether the game has a real codes system.
3. Check RobloxDen and Beebom source pages.
4. Create workspace:

```text
tmp/content-workspace/<game-slug>/codes/<game-slug>/
  brief.md
  payload.json
```

5. Write `brief.md` with the game identity, existing `code_pages` row, live `/codes/<slug>` page, source URLs, and refresh action.
6. Write only evergreen `code_pages` row fields in `payload.json`.
7. After importing/upserting the code page row, run `npm run refresh:codes -- --slug <game-slug>` when code rows should be populated.

## Public Copy

Write simply:

- what the game is
- what code rewards usually help with
- how players normally redeem codes
- why a code might fail
- where new codes usually appear

Do not promise freshness with phrases like `latest`, `current`, `fresh`, or `updated daily`.

## Field Jobs

- `name`: Use the official game name as players know it.
- `slug`: Use the editorial game slug only. The route already adds `/codes/`.
- `robloxLink`: Use the official Roblox experience URL.
- `sourceUrls`: Put RobloxDen first when available and Beebom second when available.
- `seoTitle`: Keep null unless the user asks for custom text.
- `seoDescription`: Explain the code page in evergreen terms without active counts or date claims.
- `introMd`: Explain the game and how codes usually fit its rewards or progression.
- `redeemMd`: Explain verified redemption steps. Do not guess UI steps.
- `rewardsMd`: Explain reward types and smart use, not current code-name mappings.
- `troubleshootMd`: Explain durable reasons a code can fail.
- `findCodesMd`: Point to official places where the game usually announces codes.

## Output Shape

Write the `payload.json` shape used by `npm run upsert:code-page -- --file <payload.json> --publish`:

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

Do not include a `codes` array.
