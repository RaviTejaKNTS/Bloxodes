# Codes Page Todo

Status: not started
Updated: YYYY-MM-DD
Workspace: `tmp/content-workspace/<game-slug>/codes/`

## Use With

- Skill: `bloxodes-code-writing`
- Core docs: `agents/content/page-types/code-pages.md`, `agents/content/research-policy.md`
- Script docs: `agents/scripts/agents.md`

## Setup

- [ ] Confirm game slug, universe ID, place ID, official Roblox URL, and existing `games` row.
- [ ] Copy this file as `todo.md` before writing or updating `research-notes.md`.
- [ ] Verify the game has an actual codes system.
- [ ] Search existing old slugs/source URL docs so the row is not duplicated.

## Source Wiring

- [ ] Confirm RobloxDen source URL or record the gap.
- [ ] Confirm Beebom source URL or record the gap.
- [ ] Confirm `slug` uses the game slug only, without `-codes`.
- [ ] Confirm `roblox_link`, `source_url`, and `source_url_2` are assigned to the correct source types.
- [ ] If RobloxDen or Beebom is missing, mark the page blocked or ask before using another source.

## Write

- [ ] Write evergreen `games` row fields in `final.json`.
- [ ] Keep `seo_title` null unless explicitly requested.
- [ ] Do not write active codes, expired codes, code names, code dates, active counts, copied source rows, or code reward mappings.
- [ ] Remove freshness claims, active-code counts, exact dates, and current reward tables from prose.
- [ ] Confirm live code data will be created only by the refresh automation.

## Verify

- [ ] Run final edit on the article fields.
- [ ] Import/update the game row locally when approved.
- [ ] Run `npm run refresh:codes -- --slug <game-slug>` after source URLs are saved.
- [ ] Preview `/codes/<slug>` and confirm live code rows came from the refresh workflow.
