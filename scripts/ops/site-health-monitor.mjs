// Every 5 minutes on homelab: check https://bloxodes.com/api/health and keep a
// GitHub issue open while the site or its stats pipeline is unhealthy.
// It also checks that Cloudflare never stores an error page (4xx/5xx) and keeps
// a separate issue open while it does.
import fs from "node:fs";
import path from "node:path";

import { findOpenIncident, openIncident, resolveIncident } from "./github-incident.mjs";

const HEALTH_URL = process.env.SITE_HEALTH_URL || "https://bloxodes.com/api/health";
const KEY = "site-health";
// Two failed checks in a row (about 5 minutes) before opening, so one slow
// response doesn't open an issue.
const FAILURES_TO_OPEN = 2;
const stateFile = path.join(process.env.STATE_DIRECTORY || "/tmp", "site-health-failures");

const SITE_ORIGIN = process.env.SITE_ORIGIN || "https://bloxodes.com";
const ERROR_CACHE_KEY = "error-page-cache";
// Cloudflare statuses that mean the response came out of its cache.
const FROM_CACHE = new Set(["HIT", "STALE", "UPDATING", "REVALIDATED"]);

async function checkHealth() {
  try {
    const response = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(20_000), headers: { "cache-control": "no-cache" } });
    const detail = await response.json().catch(() => null);
    const healthy = response.status === 200 && detail?.ok === true && detail?.scope === "operational";
    return { healthy, status: response.status, detail };
  } catch (error) {
    return { healthy: false, status: null, detail: null, error: error instanceof Error ? error.message : String(error) };
  }
}

function summary(result) {
  const pipeline = result.detail?.checks?.statsPipeline ?? {};
  const failed = Array.isArray(pipeline.checks)
    ? pipeline.checks.filter((entry) => entry.status === "fail").map((entry) => entry.name).slice(0, 10)
    : [];
  return [
    `- Checked: ${new Date().toISOString()}`,
    `- HTTP: ${result.status ?? `no response (${result.error})`}`,
    `- Status: ${pipeline.status ?? result.detail?.status ?? "unknown"}`,
    `- Database: ${result.detail?.checks?.database?.ok === false ? `failing (${result.detail.checks.database.error ?? "no detail"})` : "ok"}`,
    failed.length ? `- Failed checks: ${failed.join(", ")}` : null,
    `- Health: ${HEALTH_URL}`
  ].filter(Boolean).join("\n");
}

// Requests made-up URLs twice each. Every public page uses the same Cloudflare
// cache rule, so if these 404s are served from cache, any real page's error
// would be too. `complete` is false when any request failed or didn't return
// an error status, so an unreachable site never closes the issue.
async function probeErrorPath(probePath) {
  const cached = [];
  let complete = true;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(`${SITE_ORIGIN}${probePath}`, {
        redirect: "manual",
        signal: AbortSignal.timeout(15_000),
        headers: { "user-agent": "BloxodesSiteHealth/1.0" }
      });
      await response.arrayBuffer().catch(() => null);
      const cacheStatus = (response.headers.get("cf-cache-status") || "").toUpperCase();
      if (response.status < 400) complete = false;
      else if (FROM_CACHE.has(cacheStatus)) {
        cached.push(`${probePath} returned ${response.status} with cf-cache-status ${cacheStatus} on request ${attempt}`);
      }
    } catch {
      complete = false;
    }
    if (attempt === 1) await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  return { cached, complete };
}

async function checkErrorPageCache() {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const results = await Promise.all(
    [`/zz-error-cache-check-${id}`, `/wiki/zz-error-cache-check-${id}`].map(probeErrorPath)
  );
  return { cached: results.flatMap((result) => result.cached), complete: results.every((result) => result.complete) };
}

function readFailures() {
  const value = Number(fs.existsSync(stateFile) ? fs.readFileSync(stateFile, "utf8") : 0);
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

const result = await checkHealth();
if (result.healthy) {
  fs.writeFileSync(stateFile, "0");
  const resolved = resolveIncident({ key: KEY, body: `Recovered.\n\n${summary(result)}` });
  console.log(resolved ? `Healthy; closed issue #${resolved.number}.` : "Healthy.");
} else {
  const failures = readFailures() + 1;
  fs.writeFileSync(stateFile, String(failures));
  if (failures < FAILURES_TO_OPEN && !findOpenIncident(KEY)) {
    console.log(`Unhealthy (${failures}/${FAILURES_TO_OPEN}); waiting for the next check.`);
  } else if (failures === FAILURES_TO_OPEN || !findOpenIncident(KEY)) {
    const opened = openIncident({ key: KEY, title: "Bloxodes health check is failing", body: `The operational health check failed ${failures} times in a row.\n\n${summary(result)}` });
    console.log(`Unhealthy; ${opened.created ? "opened" : "updated"} issue #${opened.number}.`);
  } else {
    // Already reported; don't comment every 5 minutes.
    console.log(`Unhealthy (${failures} in a row); issue already open.`);
  }
}

const errorCache = await checkErrorPageCache();
if (errorCache.cached.length > 0) {
  const body = [
    "Cloudflare served an error page from its cache. Search engines (Bing first) drop pages that return errors, and a cached error keeps being served after the site recovers.",
    "",
    "Fix: in Cloudflare → Caching → Cache Rules, every enabled rule needs Edge TTL status code TTLs 400–499 and 500–599 set to \"no store\". See `bloxodes-docs/infrastructure/cloudflare.md`.",
    "",
    ...errorCache.cached.map((line) => `- ${line}`),
    `- Checked: ${new Date().toISOString()}`
  ].join("\n");
  const existing = findOpenIncident(ERROR_CACHE_KEY);
  if (existing) {
    console.error(`Error pages are cached; issue #${existing.number} already open.`);
  } else {
    const opened = openIncident({ key: ERROR_CACHE_KEY, title: "Cloudflare is caching error pages", body });
    console.error(`Error pages are cached; opened issue #${opened.number}.`);
  }
  process.exitCode = 1;
} else if (!errorCache.complete) {
  console.log("Error page cache check inconclusive (a probe failed or didn't return an error); leaving any issue as it is.");
} else {
  const resolved = resolveIncident({ key: ERROR_CACHE_KEY, body: `Cloudflare no longer serves error pages from its cache.\n\n- Checked: ${new Date().toISOString()}` });
  console.log(resolved ? `Error pages not cached; closed issue #${resolved.number}.` : "Error pages not cached.");
}
