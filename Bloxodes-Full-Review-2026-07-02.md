# Bloxodes — Full Site, System & Business Review

**Date:** July 2, 2026
**Scope:** Read-only review. Nothing was changed, fixed, or deployed. All production database queries were count/read-only.
**What was inspected:** the full repo (web app, extension, mobile, scripts, migrations, docs, skills), the production Supabase database (row counts, freshness, job runs), the live site (bloxodes.com pages, headers, sitemaps, robots, structured data), the Chrome Web Store listing, and the competitive landscape via web search.

---

## 1. Executive Summary

Bloxodes is a Roblox companion-content platform: codes, game wikis/collections, live stats, catalogs (music IDs, decal IDs, items), tools, articles, quizzes, checklists, events, and daily puzzle answers. It runs on a self-hosted Next.js 16 + Supabase stack on a single Hostinger VPS behind Cloudflare, with an unusually deep automation pipeline and an agent-driven content workflow.

**The honest one-paragraph verdict:** This is a top-percentile *build* for a small team — the engineering, automation, documentation, and content-quality controls are genuinely better than most funded content startups. The bottleneck is not the product; it is **distribution and authority**. The site is invisible on the head terms that pay (e.g. "blox fruits codes"), user engagement signals are near zero (44 accounts, 51 comments, 58 extension users), and monetization appears configured but not yet observably serving. The future depends on winning specific defensible wedges (wiki collections for rising games, stats, tools, the extension loop) rather than fighting Dexerto/PCGamesN head-on for codes traffic.

### Overall Scorecard

| Area | Rating | One-line summary |
|---|---|---|
| Niche & topic selection | 7/10 | Big market, smart verticals, but the flagship vertical (codes) is the most contested and least defensible |
| Tech stack | 9/10 | Modern, appropriate, server-first, no over-engineering |
| Codebase structure & maintenance | 8.5/10 | Excellent organization and docs; thin automated tests, some hygiene debt |
| Documentation & agent workflow | 10/10 | Best-in-class; path-scoped AGENTS.md + 30+ skills is a real moat for content velocity |
| Database design & data pipeline | 8.5/10 | Read-model indexes, forward-only migrations, tiered refresh — one serious media-URL migration risk |
| Automation pipeline | 9/10 | Verified live and healthy; one apparent codes-refresh gap to check |
| Content quality & writing style | 8.5/10 | Reads human, evergreen-copy policy, verification timestamps; volume/velocity recently dipped |
| SEO (technical) | 9/10 | Sitemaps, canonicals, JSON-LD, IndexNow/Indexing API, dynamic accurate titles |
| SEO (authority & rankings) | 3/10 | Not visible on head terms; young domain; few backlinks; this is the existential gap |
| Hosting & infrastructure | 7/10 | Cheap, fast, well-cached — but single-VPS SPOF, SSL "Full (strict)" pending, backups unverified |
| Performance / speed | 8/10 | CF cache HITs, ~0.6–1.3s full response, brotli/HTTP3; HTML pages are large but under gates |
| User signals & community | 2/10 | Essentially no registered users, comments, or extension installs yet |
| Monetization | 3/10 | ads.txt (Journey) configured; no ad scripts observed in served HTML; verify it's actually earning |
| Distribution & brand | 2/10 | No meaningful social/community/backlink engine visible |
| **Overall (weighted toward viability)** | **6.5/10** | Excellent machine, weak megaphone |

---

## 2. The Niche & Market Position

### 2.1 The market

Roblox companion content is one of the largest sustained gaming-content niches on the web: hundreds of millions of MAU, an audience that constantly searches for codes, values, guides, IDs, and stats. Demand is durable and self-renewing (new games spike weekly — the repo's own `discover-wiki-candidates` job exploits exactly this).

### 2.2 Vertical-by-vertical competitive reality

| Vertical | Bloxodes footprint | Main competitors | Assessment |
|---|---|---|---|
| **Codes** | 1,773 published pages, 18,288 active codes, 6-hourly refresh | Dexerto, PCGamesN, Pocket Tactics, PC Gamer, Sportskeeda, TheClick.gg, RoCodes.gg, RobloxDen, Beebom, BlueStacks | Most crowded vertical on the internet. A July 2026 search for "blox fruits codes july 2026" returned 9+ competitors and **no Bloxodes**. Big-media DA dominates. Long-tail codes pages (small games) are the realistic win here, and the 3,925-row pipeline (≈2,150 unpublished drafts) is built for exactly that. |
| **Game wikis / collections** | 42 hubs + 302 collection pages, source-backed local datasets with images | Fandom (dominant, but ad-bloated and hated), wiki.gg, game-specific community wikis | **This is the best wedge.** The live sample (`/wiki/blox-fruits/locations`, 92 items with 7–8 structured fields) matches or exceeds the Fandom equivalent in structure and UX. Fandom's terrible UX is a well-known opening — several games' communities have migrated away from it. |
| **Stats** | 97,732 tracked universes (5,014 HOT hourly), platform aggregates, item stats (57,290 items), creator leaderboards | RoMonitor Stats, Rotrends, RTrack, Rolimon's | Strong product parity already (charts, ranks, update markers verified live). RoMonitor earns citations/backlinks from journalists — that's the playbook to copy. Stats is also the natural link-earning engine for the whole domain. |
| **Music IDs** | 58,865 IDs, daily verified refresh | RobloxSong (1M+ claimed), RobloxDen (2M+), MusicCoder | Bloxodes already appeared in a top-10 web result for a music-codes query — the "verified working only" angle (screening private/removed uploads) is the right differentiation vs. bloated databases. |
| **Decal IDs** | 37,700, daily verify/rerank pipeline | Scattered listicles, RobloxDen | Verification pipeline is a genuine edge; most competitor lists are full of dead IDs. |
| **Tools/calculators** | 10 live tools | Scattered, low-quality | Underinvested relative to opportunity. Calculators earn recurring, defensible traffic and links. |
| **Quizzes / checklists / events** | 13 / 14 / 22 | Almost nobody does these well | Low-competition engagement surfaces; good for session depth, weak as acquisition. |
| **Puzzles (NYT answers etc.)** | 14 pages, 336 answer rows, synced daily | Mashable, TryHardGuides, WordTips — massive DA | **Topically off-niche.** Wordle/Connections answers on a Roblox site dilutes topical authority and competes against the strongest answer-page publishers on earth. Traffic upside is real but it fights the site's topical identity. |

### 2.3 Structural risks in the niche

1. **Source dependency for codes.** The refresh pipeline scrapes RobloxDen (`source_url`) and Beebom (`source_url_2`). Schema now has `source_url_3`–`source_url_10` and docs show Destructoid/Pro Game Guides candidate work — good resilience direction, but the vertical is still fundamentally derivative of other sites' collection work. If a major source blocks scraping or dies, freshness degrades instantly.
2. **Google policy risk.** Programmatic/aggregated content sites in gaming have been repeatedly hit by helpful-content/spam updates. Bloxodes' mitigations (verification timestamps, human-sounding copy, evergreen-prose policy, editorial pages, real structured data) are exactly right — but a young domain with thousands of templated pages and few links carries classification risk.
3. **Roblox API dependency.** Stats, items, music, decals all depend on public Roblox endpoints and their rate limits (already visible: item stats moved off GitHub runners because of IP rate-limiting). A Roblox API policy change is a tail risk to the whole stats vertical.

**Niche rating: 7/10** — right market, mostly right sub-niches, one off-niche vertical, one over-contested flagship.

---

## 3. Content Inventory & Quality

### 3.1 Production inventory (queried live, July 2, 2026)

| Content type | Published / Total | Notes |
|---|---|---|
| Codes pages | 1,773 published / 3,925 rows | ≈2,150 unpublished drafts = large ready pipeline |
| Individual codes | 18,288 active / 42,300 tracked | Auto-expired via scraper diffs |
| Articles | 268 published / 294 | Latest published June 27 — 5-day gap at review time |
| Wiki hubs | 42 | All published |
| Wiki collection pages | 302 | All published; local datasets + images per game |
| Catalog pages | 41 | Music IDs, decal IDs, free items, admin commands, item families |
| Tools | 10 | Calculators, extractor, planners |
| Events pages | 22 | + 4,389 tracked virtual events |
| Quizzes / Checklists | 13 / 14 | Local question pools with difficulty tiers |
| Puzzle pages / answers | 14 / 336 | Current-day fresh (July 2 answer present) |
| Tracked universes | 97,732 (HOT 5,014, WARM 9,364, COLD 81,898, NEW 1,456) | Tiered refresh |
| Marketplace items | 57,290 | With hourly/daily/resale history |
| Music IDs / Decal IDs | 58,865 / 37,700 | Verified pipelines |
| Authors | 4 | |

Total indexable URLs in sitemaps: ≈3,753 (codes 1,773; stats 1,220; wiki 344; articles 291; catalog 41; plus small families). Note that the stats sitemap deliberately exposes only a curated slice of the ~98K universes — correct restraint, avoids programmatic-spam appearance.

### 3.2 Writing quality (live samples reviewed)

- **Codes page (Blox Fruits):** clear structure (active → redeem steps with screenshots → expired collapsible → troubleshooting/FAQ → related → comments), copy buttons, "Checked and verified on July 1, 2026 (Yesterday)" trust line, "How We Verify Codes" policy link, developer attribution. Copy reads natural, not templated-AI. Gap: **no author byline** on codes pages.
- **Article (The Forge crafting guide):** specific numbers ("Darkryte (6.3×)"), comparison tables, honest hedging ("values are approximate and can vary with game updates"), author attribution + update date, conversational but not sloppy. Reads human.
- **Wiki hub (Grow a Garden):** 14 collections, live CCU, active codes, events, tools, articles all cross-wired on one hub — this is the "game hub" pattern competitors don't have in one place.
- **Collection page (Blox Fruits locations):** 92 items, 7–8 structured fields per item, sectioned by sea, pagination, intro + FAQ. Matches/exceeds Fandom equivalent.

### 3.3 What makes the content system unusually good

- **Evergreen-copy policy** (no "latest/updated daily", no month/year in prose, no active code names in prose) — pages don't rot; freshness is carried by data, titles are computed at render time ("Blox Fruits Codes (July 2026) - 26 Active Codes"). This is the correct architecture and most competitors get it wrong.
- **`check-public-copy.ts`** blocks self-referential copy, weak field-command copy, and AI-tell phrases ("not just…") before import. An automated AI-slop linter for editorial content is rare and valuable.
- **Skill-based research → brief → write → verify → seed pipeline** with parent review, local-first verification (route 200 checks, copy checks, dataset audits, image audits) before production. This is a real content factory with QA gates.
- **Source-backed dataset rule** ("do not write around missing source-backed facts", documented image gaps like the Gingerbread Suit note) — an accuracy culture most gaming sites lack.

### 3.4 Content weaknesses

- **Velocity dip:** last article June 27; article generation queue has just 1 pending item. For a site fighting for authority, sustained publishing cadence matters.
- **No bylines on codes pages** (the biggest page family) weakens E-E-A-T on exactly the pages Google scrutinizes most.
- **4 authors** total; author entity depth (bios, social proof, external presence) not verified but likely thin.
- **~2,150 unpublished codes drafts:** publishing them all at once would look like a programmatic dump; they need a drip strategy tied to demand signals.

**Content quality rating: 8.5/10. Content strategy rating: 7/10.**

---

## 4. SEO

### 4.1 Technical SEO — verified live

- `robots.txt`: clean (allow all, disallow /api/ and /admin, sitemap declared).
- Sitemap index → 12 family sitemaps, all resolving, counts consistent with DB published counts (codes sitemap = exactly 1,773 = published rows — the pipeline keeps these in lockstep, verified).
- Canonicals correct on sampled pages, including self-canonicalized sort variants (`/stats/games?sort=growth_24h`) — deliberate multi-index strategy; acceptable, though query-param sitemap URLs are unusual and Google may fold them.
- **Structured data on one codes page:** WebSite, Organization, WebPage, CollectionPage, BreadcrumbList, VideoGame, ItemList (26 Things), FAQPage (3 Q/A), HowTo (5 steps), ImageObject. This is a genuinely rich, correct implementation.
- Dynamic, accurate titles with live counts; meta descriptions present and specific.
- `feed.xml`, per-family feeds, IndexNow bootstrap, **Google Indexing API job every 6h with Supabase-persisted quota state**, sitemap SEO auditor (`audit:seo`), HTML size auditor with a 1.8MB gate. This tooling stack is above almost any competitor's.
- Cache headers: `s-maxage=3600, stale-while-revalidate=1y` (600s for stats) + tag-based purge + queued cache warming — freshness and cacheability are correctly decoupled.
- E-E-A-T surfaces exist: `/editorial-guidelines`, `/how-we-gather-and-verify-codes`, `/authors`, verification timestamps on pages.

### 4.2 SEO reality check — authority

- "blox fruits codes july 2026" (the money query for the biggest codes page): **Bloxodes absent** from returned results; SkyCoach, PCGamesN, Pocket Tactics, Dexerto, PC Gamer, TheClick, RoCodes, BlueStacks, Sportskeeda present.
- Music-codes query: Bloxodes appeared (~10th) — long-tail/verified-database angle is getting traction.
- Brand query "bloxodes": clean SERP — homepage, Chrome extension, X account, and **wiki pages** (RIVALS Wiki, Blox Fruits Locations/Races, UBG Wiki) ranking. The fact that Google surfaces the *wiki* pages for the brand suggests the wiki family is where Google sees the site's distinctive value. Follow that signal.
- Backlink profile not directly measurable from here, but a domain launched ~Sept 2025 with no visible PR/link engine is certainly link-poor. Nothing in the repo (no digital-PR assets, no linkable-data pages promoted) suggests otherwise.

### 4.3 SEO risks & gaps

1. **Cloudflare bot challenge returned 403 to plain curl.** Googlebot is clearly getting through (site is indexed), but any managed-challenge misconfiguration is a silent SEO killer — worth a periodic GSC crawl-stats check. (The site's own `audit:seo` crawler presumably runs with a UA that passes; keep an eye on it.)
2. Query-parameter URLs in the stats sitemap (minor).
3. Puzzle pages dilute topical focus (see §2.2).
4. No hreflang / international story despite discovery crawling 12 countries — fine for now, just noting the asymmetry.
5. GSC/GA data was not available to this review; all ranking observations are single-query snapshots, not a rank-tracking study. **Recommendation: wire a weekly GSC export into the repo's reporting (Telegram) so ranking truth is ambient.**

**Technical SEO: 9/10. Authority/off-page: 3/10.**

---

## 5. Tech Stack & Architecture

### 5.1 Stack

- **Web:** Next.js 16 (App Router, standalone output), React 18, Tailwind 3 + shadcn-style primitives (Radix), recharts/d3 for stats, server-first pages with `page-data.tsx` sidecars, TypeScript 5.5.
- **Data:** Self-hosted Supabase (Postgres + PostgREST + Storage + Edge Functions) at database.bloxodes.com; Studio at studio.bloxodes.com; media at media.bloxodes.com.
- **Infra:** Docker (multi-stage, node:24-slim, build-SHA stamping), Dokploy deploys from `production` branch, Cloudflare CDN (brotli, HTTP/3, tiered cache, cache rules), VPS cron worker for jobs, Supabase Edge Functions (`revalidate`, `cache-warm`, `roblox-codes`) draining event queues every minute.
- **Apps:** Chrome MV3 extension (API-only, minimal permissions, scoped DOM), Expo React Native mobile V1 (codes browse via `/api/mobile/*`).
- **AI/tooling:** OpenAI for generation jobs, Tavily/Firecrawl for research, Playwright for scraping, vitest for tests.

Judgment: the stack is boring in the best way. No unnecessary microservices, no premature Kubernetes, server-rendering where it matters, CDN doing the heavy lifting. The monorepo boundaries (web is the only deploy; extension/mobile call public APIs only) are clean and enforced in docs.

### 5.2 Codebase maintenance

- **Size:** ~83K LOC web src + ~51K LOC scripts; 94 modules in `lib/`; 160 migrations.
- **Activity:** 736 commits since Sept 2025; June 2026 alone had 170 commits — the project is very alive.
- **Conventions actually hold:** spot-checks confirm the documented patterns (page-data sidecars, typed db helpers, read-model tables, slug-ownership rules) match the code. Docs are not aspirational — they describe reality. That's rare.
- **Tests: thin.** 11 test files, all in `lib` (security, cache tags, code utils, forge calculator). No route/integration tests; `lint` is intentionally a no-op. The compensating control is the verification-script layer (verify:*-finals, audits), which is real but only covers content flows, not app regressions.
- **Hygiene debt (small):** `one-off-scripts/` still holds 5 scripts (contradicts the stated clean-up rule), `tmp/` carries 15MB inside the repo, a stray `redeem-md-missing-images.md` and a `Writing plans/` folder (space in name) sit at root, two AGENTS.md files are modified-uncommitted, and a leftover `.claude/worktrees/` copy shadows test files.
- **Security posture (read-through):** CSP directives config + tests, request-origin validation helpers + tests, comment moderation, rate limiting noted as explicit checklist item for mutations, no Supabase keys in extension, middleware proxy on all routes. Roblox OAuth for auth (no passwords to protect). Solid for the threat model.

**Codebase rating: 8.5/10** (would be 9.5 with a real test suite and the hygiene sweep).

### 5.3 Documentation & agent workflow — the hidden asset

Path-scoped AGENTS.md at every level, a discovery index in `agents/`, DESIGN.md with full token spec, 30+ purpose-built skills covering research → data → images → writing → verification → publish for every page type, with guardrails encoded (dry-run defaults, `--allow-prod` gates, copy linting, image-gap documentation). This effectively turns content production into a supervised pipeline where AI agents do the labor and quality is enforced by scripts, not vibes. **This is the company's real moat right now** — the marginal cost of a new high-quality game wiki is dramatically lower than any competitor's.

**Docs/workflow rating: 10/10.**

---

## 6. Database & Data Pipeline

### 6.1 Design

- Clear separation: write tables → `*_view` read projections → dedicated current-index tables (`stats_game_current_index` etc.) rebuilt by jobs for hot public queries. Correct pattern for read-heavy public traffic on a shared VPS.
- Forward-only migrations (160), sensible naming, recent ones show active evolution (item stats pipeline, platform aggregates, visit-share chart).
- Slug ownership rules (stats slugs vs editorial slugs) are documented and enforced in scripts — a subtle data-integrity discipline most teams lack.
- Tiered refresh (NEW/HOT/WARM/COLD for universes; NEW/HOT/WARM/COLD/TRADE/BROKEN_MEDIA for items) with lease-aware workers, pruning (90-day hourly retention), daily rollups, rank snapshots hourly (rank-relevant only) vs daily (complete) — thoughtful volume management.

### 6.2 Verified live health (July 2, 2026)

- Hourly stats: current hour present (09:00 UTC at 09:50 UTC check). ✅
- Daily rollup: June 30 latest (July 1 rollup runs at 00:35, presumably server-local; borderline — worth an eyeball). ⚠️
- Job runs table: continuous success/partial entries every ~15 min across item/universe/rank/index jobs. ✅
- Puzzle answers: July 2 present. ✅
- **Codes freshness gap:** newest `last_seen_at` on active codes = July 1, 21:05 UTC, i.e. ~12.8h before check time, against a 6-hourly cron. Either the server-local schedule offset explains one gap, or the last 1–2 `codes-refresh` runs failed. **Check the VPS cron log for `codes-refresh` — this is the finding most worth acting on today.** ⚠️
- Article generation queue: 1 pending, nothing stuck. ✅

### 6.3 The one serious data risk: legacy media URLs

The live Blox Fruits codes page preloads images from **`bmwksaykcsndsvgspapz.supabase.co`** — the *old managed Supabase project* — three times on that page alone. CLAUDE.md itself says the managed project is "rollback/source-of-truth fallback only **until deletion**." Content markdown (`intro_md`, `redeem_md`, etc.) evidently stores absolute URLs to the old storage domain, and the `toMediaPublicUrl` helper only rewrites URLs at points where it's invoked (and only when `SUPABASE_MEDIA_PUBLIC_URL` is set). **When the managed project is deleted, an unknown number of embedded content images break site-wide.** Before any deletion: inventory all `supabase.co` URL occurrences across content columns, migrate objects to media.bloxodes.com, and backfill the stored URLs. This is the highest-severity latent defect found in this review.

### 6.4 Resilience

- Web + Postgres + Storage + cron all share one Hostinger VPS. CPU/RAM/disk contention is documented as a known trade-off, but **disaster recovery is the open question**: no off-site backup evidence was visible in the repo/docs reviewed. If the VPS dies, the business dies with it unless Supabase PITR/off-site dumps exist. Verify and document a tested restore path.
- Nice touch: `cloudflare-emergency-cache` toggle to serve anonymous HTML from edge cache during origin outages — that's mature ops thinking.

**Database rating: 8.5/10** (9.5 minus the media-URL migration risk and unverified backups).

---

## 7. Automation Pipeline

### 7.1 What runs (from `scripts/ops/vps-scheduled-automation.crontab` + observed job runs)

- **Stats:** hourly tiered universe refresh, rank snapshots, index rebuilds, platform aggregates daily, daily rollup + prune + audit, item stats (tiered, resale history, daily rollup, index rebuild) — all confirmed executing in production `stats_job_runs`.
- **Codes:** full refresh every 6h (concurrency 6), Beebom discovery for new draft pages (GitHub Actions), copy generation queue.
- **Indexing:** Google Indexing API every 6h with persisted quota state; IndexNow.
- **Events:** daily virtual-event collection + detail seeding (LLM-assisted).
- **Puzzles:** 8 staggered daily syncs across NYT/Beebom/LinkedIn groups with graceful credential-skip flags.
- **Music/Decals:** daily collect → verify → rerank chains with lockfiles and rate-limit tuning baked into env.
- **Freshness plumbing:** every publish → `revalidation_events` → per-minute edge function → Next revalidate + Cloudflare tag purge → `cache_warm_events` → separate warmer. Fully decoupled, queue-based, observable.
- **Reporting:** Telegram bot reporting wired into automation.

### 7.2 Assessment

This is a real data-ops platform, not a pile of cron jobs: tier systems, leases, lockfiles, dry-run defaults, `--apply`/`--allow-prod` gates, audit jobs that write their own run records, and a deliberate migration off GitHub Actions runners when Roblox rate-limited shared IPs. The one weakness is **alerting on absence**: the codes-refresh staleness observed today (§6.2) apparently didn't page anyone. Add a freshness watchdog (e.g., audit job asserting `max(last_seen_at) < 8h` for active codes, Telegram alert on violation) — the pattern already exists for stats.

**Automation rating: 9/10.**

---

## 8. Hosting, Performance & Delivery

- **Measured from this machine (through Cloudflare):** homepage 200 in 0.75s (162KB HTML, cf HIT), codes page 1.35s (302KB HTML, Next HIT + CF HIT), stats 1.21s (276KB, 600s TTL). With edge cache HITs on repeat views, real-user TTFB will be far better. Fonts preloaded, LCP images preloaded — someone did Core Web Vitals homework.
- **HTML weight** (160–300KB uncompressed) is high-normal for content pages; the repo already has the 1.8MB gate and known pagination mitigation for image-heavy collections. Fine.
- **Cloudflare posture:** always-HTTPS, TLS1.2+, HTTP/3, brotli, tiered cache, scoped purge token, bot challenge active (curl gets 403 — good anti-scrape, mildly watch Googlebot).
- **Open items from the team's own tracker:** SSL still on "Full" not "Full (strict)" (origin cert on Traefik pending) — a live MITM-hardening gap between Cloudflare and origin; finish it.
- **Single-VPS SPOF** as covered in §6.4.
- Dokploy deploy from `production` via webhook with health checks and post-deploy cache warm — deployment story is solid for the team size.

**Hosting/perf rating: 7/10 (8.5 for what's built, minus SPOF/backup/strict-SSL opens).**

---

## 9. User Signals, Products & Monetization

### 9.1 The uncomfortable numbers (production, July 2, 2026)

- Registered users: **44**. Comments: **51**. Code-progress rows: 9. Checklist progress: 6. Quiz progress: 2.
- Chrome extension: **58 users, zero ratings** (last updated May 5, 2026) — despite being the single best organic growth loop available (it lives on Roblox game pages themselves).
- Mobile app: built (Expo V1, codes browsing) but no evidence of store distribution or users.
- X/Twitter posting automation exists (`post:codes`, `post:online`); the account exists; reach unknown but presumably minimal.

The product surface for engagement (Roblox OAuth login, progress tracking, comments) is well-built and almost entirely unused. That's not a build problem — it's an audience problem. **Do not invest further in logged-in features until acquisition works.**

### 9.2 Monetization

- `ads.txt` is live and managed via Journey (journeymv.com) with a build-time updater — proper setup.
- **However, no ad scripts (Journey/Playwire/AdSense/GPT) were observable in the served HTML of the homepage or a codes page.** Either ads are consent-gated/deferred in a way this review couldn't trigger, or they're configured but not serving. **Verify in a real browser with consent accepted, and check the Journey dashboard.** If ads aren't serving, the site currently earns ~nothing.
- GA4 is present (G-PTHLB2E0ED).
- No affiliate, sponsorship, premium, or API monetization visible. For this niche the realistic ladder is: programmatic ads → premium ad partner (Playwire/Journey at scale) → extension/app audience → data/API licensing for stats (RoMonitor-style) → creator services.

**Monetization rating: 3/10 (configured, unproven).**

---

## 10. Does Bloxodes Have a Genuine Future?

**Yes — conditionally.** Here's the honest reasoning:

**What's working for it:**
1. The cost structure is near-zero (one VPS, automation does the work of a content team). The site can afford to be patient; most competitors can't produce at this quality/cost ratio.
2. The content factory (skills + verification pipeline) makes high-quality expansion into any rising game a ~day-scale operation. Speed-to-coverage on new games is the single best organic-SEO lever in this niche, and Bloxodes is structurally faster than everyone except maybe Fandom's community edits.
3. The multi-surface hub (codes + wiki + stats + tools + events per game, all interlinked with live data) is a genuinely better product than any single competitor. Nobody else has this combination on one domain.
4. Technical SEO and freshness architecture are already better than most of the sites currently outranking it.

**What's working against it:**
1. **Authority takes years or links, and there is no link engine.** Without it, the excellent pages sit at position 30.
2. The flagship vertical (codes) is the hardest to win and partly derivative of competitors' data.
3. Everything rides on Google organic. One classification event or one Roblox API change is an extinction-level risk with zero audience diversification (no email list, no Discord, no social following, 58 extension users).
4. Single-founder-scale ops on a single VPS with unverified backups.

**Verdict:** The machine deserves to exist and can win — but the next two quarters must be spent almost entirely on **distribution, authority, and resilience**, not on more page types. If in 12 months the site has (a) a few hundred referring domains, (b) 10K+ extension users, (c) provable ad revenue, and (d) top-10 rankings on mid-tail game terms it covered first, it has a real business. If it just has more pages, it doesn't.

---

## 11. Prioritized Recommendations

### P0 — This week (defects & risk, all verified findings)

1. **Check the codes-refresh cron.** Active-code freshness was ~13h against a 6h schedule at review time. Inspect the VPS `run-job.sh codes-refresh` logs; add a Telegram freshness watchdog so this pages you next time.
2. **Migrate legacy media URLs off the old managed Supabase project before deleting it.** Inventory `supabase.co` URLs across all content columns (codes pages provably contain them), copy objects, backfill URLs to media.bloxodes.com.
3. **Verify ads are actually serving** (real browser + consent + Journey dashboard). If not, that's free money leaking every day.
4. **Verify and test-restore database + storage backups off-VPS.** Document the restore runbook.
5. **Finish Full (strict) SSL** (origin cert), per your own tracker.

### P1 — This quarter (distribution: the actual bottleneck)

6. **Make stats the link magnet.** Publish quotable platform reports ("Roblox CCU hit X", "Fastest-growing games of Q3") with embeddable charts; pitch gaming journalists (they already cite RoMonitor). Every stats citation lifts codes/wiki rankings domain-wide.
7. **Push the extension hard.** It's the only growth loop that lives where the audience already is. Ship the store listing polish (screenshots, ratings ask), promote it on every codes page (already done) *and* on X/Reddit/Discord, and consider expanding it to show stats + wiki links, not just codes — that turns every Roblox game page into a Bloxodes doorway.
8. **Build presence where Roblox players actually are:** a Discord server, TikTok/Shorts clips generated from wiki/stat data (ffmpeg is already a dependency — automate chart/countdown clips), and Reddit participation for covered games. The audience is 9–17; they don't start at Google for everything.
9. **Double down on the wiki-collections wedge for rising games** — `discover-wiki-candidates` already ranks them; be first with the structured wiki before Fandom communities form. First-mover on a game that later blows up is how young domains earn rankings.
10. **Drip-publish the ~2,150 draft codes pages** keyed to demand (CCU tier / search-volume threshold), never in bulk.
11. **Add bylines + reviewed-by lines to codes pages** and deepen the 4 author entities (real bios, socials). Cheap E-E-A-T.
12. **Wire GSC into the reporting loop** (weekly clicks/impressions/coverage → Telegram) so ranking reality is continuously visible.

### P2 — Next 6 months (strategic)

13. **Decide about puzzles:** either accept it as a pure-traffic side hustle and isolate it (subdomain is the clean cut), or drop it and keep topical purity. Current placement is the worst of both.
14. **More tools/calculators** (value calculators, trade calculators per big game — the TRADING-CALCULATOR-MASTER-PLAN doc already exists). Tools earn links and repeat visits and are hard to clone.
15. **Reduce codes-source concentration:** finish wiring source_url_3+ (Destructoid/PGG work in docs), and add first-party discovery (game Discord announcement channels are the primary source everyone scrapes indirectly).
16. **Add a minimal regression test layer** (a route-smoke suite over the top 20 page types against local Supabase seed) and re-enable lint. The verification scripts protect content; nothing protects app refactors.
17. **Repo hygiene sweep:** delete/relocate `one-off-scripts/`, purge `tmp/` from the repo, commit or revert the dangling AGENTS.md edits, remove the stale worktree copy.
18. **Resilience roadmap:** at minimum nightly off-site dumps + object-storage replication; ideally a warm standby or a documented 4-hour rebuild path (Dokploy + migrations + restore).
19. **Diversify capture:** lightweight email/push ("codes alert for your games" — progress tracking already exists as the hook) so the audience isn't 100% Google-rented.

---

## 12. Method & Caveats

- Database figures are live production counts from July 2, 2026 (read-only, service-role, HEAD counts).
- Live-page assessments cover sampled representative pages (home, Blox Fruits codes, GaG wiki hub, Blox Fruits locations, Blox Fruits stats, one article), not an exhaustive crawl. The repo's own `audit:seo` can do the exhaustive version.
- Ranking observations are single-query web-search snapshots (US), not a rank tracker; traffic, GSC, GA, Journey revenue, and backlink data were not accessible to this review and are the biggest blind spots in it.
- No load testing, no security penetration testing, and no Lighthouse lab run were performed; performance numbers are cold-ish curl timings through Cloudflare.
