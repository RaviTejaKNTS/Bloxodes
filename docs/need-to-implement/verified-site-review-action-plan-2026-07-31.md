# Verified Site Review Action Plan

Created: 2026-07-31
Source review: `Bloxodes-Full-Review-2026-07-02.md`
Status: Ready for implementation, one issue at a time
Scope: Production defects, resilience, delivery, automation, analytics, and distribution

## Purpose

This tracker converts the July 2 site review into a current, evidence-backed implementation queue. Every material recommendation was rechecked against the repository, production database, live website, Cloudflare, VPS jobs and backups, current Umami traffic, and the Chrome Web Store.

The original review is useful but partially stale. Use this file as the current action list. Work through one numbered issue at a time, verify it independently, and update its status and completion evidence here.

## Status Legend

- `[ ]` Not started
- `[~]` In progress
- `[x]` Completed and verified
- `[!]` Blocked or requires an external decision
- `[—]` Deferred or not currently recommended

## Recommended Execution Order

1. Repair broken legacy media.
2. Establish off-VPS backups and prove restoration.
3. Restore edge caching for high-traffic catalog routes.
4. Add scheduled-job failure alerts and retry handling.
5. Finish codes-source diversification.
6. Protect the Bloxodes origin without affecting other VPS applications.
7. Automate reliable analytics and search reporting.
8. Execute the traffic-diversification strategy.
9. Continue demand-led wiki and collection expansion.
10. Add lower-priority trust and repository improvements.

---

## P0: Fix Immediately

### 1. Repair broken legacy Supabase media

Status: `[x]` Completed and verified on 2026-07-31
Priority: P0 — active production defect
Suggested work unit: One dedicated migration/backfill task

#### Verified evidence

- 45 published codes pages contain legacy managed-Supabase media URLs.
- Those pages contain 97 unique legacy URLs.
- Three published Forge articles contain another 12 unique legacy URLs.
- Total known scope: 48 published pages and 109 unique URLs.
- The old managed-Supabase URLs currently return HTTP `402` because the project is restricted.
- The equivalent tested URL on `media.bloxodes.com` returned HTTP `500`, showing that changing the hostname alone is insufficient because the object is missing from current storage.
- The live `/codes/blox-fruits` page currently exposes three affected redemption images.

#### Required work

- [x] Export a complete inventory of legacy URLs, owning table, column, row ID, slug, and object path.
- [x] Confirm whether every source object can still be recovered from the old project, local backups, source content, or another stored copy.
- [x] Copy recoverable objects into the current `bloxodes-media` storage bucket.
- [x] Verify every new `media.bloxodes.com` URL returns `200` with the expected media type.
- [x] Backfill stored content URLs in a controlled, idempotent script.
- [x] Revalidate all affected codes and article routes.
- [x] Purge and warm affected Cloudflare URLs through the existing publish-trigger/revalidation flow; all 48 live routes served current HTML after the repair.
- [x] Add a production content audit that rejects legacy managed-Supabase media origins.
- [x] Add publication-time validation so new content cannot save the legacy production media hostname.

#### Acceptance criteria

- No published public-content field contains `bmwksaykcsndsvgspapz.supabase.co`.
- All 109 known media references either return `200` from the current media host or are deliberately replaced/removed with documented justification.
- `/codes/blox-fruits` renders all redemption images successfully.
- The three affected Forge articles render every table/content image successfully.
- A repeatable audit fails when a legacy media URL is introduced.

#### Verification evidence to record

- Migration or script path: `scripts/backfill/repair-legacy-supabase-media.ts`; shared detection/guard in `scripts/shared/storage-public-url.ts`.
- Production migration/run ID: operator repair started `2026-07-31T12:33:13.958Z`; pre-write rollback snapshot stored under ignored `tmp/legacy-media-repair/`.
- Rows changed: 48 total — 45 `code_pages` rows and three `articles` rows.
- Objects copied: 96 original WebP files recovered from the VPS Storage volume and re-uploaded through the Supabase Storage API.
- Objects unrecoverable and replacement decision: 13. The missing `fruit-reborn` codes cover was replaced with the official Roblox universe icon and stored at the existing current-media path. Ten missing ore-table image tokens, one standalone pickaxe image, and one Toxic Seed table image were removed while retaining the surrounding table rows and article copy.
- Audit command and result: `NODE_ENV=production npm run audit:legacy-media -- --allow-remote-read` returned zero affected rows, zero non-canonical references, and zero unresolved objects across 2,265 published code pages and 340 published articles. `NODE_ENV=production npm run validate:published-content -- --allow-remote-read` validated 3,160 published rows with zero errors and 38 unrelated warnings.
- Media verification: all 97 recovered/replaced URLs returned `200 image/webp`; the 12 deliberately removed object paths remain absent and are no longer referenced.
- Route verification: all 48 affected live routes returned `200`, and none of their HTML contained `bmwksaykcsndsvgspapz.supabase.co`.
- Sample live URLs checked: `/codes/blox-fruits`, `/codes/fruit-reborn`, `/articles/the-forge-ores-traits-list-what-you-need-to-know-to-forge-better-gear`, `/articles/the-forge-pickaxe-progression-guide-tier-list`, and `/articles/the-forge-runes-explained-all-abilities-and-how-to-use-them-3`.

#### Final VPS cutover and media-host verification

- A second production pass found 1,316 `code_pages` rows and 18 `articles` rows whose Storage URLs used the VPS API hostname `database.bloxodes.com` instead of `media.bloxodes.com`.
- The forward migration `supabase/migrations/20260919000000_canonicalize_vps_media_urls_and_revalidation.sql` verified object presence before changing published rows, canonicalized those URLs, removed 1,256 stale unpublished source-image cache rows with no VPS object, and canonicalized the 599 source-image cache rows whose objects exist.
- Three pre-existing canonical cover paths had no Storage object. Each was filled at the exact expected path with the official Roblox universe icon and verified through `media.bloxodes.com`.
- Database triggers now canonicalize both the retired managed hostname and `database.bloxodes.com` on every insert or update to `code_pages`, `articles`, and `article_source_images`.
- Writer workflows, content importers, article source-image reuse, code-page upserts, the VPS stats-worker environment, and the Dokploy production build environment now explicitly use `https://media.bloxodes.com` for public Storage URLs.
- An exhaustive scan of production text and JSON columns found zero managed-Supabase Storage URLs and zero `database.bloxodes.com` Storage URLs.
- The production sitemap crawl covered 4,052 pages from 13 sitemaps. Every page returned `200` after serial retry of 11 initial timeouts, and every response contained zero forbidden Storage hosts. One stale article response was revalidated and then passed the repeat check.
- Production migration safety backup: `/home/codex-admin/backups/media-host-migration-2026-07-31/bloxodes-pre-media-host-2026-07-31.dump`, SHA-256 `68793304e5aceedc190b8d359b9777776a569b44cef7e4bcf6da4864ce69d594`.
- The local Supabase CLI link to project `bmwksaykcsndsvgspapz` was removed. The managed project itself was not paused, deleted, or otherwise changed; deletion remains a manual owner action.

---

### 2. Implement off-VPS backups and test restoration

Status: `[ ]` Not started
Priority: P0 — business continuity risk
Suggested work unit: Infrastructure task with a separate restore drill

#### Verified evidence

- The VPS contained only three database dumps from June 12, 2026.
- All observed dumps were stored on the same VPS as production.
- No recurring application/database backup timer was found.
- The existing restore log was empty.
- No backup or monitoring container was running.
- The web app, PostgreSQL, Storage, automation, and analytics share the same VPS.
- A Hostinger-level snapshot may exist, but it was not visible from the server and has not been treated as a verified recovery path.

#### Required work

- [ ] Choose an off-site backup destination independent of the production VPS.
- [ ] Add encrypted daily PostgreSQL backups with retention.
- [ ] Replicate or back up Supabase Storage objects off-VPS.
- [ ] Back up Dokploy application configuration and deployment metadata.
- [ ] Document recovery of environment variables and secrets without committing them.
- [ ] Add backup success/failure notifications.
- [ ] Add periodic integrity checks for backup archives.
- [ ] Restore a recent database backup into a temporary isolated database/stack.
- [ ] Restore a sample of storage objects and compare checksums or sizes.
- [ ] Perform and document one complete app-and-database recovery drill.
- [ ] Define recovery point and recovery time targets.

#### Suggested minimum policy

- Daily database dump.
- Daily or incremental storage backup.
- At least 14 daily and 8 weekly recovery points.
- One destination outside the Hostinger VPS/account failure domain where practical.
- Automated failure alerting.
- Monthly restore test initially, then quarterly after the process is stable.

#### Acceptance criteria

- A backup created in the previous 24 hours exists off-VPS.
- Database and storage backup failures trigger an alert.
- A clean temporary environment can be restored using only the documented runbook and stored recovery material.
- The restore drill records start time, completion time, gaps, and corrective actions.
- Backup credentials and encryption keys are recoverable but not stored in the repository.

#### Verification evidence to record

- Backup destination:
- Schedule and retention:
- Latest successful backup:
- Latest successful restore test:
- Restore duration:
- Runbook path:
- Monitoring/alert destination:

---

### 3. Restore edge caching for Music IDs and Decal IDs

Status: `[x]` Completed and verified on 2026-08-01
Priority: P0 — high-traffic delivery and origin-load defect
Suggested work unit: Catalog routing/cache task

#### Verified evidence

Repeated production requests returned:

```text
Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate
cf-cache-status: BYPASS
```

Affected sampled routes:

- `/catalog/roblox-music-ids`
- `/catalog/roblox-music-ids/page/2`
- `/catalog/roblox-decal-ids`
- `/catalog/roblox-decal-ids/page/2`

Current ten-day traffic evidence:

- Main Music IDs page: 29.14% of all pageviews.
- Main Decal IDs page: 10.48% of all pageviews.
- Combined: 39.62% of all pageviews.
- These requests currently reach the shared VPS instead of being served from Cloudflare edge cache.

The likely cause is server-side use of `searchParams` for search/sort variants. Some paginated routes also explicitly use `force-dynamic`, despite the route family declaring `revalidate = 21600`.

#### Required work

- [x] Decide which queryless canonical routes and pagination routes must be cacheable.
- [x] Separate cacheable canonical/pagination rendering from dynamic search and sort behavior.
- [x] Preserve search and sort functionality without making every ordinary request `no-store`.
- [x] Review whether query variants should be client/API-driven, explicitly dynamic, canonicalized, or non-indexed.
- [x] Ensure public comments or other components do not introduce user-specific HTML into edge-cached pages.
- [x] Confirm revalidation events and Cloudflare purges cover the corrected routes.
- [x] Add automated header checks for the top catalog routes.
- [x] Measure origin request reduction after deployment.
- [x] Check that Journey DOM structure and ad insertion remain valid after any route/rendering change.

#### Acceptance criteria

- Queryless Music IDs and Decal IDs routes return a public `s-maxage` policy.
- A warmed second request returns `cf-cache-status: HIT`.
- Ordinary paginated routes are cacheable unless a documented exception applies.
- Search and sort still work correctly.
- Canonicals, metadata, pagination, structured data, and Journey DOM audits pass.
- No authenticated or personalized response is cached publicly.

#### Verification evidence to record

- Routes made cacheable: `/catalog/roblox-music-ids`, its `/page/[page]` family, `/catalog/roblox-decal-ids`, its `/page/[page]` family, Decal curated pages, and Decal category/detail pagination. Static routes render at build time; dynamic path segments use on-demand ISR through `generateStaticParams()`. The effective public policy is `s-maxage=3600, stale-while-revalidate=31532400`, capped by the shared site layout's one-hour revalidation interval.
- Search/sort behavior: URL filters now hydrate behind a React `Suspense` boundary and load filtered rows from the existing JSON APIs. The cached HTML contains the default server-rendered rows, metadata, JSON-LD, canonical, pagination, and public approved comments; it contains no authenticated or personalized response. Query variants retain the query in the interactive controls while canonicalizing to the queryless catalog URL.
- Routes intentionally left dynamic and reason: `/api/roblox-music-ids` and `/api/roblox-decal-ids` remain `force-dynamic` because they serve query-, sort-, section-, category-, and page-specific JSON. Music chart routes remain dynamic for their server-selected `?range=` behavior and were outside this defect's route scope.
- Revalidation: the existing Music and Decal database triggers enqueue their catalog events; `/api/revalidate` already invalidates the base route, route pattern, first 49 concrete pagination paths, Cloudflare cache tags, and deferred cache-warm paths. Query cache keys share the catalog cache tag and are purged with the canonical route family.
- Automated contracts: `apps/web/src/lib/__tests__/catalog-edge-cache-contract.test.ts` rejects request `searchParams`, `force-dynamic`, cookies, or headers in the cacheable route files; requires on-demand ISR for dynamic segments; and verifies the client browsers retain API filtering, `Suspense`, and `data-journey-item`. The existing post-deploy site audit continues to reject `CF-Cache-Status: BYPASS` or `DYNAMIC` on critical catalog HTML.
- Header audit command/result: repeated `curl -L` GETs across the two canonical routes, both `/page/2` routes, `?q=love`, and `?sort=newest` returned `200`, the public `s-maxage` policy above, and `CF-Cache-Status: HIT` after warming. The exact live health SHA was `94394f85175e7533ee670de09866209653ca585e` and the deployment workflow completed successfully.
- Before/after origin request sample: before deployment, 5/5 Music requests and 5/5 Decal requests were `BYPASS` and reached the origin. After deployment and warming, 5/5 requests for each canonical route were `HIT`, so the immediate synthetic sample fell from ten origin-served responses to zero. Longer-term Cloudflare/VPS traffic should still be reviewed separately when a full post-change window is available.
- Before/after median TTFB: Music improved from `1.104s` to `0.411s` (about 63%); Decal improved from `1.349s` to `0.478s` (about 65%) across five sequential requests per route from the same audit location.
- Journey and browser audit: headless Chrome loaded live `?q=love` and `?sort=newest` variants with document/API status `200`, preserved the control values, rendered 24 direct `#article-body > [data-journey-item]` rows on each page, retained queryless canonicals, and emitted zero page errors.
- Local verification: `npm run lint`, `npm run typecheck:web`, `npm run test:unit:web` (35 files, 194 tests), and `npm run build:web` passed. The production build classified the base routes as static and every targeted path-parameter route as SSG/on-demand ISR.
- Production commit/SHA: `94394f85175e7533ee670de09866209653ca585e` (`Restore edge caching for media catalogs`). Deployment run: `30689145816`.

---

### 4. Add scheduled-job retries, failure alerts, and absence monitoring

Status: `[ ]` Not started
Priority: P0/P1 — silent partial-failure risk
Suggested work unit: Automation reliability task

#### Verified evidence

- Active codes were currently fresh at verification time; the newest `last_seen_at` was about two hours old.
- The latest codes-refresh run processed 2,264 pages.
- It failed on 10 pages because production database requests returned transient `502` responses.
- The run still upserted 164 codes and expired 6.
- `update-codes.ts` sets a nonzero exit code when any page fails.
- The VPS `run-job.sh` wrapper uses `set -e`, stops before writing its `finished` line on failure, and does not send an alert.
- No codes freshness watchdog was found.

#### Required work

- [ ] Add bounded retry/backoff for transient Supabase/Cloudflare `5xx` failures.
- [ ] Distinguish transient infrastructure errors from permanent scraper/parser errors.
- [ ] Persist a structured summary for every VPS run.
- [ ] Send Telegram or equivalent alerts for failed and partially failed runs.
- [ ] Alert when a scheduled run does not start or finish within its expected window.
- [ ] Add a codes freshness check based on active-code `max(last_seen_at)`.
- [ ] Include failed slugs and error categories in the alert without dumping large HTML error pages.
- [ ] Provide a targeted retry command for only the failed slugs.
- [ ] Apply the same wrapper-level failure notification to other critical scheduled jobs.

#### Acceptance criteria

- A simulated transient failure is retried and recorded.
- An unrecovered failure sends an alert with job name, time, count, and concise error information.
- Absence of a completed codes refresh beyond the defined threshold sends an alert.
- A partial failure can be rerun for only the failed slugs.
- Successful runs record explicit start and finish state.

#### Verification evidence to record

- Retry policy:
- Freshness threshold:
- Alert destination:
- Simulated failure result:
- Targeted retry result:
- VPS wrapper version/commit:

---

## P1: High-Priority Follow-Up

### 5. Finish codes-source diversification

Status: `[ ]` Not started
Priority: P1 — data freshness and source-concentration risk

#### Verified evidence

Published code-page source coverage at verification time:

| Field | Published pages populated |
| --- | ---: |
| `source_url` | 2,020 |
| `source_url_2` | 769 |
| `source_url_3` | 1,154 |
| `source_url_4` | 2,016 |
| `source_url_5`–`source_url_10` | 0 |

However:

- `scripts/codes/update-codes.ts` reads only `source_url` and `source_url_2`.
- Pro Game Guides and Destructoid scraper implementations exist but are explicitly disabled in `apps/web/src/lib/scraper.ts`.
- The populated third and fourth source fields therefore do not provide refresh resilience.

#### Required work

- [ ] Revalidate the current Destructoid and Pro Game Guides parsers against representative live pages.
- [ ] Add parser fixtures and regression tests for active, expired, empty, malformed, and changed-layout cases.
- [ ] Define source priority and conflict behavior.
- [ ] Read all supported source fields in the refresh job.
- [ ] Avoid expiring a code based on absence from only one source when another source still reports it active.
- [ ] Add per-provider success/failure reporting.
- [ ] Roll out on a bounded sample before enabling globally.
- [ ] Investigate first-party/official-source discovery as a longer-term alternative to aggregator dependence.

#### Acceptance criteria

- Third and fourth source fields are either actively used or deliberately removed with a documented reason.
- Provider layout changes fail safely without expiring valid codes.
- Tests cover provider parsing and multi-source merge rules.
- Production run summaries expose provider health.

---

### 6. Protect the Bloxodes origin at the hostname/router level

Status: `[ ]` Not started
Priority: P1 — Cloudflare/WAF bypass risk

#### Verified evidence

- A direct connection to the VPS IP while presenting the Bloxodes hostname returned the production site successfully.
- This permits bypassing Cloudflare caching, WAF, bot rules, and rate protections.
- A previous broad Cloudflare-only firewall restriction was rolled back because the same VPS hosts other public applications.
- Therefore, a blanket port-level firewall rule is not appropriate without redesigning shared ingress.

#### Required work

- [ ] Choose a Bloxodes-specific origin protection design.
- [ ] Evaluate authenticated origin pulls, a Cloudflare Tunnel, or equivalent Traefik router-level authentication.
- [ ] Preserve public access for unrelated VPS applications.
- [ ] Preserve Supabase, Storage, Umami, Dokploy, Vaultwarden, and other intended hostname behavior.
- [ ] Confirm Cloudflare health checks, cache warming, and revalidation still reach the origin.
- [ ] Document rollback before changing ingress.

#### Acceptance criteria

- Direct requests to the VPS with the Bloxodes hostname cannot retrieve production HTML without the approved Cloudflare/origin credential path.
- Normal Cloudflare traffic continues to return `200`.
- Other VPS applications are unaffected.
- Googlebot, Bingbot, and approved AI crawlers continue to receive expected responses through Cloudflare.

---

### 7. Automate trustworthy analytics and search reporting

Status: `[ ]` Not started
Priority: P1 — decision-quality and early-warning gap

#### Verified evidence

- A useful July 22 Umami analysis exists locally, but its CSV, SQL, and notebook were untracked at verification time.
- No scheduled GSC-to-Telegram or equivalent reporting workflow was found.
- `/puzzles` is missing from `CONTENT_TYPE_BY_PREFIX` in `apps/web/src/lib/umami.ts`.
- The July analytics SQL also classified puzzle routes as `other`.
- Known scraper cohorts created large engagement-event anomalies on July 16 and July 24–27.
- Unfiltered engagement rates are therefore misleading.

#### Required work

- [ ] Add `puzzle` to the canonical analytics content-family classifier and tests.
- [ ] Centralize path-to-content-family classification so application code and SQL reports cannot drift.
- [ ] Keep pageviews, visits, visitors, and engaged events clearly distinguished.
- [ ] Filter or separately report verified bot/scraper cohorts.
- [ ] Create a scheduled weekly GSC report for clicks, impressions, CTR, average position, coverage, and top changes.
- [ ] Create a scheduled weekly Umami report for traffic family, top pages, referrers, engagement, and concentration.
- [ ] Alert on material crawler/search/traffic drops and data-collection anomalies.
- [ ] Commit reviewed SQL/notebooks or replace them with a maintained reporting workflow.

#### Acceptance criteria

- Puzzles no longer appear as `other`.
- Reports use complete and comparable time windows.
- Known scraper anomalies do not inflate human-engagement conclusions.
- Weekly search and traffic summaries are delivered automatically.
- A source link/query and as-of timestamp accompany every reported metric.

---

## P1: Business and Distribution Priorities

### 8. Diversify traffic away from Bing and catalog concentration

Status: `[ ]` Not started
Priority: P1 — highest business-growth priority after P0 reliability work

#### Verified ten-day traffic evidence

Traffic source pageviews:

| Source | Pageviews |
| --- | ---: |
| Bing | 32,403 |
| Google | 205 |
| Social | 100 |

Traffic-family concentration:

| Family | Share of all pageviews |
| --- | ---: |
| Catalog | 71.82% |
| Codes | 12.23% |
| Wiki | 8.03% |
| Stats | 2.35% |
| Articles | 1.23% |
| Tools | 0.79% |

The original review's statement that everything depends on Google is not supported by current traffic. The immediate dependency is Bing plus Music/Decal catalog traffic. Social contributed only 0.07% of pageviews.

#### Required work

- [ ] Define a monthly traffic-concentration scorecard.
- [ ] Use original Bloxodes stats as a data-led distribution product.
- [ ] Publish recurring quotable Roblox platform/game reports.
- [ ] Create journalist-friendly methodology and embeddable/shareable charts.
- [ ] Establish and operate the planned Discord community safely.
- [ ] Test repeatable short-form formats for stats, wiki discoveries, events, and verified codes.
- [ ] Build email/push/watchlist capture around followed games and code alerts.
- [ ] Track every distribution channel separately with campaign parameters and downstream engagement.
- [ ] Avoid measuring success by page count alone.

#### Suggested success measures

- No single page exceeds 35% of human pageviews.
- Catalog dependence declines without losing catalog traffic.
- At least five page families contribute meaningful human traffic.
- Social/community/direct-return traffic grows from the current near-zero baseline.
- Google and other search engines become material rather than leaving Bing as the dominant acquisition source.
- Referring domains and earned citations grow through original data assets.

---

### 9. Turn the browser extension into a real acquisition and retention loop

Status: `[ ]` Not started
Priority: P1 — underused owned-distribution surface

#### Verified evidence

- The public Chrome listing still showed roughly the mid-50s user range and zero ratings during verification.
- The public listing showed version `4.0.0` while repository version `4.1` was pending review.
- The extension is promoted on codes pages, but current adoption remains negligible relative to site traffic.

#### Required work

- [ ] Complete and verify Chrome version 4.1 publication.
- [ ] Complete the first Microsoft Edge publication.
- [ ] Improve store screenshots, feature explanation, and support material based on actual shipped features.
- [ ] Add a policy-compliant rating prompt after a meaningful successful-use milestone.
- [ ] Measure install CTA impressions, store clicks, installs where measurable, active use, and retention.
- [ ] Promote the extension through high-intent site surfaces and community channels.
- [ ] Evaluate stats/wiki shortcuts only when they make the Roblox-page experience more useful rather than cluttered.

#### Acceptance criteria

- Current store versions match approved repository releases.
- Installation and activation funnels are measurable.
- Store ratings and retained-user counts show sustained growth.
- Privacy disclosures remain aligned with shipped behavior.

---

### 10. Continue demand-led wiki and collection expansion

Status: `[~]` Already active; continue selectively
Priority: P1 — best-supported content investment

#### Verified evidence

- Wiki pages generated 8.03% of all pageviews and were the second-largest non-catalog family.
- After excluding known scraper-affected days, wiki engagement was 21.93% versus 3.04% for codes.
- Articles and tools currently have substantially less traffic.

#### Required work

- [ ] Continue using current wiki-candidate discovery and source-backed research workflows.
- [ ] Prioritize rising games where Bloxodes can publish useful structured coverage early.
- [ ] Route codes visitors into relevant wiki collections and game hubs.
- [ ] Track wiki performance by game, collection, source query, and internal entry path.
- [ ] Expand only where the item list, fields, images, and player job justify indexing.
- [ ] Avoid broad tool/article production without clear demand or differentiation.

#### Acceptance criteria

- New collections meet existing source, data, image, metadata, sitemap, and route checks.
- Wiki traffic and returning engagement grow without thin-page expansion.
- Codes-to-wiki internal navigation is measured and improves over time.

---

## P2: Useful but Not Urgent

### 11. Add clear ownership/bylines to codes pages

Status: `[ ]` Not started
Priority: P2 — trust improvement, not an emergency ranking fix

#### Verified evidence

- Codes-page metadata currently sets `authors: null`.
- The `code_pages` model does not currently expose an editorial author/reviewer relationship.
- Bloxodes currently has four public author entities.

#### Required work

- [ ] Decide whether codes pages have an author, reviewer, editorial team, or responsible maintainer.
- [ ] Avoid fake or purely decorative reviewed-by markup.
- [ ] Add schema and visible attribution only when it reflects a real workflow.
- [ ] Improve author biographies and external identity evidence where genuinely available.

#### Acceptance criteria

- Attribution matches actual editorial responsibility.
- Visible attribution, metadata, and structured data agree.
- No unsupported E-E-A-T claims are introduced.

---

### 12. Update stale infrastructure documentation

Status: `[ ]` Not started
Priority: P2 — operational clarity

#### Verified evidence

- Cloudflare's live API reported SSL mode `strict`.
- The origin presented a valid Let's Encrypt certificate for `bloxodes.com`.
- `docs/production-readiness-tracker.md` still describes Full (strict) as pending.
- The tracker also needs to distinguish the failed broad firewall approach from the desired hostname-specific origin protection.

#### Required work

- [ ] Mark Full (strict) complete with verification date.
- [ ] Update certificate and renewal notes.
- [ ] Document the current direct-origin exposure accurately.
- [ ] Replace broad origin-firewall wording with the selected safe design after Issue 6 is completed.
- [ ] Keep backup and monitoring status aligned with actual deployed state.

---

### 13. Perform a low-priority repository hygiene sweep

Status: `[—]` Deferred until production risks are addressed
Priority: P2/P3

#### Current observations

- `one-off-scripts/` still exists.
- Root-level writing-plan and missing-image notes remain.
- Ignored/local `tmp/` content is sizable.
- `.claude/` contains legacy/copied material and local worktree data.
- These are not current production blockers.

#### Required work when scheduled

- [ ] Separate maintained scripts from true one-off artifacts.
- [ ] Archive or remove completed root planning files.
- [ ] Remove disposable ignored files without deleting user-owned active work.
- [ ] Confirm no active worktree or skill depends on material before removal.
- [ ] Keep cleanup separate from functional changes.

---

## Findings Already Resolved or Not Recommended

### Full (strict) TLS

Status: `[x]` Verified complete

- Cloudflare's live zone setting returned `strict`.
- The origin presented a valid certificate.
- Only documentation needs updating.

### Journey ad integration

Status: `[x]` Integration verified; revenue remains a dashboard question

- `ads.txt` is live and populated.
- The Journey script is present in served HTML.
- Production Journey DOM audits are documented and passed.
- Actual paid revenue and fill should still be checked in the Journey dashboard, but there is no current evidence of a missing script integration.

### Lint and regression test layer

Status: `[x]` Materially improved since the review

Verification on 2026-07-31:

- ESLint passed.
- 33 Vitest files passed.
- 171 tests passed.
- Page-contract tests passed: 3 files and 13 tests.
- Playwright public-page coverage and pre/post-deploy quality gates exist.

Continue expanding tests when a regression demonstrates a gap, but this is not a current P0 issue.

### Codes refresh is globally stale

Status: `[x]` Not currently true

- The latest active-code timestamp was fresh at verification time.
- The real remaining problem is silent partial failure, handled by Issue 4.

### Move or delete puzzles immediately

Status: `[—]` Not currently recommended

- Puzzles generated only 0.38% of current pageviews.
- No verified GSC evidence shows that puzzles are harming Roblox topical performance.
- Fix their analytics classification first, then evaluate using search and traffic data.

### Broad expansion of tools/calculators

Status: `[—]` Demand-led only

- Tools currently generated 0.79% of pageviews and low measured engagement in the normal-day sensitivity check.
- Build a new tool only when there is clear search/player demand, repeat-use value, or strong differentiation.

### Bulk publication of all draft codes pages

Status: `[—]` Not recommended

- Continue demand-led publication based on game activity, source quality, and useful copy readiness.
- Do not publish the remaining draft inventory merely to increase URL count.

---

## Verification Baseline

Use this section as the comparison point for future work.

### Live content and delivery

- Homepage: `200`, Cloudflare cacheable/HIT when sampled.
- Blox Fruits codes: `200`, cacheable, but contains broken legacy images.
- Music IDs: `200`, `private/no-store`, Cloudflare `BYPASS`.
- Decal IDs: `200`, `private/no-store`, Cloudflare `BYPASS`.
- `robots.txt`: `200`, expected allow/disallow rules and sitemap declaration.
- `sitemap.xml`: `200`, 12 family sitemaps.
- `ads.txt`: `200`, Journey entries present.

### Current ten-complete-day Umami baseline

Window: 2026-07-21 through 2026-07-30 Asia/Kolkata calendar days.

| Content family | Pageviews | Share |
| --- | ---: | ---: |
| Catalog | 99,514 | 71.82% |
| Codes | 16,946 | 12.23% |
| Wiki | 11,123 | 8.03% |
| Stats | 3,260 | 2.35% |
| Home | 3,076 | 2.22% |
| Articles | 1,704 | 1.23% |
| Tools | 1,093 | 0.79% |
| Checklists | 548 | 0.40% |
| Puzzles | 522 | 0.38% |
| Events | 489 | 0.35% |
| Quizzes | 219 | 0.16% |
| Other | 65 | 0.05% |

Known caveat: July 24–27 contained scraper-affected engagement anomalies. Pageview and referrer totals are still useful for concentration analysis, but unfiltered engagement-event rates should not be treated as human engagement.

### Current referrer baseline

| Referrer group | Pageviews | Share |
| --- | ---: | ---: |
| Internal | 49,712 | 35.88% |
| Search | 46,025 | 33.22% |
| Direct/unknown | 41,996 | 30.31% |
| AI assistants | 387 | 0.28% |
| Other external | 339 | 0.24% |
| Social | 100 | 0.07% |

### Current quality baseline

- `npm run lint`: passed.
- `npm run test:web`: 33 files and 171 tests passed.
- `npm run test:page-contracts`: 3 files and 13 tests passed.
- Working tree had four pre-existing untracked analytics/bot-remediation files before this tracker was added.

---

## Per-Issue Completion Template

Copy this block under an issue when work begins:

```md
#### Implementation record

- Owner/task:
- Branch:
- Started:
- Completed:
- Files changed:
- Database/infrastructure changes:
- Verification commands:
- Production verification:
- Rollback plan:
- Follow-up work:
```

## Operating Rule

Do not mark an issue complete because code was written or deployed. Mark it complete only after its acceptance criteria pass against production or the appropriate isolated recovery environment, and record the evidence in this file.
