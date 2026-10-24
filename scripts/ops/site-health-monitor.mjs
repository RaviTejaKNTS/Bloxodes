// Every 5 minutes on homelab: check https://bloxodes.com/api/health and keep a
// GitHub issue open while the site or its stats pipeline is unhealthy.
import fs from "node:fs";
import path from "node:path";

import { findOpenIncident, openIncident, resolveIncident } from "./github-incident.mjs";

const HEALTH_URL = process.env.SITE_HEALTH_URL || "https://bloxodes.com/api/health";
const KEY = "site-health";
// Two failed checks in a row (about 5 minutes) before opening, so one slow
// response doesn't open an issue.
const FAILURES_TO_OPEN = 2;
const stateFile = path.join(process.env.STATE_DIRECTORY || "/tmp", "site-health-failures");

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
