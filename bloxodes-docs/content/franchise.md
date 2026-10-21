# Franchise games

Last verified: 2026-10-21

Non-Roblox games: GTA, Red Dead, Minecraft, ARC Raiders, Mario Kart and whatever comes next. They share one set of `game_*` tables and one route system. Roblox content stays separate.

## Nightly run (MacBook Pro, 02:00 IST)

The T3 schedule "Bloxodes nightly other games (Content Factory)" runs in the [Content Factory](roblox-wiki.md#content-factory) with its `franchise-wiki-main` skill:

1. Takes the lowest-Priority `Ready` row from the [Other Games Queue](../automation/notion-queues.md) and sets it to `In progress`. The row's page holds the approved plan.
2. Builds the plan's wiki hubs and collections, one Luna builder and one Haiku content manager per page.
3. Publishes each game as a `game-wiki@1` bundle with `content:publish`, managed development first, then production. No PR or GitHub run.
4. Sets `Done`, or `Waiting for approval` when the plan has page types the factory doesn't build yet, and writes the Run report.

The factory builds hubs and collections only. Maps, quizzes, checklists, catalogs, codes and tools, and anything that needs code, still use the skills below, by hand.

Existing games (ARC Raiders and others) are updated by hand, not through the queue.

## Rules for every franchise page

Every franchise skill follows these. They're here once so the skills don't repeat them.

- **Resolve identity first:** namespace, `games.id`, editorial slug, `games.kind` and `parent_id`. Scope every query and write by namespace. No Roblox identifiers.
- **Keep scope explicit:** campaign, online service, expansion, mode, edition, platform and release generation. Never blend them, and don't call later-release content universal.
- **Spoilers:** keep late-story reveals out of titles, meta descriptions, intros, thumbnails and casual tips. Label necessary spoilers in the body.
- **Images:** every namespace root and every game needs a true landscape 16:9 `games.cover_image` and a separate square `games.hero_image`, from credited official key art, store art or real gameplay screenshots, hosted on `media.bloxodes.com`. Never pad portrait art. A wiki page can override its cover with `game_wiki_pages.cover_image`; tools use `game_tool_pages.thumb_url`. Quizzes, checklists, codes, catalogs and maps use their owning game's art, and collections use their first item image. Collection items need exact images; a gap is allowed only when no clean image exists, recorded item by item. `publish:game-pages` and the `franchise-wiki` publisher download every required image and reject missing, logo, broken or wrongly shaped ones before writing.
- **Same page as Roblox:** titles, headings, depth, layout and "no how to use this page" all follow [page standards](page-standards.md).

## Planning a new game

Start with `bloxodes-franchise-plan`. It decides whether the title is a single game or a franchise with several games, picks the useful page types, and checks the registry and routes. Put the final plan in the Other Games Queue row, then set it to `Ready`.

## Routes

| Page | URL |
| --- | --- |
| Franchise or game root wiki | `/<namespace>/wiki` |
| Child game wiki (franchise) | `/<namespace>/wiki/<game-slug>` |
| Collection | the owning wiki URL plus `/<collection-slug>` |
| Maps, quizzes, catalogs, checklists | `/<namespace>/maps|quizzes|catalog|checklists/<slug>` |

New namespaces use the registry-backed `[slug]/[[...segments]]` route. Reserved namespaces are listed in `apps/web/src/lib/game-route-names.ts`. Minecraft keeps its `/minecraft/<edition>/wiki` URLs.

## Data

- `games` is the registry. `kind` is `franchise` or `game`. A child game sets `parent_id`. `namespace` is the root URL slug.

| Page type | Tables |
| --- | --- |
| Wiki | `game_wiki_pages` |
| Collections | `game_collection_pages`, immutable `game_collection_datasets` and `game_collection_items`, progress in `game_collection_progress` |
| Maps | `game_map_pages` (credited art, verified pins, `faq_json`) |
| Quizzes | `game_quiz_pages`, account history in `game_quiz_progress` |
| Catalogs | `game_catalog_pages` (named columns and rows, `faq_json`) |
| Checklists | `game_checklist_pages`, `game_checklist_items`, progress in `user_checklist_progress` with `<namespace>:<slug>` keys |
| Codes | `game_code_pages`, `game_codes` |
| Tools | `game_tool_pages` |

RLS is on and only the service role reads tables directly. Public reads go through published views. Collection media uses the same R2 bucket as Roblox.

Live counts on 2026-10-19: 30 visible hubs and 405 visible collections (GTA 18/291, Red Dead 6/60, Minecraft 3/48, ARC Raiders 1/0, Mario Kart 2/6). Plus nine GTA maps, four GTA checklists, 13 Minecraft tools and one Mario Kart quiz.

## Skills

| Work | Skill |
| --- | --- |
| Plan | `bloxodes-franchise-plan` |
| Wiki hub | `bloxodes-franchise-wiki-workflow-runner` (+ research, writing, suggestions) |
| Collections | `bloxodes-franchise-game-collection-workflow-runner` (+ suggestions, research, data, images, writing, refresh) |
| Maps, quizzes, catalogs, checklists | `bloxodes-franchise-reference-pages` |
| Codes | `bloxodes-franchise-codes` |
| Tools | `bloxodes-franchise-tools` |

## Publishing

- **Wiki bundles (hubs and collections):** `npm run content:publish -- <abs-bundle>` with a `game-wiki@1` bundle (`contracts/game-wiki/v1/README.md`). It dry-runs by default, writes with `--target managed-dev --apply` and `--target production --apply --allow-prod`, and uses the same production guard as Roblox ([publishing](roblox-wiki.md#publishing)). Each target resolves its own game and page rows by namespace and slug, so development and production IDs don't need to match, and existing page UUIDs are kept. Cover and hero art, and item images, upload to R2 through the command. New games in registry-backed namespaces need no code. `content:status -- --namespace <ns> --game <slug>` shows what exists.
- `publish:game-pages` (`scripts/games/publish-game-pages.ts`) validates a whole typed batch and rolls it back unless `--apply`. It uses the `game-pages` publisher on GitHub.
- Collections use `sync:shared-game-collection-runtime` (the `franchise-collection` publisher). Export an existing one with `npm run export:shared-game-collection-workspace`.
- Hubs use the `franchise-wiki` publisher.
- Stage new game identities and hubs before their collections or quizzes. Shared page payloads need stable page UUIDs: choose them before first staging, or read and keep the existing IDs. A missing ID can fail the route ownership guard.
- Fully imaged collections are checked with `--require-images`. A missing item image needs an exact per-item accepted-gap record in the bundle's `images.json`.
- Events of type `game_content` refresh pages, namespace cache tags, search, sitemaps and the feed.

## Page type rules

- **Maps:** the default map has search, categories, zoom and guide links. The nine GTA maps keep their registered `gta-layered` and `gta5` engines and frozen snapshots. Changing a frozen snapshot needs a reviewed migration. New simple maps use `image-pins`.
- **Catalogs:** the default body is a table. An interactive catalog needs code.
- **Tools:** a new calculator needs a registered `tool_key` and checked client code. `resource-cost` is the one generic calculator. Minecraft calculators keep their own rules and publisher.
- **Codes:** a code in `check` status stays hidden. Codes are verified from the game's own sources. There's no automatic refresh for non-Roblox codes.
- **Checklists:** same scope rules as Roblox. See [standalone checklist scope](engagement.md#standalone-checklist-scope).

## Known issues

- Managed development has 25 `games` rows whose IDs differ from production (the GTA, Red Dead and Minecraft roots were aligned on 2026-10-19). `publish:game-pages` on the GitHub path needs matching IDs, so the first update to one of those games fails in CI staging until its development ID is aligned. `content:publish` isn't affected.
- `game_catalog_pages`, `game_code_pages` and `game_codes` have no production rows yet. The tables, skills and publishers exist, but nothing is published.
- `apps/web/src/data/gta-maps/*.json` and `gta5-map-*.json` are only importer inputs and test fixtures now. The live maps read `game_map_pages`.
