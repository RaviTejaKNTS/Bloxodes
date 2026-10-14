/**
 * Ad slot audit: loads pages with Mediavine house ads (`?test=houseads`) and reports where
 * every ad lands, whether card rows break cleanly, and which content blocks are too tall
 * for in-content ads.
 *
 * Mediavine only runs on bloxodes.com, so local servers are tested through a proxy: the
 * browser opens https://bloxodes.com/<path> and every bloxodes.com request is answered by
 * --base-url. Dev builds don't render the ad script, so the proxy injects it.
 *
 *   npx tsx scripts/ads/audit-ad-slots.ts --base-url http://127.0.0.1:3210 --paths /,/codes
 *   npx tsx scripts/ads/audit-ad-slots.ts --paths-file tmp/ads/paths.txt --devices desktop --out tmp/ads/run1
 *
 * Omit --base-url to audit production directly.
 *
 * --after-hydration loads the ad script only once React has hydrated, which matches the
 * production loader (next/script afterInteractive). Without it, dev builds get the script
 * before hydration. Proxied runs block every non-GET request to the site, so a local server
 * reading production data stays read-only. Production runs (no --base-url) aren't proxied.
 */
import { chromium, devices, type Browser, type BrowserContext, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const SITE_ORIGIN = "https://bloxodes.com";
const MEDIAVINE_SCRIPT_SRC = "https://scripts.mediavine.com/tags/75d9ab7d-268c-4e03-bb6c-180ca4b8d5ed.js";
// Mediavine's live sidebar selector (dashboard config). Keep in sync if the network changes it.
const SIDEBAR_SELECTOR = "aside.space-y-4";

type DeviceName = "desktop" | "mobile";

type Args = {
  baseUrl: string | null;
  paths: string[];
  devices: DeviceName[];
  out: string;
  screenshots: boolean;
  settleMs: number;
  afterHydration: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    baseUrl: null,
    paths: [],
    devices: ["desktop", "mobile"],
    out: path.join("tmp", "ads", `audit-${new Date().toISOString().replace(/[:.]/g, "-")}`),
    screenshots: false,
    settleMs: 4000,
    afterHydration: false
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    switch (flag) {
      case "--base-url":
        args.baseUrl = value.replace(/\/$/, "");
        i += 1;
        break;
      case "--paths":
        args.paths.push(...value.split(",").map((p) => p.trim()).filter(Boolean));
        i += 1;
        break;
      case "--paths-file":
        args.paths.push(
          ...fs
            .readFileSync(value, "utf8")
            .split("\n")
            .map((line) => line.replace(/#.*/, "").trim())
            .filter(Boolean)
        );
        i += 1;
        break;
      case "--devices":
        args.devices = value.split(",").map((d) => d.trim()) as DeviceName[];
        i += 1;
        break;
      case "--out":
        args.out = value;
        i += 1;
        break;
      case "--screenshots":
        args.screenshots = true;
        break;
      case "--after-hydration":
        args.afterHydration = true;
        break;
      case "--settle-ms":
        args.settleMs = Number(value);
        i += 1;
        break;
      default:
        throw new Error(`Unknown flag: ${flag}`);
    }
  }
  if (!args.paths.length) throw new Error("Pass --paths or --paths-file.");
  if (args.baseUrl && /bloxodes\.com$/.test(new URL(args.baseUrl).hostname)) args.baseUrl = null;
  return args;
}

async function newContext(
  browser: Browser,
  device: DeviceName,
  baseUrl: string | null,
  afterHydration: boolean
): Promise<BrowserContext> {
  const context =
    device === "mobile"
      ? await browser.newContext({ ...devices["iPhone 13"], deviceScaleFactor: 1 })
      : await browser.newContext({
          viewport: { width: 1440, height: 900 },
          userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
        });
  // tsx keeps function names with an `__name` helper that doesn't exist inside the page.
  await context.addInitScript({ content: "window.__name = window.__name || ((fn) => fn);" });

  if (baseUrl) {
    // Forward the dev server's socket too: Turbopack needs its first messages before the page hydrates.
    await context.routeWebSocket(/\/_next\/webpack-hmr/, (ws) => {
      const url = new URL(ws.url());
      const upstream = new WebSocket(baseUrl.replace(/^http/, "ws") + url.pathname + url.search);
      upstream.binaryType = "arraybuffer";
      const pending: Array<string | Buffer> = [];
      ws.onMessage((message) => {
        if (upstream.readyState === WebSocket.OPEN) upstream.send(message);
        else pending.push(message);
      });
      upstream.addEventListener("open", () => {
        for (const message of pending.splice(0)) upstream.send(message);
      });
      upstream.addEventListener("message", (event) =>
        ws.send(event.data instanceof ArrayBuffer ? Buffer.from(event.data) : String(event.data))
      );
      upstream.addEventListener("error", () => {});
      ws.onClose(() => upstream.close());
    });
    await context.route(`${SITE_ORIGIN}/**`, async (route) => {
      const request = route.request();
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
        await route.abort();
        return;
      }
      const target = baseUrl + request.url().slice(SITE_ORIGIN.length);
      let response;
      try {
        response = await route.fetch({ url: target, maxRedirects: 0, timeout: 300_000 });
      } catch {
        await route.abort();
        return;
      }
      const headers = { ...response.headers() };
      const location = headers.location;
      if (location?.startsWith(baseUrl)) headers.location = SITE_ORIGIN + location.slice(baseUrl.length);
      if (request.resourceType() === "document" && (headers["content-type"] ?? "").includes("text/html")) {
        let body = await response.text();
        if (!afterHydration && !body.includes("scripts.mediavine.com/tags/")) {
          body = body.replace(
            "</head>",
            `<script async data-noptimize="1" data-cfasync="false" src="${MEDIAVINE_SCRIPT_SRC}"></script></head>`
          );
        }
        delete headers["content-length"];
        await route.fulfill({ status: response.status(), headers, body });
        return;
      }
      await route.fulfill({ response, headers });
    });
  }
  return context;
}

async function instrument(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __adEvents: Array<[number, string, string]> };
    w.__adEvents = [];
    const log = (kind: string, detail: string) => w.__adEvents.push([Math.round(performance.now()), kind, detail]);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (!(node instanceof HTMLElement)) continue;
          const wrapper = node.classList.contains("adunitwrapper") ? node : node.querySelector?.(".adunitwrapper");
          if (wrapper && !w.__adEvents.some((e) => e[1] === "insert" && e[2] === wrapper.id)) log("insert", wrapper.id);
        }
      }
    });
    observer.observe(document, { childList: true, subtree: true });
    const g = window as unknown as { googletag?: { cmd: Array<() => void>; pubads: () => any } };
    g.googletag = g.googletag || ({ cmd: [] } as never);
    g.googletag!.cmd = g.googletag!.cmd || [];
    g.googletag!.cmd.push(() => {
      g.googletag!.pubads().addEventListener("slotRequested", (e: any) => log("request", e.slot.getSlotElementId()));
      g.googletag!.pubads().addEventListener("slotRenderEnded", (e: any) =>
        log("render", `${e.slot.getSlotElementId()}${e.isEmpty ? " EMPTY" : ""}`)
      );
    });
  });
}

async function scrollThrough(page: Page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = await page.evaluate(() => Math.round(window.innerHeight * 0.6));
  for (let y = 0; y <= height + step; y += step) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(300);
  }
  // Mediavine adds sticky sidebar units and late lazy slots after the first pass.
  await page.waitForTimeout(3000);
  const finalHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = height; y <= finalHeight + step; y += step) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(1500);
}

type PageReport = Awaited<ReturnType<typeof measure>>;

async function measure(page: Page, sidebarSelector: string) {
  return page.evaluate((sidebarSel) => {
    const abs = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top + window.scrollY), left: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) };
    };
    const label = (el: Element) => {
      const cls = String((el as HTMLElement).className || "").split(/\s+/).filter(Boolean).slice(0, 3).join(".");
      const text = ((el as HTMLElement).innerText || "").trim().replace(/\s+/g, " ").slice(0, 48);
      return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${cls ? `.${cls}` : ""} "${text}"`;
    };
    const isAdNode = (el: Element) =>
      el.classList.contains("mv-ad-box") ||
      el.classList.contains("adunitwrapper") ||
      !!el.querySelector(":scope > .adunitwrapper, :scope > .mv-ad-box, :scope .adunitwrapper") ||
      /(^|\s)mv-/.test(String((el as HTMLElement).className || ""));

    const bodies = Array.from(document.querySelectorAll("#article-body"));
    const body = bodies[0] ?? null;
    const sidebars = Array.from(document.querySelectorAll(sidebarSel));
    const sidebar = sidebars[0] ?? null;
    const vh = window.innerHeight;

    const units = Array.from(document.querySelectorAll(".adunitwrapper")).map((el) => {
      const box = el.closest(".mv-ad-box") ?? el;
      const rect = abs(el);
      const boxRect = abs(box);
      let where: "content" | "sidebar" | "other" = "other";
      if (sidebar?.contains(el)) where = "sidebar";
      else if (body?.contains(el)) where = "content";
      return { id: el.id, where, ...rect, boxTop: boxRect.top, boxH: boxRect.h, boxW: boxRect.w, rendered: rect.h > 0 && rect.w > 0 };
    });

    // Direct children of the ad stream, excluding the ad boxes themselves.
    const kids = body ? Array.from(body.children) : [];
    const contentKids = kids.filter((k) => !isAdNode(k));
    const tallBlocks = contentKids
      .map((k) => ({ ...abs(k), label: label(k) }))
      .filter((k) => k.h > vh * 1.5)
      .map((k) => ({ top: k.top, h: k.h, label: k.label }));

    // Clean-break check: an in-content ad must sit alone on its row, and the row above it
    // must be complete whenever more cards follow the ad.
    let columns = 1;
    if (body) {
      const cs = getComputedStyle(body);
      if (cs.display === "grid") columns = cs.gridTemplateColumns.split(" ").filter(Boolean).length || 1;
    }
    const contentAds = units.filter((u) => u.where === "content");
    const breakIssues: string[] = [];
    for (const kid of kids.filter(isAdNode)) {
      const adRect = abs(kid);
      if (adRect.h === 0) continue;
      const sharing = contentKids.filter((c) => {
        const r = abs(c);
        return r.h > 0 && r.top < adRect.top + adRect.h - 2 && r.top + r.h > adRect.top + 2;
      });
      if (sharing.length) breakIssues.push(`ad at ${adRect.top} shares its row with ${sharing.length} block(s): ${label(sharing[0])}`);
      if (adRect.w < (body?.getBoundingClientRect().width ?? 0) - 4 && columns > 1) {
        breakIssues.push(`ad at ${adRect.top} is not full width (${adRect.w}px)`);
      }
      if (columns > 1) {
        const above = contentKids.filter((c) => {
          const r = abs(c);
          return r.h > 0 && r.top + r.h <= adRect.top + 2;
        });
        const lastRowTop = Math.max(...above.map((c) => abs(c).top), -1);
        const lastRow = above.filter((c) => Math.abs(abs(c).top - lastRowTop) < 4);
        // The block that visually follows the ad. A partial row is only a broken row when
        // cards continue right after the ad; a section ending early is fine.
        const below = contentKids
          .filter((c) => abs(c).h > 0 && abs(c).top >= adRect.top + adRect.h - 2)
          .sort((a, b) => abs(a).top - abs(b).top || abs(a).left - abs(b).left)[0];
        const lastRowAreCards = lastRow.length && lastRow.every((c) => c.hasAttribute("data-journey-item"));
        if (lastRowAreCards && lastRow.length < columns && below?.hasAttribute("data-journey-item")) {
          breakIssues.push(`ad at ${adRect.top} splits a card row (${lastRow.length}/${columns} cards above, cards continue below)`);
        }
      }
    }

    const tops = contentAds.filter((u) => u.rendered).map((u) => u.boxTop).sort((a, b) => a - b);
    const bodyRect = body ? abs(body) : null;
    const gaps: number[] = [];
    if (bodyRect) {
      const points = [bodyRect.top, ...tops, bodyRect.top + bodyRect.h];
      for (let i = 1; i < points.length; i += 1) gaps.push(points[i] - points[i - 1]);
    }

    const sidebarRect = sidebar ? abs(sidebar) : null;
    const sidebarOwnContent = sidebar
      ? Array.from(sidebar.children).filter((c) => !isAdNode(c) && !c.querySelector(".adunitwrapper"))
      : [];
    const sidebarContentEnd = sidebarOwnContent.length
      ? Math.max(...sidebarOwnContent.map((c) => abs(c).top + abs(c).h))
      : sidebarRect?.top ?? null;

    const errors = (window as unknown as { __adEvents: Array<[number, string, string]> }).__adEvents;
    const firstInsert = errors.find((e) => e[1] === "insert")?.[0] ?? null;
    const firstRequest = errors.find((e) => e[1] === "request")?.[0] ?? null;
    const empty = errors.filter((e) => e[1] === "render" && e[2].endsWith("EMPTY")).length;

    return {
      title: document.title,
      status: document.querySelector('meta[name="robots"][content*="noindex"]') ? "noindex" : "ok",
      docHeight: document.documentElement.scrollHeight,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      articleBodyCount: bodies.length,
      articleBody: bodyRect,
      articleBodyDisplay: body ? getComputedStyle(body).display : null,
      columns,
      directChildren: contentKids.length,
      tallBlocks,
      sidebarCount: sidebars.length,
      sidebar: sidebarRect,
      sidebarInsideArticleBody: !!(sidebar && body?.contains(sidebar)),
      sidebarContentEnd,
      counts: {
        content: contentAds.length,
        contentRendered: contentAds.filter((u) => u.rendered).length,
        sidebar: units.filter((u) => u.where === "sidebar").length,
        other: units.filter((u) => u.where === "other").map((u) => u.id)
      },
      contentAdTops: tops,
      firstContentAdTop: tops[0] ?? null,
      maxGapPx: gaps.length ? Math.max(...gaps) : null,
      maxGapViewports: gaps.length ? Math.round((Math.max(...gaps) / vh) * 10) / 10 : null,
      sidebarAdTops: units.filter((u) => u.where === "sidebar").map((u) => u.boxTop),
      breakIssues,
      timing: { firstInsertMs: firstInsert, firstRequestMs: firstRequest, emptyRenders: empty },
      units
    };
  }, sidebarSelector);
}

async function auditPath(browser: Browser, args: Args, device: DeviceName, pagePath: string) {
  const context = await newContext(browser, device, args.baseUrl, args.afterHydration);
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => consoleErrors.push(String(error).slice(0, 2000)));
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && /hydrat|Minified React error #4(18|19|21|23|25)/i.test(text)) {
      consoleErrors.push(text.slice(0, 2000));
    }
  });
  await instrument(page);
  const separator = pagePath.includes("?") ? "&" : "?";
  const url = `${SITE_ORIGIN}${pagePath}${separator}test=houseads`;
  let httpStatus = 0;
  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 300_000 });
    httpStatus = response?.status() ?? 0;
    if (args.afterHydration) {
      // React attaches __reactProps$ to interactive elements once they hydrate.
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll("button,input,select,a")].some((el) =>
            Object.keys(el).some((key) => key.startsWith("__reactProps$"))
          ),
        undefined,
        { timeout: 120_000 }
      );
      await page.waitForTimeout(1500);
      await page.addScriptTag({ url: MEDIAVINE_SCRIPT_SRC });
    }
    await page.waitForTimeout(args.settleMs);
    await scrollThrough(page);
    const report = await measure(page, SIDEBAR_SELECTOR);
    const shots: string[] = [];
    if (args.screenshots) {
      const dir = path.join(args.out, "shots");
      fs.mkdirSync(dir, { recursive: true });
      const slug = `${device}${pagePath.replace(/[^a-z0-9]+/gi, "_")}`.slice(0, 120);
      const viewport = page.viewportSize()!;
      const targets = report.units.filter((u) => u.where === "content" && u.boxH > 0).slice(0, 6);
      for (const [index, unit] of targets.entries()) {
        await page.evaluate((top) => window.scrollTo(0, Math.max(0, top - 350)), unit.boxTop);
        await page.waitForTimeout(250);
        const file = path.join(dir, `${slug}_ad${index + 1}.png`);
        await page.screenshot({ path: file, clip: { x: 0, y: 0, width: viewport.width, height: viewport.height } });
        shots.push(file);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(250);
      const top = path.join(dir, `${slug}_top.png`);
      await page.screenshot({ path: top });
      shots.push(top);
    }
    return { path: pagePath, device, httpStatus, ...report, consoleErrors, shots };
  } catch (error) {
    return { path: pagePath, device, httpStatus, error: String(error).slice(0, 300), consoleErrors };
  } finally {
    await context.close();
  }
}

function summarize(results: Array<Record<string, any>>) {
  const lines = [
    "| Page | Device | In-content | Sidebar | Other | First ad | Max gap (screens) | Tall blocks | Clean breaks | Notes |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |"
  ];
  for (const r of results) {
    if (r.error) {
      lines.push(`| ${r.path} | ${r.device} | — | — | — | — | — | — | — | ERROR ${r.error.slice(0, 80)} |`);
      continue;
    }
    const notes: string[] = [];
    if (r.httpStatus !== 200) notes.push(`HTTP ${r.httpStatus}`);
    if (r.articleBodyCount !== 1) notes.push(`#article-body x${r.articleBodyCount}`);
    if (r.sidebarInsideArticleBody) notes.push("sidebar selector inside #article-body");
    if (r.sidebarCount > 1) notes.push(`${r.sidebarCount} sidebar matches`);
    if (r.horizontalOverflow) notes.push("horizontal overflow");
    const reactErrors = (r.consoleErrors ?? []).filter((e: string) =>
      /React error|hydrat|removeChild|insertBefore|NotFoundError/i.test(e)
    );
    if (reactErrors.length) notes.push(`${reactErrors.length} React/hydration errors`);
    if (r.device === "desktop" && r.sidebar && r.sidebar.w < 300) notes.push(`sidebar ${r.sidebar.w}px`);
    if (r.device === "desktop" && r.sidebarContentEnd) notes.push(`sidebar content ends ${r.sidebarContentEnd}px`);
    lines.push(
      `| ${r.path} | ${r.device} | ${r.counts.contentRendered}/${r.counts.content} | ${r.counts.sidebar} | ${r.counts.other.length} | ${r.firstContentAdTop ?? "—"} | ${r.maxGapViewports ?? "—"} | ${r.tallBlocks.length} | ${r.breakIssues.length ? `${r.breakIssues.length} issue(s)` : "ok"} | ${notes.join("; ")} |`
    );
  }
  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  fs.mkdirSync(args.out, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results: Array<Record<string, any>> = [];
  try {
    for (const pagePath of args.paths) {
      for (const device of args.devices) {
        const result = await auditPath(browser, args, device, pagePath);
        results.push(result);
        // Save after every page so a crashed run keeps what it measured.
        fs.writeFileSync(path.join(args.out, "results.json"), JSON.stringify(results, null, 2));
        const c = (result as PageReport & { counts?: PageReport["counts"] }).counts;
        console.log(
          `${device.padEnd(7)} ${pagePath}  ${
            "error" in result && result.error
              ? `ERROR ${result.error}`
              : `content=${c?.contentRendered}/${c?.content} sidebar=${c?.sidebar} other=${c?.other.length} tall=${
                  (result as PageReport).tallBlocks.length
                } breaks=${(result as PageReport).breakIssues.length}`
          }`
        );
      }
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(args.out, "results.json"), JSON.stringify(results, null, 2));
  fs.writeFileSync(path.join(args.out, "summary.md"), `${summarize(results)}\n`);
  console.log(`\nWrote ${path.join(args.out, "summary.md")}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
