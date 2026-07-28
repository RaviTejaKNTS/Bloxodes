# Extension Feature Expansion Plan

Status: research complete, feature selection pending. No implementation started.
Researched: 2026-07-24.

Goal: grow the Bloxodes Chrome extension from a single codes card into the most feature-rich, useful extension for Roblox players (and later creators), following the quality-of-life enhancement model of RoPro, BTRoblox, RoSeal, and RoQoL.

Direction decision (explicit): do NOT inject Bloxodes editorial content (guides, wiki pages, checklists, articles) into roblox.com. That floods the site with content users did not ask for. Stats integration is fine. The extension should enhance the Roblox website itself, the way the big QoL extensions do.

## Current extension state (v4.0.1)

- One feature: injected "Active Codes" card on `roblox.com/games/*` showing up to 3 active codes with copy buttons.
- One API call: `GET /api/extension/roblox-game-codes` (placeId, gameName, limit=3). No cookies, no auth.
- No popup, no options page, no toolbar action, no storage, no notifications, no declared permissions beyond `host_permissions` for `https://bloxodes.com/api/extension/*`.
- ~56 users on Chrome Web Store; also submitted to Microsoft Edge Add-ons (v4.0.1, July 2026).
- Known debt: unused payload fields fetched but never rendered (`coverImage`, `slug`, `robloxUrl`, `shown`, `hasMore`, `reason`, `codesHubUrl`); loading/retry UI styled in `styles.css` (`.bloxodes-loading-row`, `.bloxodes-retry-button`) but never implemented in `content.ts`; legacy `robloxUrl` request param on the API is dead for current clients.

## Market landscape (mid-2026, Chrome Web Store)

| Extension | Users | Rating | Model | Known for |
|---|---|---|---|---|
| BTRoblox | 4M | 4.1 | Free | Themes, profile redesign, Robux to USD; breaking often, semi-abandoned |
| RoPro | 2M | 4.7 | Freemium $3.99/$7.99 | Avatar sandbox, trading suite, server tools |
| RoSeal | 200K | 4.3 | Free | Deep server telemetry, privacy tools; the enthusiast favorite |
| RoQoL | 80K | 3.0 | Freemium ~$5 | Live game stats, outfit slots; hated for paywalling server filters |
| RoValk | 60K | 4.3 | Free | Rolimon's trade values in the trade window |
| RoGold Ultimate | 30K | 4.0 | Freemium $4.99/$6.99 | 100+ feature suite, desktop app, Studio plugin |
| Codes Hunter (Gamurs) | 8K | 4.9 | Free | Codes + game detection + Discord/Trello links |
| Roblox Den | 4K | 4.3 | Free | Codes box + highlights robloxden.com in search results |
| Roblox+ | discontinued Nov 2025 | n/a | Free | Item/trade/friend notifiers; users now homeless |

Key market lessons:

1. Paywalls are the #1 sentiment landmine. RoQoL's 3.0 rating is almost entirely anger at paywalled server-region/ping filters; the same complaint is RoPro's most common negative review. Shipping those features free is the strongest acquisition play in the niche.
2. Breakage is the #2 landmine. Roblox site rewrites keep breaking BTRoblox (item previewer Feb 2025, store downloads Mar 2025, server lists Sep 2025), and Roblox web API deprecations (presence auth changes, economy endpoints) killed Roblox+ outright. Features backed by our own backend never break from Roblox changes; features scraping Roblox DOM or undocumented APIs need a permanent maintenance budget.
3. Trust is a marketing point. After the SearchBlox credential-theft incident (200K installs) and circulating fake BTRoblox/RoGold clones, minimal permissions, no cookie reads, and a clear privacy story are selling points, not just hygiene.
4. The notifier space is vacant. Roblox+ died Nov 2025 and nothing replaced its item/trade/friend notifiers.

## Candidate feature list

Numbered for selection. Each entry: what it does, who does it today, how it is built, risk notes.

### Game pages and servers

1. **Server region + ping display and filters.** Show each public server's region, ping estimate, player count; filter/sort by lowest ping, region, smallest, oldest. RoSeal does it free (its killer feature); RoPro and RoQoL paywall it. Built on the `games.roblox.com` server-list API plus a server-join handshake (needs the user's logged-in Roblox session from page context) to infer datacenter region. Medium fragility (undocumented handshake). Shipping this free is the single strongest user-acquisition play available.
2. **Recent servers + server hop.** Remember joined servers, one-click rejoin, hop to a random/small server. RoPro free tier. Server-list API + local storage of recent server IDs. Low fragility.
3. **Joinability / server health check.** Before joining, show if a server is full, shutting down, or on an outdated version; RoSeal also shows server FPS/physics and update delay. Same server-list + join-negotiation APIs. Higher fragility (deepest use of undocumented endpoints).
4. **Live game stats on the game page.** Live-updating CCU, visits, votes without refresh. RoQoL free. Roblox `games`/`votes` APIs polled from the page. Low fragility. Pairs with #5.
5. **Bloxodes stats overlay (unique edge).** CCU history sparkline, rank, 24h/7d growth, peak, update-event markers on the game page, linking to full `/stats` charts. Nobody else has historical data; RoQoL shows only "now". Served entirely from our backend (`/api/stats/games/[universeId]` + chart endpoints), zero Roblox-API fragility. Also the traffic driver back to bloxodes.com.
6. **Private server manager.** List the user's private servers with expiry dates, renewal cost, stored share links. RoQoL shows private-server billing; RoSeal manages links. Roblox private-server APIs with user session. Low-medium fragility.

### Profiles and social

7. **Last online / presence details on profiles.** Exact "last seen" time and richer presence (in game X, in Studio). BTRoblox, RoPro, RoSeal, RoGold. Uses `presence.roblox.com`; presence auth changes are what killed Roblox+'s notifiers, so build with graceful degradation. Medium fragility.
8. **Mutual friends on profiles.** Show mutuals when visiting someone's profile. RoPro free. Friends API, client-side intersection. Low fragility.
9. **Friend/unfriend history.** Notify when someone unfriends you or you gain a follower. RoQoL. Needs periodic friends-list snapshots in `chrome.storage` (or our backend for cross-device sync). Low API fragility, polling-based.
10. **Item purchase dates / badge earn dates.** Show when the user bought an item or earned a badge, on that item/badge page. RoSeal. Inventory/badges APIs. Low fragility, well-loved detail feature.
11. **Ban/termination status on profiles.** Flag banned or terminated accounts when viewing profiles. RoSeal, RoGold. Inferred from user API responses. Low fragility.

### Avatar and catalog

12. **Avatar sandbox / try-on.** Preview unowned items on your avatar in 3D before buying. RoPro's headline free feature; RoGold has a fancier editor. Built on Roblox's avatar-thumbnail render API with a composed avatar definition. High effort, medium fragility, but the most-praised feature in the whole market.
13. **Extra outfit slots.** Store outfits beyond Roblox's cap (RoQoL offers 150) with quick equip. Outfit definitions in `chrome.storage` (or our backend if synced), applied via avatar API. Medium effort, low fragility.
14. **Outfit copier + outfit cost.** Copy any user's outfit and show total Robux cost to buy it. RoGold. Avatar + catalog price APIs. Low-medium effort.
15. **Robux to real currency converter.** Show USD/INR/etc. next to Robux prices site-wide. BTRoblox, RoKit, RoGold. Pure DOM decoration with a static rate table (plus our DevEx constants for creator value). Low effort; DOM selectors need occasional maintenance.
16. **Catalog item stats overlay (unique edge).** On `roblox.com/catalog/*`: price history, favorites rank, resale movement from our `roblox_catalog_items` stats pipeline (`/api/stats/items/*`). Free alternative to Rolimon's-dependent overlays, using our own data. Zero Roblox fragility.

### Site UX

17. **Themes / dark modes.** Custom site skins (BTRoblox's Dark As Night is iconic; RoPro/RoGold have theme creators). Pure CSS injection. Low effort but highest ongoing maintenance: every Roblox redesign breaks selectors; this is exactly what is bleeding BTRoblox. Big demand, recurring cost.
18. **Pinned games / home page cleanup.** Pin favorite games to the top, reorder or hide home-page sorts. RoGold pins, RoSeal reorders. DOM manipulation + local storage. Low-medium fragility.
19. **Quick search / power search.** Instant search overlay (games, users, items) via keyboard shortcut anywhere on the site. RoGold Power Search, RoPro quick search. Roblox search APIs, or our `/api/search/all` + `/api/search/games` for content-aware results. Low fragility if backed by our APIs.
20. **Streamer mode.** One toggle that blurs Robux balance, real name, email, and identifying info. RoGold. Pure CSS/DOM. Low effort, niche but loved by creators and YouTubers.
21. **Content blocking.** Hide specific games, creators, or keyword-matched experiences from home/discover/search. RoSeal. DOM filtering + local blocklist. Low-medium fragility.

### Privacy and safety

22. **Anti-tracking.** Spoof online status / hide avatar from tracker sites. RoSeal. Intercepts specific page requests. Medium fragility, strong enthusiast appeal.
23. **Session/login alerts.** Warn when a new session logs into the account (cookie-theft canary). RoQoL. Sessions API polling. Low fragility, strong trust/safety story that fits our minimal-permissions brand.
24. **Scam/phishing protection.** Flag known scam links and fake-extension clones in chats/descriptions. RoSeal. Needs a maintained blocklist (could live on our backend). Low fragility.

### Notifications (the vacated Roblox+ space)

25. **Friend presence notifier.** Desktop notification when a friend comes online or joins a game, with join button. Roblox+'s signature feature, dead since Nov 2025 with no successor. Presence API + `chrome.alarms` + `chrome.notifications`. Highest fragility (presence API auth changes killed Roblox+); needs defensive engineering.
26. **New-code notifications (unique edge).** Follow games, get a desktop notification when new codes drop. Nobody does this at all. Powered entirely by our codes DB (needs one small "codes delta since timestamp" endpoint). Zero Roblox fragility. Keeps the codes identity without page fluff.

### Existing feature

27. **Codes card (current).** Keep as-is, but ship the already-styled loading/retry UI, and either use or strip the unused payload fields (`coverImage`, `hasMore`, etc.).

## Cross-cutting considerations

- **Permissions cost.** Today the extension has effectively zero permissions. Features 1-3, 6-14, 22-23, 25 require calling Roblox APIs with the user's session, meaning broader host permissions on `roblox.com` API domains; notifiers add `alarms`, `notifications`, `storage`. Still cookie-read-free, but the store listing changes from "no special permissions" to a normal QoL-extension footprint.
- **Fragility budget.** Features on Roblox DOM/undocumented APIs (1, 3, 7, 17, 22, 25) need ongoing maintenance; this is what killed Roblox+ and is hurting BTRoblox. Features backed by our own data (5, 16, 19, 24, 26) never break from Roblox changes. A healthy selection mixes both.
- **Monetization.** Everything free, backed by the site. The paywall resentment against RoPro/RoQoL is our opening; the extension's job is trust, installs, and traffic to bloxodes.com.
- **Trust posture.** Keep the minimal-permissions, no-cookie-read, official-stores-only stance prominent in store listings and on the site. Automation-style features (auto-trade, auto-decline) carry ToS risk and are deliberately excluded from this list.

## Deliberately excluded

- Injecting Bloxodes editorial content (wiki, guides, checklists, events, articles) into roblox.com pages: rejected direction, see top of doc.
- Trading automation (auto trade outreach, auto-decline): Roblox ToS risk territory.
- Discord Rich Presence: requires a desktop companion app (RoGold's approach), out of scope for a browser extension.
- Ad removal on roblox.com: Chrome Web Store policy gray zone, low value.

## Next step

User selects feature numbers from the list above; then write the concrete implementation plan (API additions, manifest changes, content-script architecture, rollout order) for the selected set only.
