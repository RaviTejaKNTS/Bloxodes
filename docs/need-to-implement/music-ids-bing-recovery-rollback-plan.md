# Music IDs Bing Recovery and Rollback Plan

Created: 2026-07-06

## Current Decision

We are not rolling back the Roblox Music IDs page right now.

The current working theory is that Bing may have reacted to risky user-generated comments that were visible on the Roblox Music IDs page, including at least one vulgar adult phrase posted around 2026-07-01. That timing is close to the Bing indexing drop, and the comment text is more directly aligned with a Bing quality or safety violation than the recent technical music page changes.

The immediate recovery path is:

1. Remove or reject risky comments from the Roblox Music IDs page.
2. Review and clean bad comments sitewide.
3. Strengthen comments moderation so unsafe comments cannot become public crawlable HTML.
4. Revalidate and purge affected pages so crawlers see the cleaned page.
5. Wait 7 to 10 days for Bing to recrawl and reassess before applying a broader music page rollback.

## Why Comments Are a Serious Candidate

Approved comments are rendered on public pages. For the Roblox Music IDs page, this means Bingbot can read approved comments as page content.

Relevant code path:

- `apps/web/src/app/(site)/catalog/roblox-music-ids/page-data.tsx` renders `CommentsSection` for the catalog page when the catalog row has an id.
- `apps/web/src/components/comments/CommentsSection.tsx` loads approved comments server-side.
- `apps/web/src/lib/comments.ts` fetches comments where `status = approved`.
- `apps/web/src/app/api/comments/route.ts` currently inserts accepted comments as `status: "approved"`.

Because the page is a Roblox/kids-style content page, vulgar, adult, suggestive, or low-quality song-request comments can create a page-quality problem even if the main editorial content is fine.

## Changes Made So Far

No music page rollback changes have been made as of this note.

The chosen direction is to fix comments moderation and comment cleanup first, then monitor Bing recovery. The previously planned June 20 rollback remains a fallback plan only.

## June 20 Rollback Baseline

The target baseline for a potential rollback is:

```text
fb531fe6 2026-06-20 12:39:31 +0530 Fix large game catalog HTML pages
```

This was the closest known good version of the Roblox Music IDs page before the recent music page and refresh-pipeline changes.

## What Changed After June 20

The music surface changed in these main areas:

1. The Roblox Music IDs page rendering and navigation changed.
2. New chart-style pages were added.
3. The default sorting algorithm changed.
4. The music refresh automation changed from a lighter top-100 flow to a larger top-500/chart/rerank flow.
5. The new rerank job can update the catalog page timestamp, making the page look recently modified even when the editorial content did not materially change.

Main files changed since the baseline:

- `apps/web/src/app/(site)/catalog/roblox-music-ids/MusicIdsBrowser.tsx`
- `apps/web/src/app/(site)/catalog/roblox-music-ids/page-data.tsx`
- `apps/web/src/app/(site)/catalog/roblox-music-ids/page/[page]/page.tsx`
- `apps/web/src/app/(site)/catalog/roblox-music-ids/trending/page.tsx`
- `apps/web/src/app/(site)/catalog/roblox-music-ids/trending/page/[page]/page.tsx`
- `apps/web/src/app/(site)/catalog/roblox-music-ids/artists/*`
- `apps/web/src/app/(site)/catalog/roblox-music-ids/genres/*`
- `apps/web/src/app/api/roblox-music-ids/route.ts`
- `scripts/music/collect-top-100-songs.ts`
- `scripts/music/collect-curated-roblox-music-ids.ts`
- `scripts/music/rerank-roblox-music-ids.ts`
- `.github/workflows/daily-top-100-songs.yml`
- `.github/workflows/roblox-music-ids-refresh.yml`
- `scripts/ops/vps-scheduled-automation.crontab`
- `package.json`

New chart routes added after June 20:

- `/catalog/roblox-music-ids/charts`
- `/catalog/roblox-music-ids/weekly`
- `/catalog/roblox-music-ids/monthly`
- `/catalog/roblox-music-ids/yearly`
- `/catalog/roblox-music-ids/daily-top-500`

## Old Music IDs Algorithm

The June 20 default ordering prioritized stable, usable music IDs:

```text
duration_bucket ascending
popularity_score descending
duration_seconds descending
rank ascending
last_seen_at descending
```

The newer ordering prioritized popularity and freshness first:

```text
popularity_score descending
last_seen_at descending
duration_bucket ascending
duration_seconds descending
rank ascending
```

If the fallback rollback is needed, restore the old ordering in both:

- `apps/web/src/app/(site)/catalog/roblox-music-ids/page-data.tsx`
- `apps/web/src/app/api/roblox-music-ids/route.ts`

## Fallback Rollback Plan

Use this only if the comment cleanup and stronger moderation do not recover Bing indexing after 7 to 10 days.

1. Restore the June 20 versions of the main music page renderer and browser files.
2. Restore the old default sorting algorithm.
3. Remove or disable the new chart routes.
4. Restore the old lighter refresh flow.
5. Stop the rerank job from updating `catalog_pages.updated_at`.
6. Keep the later structured-data date fix, because the June 20 version had a `datePublished` problem.
7. Review the production `catalog_pages` row for `roblox-music-ids` before changing DB content.
8. Revalidate the page and purge Cloudflare cache after deployment.
9. Verify the live HTML as both a normal browser and Bingbot.

## Important Fixes To Preserve

Do not blindly revert the whole repo to June 20.

Preserve these fixes:

- Correct structured data `datePublished`.
- `noindex, follow` on pagination and thin child pages where appropriate.
- Any production stability fixes unrelated to music page ranking.
- Any fixes that prevent filtered or paginated music pages from throwing runtime errors.

## Verification Checklist If Rollback Happens

Before deploy:

- Run typecheck/build for the web app.
- Confirm the music API default ordering matches the old algorithm.
- Confirm removed chart routes are no longer linked from the page.
- Confirm the main music IDs page still renders with title, meta description, canonical, and JSON-LD.
- Confirm pagination pages remain `noindex, follow`.

After deploy:

- Fetch `https://bloxodes.com/catalog/roblox-music-ids` as a normal browser.
- Fetch the same URL as Bingbot.
- Confirm the page returns `200`.
- Confirm robots is `index, follow`.
- Confirm canonical is `https://bloxodes.com/catalog/roblox-music-ids`.
- Confirm no risky comments are visible in rendered HTML.
- Confirm `/sitemap.xml` and the relevant catalog sitemap include only the intended indexable URL.
- Request Bing recrawl after cache is clean.

## Monitoring Window

Give the comment cleanup and moderation fix 7 to 10 days before applying the rollback. If Bing still keeps the music IDs page out of the index after the next recrawl window, apply the fallback rollback plan above.
