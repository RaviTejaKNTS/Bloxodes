# Sportskeeda-led pets & mutations articles — 2026-08-05

Article workflow runner batch from four Sportskeeda topic leads. Research → brief approval → writing → parent review → copy check complete. Local `verify:article-finals` + browser preview blocked until local Supabase/Docker is available.

**Status key:** `[r]` ready for local verify/import · `[x]` published

## Batch

| Status | Game | Title | Slug | Workspace |
| --- | --- | --- | --- | --- |
| [r] | Build a Base and Steal | How to Get Pets in Build a Base and Steal (Roblox) | `how-to-get-pets-build-a-base-and-steal` | `tmp/content-workspace/build-a-base-and-steal/articles/how-to-get-pets-build-a-base-and-steal/` |
| [r] | Build a Base and Steal | Build a Base and Steal Pet Mutations Guide: All Effects Explained (Roblox) | `build-a-base-and-steal-pet-mutations` | `tmp/content-workspace/build-a-base-and-steal/articles/build-a-base-and-steal-pet-mutations/` |
| [r] | Grow a Garden | Grow a Garden Moon Egg Guide: Pets, How to Get Them, and Abilities | `grow-a-garden-moon-egg-pets-guide` | `tmp/content-workspace/grow-a-garden/articles/grow-a-garden-moon-egg-pets-guide/` |
| [r] | Merge a Nuke | Merge a Nuke Mutations Guide: All Known Types and Effects (Roblox) | `merge-a-nuke-mutations-guide` | `tmp/content-workspace/merge-a-nuke/articles/merge-a-nuke-mutations-guide/` |

## Universe IDs

- Build a Base and Steal: `10356701370`
- Grow a Garden: `126884695634066`
- Merge a Nuke: `10199301628`

## Checks done

- Parent brief review and approval (with scoped notes)
- Parent final review + writer revisions (FAQ `q`/`a`, Moon Egg dash/copy, Merge a Nuke heading consolidate)
- `npm run content:check-copy` passed on all four `final.json` files

## Still needed before publish

1. Start local Supabase (`npm run supabase:start`) and `.env.local`
2. `npm run dev:local`
3. `npm run verify:article-finals -- --base-url http://localhost:<port> --file <each final.json>`
4. Browser preview each `/articles/<slug>`
5. Production import only after explicit release request

## Known risks

- Sportskeeda lead bodies were WAF/captcha blocked; facts use fan-out sources (Fandom, AllThings.How, PGG, beatcopgame, BloxRant, etc.)
- Build a Base and Steal mutation multipliers rely primarily on one fetchable competitor table (beatcopgame)
- Grow a Garden Moon Egg shop price uses Harvest Moon Event master table (50 MC / 8.33%) with a note that the dedicated Moon Egg wiki line still shows 40 MC / 5%
- Merge a Nuke Index still has five TBA slots in public sources; article documents known types only
- No perfect YouTube embeds; no rights-clean body images in v1
