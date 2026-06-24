# Cards & Related Content Redesign Plan

Status: **Planning / not started**. Work through this incrementally, ticking items as we go.
Scope of this doc: **(1) the card system** and **(2) related-content recommendations**.
Homepage redesign is tracked separately (depends on the card system built here).

Parked for now (per decision):
- Charts / data-viz UI — deliberate later, separate effort.
- Ad slots — Mediavine Journey auto-places ads; current `ContentSlot` placeholders render nothing. Leave as-is. When we change ad networks, revisit. Do not remove reserved slot heights when redesigning (avoids CLS later).

---

## Why this work

Two product-level problems, not visual polish:

1. **Cards are simultaneously samey and inconsistent.** Eight hand-rolled card files diverge on nearly every axis (layout, aspect ratio, image tech, radius, date format, hover), yet a tool, quiz, and code page look interchangeable at a glance — type carries no signal.
2. **Related content is shallow and patchy.** Single-axis ("same universe only"), inconsistent placement, ~250 lines of duplicated JSX across 5 pages, and **3 page types are dead-ends** (wiki, checklists, catalog have zero onward links).

The fix for both is shared primitives: one card component and one related-content module. Build these once; the homepage redesign then composes from them.

---

## PART 1 — CARDS

### 1.1 Current state (audit)

Eight bespoke files, no shared base:

| Card | File | Layout | Image ratio | Img tech | Radius | Eyebrow | Date | Hover |
|---|---|---|---|---|---|---|---|---|
| Game/Codes | `components/GameCard.tsx` | vertical | 16:9 | next/image+blur | lg | ✗ | relative | border |
| Article | `components/ArticleCard.tsx` | vertical | 16:9 | next/image+blur | lg | ✓ universe | **absolute** | border |
| Quiz | `components/QuizCard.tsx` | vertical | **square** | plain img | lg | ✓ universe | relative | border |
| Checklist | `components/ChecklistCard.tsx` | vertical | **square** | plain img | lg | ✗ | relative | img scale |
| Tool | `components/ToolCard.tsx` | vertical | **square** | next/image | lg | ✗ | relative | img scale |
| Wiki | `components/WikiCard.tsx` | **text-overlay** | 1200/675 | **bg-image** | lg | ✗ | relative | img scale |
| Catalog | `components/CatalogCard.tsx` | **horizontal** | 64px thumb | next/image | lg | ✓ category | relative | text color |
| Events | `components/EventsPageCard.tsx` | **horizontal** | 64px thumb | next/image | **md** | ✓ status | relative | border+text |

Net: cards that should be a family look random; cards that should be distinct by type aren't. Three image technologies = three CLS/loading behaviors.

### 1.2 Target: one `ContentCard`, three variants, type-driven config

Replace the 8 files with **one primitive + a per-type config map**. The card reads type specifics from config; it never hard-codes them.

**Variants (layout shapes):**
- `media` — vertical, image-top. The index/home grid card.
- `row` — horizontal, 56–64px thumb left, content right. The **sidebar / related-rail** card (currently missing; sidebars cram full media cards into a narrow column).
- `overlay` — image + gradient + text on top. Reserved for hero/spotlight slots (what WikiCard does today), not general grids.

**Per-type config supplies:**
- `icon` + `accent` color — the type signal (e.g. green=codes/live, indigo=tools, violet=quiz, amber=events, slate=wiki).
- `eyebrow` source (universe name / category / status).
- `imageRatio` (16:9 for codes/articles/events; 1:1 for tools/quizzes/checklists; thumb in `row`).
- `stats[]` — the 1–2 scannable facts in a consistent stat row.
- optional `liveSlot` — a thin client overlay (progress ring, countdown, quiz preview) mounted over a server-rendered shell.

**Globally standardize (this kills the inconsistency):**
- [ ] One radius: `rounded-lg`.
- [ ] One image pipeline: `next/image` everywhere (drop plain `<img>` in Quiz/Checklist, drop bg-image in Wiki).
- [ ] One hover: border lighten + subtle image scale.
- [ ] `bg-card` background token everywhere.
- [ ] One date format: relative ("updated 3d ago") everywhere (Article's absolute date → relative).

### 1.3 Per-type card spec (media = index, row = sidebar)

- [ ] **Codes** — media: 16:9 cover, "{Game} Codes", stats `● N active codes` + `updated`. row: thumb + same. *Live:* keep green active-count; add "+N new this week" when fresh.
- [ ] **Tools** — media: 1:1 thumb, title, eyebrow "Tool" + utility chip ("free · no login"), `updated`. *Add a 1-line "what it does"* — tools currently show only title+date (too sparse).
- [ ] **Quiz** — media: universe eyebrow, title, `N questions` / `Completed ✓ score`. *Live (hero only):* first question inline, tappable options deep-link into the quiz pre-answered. Move the progress fetch into a thin client overlay so the shell is server-rendered.
- [ ] **Checklist** — media + row: title, `done/total` + progress bar (already good). *Live:* show the user's own % (already persisted); in `row` use a compact progress ring + 2–3 item thumbnails.
- [ ] **Wiki** — convert overlay → standard `media` for grids; keep `overlay` only as the spotlight variant. Add eyebrow "Wiki" + section/collection name stat.
- [ ] **Catalog** — keep horizontal idea, express as the standard `row` variant; keep "catalog size" metric as a stat; drop the bespoke tone system for the shared accent config.
- [ ] **Events** — keep status dot + countdown (best live card today) but rebuild on `row`/`media` so radius/tokens match. Countdown stays a `liveSlot`.
- [ ] **Article** — media: keep cover + universe + author footer, switch date to relative. row: drop author footer, keep title + universe + date.

---

## PART 2 — RELATED CONTENT

### 2.1 Current state (audit)

All sources are `universeId`-only.

| Page | File | Placement | Sources | Fallback? |
|---|---|---|---|---|
| Codes | `app/(site)/codes/[slug]/page.tsx` | aside | events, checklist×1, articles×3, tools×3, "more games"×N | only "more games" |
| Articles | `app/(site)/articles/[slug]/page.tsx` | aside | codes×1, events, checklist×1, articles×5, tools×3 | articles→latest |
| Quizzes | `app/(site)/quizzes/[slug]/page.tsx` | **in-body grid** | codes×2, articles×3, tools×2, catalog×2 | none |
| Events | `app/(site)/events/[slug]/events-page.tsx` | in-body | events/codes | partial |
| Tools | `app/(site)/tools/[...slug]/page.tsx` | in-body | related | partial |
| **Wiki** | `app/(site)/wiki/[slug]/...` | — | **NONE** | — |
| **Checklists** | `app/(site)/checklists/[slug]/page.tsx` | — | **NONE** | — |
| **Catalog** | `app/(site)/catalog/[...slug]/page.tsx` | — | **NONE** | — |

Problems: 3 dead-end page types; inconsistent placement (aside vs in-body grid); single-axis; hand-rolled 5×; full media cards jammed into a narrow sidebar.

### 2.2 Target system

- [ ] **(i) One shared `<RelatedContent>` module.** Server component taking the current entity + universe; renders all sections with consistent headers, the new `row` card variant, and analytics wiring built in. Every detail page calls it instead of hand-rolling. Removes the 5× duplication and the placement inconsistency.
- [ ] **(ii) Recommendation resolver with a fallback ladder.** Fill each section in priority order:
  1. Same universe (current behavior) →
  2. Same genre/tags (needs game tagging — see open question) →
  3. Trending / most-active (reuse CCU / active-count signal from homepage work).
  Each item carries a **stated reason** ("Same game", "Also anime", "Trending now").
- [ ] **(iii) Consistent placement.** Aside rail on ≥lg, collapsing to a stacked "Keep exploring" block at the bottom on mobile. One rule for all page types.
- [ ] **(iv) Cross-type & reciprocal** so the graph is fully connected:
  - codes → checklist, wiki, tools, quiz, events, articles
  - wiki → codes, checklist, tools, articles *(new)*
  - checklists → codes, wiki, tools, quiz *(new)*
  - catalog → wiki/codes/tools for that game *(new)*
  - quiz/article/tool/events → same hub set, placement moved to the shared aside
- [ ] **(v) One "live" hero slot per rail.** Top related item gets the rich treatment (first quiz question, or checklist progress ring + thumbnails); everything below stays calm `row` cards. Concentrates "liveliness" without bloating payload.

### 2.3 Net effect

Every detail page ends in a consistent, reason-labeled "everything for this game + where to go next" rail of compact `row` cards with one live hero item; 3 dead-end page types fixed; ~250 lines of duplicated JSX collapsed into one module fed by the fallback-ladder resolver.

---

## Build sequence

1. [x] `ContentCard` primitive + `media`/`row`/`overlay`/`bar` variants → migrate the 8 cards. **Done.**
2. [x] Game discovery sidebar on codes / articles / events / quizzes. **Done — see Progress.**
3. [ ] Live slots beyond quiz/checklist (if any) and further polish.
4. [ ] Per-type signatures (icons/accents) sweep, and homepage composition (handoff to homepage plan).
5. [ ] Wiki page sidebar — its own treatment (deferred; main content already links out).

## Progress log

### 2026-06-24 — Card system foundation (step 1) done, at parity
- New `apps/web/src/components/CardImage.tsx` — single image pipeline (plain `<img>` since `next.config` runs `images.unoptimized`), with onError → `/og-image.png` fallback. Replaces the 3 prior image techniques (next/image, plain img, bg-image).
- New `apps/web/src/components/ContentCard.tsx` — one shell, three variants (`media` / `row` / `overlay`) + slots (`eyebrow`, `subtitle`, `meta`, `liveSlot`, `footer`, `imageFallback`). Adds `data-card-type` on every card for future styling/analytics.
- All 8 cards rewritten as thin wrappers over `ContentCard`, prop signatures unchanged so every call site still works:
  - media: GameCard (codes), ArticleCard, ToolCard, QuizCard, ChecklistCard
  - overlay: WikiCard
  - row: CatalogCard, EventsPageCard
- Verified on `localhost:5050` (prod DB): typecheck clean, no server errors, all 8 types SSR with correct counts, unified `rounded-lg` (events was `rounded-md` before), tool/wiki/catalog cards visually confirmed.

### 2026-06-24 — Catalog / tool / event card improvements
- **Catalogs** — count-forward redesign. New `apps/web/src/lib/catalog-card-meta.ts` resolves a clean short label, a category icon, and a **live item count** per catalog code (avatar/items via `getAvatarCatalogCount`, music via a `roblox_music_ids_ranked_view` head count; content-only catalogs get name+icon, no count). `CatalogCard` now shows icon · short name · big count + unit · muted updated, replacing the truncated "ROBLOX MUS" initials tile and the heavy metric box. Wired into the homepage and `/catalog` index loaders.
- **Tools** — `ToolCard` now shows the `meta_description` (2-line), a derived **type chip** (Calculator/Converter/Planner/Optimizer/Extractor/Tracker/Generator), and a **game chip** when `universe_id` is set. De-generics the card.
- **Events** — `EventsPageCard` stripped to thumb · game · event · one **status/countdown pill** (green=live, accent=upcoming, muted=past/ended). Removed the status eyebrow, the separate countdown box, and the footer (counts + "updated").
- Verified on `localhost:5050` (prod DB): typecheck clean, no server errors, homepage + `/catalog` both 200; counts render live (e.g. 58,668 song IDs, 55,866 marketplace items).

#### Catalog follow-ups
- Counts are wired only for catalogs in `CATALOG_CONFIG` (the avatar/items family + music). Color codes, decal IDs, admin commands show name+icon but no count — add their sources later if wanted.
- Short labels live in `CATALOG_CONFIG` — easy to tweak wording.

### 2026-06-24 — Visual redesign of catalog / tool / event cards (round 2)
Feedback: round 1 added info but kept the same shapes → read as "more text, more clumsy". Round 2 makes them visual, lower-text.
- `ContentCard` extended: new **`bar`** variant (edge-to-edge image left + compact body) and **centered overlay** mode (`overlayAlign="center"`, optional `overlayScrim`, `overlayTextClassName`) for big hero text over imagery.
- **Events** → centered-overlay tile (16:9) modeled on the `EventCountdown` hero: dimmed game art + scrim, small uppercase status eyebrow, **big countdown as hero** (accent=upcoming, emerald=live), game name below. Past/art-less events show game name as hero on a clean dark card. Dropped the row layout, pill, footer.
- **Catalogs** → vibrant tone-gradient tile (indigo/emerald/amber) with a large faded category icon, **big count as hero** + clean name below (e.g. "58,668" / "Roblox Music IDs"). Removed the repeated unit, description, and updated line.
- **Tools** → compact horizontal `bar` card: small edge-to-edge image left, tool name + updated right. Dropped the description and type/game chips (wrong direction — tools want scannable, not dense).
- Verified on `localhost:5050` (prod DB): typecheck clean, no server errors; catalog counts render live; events countdowns tick; tools compact.

### 2026-06-24 — Card polish (round 3)
- **Tools** (`bar` variant): image is now an inset rounded square (equal corners on all sides, no half-rounded edge), more padding/breathing room, title up to 3 lines. Tool grids widened to max 3 columns (homepage + `/tools`) so long titles fit.
- **Events**: unified every status to the same 3-line shape — status label / big time / `game · event`. Past events now show the elapsed time ("3 months ago") as the hero instead of the game name, matching upcoming countdowns. The `game · event` line wraps to a 2nd line when long, but the height is reserved so the big time stays anchored at the same position across every card (`overlaySubtitleReserve`).

### 2026-06-24 — Game discovery sidebar (step 2) done
Scope: a single uniform, server-rendered "discover more of this game" sidebar on **codes, articles, events, quizzes** detail pages (not wiki/stats/catalog/tools/checklists). Driven only by `(universeId, universeName, currentType)`; the page's own type is excluded. No per-page special-casing.

- New `lib/game-sidebar.ts` — `getGameSidebarData(universeId)` fetches everything in one parallel pass: wiki, game catalogs (+ item counts), stats (rank/CCU/slug), next event (only upcoming/live), single codes page, checklist, quiz (+ deterministic first question), tools, articles. Falls back to general articles + global catalogs when the game has < 3 of its own cards.
- New helpers: `getWikiByUniverseId` (wiki.ts), `getQuizByUniverseId` (quizzes.ts), `getUniverseStatsSummary` (stats.ts).
- New components under `components/game-sidebar/`:
  - `GameDiscoverySidebar.tsx` (server container; ordered stack: wiki → catalog list → stats → event → codes → checklist → quiz → tools → articles → fallback). Server sub-cards (wiki, catalog list, stats, codes, articles) inline.
  - `QuizSidebarCard.tsx` (client island) — first question server-rendered for SEO; answering shows correct/incorrect feedback and deep-links to `/quizzes/<code>?qa=<optionId>`.
  - `ChecklistSidebarCard.tsx` (client island) — server shell + per-user progress bar.
  - Reuses `EventsPageCard` (countdown tile) and `ToolCard` (bar) directly.
- `QuizRunner` honors `startAnswerOptionId` (from `?qa=`): pins the server attempt, records Q1, starts at Q2.
- Pages: codes/articles already had a right aside → swapped hand-rolled related sections for `<GameDiscoverySidebar>`. events already had a 2-col aside → same swap. quizzes converted to 2-col and its in-body recommendations removed.
- Verified on `localhost:5050` (prod DB): typecheck clean, no server errors; sidebar renders SSR on all four page types; quiz card excluded on quiz page; catalog list shows "All N <items>"; stats shows rank + live CCU; quiz answer → `?qa=` → quiz opens at Question 2.

### 2026-06-24 — Sidebar component polish
- **Quiz card**: question image (when present) sits to the right of the question; options in a 2-column grid.
- **Catalog list**: now a card with a game-thumbnail cover, max 5 "All N <items>" links, and a "+N catalogs" button that expands to show all (client island). Moved to just above Articles (was right under Wiki).
- **Stats card**: minimal outline (no fill) — "<Game> Stats", "Current players" + big number, "Global rank #N" below. Now a **client island** that fetches `/api/stats/games/[universeId]` on mount + every 60s, so the CCU/rank stay live instead of going stale with the page cache.
- **Wiki card**: shows the game's square thumbnail (universe icon) instead of a generic book glyph.

### 2026-06-24 — Quiz layout + stats card tweaks
- **Quiz page** (`QuizRunner`): the on-page quiz was getting squished by the new 2-col page layout. Rebuilt it — question text with the image to its **right**, the 4 options **below** full-width, and removed the card border/background so it sits directly on the page.
- **Sidebar quiz card**: reverted to single-column options (one answer per row); dropped the image (that was meant for the quiz page, not the sidebar).
- **Sidebar stats card**: centered, no outline/background; label combined to **"Current Players on <Game>"** (wraps to a 2nd line for long names), a bigger number using compact notation (e.g. **64.9K**, 224.3K, 5.3M), and "Global rank #N" below.

#### Sidebar follow-ups (not blocking)
- The old per-universe related fetches still run on codes/articles/events (now unused) — can be deleted for a small perf win.
- Catalog list can get long for content-rich games (e.g. 16 entries) — consider a cap + "view all".

### 2026-06-24 — Shared ProgressBar (dark-mode visibility fix)
Problem: progress bars used a `bg-surface-muted` track (`rgb(20,23,29)`) sitting on a `bg-card`/`surface` card (`rgb(12,14,18)`) — ~indistinguishable in dark mode, so empty/low bars (fresh checklists at 0/120, quiz start) were invisible.
- New `components/ProgressBar.tsx` — one component: track `bg-foreground/10` (visible against cards in both themes), accent fill with a `max(0.375rem, N%)` min width so tiny progress still shows, clamped value, and built-in `role="progressbar"` + aria.
- Migrated all 7 usages onto it: ChecklistCard, ChecklistSidebarCard, ChecklistProgressHeader, ChecklistBoard (×2), QuizRunner, Forge crafting calculator. (Some already used `bg-border/70`; now all consistent.)
- Verified dark mode: track renders `rgba(238,241,247,0.1)` and is clearly visible at 0%.

### 2026-06-24 — Stats consistency (sidebar vs stats page)
Bug: sidebar rank ≠ stats page rank. Root cause = two rank sources. The stats page (`buildStatsGameDetail`) overrides rank with `loadLatestRank()` (latest `roblox_universe_rank_snapshots_hourly`), while the sidebar used the denormalized `global_playing_rank` column on `stats_game_current_index` (both its SSR seed and the `/api/stats/games/[id]` endpoint via `mapIndexedGame`). CCU was always the same `playing` column.
- Fix: exported `loadLatestRank`; `getUniverseStatsSummary` (SSR seed) now returns `loadLatestRank` for rank; `/api/stats/games/[universeId]` overrides `game.rank` with `loadLatestRank` (that endpoint is sidebar-only — charts use `/chart` + `/rank-chart`). Did **not** touch `getStatsGameSummaryByUniverseId` itself (reused by list builders in `Promise.all`, would add N queries).
- Verified: sidebar API rank 16 == stats page #16 for grow-a-garden.

### 2026-06-24 — On-demand revalidation now covers the sidebar
Findings while checking the on-demand flow (Supabase `revalidation_events` → `revalidate` edge fn → `/api/revalidate`):
- `lib/public-content-cache.ts` `publicContentCache` is a **no-op** (ignores its `tags`), so `revalidateTag` calls are effectively dead — all real revalidation is `revalidatePath` (ISR full-route cache).
- Cross-content revalidation previously only re-rendered the universe's **wiki** page (`lookupRelatedWikiSlugs`). The new discovery sidebar lives on **codes/articles/events/quizzes**, which were never cross-revalidated → sidebar went stale after sibling content changes.
- Fix (`app/api/revalidate/route.ts`): added `resolveUniverseIdsForEvent` + `lookupSlugsByUniverseIds` + `lookupSidebarHostPaths`. Any content event now also revalidates the universe's `/codes/<slug>`, `/articles/<slug>`, `/events/<slug>`, `/quizzes/<code>` (uses the same proven columns as `loadRelatedLinks`). `author`/`music`/`stats` excluded (stats sidebar is a live 60s client poll, so its host pages don't need revalidation).
- Volume note: `code` events are high-frequency (daily codes refresh) and now fan out to a game's article/event/quiz pages to refresh the sidebar codes card's active count. If that's too much churn, drop `code` from `resolveUniverseIdsForEvent`.

#### Stats freshness / revalidation (findings — NOT changed; needs a decision)
Same source now, but cache TTLs differ:
- `/stats/games` index → `revalidate = 0` (always live).
- `/stats` home → `revalidate = 600`.
- `/stats/games/[slug]` detail → `revalidate = 3600`; headline numbers are server-rendered (only charts poll), so up to 1h stale.
- Sidebar → client polls `/api/stats/games/[id]` (force-dynamic, 60s) → fresh ≤60s.
- `/api/revalidate` *can* revalidate stats paths/tags (`stats`, `stats-games`, `stats-game:<slug>`), but the hourly worker `scripts/universes/update-universe-hourly-stats.ts` never calls it — so nothing pushes stats pages fresh on update.
Options to make detail pages update on stats refresh (stats page redesign is deferred): (a) lower detail `revalidate`; (b) have the hourly worker hit `/api/revalidate` for refreshed games (precise, uses existing infra, revalidation cost); (c) live-poll the detail headline like the sidebar (touches stats page — defer). **Awaiting decision.**

### Deferred to refinement (intentional parity choices, revisit in step 4)
- **Date format still mixed** — kept the existing `formatUpdatedLabel` behavior (relative for recent, absolute for older; ArticleCard absolute). Plan calls for unifying to relative everywhere.
- **No type icons/accents yet** — only the `data-card-type` hook is in place.
- **Catalog metric box** now sits in the row's right-hand column (via `liveSlot`) instead of full-width under the thumbnail — minor layout shift to accept or refine.
- **Blur-up placeholders dropped** — `bg-surface-muted` placeholder color stands in (next/image blur was cosmetic only under `unoptimized`).

---

## Open questions (decide before building)

- [ ] **Genre/tag data for the fallback ladder** — do games already carry genre/tags anywhere, or add a field? If not available now, ship related-content v1 as universe-only + trending, add genre tier later.
- [ ] **Card migration scope for v1** — migrate all 8 cards at once, or start with the 4 used in related rails (codes/tools/checklist/quiz) and finish the rest after?
- [ ] **Live hero cost** — confirm the first-quiz-question and checklist-ring overlays stay server-shell + thin client (no per-card network fan-out like today's QuizCard `/api/quizzes/progress` fetch pattern).
