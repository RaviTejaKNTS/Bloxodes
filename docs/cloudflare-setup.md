# Cloudflare Setup Guide for Bloxodes

This document covers every Cloudflare setting that needs to be manually configured for bloxodes.com on the VPS. Nothing here is auto-configured — each item requires a deliberate action in the Cloudflare dashboard or API.

---

## 1. Add Site and Transfer DNS

### 1.1 Add bloxodes.com to Cloudflare

1. Log in to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Click **Add a site** → enter `bloxodes.com` → choose the **Free** plan
3. Cloudflare will scan your existing DNS records — review them carefully before continuing

### 1.2 Update Nameservers at Your Registrar

Cloudflare will give you two nameservers (e.g. `kali.ns.cloudflare.com`, `rob.ns.cloudflare.com`).

1. Go to your domain registrar (wherever bloxodes.com is registered)
2. Replace the existing nameservers with the two Cloudflare nameservers
3. Wait for propagation — Cloudflare will email you when it is active (usually under an hour)

### 1.3 DNS Records to Create

| Type | Name | Value | Proxy |
|---|---|---|---|
| A | `bloxodes.com` | `187.124.68.197` | **Proxied (orange cloud)** |
| A | `www` | `187.124.68.197` | **Proxied (orange cloud)** |
| A | `database` | `187.124.68.197` | **Proxied (orange cloud)** |
| A | `media` | `187.124.68.197` | **Proxied (orange cloud)** |
| A | `studio` | `187.124.68.197` | **Proxied (orange cloud)** |
| CNAME | `ravitejaknts.com` | *(keep separate, not on this account)* | — |

> The orange cloud (proxied) is what routes traffic through Cloudflare's CDN. Do NOT set it to DNS-only (grey cloud) or you lose all CDN benefits.
> `database.bloxodes.com` routes to Supabase Kong, `media.bloxodes.com` serves public Supabase storage URLs through the same Kong route, and `studio.bloxodes.com` routes to Supabase Studio behind Traefik Basic Auth.

---

## 2. SSL/TLS Settings

Go to **SSL/TLS** in the Cloudflare dashboard.

### 2.1 Encryption Mode

Set to **Full (strict)**.

- **Full** means Cloudflare connects to your origin over HTTPS
- **Strict** means it validates the origin certificate (Traefik/Dokploy already issues Let's Encrypt certs — this will work)
- Do NOT use **Flexible** — that sends plaintext HTTP to the VPS which breaks auth cookies

### 2.2 Edge Certificates

- **Always Use HTTPS**: ON — redirects all HTTP to HTTPS at the edge before hitting your server
- **Minimum TLS Version**: TLS 1.2
- **Opportunistic Encryption**: ON
- **TLS 1.3**: ON
- **Automatic HTTPS Rewrites**: ON — fixes mixed-content links in HTML

### 2.3 HSTS (HTTP Strict Transport Security)

Enable HSTS with:
- Max Age: 6 months (15768000 seconds) to start, increase to 1 year once stable
- Include subdomains: ON
- Preload: OFF (until you are sure, preload is hard to reverse)

---

## 3. Cache Configuration

This is the most important section. The app already sends correct `Cache-Control` headers — Cloudflare needs to be told to respect them for HTML pages (it does NOT cache HTML by default).

### 3.1 Cache Level

Go to **Caching → Configuration**:

- **Caching Level**: Standard
- **Browser Cache TTL**: Respect Existing Headers
- **Crawler Hints**: ON

### 3.2 Tiered Cache (Smart Tiered Cache)

Go to **Caching → Tiered Cache**:

- Enable **Smart Tiered Cache Topology**

This makes Cloudflare use a two-tier cache system. Cache misses at regional PoPs hit a central PoP before going to your VPS, dramatically reducing origin load and improving global hit rates.

### 3.3 Cache Rules

Go to **Rules → Cache Rules** and create the following rules **in this order** (order matters — first match wins).

---

**Rule 1 — Bypass cache for private/API routes**

Trigger (any of these match):
```
URI path starts with /api
URI path starts with /auth
URI path starts with /account
URI path starts with /login
```

Action:
- Cache status: **Bypass**

---

**Rule 2 — Cache static assets forever**

Trigger:
```
URI path starts with /_next/static/
```

Action:
- Cache status: **Cache Everything**
- Edge Cache TTL: **1 year** (the app already sends `max-age=31536000, immutable`)
- Browser Cache TTL: Respect Existing Headers

---

**Rule 3 — Cache sitemaps, robots.txt, feed.xml**

Trigger (any of these match):
```
URI path equals /sitemap.xml
URI path starts with /sitemaps/
URI path equals /robots.txt
URI path equals /feed.xml
URI path equals /ads.txt
```

Action:
- Cache status: **Cache Everything**
- Edge Cache TTL: **Respect Cache-Control header from origin**
- Browser Cache TTL: Respect Existing Headers

---

**Rule 4 — Cache HTML pages (the main performance win)**

Expression:
```
(http.request.method in {"GET" "HEAD"}
 and http.host eq "bloxodes.com"
 and not starts_with(http.request.uri.path, "/api/")
 and not starts_with(http.request.uri.path, "/auth/")
 and not starts_with(http.request.uri.path, "/account")
 and not starts_with(http.request.uri.path, "/login")
 and not starts_with(http.request.uri.path, "/_next/")
 and not starts_with(http.request.uri.path, "/cdn-cgi/"))
```

Action:
- Cache status: **Cache Everything**
- Edge Cache TTL: **Respect Cache-Control header from origin**
- Browser Cache TTL: Respect Existing Headers
- Cache key: keep query strings in the cache key; do not enable "Ignore query string" for HTML pages.

> This rule makes Cloudflare the primary public-page cache. The VPS renders fresh HTML on a Cloudflare miss; Supabase revalidation events purge and warm affected URLs when content changes.

---

### 3.4 Cache-Until-Purged Headers

The app now sends the same public HTML cache policy for public pages, sitemaps, robots, ads.txt, and the feed:

```http
Cache-Control: public, max-age=0, s-maxage=31536000, stale-while-revalidate=31536000
```

What that means:

- Browsers revalidate HTML instead of holding long stale copies.
- Cloudflare can keep HTML for a long time.
- Content freshness comes from exact Cloudflare purges, not short TTL expiry.
- After deploy, warm Cloudflare from the sitemap.
- After content updates, `/api/revalidate` purges and warms the affected URLs.

---

## 4. Performance Settings

Go to **Speed → Optimization**.

### 4.1 Must Disable

- **Rocket Loader**: **OFF** — this defers ALL scripts and breaks the Mediavine Journey ad wrapper. Turning this on will break ads.
- **Auto Minify** (HTML/CSS/JS): OFF — Next.js already minifies everything at build time; Cloudflare's minifier can break inline scripts

### 4.2 Enable

- **HTTP/3 (QUIC)**: ON — the VPS already supports HTTP/3; Cloudflare exposes it to end users automatically
- **Enhanced HTTP/2 Prioritization**: ON
- **0-RTT Connection Resumption**: ON — reduces connection overhead for repeat visitors
- **Brotli Compression**: ON — better compression than gzip, supported by all modern browsers

### 4.3 Polish (Image Compression)

Go to **Speed → Optimization → Image Resizing**:

- **Polish**: **Lossless** — strips image metadata without quality loss. The app sets `unoptimized: true` in Next.js image config, so Cloudflare Polish is the only image optimization in the stack.
- Do NOT enable **Mirage** — it is designed for legacy mobile connections and interferes with the existing image loading strategy

---

## 5. Security Settings

### 5.1 WAF (Web Application Firewall)

Go to **Security → WAF**:

- **Cloudflare Managed Ruleset**: ON (free tier includes basic rules)
- **Bot Fight Mode**: ON — blocks known bad bots from hitting the origin

### 5.2 Security Level

Go to **Security → Settings**:

- **Security Level**: Medium
- **Challenge Passage**: 30 minutes (how long a solved challenge is remembered)

### 5.3 DDoS Protection

Enabled automatically on all plans. No action needed, but verify it is showing as active in **Security → DDoS**.

### 5.4 Hotlinking Protection

Go to **Scrape Shield → Hotlink Protection**: ON

This blocks other sites from embedding your images directly (relevant since the site has many Roblox thumbnail images).

---

## 6. Firewall Rules — Lock Down VPS Origin

One of the most important security steps: once you are behind Cloudflare, the VPS should only accept traffic from Cloudflare IPs — not from the open internet. This prevents attackers from bypassing Cloudflare by hitting `187.124.68.197` directly.

### 6.1 Get Cloudflare's IP Ranges

Cloudflare publishes their current IP ranges at:
- IPv4: https://www.cloudflare.com/ips-v4
- IPv6: https://www.cloudflare.com/ips-v6

### 6.2 Apply on the VPS with ufw

SSH into the VPS and run:

```bash
# Allow only Cloudflare IPs on port 80 and 443
# First, remove the current blanket allow rules
sudo ufw delete allow 80/tcp
sudo ufw delete allow 443/tcp

# Add each Cloudflare IPv4 range (current as of 2026 — always check the live list)
for ip in \
  103.21.244.0/22 \
  103.22.200.0/22 \
  103.31.4.0/22 \
  104.16.0.0/13 \
  104.24.0.0/14 \
  108.162.192.0/18 \
  131.0.72.0/22 \
  141.101.64.0/18 \
  162.158.0.0/15 \
  172.64.0.0/13 \
  173.245.48.0/20 \
  188.114.96.0/20 \
  190.93.240.0/20 \
  197.234.240.0/22 \
  198.41.128.0/17; do
  sudo ufw allow from $ip to any port 80
  sudo ufw allow from $ip to any port 443
done

sudo ufw status verbose
```

> After this, direct browser access to `http://187.124.68.197` will fail. All traffic must go through Cloudflare. This is the correct end state.

### 6.3 Verify the Lock-Down

```bash
# From your local machine — this should time out or refuse
curl --max-time 5 http://187.124.68.197/
# Expected: curl: (28) Operation timed out

# This should still work (goes through Cloudflare)
curl -I https://bloxodes.com/
# Expected: HTTP/2 200, cf-ray header present
```

---

## 7. Cache Purge on Deploy

After every deployment, Cloudflare's edge cache holds the old HTML. You need to purge it.

### 7.1 Get Your API Token

1. Go to **My Profile → API Tokens → Create Token**
2. Use the **Cache Purge** template
3. Scope it to `bloxodes.com` zone only
4. Save the token — you will only see it once

### 7.2 Get Your Zone ID

In the Cloudflare dashboard, go to the bloxodes.com overview page. The **Zone ID** is shown in the right sidebar. Copy it.

### 7.3 Add Purge And Warm Steps To Deploy

The repo workflow `.github/workflows/dokploy-production-deploy.yml` is the preferred place for deploy-wide purge and warm. On pushes to `production`, it triggers Dokploy, waits for the site, purges Cloudflare, and warms the selected deploy URLs from the sitemap.

If you deploy manually from Dokploy, open the workflow in GitHub Actions and run it manually with:

- `trigger_dokploy=false`
- `site_url=https://bloxodes.com`
- `purge_cloudflare=true`
- `warm_cloudflare=true`

That makes the workflow act as a post-deploy purge/warm job without trying to start another Dokploy deploy.

The purge step does the same API call:

```bash
# Purge all Cloudflare cache after deploy
curl -X POST "https://api.cloudflare.com/client/v4/zones/YOUR_ZONE_ID/purge_cache" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything": true}'
```

Then warm Cloudflare from the sitemap so normal visitors hit the edge cache instead of the VPS:

```bash
CACHE_WARM_SITE_URL=https://bloxodes.com npm run cache:warm
```

The default `CACHE_WARM_MODE=deploy` warms homepage/index/legal URLs, all wiki/catalog/tool URLs, sitemap files, and the most recent URLs from codes/articles/events/stats/puzzles/quizzes/checklists/lists/authors. Use `CACHE_WARM_MODE=full` only for an intentional full-site warm. Use `CACHE_WARM_DRY_RUN=true` to inspect the selected URLs without warming them.

For normal content updates, do not purge everything. Supabase triggers write to `revalidation_events`, the VPS Supabase revalidation function calls `/api/revalidate`, and the app purges affected Cloudflare tags plus queues warm paths in `cache_warm_events`. The VPS `cache-warm` Edge Function warms those URLs separately so revalidation stays fast.

### 7.4 Store API Token as a Secret

In GitHub Actions:

- add `CLOUDFLARE_API_TOKEN` as a repository secret under **Settings → Secrets → Actions**
- add `CLOUDFLARE_ZONE_ID` as a repository variable under **Settings → Secrets and variables → Actions → Variables**; the workflow also accepts it as a secret if you prefer
- preferred for the current setup: add `DOKPLOY_DEPLOY_WEBHOOK_URL` as a repository secret or variable. The workflow also accepts `DOKPLOY_WEBHOOK_URL` and sends a GitHub-style push payload with `ref=refs/heads/production`.
- fallback API deploy path: add `DOKPLOY_AUTH_TOKEN` or `DOKPLOY_API_TOKEN` as a repository secret, plus `DOKPLOY_URL` or `DOKPLOY_API_URL`, and `DOKPLOY_APPLICATION_ID`.
- optionally add `PRODUCTION_SITE_URL=https://bloxodes.com`; the workflow falls back to `https://bloxodes.com` when this is missing
- optionally add `DOKPLOY_DEPLOY_SETTLE_SECONDS` if Dokploy needs more or less time before health checks begin

In Dokploy app environment variables:

- add `CLOUDFLARE_API_TOKEN`
- add `CLOUDFLARE_ZONE_ID`
- add `CLOUDFLARE_WARM_AFTER_PURGE=deferred`
- add `CLOUDFLARE_DEFERRED_WARM_MAX_PATHS=40`
- avoid inline warm settings for normal runtime; `CLOUDFLARE_WARM_MAX_PATHS` and `CLOUDFLARE_WARM_CONCURRENCY` only apply when intentionally using synchronous warming

### 7.5 Local Operator Token For Rule Changes

The deployed app uses `CLOUDFLARE_API_TOKEN` for cache purge and warm behavior. Keep that token narrow and runtime-safe.

For local operator work, such as temporarily changing Cache Rules from the CLI, use a separate token in `.env.codex`:

```bash
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_BLOXODES_API=
```

`CLOUDFLARE_BLOXODES_API` should be scoped to the `bloxodes.com` zone and include the Cloudflare permissions required for Cache Rules API management:

- `Zone > Cache Rules > Edit`
- `Account Rulesets > Edit`
- `Account Filter Lists > Edit`
- `Zone > Zone > Read`

The Cloudflare Cache Rules API uses the Rulesets API, the `set_cache_settings` action, and the `http_request_cache_settings` phase. Cloudflare documents these as the required shape for creating Cache Rules through the API.

### 7.6 Emergency Public HTML Cache

When origin or Supabase is unhealthy, public pages can be protected by enabling the emergency cache rule:

```bash
npm run cloudflare:emergency-cache:status
npm run cloudflare:emergency-cache:on
```

Turn it off after the incident:

```bash
npm run cloudflare:emergency-cache:off
```

The emergency rule is intentionally temporary. During a DB/origin incident, it:

- matches public `GET` and `HEAD` requests, including browsers with cookies,
- matches `bloxodes.com` and `www.bloxodes.com`,
- excludes `/api`, `/auth`, `/account`, `/login`, `/admin`, `/dashboard`, `/_next/`, and `/cdn-cgi/`,
- keeps browser TTL respecting origin headers,
- sets Cloudflare edge TTL for successful public responses,
- sets redirects to no-cache,
- sets `5xx` responses to no-store so server error pages are not cached,
- serves stale while Cloudflare updates cached content.

Keep this rule off during normal operation. Normal mode should rely on origin headers, targeted purge, and cache warmup. Emergency mode trades freshness for availability so visitors and crawlers can keep receiving valid public pages when the DB or origin is struggling.

This rule only helps once Cloudflare has a cacheable copy. If a page is not already cached, Cloudflare still needs one successful origin response before it can serve that URL from cache during the incident. Do not run a broad cache warm while the database is saturated; warm only a few critical URLs, or wait until the origin has breathing room.

Why both places:

- GitHub Actions uses these values to purge Cloudflare after code deployments
- the app runtime uses these values inside `/api/revalidate` so Supabase-triggered content updates purge relevant Cloudflare HTML entries and enqueue deferred warm paths

Without the Dokploy runtime env vars, content revalidation cannot purge Cloudflare, so long-lived edge HTML can stay stale until manually purged. The deploy-wide `npm run cache:warm` path is still useful after code deploys or intentional broad warms; it is separate from the runtime deferred warm queue.

---

## 8. Cloudflare Analytics

Go to **Analytics & Logs**:

- **Web Analytics**: Enable on the bloxodes.com zone — gives you privacy-friendly traffic data without any client-side JS (complementary to GA)
- **Cache Analytics**: Check this after setup to verify your HTML cache hit ratio. Target: above 80% hit rate within 24 hours of enabling rules.

To check cache hit rate manually:

```bash
# Look for CF-Cache-Status: HIT on cached pages
curl -sI https://bloxodes.com/ | grep -i "cf-cache-status"
curl -sI https://bloxodes.com/codes | grep -i "cf-cache-status"
curl -sI https://bloxodes.com/articles | grep -i "cf-cache-status"
```

Expected output after first request warms the cache:
```
cf-cache-status: HIT
```

---

## 9. Optional: Cloudflare Access for Dokploy Panel

The Dokploy panel runs on port 3000 and is currently only accessible via SSH tunnel. If you want web-based access without SSH:

1. Go to **Zero Trust → Access → Applications → Add Application**
2. Choose **Self-hosted**
3. Set the domain to `dokploy.bloxodes.com` (create an A record pointing to `187.124.68.197`, proxied)
4. Add a **policy** requiring login with your Cloudflare email (or GitHub/Google identity provider)
5. In ufw on the VPS, allow port 3000 only from Cloudflare IPs using the same method as section 6.2

This gives you a browser-accessible Dokploy panel protected by Cloudflare's identity layer — no VPN or SSH tunnel needed.

---

## 10. Verify Everything After Setup

Run through this checklist after Cloudflare is active:

### Cache
- [ ] `curl -sI https://bloxodes.com/ | grep cf-cache-status` returns `HIT` after first request
- [ ] `curl -sI https://bloxodes.com/codes | grep cf-cache-status` returns `HIT`
- [ ] `curl -sI https://bloxodes.com/api/health | grep cf-cache-status` returns `BYPASS` or `DYNAMIC`
- [ ] `curl -sI https://bloxodes.com/_next/static/chunks/main.js | grep cf-cache-status` returns `HIT`

### SSL
- [ ] `https://bloxodes.com` loads with a valid certificate
- [ ] `http://bloxodes.com` redirects to `https://bloxodes.com` (Cloudflare edge redirect)
- [ ] No mixed-content warnings in browser console

### Security
- [ ] Direct access to `http://187.124.68.197` times out (origin lock-down working)
- [ ] `curl -sI https://bloxodes.com/ | grep cf-ray` returns a `CF-Ray` header (confirms traffic is going through Cloudflare)

### Performance
- [ ] Check response time: `curl -o /dev/null -s -w "TTFB: %{time_starttransfer}s\n" https://bloxodes.com/` — should be under 200ms after cache warm-up
- [ ] Rocket Loader is confirmed OFF (check page source — should not have `data-cfasync` attributes on scripts)

### Ads and Consent
- [ ] Journey ad script loads correctly after consent
- [ ] `https://bloxodes.com/ads.txt` is reachable (200 OK)
- [ ] GA events fire correctly in browser

---

## 11. What Cloudflare Does NOT Handle Automatically

These require deliberate action even after Cloudflare is set up:

| Item | Action Required |
|---|---|
| HTML caching | Must add Cache Rule (Rule 4 above) — Cloudflare skips HTML by default |
| Origin IP lockdown | Must update ufw rules manually (section 6) |
| Rocket Loader | Must explicitly turn OFF — it defaults to OFF but double-check |
| Cache purge on deploy | Must add the API call to your deploy workflow (section 7) |
| Tiered Cache | Must enable manually in Caching settings |
| Polish image compression | Must enable manually in Speed settings |
| HTTP/3 | Must enable manually in Speed → Network |

---

## 12. Ongoing Maintenance

- **Cloudflare IP ranges update occasionally.** When they do, update the ufw rules on the VPS. Subscribe to Cloudflare's status page or check their IPs list periodically.
- **After every major deploy:** run the cache purge API call (or set it up in CI so it runs automatically)
- **Check Cache Analytics monthly** to verify hit ratios stay high. A sudden drop in hit rate means something changed the cache headers or a new route is not being cached.
- **Review WAF events** in Security → Events if you see unusual traffic patterns.
