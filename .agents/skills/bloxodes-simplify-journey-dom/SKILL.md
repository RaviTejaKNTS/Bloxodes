---
name: bloxodes-simplify-journey-dom
description: Audit and simplify Bloxodes React and Next.js page families so Mediavine Journey can automatically insert in-content ads between repeated cards or list items. Use when a catalog, index, trending, chart, paginated, category, artist, genre, or similar page has low ad impressions, nested grid or list wrappers, multiple or missing #article-body selectors, flex direct children, client rerenders that change wrapper depth, or needs Journey DOM verification before release.
---

# Bloxodes Journey DOM Simplification

## Overview

Convert one Bloxodes page family at a time into a flat, valid, testable content stream that Journey can parse for automatic in-content ad placement.

Read `docs/analytics/journey-auto-ads-dom-refactor-2026-07-14.md` when historical implementation details, proven route coverage, or release evidence are needed.

## Workflow

### 1. Respect the requested mode

- Stay read-only when the user asks to check, diagnose, audit, or propose changes.
- Implement only after the user authorizes changes.
- Do not push or deploy until the user explicitly approves production release.
- Keep production data access read-only unless a separate request explicitly authorizes a data mutation.

### 2. Map the whole page family

Read the closest `AGENTS.md` files first. Identify every renderer and route variant before editing:

- main index;
- numbered pagination;
- search and sort states;
- trending and chart ranges;
- categories, genres, artists, or equivalent hubs;
- detail pages and detail pagination;
- curated or filtered variants;
- legacy redirects;
- server and client render paths;
- loading, empty, and error states.

Use `rg` to trace imports and shared renderers. Confirm whether multiple routes already converge on one component before changing each route separately.

### 3. Establish the current Journey contract

Verify rather than assume:

1. Inspect the live page and current Journey wrapper configuration when available.
2. Identify the configured content selector, normally `#article-body` for Bloxodes.
3. Check for `.content_hint`, `.content_mobile_hint`, and `.content_desktop_hint`.
4. Inspect direct children, nested repeated items, computed display values, and client-side rerenders.
5. Record the before-state route counts and wrapper depth.

Do not add a manual hint while automatic placement is intended. One hint switches the content away from ordinary automatic placement and makes the publisher responsible for all in-content positions.

### 4. Apply the DOM contract

Produce this structure:

- exactly one Journey content selector per rendered page;
- every repeated card or list item as a direct child of that selector;
- a block-level direct item wrapper;
- complex `flex`, grid, media, buttons, and interactive markup inside that wrapper;
- controls, copy, navigation, pagination, FAQs, and unknown injected nodes as full-width direct children;
- identical item depth before and after hydration, filtering, sorting, or client pagination.

Mark owned repeated elements with `data-journey-item` so audits can distinguish cards from other content. Prefer fragments over wrapper elements when a shared component must contribute direct children to its parent stream.

### 5. Preserve valid HTML and semantics

- Use a neutral `<section>` as the insertion container when Journey may inject a `<div>`.
- Add `role="list"` and `role="listitem"` when list semantics remain useful.
- Do not use `<ol>` or `<ul>` as the Journey selector if a generic ad container could become an invalid direct child.
- Keep headings, links, metadata, JSON-LD, canonicals, pagination behavior, and content order unchanged unless separately requested.
- Keep logically indivisible content grouped; do not flatten every internal node merely to increase boundary count.

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

Add a narrowly named responsive variant only when existing `--music`, `--decals`, or `--options` behavior does not fit. Keep unknown third-party direct children full-width by default.

Keep `grid-auto-flow: row dense` in the initial stylesheet. Do not toggle it after hydration. Dense placement lets later cards complete a partial row before a full-width injected ad, without changing the number of direct Journey boundaries. Verify keyboard and screen-reader order because the ad remains earlier than those backfilled cards in DOM order.

When the Journey selector also uses `md-copy-scope`, do not let the grid row gap stack with normal markdown sibling margins. Keep the DOM flat and solve the collision in CSS: reset `margin-block` only for direct `[data-md-copy]` children of the Journey stream, then restore small adjacent-copy and heading offsets. Measure the rendered paragraph gap at desktop and mobile; the Bloxodes article rhythm is about 28px, not the 52px produced by a 24px grid gap plus a 28px paragraph margin.

### 7. Remove misleading placement code

Trace any manual slot component before preserving or deleting it. If the component returns `null`, report it as a no-op and remove calls only within the approved page family. Do not remove a functioning ad integration merely because the automatic stream is being simplified.

### 8. Extend deterministic coverage

Update both route matrices for the new family before claiming it is covered:

- `scripts/ads/audit-journey-catalog-dom.ts`
- `scripts/ads/audit-journey-catalog-browser.ts`

Require the server audit to check one selector, direct repeated items, no nested repeated items, no manual hints, no direct flex item wrappers, and every main, pagination, filter, hub, detail, and redirect route.

Require the browser audit to check hydration at desktop and mobile widths, every responsive grid column count, computed displays, a synthetic unknown direct child inserted after the first card of an incomplete row, dense row completion, full-width computed placement, and at least one real client-side rerender when the page is interactive. Wait for React hydration before inserting the synthetic node so the audit does not create its own hydration mismatch.

For CLS-sensitive work, compare current and proposed CSS with a `PerformanceObserver` for `layout-shift` entries. Apply the proposed rule before first paint; injecting or toggling the rule after render is not a valid CLS test. Treat local house-ad results as a regression signal, not a guarantee of field CLS from third-party creatives.

### 9. Verify locally

Run the smallest relevant checks, then the full page-family gates:

```bash
npm run typecheck:web
npm test -w @bloxodes/web
npm run build:web
npm run audit:journey-dom -- --base-url http://127.0.0.1:<port>
npm run audit:journey-browser -- --base-url http://127.0.0.1:<port>
git diff --check
```

Use the repository production-build environment wrapper only when managed development is unavailable and the task authorizes read-only production-backed rendering. State that caveat in the handoff.

Treat the in-app Browser plugin failing to initialize as a tool failure, not an application failure. Use the repository Playwright audit with installed Chrome when necessary.

### 10. Review and release

Before requesting production approval, report:

- route families changed;
- before and after direct-child shape;
- server route count;
- browser route and viewport count;
- synthetic placement widths;
- typecheck, test, and build results;
- anything local testing cannot prove, especially paid impression uplift.

After explicit production approval:

1. Push through the normal `production` workflow.
2. Wait for immutable image build, Dokploy activation, health verification, Cloudflare purge, and cache warming.
3. Confirm `/api/health` reports the pushed SHA.
4. Run the server DOM audit against `https://bloxodes.com`.
5. Monitor Journey impressions per pageview after enough traffic accumulates.

## Stop conditions

Stop and report instead of guessing when:

- the configured content selector cannot be verified;
- the page mixes unrelated user changes with the requested refactor;
- flattening would break form, table, list, or accessibility semantics;
- client rendering cannot preserve stable direct children;
- tests show the visual grid or pagination behavior changed;
- production approval has not been given.
