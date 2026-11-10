# Monthly stats reports, version 1

`report.json` declares `stats-report@1`. Copy the complete `data/` directory from `report:build` unchanged beside it. `schema.ts` owns the strict Zod schema and exported JSON schema.

Build a completed month with `npm run report:build -- --month YYYY-MM --out /absolute/output --allow-prod-read`. The command loads `production-preview`, reads production, and writes only local artifacts. Exit code 2 means the month is not ready or invalid. Read `data/data-check.json` for the reason. Raw read caches live outside the bundle in `raw/`; delete that directory before rebuilding changed source data. Not-ready and invalid previous attempts automatically refresh their source caches on retry. Reusing an output directory for another month also refreshes its caches.

`report:chart -- --data /absolute/output/data --kind game-lines --id extra-1 --games 123,456` adds an extra chart from frozen data and updates the manifest. Other kinds are `genre-lines`, `top-list`, and `compare-bars`. Game extras can use every qualifying game. Genre extras can use every known genre. Extras read the original build raw cache, so run this command before copying the data directory into a bundle. It never accepts numeric chart values.

Body blocks are `h2`, `p`, `chart`, and `dates`. Include every available predefined chart once, in the order defined in `scripts/reports/model.ts`. An omitted chart must not appear. At most three extras may appear. Paragraphs use bold and links. Game links use `[Name](game:123)` and resolve to the frozen stats slug. External links require HTTPS on roblox.com, devforum.roblox.com, about.roblox.com, or create.roblox.com.

Every prose number must occur in the frozen facts, insights, or charts within display rounding. Calendar dates, years, and numbered weeks are exempt. Titles, descriptions, labels, and text cannot contain em dashes. The public-copy checker also applies.

`npm run content:publish -- /absolute/bundle --target managed-dev` validates and plans without writes. Add `--apply` to publish to managed development. Visibility defaults to hidden. Hidden reports render at their exact URL with noindex and stay out of lists. `--visibility public` includes a report in discovery. Changing an existing public bundle requires `--update-published`; making an identical hidden bundle public does not.

Production uses the existing main-checkout, clean-tree, deployed-code and migration guards, plus `--target production --apply --allow-prod`. It uploads a generated PNG using the article media bucket, verifies media and row readback, revalidates the report and discovery routes, and verifies the live HTML. `content:status -- --stats-report roblox-october-2026 --target production` reads publication state.

The `data-check.json` hash excludes its `built_at` field. The manifest declares that single fixed exclusion in `hash_exclusions`. All other data bytes are hashed unchanged. This keeps publication identity stable across timestamp-only rebuilds.
