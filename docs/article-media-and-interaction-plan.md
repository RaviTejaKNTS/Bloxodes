# Article Media & Interaction Plan

Status: **Phase 0 + Phase 1 implemented** (YouTube + images end-to-end). Later phases (inline checklists, account sync) still open. Tick remaining items as they ship.
Scope: make `/articles` pages less bland with **selective** YouTube embeds, **inline trackable checklists**, and **useful clean images**. Do not force any of these onto every article.

Related existing systems:

- YouTube markdown directive already lives in `apps/web/src/lib/markdown.ts` (`{{ youtube: ... }}`).
- Full progression checklists live at `/checklists` with account progress (`user_checklist_progress`, `/api/checklists/progress`). Article micro-checklists are a separate, smaller product surface.
- Article images already render via markdown + gallery/lightbox helpers (`article-galleries`, `ArticleImageLightbox`).
- Writing voice and structure stay owned by `.agents/skills/bloxodes-article-*` and `bloxodes-tech-article-writing`.

Parked for later (not in this plan unless explicitly pulled in):

- Mobile app article reading + progress sync.
- Auto-discovering YouTube videos via API without human/parent review.
- Building a full in-house image CDN beyond existing media hosting.
- Replacing `/checklists` pages with article-only checklists.

---

## Why this work

Articles today are mostly prose + occasional tables/lists. That is correct for many pieces, but how-to and fix articles often need:

1. A **perfect-match walkthrough video** when one exists.
2. A **short interactive checklist** when the reader is doing multi-step work and wants to check things off.
3. **Clean, non-annotated images** at the decision points where words alone are weak (menus, panels, UI states).

The goal is usefulness and texture, not decoration. Wrong or forced media makes pages worse.

---

## Product principles

1. **Perfect or skip** for YouTube and images.
2. **Action or skip** for inline checklists. Use them when tracking progress helps; never for pure explainers.
3. **Treat like tables/lists** — optional structured blocks, not required article sections.
4. **Markdown stays the authoring surface** for models and humans. Prefer directives/fences over free-form HTML in `content_md`.
5. **Stable IDs** for anything that saves progress. Item renames must not thrash checks carelessly.
6. **Local-first, account optional** for checklist progress (same mental model as codes/checklists).
7. **Article checklists ≠ `/checklists` pages.** Full checklists = long game progression. Article checklists = short in-article task blocks.
8. **Host media we care about.** Prefer Bloxodes-hosted images over hotlinking wiki/third-party URLs forever.
9. **Do not replace writing quality.** Voice, player texture, and accuracy still come first.

---

## Current state (audit)

| Capability | Status | Notes |
|---|---|---|
| YouTube embed in articles | **Done** | `{{ youtube: id-or-url }}` → `youtube-nocookie` iframe via `article-media.ts` + `markdown.ts`. `html-to-react` preserves `.video-embed`. Iframe host allowlist applied. |
| Writing skill guidance for YouTube | **Done** | Research / writing / tech / workflow runner skills include perfect-or-skip rules. |
| Inline article checklist UI | Missing | Phase 2+. GFM task lists are not a productized interactive component. |
| Article checklist progress API/DB | Missing | Only `user_checklist_progress` for full checklist pages. |
| Article images in markdown | **Done** | Host under `apps/web/public/articles/<slug>/`; markdown `![alt](/articles/<slug>/….webp)`. Galleries + lightbox remain. |
| Image sourcing standards in skills | **Done** | Clean non-annotated bar, rights notes, save script, verifier path checks. |
| Selective-use rules | **Done** | Documented in skills and plan; verifier warns on too many embeds/images. |
| Media verification | **Done** | `check-article-media.ts` + `verify:article-finals` (directive validity, local files, alt, rendered HTML). |

---

## When to use each block

### YouTube

**Use when:**

- Video topic matches the article promise almost exactly (same game system, same error, same procedure).
- Visual steps clearly help more than prose alone.
- Channel is trustworthy enough (official, well-known creator, or high-signal walkthrough).

**Skip when:**

- Only “related” or partial match.
- Video is outdated relative to the article’s evergreen claims.
- Video is mainly hype, codes spam, or unrelated B-roll.
- No decent match after a real search.

**Placement default:** after the stuck-moment intro / early in the “what to do” section. Not as the whole article.

### Inline checklist

**Use when:**

- Reader has multiple discrete tasks worth tracking.
- Troubleshooting fix order, prep list, multi-location collection, or short requirement list.
- Checking off items reduces re-reading while playing.

**Skip when:**

- Pure explanation, comparison, or news-style piece.
- One continuous numbered procedure is clearer as a normal ordered list.
- Content is really a comparison/requirements **table**.
- List would only restate headings.

**Relationship to full checklists:** if the job is a long durable progression route, prefer/link a `/checklists` page. Article checklists stay short (rough rule: ~3–12 items per block).

### Images

**Use when:**

- Image shows a menu, panel, map region, UI state, or layout that is hard to describe cleanly.
- Image is clean: no watermark, big arrows, “SUBSCRIBE,” competitor branding, or heavy text overlays.
- Image is rights-safe enough to host (prefer official assets, our own captures, or clearly usable sources; do not assume Fandom is free to reuse).

**Skip when:**

- Generic game art that does not teach a step.
- Annotated / watermarked / meme-style frames.
- Hotlink-only assets we cannot host.
- Image would only pad the page.

---

## Proposed markdown surfaces

### YouTube (already supported)

```md
{{ youtube: https://www.youtube.com/watch?v=VIDEO_ID }}
```

Also accepts bare video IDs and common YouTube URL shapes (watch, youtu.be, embed, shorts).

### Inline checklist (to build)

Prefer a fenced/directive form with a **stable block id**:

```md
:::checklist id="ascension-prep"
- [ ] Level two mons to 25
- [ ] Catch 35 total
- [ ] Open Ascension menu
- [ ] Press Ascend
:::
```

Requirements for the final syntax:

- Stable `id` per checklist block on the article.
- Stable item keys (derived from explicit keys or durable slugs, not raw array indexes alone).
- Multiple checklist blocks allowed per article when sections need them.
- Falls back to a readable static list if JS fails.
- No free-form HTML required from the writing model.

Exact fence syntax can be adjusted during implementation as long as the writing skill documents one canonical form.

### Images (already supported)

Standard markdown images, preferably hosted under Bloxodes public/media paths once sourced:

```md
![Ascension menu with the Ascend button highlighted by clean UI only](/images/articles/.../ascension-menu.webp)
```

Do not paste watermarked remote wiki URLs as the long-term source of truth.

---

## Progress model (inline checklists)

Target behavior:

1. Guest: progress in `localStorage` keyed by article slug + checklist id.
2. Signed-in: merge/sync to account, same local-first spirit as checklist/code progress.
3. Item identity: `article_slug` + `checklist_id` + `item_key`.
4. Editing policy: changing item label may map to a new key; prefer explicit keys if thrash becomes a problem.
5. Do not write into `user_checklist_progress` (that table is for `/checklists` page slugs). Use a separate table/API, e.g. `user_article_checklist_progress` or a generic content-progress store scoped by page type.

Suggested payload shape (illustrative):

```json
{
  "articleSlug": "evomons-ascension-guide",
  "checklistId": "ascension-prep",
  "checkedKeys": ["level-two-mons-to-25", "catch-35-total"]
}
```

Security/product defaults:

- Auth required for account write; guests stay local-only.
- Origin validation + rate limiting on mutation routes.
- No public read of other users’ progress.

---

## Phased rollout

### Phase 0 — Content rules + YouTube end-to-end

**Goal:** use perfect-match YouTube embeds safely and stop models from forcing media.

- [x] Update `bloxodes-article-research` brief template with Media plan fields (`perfect` / `near` / `none`, image candidates, rights notes).
- [x] Update `bloxodes-article-writing` and `bloxodes-tech-article-writing` with `{{ youtube: ... }}` usage and skip rules.
- [x] Update `bloxodes-article-workflow-runner` parent QA for perfect-or-skip media.
- [x] Shared helpers in `apps/web/src/lib/article-media.ts` + unit tests.
- [x] Markdown renderer uses shared inject; iframe host allowlist for youtube-nocookie only.
- [x] `verify:article-finals` fails on invalid YouTube directives and checks rendered embeds.
- [ ] Pilot on 3 article types on real content batches (ongoing with next article jobs):
  1. tech fix / error
  2. game how-to / system
  3. comparison or explainer
- [ ] Parent review after pilot: more useful, or just busier?

**Exit criteria:** writers/models can embed YouTube correctly when a perfect match exists; research briefs explicitly record media decisions; no new DB/API required. *(Implementation exit met; content pilots continue.)*

---

### Phase 1 — Image sourcing standards + hosting habit

**Goal:** make useful images a normal research output with hosted paths and verification.

- [x] Document image acceptance bar in skills (clean, non-annotated, non-watermarked, step-relevant).
- [x] Host under `apps/web/public/articles/<article-slug>/…` (matches existing article public tree).
- [x] Require alt text that describes the useful UI fact, not keyword stuffing.
- [x] Record source URL + rights note in research brief / optional workspace `media.md` (not public body).
- [x] Block hotlinked Fandom/wiki/competitor CDNs in media checks.
- [x] Image QA in `check-article-media.ts` / `verify:article-finals` (path exists, alt, src policy).
- [x] `npm run content:save-article-image` downloads/converts to webp and prints markdown snippet.
- [x] Cover images remain separate (`cover_image` / import-generated covers vs body step images).

**Exit criteria:** new articles can ship 0–3 hosted clean images with verifier coverage; research notes include source/rights. *(Implementation exit met; content pilots continue.)*

**Legal note:** “found on Fandom” is not automatic permission. Prefer official/Roblox-permitted captures, assets we create, or sources with clear reuse terms. When unsure, skip the image.

---

### Phase 2 — Inline checklist product (core)

**Goal:** markdown checklist blocks become live, checkable UI with local progress.

- [ ] Finalize canonical markdown syntax + examples in skills.
- [ ] Parse checklist blocks in markdown pipeline (or post-process HTML) into a stable structure.
- [ ] Render interactive client island (checkbox list, progress count optional, accessible labels).
- [ ] Persist guest progress in `localStorage`.
- [ ] Server fallback: static checklist/list markup if client JS unavailable.
- [ ] Styling matches article body / design tokens (quiet, Notion-like shell, not admin-dashboard density).
- [ ] Support multiple checklist blocks per article.
- [ ] Unit/integration coverage for parser + progress key stability.
- [ ] Writing skill: real examples of good vs forced checklists.
- [ ] Parent QA: item count, stable ids present, not used on pure explainers.

**Exit criteria:** a published article with `:::checklist` (or final syntax) is interactive for guests; refresh keeps checks locally.

---

### Phase 3 — Account sync for article checklists

**Goal:** signed-in users keep progress across devices/sessions.

- [ ] Forward-only Supabase migration for progress table (separate from `user_checklist_progress`).
- [ ] `GET`/`PUT` API route under `apps/web/src/app/api/...` with origin validation + rate limiting.
- [ ] Client merge strategy: local ↔ server (define last-write or union-of-checked rules explicitly).
- [ ] Wire into existing Roblox/account session patterns (same family as checklist/code progress clients).
- [ ] Document endpoint in `agents/routes/agents.md`.
- [ ] Manual QA: guest local only; login merges; logout does not leak another user’s state.

**Exit criteria:** signed-in user can check items on device A and see them on device B after sync.

---

### Phase 4 — Workflow polish & quality gates

**Goal:** media/interaction quality is repeatable in the content factory.

- [ ] Research skill: hard skip rules for near-match YouTube and annotated images.
- [ ] Writing skill: one structured media block per relevant section max (avoid stacking video + checklist + image for the same idea without need).
- [ ] Workflow runner verify step:
  - invalid YouTube directive fails or warns
  - checklist ids present when checklist used
  - image paths resolve locally when claimed
- [ ] Optional seed/preview checklist for articles that use new blocks.
- [ ] Collect 5–10 shipped examples as internal style references (good embeds, good checklists, good image placement).
- [ ] Decide whether tech articles default more often to checklist/scan-table combos than gameplay explainers.

**Exit criteria:** new articles follow selective media rules without parent re-teaching every batch.

---

### Phase 5 — Optional extensions (only if needed)

Pull in only with a clear product reason:

- [ ] Mobile article checklist progress API (if articles become first-class in `apps/mobile`).
- [ ] Explicit item keys in markdown (`- [ ] id:catch-35 | Catch 35 total`) if rename thrash is painful.
- [ ] Lazy/facade YouTube (thumbnail click-to-load) for performance/privacy if embeds hurt LCP.
- [ ] Structured `media_json` field on articles if markdown-only becomes hard to audit (prefer staying markdown-first first).
- [ ] Shared “content progress” abstraction for articles + future interactive blocks.
- [ ] Image rights spreadsheet or lightweight registry for reused assets.

---

## Implementation map (likely touch points)

### Content / skills

- `.agents/skills/bloxodes-article-research/SKILL.md`
- `.agents/skills/bloxodes-article-writing/SKILL.md`
- `.agents/skills/bloxodes-tech-article-writing/SKILL.md`
- `.agents/skills/bloxodes-article-workflow-runner/SKILL.md`

### Rendering

- `apps/web/src/lib/markdown.ts` (directives, checklist parse)
- `apps/web/src/lib/html-to-react.tsx` (preserve containers / hydrate islands)
- `apps/web/src/app/(site)/articles/[slug]/page.tsx`
- `apps/web/src/styles/article-content.css`
- new client component e.g. `apps/web/src/components/ArticleChecklist.tsx`

### Progress (Phase 2–3)

- new client helper similar to `checklist-progress-client.ts` / `code-progress-client.ts`
- new API route(s) under `apps/web/src/app/api/`
- `supabase/migrations/` for progress table
- `agents/routes/agents.md`, `agents/data/agents.md` docs updates

### Images

- article workspace / public image paths
- optional notes in research brief only (never public “source leak” copy)

---

## Suggested pilot set (Phase 0–1)

Pick real articles (new or refresh) across:

| Type | Expect video? | Expect checklist? | Expect images? |
|---|---|---|---|
| Tech fix (crash/error) | Sometimes | Often (fix order) | Sometimes (settings screens) |
| Game system how-to | Sometimes | Often (prep/requirements) | Often (menus) |
| Comparison / explainer | Rare | Rare | Rare |

After pilots, score each page:

1. Does media reduce friction or only add chrome?
2. Would a player use the checklist while in-game?
3. Is any image annotated/noisy?
4. Is the YouTube match perfect, or merely topical?

---

## Non-goals

- Auto-inserting YouTube on every article.
- Turning every bullet list into an interactive checklist.
- Scraping watermarked competitor screenshots as default art.
- Merging article micro-checklists into `/checklists` inventory/SEO surface.
- Letting models invent menu screenshots or fake video IDs.

---

## Decision log

| Date | Decision |
|---|---|
| 2026-07-10 | Direction approved for phased plan only; no implementation yet. |
| 2026-07-10 | YouTube uses existing `{{ youtube: ... }}` renderer; focus early work on content rules. |
| 2026-07-10 | Inline article checklists are separate from full `/checklists` pages and progress table. |
| 2026-07-10 | Selective use is a hard product rule for video, checklist, and images. |
| 2026-07-10 | Phase 0+1 shipped: shared `article-media` helpers, skill updates, `content:save-article-image`, media checks in `verify:article-finals`, public path `apps/web/public/articles/<slug>/`. |

Add rows here when we lock syntax, table name, merge strategy, or hosting path.

---

## Working order (default)

1. **Phase 0** content rules + YouTube usage  
2. **Phase 1** image standards + hosting habit  
3. **Phase 2** interactive checklist (local)  
4. **Phase 3** account sync  
5. **Phase 4** workflow quality gates  
6. **Phase 5** only if product pull appears  

Do not start Phase 2 until Phase 0 pilots show that selective media improves real articles rather than cluttering them.
