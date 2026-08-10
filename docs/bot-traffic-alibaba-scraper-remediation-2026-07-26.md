# Alibaba Singapore scraper remediation — 2026-07-26

## Outcome

A narrowly scoped Cloudflare custom Block rule was saved and activated for the currently observed scraper traffic. It applies only to the public Bloxodes website hostnames and only to the exact Singapore/Alibaba network and browser fingerprint seen in Cloudflare and Umami.

After several hours of monitoring showed that the same scraper was continuing through the rule's explicit `/api/*`, `/_next/*`, and HTTP-method exclusions, those exclusions were removed on 2026-07-27 at approximately 07:43 IST. The rule now blocks every request method and path on `bloxodes.com` and `www.bloxodes.com` when all remaining exact fingerprint conditions match.

No application, VPS, DNS, origin, API, SEO, crawler, Bot Fight Mode, or rate-limiting configuration was changed.

## Authorization and scope

- Authorized by the site owner on 2026-07-26.
- Cloudflare zone: `bloxodes.com`
- An initial save was attempted at approximately 23:15 IST but did not persist in Cloudflare.
- The corrected Block rule was saved and confirmed from the server-side rule list at approximately 23:58 IST.
- The site owner approved removing the API, Next.js, and method exclusions on 2026-07-27. The widened exact-fingerprint expression was saved and confirmed from the server-side rule list at approximately 07:43 IST.
- Existing custom rule ID reused: `6c63fbc88a5b49bd8557d011b14603a6`
- This work intentionally avoided changes to shared VPS listeners or origin protection because other applications use the same VPS.

## Evidence reviewed before the change

### Cloudflare

The last-24-hour Security Analytics cohort filtered to Singapore, Chrome, and macOS showed approximately:

- 277,280 requests
- 252,010 requests served by the origin
- 25,150 requests served by Cloudflare
- 116 mitigated requests

Sampled requests rotated through many addresses in:

- `43.119.100.0/24`
- `47.82.201.0/24`

The sampled requests shared these attributes:

- ASN: `45102`
- Network owner: Alibaba (US) Technology Co., Ltd.
- Country: Singapore
- Host: `bloxodes.com`
- Method: `GET`
- User agent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36`
- Cloudflare verified-bot category: empty
- Rapid requests to unrelated public pages, Next.js assets, and API paths from rotating IP addresses

The request pattern is inconsistent with normal user navigation: many unrelated URLs were requested within seconds while the source IP rotated inside two Alibaba Singapore ranges.

### Umami

The matching Umami cohort was:

- Country: Singapore
- Browser: Chrome
- OS: Mac OS
- Device: laptop
- Screen: `1366x1366`

In the preceding 24 hours it generated approximately:

- 2,452 page views
- 2,119 visits
- 314 sessions
- About 15.9% of all Bloxodes page views

Cloudflare requests and Umami events for this fingerprint occurred at the same seconds, linking the analytics anomaly to the observed network traffic.

The same exact Umami fingerprint spiked on 2026-07-16 and returned on 2026-07-24 through 2026-07-26. The current network source is different from the previously mitigated sources:

- Previous exact-IP traffic: AWS, AS16509
- Previous Singapore ASN rule: ACEVILLE/Tencent, AS132203
- Current traffic: Alibaba, AS45102

The current traffic therefore uses different infrastructure. It may be the same automation implementation because the browser fingerprint is identical, but the available evidence does not prove that it is the same operator.

## Cloudflare change

The unused custom rule named `Bloxodes challenge high-threat Singapore traffic` was replaced. Its deprecated `cf.threat_score` expression had recorded zero events.

An earlier Managed Challenge version was entered in the editor but did not persist. This was discovered when the rule produced no matches even though fresh Cloudflare samples satisfied the intended conditions. Navigating away from the editor and reopening the rule showed that Cloudflare still had the old deprecated rule. The final Block version below was then saved and verified from the server-side rules list rather than from editor state.

New rule configuration:

- Name: `Bloxodes block observed Alibaba Singapore scraper`
- Action: Block
- Status: Active
- Execution order: after `Bloxodes challenge scanner user agents`
- Rule ID: `6c63fbc88a5b49bd8557d011b14603a6`

Expression:

```text
((http.host in {"bloxodes.com" "www.bloxodes.com"}) and ip.src.country eq "SG" and ip.src.asnum eq 45102 and lower(http.user_agent) eq "mozilla/5.0 (macintosh; intel mac os x 10_15_7) applewebkit/537.36 (khtml, like gecko) chrome/145.0.0.0 safari/537.36" and not cf.client.bot)
```

After saving, the browser navigated away from the editor to the server-side Cloudflare custom-rules list. That list showed the new name, complete expression, `Block` action, `Active` status, and the same rule ID. This confirms persistence and activation.

The 2026-07-27 follow-up save was verified the same way. The server-side list showed the shortened 277-character expression above, `Block`, and `Active`. The previous `GET`/`HEAD`, `/api/*`, and `/_next/*` clauses were absent.

## Why the rule is low risk

The rule requires every one of these conditions:

- Host is only `bloxodes.com` or `www.bloxodes.com`.
- Source country is Singapore.
- Source ASN is Alibaba AS45102.
- Exact observed browser user agent matches.
- Cloudflare does not identify the client as a verified bot.

Consequently, it does not apply to other VPS hostnames, normal users with a different fingerprint or network, unrelated Bloxodes API clients, or Cloudflare-verified search and AI crawlers. It does apply to API, Next.js asset, page, and other requests made by the exact matching scraper cohort on the two Bloxodes hostnames.

## Changes intentionally not made

- Bot Fight Mode remains off.
- No rate-limiting rule was added.
- No VPS firewall, listener, IP, Tunnel, reverse-proxy, Docker, Dokploy, or origin-authentication change was made.
- No DNS record was changed.
- No application code or database data was changed.
- No robots.txt, sitemap, SEO metadata, crawler policy, or AI crawler policy was changed.
- The other four Cloudflare custom rules were not edited.
- No broad Singapore, Alibaba ASN, browser, screen-size, or user-agent-only block was added. Country, ASN, and the exact user agent must all match.

## Verification

Immediate checks after activation:

| Check | Result |
| --- | --- |
| `https://bloxodes.com/` with a normal browser user agent | `200 text/html` |
| `https://www.bloxodes.com/` | `200`, redirected to the canonical hostname |
| `https://bloxodes.com/api/health` | `200 application/json` |
| Googlebot request to the home page | `200 text/html` |
| Bingbot request to the home page | `200 text/html` |
| GPTBot request to `/robots.txt` | `200 text/plain` |
| ChatGPT-User request to `/robots.txt` | `200 text/plain` |
| OAI-SearchBot request to `/sitemap.xml` | `200 application/xml` |
| `database.bloxodes.com` | Reachable; unauthenticated root correctly returned `401` |
| `media.bloxodes.com` | Reachable; unauthenticated root correctly returned `401` |
| `studio.bloxodes.com` | Reachable; unauthenticated root correctly returned `401` |
| `dokploy.ravitejaknts.com` | `200 text/html` |
| `vault.ravitejaknts.com` | `200 text/html` |
| `umami.ravitejaknts.com` | `200 text/html` |

The VPS container inventory was also read successfully after the change. The Bloxodes web, Supabase, Umami, Dokploy, Vaultwarden, Basebuddy, and other application containers remained running.

Before the corrected Block rule was saved, Cloudflare showed zero events for the rule and Umami continued recording the exact cohort. This exposed that the first editor save had not persisted.

After the corrected save, the Cloudflare server-side rules list confirmed the Block rule as Active. Immediate site, API, Googlebot, Bingbot, GPTBot, OAI-SearchBot, and Umami health checks continued to return their expected `200` responses.

Cloudflare then confirmed that the rule was actively blocking the targeted traffic:

- The mitigated count for the Singapore/Chrome/macOS cohort increased from `117` before activation to `263` immediately afterward.
- The rule-specific Security Events view populated `Block` events for rotating Alibaba addresses in both observed ranges.
- Examples recorded between 00:01:18 and 00:01:46 IST on 2026-07-27 included `43.119.100.182`, `43.119.100.230`, `43.119.100.244`, `47.82.201.44`, `47.82.201.201`, and many others.
- Each event was attributed to this custom rule ID and showed Country `Singapore`, Action `Block`, and Service `Custom rules`.

Follow-up verification after removing the exclusions:

- The server-side rule list showed the new expression, `Block`, and `Active`.
- The rule event total increased immediately from approximately `34.82k` to `35.29k`.
- Fresh Block events continued at 07:43 IST from both Alibaba ranges, including `43.119.100.*` and `47.82.201.*`.
- A sampled event showed the expected AS45102, Singapore, exact Chrome 145/macOS user agent, `bloxodes.com` host, and the same rule ID.
- Because the persisted rule no longer contains method or path predicates, matching API, Next.js, page, and other Bloxodes requests are all covered.
- A normal request to the home page returned `200 text/html`.
- A normal request to `/api/account/avatar` returned `200 application/json`.
- Googlebot and ChatGPT-User requests to `/robots.txt` returned `200 text/plain`.

Before the exclusions were removed, the exact Umami cohort remained nearly flat for 7.19 hours: approximately `112.5` pageviews per hour before the first rule activation and `111.8` afterward. Cloudflare simultaneously showed the same Alibaba scraper continuing through the explicitly allowed API and Next.js paths. This evidence prompted the 07:43 IST correction. Monitoring should now use traffic observed after that correction rather than the earlier incomplete-rule window.

## Monitoring and decision rule

Check Cloudflare rule events and the exact Umami cohort after one hour and again after 24 hours.

- If Cloudflare records blocks and the Umami cohort falls, leave the rule unchanged.
- If Cloudflare records no matches while Umami remains high, reopen the server-side rule and re-sample current Cloudflare requests before changing anything. Do not widen the rule based only on Umami.
- If legitimate Singapore users report problems, disable this rule immediately and inspect the matched events.

## Rollback

Preferred rollback:

1. Open custom rule ID `6c63fbc88a5b49bd8557d011b14603a6`.
2. Set Status to Disabled.
3. Save.

The previous rule can be reconstructed from the earlier change log if required, but restoring it is not recommended because it used the deprecated `cf.threat_score` field and had zero recorded events.

## References

- [Cloudflare custom rules](https://developers.cloudflare.com/waf/custom-rules/)
- [Cloudflare `ip.src.asnum` field](https://developers.cloudflare.com/ruleset-engine/rules-language/fields/reference/ip.src.asnum/)
- [Cloudflare verified-bot exception guidance](https://developers.cloudflare.com/waf/custom-rules/use-cases/allow-traffic-from-verified-bots/)
- [Earlier Bloxodes bot and infrastructure change log](./bot-traffic-infra-change-log-2026-07-02.md)
