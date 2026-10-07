# Content and Engagement Pipelines

Minecraft tool presentation uses the shared Roblox `ToolCard` and Journey index grid. The 13 generated WebP covers are committed web assets under `apps/web/public/images/tools/minecraft/`, resolved by `lib/minecraft-tools/covers.ts` in the Minecraft read adapter. Development database copy and calculation rules use `game_tool_pages` with `namespace=minecraft`. Production also uses `game_tool_pages`; these assets ship with the web image and require no database publication. Generation prompts are recorded in `docs/2026-10-04-minecraft-tool-covers.json`.

Status: Active
Last verified: 2026-09-14
Evidence: fresh managed-development page/item readback, all 386 web tests, isolated production web build, route metadata/search/sitemap/feed checks, and production overlap readback on September 14. Browser interaction QA remains unavailable. Earlier family counts below retain their August 14 scope.

## GitHub page validation and publication

Authoring stays in the assigned T3 task worktree. Validation, build and browser commands run on GitHub. Use the selected publisher registry and exact batches in `../operations/deployment.md`; do not copy whole tables or account progress. The shared non-Roblox publisher now accepts guarded production application only inside the approved content CI job. Roblox retains its separate publishers.

The page templates and routes are unchanged by this release. Queued articles and wikis now have CI dispatch hooks in source. Installed runtimes stay on their previous release until separately activated.

## Shared non-Roblox storage

Last verified: 2026-10-06
Evidence: development checks and independent review, production backup hashes and full source-field comparison, 13 applied production migrations, exact-SHA deployment health, scoped live pages and successful shared-content queue processing.

Managed development and production use `games` and the shared `game_*` content tables. GTA, Red Dead and Minecraft no longer have separate content tables. Roblox stays separate. The October 6 production release deployed `49cbe765bb1a8f13b6967e6fcee800960534760a`. Earlier game-specific evidence below records the storage used before this release.

Shared non-Roblox codes use `game_code_pages` and `game_codes`. The template has active/expired rows, copy buttons, redemption instructions, FAQs and comments. A code in `check` status stays hidden. Verification belongs to the target game's sources. Roblox codes and their automated refresh stay separate.

Shared tools use `game_tool_pages`; Minecraft retains its registered calculators and specialist publisher. New shared tools use an explicit registered `tool_key`, with `resource-cost` as the first generic calculator. Adding a different calculation requires a checked client implementation and rule validation.

GTA standalone checklist pages and tasks use `game_checklist_pages` and `game_checklist_items` in development and production. Their account progress still uses `user_checklist_progress` and existing `gta:<slug>` keys. GTA and Red Dead collection progress uses `game_collection_progress`; the old endpoints and local browser keys remain compatible. New namespaces use `/api/games/<namespace>/collections/progress`.

## Shared game page types

Last verified: 2026-10-06
Evidence: eight applied development migrations, atomic rollback and concurrent-save checks, all 472 web tests, the optimized web build and independent GPT-6.1-Sol review. Browser checks passed for map controls, catalog mobile width, checklist account saving and reload, and full and short quiz result reloads. All nine existing GTA map routes and eight test routes under Minecraft and Red Dead returned their correct canonical pages. Hidden-map visibility and authenticated revalidation passed. The production release passed migration, permission, snapshot and exact-SHA health checks, plus all nine owned live map URLs.

QA cleanup removed all 12 temporary reference pages, both test accounts and their saved progress. The nine real GTA map rows remain.

Non-Roblox games can use wiki pages, collections, codes, tools, maps, standalone checklists, quizzes and catalogs. They share tables by page type. Roblox keeps its own content model. Homepage and sidebar templates remain separate work.

- `game_map_pages` stores credited artwork and verified pins. The default map has search, categories, zoom and guide links.
- `game_quiz_pages` stores source-backed question banks. `game_quiz_progress` stores each account's seen questions and last result. The service-only save RPC merges history under a row lock.
- `game_catalog_pages` stores named columns and plain rows. Its default body is a table. A special interactive catalog requires a code change that supplies its own body through `GameContentPage`.
- `game_checklist_pages` and `game_checklist_items` already hold shared standalone checklists. All namespaces now use the neutral checklist template. Account progress keeps `user_checklist_progress` with `<namespace>:<slug>` keys. Roblox keys stay unchanged, and the internal `wiki-collection` prefix is reserved.
- `GameToolPageLayout` supplies the title, copy and tool-body slot. Calculators still require a registered implementation and verified rules.

Named reference pages use `/<namespace>/maps|quizzes|catalog|checklists/<slug>`. Their section URL lists published pages. Minecraft keeps its existing `/minecraft/<edition>/wiki` URLs; edition-specific reference slugs must be distinct. A franchise's child title owns its data through `game_id`.

Development now has 16 shared tables and eight protected read views. RLS is enabled, with direct access limited to the service role. Published views check page, game and parent visibility. Public routes include canonical URLs, escaped JSON-LD, search, sitemap, feed and `game_content` invalidation. Private progress responses use `no-store`.

Use `.agents/skills/bloxodes-game-plan/SKILL.md` to research a game and choose the page types that fit. Use `.agents/skills/bloxodes-games-reference-pages/SKILL.md` for maps, checklists, quizzes and catalogs. Existing wiki, collection, codes and tool skills remain the authoring entry points. Plans and source proof stay in ignored workspaces, not extra database fields.

`npm run publish:game-pages -- --namespace <slug> --file <reviewed.json>` validates the whole batch and rolls it back. Add `--apply` for an authorized development publication. The batch serializes writes within a namespace, keeps page ownership permanent, rejects invalid data and requires checkable tasks after checklist page or task updates. Production still requires explicit authorization and its target guard.

`npm run import:gta-shared-maps` validates the nine existing GTA snapshots. Add `--apply` to import them into development. Repeated imports make no changes. Registered `gta-layered` and `gta5` engines keep their original data and interaction code. Database hashes protect those frozen snapshots, and renderer identity cannot change during an ordinary edit. A deliberate snapshot update requires a reviewed forward migration and updated authoring files. New simple GTA maps use `image-pins` and appear in the GTA directory and sitemap.

The production release applied the eight page-type migrations and imported the nine GTA maps before web deployment. Stored snapshots and published map rows passed verification first. The existing map routes now depend on those shared rows.

The production release used schema commit `048123eda0ed18f813da5fa6f7f776a7d6a8fc8e` and web commit `118b66d471623c520b1e9ae4457523c5d51fdf09`. [GitHub deployment 37492747348](https://github.com/RaviTejaKNTS/Bloxodes/actions/runs/37492747348) passed exact-SHA web/database health. All nine map URLs, canonicals and GTA sitemap entries passed. The new quiz progress API returns private uncached responses and rejects anonymous requests. Web and Supabase container checks passed. No temporary test pages or accounts were published to production.

## Standalone checklist scope

Last verified: 2026-10-07
Evidence: user-confirmed editorial convention, checklist planning/research/writing skills, and the single-board composition in `ChecklistPageTemplate.tsx`. This is authoring guidance, not a database constraint or a new audit of published content.

Normally create standalone checklists only for source-verified 100% completion of a named game and supported edition or mode. Verify the full required activity set, thresholds, exclusions and alternative paths before proposing or writing the page. When sources do not establish that scope, defer it. Beginner milestones, preparation lists and repeatable routines need an explicit user exception recorded in the plan and brief.

Each detail page contains one checklist board. Group its requirements into sections within that board; do not combine independent checklists for different games or completion scopes on one page. Section directories list pages, not additional boards. Check existing coverage before proposing another page for the same scope.

The board's percentage counts checked tasks. It does not reproduce a game's weighted completion meter unless that relationship is verified. Required alternatives must let players complete a valid path without demanding mutually exclusive choices.

Collectible wiki collections remain separate. An achievements tracker can cover a verified Steam roster with checkmarks, but all achievements or collectibles do not establish in-game 100% completion. Do not relabel those trackers or use them to bypass the standalone checklist scope check.

Keep existing pages, URLs, saved progress and previously approved exceptions intact. This convention does not authorize retrospective removal or migration of content.

## Page Families

- Tools: 13 rows.
- Events: 22 page rows.
- Checklists: 14 rows.
- Quizzes: 13 rows.
- Articles: 419 rows.

Game wiki hubs and game-specific collections are a separate cohesive pipeline owned by `wiki-collections.md`. Global Roblox catalog pages are owned independently by `catalog.md`.

## Standard Workflow

1. Suggest or receive an approved opportunity.
2. Research production overlap, identity, sources, scope, and route expectations.
3. Write a typed `final.json` using the page-family skill.
4. Validate with the relevant `verify:*` command.
5. Import/seed into managed development and preview through the local Next.js process.
6. Promote with a controlled idempotent script or forward-only migration.
7. Revalidate public paths/tags and verify the published URL.

Content routes are server-first. Shared typed reads belong in `apps/web/src/lib/*`; page-family loaders belong in `page-data.tsx` where appropriate.

## Events and Puzzles

- VPS cron refreshes virtual events daily and seeds event details.
- Puzzle sync runs multiple source-time windows plus a strict daily audit.
- Puzzle source freshness, group rules, and LinkedIn availability are controlled through schedule env/process settings; do not move non-secret schedule defaults into secret files.

## Publication Contract

Every public family must account for metadata, canonical/JSON-LD, pagination, search, sitemap, feed where relevant, revalidation mapping, Cloudflare tags, and mobile/extension payload compatibility where relevant.

## GTA standalone checklists (2026-09-10)

Verified scope: managed development only; no production application in this task. Migrations `20260920000025`–`20260920000031` add GTA checklist content, seed GTA V plus San Andreas, Vice City, and the current GTA Online Career Progress snapshot, cover the title foreign key, align server-only access, and add verified collection-link copy. The checked-in files are sequenced after the existing GTA platform migrations. The managed-development connector recorded the two data-seed executions under its generated operation timestamps; those history rows were left untouched to avoid a risky rewrite, and the checked-in seeds remain idempotent for the normal migration path.

- `/gta/checklists`, `/gta/checklists/page/<page>` and `/gta/checklists/<game-slug>` share the platform-neutral checklist detail template, board, progress header and listing/card renderer. A game slug is sufficient: `/gta/checklists/gta-5`.
- `gta_checklist_pages` has one row per GTA title; `(game_id, slug)` references `gta_games(id, slug)`. GTA content never uses a Roblox universe ID. `gta_checklist_items` stores structural rows plus three-part `section_code` leaf tasks; `item_key` preserves IDs on content upserts.
- `gta_checklist_pages_view` is a security-invoker view of published pages belonging to published GTA titles. Tables and view are service-only with RLS enabled, matching existing GTA title access. Public HTML comes from the server reader; the view filters drafts and unpublished titles. Runtime reads the database, not the ignored research workspace or seed files.
- `ChecklistPageTemplate` serves both platforms. GTA cards receive an explicit public href. Browser/account progress uses the existing `user_checklist_progress` protocol with `gta:<slug>` keys; Roblox keys remain unchanged. `/api/checklists/progress` validates GTA pages and leaf IDs against the published page, preserves session ownership and origin checks, and rate-limits writes. This is Bloxodes account saving, not Rockstar save-game synchronization.
- GTA search and the checklist-specific search scope include `gta_checklist`. Publication/item/title changes update search/revalidation; `/api/revalidate` purges checklist pages/indexes, the game wiki, feed and GTA sitemap, then uses the existing deferred cache-warmer. The generic Edge Function worker needs no deployment change.
- The managed-development set now contains four published GTA checklist pages: GTA V (151 required tasks), San Andreas (168), Vice City (153), and GTA Online (27 current Career Progress snapshot tasks). The Story Mode boards track practical completion objectives, while their percentage is checked tasks rather than the weighted in-game percentage. The GTA Online page explicitly does not claim a universal 100% counter: it covers source-verified persistent Career Progress cards for PS5, Xbox Series X|S, and PC Enhanced and should be refreshed when Rockstar adds or changes a permanent challenge set. Heist choices, endings, threshold activities, and any-N collectibles/events are grouped so players do not have to complete incompatible alternatives.
- `verify:gta-checklist-final` validates final payload shape, stable item keys, managed-development page/item readback, leaf counts, and rendered routes without importing GTA content into Roblox tables. Verification also covers migration integrity/ledger, managed API readiness, service-only permissions and draft visibility, task count/title linkage, search, metadata/JSON-LD, sitemap/feed, pagination/404s and progress protocol tests. Browser visual QA was unavailable. Managed development currently has no published Roblox standalone detail pages, so Roblox regression coverage uses the shared code/progress contracts and index route.

### GTA V completeness review and guide links

Rechecked on 2026-09-10 against GTABase's GTA V 100% completion guide and PowerPyx's completion checklist. The 151 tasks cover the required story path and assassinations, Franklin side missions/prerequisites, all required hobby activities, any 14 random events and all 16 miscellaneous requirements (five tracked in Collectibles and stunts, eleven in Other activities). Alternative heist preparations/endings are grouped rather than requiring incompatible paths. The tennis task explicitly requires completing the configured match, which can be one game long.

Migration `20260920000029` adds links to twelve verified public GTA V wiki/collection destinations, preserving every item ID. Section descriptions link mission and activity references; relevant task descriptions link heists, random events, properties and the five required collectible/stunt collections. The intro explains that collection checkmarks and master-checklist progress are separate. `ChecklistDescription` is shared by Roblox and GTA at desktop/mobile sizes: it accepts only restricted site-relative Markdown links, leaves plain descriptions unchanged and never executes HTML. JSON-LD and the server text snapshot use the link labels as plain text. Public destination HTTP/title/canonical checks and parser tests passed; visual browser QA remains unavailable.

## Shared checklist and quiz presentation (2026-09-10)

Release clarification (September 14): migration `20260920000032` labels GTA Online as selected tasks and explicitly states that completing this partial board does not complete every Career Progress challenge or tier. The in-game Career tab is the player-state authority; Bloxodes wiki links are guides only. Task IDs and counts are preserved.

Production database release verified September 14: migrations `20260920000025`–`20260920000032` were planned with rollback and then applied atomically at schema commit `1debfe3840377d900c7341d2dcb696a287306b17`. Readback confirmed four published pages (151/168/153/27 tasks), four search entries, RLS and service-only access. Managed development records the three final data migrations under connector-generated timestamps; the reviewed SQL has been applied and verified without rewriting its historical ledger. Web publication follows this schema-first step. The schema-only GitHub run skipped deployment as intended.

`lib/engagement/types.ts` defines presentation contracts without database game identities; `config.ts` supplies platform copy, routes and progress namespaces/endpoints. Route-family `page-data.tsx` adapters own database reads and map Roblox universe or GTA title records to those contracts.

- `components/checklists/ChecklistIndexPage.tsx` and `ChecklistPageTemplate.tsx` render both Roblox and GTA. Keep layout, metadata generation, cards and interaction changes in these shared components.
- `components/quizzes/QuizIndexPage.tsx` and `QuizPageTemplate.tsx` own quiz presentation and metadata. Roblox adapters supply discovery-sidebar and related-content slots. `QuizRunner` accepts progress endpoints; cards cache progress by endpoint. Both list and detail use the configured progress namespace.
- Existing Roblox URLs, progress keys, API endpoints and 15-question attempt behavior remain unchanged. GTA checklist progress retains `gta:<slug>`. Future platforms must supply their own data adapters, route/discovery wiring and supported progress APIs; this refactor creates no GTA quiz pages or database tables.

Verification: shared-renderer/configuration tests, existing attempt/parser/progress tests and web typecheck passed. Managed-development HTTP checks cover both checklist indexes, GTA V detail, the quiz index and an existing quiz detail. Interactive browser QA remains unavailable.
