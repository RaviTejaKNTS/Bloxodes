# URLs

Last verified: 2026-11-01

How public URLs are built, the slug rules every new page follows, and where redirects live.

## Roblox pages

Roblox URLs put the page type first.

| Page | URL | Slug comes from |
| --- | --- | --- |
| Codes | `/codes/<slug>` | `code_pages.slug` |
| Wiki hub | `/wiki/<slug>` | `wiki_pages.slug` |
| Collection | `/wiki/<wiki-slug>/<collection-slug>` | `wiki_collection_pages.wiki_slug`, `collection_slug` |
| Quiz | `/quizzes/<code>` | `quiz_pages.code` |
| Checklist | `/checklists/<slug>` | `checklist_pages.slug` |
| Tool | `/tools/<code>` | `tools.code` |
| Event | `/events/<slug>` | `events_pages.slug` |
| Article | `/articles/<slug>` | `articles.slug` |
| Catalog | `/catalog/<code>` and its hand-built sections | `catalog_pages.code` |
| Stats | `/stats/games/<stats-slug>`, `/stats/items/<asset-id>` | `roblox_universes.slug`, asset ID |

Lists that paginate use `<url>/page/<n>`. Pagination pages are `noindex`.

## Other games

Other games put the namespace first today. Three route systems serve them:

| Games | Route code | URLs |
| --- | --- | --- |
| GTA, Red Dead | Hand-written folders `(site)/gta`, `(site)/red-dead` | `/gta/wiki/<game>/<collection>`, `/gta/maps/<slug>`, `/gta/checklists/<slug>` |
| Minecraft | Hand-written folder `(site)/minecraft` | `/minecraft/<java|bedrock>/wiki/<collection>`, `/minecraft/tools/<tool>` |
| Every other game | Registry route `(site)/[slug]/[[...segments]]` | `/<namespace>/wiki`, `/<namespace>/wiki/<game>/<collection>`, `/<namespace>/<maps|quizzes|catalog|checklists|tools>/<slug>` |

Each `game_*` row stores its URL in `canonical_path`. Database triggers set it and refuse changes. Full route rules are in [franchise](franchise.md#routes).

## Slug rules

Every new page follows these:

- An editorial slug is permanent once published. Don't rename it.
- Use the game's full name: `gta-5`, not `5`.
- Tool, quiz and checklist slugs start with the game name, such as `grow-a-garden-crop-value-calculator`.
- Never copy `roblox_universes.slug` (a stats slug) into an editorial slug.
- Pick slugs that don't already exist for the same page type on either side, Roblox or other games. Both sides will share one set of URLs (see Known issues).

## Redirects

Redirects live in six places today:

| Where | What it redirects |
| --- | --- |
| `apps/web/next.config.js` | `/catalog/roblox-music-ids/games/work-at-a-pizza-place/*` and `/ads.txt` |
| `ARTICLE_REDIRECT_SLUGS` in `apps/web/src/proxy.ts` | 12 root-level article slugs to `/articles/<slug>` |
| `apps/web/src/data/slug_oldslugs.json`, read by `src/proxy.ts` | Old root-level codes slugs to `/codes/<slug>` |
| `minecraftLegacyRedirect` in `apps/web/src/lib/minecraft-paths.ts` | `/minecraft/wiki/*` and `?edition=` links to an edition URL |
| `(site)/lists/[[...slug]]/page.tsx` | Retired trending lists to filtered stats pages |
| `(site)/catalog/free-roblox-items/categories/` | Old category URLs to `/catalog/free-roblox-items/<category>` |

Some pages also redirect inside their own route, for example `/page/1` to the list's first page. Those stay with the page.

## Route table

`public.site_routes` maps every page URL to the page that owns it. The web app doesn't read it yet; the six sources above still serve redirects.

- **Live rows:** every page in the Roblox page tables, `puzzle_pages`, the eight `game_*` page tables, and a `hub` row for each namespace root in `games`, drafts included. `source` and `page_type` name the owning table; `page_id` is its row ID. A page has one live URL.
- **Old rows:** a redirect. With a `page_id`, it follows that page's current live URL, so a page that moves twice never builds a redirect chain. Without one, it uses `target_url`.
- **Gone rows:** a deleted page's last URL.
- **Prefix rows** match a path and everything below it. Exact beats prefix, and the longest prefix wins. `tail_mode` says whether the rest of the path is appended or dropped; `match_self = false` leaves the bare path alone (used for `/minecraft/wiki`).
- The redirects from all six sources are imported, plus `/codes/<old-slug>` rows from `code_pages.old_slugs`. Minecraft `?edition=` handling can't be a row and stays in `minecraftLegacyRedirect`.
- Triggers keep the table current. They run only when a URL column changes (`slug`, `code`, `canonical_path` and the like). A rename keeps the old URL as an old row; a delete marks it gone. A new page can't take another page's live URL; taking over an old or gone URL is logged in `site_route_conflicts`.
- Retired catalog pages get no live row, so their redirect wins. When a legacy `roblox-free-items` code and a canonical `free-roblox-items` code map to one URL, the canonical page owns it, the same as the reader.
- `resolve_site_route(path)` returns the matching row and its final target. `site_route_redirects` lists every redirect row.
- `npm run routes:report` prints counts, conflicts, missing owners, orphaned redirects and unmapped catalog codes. It's read-only and defaults to managed development; production needs `BLOXODES_ENV_PROFILE=production-preview` and `--allow-prod`. Each schema release saves the managed-development report with its receipt.

## Known issues

- The Minecraft root wiki and its `achievements` collection still store the legacy paths `/minecraft/wiki` and `/minecraft/wiki/achievements` in `canonical_path`. So `site_routes` lists them as live, and the two Minecraft redirect rows lose to them (logged in `site_route_conflicts`). `minecraftLegacyRedirect` still serves those redirects, so it must keep running ahead of any route table lookup until Minecraft moves.
- Other games use three route systems for the same page types, and their URLs put the namespace first, unlike Roblox. The owner has approved a move to page-type URLs (`/wiki/<game>`, `/maps/<slug>`, `/games/<franchise>` for franchise hubs) backed by one route table that also holds every redirect. Until a game moves, publish it under its current routes and don't add route code for a single namespace.
