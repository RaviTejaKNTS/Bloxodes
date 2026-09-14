# Content and Engagement Pipelines

Status: Active
Last verified: 2026-09-14
Evidence: fresh managed-development page/item readback, all 386 web tests, isolated production web build, route metadata/search/sitemap/feed checks, and production overlap readback on September 14. Browser interaction QA remains unavailable. Earlier family counts below retain their August 14 scope.

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
