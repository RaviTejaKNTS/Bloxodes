---
name: bloxodes-franchise-codes
description: Prepare and verify codes pages and their verified code rows for non-Roblox games and franchises.
---

# Bloxodes Franchise Codes

A codes page has two jobs. Verified code rows keep the code list useful, and your copy makes the page feel like it was written by someone who plays: what the rewards are good for, how to redeem without fumbling, and why a code didn't work. Your words have to stay true for months, so everything you write is evergreen.

**Before you start:** read `bloxodes-docs/content/franchise.md` (identity, routes, tables and the rules every franchise page follows) and `bloxodes-docs/content/page-standards.md` (titles, headings, depth, images and layout). The page has the same sections, sidebar, image slots, FAQ and related links as a Roblox codes page.

Use this for non-Roblox redeem codes. GTA cheats use collections. There is no non-Roblox codes refresh job. For a full run, follow [the workflow](references/workflow.md); its T3 stages use the "Franchise codes pages" table in `.agents/skills/bloxodes-model-routing/SKILL.md`.

## Hard rules

- Keep active codes, expired codes, code names, code dates, first-seen dates, active counts and current reward mappings out of evergreen page copy. Verified `game_codes` rows own them.
- Keep the approved editorial slug and registry owner stable. The database derives the codes route; never append `-codes` just to imitate a route.
- Verify redemption steps and announcements from the game's official publisher/developer, support or official community channels. Record HTTPS source URLs and verification dates privately.
- `check` codes stay hidden. Public lists show `active` and `expired`. Missing from a source does not mean expired.
- Preserve previous code rows and first-seen dates. Don't overwrite another game's codes.
- Keep `seo_title` null or empty unless the user explicitly asks for custom SEO title text.
- Cards and social previews use the owning game's art: `games.cover_image` (16:9) and `games.hero_image` (square). There's no per-page image field; make sure the game row has both. Publishing fails if they're missing, blank, the Bloxodes logo, unreachable or the wrong shape.

## Read first

- The voice guide: `.agents/skills/bloxodes-voice/SKILL.md`, plus the "Codes pages" section of `.agents/skills/bloxodes-voice/references/examples.md`.
- The approved plan and the page standards linked above.

## Workflow

1. Check production for an existing namespace-scoped `game_code_pages` row and its exact live route.
2. Confirm the exact registry game and whether the game really has a codes system.
3. Check official redemption and announcement sources for the exact edition, platform and region.
4. Create the workspace, keeping a supplied override:

   ```text
   tmp/content-workspace/<namespace>/<game-slug>/codes/<game-slug>/
     brief.md
     payload.json
   ```

5. Write `brief.md` with game identity, existing page and route, verified sources, redemption steps, reward types, code evidence, image source/credit and unresolved gaps. Wait for parent research approval before writing.
6. Write evergreen `game_code_pages` fields under `codesPages` in `payload.json`. Prepare separately verified `game_codes` rows under `codes` only when code-row work is in scope. No Roblox refresh or source-URL wiring applies.
7. Hand the exact payload to the parent for `Managed content QA` through the `game-pages` publisher. Validation, application, builds and browser checks run on GitHub, never locally. Production publication is separate and needs explicit authorization.

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

- `namespace`, `game_id` and `slug`: the approved namespace, registry owner UUID and editorial slug. Existing owners and routes stay unchanged.
- `title`: the game and codes promise in natural search wording, about 50 to 65 characters.
- `seo_title`: null unless the user asks for custom text.
- `meta_description`: what the page helps with, in evergreen terms with no counts or dates. Name the game's real rewards, then what the page helps with (redeeming, rewards, codes that fail), in roughly 140 to 160 characters.
- `intro_md`: the game and how codes fit its rewards or progression.
- `redeem_md`: verified redemption steps.
- `rewards_md`: the kinds of rewards and how to use them well, never current code-name mappings.
- `troubleshoot_md`: lasting reasons a code can fail.
- `find_codes_md`: the official places the game usually announces codes.
- `sources_json`: credited official sources, each `{ "title": "...", "url": "https://..." }`.
- `faq_json`: real follow-up questions. Every entry is `{ "q": "...", "a": "..." }`.
- `is_published` and `published_at`: reviewed publication state and date.

## Output shape

This is the `payload.json` shape for `npm run publish:game-pages -- --namespace <namespace> --file <payload.json>`, run by GitHub QA. It validates in a rollback-only transaction by default; development application uses `--apply` in CI.

```json
{
  "codesPages": [{
    "id": "<stable-page-uuid>",
    "namespace": "<namespace>",
    "game_id": "<game-uuid>",
    "slug": "<editorial-slug>",
    "title": "",
    "seo_title": null,
    "meta_description": "",
    "intro_md": "",
    "redeem_md": "",
    "rewards_md": "",
    "troubleshoot_md": "",
    "find_codes_md": "",
    "sources_json": [],
    "faq_json": [{ "q": "", "a": "" }],
    "is_published": false
  }]
}
```

Omit `codes` for page-only work. For approved code-row work, add separately verified rows with `code_page_id`, `code`, `rewards_text`, `status`, `verified_at` and HTTPS `source_url`. Use an explicit stable page UUID when both groups are in the same batch. The publisher validates identity before applying the atomic batch. Don't add `namespace` to `game_codes` rows.
