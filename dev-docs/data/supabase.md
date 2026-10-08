# Supabase

Status: Active; production and managed development include Red Dead and the shared collectible page type
Last verified: 2026-10-03
Evidence: official Supabase documentation, managed-development migration/readiness/advisor checks, production transactional release/readback, VPS container/process inspection, Edge Function checksum/smoke, and public health

## Shared non-Roblox storage

Last verified: 2026-10-06
Evidence: development checks and independent review, production backup hashes and full source-field comparison, 13 applied production migrations, exact-SHA deployment health, scoped live pages and successful shared-content queue processing.

Managed development and production use `games` and the shared `game_*` content tables. GTA, Red Dead and Minecraft no longer have separate content tables. Roblox stays separate. The October 6 production release deployed `49cbe765bb1a8f13b6967e6fcee800960534760a`. Earlier game-specific evidence below records the storage used before this release.

The page-type extension is applied in managed development and production. It adds `game_map_pages`, `game_quiz_pages`, `game_catalog_pages`, `game_quiz_progress` and three service-only security-invoker views, bringing that model to 16 tables and eight views. Eight new forward migrations cover the schema, comments, data validation, concurrent quiz history, snapshot protection and serialized publication. Generated types reflect the shared contract; `schema.sql` is the native production dump after this extension. See [content pipelines](../pipelines/content.md#shared-game-page-types) for the publication and safety contract.

Development and production have 16 shared tables and eight service-only `security_invoker` read views. Row-level security is enabled. Anonymous and authenticated roles have no direct grants. Server routes enforce page publication, user ownership, trusted mutation origin and rate limits.

Thirteen forward-only migrations were applied in managed development and production: `20261006065358`, `20261006070414`, `20261006071532`, `20261006072758`, `20261006073445`, `20261006074815`, `20261006075942`, `20261006081101`, `20261006081924`, `20261006081931`, `20261006082417`, `20261006082803` and `20261006083229`. Their local versions match both migration ledgers. The retirement migration removes obsolete tables without `CASCADE` after a complete source-field comparison. Historical migrations remain unchanged.

Page publication uses the service-only `publish_game_content_batch` function. Its default check runs the entire batch inside a transaction and rolls it back. Applying commits all groups together; one invalid row rolls back the whole batch. Tool codes come from their slugs through a database trigger and constraint. Release rows require a game owner. Codes-page FAQs require nonempty question and answer strings.

Deleting items locks their dataset before checking publication. Concurrent REST verification confirmed deletion waits for that lock and then rejects removal of published items. Incomplete unpublished revisions can be removed with their items. Ordinary edits cannot change route identity.

`supabase/types/shared-games.ts` is generated from the live development schema and constrains the shared table mapping. `supabase/schema.sql` is the native PostgreSQL public/extensions schema dump taken after the production retirement. It includes the shared tables and excludes the old game tables.

Database deployment readiness and all seven managed-development checks passed. The operational health endpoint still reports inactive Roblox stats jobs in development; this migration does not change those jobs.

Shared storage includes GTA standalone checklists, account collection progress and Minecraft release anchors. Existing comments retain their content types and IDs. New games use generic comment types. `game_content` events refresh owned paths and namespace cache tags, search, sitemaps and feed data. The development project has no deployed Bloxodes queue worker. Local authenticated `/api/revalidate` checks verify its consumer. The production worker already forwards arbitrary event types. Its only source change adds `game_content` to a TypeScript union; compiled JavaScript is unchanged. Production processed the three scoped namespace events successfully without an Edge Runtime restart.

Eight page-type migrations also match both ledgers: `20261006111415`, `20261006111847`, `20261006112402`, `20261006113213`, `20261006113819`, `20261006113934`, `20261006114258` and `20261006114354`. Production application at schema SHA `048123eda0ed18f813da5fa6f7f776a7d6a8fc8e` passed its rollback-only plan first. Readback confirmed RLS on all four new tables, no anonymous/authenticated read grants, three protected views and both service-only publication/progress RPCs. All nine published GTA map rows passed frozen-snapshot validation and full importer readback. The native public/extensions schema dump includes this live contract.

## Managed Development

Minecraft migrations `20261002134153`, `20261002142559`, `20261003112951` and `20261003115649` are applied in managed development and production. The October 3 edition release deployed `34541eb14b0fb5d2138539d01314a1597edc2105`. The rollback-only production plan contained only the two new edition migrations; application and ledger readback passed. Seven service-only tables own the Java and Bedrock games/wikis, immutable collection revisions, shared tools and ordered release anchors. Production verification confirmed RLS on all seven tables, no anonymous/authenticated SELECT grants, and `security_invoker=true` on all three protected views. The atomic activation function accepts only an exact 48-revision inventory and is executable by the service role. Production readback matched two published game/wiki identities, 48 pointers and content hashes, all 13,026 rows, their media mappings and authored copy, plus 50 owned search URLs. The legacy parent is unpublished, retaining its original revisions and comments. Shared tools and both release anchors retain their previous publication. The public/extensions schema snapshot was regenerated from the live PostgreSQL 17.6 database after application.

Production verified on 2026-09-07 at web SHA `bf7ea6ad71a9d6646f83077ceb373d2912ccf997`: five Red Dead hubs and six collections (271 items) are live with ten hosted hub images, sitemap/search coverage, and 100% Completion excluded. Production migrations `20260920000023` and `20260920000024` are applied. The 19 Roblox and 93 GTA legacy wiki checklist rows now use `collectible`; Red Dead has two collectible and four database collections. Saved-progress rows and storage keys were preserved. Standalone checklist pages are unchanged.

All workstation web development, content imports, script writes, migration validation, and article queue/writer work use the managed HTTPS `*.supabase.co` development project. Its private credentials live only in `.envs/targets/managed-dev.env` and workload-specific private overlays. Shared guards reject localhost and production when a development-only command runs.

The local Supabase CLI database is retired. Do not start it, generate/store a `local.env`, or use its Postgres/API endpoints for Bloxodes work.

## Production Topology

The self-hosted stack lives under `/home/codex-admin/bloxodes-supabase` and is reached through Traefik/Cloudflare hostnames.

- PostgreSQL: 17.6, ~59 GB.
- API gateway: Kong 3.9.1.
- REST: PostgREST 14.12 plus `supabase-rest-proxy` because direct sibling traffic historically timed out.
- Auth: GoTrue 2.189.0.
- Storage: storage-api 1.60.4.
- Edge Runtime: 1.74.0.
- Studio: 2026.06.03 build.
- Pooler: Supavisor 2.9.5.
- Deployed Bloxodes Edge Functions: `revalidate` and `cache-warm`; vendor/default folders also include `hello` and `main`.

Public unauthenticated health-shaped routes returning `401` is expected where an API key/basic auth is required. Storage status returned `200`; application `/api/health` database check returned healthy.

## Health Caveats

- On 2026-08-15, the `supabase-meta` image-level health probe had accumulated about 19,000 unreaped Node child processes over two months and was using about one CPU continuously. Recreating only Meta cleared the processes; Compose now explicitly disables that probe so it cannot recur. Meta remained running and public database traffic was not restarted.
- On October 2, the REST readiness listener moved from `localhost` to `127.0.0.1`. The former resolved to IPv6 while the probe attempted IPv4. Recreating only the active REST container restored its Docker health and `/ready` returned 200; other stack services stayed running. The original Compose file remains in `docker-compose.yml.before-readiness-repair-20261002`.
- Public REST returns the expected authenticated boundary and the app reads production successfully through Kong/proxy.

The remaining REST state is a monitoring defect, not a data-plane outage. Align its probe with the proxy topology in a separate tested change.

## Retired Local Stack

The old Bloxodes CLI project was named `roblox-codes` and leftover containers were observed on the verification date. They are historical workstation state, not an active environment. Removal can happen separately after confirming no unrelated work depends on them.

## 2026 Upgrade Watch

Official changelog items relevant to this self-hosted installation:

- Envoy became the default gateway in August 2026. Production still uses Kong and a custom REST proxy, so upgrades must deliberately retain/test this topology or migrate it.
- `API_EXTERNAL_URL` now includes `/auth/v1` in current self-hosted defaults. Verify OAuth/SAML callback assumptions before adopting vendor env changes.
- Analytics and Vector became opt-in. Current production container inventory does not include those vendor services; Umami is a separate application stack.
- Studio/Postgres Meta moved from `supabase_admin` to `postgres`; review ownership and re-enable a proven bounded Meta probe before vendor upgrades.
- Default self-hosted Postgres moved to 17. Production is already on Postgres 17; do not remove the production PG17 override without reviewing the vendor compose.
- Current Supabase client libraries require Node 22+; Bloxodes builds/runs with Node 24.

## Schema and Security

On September 14, 2026, production applied GTA standalone checklist migrations `20260920000025`–`20260920000032` through the exact-SHA transactional release at `1debfe3840377d900c7341d2dcb696a287306b17`. The four page rows, task counts (151/168/153/27), search entries, security-invoker view and service-only table grants were read back successfully. The checked-in schema snapshot was regenerated from production after application. Managed-development advisors report the expected no-policy notice for these service-only RLS tables; there are no anonymous/authenticated grants. The earlier topology evidence below retains its original verification date.

- Add forward-only migrations under `supabase/migrations/` using the current CLI workflow in `supabase/AGENTS.md`.
- `supabase/migration-policy.json` preserves the audited reconciliation record. Managed development received the four pre-cutoff stats migrations under a recorded baseline; production received the genuine pending wiki/article migrations and four object-proven ledger repairs. Both environments were then converged through `20260920000013_harden_internal_security_definer_execution.sql` on 2026-08-14.
- The convergence migration moves the privileged admin implementation into a private schema and narrows queue, worker, chart, and pipeline-health RPC execution. Readback confirmed the private admin function, expected service-role execution, and removal of anonymous execution for the protected RPCs in both environments.
- Migration `20260920000014_repair_wiki_pages_view.sql` corrects an object-level production drift where the ledger recorded the earlier view migration but the live view still lacked `universe_game_description_md` and `last_playing_refreshed_at`. It recreates only the read view and grants, without changing source-table data.
- Task migrations use the GitHub managed-development schema job with a Database read/write token for `bbtcaurrtyoukvjbxbbj`. The connector remains available for read-only inspection and advisors. The database password is deliberately absent from workstation and CI env. Self-hosted production CI uses the exact-SHA `supabase:production:release` command through HTTPS Studio as `supabase_admin`, after development verification. SSH and Dokploy remain explicit operator transports. Plans roll back; approved CI application commits atomically and verifies the ledger. SSH forwarding and public Postgres remain disabled.
- On October 7, read-only inspection verified 13 connector timestamp aliases against their stored SQL. Nine match exact or trimmed file bytes; the collection-runtime difference is formatting. Three GTA definitions contain old tools branches removed by verified migration `20260902122707`; the recorded October 6 retirement removed the legacy tables and functions. `managed_dev_history_aliases` pins both SQL/file hashes. GitHub run `37569597377` proved and applied history repair at `631a8c3cb6caa53b9bf217d7b5403775fbd7dfa2` and passed all seven readiness checks. Readback found all 13 canonical and all 13 original records, with retired legacy tables still absent. CI copied original SQL evidence without recreating tables or rewriting page data.
- The October 7 SQL-byte audit also compared all recorded post-convergence file hashes. Outside those aliases, three differences remain: `20260920000013` and `20260920000027` omit file-header comments in the ledger; `20260920000028` has identical statements on one line. `managed_dev_sql_equivalences` pins both hashes for these reviewed records. New CI applications store exact SQL bytes atomically. Receipts reject changed applied versions or missing SQL evidence and include only hashes proven against the ledger.
- `npm run supabase:production:release -- --approved-sha <full-sha>` is now also the repeatable read-only proof that production remains converged: when no repository migration is pending, it completes its transaction plan and rolls back without applying changes.
- The production `revalidate` Edge Function matches the Minecraft release source as of 2026-10-03, SHA-256 `cf77cdb15f9942d7d627f46accded2e64633c7caf35d132151ba90ecafd895b7`. Use `npm run supabase:production:function:release -- --function revalidate --approved-sha <full-sha>` for checksum-only planning; applying a changed function additionally requires `--apply --confirm "APPLY revalidate"`, performs an authenticated smoke test, and rolls back the function file if restart/smoke fails.
- Keep RLS on exposed tables and never expose service-role keys to clients.
- Views exposed to anon/authenticated roles need security-invoker behavior or explicit privilege review.
- Revalidation/cache queues are part of runtime freshness; schema changes affecting public content must update their event mapping.
- The GTA vertical is intentionally separate from Roblox data: `gta_games`, `gta_wiki_pages`, `gta_wiki_collection_pages`, and immutable `gta_wiki_collection_datasets`/`gta_wiki_collection_items`. GTA collection pages use `page_type` (`database` or `collectible`), while signed-in collectible progress is stored separately in `user_gta_collection_progress` and accessed only through the server-side `/api/gta/collections/progress` route; signed-out progress remains in the browser. GTA hub media uses distinct `gta_games.cover_image` (card/social artwork) and `gta_games.hero_image` (enforced-square title thumbnail) values, with the active URLs pointing to canonical Bloxodes wiki-media R2 objects after `sync:gta-wiki-media`. Roblox collection pages use the same `page_type` contract on `wiki_collection_pages`, but reuse the existing `user_checklist_progress` table under the `wiki-collection:<code>` namespace through `/api/wiki/collections/progress`. Public web reads remain server-side through the service role; base-table grants are revoked from `anon` and `authenticated`, RLS stays enabled, and read views use security-invoker behavior. Managed development and production both have the GTA and Roblox collection page-type schema. Production verification found 173 published GTA collection pages, 7,529 active GTA items, and the exact 19 approved Roblox collectible conversions with 1,134 items. GTA VI (`gta-6`) pre-launch coverage uses `games.status = 'upcoming'` and confirmed-only collections; production publication is a separate approved release. Red Dead is also live with five hubs and six collections, as recorded above. No GTA tools table or route is present until there is a real tool to publish.

## Backups

Database and Storage backup/recovery work is explicitly deferred by the owner. The VPS retains original 2026-06-12 managed-to-self-hosted dump/restore artifacts, but this change does not inspect, modify, validate, or automate them. A later dedicated run must own retention, off-host copies, and tested restores.

## Red Dead and collectible rollout (2026-09-07)

Wiki collection page types are `database` and `collectible` across Roblox, GTA, and Red Dead. Legacy wiki `checklist` values are normalized during rollout; standalone `/checklists` pages and progress storage keys remain unchanged. Red Dead uses isolated `red_dead_*` tables, `/red-dead/wiki` routes, its own comments/search/revalidation mappings, and the shared collectible renderer. Migration `20260920000023` creates the Red Dead platform; `20260920000024` renames wiki collection types. Both have been applied in managed development and production.

Publish the five Red Dead hubs from reviewed game/wiki files using `publish:franchise-wiki-hubs -- --namespace red-dead --workspace <root> --game <slug>` (dry-run default; production writes require `--apply --allow-prod`). It checks distinct hosted cover/hero URLs and remaps parent/game IDs. Then publish only six approved manifests using `sync:franchise-collection-runtime`: Online Roles, RDR1/Revolver/Undead Story Missions, and RDR2 Cigarette Cards/Dinosaur Bones. The 100% Completion wiki stays unpublished. Runtime uses database revisions and shared R2 media, never workspace files.

## October 2 pipeline repairs

The owner reconnected the authenticated connector to managed-development project `bbtcaurrtyoukvjbxbbj`. Both repair migrations are applied there under the committed versions `20261002105551` and `20261002111156`. Rollback-only fixtures passed case-insensitive code upsert, provider priority, reactivation timestamps, repeated bundle insertion and partial bundle upsert. There were zero duplicate live canonical keys. Managed-development readiness passed seven schema/API checks. Security and performance advisors reported existing warnings and informational findings; neither reported an error.

Production functions `set_roblox_catalog_item_identity` and `get_roblox_item_pipeline_health` belong to `supabase_admin`. The ordinary `postgres` role is not a member, so a plan using that role fails and rolls back. The schema release command accepts explicit `--database-role supabase_admin` for this ownership boundary, retaining exact-SHA, clean-checkout, ledger, transaction and apply-confirmation guards. Dokploy transport uses the same allowlisted role and now exposes PostgreSQL errors on failure. After the owner approved these exact two versions, production plan/apply passed at SHA `339b177b3c2766a2c324da4d75d28dec74c0abd2`. The ledger contains both versions, all 256 duplicate legacy bundle aliases are retired, duplicate live keys are zero, and SLA health fields remain intact. The live public/extensions schema snapshot was regenerated after application.

The REST readiness repair initially left the socat proxy attached to the removed REST container's network namespace. Authenticated reads returned 502 until the proxy reattached. The proxy is now a Compose service named `rest-proxy`, with `network_mode: service:rest` and a healthy/restart dependency on REST. Future REST maintenance must reconcile `rest rest-proxy` together through the existing base and PG17 Compose files. Readiness, proxy namespace ownership, authenticated API traffic and app health were checked after repair. [Docker documents dependency startup and restart behavior](https://docs.docker.com/compose/how-tos/startup-order/).
