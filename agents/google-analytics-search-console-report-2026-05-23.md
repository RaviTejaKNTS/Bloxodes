# Bloxodes Search Indexing Audit

Date prepared: May 23, 2026  
Primary range reviewed: September 15, 2025 to May 23, 2026  
Properties reviewed: GA4, Google Search Console, Bing Webmaster Tools, live sitemap/HTML crawl, Google URL Inspection API

This is intentionally not a setup report. Credentials, OAuth, and local API wiring are out of scope here except where they affect data reliability. The question this report answers is: why does Bloxodes have real Bing traction while Google has only indexed the homepage and barely sees the rest of the site?

## Executive Diagnosis

The Google issue is not robots.txt, noindex, broken status codes, missing canonicals, or a total site rendering failure. The current live site is crawlable. The stronger diagnosis is a current-URL discovery, migration, and index-quality trust problem.

The most important number: out of 1,155 current sitemap URLs inspected through Google's URL Inspection API, only 1 URL is reported as indexed: the homepage.

| Google URL Inspection status | Current sitemap URLs |
| --- | ---: |
| Submitted and indexed | 1 |
| Crawled - currently not indexed | 32 |
| URL is unknown to Google | 1,122 |

That means Google has not even seen 97.1% of the current URLs in the sitemap set. This is deeper than "Google crawled the pages and rejected them." For most current pages, Google has no URL record at all.

Bing shows the opposite pattern. Bing has discovered and crawled all 1,155 tested current sitemap URLs, reports about 1,040 pages in its index, and sent 130,817 clicks from 5,494,460 impressions in the available Bing Webmaster range. GA4 confirms the same direction: Bing organic sent 115,397 sessions and 356,975 page views in the review period, while Google organic sent only 643 sessions and 3,026 page views.

So the site is not broadly uncrawlable. Bing, Yahoo, DuckDuckGo, ChatGPT referrals, and direct traffic can reach useful pages. Google is the outlier.

The biggest hidden pattern is URL history. Google Search Console performance data is still mostly attached to old root code URLs like `/type-soul-codes`, `/da-hood-codes`, and `/drag-drive-simulator-codes`, while the live sitemap now uses `/codes/type-soul`, `/codes/da-hood`, and `/codes/drag-drive-simulator`. The codebase correctly has 301 redirects for 360 old root code slugs, but Google has not fully processed that migration. In several tested pairs, the old root URL is "Crawled - currently not indexed" or unknown, while the new `/codes/...` URL is unknown to Google.

The second hidden pattern is weak discovery depth. The live HTML crawl found all current URLs returning 200 with self canonicals, but 169 current sitemap URLs were orphaned inside the fetched page set, and 508 had only one or zero internal inlinks within the fetched set. Bing's URLInfo data also shows 1,087 of 1,155 URLs with zero reported anchor count. The exact Bing anchor metric is not identical to a local internal-link crawl, but both measurements point in the same direction: the site has many valid URLs but not enough strong crawlable link signals pointing at the individual detail pages.

The third pattern is content and authority. For competitive "Roblox codes" queries, Google already has entrenched pages from Pro Game Guides, GamesRadar, Pocket Gamer, Beebom, RobloxDen, Sportskeeda, TheGamer, and game-specific microsites. Bloxodes can beat Bing with scale and useful data, but Google is more conservative about crawling and indexing large page clusters that look templated, migrated, or weakly linked. The newer wiki/catalog/tool pages are much more distinctive, but Google has not seen them yet.

## Data Pulled

| Source | Range or run date | What was checked |
| --- | --- | --- |
| Live sitemap and HTML crawl | May 23, 2026 | 1,155 sitemap URLs, HTTP status, canonical, noindex, H1, server-rendered text, internal links |
| Google URL Inspection API | May 23, 2026 | All 1,155 current sitemap URLs |
| Google Search Console performance | September 15, 2025 to May 21, 2026 | Queries, pages, countries, devices |
| Google Search Console sitemaps | May 23, 2026 API state | Submitted sitemap counts, indexed counts, last downloaded dates |
| GA4 | September 15, 2025 to May 22, 2026 | Sources, channels, landing pages, month trend |
| Bing Webmaster Tools rank/traffic | October 9, 2025 to May 21, 2026 | Clicks, impressions, daily search activity |
| Bing Webmaster crawl stats | November 23, 2025 to May 22, 2026 | Crawled pages, in-index count, crawl errors, robots blocks |
| Bing URLInfo | May 23, 2026 | Discovery and crawl state for all 1,155 current sitemap URLs |

The Bing rank/traffic API only returned data starting October 9, 2025, so the September 15 to October 8 period is covered by GA4/GSC but not by Bing rank/traffic.

## Current URL Universe

The live sitemap index returns 200 and lists 11 child sitemaps. The current sitemap universe has 1,155 unique public URLs.

| Page family | Current sitemap URLs |
| --- | ---: |
| Codes | 697 |
| Articles | 205 |
| Wiki | 124 |
| Lists | 61 |
| Events | 22 |
| Other hubs/legal/static | 16 |
| Catalog | 8 |
| Tools | 7 |
| Checklists | 7 |
| Authors | 4 |
| Quizzes | 3 |
| Home | 1 |

Sitemap freshness is not the issue on paper: 863 sitemap URLs have `lastmod` on or after May 1, 2026. But Google has still not seen most of them. Among those 863 recently updated URLs, 850 are unknown to Google and 13 are crawled but not indexed.

## Google Indexing Reality

### Search Console Page Indexing UI snapshot

The Search Console Page Indexing UI was checked in Comet under the correct Google account (`ravitejaknts@gmail.com`) on May 23, 2026. It shows Google's known-page universe is much smaller than the live sitemap universe.

| GSC Page Indexing UI metric | Count |
| --- | ---: |
| Indexed | 1 |
| Not indexed | 353 |
| Total known in this UI view | 354 |

Reasons shown in the UI:

| Reason | Source | Validation | Pages |
| --- | --- | --- | ---: |
| Crawled - currently not indexed | Google systems | Failed | 320 |
| Excluded by `noindex` tag | Website | Passed | 21 |
| Not found (404) | Website | Not Started | 8 |
| Soft 404 | Website | Passed | 4 |
| Duplicate without user-selected canonical | Website | Passed | 0 |
| Page with redirect | Website | Passed | 0 |
| Alternate page with proper canonical tag | Website | Passed | 0 |
| Discovered - currently not indexed | Google systems | Passed | 0 |

This UI snapshot and the URL Inspection API are describing different layers of the same problem:

- GSC Page Indexing knows about only 354 URLs.
- The live sitemap universe has 1,155 URLs.
- URL Inspection across the full current sitemap set says 1,122 current URLs are unknown to Google.
- Therefore, about 801 current sitemap URLs are not even represented in Google's known-page indexing report yet.

The 21 `noindex` rows in the UI need a separate export, because the live May 23 crawl of the 1,155 current sitemap URLs found 0 noindex pages. The likely explanations are stale/historical URLs, non-sitemap URLs, or URLs that changed since Google last saw them. It is not evidence of a current sitemap-wide noindex problem.

### URL Inspection by page family

| Page family | Total | Indexed | Crawled, not indexed | Unknown to Google |
| --- | ---: | ---: | ---: | ---: |
| Home | 1 | 1 | 0 | 0 |
| Codes | 697 | 0 | 11 | 686 |
| Articles | 205 | 0 | 6 | 199 |
| Wiki | 124 | 0 | 0 | 124 |
| Lists | 61 | 0 | 1 | 60 |
| Events | 22 | 0 | 0 | 22 |
| Other hubs/legal/static | 16 | 0 | 7 | 9 |
| Catalog | 8 | 0 | 1 | 7 |
| Tools | 7 | 0 | 3 | 4 |
| Checklists | 7 | 0 | 2 | 5 |
| Authors | 4 | 0 | 1 | 3 |
| Quizzes | 3 | 0 | 0 | 3 |

This is the core diagnosis. Google has not merely decided that thousands of crawled Bloxodes pages are low quality. For 1,122 current URLs, Google says it has not seen the URL before.

Google's own URL Inspection documentation defines "URL is unknown to Google" as Google not having seen that URL before. The same documentation says the inspection result is based on Google's indexed information, not a live crawl, so stale results can exist when Google has not refreshed a URL recently. That matters for Bloxodes because some inspected URLs show old crawl/canonical history that no longer matches the current live HTML.

### Indexed page

Only the homepage is currently reported as "Submitted and indexed" among the current sitemap URLs.

| URL | Status | Last crawl | Referring URLs |
| --- | --- | --- | --- |
| `https://bloxodes.com/` | Submitted and indexed | 2026-05-23T08:05:00Z | `https://bloxodes.com/sitemap.xml`, `https://bloxodes.netlify.app/` |

### Crawled but not indexed examples

These URLs prove Google can fetch Bloxodes pages when it decides to, but also show stale crawl history.

| URL | Last Google crawl | Current URL Inspection status | Notable pattern |
| --- | --- | --- | --- |
| `/codes` | 2025-11-27 | Crawled - currently not indexed | Inspection still reports user canonical as homepage, but live HTML now self-canonicalizes to `/codes` |
| `/articles` | 2025-12-12 | Crawled - currently not indexed | Old crawl, no recent refresh |
| `/checklists` | 2026-04-27 | Crawled - currently not indexed | Hub seen but not indexed |
| `/codes/basketball-zero` | 2026-02-04 | Crawled - currently not indexed | Current page updated May 23, but Google crawl is old |
| `/codes/notoriety` | 2026-05-08 | Crawled - currently not indexed | One of the few recently crawled code pages |
| `/codes/the-forge` | 2025-12-10 | Crawled - currently not indexed | Strong Bing page family, stale Google crawl |
| `/articles/how-to-craft-cutlass-on-the-forge-roblox` | 2026-02-13 | Crawled - currently not indexed | Article cluster seen once, not included |
| `/catalog/roblox-music-ids` | 2026-05-23 | Crawled - currently not indexed | High Bing traffic page, newly crawled by Google but still not indexed in inspection |

The `/catalog/roblox-music-ids` result is important. GA4 says this is the strongest Bing page on the site, and GSC has one page-row impression/click for it, but URL Inspection still reports it as "Crawled - currently not indexed." This suggests Google may have tested it recently and still has not committed it into the main index, or that the URL Inspection data and performance data are not perfectly synchronized.

### Not even crawled examples

The following current page families are almost completely absent from Google's URL graph:

| Family | Unknown examples |
| --- | --- |
| Wiki | `/wiki`, `/wiki/wizard-alchemy`, all 124 wiki sitemap URLs |
| Events | `/events`, `/events/aba`, all 22 event sitemap URLs |
| Quizzes | `/quizzes`, all 3 quiz sitemap URLs |
| Codes | `/codes/type-soul`, `/codes/da-hood`, `/codes/go-fishing`, `/codes/wizard-alchemy`, and 682 more code URLs |
| Lists | 60 of 61 list URLs |

This is why the fix cannot be just "write better page copy." Better copy matters, especially for crawled-not-indexed pages, but most current URLs are still before the content-quality evaluation step. Google needs stronger discovery and migration signals first.

## Search Console Performance Pattern

GSC performance from September 15, 2025 to May 21, 2026 is tiny compared with Bing.

| GSC metric | Value |
| --- | ---: |
| Total clicks from date rows | 447 |
| Total impressions from date rows | 4,661 |
| Query rows | 444 |
| Page rows | 192 |

The top query is brand:

| Query class | Clicks | Impressions |
| --- | ---: | ---: |
| `bloxodes` branded query | 357 | 475 |
| Non-brand query rows | 4 | 2,500 |

Google is mostly surfacing the homepage for people who already know the brand. It is not yet treating Bloxodes as a broad Roblox resource.

### Page rows expose the migration problem

| GSC page-row class | Rows |
| --- | ---: |
| Legacy root code URLs | 148 |
| Articles | 20 |
| Other/root | 19 |
| Home | 2 |
| Lists | 2 |
| Catalog | 1 |
| Current `/codes/*` URLs | 0 |
| Wiki/events/tools/checklists/quizzes detail URLs | 0 |

Only 12 of 192 GSC page rows are URLs that exist in the current sitemap. 180 page rows are not in the current sitemap, mostly old root code URLs.

This is the clearest proof that Google is living in the old Bloxodes URL structure. Current sitemap URLs are `/codes/<slug>`, but Google performance is still attached to old root URLs like `/flex-ugc-codes`, `/go-fishing-codes`, `/drag-drive-simulator-codes`, and `/jailbreak-codes`.

Top GSC pages in the period:

| Page | Clicks | Impressions | Avg position |
| --- | ---: | ---: | ---: |
| `https://bloxodes.com/` | 422 | 1,541 | 2.89 |
| `https://bloxodes.com/flex-ugc-codes` | 4 | 86 | 7.19 |
| `https://bloxodes.com/go-fishing-codes` | 3 | 145 | 3.27 |
| `https://bloxodes.com/99-nights-in-the-forest-codes` | 2 | 86 | 11.42 |
| `https://bloxodes.com/anime-world-tower-defense-codes` | 2 | 39 | 3.95 |
| `https://bloxodes.com/drag-drive-simulator-codes` | 2 | 256 | 2.96 |
| `https://bloxodes.com/catalog/roblox-music-ids` | 1 | 1 | 1.00 |

The current `/codes/flex-ugc`, `/codes/go-fishing`, and `/codes/drag-drive-simulator` URLs are not the URLs carrying Google performance. The old root URLs are.

## Sitemap Processing Pattern

The live sitemap files are valid and return 200. The Search Console sitemap API still shows stale or partial processing.

| Sitemap | Live URL count | GSC submitted count | GSC indexed count | Last downloaded |
| --- | ---: | ---: | ---: | --- |
| `/sitemaps/codes.xml` | 695 | 585 | 0 | 2026-05-22 |
| `/sitemaps/articles.xml` | 205 | 116 | 0 | 2026-03-05 |
| `/sitemaps/lists.xml` | 61 | 61 | 0 | 2026-03-05 |
| `/sitemaps/tools.xml` | 7 | 5 | 0 | 2026-05-04 |
| `/sitemaps/checklists.xml` | 7 | 6 | 0 | 2026-04-29 |
| `/sitemaps/events.xml` | 22 | 22 | 0 | 2026-03-21 |
| `/sitemaps/catalog.xml` | 9 | 4 | 0 | 2026-03-09 |
| `/sitemaps/authors.xml` | 4 | 4 | 0 | 2026-05-12 |
| `/sitemap.xml` | 11 child sitemaps | index sitemap | no index count | 2026-05-13 |

Search Console did not list the current wiki and quiz child sitemaps as individually submitted rows, even though the live sitemap index includes them. That may be fine in theory because the sitemap index points to them, but in practice Google has not discovered any wiki or quiz URLs. For Bloxodes, each child sitemap should be submitted and monitored separately so we can see whether Google is actually downloading and processing the new page families.

Google's sitemap documentation says sitemaps help Google discover URLs but do not guarantee that every URL will be crawled or indexed. Google's crawl-budget documentation also says crawl demand is influenced by popularity, staleness, quality, relevance, and site events like site moves. Bloxodes is matching that failure mode: sitemaps exist, but Google demand for current detail URLs is extremely low.

## Live Technical Crawl

The technical crawl does not show a global block.

| Check | Result |
| --- | ---: |
| Sitemap URLs fetched | 1,155 |
| HTTP 200 URLs | 1,155 |
| Noindex pages | 0 |
| Canonical mismatches in live HTML | 0 |
| Missing canonicals | 0 |
| Empty H1 pages | 0 |
| Thin server-rendered text pages | 5 |

By page family:

| Family | Total | Status 200 | Noindex | Canonical mismatch | Avg server text | Orphan within fetched set | Low inlinks within fetched set |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Codes | 697 | 697 | 0 | 0 | 5,586 chars | 135 | 321 |
| Articles | 205 | 205 | 0 | 0 | 6,396 chars | 34 | 62 |
| Wiki | 124 | 124 | 0 | 0 | 22,973 chars | 0 | 110 |
| Lists | 61 | 61 | 0 | 0 | 13,139 chars | 0 | 10 |
| Events | 22 | 22 | 0 | 0 | 4,364 chars | 0 | 4 |
| Tools | 7 | 7 | 0 | 0 | 10,303 chars | 0 | 0 |
| Checklists | 7 | 7 | 0 | 0 | 28,093 chars | 0 | 0 |
| Quizzes | 3 | 3 | 0 | 0 | 1,764 chars | 0 | 0 |
| Catalog | 8 | 8 | 0 | 0 | 7,460 chars | 0 | 1 |

The technical weakness is not indexability. It is link depth and crawl prioritization. Many detail pages are technically valid but are not receiving enough contextual internal links beyond global nav/hub links. Google documentation is explicit that links help Google find pages and understand what linked pages are about. Bloxodes needs stronger crawlable page-to-page linking inside game clusters, code hubs, article clusters, wiki hubs, and high-performing category/list pages.

Robots.txt is clean:

```txt
User-Agent: *
Allow: /
Disallow: /api/
Disallow: /admin

Sitemap: https://bloxodes.com/sitemap.xml
```

## Bing Contrast

Bing is the control group. It proves the site can be crawled, discovered, indexed, and searched.

| Bing metric | Value |
| --- | ---: |
| Rank/traffic clicks | 130,817 |
| Rank/traffic impressions | 5,494,460 |
| Rank/traffic API days | 225 |
| Latest in-index count | 1,040 |
| Max in-index count | 1,043 |
| Total crawled pages in crawl stats | 948,831 |
| Latest daily crawled pages | 13,917 |
| Robots-blocked total | 0 |
| Current sitemap URLs discovered by Bing URLInfo | 1,155 of 1,155 |
| Current sitemap URLs crawled by Bing URLInfo | 1,155 of 1,155 |

Recent Bing daily activity:

| Date | Bing clicks | Bing impressions |
| --- | ---: | ---: |
| 2026-05-12 | 714 | 29,661 |
| 2026-05-13 | 898 | 33,571 |
| 2026-05-14 | 824 | 28,506 |
| 2026-05-15 | 1,008 | 40,304 |
| 2026-05-16 | 1,239 | 52,912 |
| 2026-05-17 | 1,307 | 49,092 |
| 2026-05-18 | 964 | 37,828 |
| 2026-05-19 | 788 | 31,385 |
| 2026-05-20 | 965 | 36,201 |
| 2026-05-21 | 1,338 | 45,882 |

Bing feed status is also clean. All listed sitemap feeds are `Success`. Bing still has stale counts for a few child sitemaps, but unlike Google, Bing has discovered and crawled the current sitemap URL set anyway.

Bing crawl stats do show 14,713 total crawl errors in the available crawl-stat range, including 5,145 4xx and 485 5xx responses. The current 1,155-URL live crawl is clean, and Bing's `crawlIssues` endpoint returned no current issue rows, so these look like historical or non-sitemap crawl waste. They should still be mined from server logs because excessive old redirects, old roots, and bad URLs can waste crawler attention.

## GA4 Traffic Pattern

GA4 agrees with Bing Webmaster Tools.

| Source / medium | Sessions | Page views | Users |
| --- | ---: | ---: | ---: |
| `bing / organic` | 115,397 | 356,975 | 81,422 |
| `yahoo / organic` | 15,042 | 36,056 | 10,858 |
| `(direct) / (none)` | 14,842 | 29,800 | 12,855 |
| `yandex.ru / referral` | 3,686 | 4,702 | 2,805 |
| `duckduckgo / organic` | 2,715 | 7,139 | 1,969 |
| `chatgpt.com / (not set)` | 1,552 | 7,058 | 1,328 |
| `chatgpt.com / referral` | 1,493 | 7,937 | 993 |
| `google / organic` | 643 | 3,026 | 418 |

Organic Search grew strongly across the period, but that growth is overwhelmingly non-Google:

| Month | Organic sessions | Organic page views |
| --- | ---: | ---: |
| October 2025 | 132 | 145 |
| November 2025 | 2,425 | 2,585 |
| December 2025 | 12,562 | 16,701 |
| January 2026 | 22,256 | 73,609 |
| February 2026 | 11,247 | 31,286 |
| March 2026 | 32,718 | 101,353 |
| April 2026 | 42,508 | 126,103 |
| May 2026 through May 22 | 28,377 | 87,745 |

Top Bing landing pages show where search demand already exists:

| Bing landing page | Sessions |
| --- | ---: |
| `/catalog/roblox-music-ids` | 51,541 |
| `/tools/robux-to-usd-calculator` | 2,620 |
| `/codes/southwest-florida` | 2,617 |
| `/lists/top-trending-roblox-games` | 1,899 |
| `/codes/hunty-zombie` | 1,611 |
| `/codes/anime-card-clash` | 1,492 |
| `/tools/the-forge-crafting-calculator` | 1,486 |
| `/codes/all-star-tower-defense` | 1,289 |
| `/articles/all-fisch-enchantments-guide` | 1,211 |
| `/codes/re-xl` | 1,112 |
| `/codes/evade` | 1,072 |
| `/articles/frostspire-expanse-all-ores-and-new-pickaxe-locations-in-the-forge` | 1,034 |

Google organic landing pages are mostly homepage, music ID pages, `/codes`, pagination, and a tiny number of detail pages. This again shows Google has not reached the current detail-page inventory at scale.

## URL Migration Diagnosis

The codebase has a real migration layer:

- `apps/web/src/proxy.ts` imports `apps/web/src/data/slug_oldslugs.json`.
- The old-root slug map has 360 mappings.
- Old root code slugs redirect with 301 to `/codes/<canonical-slug>`.
- The current code sitemap emits `/codes/${row.slug}` from `code_pages_index_view`.

Examples:

| Old root URL | Current URL |
| --- | --- |
| `/type-soul-codes` | `/codes/type-soul` |
| `/da-hood-codes` | `/codes/da-hood` |
| `/flex-ugc-codes` | `/codes/flex-ugc` |
| `/go-fishing-codes` | `/codes/go-fishing` |

The redirect implementation is directionally correct. The problem is that Google has not fully recrawled the old URLs and transferred signals to the new URLs.

Legacy/current inspection sample:

| URL | Google URL Inspection result |
| --- | --- |
| `https://bloxodes.com/type-soul-codes` | Crawled - currently not indexed, last crawl 2025-11-18 |
| `https://bloxodes.com/da-hood-codes` | Crawled - currently not indexed, last crawl 2026-01-21 |
| `https://bloxodes.com/flex-ugc-codes` | Crawled - currently not indexed, last crawl 2025-11-13 |
| `https://bloxodes.com/go-fishing-codes` | URL is unknown to Google |
| `https://bloxodes.com/jailbreak-codes` | URL is unknown to Google |
| `https://bloxodes.com/codes/type-soul` | URL is unknown to Google |
| `https://bloxodes.com/codes/da-hood` | URL is unknown to Google |
| `https://bloxodes.com/codes/flex-ugc` | URL is unknown to Google |
| `https://bloxodes.com/codes/go-fishing` | URL is unknown to Google |

Google's migration documentation says a URL move is processed per URL and Googlebot must visit old and new URLs to complete the move. It also recommends keeping permanent redirects for as long as possible, ideally at least a year, and updating internal links to point to the new URLs. Bloxodes has the redirects, but Google has not done the recrawl/reassignment at scale.

This explains the mismatch:

1. Current sitemaps submit new `/codes/...` URLs.
2. GSC performance still reports old root `*-codes` URLs.
3. Many old URLs have old crawl dates.
4. New URLs are often unknown to Google.
5. Bing has already adapted and sends traffic to current `/codes/...` URLs.

## Competition and Google Search Context

For Roblox codes queries, Google is crowded with established, frequently crawled, high-authority pages. Searches checked on May 23, 2026 show results from sources such as:

- Pro Game Guides for `type soul codes` and `hunty zombie codes`.
- Pocket Gamer for `type soul codes`.
- GamesRadar and TheGamer for `hunty zombie codes`.
- Dedicated Wizard Alchemy microsites such as `wizardalchemy.wiki`, `wizardalchemy.net`, and `wizardalchemy.org`.
- RobloxDen and Beebom as common code-list references for many Roblox games.

These pages are not only code tables. They usually have author signals, update language, manual or editorial framing, how-to-redeem instructions, reward explanations, related guides, and stronger external/internal link histories. Bloxodes should not copy their stale date-heavy style, especially because the Bloxodes codes workflow is source-fed and evergreen. But Google is comparing Bloxodes against a very mature SERP.

Google's current public stance also matters:

- Sitemaps are discovery aids, not index guarantees.
- Crawl demand is affected by page quality, relevance, staleness, popularity, and site events.
- Internal links help Google discover pages and understand linked-page context.
- Helpful, reliable, people-first content is the north star for ranking systems.
- Scaled pages with little original value are explicitly risky under Google's spam policies.
- The May 2026 core update began on May 21, 2026 and may take up to two weeks to roll out.

The May 2026 core update is not the root cause because Bloxodes' Google problem exists across September 2025 to May 2026. It is still relevant because recovery work should avoid quick, panicked changes during a rolling core update. The fix should be structural and durable: clean migration signals, stronger internal linking, distinctive page clusters, better source trust, and measurable reinspection.

Similar industry cases usually split into two buckets:

1. "Discovered/unknown/not crawled" patterns, where Google is aware of too few URLs or assigns low crawl priority to a cluster.
2. "Crawled - currently not indexed" patterns, where Google fetched the page but did not find enough reason to include it.

Bloxodes has both, but the first one is dominant. Search Engine Land's analysis of "Discovered - currently not indexed" matches the Bloxodes pattern in two ways: Google can deprioritize URL patterns based on site architecture/quality assumptions, and weak internal linking can keep pages out of the crawl/indexing path. Bloxodes is even earlier than "Discovered" for many current URLs because URL Inspection says "unknown."

## What Is Not the Main Issue

| Possible issue | Evidence |
| --- | --- |
| robots.txt blocking Google | Robots allows `/`; only `/api/` and `/admin` are disallowed |
| Sitewide noindex | 0 noindex pages found in 1,155 live sitemap URLs |
| Broken live URLs | 1,155 of 1,155 current sitemap URLs returned 200 |
| Live canonical errors | 0 canonical mismatches found in live HTML crawl |
| Empty pages | Average server-rendered text is healthy across major page families; only 5 thin pages flagged |
| Bing/general crawlability | Bing discovered and crawled all 1,155 tested current sitemap URLs |
| Analytics setup | GA4, GSC, and Bing APIs returned data |

The one caveat: Google URL Inspection can contain stale indexed-version data. For example, `/codes` still shows a historical user canonical to homepage from its 2025 crawl, even though the live page now self-canonicalizes correctly. That is not a current live canonical bug, but it proves Google has stale memories of old page states.

Manual Actions and Security Issues are not exposed in the API dataset pulled for this report. The pattern does not look like a clean manual deindex because the homepage is indexed, old URLs still have impressions, and Bing is healthy. Still, the Search Console UI should be checked once for Manual Actions, Security Issues, and Removals to close that non-API gap.

## Priority Fix Plan

### Priority 0: Stop flying blind

Create a weekly search audit job using the same APIs and keep the output in a tracked internal report. The job should produce:

- Current sitemap counts by family.
- GSC sitemap submitted/indexed/downloaded counts.
- URL Inspection status for a fixed priority queue and a rotating sample.
- GSC current-vs-legacy page-row split.
- GA4 landing pages by source.
- Bing clicks, impressions, in-index count, crawl errors, and URLInfo discovery/crawl state.

Success metric: weekly reports should show the unknown-to-Google count dropping for priority URLs, current `/codes/*` URLs appearing in GSC page rows, and child sitemaps showing indexed URLs above zero.

### Priority 1: Treat this as a Google migration recovery

Build a 360-row migration dashboard from `slug_oldslugs.json`:

| Field | Why it matters |
| --- | --- |
| Old root URL | The URL Google still reports in performance |
| Redirect status | Must be direct 301 to the final current URL |
| Target current URL | The sitemap URL Google should index |
| Old URL Inspection status | Shows whether Google has recrawled the old URL |
| New URL Inspection status | Shows whether the target has entered Google's graph |
| GSC impressions/clicks | Prioritizes old URLs with remaining demand |
| GA4/Bing sessions | Prioritizes pages with proven search value |

Then work in batches:

1. Pick the top 50 old URLs by Bing sessions, GSC impressions, and business value.
2. Confirm each old URL redirects in one hop to the exact new URL.
3. Confirm every internal link points to the new URL, never the old root URL.
4. Request indexing on the current target URL for the top batch through Search Console UI.
5. Inspect the old URL after Google recrawls; the target should start appearing as the canonical/index candidate.
6. Keep redirects indefinitely if possible, and at least longer than Google's recommended one-year minimum.

Do not reintroduce old root URLs into sitemaps. The goal is to make Google finish the move, not split signals again.

### Priority 2: Submit and monitor child sitemaps separately

The sitemap index is valid, but Search Console is not giving enough visibility for every family. Submit these individually in GSC:

- `https://bloxodes.com/sitemaps/main.xml`
- `https://bloxodes.com/sitemaps/codes.xml`
- `https://bloxodes.com/sitemaps/articles.xml`
- `https://bloxodes.com/sitemaps/lists.xml`
- `https://bloxodes.com/sitemaps/tools.xml`
- `https://bloxodes.com/sitemaps/checklists.xml`
- `https://bloxodes.com/sitemaps/quizzes.xml`
- `https://bloxodes.com/sitemaps/wiki.xml`
- `https://bloxodes.com/sitemaps/events.xml`
- `https://bloxodes.com/sitemaps/authors.xml`
- `https://bloxodes.com/sitemaps/catalog.xml`

Also add `lastmod` to the sitemap index entries if possible, using each child sitemap's latest URL `lastmod`. The child sitemaps already contain URL-level `lastmod`; index-level `lastmod` will make the sitemap index itself more informative.

Success metric: GSC should show current submitted counts close to live counts, especially codes 695, articles 205, wiki 124, and catalog 9. Indexed counts should stop being zero for every child sitemap.

### Priority 3: Build crawlable game clusters

Current global navigation links hubs from every page, but detail pages need stronger contextual links. The goal is for Googlebot to reach important pages by following meaningful HTML links, not only through XML sitemaps.

For every high-value Roblox game with multiple Bloxodes assets, create a crawlable cluster:

- Codes page links to wiki hub, event page, tools, checklist, quiz, and relevant articles.
- Wiki hub links to codes, events, catalog pages, tools, checklist, quiz, and related articles.
- Catalog pages link back to the wiki hub and related tool/checklist/article pages.
- Tools link to the wiki hub, relevant catalog page, and codes page where natural.
- Articles link to the exact game hub and exact catalog/tool/checklist pages they mention.
- List pages link to game hubs and codes pages with descriptive anchors, not generic "Read more."

Start with pages already proven by Bing:

- `roblox-music-ids`
- `robux-to-usd-calculator`
- `southwest-florida`
- `hunty-zombie`
- `anime-card-clash`
- `the-forge-crafting-calculator`
- `all-star-tower-defense`
- `all-fisch-enchantments-guide`
- `re-xl`
- `evade`
- `drag-drive-simulator`
- `frostspire-expanse-all-ores-and-new-pickaxe-locations-in-the-forge`

Success metric: local crawl should show no important detail page as orphaned, and fewer than 10% of priority detail pages should have one or fewer inlinks within the fetched set.

### Priority 4: Improve code pages without breaking the evergreen workflow

Codes are the most competitive and most templated page family. The rule from the Bloxodes workflow still stands: do not manually write active codes, code dates, active-code counts, or freshness claims into prose. The codes refresh system owns code data.

What should improve:

- Keep the code table data automated from `source_url` and `source_url_2`.
- Add a concise, game-specific reward explanation that is not tied to current code names or dates.
- Explain redemption steps in the actual game UI.
- Explain why codes fail in evergreen terms: level requirement, server version, spelling/case, expired code, already redeemed, region/server delay.
- Add a stable "what rewards usually do" table where the rows are reward types, not current code names.
- Use author/editor/source trust signals without fake "updated daily" claims.
- Link to related game pages and mechanics that make the rewards meaningful.

Success metric: for inspected code pages, Google moves from unknown to crawled. For pages that remain crawled-not-indexed, compare them against top SERP competitors and add genuinely useful game-specific context rather than more template copy.

### Priority 5: Lean into distinctive pages

Bing's strongest page is not a code page; it is `/catalog/roblox-music-ids`. Tools and articles also show real demand. This is important because Google may be less willing to index commodity code pages from a newer domain, but distinctive catalog/tool/wiki pages can create trust and crawl demand for the whole site.

Push more internal authority into:

- Music ID catalog and subpages.
- Robux calculator.
- The Forge calculators/tools.
- Game wiki hubs with complete catalog datasets.
- Checklists/quizzes only when they are genuinely useful, not filler.
- Articles that solve specific in-game tasks with real examples and screenshots.

Success metric: new current non-code pages start appearing in GSC page rows, not only old root code URLs.

### Priority 6: Clean crawl waste and logs

Bing reports historical 4xx and 5xx crawl activity even though the current sitemap crawl is clean. Pull production logs for:

- Old root code URLs still hit by crawlers.
- 404s from malformed slugs, query paths, and old article URLs.
- Redirect chains.
- HTTP and `www` variants.
- Netlify/app host variants or old preview hosts.
- Parameterized URLs that create duplicate crawl paths.

Then either redirect, canonicalize, 404/410, or block only where appropriate. Do not use robots.txt to hide pages that should be indexed.

Success metric: Bing crawl errors trend down, server logs show fewer crawler hits to bad URLs, and Googlebot hits concentrate on current canonical URLs.

## 30-Day Recovery Targets

| Target | Good movement |
| --- | --- |
| URL Inspection for top 100 priority URLs | Unknown count drops materially |
| GSC page rows | Current `/codes/*`, `/wiki/*`, `/tools/*`, and `/catalog/*` rows begin appearing |
| GSC child sitemap reports | Indexed count no longer zero across all child sitemaps |
| GSC non-brand clicks | Non-brand clicks increase beyond the current tiny baseline |
| Internal crawl | Priority pages have contextual inlinks from game hubs, lists, related content, and tools |
| Bing | No regression; crawl errors reduce while traffic remains stable |
| GA4 | Google organic landing pages diversify beyond homepage/music IDs |

## Final Read

Bloxodes has a real audience and real search demand. Bing has already proved that. The Google problem is not that the site is useless or technically blocked. It is that Google has not built a current URL graph for Bloxodes after the URL migration, and the current detail pages do not yet have enough crawl demand, link context, and perceived originality for Google to chase them from the sitemap alone.

The right move is not to rewrite everything blindly. The right move is to recover the migration, strengthen crawlable internal clusters, submit and monitor every child sitemap, prioritize URLs that Bing already validates, and make code pages more game-specific without violating the long-term codes workflow.

## Sources Used

- Google Search Central: Sitemaps overview: https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview
- Google Search Central: Build and submit a sitemap: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- Google Search Central: Link best practices: https://developers.google.com/search/docs/crawling-indexing/links-crawlable
- Google Crawling Infrastructure: Crawl budget: https://developers.google.com/crawling/docs/crawl-budget
- Google Search Console Help: URL Inspection tool: https://support.google.com/webmasters/answer/9012289
- Google Search Central: Site moves with URL changes: https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes
- Google Search Central: Redirects and Google Search: https://developers.google.com/search/docs/crawling-indexing/301-redirects
- Google Search Central: Helpful, reliable, people-first content: https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- Google Search Central: Spam policies: https://developers.google.com/search/docs/essentials/spam-policies
- Google Search Status Dashboard: May 2026 core update: https://status.search.google.com/incidents/wdAXJk6LRRihEjpzEeWE
- Google Search Console Help: Manual actions report: https://support.google.com/webmasters/answer/9044175
- Search Engine Land: Understanding and resolving Discovered - currently not indexed: https://searchengineland.com/understanding-resolving-discovered-currently-not-indexed-392659
- Pro Game Guides Type Soul example SERP page: https://progameguides.com/roblox/roblox-type-soul-codes/
- Pro Game Guides Hunty Zombie example SERP page: https://progameguides.com/roblox/hunty-zombies-codes/
- GamesRadar Hunty Zombie example SERP page: https://www.gamesradar.com/games/rpg/hunty-zombie-codes/
- Pocket Gamer Type Soul example SERP page: https://www.pocketgamer.com/roblox/type-soul-codes/
- Wizard Alchemy example microsite: https://www.wizardalchemy.wiki/
- Wizard Alchemy example microsite: https://wizardalchemy.net/
- Wizard Alchemy example microsite: https://wizardalchemy.org/

## Local Evidence Files

- `/private/tmp/bloxodes-seo-audit-2026-05-23.json`
- `/private/tmp/bloxodes-seo-analysis-2026-05-23.json`
- `/private/tmp/bloxodes-deep-seo-audit.mjs`
- `/private/tmp/analyze-bloxodes-seo-audit.mjs`
- `/private/tmp/retry-bing-url-info-slow.mjs`
