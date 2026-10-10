---
name: bloxodes-simplify-journey-dom
description: Audit and simplify Bloxodes React and Next.js page families so Mediavine (formerly Mediavine Journey) can automatically insert in-content ads between repeated cards or list items. Use when a catalog, index, trending, chart, paginated, category, artist, genre, or similar page has low ad impressions, nested grid or list wrappers, multiple or missing #article-body selectors, flex direct children, client rerenders that change wrapper depth, or needs Journey DOM verification before release.
---

# Bloxodes Journey DOM Simplification

You convert one Bloxodes page family at a time into a flat, valid, testable content stream that Journey can parse for automatic in-content ad placement. Done means every route in the family has one selector with repeated items as direct children, audits cover the family, and checks pass.

## Background

- Bloxodes moved from Mediavine Journey to full Mediavine on 2026-10-08. The in-content placement rules below still apply. "Journey" in class names, attributes and script names is historical.
- Read `dev-docs/architecture.md#advertising` for the current ad setup.
- Read `docs/analytics/journey-auto-ads-dom-refactor-2026-07-14.md` when you need historical implementation details, proven route coverage or release evidence.

## Workflow

### 1. Respect the requested mode

- Stay read-only when the user asks you to check, diagnose, audit or propose changes.
- Implement only after the user authorizes changes.
- Don't merge or deploy until the user explicitly approves production release. Pushing the task branch for its PR checks is fine.
- Keep production data access read-only unless a separate request explicitly authorizes a data mutation.

### 2. Map the whole page family

Read the closest `AGENTS.md` files first. Identify every renderer and route variant before editing:

- main index
- numbered pagination
- search and sort states
- trending and chart ranges
- categories, genres, artists or equivalent hubs
- detail pages and detail pagination
- curated or filtered variants
- legacy redirects
- server and client render paths
- loading, empty and error states

Use `rg` to trace imports and shared renderers. Check whether several routes already share one component before changing each route separately.

### 3. Establish the current Journey contract

Verify, don't assume:

1. Inspect the live page and the current Journey wrapper configuration when available.
2. Identify the configured content selector, normally `#article-body` for Bloxodes.
3. Check for `.content_hint`, `.content_mobile_hint` and `.content_desktop_hint`.
4. Inspect direct children, nested repeated items, computed display values and client-side rerenders.
5. Record the before-state route counts and wrapper depth.

Don't add a manual hint while automatic placement is intended. One hint switches the content away from ordinary automatic placement and makes the publisher responsible for every in-content position.

### 4. Apply the DOM contract

Produce this structure:

- exactly one Journey content selector per rendered page
- every repeated card or list item as a direct child of that selector
- a block-level direct item wrapper
- complex `flex`, grid, media, buttons and interactive markup inside that wrapper
- controls, copy, navigation, pagination, FAQs and unknown injected nodes as full-width direct children
- identical item depth before and after hydration, filtering, sorting or client pagination

Mark owned repeated elements with `data-journey-item` so audits can tell cards apart from other content. When a shared component has to contribute direct children to its parent stream, prefer fragments over wrapper elements.

### 5. Keep HTML valid and semantic

- Use a neutral `<section>` as the insertion container when Journey may inject a `<div>`.
- Add `role="list"` and `role="listitem"` when list semantics are still useful.
- Don't use `<ol>` or `<ul>` as the Journey selector if a generic ad container could become an invalid direct child.
- Keep headings, links, metadata, JSON-LD, canonicals, pagination behavior and content order unchanged unless separately requested.
- Keep logically indivisible content grouped. Don't flatten every internal node just to raise the boundary count.

### 6. Reuse the shared grid pattern

Use or extend the rules in `apps/web/src/app/globals.css`:

```css
.journey-content-stream {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-auto-flow: row dense;
  gap: 1.5rem;
}

.journey-content-stream > * {
  grid-column: 1 / -1;
  min-width: 0;
}

.journey-content-stream > [data-journey-item] {
  grid-column: auto;
}
```

- Add a narrowly named responsive variant only when the existing `--music`, `--decals` or `--options` behavior doesn't fit.
- Keep unknown third-party direct children full-width by default.
- Keep `grid-auto-flow: row dense` in the initial stylesheet. Don't toggle it after hydration. Dense placement lets later cards finish a partial row before a full-width injected ad, without changing the number of direct Journey boundaries.
- Verify keyboard and screen-reader order, because the ad stays earlier than those backfilled cards in DOM order.

When the Journey selector also uses `md-copy-scope`, don't let the grid row gap stack with normal markdown sibling margins. Keep the DOM flat and fix the collision in CSS:

1. Reset `margin-block` only for direct `[data-md-copy]` children of the Journey stream.
2. Restore small adjacent-copy and heading offsets.
3. Measure the rendered paragraph gap at desktop and mobile. The Bloxodes article rhythm is about 28px, not the 52px you get from a 24px grid gap plus a 28px paragraph margin.

### 7. Remove misleading placement code

Trace any manual slot component before you keep or delete it. If the component returns `null`, report it as a no-op and remove calls only within the approved page family. Don't remove a working ad integration just because the automatic stream is being simplified.

### 8. Extend deterministic coverage

Update both route matrices for the new family before claiming it's covered:

- `scripts/ads/audit-journey-catalog-dom.ts`
- `scripts/ads/audit-journey-catalog-browser.ts`

The server audit must check: one selector, direct repeated items, no nested repeated items, no manual hints, no direct flex item wrappers, and every main, pagination, filter, hub, detail and redirect route.

The browser audit must check:

- hydration at desktop and mobile widths
- every responsive grid column count
- computed displays
- a synthetic unknown direct child inserted after the first card of an incomplete row
- dense row completion
- full-width computed placement
- at least one real client-side rerender when the page is interactive

Wait for React hydration before inserting the synthetic node, so the audit doesn't create its own hydration mismatch.

For CLS-sensitive work, compare current and proposed CSS with a `PerformanceObserver` for `layout-shift` entries. Apply the proposed rule before first paint. Injecting or toggling the rule after render isn't a valid CLS test. Treat local house-ad results as a regression signal, not a guarantee of field CLS from third-party creatives.

### 9. Verify on GitHub

Checks, builds, tests and browser verification run on GitHub, not locally (root `AGENTS.md`). Push the task branch, open the PR targeting `production`, and use its checks, screenshots and reports. The gates that matter for this work are:

```bash
npm run typecheck:web
npm test -w @bloxodes/web
npm run build:web
npm run audit:journey-dom -- --base-url <preview-url>
npm run audit:journey-browser -- --base-url <preview-url>
git diff --check
```

- If the PR workflow doesn't cover the journey DOM and browser audits, request a page-specific GitHub check for them instead of running them on the workstation.
- Use the repository production-build environment wrapper only when managed development is unavailable and the task authorizes read-only production-backed rendering. State that caveat in the handoff.
- If a browser tool fails to initialize, treat it as a tool failure, not an application failure.

### 10. Review and release

Before requesting production approval, report:

- route families changed
- before and after direct-child shape
- server route count
- browser route and viewport count
- synthetic placement widths
- typecheck, test and build results from the GitHub run
- anything pre-release testing can't prove, especially paid impression uplift

After explicit production approval, release through `bloxodes-release-e2e`: merge the PR only after `Required PR checks` passes, never push directly to `production`. Then:

1. Wait for the immutable image build, Dokploy activation, health verification, Cloudflare purge and cache warming.
2. Confirm `/api/health` reports the merged SHA.
3. Run the server DOM audit against `https://bloxodes.com`.
4. Open the changed routes in an incognito window with `?test=houseads` added to the URL. Mediavine fills every slot with house ads, so you can see each in-content placement without waiting for real demand.
5. Monitor Mediavine impressions per pageview once enough traffic builds up.

## Stop conditions

Stop and report instead of guessing when:

- the configured content selector can't be verified
- the page mixes unrelated user changes with the requested refactor
- flattening would break form, table, list or accessibility semantics
- client rendering can't keep stable direct children
- tests show the visual grid or pagination behavior changed
- production approval hasn't been given
