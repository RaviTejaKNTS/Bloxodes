# Journey Auto-Ads DOM Refactor

## Status

- Implemented and released on 2026-07-14.
- Production commit: [`57bfe5f1fd8455bd3ea12b5dac00453c42b1aba9`](https://github.com/RaviTejaKNTS/Bloxodes/commit/57bfe5f1fd8455bd3ea12b5dac00453c42b1aba9)
- Deployment workflow: [`29358157297`](https://github.com/RaviTejaKNTS/Bloxodes/actions/runs/29358157297)
- Production health readback reported the same commit SHA.
- The final production DOM audit passed 29 Music IDs and Decal IDs route variants.

## Why this work was needed

Roblox Music IDs generates most of the site's advertising income, but Journey was producing too few in-content impressions per pageview. The repeated cards were visually arranged in grids, but the cards were nested inside a single direct grid wrapper under the Journey content selector. Journey could see the wrapper, not each card boundary, so it had very few safe automatic insertion points.

The same pattern affected Roblox Decal IDs, pagination pages, trending lists, charts, genre and artist indexes, curated decals, and category pages.

The production Journey configuration used `#article-body` as its content selector and automatic in-content placement. The implementation therefore kept automatic placement and fixed the document structure instead of adding manual content hints. Mediavine warns that adding even one content hint disables ordinary automatic placement for that content and requires all in-content positions to be managed manually.

## DOM contract

Every converted page follows this contract:

1. Render exactly one `#article-body` for the Journey content region.
2. Render every repeated card or list entry as a direct child of that selector.
3. Keep each direct item wrapper block-level. Put `flex`, complex card markup, and interactive layout inside it.
4. Mark owned repeated items with `data-journey-item` so the structure can be audited deterministically.
5. Render forms, navigation, pagination, editorial copy, FAQs, and any Journey-inserted unknown element as full-width direct children.
6. Do not add `content_hint`, `content_mobile_hint`, or `content_desktop_hint` while the site uses Journey automatic placement.
7. Preserve the same direct-child depth after client-side filtering, sorting, pagination, or hydration.
8. Use a neutral container such as `<section>` when Journey may insert a `<div>`. Do not use an `<ol>` or `<ul>` as the insertion container unless every possible inserted element is a valid list child.

### Before

```tsx
<section id="article-body">
  <Filters />
  <div className="grid grid-cols-3">
    {items.map((item) => <Card key={item.id} item={item} />)}
  </div>
  <Pagination />
</section>
```

Journey sees only three direct blocks: the filters, one grid wrapper, and pagination.

### After

```tsx
<section
  id="article-body"
  itemProp="articleBody"
  className="journey-content-stream journey-content-stream--music"
>
  <Filters />
  {items.map((item) => (
    <div key={item.id} data-journey-item className="h-full">
      <Card item={item} />
    </div>
  ))}
  <Pagination />
</section>
```

Journey can now evaluate every card boundary. CSS gives known card items their normal columns while every other direct child, including an injected ad container, spans the complete grid.

## Shared responsive layout

`apps/web/src/app/globals.css` now owns the Journey stream classes:

- `.journey-content-stream`: one-column grid, dense row backfilling, and consistent vertical/column gap.
- `.journey-content-stream > *`: full-width default for copy, controls, pagination, and injected elements.
- `.journey-content-stream > [data-journey-item]`: opt repeated owned items back into ordinary grid columns.
- `--music`: one column by default, two at `768px`, and three at `1280px`.
- `--decals`: one column by default, then two at `420px`, three at `768px`, four at `1024px`, and five at `1536px`.
- `--options`: one column by default, two at `640px`, and three at `1024px`.

This is the key rule that allows a third-party direct child with no Bloxodes class to occupy a full-width ad lane without breaking the card grid.

### Complete rows and CLS follow-up

Journey can insert a full-width ad after any direct card. With the default sparse Grid algorithm, an ad after the first card of a multi-column row moves to the next row and leaves the rest of the current row empty. The shared stream therefore declares `grid-auto-flow: row dense` in the initial stylesheet. Later cards backfill the incomplete row and the ad remains full-width below the completed row.

The rule is never added or toggled after render, so it does not create a new runtime layout transition. A controlled local `PerformanceObserver` comparison with Journey house ads recorded dense CLS of `0` in two tablet runs and two desktop runs; the current sparse desktop layout recorded approximately `0.0022`. Mobile was effectively unchanged at `0` to `0.0001`. These are lab regression results, not a guarantee of field CLS from third-party ad delivery.

The browser audit now covers one through five grid columns, inserts a synthetic full-width node after the first card of an incomplete row, verifies that later cards complete the row, and waits for React hydration before mutation. Dense placement can make visual order differ from DOM order around the ad, so keyboard and assistive-technology order still require review when adopting the pattern on a new interactive page family.

### Typography spacing follow-up (2026-07-15)

The flat grid initially combined its `1.5rem` row gap with the existing `1.75rem` direct markdown sibling margin. Main Music and Decal intro paragraphs therefore rendered with a 52px gap, while ordinary Bloxodes article paragraphs rendered at 28px.

The fix stayed CSS-only. Direct markdown nodes under `#article-body.journey-content-stream` now reset their block margins, adjacent markdown nodes restore a `0.25rem` offset, and `h2` through `h4` restore progressively smaller section offsets. No wrapper, card boundary, content hint, metadata, or JSX structure changed.

Production-mode local verification measured:

- 28px paragraph gaps on Music and Decal at desktop, tablet, and mobile widths;
- application CLS of `0` on desktop and `0.0001` on the Music mobile case before synthetic insertion;
- eight real Journey boxes on Music desktop, nine on Decal desktop, and eighteen on Music mobile during isolated localhost house-ad runs;
- every real box spanning the complete content width (`1160px` desktop and `358px` mobile);
- complete three-card Music rows and four-card Decal rows immediately before every desktop ad;
- Journey-inclusive CLS of `0` on desktop and `0.0001` on mobile in those local runs.

The observed Journey boxes were empty, non-focusable generic containers at the inspected moment (`tabIndex=-1`, no role, no accessible text). Dense placement changed their visual position relative to later cards but did not interrupt keyboard focus order in that run. Third-party creative behavior can vary, so field accessibility and CLS still need production monitoring.

## Music IDs changes

### Main and paginated pages

- Replaced the nested `MusicIdGrid` renderer with `MusicIdItems`.
- Each song now renders inside a direct `data-journey-item` block.
- The filter form, catalog navigation, cards, pagination, intro, description, how-to content, and FAQ all share one `#article-body` stream.
- The main and page-number routes use the same renderer, so query filters and pagination keep the same contract.

### Trending and charts

- `TrendingMusicList` now owns the Journey selector.
- Replaced the `<ol>` insertion container with `<section role="list">`.
- Each ranked entry is a direct `<article role="listitem" data-journey-item>`.
- The flex card layout moved inside the direct article wrapper.
- Daily trending, weekly, monthly, yearly, chart query routes, chart pagination, and legacy redirect routes resolve to the same flat structure.

### Genres and artists

- Genre and artist index cards are direct Journey items rather than children of an intermediate grid.
- Index pagination keeps navigation, option cards, and pagination inside one stream.
- Genre and artist detail pages use `MusicIdItems` directly.
- Detail pagination uses the same DOM contract, including sparse artist pages with only one song.

### Removed no-op slots

`CatalogAdSlot` imports and calls were removed from the converted Music IDs routes. The underlying `ContentSlot` currently returns `null`, so these calls did not create ad inventory or useful placement boundaries.

## Decal IDs changes

### Shared browser renderer

- `DecalIdsBrowser` no longer returns an outer `catalog-surface` wrapper.
- The component returns a fragment, allowing its form, status messages, cards, and pagination to become direct children of the parent Journey stream.
- Removed the nested card grid.
- Each decal card now has a direct `data-journey-item` wrapper.
- Client-side sorting and filtering preserve the same direct-child relationship after the API response rerenders the cards.

### Route families

The shared renderer covers:

- `/catalog/roblox-decal-ids`
- `/catalog/roblox-decal-ids/page/[page]`
- `/catalog/roblox-decal-ids/curated`
- `/catalog/roblox-decal-ids/curated/page/[page]`
- `/catalog/roblox-decal-ids/categories/[category]`
- `/catalog/roblox-decal-ids/categories/[category]/page/[page]`

The categories hub separately renders each category as a direct Journey item under its own `#article-body` option stream.

`CatalogAdSlot` calls were also removed from the converted Decal IDs renderer because they were no-ops.

## Original release file inventory

The production commit changed these files:

- `apps/web/src/app/globals.css`
- `apps/web/src/app/(site)/catalog/roblox-music-ids/page-data.tsx`
- `apps/web/src/app/(site)/catalog/roblox-music-ids/chart-page.tsx`
- `apps/web/src/app/(site)/catalog/roblox-music-ids/charts-page.tsx`
- `apps/web/src/app/(site)/catalog/roblox-music-ids/genres/page.tsx`
- `apps/web/src/app/(site)/catalog/roblox-music-ids/genres/page/[page]/page.tsx`
- `apps/web/src/app/(site)/catalog/roblox-music-ids/genres/[genre]/page.tsx`
- `apps/web/src/app/(site)/catalog/roblox-music-ids/genres/[genre]/page/[page]/page.tsx`
- `apps/web/src/app/(site)/catalog/roblox-music-ids/artists/page.tsx`
- `apps/web/src/app/(site)/catalog/roblox-music-ids/artists/page/[page]/page.tsx`
- `apps/web/src/app/(site)/catalog/roblox-music-ids/artists/[artist]/page.tsx`
- `apps/web/src/app/(site)/catalog/roblox-music-ids/artists/[artist]/page/[page]/page.tsx`
- `apps/web/src/app/(site)/catalog/roblox-decal-ids/DecalIdsBrowser.tsx`
- `apps/web/src/app/(site)/catalog/roblox-decal-ids/page-data.tsx`
- `scripts/ads/audit-journey-catalog-dom.ts`
- `scripts/ads/audit-journey-catalog-browser.ts`
- `scripts/AGENTS.md`
- `agents/scripts/agents.md`
- `package.json`

## Repeatable verification

Two read-only audit scripts were added and exposed through root npm commands.

### Server-rendered audit

```bash
npm run audit:journey-dom -- --base-url http://127.0.0.1:3014
```

`scripts/ads/audit-journey-catalog-dom.ts` verifies:

- exactly one `#article-body`;
- multiple direct content blocks;
- at least one direct repeated item;
- no nested `data-journey-item` nodes;
- no manual Mediavine content hints;
- no direct repeated item carrying `flex` or `inline-flex`;
- current and legacy routes, pagination, chart ranges, and dynamically discovered genre, artist, and decal-category detail pages.

### Hydrated browser audit

```bash
npm run audit:journey-browser -- --base-url http://127.0.0.1:3014
```

`scripts/ads/audit-journey-catalog-browser.ts` uses installed Google Chrome through Playwright and verifies:

- desktop at `1440x1000`;
- mobile at `390x844`;
- direct-child integrity after hydration;
- computed display values for item wrappers;
- insertion of a synthetic unknown direct child after a card;
- full-width placement at the computed content width;
- client-side Decal sorting followed by an API rerender.

For a future route family, extend the route matrix in both audit scripts before treating their pass as coverage for that family.

## Verification results

The release passed:

- `npm run typecheck:web`;
- all 70 web Vitest tests across 14 files;
- a complete production-mode Next.js build with 71 generated static pages;
- `git diff --check`;
- 29 server-rendered route variants locally;
- 24 hydrated route and viewport combinations locally;
- a Decal client-side sort retaining 24 direct Journey items;
- synthetic full-width lanes of `1160px` on desktop and `358px` on mobile;
- the same 29-route server-rendered audit against `https://bloxodes.com` after deployment.

Local Supabase was unavailable during the final production-mode build, so the repository's approved production-build environment wrapper supplied read-only production data. No production data mutation was part of this change.

## Production release sequence

1. Commit `57bfe5f1` was pushed to `production`.
2. GitHub Actions built and published the immutable GHCR image.
3. The workflow pointed Dokploy at that image and triggered deployment.
4. `/api/health` reported `57bfe5f1fd8455bd3ea12b5dac00453c42b1aba9`.
5. Cloudflare cache purge passed.
6. Sitemap-driven cache warming passed.
7. The live 29-route Journey DOM audit passed.

## Applying the pattern to another page family

Use `.agents/skills/bloxodes-simplify-journey-dom/SKILL.md`.

The safe order is:

1. Audit every renderer and route variant without changing code.
2. Identify the single intended Journey content selector.
3. Flatten only the repeated content boundary; keep complex markup inside direct block wrappers.
4. Preserve visual columns through the shared stream CSS or add one narrowly named responsive variant.
5. Confirm server and client render paths produce identical wrapper depth.
6. Add the new route family to both audit matrices.
7. Run typecheck, tests, production-mode build, server DOM audit, and hydrated browser audit.
8. Do not deploy until the user explicitly approves production release.
9. After deployment, verify the live SHA and rerun the server DOM audit against production.

## Important limits

- A correct DOM creates eligible automatic placement boundaries; it cannot guarantee a specific ad count for every visit. Journey still applies viewport, device, density, consent, demand, and policy logic.
- Localhost cannot prove actual paid impressions. Use live Journey reporting to compare impressions per pageview after sufficient traffic accumulates.
- Do not add manual hints as a shortcut unless the business intentionally chooses to own every in-content position.
- Do not flatten unrelated interactive components merely to increase the direct-child count. Keep logically indivisible content grouped.
- Do not change metadata, canonicals, pagination policy, structured data, or content ordering unless the page task separately requires it.

## External references

- [Mediavine In-Content Ads FAQ](https://help.mediavine.com/how-do-in-content-ads-work-1)
- [Manually placing ads with content hints](https://help.mediavine.com/how-to-manually-place-ads-in-your-content-with-content-hints)
- [Manually blocking ads by grouping content](https://help.mediavine.com/how-to-manually-block-ads-in-your-content-with-div-div)
