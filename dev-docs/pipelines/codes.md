# Codes Pipeline

Status: Active
Last verified: 2026-10-02
Evidence: code/schema rules, installed VPS cron, production read-only counts, and route/revalidation contracts

## Ownership

- Page records: `code_pages` (4,024 rows at verification).
- Code records: `codes` (58,633 rows at verification).
- Public routes: `/codes` and `/codes/<game-slug>`.
- Refresh implementation: `scripts/codes/update-codes.ts`, stable alias `npm run refresh:codes`.

## Codes landing page

Local implementation checked 2026-09-05; production publication is separate. `/codes` combines its existing 20-game card directory with a short introduction, section navigation, and server-rendered guidance about redemption, failed codes, platform promo codes, and source-based updates. Copy and index metadata live in `apps/web/src/app/(site)/codes/index-content.tsx`; layout and list structured data live in `page-data.tsx`. This editorial copy ships with the web application and does not write code rows.

The full guide appears only on `/codes`. Continuation pages use their own canonical and social URLs, inherit the environment's indexing policy, and link back to the landing page. `/codes/page/1` redirects permanently to `/codes`; invalid and out-of-range page numbers return not-found. The main sitemap already includes `/codes`, the codes sitemap retains detail URLs, and RSS remains a feed of content updates rather than index copy. Existing codes index revalidation covers the directory.

## Source Contract

- `code_pages.slug` is the editorial game slug; never append `-codes` and never copy the stats universe slug.
- `roblox_link` stores the Roblox experience URL.
- `source_url` stores RobloxDen.
- `source_url_2` stores Beebom.
- Other source fields are legacy/additional sources and must not displace the two refresh-owner fields.

## Flow

1. Research/setup inserts or updates durable page fields and source URLs.
2. The refresh worker fetches source pages and owns active/expired code rows.
3. Page copy remains evergreen and avoids current code names/counts/dates.
4. Database changes enqueue revalidation for codes indexes/details and downstream clients.
5. Website, extension, and mobile share code freshness/progress logic from web library helpers.

## Schedule

The VPS worker runs `refresh:codes` every six hours at minute 0 with configured concurrency and batch delay. GitHub schedules should remain disabled where the VPS manifest owns the recurring job.

## Pasted Copy labels

Added 2026-10-14. Beebom and RobloxDen sometimes publish codes with a pasted copy-button label, such as `PROUDFROGCopy` on Adopt Me or `!code hakotrapCopy` on Fairy Tail Lost Souls. The label appears in their visible text and in their copy-button attributes, so parsers alone cannot avoid it.

`apps/web/src/lib/code-normalization.ts` owns `stripPastedCopySuffix`. It strips trailing `Copy` or `Copied` when glued to a preceding non-space character with that exact capitalization, or when separated by whitespace with any casing. It repeats the rule for multiple pasted labels and preserves a label when removing it would leave nothing. Standalone `Copy`, `copy` and `COPY`, lowercase glued endings such as `xcopy`, and `NEW` endings stay intact. Reward text keeps the broader `stripTrailingCopyButtonText` rule, applied after `(new)` markers are removed and repeated for stacked labels.

The code rule does not require a clean twin from the other source, because a single source can carry the only copy of a pasted code. A legitimate code ending in a glued capital `Copy`, such as a hypothetical `CarbonCopy`, would lose that ending. On 2026-10-14 the rule changed no production code without a clean twin on the same page, so the trade-off is accepted. Revisit it if such a code appears.

`mergeScrapeResults` cleans active and scraped expired code text before computing normalized keys. Display, reward and active/expired provider precedence stays the same. Beebom also calls the shared cleaner before its parser removes spaces, so a separate lowercase `copy` suffix cannot become a glued lowercase ending. This covers copy-control attributes as well as visible code text.

The refresh cleans stored `code_pages.expired_codes` before adding them to its normalized map and cleans every subsequent insertion into that map. It compares the resulting array with the original stored array, so renames and duplicate removals trigger a page update on the next successful refresh.

`npm run refresh:codes -- --cleanup-copy-text` plans a one-time repair across all code rows and all page expired lists, including unpublished pages and pages without code rows. It prints each affected slug with code rename/merge counts, reward cleanup counts and expired-list removal/rename counts. Expired-list deduplication keeps the first cleaned spelling and position. Reward counts include contaminated rewards addressed by a group merge, even when the row is deleted. Code merges preserve the clean twin's ID and spelling when one exists, merge metadata, save the survivor first and then delete duplicate rows. Without a twin, the survivor is renamed. The planner lives in `scripts/codes/copy-text-cleanup.ts` and has no database side effects.

Dry-run is the default. `--apply` writes; production additionally requires `NODE_ENV=production` and `--allow-prod`. Before deleting a group's duplicates, the survivor update must match its original code text and return exactly one row. The script reads back code rows and page arrays, requires an empty cleanup plan across codes, rewards and expired lists, and compares saved code/reward text, deletions and cleaned arrays with the plan. Run it while the scheduled refresh is idle, because planning and application are separate requests rather than one transaction.

Both `codes` updates/deletes and published `code_pages` updates already enqueue `code` revalidation through the triggers defined in `20260918000003_retire_lists_page_type.sql`. The verified apply also uses `scripts/shared/revalidation-events.ts` to coalesce a `code` event for every affected slug. The queue worker calls `/api/revalidate`, which purges the codes detail/index tags and schedules deferred warming. No synchronous warming or direct HTTP secret is needed. See [revalidation and cache](../operations/revalidation-cache.md).

## Safety

- Never manually seed active/expired codes or code dates.
- Do not run a production refresh using the managed-development target.
- New page publication must preserve metadata, sitemap/search/feed/revalidation behavior.

## October 2 reliability repairs

The refresh retries individual existing-code reads, touches and idempotent upserts after transient Data API failures. Exact stored code text is used for touches, so `_` and `%` cannot act as wildcard matches. Reactivation timestamps belong to the database upsert rather than a second unguarded update.

The applied `20261002105551` migration targets the existing case-insensitive unique index atomically and applies provider precedence inside the conflict update. Lower-priority observations only refresh last-seen time. Equal priority preserves existing redemption text; higher priority may replace it. Managed-development fixtures, the approved production application and ledger verification passed.

A failed provider no longer prevents trying another configured source in scheduled refresh. An incomplete scrape preserves missing active codes and reports a degraded refresh. If all sources return 404/410, the page is skipped with an explicit unavailable-source reason and existing observations remain unchanged. Other HTTP/network failures still fail the refresh. Strict admin imports retain their existing all-sources contract.

The October 2 checks confirmed that Mining Simulator 2 and the original PLS Donate But Infinite Robux RobloxDen URLs return 404. RobloxDen's public search has no source matching their original place IDs. Similarly named replacements point to different experiences, so no replacement URL or code was entered manually.

The case-insensitive upsert migration is verified in managed development at version `20261002105551`. Lower-priority observations preserve stronger data, equal-priority case variants preserve the stored code spelling, and higher-priority reactivation updates exactly one row and its timestamp. The owner-approved production schema application and ledger readback passed at SHA `339b177b3c2766a2c324da4d75d28dec74c0abd2`. The scraper/runtime fixes are deployed in the web and worker at `34b925cca7788e7db83e58d640031e89ffe01cec`.

Targeted production refresh of all 27 previously failing pages completed with 25 successes, two retired-source skips and zero failures. It preserved observations for the two unavailable sources.
