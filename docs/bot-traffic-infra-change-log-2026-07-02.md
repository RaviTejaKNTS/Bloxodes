# Bloxodes Bot Traffic and Infrastructure Change Log - 2026-07-02

This document lists the operational changes made during the Singapore bot-traffic incident chat. It is intentionally an audit note, not an implementation guide.

## Scope

- Primary site: `https://bloxodes.com`
- Affected infrastructure: Cloudflare zone for `bloxodes.com`, Hostinger VPS, Docker/Traefik, Bloxodes stats worker, self-hosted Supabase domains.
- Main goals during the chat:
  - reduce Singapore bot/scraper traffic;
  - avoid hurting real users, search engines, and AI crawlers;
  - keep Bloxodes and other VPS services healthy;
  - diagnose later stats freshness and Bing indexing concerns.

## Important Caveats

- Secrets and API tokens are intentionally not included here.
- Some changes were temporary and later reverted. Those are still listed because they affected the system during the incident.
- Cloudflare dashboard changes made directly by the user, such as enabling a bot-protection toggle, are noted separately from Codex-made changes.
- This file was created after the work from chat context and session history. Re-verify current Cloudflare/VPS state before assuming every listed active rule still exists exactly as written.

## Repository Changes

- No production app code changes were intentionally made for the bot-traffic mitigation itself.
- Temporary helper scripts were created under ignored/local temp locations during the incident and used for Cloudflare/VPS API operations.
- This audit file was added:
  - `docs/bot-traffic-infra-change-log-2026-07-02.md`

## Cloudflare Access and Permissions

- Checked existing Cloudflare-related environment variables.
- Found the older `CLOUDFLARE_BLOXODES_API` token path initially invalid or unusable from the local machine.
- Confirmed another Cloudflare runtime token could verify but had insufficient access for ruleset/analytics edits.
- Asked for a zone-scoped Cloudflare token with permissions around:
  - Zone Read
  - Zone Settings Read/Edit
  - Rulesets Read/Edit
  - WAF Read/Edit
  - Cache Rules Read/Edit
  - Cache Purge Edit
  - Analytics Read
  - Logs Read
  - DNS Read
  - Bot Management Read/Edit
  - Firewall Services Read/Edit
- Identified that the Cloudflare token was IP-filtered.
- Adjusted Cloudflare API operations to run from the VPS IPv4 address because Cloudflare rejected local/IP-mismatched API calls.
- Forced Cloudflare API calls from the VPS over IPv4 so they matched the token allowlist.

## Initial Cloudflare Hardening

### Public HTML Cache

- Created or updated a Cloudflare cache rule:
  - `bloxodes_public_html_cache`
- Goal:
  - cache public HTML for normal public GET/HEAD pages at Cloudflare;
  - reduce repeated bot load on the VPS origin.
- Verified homepage began returning Cloudflare cache hits after the rule.

### Exploit/Scanner Path Blocking

- Created or updated a Cloudflare WAF rule:
  - `bloxodes_block_exploit_noise`
- Purpose:
  - block obvious exploit/scanner paths such as `.env`, `.git`, `wp-login.php`, and similar noise.
- Verified `/.env` returned Cloudflare `403`.

### Scraper User-Agent Challenge

- Created or updated a Cloudflare WAF rule:
  - `bloxodes_challenge_scraper_user_agents`
- Purpose:
  - challenge obvious scraper/tool user agents such as `python-requests`, `curl`, `wget`, `scrapy`, and similar.
- Verified plain scraper-style requests received Cloudflare mitigation.
- Side effect:
  - command-line probes using default `curl` started getting challenged, which made some later checks look like false failures until retested with browser/search user agents.

### Singapore High-Threat Challenge

- Created or updated a Cloudflare WAF rule:
  - `bloxodes_challenge_sg_high_threat`
- Purpose:
  - challenge Singapore traffic only when Cloudflare rates it high-threat.
- Important behavior:
  - this is not a Singapore country block;
  - normal Singapore visitors should be allowed unless their IP/browser looks risky to Cloudflare;
  - verified/known bots were excluded using `not cf.client.bot` and additional known search/AI-bot allowances where possible.

### Cloudflare Settings

- Enabled or confirmed:
  - Browser Integrity Check: on
  - Challenge TTL: 1800 seconds
- Changed security posture during the chat:
  - initially used a stricter/medium posture;
  - later loosened the general Cloudflare security level to reduce risk to normal users;
  - kept the Singapore high-threat challenge after user said to leave the Singapore rule.
- Tried to toggle/check Bot Fight Mode through API.
- Result:
  - Bot Fight Mode was not exposed as a valid zone API setting for this account/API path.
  - Later, the user enabled bot protection from the Cloudflare dashboard; Codex then checked that browser, Googlebot, and ChatGPT-style access still returned `200`.

## Broad Rate Limit Added and Removed

### Added Temporarily

- Created a Cloudflare rate-limit rule:
  - `bloxodes_challenge_high_rate_unverified`
- Initial intent:
  - rate-limit/challenge or briefly block non-verified crawlers/bots that exceeded a burst threshold.
- Cloudflare plan limitations forced several adjustments:
  - counting period had to be 10 seconds;
  - mitigation timeout had to be 10 seconds;
  - `http.user_agent` was not allowed in the rate-limit expression;
  - `managed_challenge` was not allowed for the rate-limit action.
- Final temporary shape:
  - short block after high GET/HEAD request volume per IP/colo;
  - excluded `cf.client.bot`.

### Removed

- The broad rate-limit rule caused real browsing to hit Cloudflare Error 1015.
- Removed the broad rate-limit rule completely.
- Verified:
  - `http_ratelimit` ruleset had `0` rules after removal.
- Active decision after removal:
  - do not use broad per-IP rate limits for Bloxodes content pages;
  - rely on targeted WAF, scraper-user-agent challenge, exploit blocks, Cloudflare cache, and targeted IP/ASN rules instead.

## VPS Origin Firewall Hardening

### Added Initially

- Confirmed direct-origin bypass was open:
  - direct requests to the VPS IP with `Host: bloxodes.com` could reach Bloxodes.
- Installed a persistent VPS origin firewall service:
  - `/etc/systemd/system/bloxodes-origin-firewall.service`
- Added a Docker-aware origin firewall approach:
  - UFW allow rules for Cloudflare IP ranges on `80/443`;
  - Docker `DOCKER-USER` rules allowing Cloudflare IP ranges to `80/443`;
  - Docker `DOCKER-USER` drops for non-Cloudflare traffic to origin `80/443`;
  - UDP `443` handling for QUIC/HTTP3.
- Verified after initial hardening:
  - public Bloxodes via Cloudflare worked;
  - direct origin IP access timed out;
  - Cloudflare-cached pages returned normally.

### Corrected During Verification

- The first Docker firewall rule was too broad.
- It blocked or interfered with container outbound traffic to the Supabase/public DB hostname path.
- Corrected the Docker `DOCKER-USER` logic so Docker bridge/overlay/container-originated traffic returned before the public-origin drop rules.
- Verified DB-backed APIs recovered after the Docker firewall correction.

## VPS Origin Firewall Rollback

This was done after we discovered the Cloudflare-only origin lock broke other public VPS services.

- Restored public VPS ingress:
  - allowed `80/tcp` from anywhere;
  - allowed `443/tcp` from anywhere;
  - allowed `443/udp` from anywhere;
  - applied both IPv4 and IPv6 UFW public allow rules.
- Removed live Docker `DOCKER-USER` drop rules that blocked non-Cloudflare traffic to `80/443`.
- Verified after rollback:
  - `https://bloxodes.com/api/health` returned `200`;
  - `https://dokploy.ravitejaknts.com` returned `200`;
  - `https://vault.ravitejaknts.com` returned `200`;
  - `https://umami.ravitejaknts.com` returned `200`;
  - authenticated REST through `https://database.bloxodes.com` returned `200`;
  - a real media object through `https://media.bloxodes.com/storage/v1/object/public/...webp` returned `200 image/webp`.
- Important follow-up:
  - the persistent firewall service was installed earlier. Before rebooting the VPS, re-check whether it is disabled/neutralized or whether it could reapply the old Cloudflare-only Docker drop rules.

## Cloudflare Cache Purges and Top-Bar API Cache

### Quiz Cached 404 Fix

- Found `/quizzes/survive-zombie-arena` was listed in the sitemap but returned a public Cloudflare-cached `404`.
- Confirmed the origin/running container returned `200` and the quiz JSON existed.
- Tried a single-URL Cloudflare purge.
- The single-URL purge reported success but the same cached `404` persisted.
- Ran a full Cloudflare cache purge.
- Verified `/quizzes/survive-zombie-arena` returned `200` for browser and Googlebot after the purge.

### Top-Bar API Cache

- Found the top bar loads after initial HTML because the client hydrates and calls:
  - `/api/game-top-nav?path=...`
- Added a Cloudflare cache rule:
  - `bloxodes_game_top_nav_api_cache`
- Purpose:
  - cache the public top-nav JSON at Cloudflare edge;
  - reduce the delayed origin round trip after hydration.
- Verified repeated `/api/game-top-nav` requests reached `cf-cache-status: HIT`.
- No app-code refactor was made to server-render the top bar in the initial HTML.

## Site Health Checks and Findings

- Confirmed `/tools` index returned `200` for normal browser and Googlebot requests.
- Confirmed `/quizzes` index returned `200` for normal browser and Googlebot requests.
- Confirmed plain `curl`/tool-style checks could be challenged by Cloudflare due to the scraper-user-agent WAF rule.
- Sampled sitemap families and route types.
- Found sitemap scale around `3,767` URLs during that check.
- Found expected `404`s for page-2 routes that likely do not have enough content:
  - `/tools/page/2`
  - `/checklists/page/2`
- Found and fixed stale cached `404` for:
  - `/quizzes/survive-zombie-arena`
- Noted performance/cleanup follow-ups:
  - author pages were dynamic/slower in sampled checks;
  - search API and chart warnings/fallback log noise existed but were not treated as outage blockers.

## Exact Singapore Bot IP Block

- Queried Cloudflare HTTP analytics for Singapore traffic.
- Found Singapore traffic around `300,298` requests in the prior 24-hour window.
- Identified a high-volume AWS Singapore cluster, mostly around `47.128.114.*` and `47.128.113.*`.
- Added a Cloudflare WAF rule:
  - `bloxodes_block_observed_sg_bot_ips`
- Action:
  - `block`
- Scope:
  - `bloxodes.com` and `www.bloxodes.com`
- Guard:
  - `not cf.client.bot`
- Blocked 50 exact observed IPs:

```text
47.128.114.151
47.128.114.101
47.128.114.183
47.128.114.171
47.128.114.112
47.128.114.103
47.128.114.17
47.128.114.137
47.128.114.146
47.128.114.125
47.128.114.130
47.128.114.184
47.128.114.16
47.128.114.170
47.128.114.122
47.128.113.99
47.128.114.155
47.128.114.182
47.128.114.102
47.128.114.144
47.128.114.1
47.128.114.167
47.128.114.150
47.128.114.118
47.128.114.181
47.128.114.162
47.128.114.147
47.128.114.159
47.128.114.113
47.128.113.96
47.128.114.152
47.128.114.163
47.128.114.154
47.128.114.119
47.128.114.161
47.128.114.148
47.128.114.164
47.128.114.123
47.128.114.169
47.128.114.132
47.128.114.145
47.128.114.149
47.128.114.111
47.128.114.124
47.128.114.172
47.128.114.121
47.128.114.11
47.128.114.133
47.128.114.114
218.212.47.56
```

- Verified after enabling:
  - normal browser access returned `200`;
  - Googlebot-style access returned `200`;
  - ChatGPT-style access returned `200`.

## Singapore ASN Managed Challenge

- After the exact IP block, remaining Singapore traffic rotated to `43.172.*` and `43.173.*`.
- Identified network:
  - owner: `ACEVILLE PTE.LTD.`
  - ASN: `AS132203`
  - associated abuse contact pointed toward Tencent/QCloud.
- Added a Cloudflare WAF managed-challenge rule:
  - `bloxodes_challenge_sg_as132203`
- Rule intent:
  - challenge Singapore traffic from ASN `132203`;
  - avoid blocking all Singapore;
  - avoid blocking all AWS;
  - keep exact previously observed bad IPs fully blocked.
- Guard/exclusions:
  - `not cf.client.bot`;
  - explicit known search/AI crawler allowances were also included where possible.
- Verified after enabling:
  - normal browser access returned `200`;
  - Googlebot-style access returned `200`;
  - ChatGPT-style access returned `200`.

## Search and AI Bot Protection

- Included `not cf.client.bot` in the exact-IP block and ASN challenge rules.
- Added/kept explicit allowances for known search/AI user agents where possible, including Googlebot, Bingbot, GPTBot, ChatGPT-User, OAI SearchBot, Perplexity, Claude-style crawlers, and similar.
- Verified at multiple points that:
  - Googlebot-style requests got `200`;
  - ChatGPT-style requests got `200`;
  - OAI SearchBot sitemap checks got `200`.
- User later confirmed the importance of `and not cf.client.bot`; this was already present in the important bot-block/challenge rules.

## Bot Attribution Discussion

- No technical blocking change was made for attribution.
- We discussed practical tracking limits:
  - Cloudflare can identify IPs, ASNs, countries, paths, user agents, and sometimes fingerprints depending on plan/log access.
  - It usually cannot identify the actual person behind the scraper.
- Proposed future approach:
  - canary phrases or IDs on pages;
  - canary image/query URLs;
  - later search for copied text/data;
  - monitor hotlinking or canary asset hits.

## Stats Worker Changes

### Temporary Worker Fix Made During Stats Incident

The stats pages had stopped around `2026-07-02 01:30 IST`.

- Diagnosed that hourly stats rows stopped at:
  - `2026-07-01 20:00 UTC`
  - `2026-07-02 01:30 IST`
- Found stats worker logs showing Supabase `fetch failed` errors.
- Found the worker was using the old direct Supabase hostname:
  - `bloxodesdb.ravitejaknts.com`
- Found Docker/container networking could not reach that public-IP hairpin path after origin/firewall hardening.
- Made a temporary worker runtime change:
  - changed the worker Supabase URL to local Kong:
    - `http://127.0.0.1:8000`
  - updated the stats-worker wrapper to run containers with:
    - `--network host`
  - added a missing VPS HOT hourly cron:
    - `12 * * * * ... stats-hot-refresh ...`
  - stopped two stale discovery worker containers that were stuck retrying Roblox `429`s.
  - ran a manual HOT stats repair.
- Manual repair result reported:
  - `5,485 / 5,743` HOT universes updated;
  - `5,485` current-hour rows written;
  - rank snapshot succeeded with `61,696` rank rows;
  - public `/api/stats/games` became fresh again.

### Worker Fix Reverted Later

After broader VPS/service impact was understood, the worker workaround was reverted to normal domain-based behavior.

- Removed `--network host` from:
  - `/home/codex-admin/bloxodes-stats-worker/bin/run-job.sh`
- Changed worker env back to canonical production Supabase domain:
  - `SUPABASE_URL=https://database.bloxodes.com`
- Left the HOT cron in place because no second active HOT scheduler was confirmed.
- Verified:
  - normal Docker worker networking could read Supabase through `https://database.bloxodes.com`;
  - VPS authenticated REST through `https://database.bloxodes.com` returned `200`.

## VPS Service Recovery

- Checked Docker/Traefik state after the user reported other services stopped.
- Found containers were up, but public access had been broken by the Cloudflare-only origin firewall lock.
- Internal Traefik routes on the VPS worked for:
  - Bloxodes;
  - Dokploy;
  - Vaultwarden;
  - Umami;
  - database;
  - Studio;
  - media.
- Restored public ingress as described above.
- Verified public services returned:
  - Bloxodes health: `200`;
  - Dokploy: `200`;
  - Vaultwarden: `200`;
  - Umami: `200`;
  - real media object: `200 image/webp`;
  - authenticated database REST: `200`.

## Database and Media Domains

- Confirmed production Supabase should use current domains:
  - API/database: `https://database.bloxodes.com`
  - public media/storage: `https://media.bloxodes.com`
  - Studio: `https://studio.bloxodes.com`
- Confirmed the legacy hostname should not be used:
  - `https://bloxodesdb.ravitejaknts.com`
- Clarified that naked Supabase roots returning `401` can be normal.
- Correct health checks are:
  - authenticated REST reads through `database.bloxodes.com`;
  - actual public storage object URLs through `media.bloxodes.com`.

## Bing / Music IDs Checks

No production changes were made for the Bing/music IDs concern.

- Checked live main URL:
  - `https://bloxodes.com/catalog/roblox-music-ids`
- Verified:
  - `HTTP 200`;
  - self-canonical;
  - `index, follow`;
  - present in catalog sitemap;
  - allowed by `robots.txt`.
- Queried Bing Webmaster API.
- Bing URL info showed:
  - the URL is known as a page;
  - document size matched live HTML around 408 KB;
  - last crawled on `2026-07-02 06:20 UTC`;
  - no crawl issues returned by the accessible API.
- Bing page stats latest available bucket showed:
  - `2026-06-26`: `31,618` clicks and `331,712` impressions.
- Found the paginated/chart music child pages use `noindex, follow`, but the main money URL does not.
- Recommended waiting after the user requested Bing reindexing.
- Suggested pushing Bing support to check the exact affected URL, not just the root domain.

## User-Made or External Changes Not Made by Codex

- User updated/granted Cloudflare token permissions in the dashboard.
- User enabled a Cloudflare bot-protection/dashboard toggle.
- User requested reindexing for the music IDs URL in Bing Webmaster Tools.
- User opened a Bing support ticket.

## Current Intended Posture After the Chat

- Broad Cloudflare rate limiting: removed/off.
- Public VPS `80/443/443udp`: open again so other VPS services work.
- Direct-origin Cloudflare-only lock: no longer the active live posture after rollback.
- Cloudflare public HTML caching: intended to remain active.
- Cloudflare exploit/scanner path block: intended to remain active.
- Cloudflare scraper-user-agent challenge: narrowed on `2026-07-06` to scanner-style clients only.
- Cloudflare exact observed SG bot IP block: intended to remain active.
- Cloudflare SG ASN `132203` managed challenge: intended to remain active.
- Cloudflare SG high-threat challenge: intended to remain active unless later removed.
- Search engines and known AI crawlers: intended to remain allowed.
- Stats worker: intended to use `https://database.bloxodes.com`, normal Docker networking, and the VPS HOT cron left in place unless another scheduler is confirmed.

## 2026-07-06 Curl / Agentic Fetch Rollback

After Bing and citation-quality concerns, the generic scraper user-agent rule was loosened.

- Read current Cloudflare WAF state from the VPS because the Cloudflare token is IP-filtered.
- Confirmed `http_ratelimit` still had `0` active rules.
- Changed custom WAF rule:
  - from `Bloxodes challenge generic scraper user agents`;
  - to `Bloxodes challenge scanner user agents`.
- Removed these generic/tool user agents from the custom managed-challenge expression:
  - `curl`;
  - `wget`;
  - `python-requests`;
  - `go-http-client`;
  - `httpclient`;
  - `libwww-perl`;
  - `scrapy`.
- Kept managed challenges for:
  - empty user agent;
  - `masscan`;
  - `zgrab`;
  - `sqlmap`;
  - `nikto`;
  - `nuclei`;
  - `acunetix`;
  - `nessus`;
  - `wpscan`.
- Left these protections unchanged:
  - exact observed Singapore bot IP block;
  - Singapore ASN `132203` managed challenge;
  - Singapore high-threat managed challenge;
  - exploit/scanner path block;
  - Browser Integrity Check;
  - public HTML and top-nav cache rules.
- Live verification after the change:
  - default `curl`: `200`;
  - `python-requests`: `200`;
  - `go-http-client`: `200`;
  - browser user agent: `200`;
  - Bingbot user agent: `200`;
  - `ChatGPT-User`: `200`;
  - `masscan`: `403`;
  - `zgrab`: `403`;
  - `sqlmap`: `403`;
  - empty user agent: `403`;
  - `/.env`: `403`.
- Note: `wget` still returned `403` after the custom WAF rule was narrowed, likely due to Cloudflare Browser Integrity Check or another product-level bot protection. It was not loosened in this pass.

## Follow-Up Checks Recommended

- Verify whether `/etc/systemd/system/bloxodes-origin-firewall.service` is still enabled and whether it could reapply old Cloudflare-only origin drops on reboot.
- Verify Cloudflare rules currently active in the zone:
  - `bloxodes_public_html_cache`
  - `bloxodes_game_top_nav_api_cache`
  - `bloxodes_block_exploit_noise`
  - `bloxodes_challenge_scraper_user_agents`
  - `bloxodes_challenge_sg_high_threat`
  - `bloxodes_block_observed_sg_bot_ips`
  - `bloxodes_challenge_sg_as132203`
- Verify `http_ratelimit` still has `0` rules.
- Re-check normal browser, Googlebot, Bingbot, ChatGPT-User, GPTBot, and OAI SearchBot access.
- Re-check Dokploy, Vaultwarden, Umami, database, media, and Bloxodes health after the next VPS reboot.
- Re-check stats freshness after the next scheduled HOT cron run.
- Monitor Bing Webmaster and traffic for the music IDs URL over the next 24-72 hours after reindex request.
