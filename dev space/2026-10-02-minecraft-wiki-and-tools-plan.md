Minecraft wiki and tools implementation plan

Date: 2026-10-02
Status: implementation and verification complete in managed development. Production remains pending separate approval.
Basis: the Minecraft planning conversation and the earlier repository/source research.

This file records the final decisions from the conversation. It supersedes the route structure, launch manifest, and guide/checklist scope in [the original strategy](../docs/2026-10-02-minecraft-content-strategy.md). All 41 named routes below are implemented. The final verification section records their publication status.

**Agreed structure.** Add one Minecraft section covering vanilla Minecraft. Java and Bedrock are edition variants within the same wiki and collection pages. The Minecraft wiki itself lists every published collection and explains the main game systems.

| Route | Purpose |
| --- | --- |
| `/minecraft` | Minecraft landing page with links to the wiki, published collections, and tools |
| `/minecraft/wiki` | Main Minecraft wiki, game overview, and complete collection directory |
| `/minecraft/wiki/[collection]` | Collection page containing its searchable entries and useful fields |
| `/minecraft/tools` | Directory of published Minecraft tools |
| `/minecraft/tools/[tool]` | Individual calculator, planner, or generator |

There is no `/minecraft/wiki/minecraft` hub, separate Java/Bedrock wiki, subgame directory, or individual item page. Collection entries stay within their collection pages, following the existing Roblox collection approach. Guides, standalone checklists, updates, and seeds are deferred. These deferred families must not appear as empty pages or navigation links.

The current work covers the vanilla sandbox. Other Minecraft franchise titles and modded systems are outside this plan.

**Java and Bedrock behavior.** Show shared facts once. Store differing values and rules with their edition applicability and display the selected edition's information. Label exclusive entries and filter them when an edition is selected. Remember the player's edition preference across collections and tools.

The selector changes content inside the same canonical page. It does not create separate Java and Bedrock route trees. Edition/version query parameters must not produce an indexable copy for every combination. Server rendering and browser interaction should agree on the chosen edition.

Tools that depend on edition rules must use the selected edition's verified rules. Show a clear unavailable result for unsupported combinations. Tools with identical behavior across editions can explain that once without requiring an unnecessary edition control.

Track the checked stable release independently for each edition. Historical and year-based version numbers require an ordered release registry, rather than alphabetical string comparisons. Keep experimental settings and snapshot/preview content separate from the default stable dataset. Commands, redstone, trades, recipes, and achievements need explicit edition handling where applicable. [Microsoft edition documentation](https://learn.microsoft.com/en-us/minecraft/creator/documents/differencesbetweenbedrockandjava?view=minecraft-bedrock-stable), [official version numbering](https://www.minecraft.net/en-us/article/minecraft-new-version-numbering-system).

**Complete wiki collection inventory.** All coverage categories proposed in the conversation are included. Closely related categories have separate collection pages when they answer different reference questions. Tools and weapons, music discs and pottery sherds, and advancements and achievements are split into named pages below. This produces 25 collection pages.

These are page scopes and useful-field plans, not verified item counts. Research each scoped roster before authoring, and use completeness claims only after checking the relevant stable edition/release.

| No. | Collection | Planned route | Useful content and fields | Order |
| --- | --- | --- | --- | --- |
| 1 | Enchantments | `/minecraft/wiki/enchantments` | Applicable equipment, maximum level, effects, conflicts, acquisition, edition differences | First batch |
| 2 | Potions | `/minecraft/wiki/potions` | Ingredients, brewing sequence, duration, potency, potion forms, restrictions | First batch |
| 3 | Villager trades | `/minecraft/wiki/villager-trades` | Profession, workstation, trade level, inputs, outputs, conditions, experimental trade rules | First batch |
| 4 | Mobs | `/minecraft/wiki/mobs` | Habitat, spawn conditions, behavior, drops, breeding and taming where applicable | First batch |
| 5 | Biomes | `/minecraft/wiki/biomes` | Dimension, terrain, climate, resources, structures, edition availability | First batch |
| 6 | Structures | `/minecraft/wiki/structures` | Eligible dimensions and biomes, discovery methods, hazards, loot categories, preparation | First batch |
| 7 | Ores | `/minecraft/wiki/ores` | Dimension, generation conditions, mining requirements, drops, uses | First batch |
| 8 | Food | `/minecraft/wiki/food` | Hunger, saturation, acquisition, preparation, effects | First batch |
| 9 | Blocks | `/minecraft/wiki/blocks` | Acquisition, mining tool, drops, recipes, uses, renewability | Second batch |
| 10 | Items and materials | `/minecraft/wiki/items` | Acquisition, stack size, uses, recipe relationships, edition availability | Second batch |
| 11 | Crafting and processing recipes | `/minecraft/wiki/recipes` | Station, recipe type, crafting pattern, ingredients and alternatives, output quantity, remainder items | Second batch |
| 12 | Tools | `/minecraft/wiki/tools` | Material, durability, repair ingredients, mining suitability, compatible enchantments | Second batch |
| 13 | Weapons | `/minecraft/wiki/weapons` | Acquisition, durability, repair, combat properties, compatible enchantments, edition rules | Second batch |
| 14 | Armor | `/minecraft/wiki/armor` | Protection properties, durability, acquisition, repair, enchantment compatibility | Second batch |
| 15 | Fuels | `/minecraft/wiki/fuels` | Supported station, burn duration, processing capacity, acquisition, remainder containers | Second batch |
| 16 | Crops and plants | `/minecraft/wiki/crops-and-plants` | Planting conditions, growth, harvesting, uses, supported growing methods | Second batch |
| 17 | Villager professions | `/minecraft/wiki/villager-professions` | Workstations, profession behavior, job conditions, related trades | Second batch |
| 18 | Status effects | `/minecraft/wiki/status-effects` | Sources, effects, duration and potency behavior, counters, edition applicability | Second batch |
| 19 | Armor trims | `/minecraft/wiki/armor-trims` | Template acquisition, duplication materials, equipment compatibility, visual examples | Second batch |
| 20 | Music discs | `/minecraft/wiki/music-discs` | Acquisition, drop or loot conditions, edition availability, playback details where verified | Second batch |
| 21 | Pottery sherds | `/minecraft/wiki/pottery-sherds` | Acquisition locations and conditions, pattern examples, uses, edition availability | Second batch |
| 22 | Redstone components | `/minecraft/wiki/redstone-components` | Inputs, outputs, signal strength, timing, uses, Java/Bedrock differences | Third batch |
| 23 | Advancements | `/minecraft/wiki/advancements` | Java criteria, prerequisites, required actions, rewards where applicable | Third batch |
| 24 | Achievements | `/minecraft/wiki/achievements` | Bedrock criteria, prerequisites, eligibility settings, platform differences where verified | Third batch |
| 25 | Commands | `/minecraft/wiki/commands` | Syntax, parameters, permissions, edition/version availability, tested examples | Third batch |

The tools collection describes in-game equipment. The `/minecraft/tools` directory contains Bloxodes calculators and planners. Navigation labels must make that distinction clear.

Advancements and achievements are reference collections in this scope. They do not authorize standalone checklist pages or a new progress system. Existing collection presentation can be reused where appropriate, but dedicated goal tracking remains deferred.

Explain dimensions within `/minecraft/wiki` and relevant biome/structure collections initially. Specialized loot tables can supply verified fields within collections. A separate dimensions or loot-table page remains a possible later scope decision, rather than an extra approved page.

**Collection page behavior.** Reuse Bloxodes' collection cards and list/table views. Each page needs a clear title, short explanation, useful sections, name/detail search, appropriate filters, and links to related collections or published tools. Larger collections need bounded rendering and pagination through the existing collection conventions when appropriate.

Display only useful supported fields. An entry can show edition-specific values or a clearly labeled difference within its card or row. Keep relationships such as recipe ingredients, equipment compatibility, and acquisition methods linked to collection pages or entry anchors. Those links must not create individual item routes.

Use stable entry identifiers and anchors so a tool can link to the relevant entry. Clarify whether variants, block states, unobtainable entries, or experimental entries belong in each collection's roster. Block entries and their inventory-item equivalents should share identity relationships without repeating all explanatory text. Profession entries explain the system; trade entries describe transactions.

Use Minecraft-specific layouts for recipe grids and brewing sequences where generic text fields would be difficult to use. Keep pixel art legible, and use exact approved item images or recorded text-only gaps. Maintain comfortable body text and the existing Bloxodes design tokens and shadcn components.

**Complete planned tool inventory.** The tool pages below carry forward the proposed tools. The first four have priority; the data-backed planners follow verified collection data. Stronghold triangulation is a later tool subject to formula verification. The inventory contains 13 tool pages.

| No. | Tool | Planned route | Inputs and useful output | Order |
| --- | --- | --- | --- | --- |
| 1 | Nether coordinate converter | `/minecraft/tools/nether-coordinate-converter` | Enter a position and travel direction; obtain corresponding coordinates and portal-linking explanation | First batch |
| 2 | Stack and storage calculator | `/minecraft/tools/stack-and-storage-calculator` | Enter an item and quantity; obtain stacks, remainder, and container requirements using the actual stack size | First batch |
| 3 | Furnace fuel calculator | `/minecraft/tools/furnace-fuel-calculator` | Select the supported station, item quantity, and fuel; obtain fuel requirements, batches, and leftovers | First batch |
| 4 | Pixel circle generator | `/minecraft/tools/pixel-circle-generator` | Choose diameter and shape options; obtain a block diagram, block count, and export | First batch |
| 5 | Anvil and enchantment planner | `/minecraft/tools/anvil-enchantment-planner` | Select existing gear, books, enchantment levels, and prior work; obtain a feasible combining order and step costs | Second batch, early |
| 6 | Crafting materials planner | `/minecraft/tools/crafting-materials-planner` | Choose desired outputs and owned materials; obtain recipe choices, raw materials, prerequisite steps, and leftovers | Second batch, early |
| 7 | Brewing planner | `/minecraft/tools/brewing-planner` | Choose potion, form, and quantity; obtain ordered ingredients, batches, and modifiers | Second batch |
| 8 | XP calculator | `/minecraft/tools/xp-calculator` | Enter current level/progress and target; obtain required experience using the stated edition/rules | Second batch |
| 9 | Beacon materials calculator | `/minecraft/tools/beacon-materials-calculator` | Choose the supported pyramid layout; obtain mineral block and material requirements | Second batch |
| 10 | Building materials estimator | `/minecraft/tools/building-materials-estimator` | Enter dimensions and select a supported shape/design; obtain counts and crafting requirements | Second batch |
| 11 | Gear comparison | `/minecraft/tools/gear-comparison` | Select equipment and assumptions; compare meaningful properties using verified edition rules | Third batch |
| 12 | Command generator | `/minecraft/tools/command-generator` | Select a supported command type, edition/version, and parameters; obtain validated syntax and explanation | Third batch |
| 13 | Stronghold triangulation | `/minecraft/tools/stronghold-triangulation` | Enter observation positions and bearings; obtain an estimated location and uncertainty | Later, after formula verification |

Command types can share the generator page through a selector. Add more generator routes only if a later scope decision establishes a distinct player need. The building estimator supports defined shapes/designs; it does not include the deferred building guide library.

| Deferred tool candidate | Reserved route proposal | Reason for deferral |
| --- | --- | --- |
| Slime chunk finder | `/minecraft/tools/slime-chunk-finder` | Seed-dependent prediction needs verified edition/version algorithms and a separate feasibility pass |
| Seed map | `/minecraft/tools/seed-map` | The seed work is deferred; a full prediction engine requires independent research, licensing checks, and regression testing |

These two candidates preserve the earlier tool ideas without adding seed work to the present implementation scope. They do not count toward the 13 planned tool pages and must not appear as empty tool listings.

**Tool correctness.** Keep supported inputs and assumptions visible where they affect the result. The Nether converter calculates coordinates; it cannot guarantee an actual portal link. Stack calculations must handle smaller-stack and unstackable items. Furnace calculations must account for supported stations, processable items, and leftovers. Pixel shapes need consistent odd/even behavior and exports that match the diagram.

The anvil planner must account for existing enchantments, compatibility, prior work penalties, and valid costs. Recipe planning needs shaped and shapeless recipes, stations, ingredient alternatives/tags, output quantities, remainder items, and cycles. An owned inventory changes the material requirement and must not silently count the same item twice. Brewing must use a verified sequence for the selected edition/version.

Record the dataset revision used by data-backed tools. Validate formulas with representative examples, invalid inputs, boundary cases, and edition differences before publication. Do not copy another calculator's results as the sole proof of correctness.

**Implementation checklist.** These checks describe managed-development implementation. Production publication requires separate approval.

- [x] Add Minecraft to `/games`, global navigation where appropriate, and namespace detection.
- [x] Implement `/minecraft` with useful links to actual published Minecraft content.
- [x] Implement `/minecraft/wiki` as the main Minecraft overview and collection directory.
- [x] Implement `/minecraft/wiki/[collection]` with shared collection rendering and Minecraft data adapters.
- [x] Implement `/minecraft/tools` and the planned tool routes with server wrappers and focused client components.
- [x] Add shared Java/Bedrock selection and persist the player's preference across collection/tool navigation.
- [x] Add Minecraft data ownership, stable entity identifiers, edition-specific facts, and per-edition release applicability.
- [x] Reuse immutable collection dataset revisions, published pointers, and the existing Bloxodes media workflow.
- [x] Extend the namespace-specific authoring, import/export, publication, and verification configuration for Minecraft.
- [x] Keep collection codes in `minecraft-<collection-slug>` format and scope data/media to Minecraft.
- [x] Use route-family `page-data.tsx` files and typed read helpers rather than repeated raw queries in route files.
- [x] Give Minecraft tool records explicit ownership; adapt current tool reads without assigning a Roblox universe ID or adding Minecraft entries to Roblox-only indexes.
- [x] Add Minecraft-scoped search covering published collections and tools; link entry results to collection anchors where useful.
- [x] Add metadata, canonicals, breadcrumbs, appropriate structured data, and social images.
- [x] Add sitemap coverage, feed coverage where applicable, pagination rules, and invalid-route handling.
- [x] Extend revalidation events, public cache tags, Cloudflare purge, and cache warming for published Minecraft content.
- [x] Wire existing comments only where the selected page type supports them, with Minecraft entity ownership.
- [x] Complete the final all-page route verification. All collection media, tool interactions and shared renderer checks have passed.
- [x] Verify Minecraft can publish and read back a representative collection and tool in managed development.
- [x] Apply schema changes through forward-only migrations with managed-development validation before any separately approved production application.
- [x] Update existing canonical documentation owners, scoped `AGENTS.md` files, and route/data/script inventories alongside implementation.

Minecraft now has explicit namespace support in the existing franchise publication and verification helpers. Its wiki route omits the game-slug level by the user's decision. Runtime reads use published database revisions and hosted media.

Research and media work should use the matching franchise collection skills once Minecraft is configured. The current skills require a configured namespace and must not substitute Roblox universe identity. Authoring remains in ignored workspaces; public runtime reads published database revisions and hosted media.

**Execution order.** All 25 collections are in the intended coverage. The batches prioritize delivery and do not remove later pages from the plan.

| Stage | Work | Completion evidence |
| --- | --- | --- |
| Foundation | Namespace, main wiki, collection/tool adapters, edition rules, publishing support | One enchantments collection and Nether converter work through the full managed-development flow |
| First content batch | Eight first-batch collections, four first-batch tools, and the landing/wiki/tools directory pages | Verified roster/data/media, calculator results, responsive routes, search, sitemap, and revalidation |
| Second content batch | Thirteen second-batch collections and six second-batch tools | Shared verified data supports recipes, brewing, equipment, and material planners |
| Third content batch | Redstone, advancements, achievements, commands, gear comparison, and command generator | Edition behavior, command examples, and related collection links pass verification |
| Later tool work | Stronghold triangulation | Verified formula, uncertainty explanation, and representative test cases |

The complete planned inventory is 25 collection pages, 13 tool pages, and three entry/index pages, for 41 named pages. Pagination is additional when needed. The first content batch contains 15 named pages: eight collections, four tools, and the three entry/index pages. These counts exclude deferred seed-dependent tools, individual item pages, and all deferred content families.

**Deferred scope.** Leave guides, standalone checklists and their progress APIs, update/news pages, seed galleries, seed-map work, quizzes, farm/building guide libraries, world imports, public server directories, and other Minecraft franchise titles for later decisions. The overview and explanatory copy inside collections/tools remain part of their pages. Routine dataset maintenance remains necessary even though public update pages are deferred.

**Data maintenance.** Research exact rosters and useful values against official documentation, release notes, reliable reference material, and reproducible gameplay where needed. Store source proof privately with the entity/field and checked edition/release. Do not claim complete coverage from an unverified old list.

Preserve stable entry IDs across immutable revisions. Review changes to relevant collections and tool rules when stable releases change gameplay. Keep unchecked or experimental information clearly scoped. Update visible verification dates only after a real review. Use original prose, approved media, and recorded asset reuse terms; host published media through the existing Bloxodes workflow.

Keep the agreed route structure throughout implementation. The user's decision is one Minecraft wiki, collection-level pages, and tools with edition-aware information.

## Managed-development verification, October 3

The isolated implementation branch is `feat-minecraft-platform-2026-10-02`, under `tmp/worktrees/minecraft-platform-impl`. Production has not been changed. The preview uses `http://teja-homelab.tail13b5bd.ts.net:3307/minecraft`.

The namespace, wiki, collections and tool routes reuse the existing Bloxodes page components. Minecraft-owned reads, search, comments, sitemaps, feeds, navigation and revalidation are implemented. Both forward migrations passed managed-development schema and rollback checks. The Java 26.3 and Bedrock 26.52 release anchors passed exact database readback and a zero-change idempotency run. Parent publication visibility, immutable datasets and client-access restrictions passed verification. Edition queries preserve one canonical per page and bypass shared CDN caching.

All 25 collection datasets and page copy completed research, data and image review. They contain 9,070 rows, including 8,715 image-backed rows and 355 individually accepted text-only rows. Selected block and trade images disclose representative states or variants where the source artwork cannot represent every outcome. Unverified Bedrock values remain absent. All 25 collections are published in managed development. All 25 collections have completed database and hosted-byte verification. Blocks passed its approved immutable pointer, all 1,284 row mappings, all 1,208 hosted image hashes and both edition routes.

All 13 tools are published in managed development with reviewed, self-contained rules at revision `java-26.3-bedrock-26.52-runtime-v3`. Readback compared every public copy field and rule object with its approved authoring file. The anvil planner supports verified Java rules; the other 12 tools support both editions. Browser checks passed all 13 tool routes. Interaction checks passed owned-inventory Bedrock crafting, brewing fuel totals, furnace station restrictions, Java anvil limits, Bedrock effect syntax, circle CSV downloads and mobile layout.

Focused Minecraft tests passed 35 cases. Shared page-contract checks passed 16 cases. Migration integrity passed for 218 migrations. Collection browser checks passed edition changes, pagination, list view, cross-page item finding, image lightboxes, credits and mobile layout. Blocks desktop/mobile visual review passed in both editions. The final HTTP review passed 93 checks covering all 41 named pages in both editions, including pagination, invalid routes, canonicals, robots rules, edition counts and Java-query navigation with a Bedrock cookie. The Minecraft sitemap lists all 41 pages. The shared feed and Minecraft search each include all 39 Minecraft content entries.

The final full web build passed compilation, TypeScript, generation of 117 static pages and trace collection. The preview was paused during that build and restarted afterward. Generated ads.txt and Next environment-reference changes were restored to the task baseline. These are managed-development results; production schema, content and deployment remain pending separate approval.

The HTTP review combines two preserved segments after the first auditor stopped with exit 143. Its 56 successful index/collection checks and body hashes remain recorded. The remaining 37 checks passed, and 65 authoring input hashes stayed unchanged during that segment. The first segment predates the input-hash snapshot, so the receipt does not claim a single atomic review. The initial cold development-compiler failure is also retained; the subsequent Java and Bedrock blocks browser checks both passed.

All 25 publication receipts reconcile to 9,070 rows, 8,715 image-backed rows, 355 approved text-only rows and 5,468 unique hosted collection objects. The task retains its source proofs, data/image approvals, public-byte hashes, readbacks, screenshots and release allowlist in the ignored Minecraft workspace. Production requires separate approval under the repository's database and content workflow instructions.

## Server-rendered edition directory follow-up, October 3

The shared wiki now has Java and Bedrock links styled as tabs. The server filters cards, entry counts and preview images from the exact published collection revisions. Card headings use neutral collection names, show the selected edition, and link explicitly to that edition. Java advancements and Bedrock achievements appear only in their respective directory views. Both views have 24 collection cards and retain one canonical wiki URL. The visible directory and its CollectionPage/ItemList JSON-LD match.

Edition changes work through ordinary anchor links. Middleware remembers the preference without browser code, and an explicit edition query wins over the cookie. Switching editions resets collection pagination to page one. Existing shared collection controls and tool inputs retain their client interactions.

The full build and TypeScript passed, along with 17 focused tests, 93 updated HTTP checks, four raw Googlebot/GPTBot requests and desktop/mobile browser navigation. Java and Bedrock recipe cards match their opened pages at 2,042 and 1,851 entries. Three HTTP checks were rerun after correcting the auditor's treatment of intentional edition-switch links; the original receipt remains available. The previous release allowlist is superseded by the new code snapshot and follow-up receipts. Production remains pending separate approval.
