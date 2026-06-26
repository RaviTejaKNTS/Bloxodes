# Bloxodes URL Migration and Cleanup Plan

Prepared: May 24, 2026

This doc explains the current Bloxodes URL migration state: which old URLs still exist in Google/Bing memory, how the codebase redirects them, which deleted URLs are currently allowed to 404, and what we should do next.

It is based on:

- `apps/web/src/proxy.ts`
- `apps/web/src/data/slug_oldslugs.json`
- `apps/web/src/app/(site)/[slug]/page.tsx`
- `apps/web/src/app/(site)/catalog/[...slug]/page.tsx`
- `agents/google-analytics-search-console-report-2026-05-23.md`
- `/private/tmp/bloxodes-seo-audit-2026-05-23.json`
- `/private/tmp/bloxodes-seo-analysis-2026-05-23.json`
- Production spot checks with `curl` on May 24, 2026

## Short Diagnosis

Bloxodes has a real URL migration problem, but not a broken redirect system.

The main migration is from old root-level code URLs:

```text
/type-soul-codes
/da-hood-codes
/flex-ugc-codes
```

to current code URLs:

```text
/codes/type-soul
/codes/da-hood
/codes/flex-ugc
```

The codebase already handles 360 old root code slugs with permanent 301 redirects through `apps/web/src/proxy.ts` and `apps/web/src/data/slug_oldslugs.json`.

The issue is that Google still has a lot of performance and crawl history attached to the old URLs. In the September 15, 2025 to May 21, 2026 Search Console page data pulled for the SEO audit:

| URL class in GSC page rows | Rows | Clicks | Impressions | Current behavior |
| --- | ---: | ---: | ---: | --- |
| Current live sitemap URLs | 11 | 423 | 1,752 | Canonical live URLs |
| Mapped old root code URLs | 143 | 23 | 4,075 | 301 to `/codes/<slug>` |
| Root article URLs with redirects | 10 | 2 | 152 | 301 to `/articles/<slug>` |
| Old root code URLs not in redirect map | 5 | 1 | 39 | Currently 404 |
| Other old/deleted URLs not in sitemap | 22 | 1 | 257 | Mostly 404 |
| HTTP homepage variant | 1 | 0 | 2 | Should resolve to HTTPS/canonical host |

That means Google is still heavily aware of old root URLs. The old URLs are not all bad: the mapped ones are useful migration signals. But the unmapped and deleted ones should be intentionally cleaned so Google does not keep rediscovering dead paths.

## Current Redirect System

### Canonical host redirect

`apps/web/src/proxy.ts` checks the request host. If the host is not the canonical host, it redirects to the configured canonical host with a 301.

Default canonical host:

```text
bloxodes.com
```

Localhost and loopback hosts are excluded so local development keeps working.

### Root code URL redirects

Source:

```text
apps/web/src/data/slug_oldslugs.json
```

Current source-map size:

| Metric | Count |
| --- | ---: |
| Canonical code slugs in map | 360 |
| Old slug entries | 360 |

The proxy turns each old root slug into a current `/codes/<slug>` path.

Example source entries:

| Old URL | Target |
| --- | --- |
| `/slap-battles-codes` | `/codes/slap-battles` |
| `/bikeworld-codes` | `/codes/bikeworld` |
| `/anime-rangers-x-codes` | `/codes/anime-rangers-x` |
| `/go-fishing-codes` | `/codes/go-fishing` |
| `/anime-fighters-simulator-codes` | `/codes/anime-fighters-simulator` |
| `/bladers-rebirth-codes` | `/codes/bladers-rebirth` |
| `/human-kebabs-codes` | `/codes/human-kebabs` |
| `/build-a-scam-empire-codes` | `/codes/build-a-scam-empire` |
| `/demon-slayer-legacy-codes` | `/codes/demon-slayer-legacy` |
| `/climbing-game-codes` | `/codes/climbing-game` |
| `/lost-currents-codes` | `/codes/lost-currents` |
| `/anime-dungeon-fighters-codes` | `/codes/anime-dungeon-fighters` |
| `/monster-race-codes` | `/codes/monster-race` |
| `/the-mall-game-codes` | `/codes/the-mall-game` |
| `/my-anime-life-codes` | `/codes/my-anime-life` |
| `/blade-ball-codes` | `/codes/blade-ball` |
| `/anime-slashing-simulator-codes` | `/codes/anime-slashing-simulator` |
| `/all-star-tower-defense-codes` | `/codes/all-star-tower-defense` |
| `/clothing-store-simulator-codes` | `/codes/clothing-store-simulator` |
| `/eating-simulator-codes` | `/codes/eating-simulator` |

The complete source of truth is the JSON file, not this doc. This doc should not duplicate all 360 rows because the redirect map is already machine-readable.

### How the proxy applies old code redirects

The proxy only redirects old code slugs at the root.

Redirected:

```text
/type-soul-codes -> /codes/type-soul
```

Not redirected by the old-slug map:

```text
/codes/type-soul-codes
/codes/type-soul
/anything/type-soul-codes
```

That is intentional. We only want to migrate the old root URL pattern, not rewrite valid current `/codes/*` paths.

### Article root redirects

`apps/web/src/proxy.ts` also has a hardcoded `ARTICLE_REDIRECT_SLUGS` set. These old root article URLs redirect to `/articles/<slug>`.

| Old URL | Target |
| --- | --- |
| `/when-does-the-museum-open-in-jailbreak-roblox` | `/articles/when-does-the-museum-open-in-jailbreak-roblox` |
| `/how-to-level-up-fast-in-jailbreak-criminal-vs-cop` | `/articles/how-to-level-up-fast-in-jailbreak-criminal-vs-cop` |
| `/how-to-get-a-mansion-invite-in-jailbreak-roblox` | `/articles/how-to-get-a-mansion-invite-in-jailbreak-roblox` |
| `/steal-a-brainrot-dealer-update-guide` | `/articles/steal-a-brainrot-dealer-update-guide` |
| `/why-roblox-s-simple-graphics-still-beat-every-realistic-game` | `/articles/why-roblox-s-simple-graphics-still-beat-every-realistic-game` |
| `/where-to-find-criminal-base-on-roblox-jailbreak` | `/articles/where-to-find-criminal-base-on-roblox-jailbreak` |
| `/how-to-get-robux-free-and-paid` | `/articles/how-to-get-robux-free-and-paid` |
| `/best-simple-roblox-games-for-beginners` | `/articles/best-simple-roblox-games-for-beginners` |
| `/how-to-get-spooky-chest-in-grow-a-garden` | `/articles/how-to-get-spooky-chest-in-grow-a-garden` |
| `/roblox-halloween-spotlight-event-2025` | `/articles/roblox-halloween-spotlight-event-2025` |
| `/create-and-publish-roblox-game` | `/articles/create-and-publish-roblox-game` |
| `/all-fisch-enchantments-guide` | `/articles/all-fisch-enchantments-guide` |

### Legacy single-slug fallback route

`apps/web/src/app/(site)/[slug]/page.tsx` has:

```ts
export const dynamicParams = false;

export function generateStaticParams() {
  return [];
}

export default function LegacySlugPage() {
  notFound();
}
```

This means root-level slugs that are not caught by the proxy are intentionally not valid pages. They fall through to 404 rather than becoming accidental thin pages.

That is good for cleanup, but it also means any old root URL with a real equivalent page must be added to the redirect map. Otherwise it becomes a dead migration URL.

## Production Redirect Spot Checks

These checks were run against production on May 24, 2026.

| URL checked | Production response | Location |
| --- | --- | --- |
| `https://bloxodes.com/flex-ugc-codes` | 301 | `/codes/flex-ugc` |
| `https://bloxodes.com/type-soul-codes` | 301 | `/codes/type-soul` |
| `https://bloxodes.com/when-does-the-museum-open-in-jailbreak-roblox` | 301 | `/articles/when-does-the-museum-open-in-jailbreak-roblox` |
| `https://bloxodes.com/definitely-deleted-test-url` | 404 | none |
| `https://bloxodes.com/brookhaven-codes` | 404 | none |
| `https://bloxodes.com/ink-game-codes` | 404 | none |
| `https://bloxodes.com/fisch` | 404 | none |
| `https://bloxodes.com/articles/category/anime-last-stand` | 404 | none |

The mapped redirects are working in production. The problem is the unmapped old URLs and the number of old URLs Google still remembers.

## Google-Visible Old URLs

### Mapped old code URLs still visible in GSC

Search Console still shows 143 old root code URLs in page performance rows. These are not necessarily broken because the redirect map handles them. The problem is that Google has not fully transferred attention to the current `/codes/*` URLs.

Top examples by GSC clicks/impressions:

| Old URL | Target | Clicks | Impressions | Avg position |
| --- | --- | ---: | ---: | ---: |
| `https://bloxodes.com/flex-ugc-codes` | `/codes/flex-ugc` | 4 | 86 | 7.19 |
| `https://bloxodes.com/go-fishing-codes` | `/codes/go-fishing` | 3 | 145 | 3.27 |
| `https://bloxodes.com/99-nights-in-the-forest-codes` | `/codes/99-nights-in-the-forest` | 2 | 86 | 11.42 |
| `https://bloxodes.com/anime-world-tower-defense-codes` | `/codes/anime-world-tower-defense` | 2 | 39 | 3.95 |
| `https://bloxodes.com/drag-drive-simulator-codes` | `/codes/drag-drive-simulator` | 2 | 256 | 2.96 |
| `https://bloxodes.com/island-of-move-codes` | `/codes/island-of-move` | 2 | 71 | 24.73 |
| `https://bloxodes.com/anime-slaying-codes` | `/codes/anime-slaying` | 1 | 104 | 3.17 |
| `https://bloxodes.com/anime-vanguards-codes` | `/codes/anime-vanguards` | 1 | 36 | 11.47 |
| `https://bloxodes.com/basketball-legends-codes` | `/codes/basketball-legends` | 1 | 75 | 15.61 |
| `https://bloxodes.com/build-a-zoo-codes` | `/codes/build-a-zoo` | 1 | 73 | 32.03 |
| `https://bloxodes.com/da-hood-codes` | `/codes/da-hood` | 1 | 211 | 37.87 |
| `https://bloxodes.com/drag-project-future-codes` | `/codes/drag-project-future` | 1 | 53 | 27.43 |
| `https://bloxodes.com/grow-a-friend-codes` | `/codes/grow-a-friend` | 1 | 4 | 1.00 |
| `https://bloxodes.com/jailbreak-codes` | `/codes/jailbreak` | 1 | 296 | 48.29 |

Action:

- Keep these 301 redirects.
- Do not remove the old map just because the new URLs exist.
- Make sure all internal links point only to `/codes/<slug>`, never to old root code URLs.
- Track old URL impressions vs current URL impressions weekly.
- For the highest-value old URLs, inspect both old and new URLs in Search Console and request indexing for the new URL after confirming the old URL redirects.

### Old article URLs still visible in GSC

Search Console still shows 10 old root article URLs in the page data. These are already handled by `ARTICLE_REDIRECT_SLUGS`.

| Old URL | Target | Clicks | Impressions | Avg position |
| --- | --- | ---: | ---: | ---: |
| `https://bloxodes.com/all-fisch-enchantments-guide` | `/articles/all-fisch-enchantments-guide` | 1 | 23 | 17.30 |
| `https://bloxodes.com/roblox-halloween-spotlight-event-2025` | `/articles/roblox-halloween-spotlight-event-2025` | 1 | 42 | 5.88 |
| `https://bloxodes.com/best-simple-roblox-games-for-beginners` | `/articles/best-simple-roblox-games-for-beginners` | 0 | 5 | 62.20 |
| `https://bloxodes.com/create-and-publish-roblox-game` | `/articles/create-and-publish-roblox-game` | 0 | 43 | 3.58 |
| `https://bloxodes.com/how-to-get-a-mansion-invite-in-jailbreak-roblox` | `/articles/how-to-get-a-mansion-invite-in-jailbreak-roblox` | 0 | 7 | 10.86 |
| `https://bloxodes.com/how-to-get-spooky-chest-in-grow-a-garden` | `/articles/how-to-get-spooky-chest-in-grow-a-garden` | 0 | 11 | 21.45 |
| `https://bloxodes.com/how-to-level-up-fast-in-jailbreak-criminal-vs-cop` | `/articles/how-to-level-up-fast-in-jailbreak-criminal-vs-cop` | 0 | 2 | 4.00 |
| `https://bloxodes.com/steal-a-brainrot-dealer-update-guide` | `/articles/steal-a-brainrot-dealer-update-guide` | 0 | 6 | 21.33 |
| `https://bloxodes.com/where-to-find-criminal-base-on-roblox-jailbreak` | `/articles/where-to-find-criminal-base-on-roblox-jailbreak` | 0 | 11 | 14.91 |
| `https://bloxodes.com/why-roblox-s-simple-graphics-still-beat-every-realistic-game` | `/articles/why-roblox-s-simple-graphics-still-beat-every-realistic-game` | 0 | 2 | 32.00 |

Action:

- Keep these redirects.
- Do not submit old article root URLs in sitemaps.
- Link only to `/articles/<slug>`.
- If any article is deleted later, remove the old root redirect only when the target also has no useful replacement.

## Catalog and Wiki Collection Migration

The catalog/wiki migration is separate from code pages.

Current direction:

```text
/wiki/<game-slug>/<collection-slug>
```

The old game collection catalog wrappers were removed after search engines caught up. Game collections now live directly under the wiki URL family.

Examples:

| Current URL pattern | Status |
| --- | --- |
| `/wiki/wizard-alchemy/materials` | Canonical game collection page |
| `/wiki/blox-fruits/fruits` | Canonical game collection page |
| `/wiki/adopt-me/pets` | Canonical game collection page |
| `/wiki/the-forge/ores` | Canonical game collection page |
| `/wiki/grow-a-garden/crops` | Canonical game collection page |

Important detail:

- The old flat catalog code is still a stable identifier in `wiki_collection_pages.code`.
- The public route should be the wiki route.
- Scripts can keep using the stable code, but public links should use `/wiki/<game>/<collection>`.

Action:

- Old game collection catalog redirects have been removed after search engines caught up.
- Audit old catalog impressions separately from old code impressions.
- Make sure catalog cards, wiki hubs, tools, checklists, and articles link to the current wiki collection route, not `/catalog/<game-collection-code>`.
- Keep current wiki collection URLs in `/sitemaps/wiki.xml`.
- Do not put moved game collection pages back into `/sitemaps/catalog.xml`.

## Fully Deleted or Unmapped URLs

Not every old URL should redirect. Some should stay deleted.

The rule:

```text
Redirect only when there is a close, useful, intent-matched replacement.
404 or 410 when the old page has no equivalent replacement.
```

Do not redirect every missing URL to the homepage. That creates soft-404 behavior and weakens trust.

### Old root code URLs not in the redirect map

These old code URLs appeared in GSC page data but are not currently mapped by `slug_oldslugs.json`.

| Old URL | GSC clicks | GSC impressions | Current behavior | Recommended action |
| --- | ---: | ---: | --- | --- |
| `https://bloxodes.com/brookhaven-codes` | 1 | 17 | 404 | Do not redirect to wiki unless a real Brookhaven codes page exists. If we create/restore a codes page, map it to the exact `/codes/<slug>`. |
| `https://bloxodes.com/bouncea-brainrot-codes` | 0 | 10 | 404 | Add redirect to `/codes/bounce-a-brainrot` if this is a known typo/old slug. |
| `https://bloxodes.com/cleana-house-codes` | 0 | 1 | 404 | Add redirect to `/codes/clean-a-house` if this is a known typo/old slug. |
| `https://bloxodes.com/dropa-poop-codes` | 0 | 10 | 404 | Add redirect to `/codes/drop-a-poop` if this is a known typo/old slug. |
| `https://bloxodes.com/ink-game-codes` | 0 | 1 | 404 | Add redirect to `/codes/ink-game`; current sitemap has `/codes/ink-game`. |

These are the easiest cleanup wins. Four of the five appear to have clear current code-page equivalents. `brookhaven-codes` is different because the current sitemap snapshot did not include `/codes/brookhaven` or `/codes/brookhaven-rp`.

### Other GSC-visible deleted URLs

These URLs appeared in GSC page data but were not current sitemap URLs and were not part of the known redirect maps.

| Old/deleted URL | GSC clicks | GSC impressions | Recommended action |
| --- | ---: | ---: | --- |
| `https://bloxodes.com/fisch` | 1 | 182 | Decide whether Fisch deserves a real wiki/game hub. If yes, create `/wiki/fisch` and 301 this URL. If no, keep 404. |
| `https://bloxodes.com/articles/category/all-star-tower-defense-x` | 0 | 2 | Keep 404 unless article category pages return. |
| `https://bloxodes.com/articles/category/anime-apex` | 0 | 3 | Keep 404 unless article category pages return. |
| `https://bloxodes.com/articles/category/anime-last-stand` | 0 | 3 | Keep 404 unless article category pages return. |
| `https://bloxodes.com/articles/category/basketball-zero` | 0 | 4 | Keep 404 unless article category pages return. |
| `https://bloxodes.com/articles/category/blue-lock-rivals` | 0 | 4 | Keep 404 unless article category pages return. |
| `https://bloxodes.com/articles/category/cookie-kingdom-world` | 0 | 3 | Keep 404 unless article category pages return. |
| `https://bloxodes.com/articles/category/dance-for-ugc` | 0 | 3 | Keep 404 unless article category pages return. |
| `https://bloxodes.com/articles/category/dig` | 0 | 1 | Keep 404 unless article category pages return. |
| `https://bloxodes.com/articles/category/dig-the-backyard` | 0 | 3 | Keep 404 unless article category pages return. |
| `https://bloxodes.com/articles/category/doors` | 0 | 3 | Keep 404 unless article category pages return. |
| `https://bloxodes.com/articles/category/dress-to-impress` | 0 | 3 | Keep 404 unless article category pages return. |
| `https://bloxodes.com/articles/category/island-of-move` | 0 | 4 | Keep 404 unless article category pages return. |
| `https://bloxodes.com/articles/category/jujutsu-infinite` | 0 | 6 | Keep 404 unless article category pages return. |
| `https://bloxodes.com/articles/category/jujutsu-shenanigans` | 0 | 3 | Keep 404 unless article category pages return. |
| `https://bloxodes.com/articles/category/katana-simulator` | 0 | 3 | Keep 404 unless article category pages return. |
| `https://bloxodes.com/articles/category/piggy-branched-realities` | 0 | 3 | Keep 404 unless article category pages return. |
| `https://bloxodes.com/articles/category/shindo-life` | 0 | 3 | Keep 404 unless article category pages return. |
| `https://bloxodes.com/articles/category/volleyball-legends` | 0 | 3 | Keep 404 unless article category pages return. |
| `https://bloxodes.com/articles/category/water-pumping-incremental-2` | 0 | 3 | Keep 404 unless article category pages return. |
| `https://bloxodes.com/articles/category/weak-legacy-2` | 0 | 14 | Keep 404; likely stale/low-value category path. |
| `https://bloxodes.com/da-hood` | 0 | 1 | If this was an old game hub, decide whether it should become `/wiki/da-hood`; otherwise keep 404. |

### GSC Page Indexing deleted/noindex buckets

The Search Console Page Indexing UI snapshot from May 23, 2026 showed:

| Reason | Pages | Current interpretation |
| --- | ---: | --- |
| Not found 404 | 8 | Likely old/deleted URLs. Need export to identify exact paths. |
| Soft 404 | 4 | Likely weak replacement behavior or thin deleted paths. Need export. |
| Excluded by noindex tag | 21 | Live crawl of current sitemap found 0 noindex, so these are probably stale/historical/non-sitemap URLs. Need export. |

Action:

- Export these rows from GSC UI.
- Classify each URL as `redirect`, `keep 404`, `return 410`, `restore page`, or `remove stale internal link`.
- Do not guess based on the count alone.

## What To Do Next

### 1. Add missing old-code redirects where an exact current code page exists

Recommended additions to `apps/web/src/data/slug_oldslugs.json`:

| Canonical slug | Add old slug |
| --- | --- |
| `bounce-a-brainrot` | `bouncea-brainrot-codes` |
| `clean-a-house` | `cleana-house-codes` |
| `drop-a-poop` | `dropa-poop-codes` |
| `ink-game` | `ink-game-codes` |

Do not add `brookhaven-codes` until we decide whether a real Brookhaven codes page should exist. Redirecting a codes-intent URL to `/wiki/brookhaven-rp` would not match the query intent.

### 2. Build a weekly migration dashboard

Create a script under `scripts/seo/` that outputs:

- All `slug_oldslugs.json` mappings.
- Whether each old URL returns one direct 301 to the expected target.
- Whether each target returns 200.
- Whether the old URL appears in GSC page rows.
- Whether the target URL appears in GSC page rows.
- Old URL clicks/impressions vs target URL clicks/impressions.
- URL Inspection status for the target URL.
- Whether the target URL is present in the current sitemap.

Priority output:

```text
old_url,target_url,old_status,target_status,old_clicks,old_impressions,target_clicks,target_impressions,target_url_inspection_status,in_sitemap,action
```

### 3. Keep old redirects long-term

For old root code URLs and old article URLs, keep redirects for a long time. They are cheap and they protect old external links, old search memories, and user bookmarks.

Remove a redirect only when all are true:

- The old URL has no GSC impressions for a long period.
- The old URL has no meaningful Bing/GA4 traffic.
- The target no longer exists or no longer matches the old intent.
- There are no important external backlinks to preserve.

### 4. Fix internal links before requesting more indexing

Google should see only current URLs in internal links:

- `/codes/<slug>`
- `/articles/<slug>`
- `/wiki/<game-slug>`
- `/wiki/<game-slug>/<collection-slug>`
- `/tools/<slug>`
- `/checklists/<slug>`
- `/quizzes/<slug>`
- `/events/<slug>`

Old URLs should exist only as redirect catchers, not as linked destinations.

### 5. Do not rely on Google sitemap ping

Google's old sitemap ping endpoint is deprecated. Do not build a "ping Google" workflow around it.

Use:

- Submitted sitemap index and child sitemaps in Search Console.
- Honest `lastmod` values when a page materially changes.
- URL Inspection/request indexing for a small set of priority pages when working manually.
- Weekly measurement of discovery/indexing movement.

The Google Indexing API is now treated as an explicit, owner-approved experiment rather than a default SEO recommendation. Google documents the API as intended for `JobPosting` and livestream `BroadcastEvent` pages, so any Bloxodes use must stay behind the guarded `npm run indexing:google` workflow, daily limits, Supabase state logging, and `GOOGLE_INDEXING_API_ENABLED=true`.

## Decision Rules

Use this decision tree for every old URL:

| Old URL state | Action |
| --- | --- |
| Exact current equivalent exists | 301 to the equivalent current URL |
| Same topic exists but user intent is different | Usually keep 404; create a proper page if traffic justifies it |
| Old URL was a typo for a real current page | 301 to the current page |
| Old URL was a category/archive and categories are no longer public | Keep 404 unless category pages return |
| Old URL has external links or search demand but no replacement | Consider restoring a useful page |
| Old URL is junk, spam, random, or no-demand | Keep 404 or use 410 if intentionally gone |
| Old URL was moved to wiki collection structure | Permanent redirect to `/wiki/<game>/<collection>` |
| Old URL was moved from root article to article route | 301 to `/articles/<slug>` |

## Do Not Do

- Do not redirect all 404s to the homepage.
- Do not redirect codes intent to wiki pages unless the wiki page is intentionally the best answer.
- Do not add old URLs back into sitemaps.
- Do not internally link to old root code URLs.
- Do not create thin "we moved this page" pages.
- Do not use Google sitemap ping endpoints.
- Do not use the Google Indexing API outside the guarded opt-in workflow.

## Success Metrics

Track these weekly:

| Metric | Desired movement |
| --- | --- |
| GSC page rows for old root code URLs | Down over time |
| GSC page rows for current `/codes/*` URLs | Up over time |
| GSC current sitemap URLs unknown to Google | Down over time |
| GSC 404 and soft 404 count | Stable/down after intentional cleanup |
| Bing current URL discovery | Stay healthy |
| Internal link crawl old URL count | Zero |
| Redirect chain count | Zero; old URL should go directly to final target |

## Source Notes

- Google's site move guidance says URL moves should be mapped from old URLs to new URLs and monitored until search systems process the change: https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes
- Google's redirect guidance treats 301 and other permanent redirects as strong migration signals when the target is the correct replacement: https://developers.google.com/search/docs/crawling-indexing/301-redirects
- Google deprecated sitemap ping endpoints; use Search Console and sitemap discovery instead: https://developers.google.com/search/blog/2023/06/sitemaps-lastmod-ping
- Google documents the Indexing API as limited to `JobPosting` and livestream `BroadcastEvent` pages: https://developers.google.com/search/apis/indexing-api/v3/using-api
