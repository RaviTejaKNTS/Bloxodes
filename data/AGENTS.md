# Local Data Guide

Scope: `data/` plus related static data under `src/data/`.

These files back tools and catalog sections that are not fully modeled in Supabase.

## Dataset Map

- `data/Admin commands/*.md`
  - Parsed by `src/lib/admin-commands.ts`.
  - Used by catalog admin-command routes.
- `data/Grow a Garden/*`
  - Crop/tool data used by the Grow a Garden calculator and quiz content.
- `data/The Forge/*.json`
  - Structured catalog and calculator data used by Forge catalog pages and Forge tools.
- `data/Fisch/fish.json`
  - Fisch catalog content.
- `data/Color Codes/roblox-color-codes.json`
  - Color code catalog for the color-code pages.
- `data/decal-ids/*`
  - Decal ID datasets produced by the scrape/enrich scripts.
- `data/roblox errros/roblox-errors.json`
  - Static Roblox error reference data.
- `src/data/slug_oldslugs.json`
  - Legacy slug redirect map for the public fallback route.

## Rules

- Treat local data files as content sources, not ad hoc dumps. Keep filenames and object shapes stable once routes depend on them.
- When changing a dataset, update the parser/helper in `src/lib/*` or the route-family helper in `src/app/(site)`.
- If a dataset powers a public route, verify SEO text, pagination, and revalidation behavior still make sense after the change.
- If a new dataset becomes long-lived, document it in `agents/data/agents.md`.
