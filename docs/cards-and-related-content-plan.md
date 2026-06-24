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

1. [x] `ContentCard` primitive + `media`/`row`/`overlay` variants → migrate the 8 cards (visual parity). **Done — see Progress below.**
2. [ ] `<RelatedContent>` module + resolver → swap into all detail pages, add the 3 missing ones.
3. [ ] Live slots (quiz preview, checklist ring, countdown) as opt-in overlays.
4. [ ] Per-type signatures (icons/accents), card content enhancements, and homepage composition (handoff to homepage plan).

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
