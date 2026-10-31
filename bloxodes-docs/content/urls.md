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

## Known issues

- Other games use three route systems for the same page types, and their URLs put the namespace first, unlike Roblox. The owner has approved a move to page-type URLs (`/wiki/<game>`, `/maps/<slug>`, `/games/<franchise>` for franchise hubs) backed by one route table that also holds every redirect. Until a game moves, publish it under its current routes and don't add route code for a single namespace.
