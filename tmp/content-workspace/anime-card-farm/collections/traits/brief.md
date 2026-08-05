Recommendation: PROCEED

Evidence checked:
- Existing Bloxodes coverage: Production Supabase readback on 2026-08-05 returned no `wiki_collection_pages` rows for universe `10144587520` and no exact `anime-card-farm` / `traits` path match. Production also has no `wiki_pages` hub for this universe. Two published articles exist for the universe: `anime-card-farm-beginners-guide` and `anime-card-farm-mutations-guide`. The mutations article explicitly distinguishes mutations from Trait Gem rerolls, so this collection should cover only traits and link to that article rather than repeat mutation data.
- Game identity: Official Roblox API resolves universe `10144587520` to root place `125039473548047`, current title `[CRAFT🔨] Anime Card Farm`, current creator group `Anime Card Factory`, and canonical path `/games/125039473548047/Anime-Card-Farm`. The live Roblox page also says “By Anime Card Factory.” `dream without the vale` appears in older third-party/editorial attribution; treat it as a legacy studio attribution, not the current Roblox API owner.
- Source coverage: AllThings.How provides a complete exact-game table of 17 traits with effects and base roll chances, plus the Traits Roll NPC flow. The malformed DeFi Daily page reproduces the same table and surrounding instructions but appears to be an unfinished/copied draft, so it is not independent proof. Sportskeeda and Beebom independently confirm that Trait Gems are a real Anime Card Farm resource used to roll traits on cards. Roonby confirms that Voodoo Doll affects Trait Luck. No official Trello, changelog, or creator-authored trait table was found.
- Collection scope: Exactly 17 Anime Card Farm traits: Fortune I–III, Vigor I–III, Strength I–III, Assassin, Berserk, Tank, Rich, Emperor, Phoenix, Almighty, and Sovereign. Each row should record the listed Cash, Damage, and Health multipliers plus the listed base roll chance. Do not include mutations, artifacts, cards, codes, or Anime Card Clash traits as collection rows.
- System understanding: Traits are rolled onto cards at the Traits Roll NPC in the middle of the map by spending Trait Gems. A card holds one trait; another roll replaces the existing trait. The listed pool ranges from common 1.1x single-stat traits to Sovereign at 3x Cash, Damage, and Health with a 0.01% base chance. The 17 displayed chances total 99.99%, consistent with rounding.
- Why this should be a collection: The pool is finite, comparison-oriented, and directly supports a player decision: whether a result is worth keeping or rerolling. Separate multiplier columns make the effect tradeoffs much easier to scan than prose, while chance fields communicate rarity without inventing a subjective tier list.

Sources to use:
- Official Roblox experience: https://www.roblox.com/games/125039473548047/Anime-Card-Farm — canonical place and current creator-group check; official description confirms the card/upgrading/mutation game loop but does not publish the trait table.
- Official Roblox game API: https://games.roblox.com/v1/games?universeIds=10144587520 — authoritative universe ID, root place ID, current title, creator group, and canonical URL path.
- AllThings.How traits guide: https://allthings.how/anime-card-farm-traits-guide-all-effects-and-roll-chances/ — primary source for all 17 trait names, per-stat multipliers, base roll chances, one-trait limit, overwrite behavior, Trait Gems, and Traits Roll NPC flow.
- Sportskeeda Anime Card Farm codes: https://www.sportskeeda.com/roblox-news/anime-card-farm-codes — secondary confirmation that Trait Gems are used to roll traits on cards.
- Beebom Anime Card Farm codes: https://beebom.com/anime-card-farm-codes/ — secondary confirmation that the exact game distributes Trait Gems; useful identity/context cross-check, not a trait-table source.
- Roonby luck guide: https://roonby.com/2026/07/29/how-to-increase-your-luck-in-anime-card-farm-guide/ — secondary confirmation that Voodoo Doll improves Trait Luck; use only in supporting copy if needed, not to modify the listed base chances.
- Existing Bloxodes mutations article: https://bloxodes.com/articles/anime-card-farm-mutations-guide — related internal coverage and explicit guard that mutations and traits are separate systems.
- Anime Card Farm community guide: https://www.animecardfarm.wiki/guides/mutations-and-traits-guide — useful for player intent and the warning about wrong-game search results, but it deliberately avoids an exact trait table and is not evidence for row values.

Sources not to use as row authority:
- https://defi-daily.com/anime-card-farm-traits-guide/ — reproduces the exact table but the page exposes rewrite instructions, has a placeholder title, and looks like an unfinished copied draft. It can only be treated as a weak corroborating trace, not independent verification.
- https://animecardclashcalculator.com/anime-card-clash-wiki/Traits — belongs to Anime Card Clash. Its Trait Rerolls, bonuses, inheritance rules, and pool must not be imported.
- https://www.animecardfarm.wiki/ — useful identity warning, but its trait content is intentionally cautious and incomplete.

Verified roster from the primary table:

| Trait | Cash | Damage | Health | Base roll chance |
| --- | ---: | ---: | ---: | ---: |
| Fortune I | 1.1x | 1x | 1x | 16% |
| Vigor I | 1x | 1x | 1.1x | 16% |
| Strength I | 1x | 1.1x | 1x | 16% |
| Fortune II | 1.3x | 1x | 1x | 10.70% |
| Vigor II | 1x | 1x | 1.3x | 10.70% |
| Strength II | 1x | 1.3x | 1x | 10.70% |
| Fortune III | 1.5x | 1x | 1x | 5.33% |
| Vigor III | 1x | 1x | 1.5x | 5.33% |
| Strength III | 1x | 1.5x | 1x | 5.33% |
| Assassin | 1.5x | 1.5x | 1x | 1% |
| Berserk | 1x | 1.5x | 1.5x | 1% |
| Tank | 1x | 1.2x | 1.5x | 1% |
| Rich | 2x | 1x | 1x | 0.40% |
| Emperor | 1.2x | 1.5x | 1.5x | 0.30% |
| Phoenix | 1.75x | 1.75x | 1.75x | 0.14% |
| Almighty | 2x | 2x | 2x | 0.05% |
| Sovereign | 3x | 3x | 3x | 0.01% |

Data plan:
- Item count expected: 17.
- Useful fields: `name`, `effect_summary`, `cash_multiplier`, `damage_multiplier`, `health_multiplier`, `roll_chance_percent`, and `stats_affected_count`. Store multipliers numerically if the dataset convention supports it, then format as `1.5x` in the renderer.
- Grouping: Group by number of affected stats, not by an invented quality tier: three-stat traits (4), two-stat traits (3), and one-stat traits (10).
- Image needs: No reliable per-trait icon set was found. During the later image pass, inspect the in-game trait menu or source screenshots for distinct reusable icons. If traits are text-only in game or clean icons cannot be sourced, use no item images rather than unrelated anime/card art. A locally hosted screenshot may support page copy but should not be duplicated across all 17 cards.
- Known gaps or risks: The exact values currently depend on one strong complete guide rather than an official table. Recheck the guide and, if possible, the live in-game menu before committing data. Treat chances as listed base chances; do not calculate Voodoo Doll-adjusted odds without an official formula. The displayed chances sum to 99.99% because of rounding. Source pages may change after updates. Do not import Anime Card Clash data. Keep the current Roblox creator group and legacy `dream without the vale` attribution distinct.

Page layout plan:
- Section field: `stats_affected_count`.
- Section order: Three-stat traits, two-stat traits, one-stat traits.
- Section labels: `Boosts all three stats`; `Boosts two stats`; `Boosts one stat`.
- Why these sections help players: Players can first compare broadly useful all-stat results, then specialized dual-stat results, then single-stat rolls. This exposes tradeoffs directly and avoids presenting an unsupported S/A/B tier ranking.
- Card title field: `name`.
- Card description field: `effect_summary`, written as a compact factual sentence such as “Multiplies Cash and Damage by 1.5x.”
- Card key-value fields: `Base roll chance`, `Cash`, `Damage`, `Health`. Show unchanged stats as `1x` so cards remain directly comparable.
- Hidden/source-only fields: Source URL, source access date, raw source effect text, verification status, and any note about rounding or future in-game confirmation.
- Image field: Optional per-trait local image path; omit when no exact trait icon is available.
- Sort order: Within each section, strongest broad effect first, then lower base roll chance, then source roster order as the stable tie-breaker. Proposed visible order: Sovereign, Almighty, Phoenix, Emperor; Assassin, Berserk, Tank; Rich, Fortune III, Strength III, Vigor III, Fortune II, Strength II, Vigor II, Fortune I, Strength I, Vigor I.
- Section note needs: One short global note should state that chances are listed base chances and may not reflect Trait Luck bonuses. The one-stat section can note that Fortune affects Cash, Strength affects Damage, and Vigor affects Health. No per-section ranking claims are needed.
- Renderer/config changes needed: no, assuming the generic game-collection renderer supports three sections, numeric/text key-value fields, and image-optional cards.

Data readiness:
- Dataset file: `data/Anime Card Farm/traits.json`
- Item count: 17
- Source item count: 17
- Dataset shape: v2 wrapped `{ meta, items[].item, items[].system }` yes
- Public item fields: `name`, `cardSummary`, `rollChance`, `cashMultiplier`, `damageMultiplier`, `healthMultiplier`
- System fields: `slug`, `section`, `sortOrder`, `image` only yes
- Metadata: `schemaVersion`, `itemFields`, `columns`, `display.groupLabel`, `display.sectionOrder`, `display.tableFields`, `display.cardFields`, `display.fieldPresentation` all present
- Section source: Number of stats changed above the unchanged `1x` baseline, derived directly from the sourced Cash, Damage, and Health multipliers.
- Section counts: `Boosts all three stats` 4; `Boosts two stats` 3; `Boosts one stat` 10
- Section order: `Boosts all three stats` → `Boosts two stats` → `Boosts one stat`
- Card fields: `cardSummary`, `rollChance`, `cashMultiplier`, `damageMultiplier`, `healthMultiplier`
- Card/table field order: Effect summary → Base roll chance → Cash → Damage → Health
- Card summary coverage: 17/17
- Field presentation: `cardSummary` detail; all chance and multiplier comparisons chips
- Highlight fields: none; no source-backed status or recommendation field is needed
- Chip fields: `rollChance`, `cashMultiplier`, `damageMultiplier`, `healthMultiplier`
- Detail fields: `cardSummary`
- Field consistency: yes; all 17 rows have the same public keys, and every unchanged stat is explicitly `1x`
- Image needed: no; image research found only partial trait-menu screenshots with embedded glyphs, not a clean complete standalone icon set, so the accepted presentation is text-only
- Image field: `items[].system.image`
- Hidden/source/dev fields absent from public item data: yes
- Sort order: `items[].system.sortOrder`
- description_json section keys: `Boosts all three stats`, `Boosts two stats`, `Boosts one stat`
- Renderer/config support: registered as `anime-card-farm/traits`; generic renderer resolved the dataset, five card fields, all three sections, and 17 rows
- Missing items: none
- Audit command: `npm run audit:game-collection-datasets:v2 -- --game anime-card-farm --collection traits`
- Audit result: pass; 1 registered dataset checked, 0 issues
- Checker command: `npm run check:game-collection-data -- --game anime-card-farm --collection traits`
- Checker result: pass; 17 items, section counts 4/3/10, 17/17 card summaries; expected warning for 0/17 images
- Ready for images: yes

Image readiness:
- Image field: `items[].system.image`
- Expected image count: 0 for the accepted text-only presentation; 17 would be required before enabling per-trait card images
- Images found: 0 reusable standalone item images
- Images missing: 17 accepted gaps — Sovereign, Almighty, Phoenix, Emperor, Assassin, Berserk, Tank, Rich, Fortune I–III, Vigor I–III, and Strength I–III
- Image sources used: The AllThings.How trait guide and its source screenshots were inspected. The in-game Traits Machine screenshot shows small color-coded glyphs for only Fortune I–II, Vigor I–II, and Strength I–II. Those glyphs are embedded in one scrolling UI screenshot rather than supplied as standalone files, and no complete rare-trait icon set was found. Exact-name searches for Sovereign, Almighty, Phoenix, and Emperor returned no clean Anime Card Farm icon assets and mostly surfaced wrong-game imagery.
- Public image path: none; no `apps/web/public/Anime Card Farm/Traits/` directory is needed for this text-only collection
- Dataset image paths updated: no; all 17 `items[].system.image` values remain `null` intentionally
- Checker command: `npm run check:game-collection-data -- --game anime-card-farm --collection traits`
- Checker result: pass; 17 items, 17/17 card summaries, and 0/17 images with the expected non-blocking no-images warning
- Ready for writing: yes; the complete chance and multiplier fields provide the comparison value, and fabricated, unrelated, screenshot-cropped, or wrong-game art would reduce accuracy
