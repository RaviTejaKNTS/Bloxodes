import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { setTimeout as pause } from "node:timers/promises";
import { load } from "cheerio";
import { chromium, expect } from "@playwright/test";

if (process.env.GITHUB_ACTIONS !== "true") throw new Error("Built catalog regression runs only on GitHub.");
if (process.platform === "win32") throw new Error("Catalog regression requires POSIX process groups.");
const root = process.cwd();
const base = "http://127.0.0.1:3000";
const stateFile = path.join(root, "tmp/test-reports/catalog-fixture-state.json");
const reportFile = path.join(root, "tmp/test-reports/catalog-route-regression.json");
fs.mkdirSync(path.dirname(stateFile), { recursive: true });
fs.writeFileSync(stateFile, "{}");
const report = { sha: process.env.BLOXODES_BUILD_SHA, routes: [], browser: [], failures: [], passed: false };
const requestTimeout = 60_000;
function withDeadline(promise, milliseconds, label) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} exceeded ${milliseconds}ms`)), milliseconds);
  })]).finally(() => clearTimeout(timer));
}
const fetchLocal = (target, options = {}) => fetch(`${base}${target}`, { ...options, signal: AbortSignal.timeout(requestTimeout) });
let logs = "";
let browser;
const server = spawn(process.execPath, ["scripts/ci/start-web.mjs"], {
  env: { ...process.env, TEST_BASE_URL: base, CATALOG_ROUTE_FIXTURES: "1", CATALOG_FIXTURE_STATE: stateFile,
    NODE_OPTIONS: `--import=${path.join(root, "scripts/ci/catalog-fetch-fixture.mjs")}` },
  // The launcher and its Next child share a group owned only by this harness.
  detached: true, stdio: ["ignore", "pipe", "pipe"]
});
const serverExited = new Promise(resolve => { server.once("exit", resolve); server.once("error", resolve); });
server.stdout.on("data", chunk => { logs += chunk; });
server.stderr.on("data", chunk => { logs += chunk; });
server.on("error", error => { logs += error.message; });
function signalServerGroup(signal) {
  if (!server.pid) return false;
  try { process.kill(-server.pid, signal); return true; }
  catch (error) { if (error.code === "ESRCH") return false; throw error; }
}
async function waitForServerGroup(milliseconds) {
  const deadline = Date.now() + milliseconds;
  while (signalServerGroup(0)) {
    if (Date.now() >= deadline) return false;
    await pause(100);
  }
  return true;
}
async function stopServer() {
  signalServerGroup("SIGTERM");
  if (!await waitForServerGroup(5_000)) {
    signalServerGroup("SIGKILL");
    assert.ok(await waitForServerGroup(5_000), "Owned Next process group survived SIGKILL");
  }
  await withDeadline(serverExited, 5_000, "Next launcher exit");
  report.serverStopped = true;
}
const families = [
  { path: "/catalog/roblox-music-ids/games/jujutsu-shenanigans", api: "/api/roblox-music-ids?game=jujutsu-shenanigans", key: "songs", size: 24, total: 49 },
  { path: "/catalog/roblox-music-ids/games/driving-empire", api: "/api/roblox-music-ids?game=driving-empire", key: "songs", size: 24, total: 49 },
  { path: "/catalog/roblox-decal-ids/games/bloxstrike", api: "/api/roblox-decal-ids?game=bloxstrike", key: "decals", size: 24, total: 49 },
  { path: "/catalog/roblox-decal-ids/games/shindo-life", api: "/api/roblox-decal-ids?game=shindo-life", key: "decals", size: 24, total: 49 },
  { path: "/catalog/roblox-mesh-ids", api: "/api/roblox-mesh-ids?", key: "meshes", size: 40, total: 81 },
  { path: "/catalog/roblox-decal-ids", api: "/api/roblox-decal-ids?", key: "decals", size: 24, total: 50 },
  { path: "/catalog/roblox-music-ids", api: "/api/roblox-music-ids?", key: "songs", size: 24, total: 98 }
];
const fetchPage = target => fetchLocal(target, { headers: { "User-Agent": "Googlebot" } });
async function verifyPage(family, page) {
  const target = `${family.path}${page === 1 ? "" : `/page/${page}`}`;
  // This is the first request for these fallback paths on the production server.
  for (const pass of ["cold", "warm"]) {
    const response = await fetchPage(target);
    assert.equal(response.status, 200, `${pass} ${target}`);
    const $ = load(await response.text());
    assert.equal($("h1").length, 1, target);
    assert.equal($('link[rel="canonical"]').attr("href"), `https://bloxodes.com${target}`, target);
    if (page > 1) assert.match($('meta[name="robots"]').attr("content") ?? "", /noindex,\s*follow/, target);
    const list = $('script[type="application/ld+json"]').toArray().map(element => JSON.parse($(element).text())).find(value => value["@type"] === "ItemList");
    assert.ok(list, `ItemList ${target}`);
    assert.equal(list.numberOfItems, family.total, target);
    const apiResponse = await fetchLocal(`${family.api}&page=${page}`);
    assert.equal(apiResponse.status, 200, family.api);
    const payload = await apiResponse.json();
    assert.equal(payload.total, family.total, family.api);
    assert.equal(payload.totalPages, Math.ceil(family.total / family.size), family.api);
    assert.equal(payload[family.key].length, Math.min(family.size, family.total - (page - 1) * family.size));
    assert.deepEqual(list.itemListElement.map(value => value.item.name), payload[family.key].map(row => family.key === "songs" ? row.title : row.name), target);
    if (pass === "warm") assert.equal(response.headers.get("x-nextjs-cache"), "HIT", `ISR cache ${target}`);
    report.routes.push({ path: target, pass, status: response.status, cache: response.headers.get("x-nextjs-cache"), count: payload[family.key].length });
  }
  const rsc = await fetchLocal(target, { headers: { RSC: "1" } });
  assert.equal(rsc.status, 200, `RSC ${target}`);
  const payload = await rsc.text();
  assert.doesNotMatch(payload, /DYNAMIC_SERVER_USAGE|NEXT_NOT_FOUND|"digest"\s*:\s*"\d+"/, `RSC ${target}`);
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null || server.signalCode !== null) throw new Error(`Next exited with ${server.signalCode ?? server.exitCode}`);
    try { ready = (await fetch(`${base}/api/health?scope=deploy`, { signal: AbortSignal.timeout(2_000) })).ok; } catch { /* starting */ }
    if (ready) break;
    await pause(1_000);
  }
  assert.ok(ready, "Next production server did not start");
  for (const family of families) {
    for (const page of [1, 2, Math.ceil(family.total / family.size)]) await verifyPage(family, page);
    for (const invalid of ["0", "1", "-2", "oops", "2oops", "9007199254740992", String(Math.ceil(family.total / family.size) + 1), "999999"]) {
      // Main music pagination keeps its existing page-1 alias contract.
      if (family.path === "/catalog/roblox-music-ids" && ["0", "1", "-2", "oops", "2oops", "9007199254740992"].includes(invalid)) continue;
      const response = await fetchPage(`${family.path}/page/${invalid}`);
      assert.equal(response.status, 404, `${family.path}/page/${invalid}`);
      report.routes.push({ path: `${family.path}/page/${invalid}`, status: 404 });
    }
    if (family.path !== "/catalog/roblox-music-ids") {
      // The last full safe range is still allowed into the loader and is
      // genuinely exhausted. The next page has a safe start but unsafe end.
      const lastFullPage = Number((BigInt(Number.MAX_SAFE_INTEGER) + 1n) / BigInt(family.size));
      for (const page of [lastFullPage, lastFullPage + 1, lastFullPage + 2, Number.MAX_SAFE_INTEGER]) {
        const target = `${family.path}/page/${page}`;
        assert.equal((await fetchPage(target)).status, 404, `range boundary ${target}`);
        report.routes.push({ path: target, status: 404, rangeBoundary: true });
      }
    }
  }
  for (const path of ["/catalog/roblox-music-ids/games/missing/page/2", "/catalog/roblox-decal-ids/games/missing/page/2"]) {
    assert.equal((await fetchPage(path)).status, 404, path);
  }
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(requestTimeout);
  await page.route("**/*", route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  // Test hydrated URL filters independently of the static HTML seed. Every
  // initial payload has many cards; the filtered browser must show one.
  for (const [index, family] of families.entries()) {
    const query = family.key === "songs" ? "1000" : family.key === "meshes" ? "5000" : "3001";
    const sort = family.key === "meshes" ? "name" : "popular";
    const waitForFilteredApi = (number, q, sortKey) => page.waitForResponse(response => {
      const actual = new URL(response.url());
      const expected = new URL(family.api, base);
      return actual.origin === base && actual.pathname === expected.pathname
        && actual.searchParams.get("game") === expected.searchParams.get("game")
        && actual.searchParams.get("page") === String(number)
        && actual.searchParams.get("q") === q && actual.searchParams.get("sort") === sortKey;
    }, { timeout: requestTimeout });
    const apiPromise = waitForFilteredApi(1, query, sort);
    const response = await page.goto(`${base}${family.path}?q=${query}&sort=${sort}`, { waitUntil: "domcontentloaded" });
    assert.equal(response?.status(), 200);
    assert.equal((await apiPromise).status(), 200);
    const cards = page.locator('#article-body [data-journey-item]:not([hidden])').filter({ has: page.locator("article") });
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText(query);
    await expect(page.locator('#article-body input[type="search"]')).toHaveValue(query);
    await expect(page.locator("#article-body select")).toHaveValue(sort);
    // Clearing restores unfiltered cards. A multi-page subset with alphabetic
    // ordering reverses default membership, making stale page-1 cards visible.
    await page.getByRole("button", { name: "Clear", exact: true }).click();
    await expect(page).toHaveURL(`${base}${family.path}`);
    await expect(cards).toHaveCount(family.size);
    const subsetQuery = "Subset";
    const subsetSort = family.key === "songs" ? "title_asc" : family.key === "decals" ? "name_asc" : "name";
    const subsetTotal = family.key === "meshes" ? 60 : 32;
    const firstId = family.key === "songs" ? 1000 : family.key === "decals" ? 3000 : 5000;
    const orderedIds = Array.from({ length: subsetTotal }, (_, index) => firstId + subsetTotal - 1 - index);
    const renderedIds = async () => (await cards.locator("h2").allTextContents()).map(title => Number(title.trim().match(/(\d+)$/)?.[1]));
    await page.locator('#article-body input[type="search"]').fill(subsetQuery);
    await page.locator("#article-body select").selectOption(subsetSort);
    const firstPageApi = waitForFilteredApi(1, subsetQuery, subsetSort);
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    assert.equal((await firstPageApi).status(), 200);
    await expect(page).toHaveURL(`${base}${family.path}?q=${subsetQuery}&sort=${subsetSort}`);
    await expect.poll(renderedIds, { timeout: requestTimeout }).toEqual(orderedIds.slice(0, family.size));
    // Register the exact family/game/page/q/sort response before Next Link.
    const secondPageApi = waitForFilteredApi(2, subsetQuery, subsetSort);
    await page.getByRole("navigation", { name: "Pagination", exact: true }).getByRole("link", { name: "Next", exact: true }).click();
    const secondResponse = await secondPageApi;
    assert.equal(secondResponse.status(), 200);
    const secondPayload = await withDeadline(secondResponse.json(), requestTimeout, "Filtered page-2 API body");
    const expectedIds = orderedIds.slice(family.size);
    assert.equal(secondPayload.ok, true);
    assert.equal(secondPayload.total, subsetTotal);
    assert.equal(secondPayload.totalPages, 2);
    assert.deepEqual(secondPayload[family.key].map(row => row.asset_id), expectedIds);
    await expect(page).toHaveURL(`${base}${family.path}/page/2?q=${subsetQuery}&sort=${subsetSort}`);
    await expect(cards).toHaveCount(expectedIds.length);
    await expect.poll(renderedIds, { timeout: requestTimeout }).toEqual(expectedIds);
    await expect(page.locator('#article-body input[type="search"]')).toHaveValue(subsetQuery);
    await expect(page.locator("#article-body select")).toHaveValue(subsetSort);
    report.browser.push({ path: family.path, filter: query, sort, pagination: true,
      page2: { query: subsetQuery, sort: subsetSort, total: subsetTotal, expectedIds } });
    if (index === 0) await page.screenshot({ path: "tmp/test-reports/catalog-page-2.png", fullPage: true });
  }
  await withDeadline(browser.close(), 10_000, "Browser close"); browser = undefined;
  for (const failure of ["PGRST003", "57014", "transport", "PGRST103"]) {
    fs.writeFileSync(stateFile, JSON.stringify({ failure }));
    for (const endpoint of ["/api/roblox-music-ids?game=jujutsu-shenanigans&page=2", "/api/roblox-decal-ids?game=bloxstrike&page=2", "/api/roblox-mesh-ids?page=2"]) {
      const response = await fetchLocal(endpoint);
      assert.equal(response.status, 503, `${failure} ${endpoint}`);
      assert.equal(response.headers.get("cache-control"), "no-store");
      report.failures.push({ endpoint, failure, status: 503 });
    }
  }
  // A failed cold generation must not persist a fabricated empty page or 404.
  for (const family of families.slice(0, 5)) {
    const target = `${family.path}/page/99`;
    assert.equal((await fetchPage(target)).status, 500, `cold failure ${target}`);
    fs.writeFileSync(stateFile, "{}");
    assert.equal((await fetchPage(target)).status, 404, `recovered ${target}`);
    fs.writeFileSync(stateFile, JSON.stringify({ failure: "57014" }));
  }
  assert.doesNotMatch(logs, /DYNAMIC_SERVER_USAGE|app\/ Static to Dynamic Error/);
  report.passed = true;
} catch (error) {
  report.error = error instanceof Error ? error.message : String(error);
  report.dynamicServerUsage = logs.includes("DYNAMIC_SERVER_USAGE");
  throw error;
} finally {
  try {
    if (browser) await withDeadline(browser.close(), 10_000, "Browser close");
  } catch (error) {
    report.passed = false; report.cleanupError = error.message; throw error;
  } finally {
    try { await stopServer(); }
    catch (error) { report.passed = false; report.cleanupError = error.message; throw error; }
    finally {
      fs.writeFileSync(stateFile, "{}");
      fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
      // Do not dump general server logs or credentials.
      console.log(`Catalog regression ${report.passed ? "passed" : "failed"}: ${reportFile}`);
    }
  }
}
