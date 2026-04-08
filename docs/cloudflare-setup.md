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
| CNAME | `ravitejaknts.com` | *(keep separate, not on this account)* | — |

> The orange cloud (proxied) is what routes traffic through Cloudflare's CDN. Do NOT set it to DNS-only (grey cloud) or you lose all CDN benefits.

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
- Edge Cache TTL: **6 hours** (matches `s-maxage=21600`)
- Browser Cache TTL: Respect Existing Headers

---

**Rule 4 — Cache HTML pages (the main performance win)**

Trigger:
```
URI path does not start with /api
AND URI path does not start with /auth
AND URI path does not start with /account
AND URI path does not start with /login
AND Hostname equals bloxodes.com
```

Action:
- Cache status: **Cache Everything**
- Edge Cache TTL: **Respect Cache-Control header from origin** (or set to 30 minutes as a floor)
- Browser Cache TTL: Respect Existing Headers

> This rule makes Cloudflare cache server-rendered HTML at its edge nodes. Without this, Cloudflare never caches HTML regardless of your `Cache-Control` headers.

---

### 3.4 Per-Route Cache TTLs (Reference)

The app sends these headers — Cloudflare will respect them once Rule 4 is active:

| Route | s-maxage | stale-while-revalidate |
|---|---|---|
| `/` | 30 min | 24 hours |
| `/codes/*` | 1 hour | 24 hours |
| `/articles/*` | 24 hours | 7 days |
| `/lists/*` | 5 min | 24 hours |
| `/tools/*` | 6 hours | 24 hours |
| `/checklists/*` | 6 hours | 24 hours |
| `/authors/*` | 7 days | 30 days |
| `/quizzes/*` | inherits default | — |
| `/catalog/*` | inherits default | — |
| `/sitemap.xml` | 6 hours | 24 hours |
| `/robots.txt` | 24 hours | 7 days |

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

### 7.3 Add Purge Step to Deploy Script / GitHub Actions

Add this to your Dokploy post-deploy hook or GitHub Actions workflow:

```bash
# Purge all Cloudflare cache after deploy
curl -X POST "https://api.cloudflare.com/client/v4/zones/YOUR_ZONE_ID/purge_cache" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything": true}'
```

Or to purge only specific high-traffic URLs instead of everything:

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/YOUR_ZONE_ID/purge_cache" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "files": [
      "https://bloxodes.com/",
      "https://bloxodes.com/codes",
      "https://bloxodes.com/articles",
      "https://bloxodes.com/quizzes",
      "https://bloxodes.com/catalog"
    ]
  }'
```

### 7.4 Store API Token as a Secret

In GitHub Actions:

- add `CLOUDFLARE_API_TOKEN` as a repository secret under **Settings → Secrets → Actions**
- add `CLOUDFLARE_ZONE_ID` as a repository variable under **Settings → Secrets and variables → Actions → Variables**
- add `PRODUCTION_SITE_URL` as a repository variable so the deploy workflow can wait for `/api/health` before purging

In Dokploy app environment variables:

- add `CLOUDFLARE_API_TOKEN`
- add `CLOUDFLARE_ZONE_ID`

Why both places:

- GitHub Actions uses these values to purge Cloudflare after code deployments
- the app runtime uses these values inside `/api/revalidate` so Supabase-triggered content updates also purge the relevant Cloudflare HTML entries

Without the Dokploy runtime env vars, content revalidation will update the origin cache but Cloudflare can still keep serving stale HTML until TTL expiry.

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
