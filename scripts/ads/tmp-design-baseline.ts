import { chromium, devices } from "playwright";
import fs from "node:fs";
import path from "node:path";

const OUT = "tmp/baseline";
const ORIGIN = "https://bloxodes.com";
const PAGES = [
  ["home", "/"],
  ["articles index", "/articles"],
  ["article", "/articles/steal-eggs-from-tsunami-beginner-guide"],
  ["article", "/articles/all-craftable-items-in-99-nights-in-the-forest-what-they-do"],
  ["wiki index", "/wiki"],
  ["Roblox wiki hub", "/wiki/blox-fruits"],
  ["Roblox collection", "/wiki/clash-of-critters/tataris"],
  ["Roblox collection", "/wiki/blox-fruits/fruits"],
  ["games index", "/games"],
  ["franchise game landing", "/games/minecraft"],
  ["franchise wiki hub", "/wiki/minecraft-java"],
  ["franchise collection", "/wiki/minecraft-java/music-discs"],
  ["franchise collection", "/wiki/minecraft-bedrock/items"],
  ["codes index", "/codes"],
  ["codes page (few)", "/codes/my-avatar"],
  ["codes page (many)", "/codes/blox-fruits"],
  ["catalog index", "/catalog"],
  ["catalog page", "/catalog/free-roblox-items"],
  ["music catalog", "/catalog/roblox-music-ids/trending"],
  ["tools index", "/tools"],
  ["calculator", "/tools/robux-to-usd-calculator"],
  ["planner or checker", "/tools/roblox-profile-checker"],
  ["stats home", "/stats"],
  ["stats game page", "/stats/games/blox-fruits-994732206"],
  ["stats rankings", "/stats/games"],
  ["stats creators", "/stats/creators"],
  ["stats items", "/stats/items"],
  ["checklists index", "/checklists"],
  ["checklist", "/checklists/grow-a-garden"],
  ["quizzes index", "/quizzes"],
  ["quiz", "/quizzes/blox-fruits"],
  ["events index", "/events"],
  ["event", "/events/blox-fruits"],
  ["map", "/maps/gta5"],
  ["map", "/maps/gta-san-andreas"],
  ["puzzles index", "/puzzles"],
  ["puzzle", "/puzzles/wordle"],
  ["author", "/authors/ravi-teja-knts"],
  ["legal/static", "/privacy-policy"]
] as const;
const routes = PAGES.map(([type, route]) => ({ type, path: route, url: new URL(route, ORIGIN).href }));
const mkdir = () => fs.mkdirSync(OUT, { recursive: true });

function publicRouteFiles(dir = "apps/web/src/app/(site)", root = "apps/web/src/app/(site)"): Array<{ file: string; route: string }> {
  if (!fs.existsSync(dir)) return [];
  const rows: Array<{ file: string; route: string }> = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) rows.push(...publicRouteFiles(full, root));
    else if (entry.isFile() && entry.name === "page.tsx") {
      const relative = path.relative(root, path.dirname(full)).split(path.sep).filter((part) => !/^\(.*\)$/.test(part));
      rows.push({ file: full, route: relative.length ? "/" + relative.join("/") : "/" });
    }
  }
  return rows.sort((a, b) => a.route.localeCompare(b.route));
}

function writeReport(raw: any) {
  const routeFiles = raw.publicRoutes || [];
  const basics = raw.basics || [];
  const house = raw.houseAds || [];
  const byKey = (rows: any[], key: string) => new Map(rows.map((row) => [row.path + "|" + row.device, row]));
  const basicMap = byKey(basics, "path");
  const houseMap = byKey(house, "path");
  const rows = (type: string, selector: (row: any) => string) => {
    const result = ["| Page type | URL | Device | Measured values |", "| --- | --- | --- | --- |"];
    for (const sample of raw.samples) {
      if (sample.type !== type) continue;
      for (const device of ["mobile", "desktop"]) {
        const row: any = basicMap.get(sample.path + "|" + device);
        result.push("| " + type + " | " + sample.url + " | " + device + " | " + (row ? selector(row) : "NOT MEASURED" + (raw.runnerBlocked ? ": " + raw.runnerBlocked : "")) + " | ");
      }
    }
    return result.join("\n");
  };
  const basicsTable = ["| Page type | URL | Device | Height px | DOM elements | Links | Overflow | HTML bytes (encoded / decoded) | JS bytes (all / excluding known ad scripts) | CSS bytes | Image bytes | Known ad-domain bytes | Requests (all / excluding known ad hosts) | First content px | Article body / tallest child px | Rail (width / height before sidebar ad px) |", "| --- | --- | --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |"];
  const adTable = ["| Page type | URL | Device | In-content | Sidebar | Sticky/anchor | Video | Total slots | First content ad px | Avg gap px | Largest gap px | Ads / 1,000 page px | Ads / phone screen | Above fold | Rail width / height before sidebar ad px | Tallest direct child px |", "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |"];
  const realTable = ["| Page type | URL | Device | Real slots | Filled slots | Runner location |", "| --- | --- | --- | ---: | ---: | --- |"];
  const speedTable = ["| Page type | URL | Device | Performance | LCP ms | CLS | TBT ms | FCP ms | Speed Index ms | Lighthouse saw ad scripts |", "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |"];
  const cruxTable = ["| Page type | URL | LCP p75 ms | INP p75 ms | CLS p75 | Availability |", "| --- | --- | ---: | ---: | ---: | --- |"];
  const median = (values: number[]) => {
    const sorted = values.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
    if (!sorted.length) return null;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };
  for (const sample of raw.samples) for (const device of ["mobile", "desktop"]) {
    const found = raw.speed?.lighthouseResults?.find((x: any) => x.path === sample.path && x.device === device);
    const runs = (found?.runs || []).filter((x: any) => !x.error && x.performanceScore != null);
    const value = (key: string) => median(runs.map((x: any) => x[key]).filter((x: any) => typeof x === "number"));
    speedTable.push("| " + sample.type + " | " + sample.url + " | " + device + " | " + (value("performanceScore") ?? found?.error ?? "NOT MEASURED") + " | " + (value("lcpMs") ?? "—") + " | " + (value("cls") ?? "—") + " | " + (value("tbtMs") ?? "—") + " | " + (value("fcpMs") ?? "—") + " | " + (value("speedIndexMs") ?? "—") + " | " + (runs.length ? runs.map((x: any) => String(x.lighthouseSawAdScripts)).join(", ") : "unknown") + " |");
  }
  for (const sample of raw.samples) {
    const c = raw.speed?.cruxUrlResults?.find((x: any) => x.path === sample.path);
    cruxTable.push("| " + sample.type + " | " + sample.url + " | " + (c?.metrics?.lcpMs ?? "—") + " | " + (c?.metrics?.inpMs ?? "—") + " | " + (c?.metrics?.cls ?? "—") + " | " + (c?.available ? "available" : (c?.error || "no field data")) + " |");
  }
  const worst: Array<{ score: number; text: string }> = [];
  for (const sample of raw.samples) for (const device of ["mobile", "desktop"]) {
    const row: any = basicMap.get(sample.path + "|" + device);
    const h: any = houseMap.get(sample.path + "|" + device);
    if (row) {
      const html = row.htmlBytes || {};
      const sizes = row.resourceBytes || {};
      const body = row.articleBody || {};
      const rail = row.rail || {};
      basicsTable.push("| " + sample.type + " | " + sample.url + " | " + device + " | " + (row.pageHeight ?? "—") + " | " + (row.elementCount ?? "—") + " | " + (row.linkCount ?? "—") + " | " + (row.horizontalOverflow ? "yes" : "no") + " | " + (html.compressed ?? "—") + " / " + (html.uncompressed ?? "—") + " | " + (sizes.js ?? "—") + " / " + (sizes.jsExcludingAdScripts ?? "—") + " | " + (sizes.css ?? "—") + " | " + (sizes.images ?? "—") + " | " + (sizes.adRelated ?? "—") + " | " + (row.totalRequests ?? "—") + " / " + (row.requestsExcludingKnownAdHosts ?? "—") + " | " + (row.firstMainContentTop ?? "—") + " | " + (body.exists ? (body.tallestDirectChild?.height ?? "—") : "no #article-body") + " | " + (rail.exists ? rail.width + " / " + (rail.heightBeforeFirstSidebarAd ?? "—") : "no rail") + " |");
      if (row.horizontalOverflow) worst.push({ score: 1000000, text: "Horizontal overflow on " + device + " at " + sample.url });
      if (typeof row.pageHeight === "number") worst.push({ score: row.pageHeight, text: "Page height " + row.pageHeight + "px on " + device + " at " + sample.url });
      if (typeof row.elementCount === "number") worst.push({ score: row.elementCount, text: "DOM elements " + row.elementCount + " on " + device + " at " + sample.url });
    }
    if (row) {
      const a = row.ads || {};
      const height = row.pageHeight || 0;
      const screens = device === "mobile" && height ? a.inContent / (height / (row.viewport?.height || 844)) : null;
      realTable.push("| " + sample.type + " | " + sample.url + " | " + device + " | " + (a.totalSlots ?? "—") + " | " + (a.filled ?? "—") + " | GitHub Actions runner | ");
      adTable.push("| " + sample.type + " | " + sample.url + " | " + device + " | " + (a.inContent ?? "—") + " | " + (a.sidebar ?? "—") + " | " + (a.stickyOrAnchor ?? "—") + " | " + (a.video ?? "—") + " | " + (a.totalSlots ?? "—") + " | " + (a.firstInContentTop ?? "—") + " | n/a: real-fill sample | n/a: use house-ad gaps | " + (height ? (a.totalSlots * 1000 / height).toFixed(4) : "—") + " | " + (screens == null ? "desktop n/a" : screens.toFixed(4)) + " | " + (a.aboveFold ?? "—") + " | " + (row.rail?.exists ? row.rail.width + " / " + (row.rail.heightBeforeFirstSidebarAd ?? "—") : "no rail") + " | " + (row.articleBody?.tallestDirectChild?.height ?? "no #article-body") + " |");
    } else {
      realTable.push("| " + sample.type + " | " + sample.url + " | " + device + " | NOT MEASURED | NOT MEASURED | " + (raw.runnerBlocked || "runner failed") + " | ");
      basicsTable.push("| " + sample.type + " | " + sample.url + " | " + device + " | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | — | — | — | — | — | — | — | — | — | — |");
      adTable.push("| " + sample.type + " | " + sample.url + " | " + device + " | NOT MEASURED | NOT MEASURED | — | — | — | — | — | — | — | — | — | — | — |");
    }
    if (h) {
      const c = h.counts || {};
      const tops = h.contentAdTops || [];
      const gaps = tops.slice(1).map((v: number, i: number) => v - tops[i]);
      const avgGap = gaps.length ? gaps.reduce((s: number, n: number) => s + n, 0) / gaps.length : null;
      const maxGap = gaps.length ? Math.max(...gaps) : null;
      const total = (c.contentRendered || 0) + (c.sidebar || 0) + (c.other?.length || 0);
      const height = h.docHeight || 0;
      const phone = device === "mobile" && h.docHeight ? (c.contentRendered || 0) / (height / 844) : null;
      const realAds = row?.ads || {};
      adTable.push("| " + sample.type + " | " + sample.url + " | " + device + " | " + (c.contentRendered ?? "—") + " | " + (c.sidebar ?? "—") + " | " + (realAds.stickyOrAnchor ?? "—") + " | " + (realAds.video ?? "—") + " | " + total + " | " + (h.firstContentAdTop ?? "—") + " | " + (avgGap == null ? "—" : avgGap.toFixed(2)) + " | " + (maxGap ?? "—") + " | " + (height ? (c.contentRendered * 1000 / height).toFixed(4) : "—") + " | " + (phone == null ? "desktop n/a" : phone.toFixed(4)) + " | " + (tops.filter((v: number) => v < (device === "mobile" ? 844 : 900)).length) + " | " + (row?.rail?.exists ? row.rail.width + " / " + (row.rail.heightBeforeFirstSidebarAd ?? "—") : "no rail") + " | " + (row?.articleBody?.tallestDirectChild?.height ?? "no #article-body") + " |");
      if (h.breakIssues?.length) worst.push({ score: 900000, text: "Ad row break issue(s) " + h.breakIssues.length + " at " + sample.url + " (" + device + ")" });
      if (h.tallBlocks?.length) worst.push({ score: 800000 + Math.max(...h.tallBlocks.map((b: any) => b.h)), text: "Tall direct content block(s) " + h.tallBlocks.length + ", tallest " + Math.max(...h.tallBlocks.map((b: any) => b.h)) + "px at " + sample.url + " (" + device + ")" });
      if (device === "desktop" && h.sidebar && h.sidebar.w < 300) worst.push({ score: 990000, text: "Sidebar only " + h.sidebar.w + "px at " + sample.url });
      if (maxGap) worst.push({ score: maxGap, text: "Largest house-ad gap " + maxGap + "px at " + sample.url + " (" + device + ")" });
      if (h.articleBodyCount === 0) worst.push({ score: 500000, text: "No #article-body; direct-child ad stream not measured at " + sample.url + " (" + device + ")" });
    } else if (raw.houseAdsSkipped) {
      adTable.push("| " + sample.type + " | " + sample.url + " | " + device + " | SKIPPED: " + raw.houseAdsSkipped + " | — | — | — | — | — | — | — | — | — | — | — | — |");
    } else {
      adTable.push("| " + sample.type + " | " + sample.url + " | " + device + " | NOT MEASURED | NOT MEASURED | — | — | — | — | — | — | — | — | — | — | — |");
    }
  }
  const lines = [
    "# Live-site design baseline",
    "",
    "Measured " + raw.date + " from " + raw.runner + ". Production branch commit recorded: " + (raw.productionCommit || "not available") + ".",
    "",
    "Real-fill ads are one sample from the GitHub runner location. The house-ad audit uses ?test=houseads. A missing house-ad row means that audit was skipped or failed; see the raw JSON.",
    "",
    "## Sampled URLs",
    "",
    "| Page type | URL |",
    "| --- | --- |",
    ...raw.samples.map((s: any) => "| " + s.type + " | " + s.url + " |"),
    "",
    "## Real-fill ads and page basics",
    "",
    realTable.join("\n"),
    "",
    basicsTable.join("\n"),
    "",
    "Resource sizes use Performance Resource Timing. Cross-origin byte totals may be zero when the host does not send Timing-Allow-Origin. JS excluding known ad domains is retained in JSON.",
    "",
    "## House-ad placements (?test=houseads)",
    "",
    "House-ad counts and positions come from the test query. Sticky/video and rail measurements come from the matching no-query sample; the live ad type is identified by DOM selectors.",
    "",
    adTable.join("\n"),
    "",
    "## Lighthouse and field data",
    "",
    "Three-run Lighthouse sampling was not completed. A single no-key availability probe returned: " + (raw.speed?.pagespeedApiNoKey?.error || "success; per-page Lighthouse runs still need to be started"),
    "",
    speedTable.join("\n"),
    "",
    "CrUX origin p75: " + JSON.stringify(raw.speed?.cruxOrigin || null) + (raw.speed?.cruxOriginError ? "; " + raw.speed.cruxOriginError : ""),
    "",
    cruxTable.join("\n"),
    "",
    "## Public route files and page templates",
    "",
    "There are " + routeFiles.length + " distinct page route templates under apps/web/src/app/(site)/ and " + new Set(raw.samples.map((s: any) => s.type)).size + " sampled page-type labels.",
    "",
    "| Route | Page file |",
    "| --- | --- |",
    ...routeFiles.map((r: any) => "| " + r.route + " | " + r.file + " |"),
    "",
    "## Worst 10 observed issues or largest values",
    "",
    ...(worst.length ? worst.sort((a, b) => b.score - a.score).slice(0, 10).map((x, i) => (i + 1) + ". " + x.text) : ["No quantitative warnings were generated; check the raw run status for unavailable metrics."]),
    "",
    "## Runner/API failures and limits",
    "",
    "- Browser runner block: " + (raw.runnerBlocked || "none detected in the first measured URL/device pair"),
    "- PageSpeed Insights: " + (raw.speed?.pagespeedApiNoKey?.error || "first probe succeeded"),
    "- CrUX: " + (raw.speed?.cruxOriginError || "origin request succeeded"),
    ""
  ];
  fs.writeFileSync(path.join(OUT, "baseline.md"), lines.join("\n"));
}

async function prepare() {
  mkdir();
  fs.writeFileSync(path.join(OUT, "urls.txt"), routes.map((x) => x.url).join("\n") + "\n");
  fs.writeFileSync(path.join(OUT, "paths.txt"), routes.map((x) => x.path).join("\n") + "\n");
  fs.writeFileSync(path.join(OUT, "samples.json"), JSON.stringify(routes, null, 2) + "\n");
  console.log("Prepared " + routes.length + " exact sitemap URLs.");
}

async function collectOne(browser: any, sample: any, device: "mobile" | "desktop") {
  const context = device === "mobile"
    ? await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
    : await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const requested: string[] = [];
  const responseList: any[] = [];
  page.on("request", (req: any) => requested.push(req.url()));
  page.on("response", (res: any) => responseList.push({ url: res.url(), status: res.status(), type: res.headers()["content-type"] || "" }));
  await page.addInitScript(() => {
    const w = window as any;
    w.__baselineAdEvents = [];
    w.googletag = w.googletag || { cmd: [] };
    w.googletag.cmd.push(() => {
      w.googletag.pubads().addEventListener("slotRequested", (e: any) => w.__baselineAdEvents.push({ kind: "request", id: e.slot.getSlotElementId() }));
      w.googletag.pubads().addEventListener("slotRenderEnded", (e: any) => w.__baselineAdEvents.push({ kind: "render", id: e.slot.getSlotElementId(), empty: e.isEmpty }));
    });
  });
  let status = 0;
  try {
    status = (await page.goto(sample.url, { waitUntil: "domcontentloaded", timeout: 90000 }))?.status() || 0;
    await page.waitForTimeout(3000);
    let oldHeight = 0;
    for (let pass = 0; pass < 3; pass += 1) {
      const h = await page.evaluate(() => document.documentElement.scrollHeight);
      const step = await page.evaluate(() => Math.max(320, Math.round(innerHeight * 0.65)));
      for (let y = 0; y <= h; y += step) {
        await page.evaluate((top) => scrollTo(0, top), y);
        await page.waitForTimeout(220);
      }
      await page.waitForTimeout(1800);
      const newHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      if (newHeight === h && h === oldHeight) break;
      oldHeight = newHeight;
    }
    await page.evaluate(() => scrollTo(0, 0));
    const data = await page.evaluate((sidebarSelector) => {
      const r = (el: Element) => {
        const x = el.getBoundingClientRect();
        return { top: Math.round(x.top + scrollY), width: Math.round(x.width), height: Math.round(x.height), bottom: Math.round(x.bottom + scrollY) };
      };
      const visible = (el: Element) => { const x = el.getBoundingClientRect(); return x.width > 0 && x.height > 0; };
      const body = document.querySelector("#article-body");
      const kids = body ? Array.from(body.children) : [];
      const tallest = kids.map((el) => ({ ...r(el), tag: el.tagName.toLowerCase() })).sort((a, b) => b.height - a.height)[0] || null;
      const rail = document.querySelector(sidebarSelector);
      const inAds = body ? Array.from(body.querySelectorAll(".adunitwrapper")) : [];
      const sideAds = rail ? Array.from(rail.querySelectorAll(".adunitwrapper")) : [];
      const ads = Array.from(document.querySelectorAll(".adunitwrapper"));
      const fixed = Array.from(document.querySelectorAll("body *")).filter((el) => {
        const c = getComputedStyle(el);
        return (c.position === "fixed" || c.position === "sticky") && /ad|anchor|video|mv-/i.test(String(el.id) + " " + String(el.className)) && visible(el);
      });
      const video = Array.from(document.querySelectorAll("video, iframe[src*='ad'], [id*='video'], [class*='video']"))
        .filter((el) => /mv|ad|mediavine|adthrive/i.test(String(el.id) + " " + String(el.className) + " " + ((el as HTMLIFrameElement).src || "")) && visible(el));
      const main = document.querySelector("main");
      const first = main ? Array.from(main.querySelectorAll("[data-journey-item], p, table tbody tr, ul li, article"))
        .filter(visible).filter((el) => (el.textContent || "").trim()).sort((a, b) => r(a).top - r(b).top)[0] || null : null;
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
      const sizes = { js: 0, css: 0, images: 0, adRelated: 0, jsExcludingAdScripts: 0, requestsInTiming: resources.length };
      for (const e of resources) {
        const u = e.name.toLowerCase();
        const n = e.decodedBodySize || e.encodedBodySize || 0;
        const ad = /mediavine|adthrive|googlesyndication|doubleclick|amazon-adsystem|adnxs|criteo/.test(u);
        if (/\.m?js(?:\?|$)/.test(u) || e.initiatorType === "script") { sizes.js += n; if (!ad) sizes.jsExcludingAdScripts += n; }
        if (/\.css(?:\?|$)/.test(u) || e.initiatorType === "css") sizes.css += n;
        if (/\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/.test(u) || e.initiatorType === "img") sizes.images += n;
        if (ad) sizes.adRelated += n;
      }
      const allEvents = (window as any).__baselineAdEvents || [];
      const rendered = new Map<string, boolean>();
      for (const e of allEvents) if (e.kind === "render") rendered.set(e.id, !e.empty);
      const fallbackFilled = ads.filter((el) => el.querySelector("iframe,video,[data-google-query-id]")).length;
      const sticky = new Set(fixed.filter((el) => el.matches(".adunitwrapper,.mv-ad-box,iframe") || el.querySelector(".adunitwrapper,iframe,video")));
      const adTop = (el: Element) => r(el).top;
      const contentAdsAboveFold = ads.filter((el) => adTop(el) < innerHeight && r(el).bottom > 0).length;
      const aboveRailAd = sideAds.length && rail ? Math.max(0, r(sideAds[0]).top - r(rail).top) : rail ? r(rail).height : null;
      const txt = document.title + " " + document.body.innerText.slice(0, 1200);
      return {
        title: document.title,
        cloudflareChallenge: /just a moment|checking your browser|cloudflare ray id/i.test(txt),
        pageHeight: document.documentElement.scrollHeight,
        viewport: { width: innerWidth, height: innerHeight },
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
        elementCount: document.querySelectorAll("*").length,
        linkCount: document.querySelectorAll("a[href]").length,
        articleBody: body ? { exists: true, ...r(body), directChildren: kids.length, tallestDirectChild: tallest } : { exists: false, height: null, directChildren: 0, tallestDirectChild: null },
        firstMainContentTop: first ? r(first).top : null,
        rail: rail ? { exists: true, width: r(rail).width, height: r(rail).height, heightBeforeFirstSidebarAd: aboveRailAd } : { exists: false, width: null, height: null, heightBeforeFirstSidebarAd: null },
        ads: {
          inContent: inAds.length,
          sidebar: sideAds.length,
          other: ads.filter((el) => !body?.contains(el) && !rail?.contains(el)).length,
          stickyOrAnchor: sticky.size,
          video: video.length,
          totalSlots: ads.length,
          filled: rendered.size ? Array.from(rendered.values()).filter(Boolean).length : fallbackFilled,
          fillSignal: rendered.size ? "GPT render events" : "DOM iframe heuristic",
          aboveFold: contentAdsAboveFold,
          firstInContentTop: inAds.length ? adTop(inAds[0]) : null,
          inContentTops: inAds.map(adTop),
          hasStickyAnchor: sticky.size > 0,
          hasVideoAd: video.length > 0
        },
        htmlBytes: { compressed: nav?.encodedBodySize ?? null, uncompressed: nav?.decodedBodySize ?? null, serializedDom: new TextEncoder().encode(document.documentElement.outerHTML).length },
        resourceBytes: sizes,
        totalRequests: requested.length,
        navTiming: nav ? { responseStart: Math.round(nav.responseStart), domContentLoaded: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd) } : null
      };
    }, "aside.space-y-4");
    const adEvents = await page.evaluate(() => (window as any).__baselineAdEvents || []);
    const knownAd = (url: string) => /mediavine|adthrive|googlesyndication|doubleclick|amazon-adsystem|adnxs|criteo/i.test(url);
    return { type: sample.type, path: sample.path, url: sample.url, device, httpStatus: status, ...data, requestsExcludingKnownAdHosts: Math.max(0, requested.length - requested.filter(knownAd).length), knownAdHostRequests: requested.filter(knownAd).length, adEvents, responseStatuses: responseList };
  } catch (error) {
    return { type: sample.type, path: sample.path, url: sample.url, device, httpStatus: status, error: String(error).slice(0, 500), responseStatuses: responseList };
  } finally {
    await context.close();
  }
}

async function apiJson(url: string, init?: RequestInit) {
  try {
    const r = await fetch(url, init);
    return { status: r.status, ok: r.ok, body: await r.json().catch(() => null) };
  } catch (e) { return { status: 0, ok: false, body: { error: String(e) } }; }
}

async function collect() {
  mkdir();
  const basics: any[] = [];
  let challenge: string | null = null;
  const browser = await chromium.launch({ headless: true });
  try {
    for (const sample of routes) {
      for (const device of ["mobile", "desktop"] as const) {
        const result = await collectOne(browser, sample, device);
        basics.push(result);
        console.log(device + " " + sample.path + " HTTP " + result.httpStatus + (result.cloudflareChallenge ? " CLOUDFLARE CHALLENGE" : "") + (result.error ? " ERROR " + result.error : ""));
        if (result.cloudflareChallenge || result.httpStatus === 403) {
          challenge = device + " " + sample.path + " HTTP " + result.httpStatus + " title=" + (result.title || "unavailable") + " cloudflareChallenge=" + Boolean(result.cloudflareChallenge);
          break;
        }
      }
      if (challenge) break;
    }
  } finally { await browser.close(); }

  const psiTestUrl = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  psiTestUrl.searchParams.set("url", routes[0].url);
  psiTestUrl.searchParams.set("strategy", "mobile");
  psiTestUrl.searchParams.set("category", "performance");
  const psiTest = await apiJson(psiTestUrl.href);
  const psiFailure = psiTest.ok ? null : "PageSpeed Insights " + psiTest.status + ": " + (psiTest.body?.error?.message || "request failed");
  const cruxTest = await apiJson("https://chromeuxreport.googleapis.com/v1/records:queryRecord", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ origin: ORIGIN })
  });
  const cruxFailure = cruxTest.ok ? null : "CrUX " + cruxTest.status + ": " + (cruxTest.body?.error?.message || "request failed");
  const raw = {
    date: new Date().toISOString(),
    site: ORIGIN,
    productionCommit: process.env.PRODUCTION_COMMIT_SHA || null,
    runner: process.env.GITHUB_RUNNER_OS ? process.env.GITHUB_RUNNER_OS + "/" + process.env.RUNNER_ARCH : "GitHub Actions runner",
    runnerBlocked: challenge,
    samples: routes,
    publicRoutes: publicRouteFiles(),
    basics,
    houseAds: fs.existsSync(path.join(OUT, "houseads", "results.json")) ? JSON.parse(fs.readFileSync(path.join(OUT, "houseads", "results.json"), "utf8")) : [],
    houseAdsSkipped: fs.existsSync(path.join(OUT, "houseads-skipped.txt")) ? fs.readFileSync(path.join(OUT, "houseads-skipped.txt"), "utf8").trim() : null,
    speed: { pagespeedApiNoKey: psiFailure ? { available: false, error: psiFailure, firstProbeStatus: psiTest.status, firstProbeBody: psiTest.body } : { available: true, firstResponse: psiTest.body }, lighthouseRunsRequestedPerUrlAndDevice: 3, lighthouseRunsCompleted: 0, lighthouseResults: routes.flatMap((s) => ["mobile", "desktop"].map((device) => ({ path: s.path, device, runs: [], error: psiFailure || "Only one no-key preflight request was made; three-run PSI sampling was not started" }))), cruxOrigin: cruxTest.ok ? { lcpMs: cruxTest.body?.record?.metrics?.largest_contentful_paint?.percentiles?.p75 ?? null, inpMs: cruxTest.body?.record?.metrics?.interaction_to_next_paint?.percentiles?.p75 ?? null, cls: cruxTest.body?.record?.metrics?.cumulative_layout_shift?.percentiles?.p75 ?? null } : null, cruxOriginError: cruxFailure, cruxUrlResults: routes.map((s) => ({ path: s.path, available: false, error: cruxFailure || "Origin query succeeded, URL record not queried" })) },
    notes: [
      "All live browser measurements are from the GitHub Actions runner, with no test query for the real-fill sample.",
      "The separate house-ad run uses ?test=houseads.",
      "PageSpeed Insights and CrUX APIs were probed without a key; API access errors are retained exactly.",
      "Cross-origin resource timing bytes can be absent when the resource does not grant Timing-Allow-Origin."
    ]
  };
  fs.writeFileSync(path.join(OUT, "baseline.json"), JSON.stringify(raw, null, 2) + "\n");
  writeReport(raw);
  fs.copyFileSync(".github/workflows/tmp-design-baseline.yml", path.join(OUT, "tmp-design-baseline.yml"));
  console.log("Wrote " + path.join(OUT, "baseline.json"));
}

if (process.argv.includes("--prepare")) prepare().catch((e) => { console.error(e); process.exitCode = 1; });
else if (process.argv.includes("--collect")) collect().catch((e) => { console.error(e); process.exitCode = 1; });
else { console.error("Pass --prepare or --collect"); process.exitCode = 2; }

