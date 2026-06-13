#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const API_BASE = "https://api.cloudflare.com/client/v4";
const PHASE = "http_request_cache_settings";
const RULE_REF = "bloxodes_emergency_public_html_cache";
const RULE_DESCRIPTION = "Bloxodes emergency public HTML cache";
const DEFAULT_ZONE_NAME = "bloxodes.com";
const DEFAULT_EDGE_TTL_SECONDS = 86400;

function loadEnvFile(path) {
  try {
    const body = readFileSync(path, "utf8");
    for (const line of body.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key]) continue;
      const value = rawValue.replace(/^['"]|['"]$/g, "");
      process.env[key] = value;
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

loadEnvFile(resolve(process.cwd(), ".env.codex"));
loadEnvFile(resolve(process.cwd(), ".env"));

const command = process.argv[2] ?? "status";
const dryRun = process.argv.includes("--dry-run");
const zoneName = readArg("--zone") ?? process.env.CLOUDFLARE_ZONE_NAME ?? DEFAULT_ZONE_NAME;
const edgeTtlSeconds = readPositiveIntArg("--edge-ttl-seconds") ?? DEFAULT_EDGE_TTL_SECONDS;

function readArg(name) {
  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1] ?? null;
  const prefix = `${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : null;
}

function readPositiveIntArg(name) {
  const raw = readArg(name);
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function apiToken() {
  const token = process.env.CLOUDFLARE_BLOXODES_API;
  if (!token) {
    throw new Error("Missing CLOUDFLARE_BLOXODES_API. Add the Cloudflare operator token to .env.codex.");
  }
  return token;
}

function headers() {
  return {
    Authorization: `Bearer ${apiToken()}`,
    "Content-Type": "application/json"
  };
}

async function cloudflare(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...headers(),
      ...(options.headers ?? {})
    }
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    const messages = Array.isArray(payload?.errors)
      ? payload.errors.map((error) => error.message || JSON.stringify(error)).join("; ")
      : response.statusText;
    throw new Error(`Cloudflare API failed (${response.status}): ${messages}`);
  }
  return payload.result;
}

async function getZoneId() {
  if (process.env.CLOUDFLARE_ZONE_ID) return process.env.CLOUDFLARE_ZONE_ID;
  const zones = await cloudflare(`/zones?name=${encodeURIComponent(zoneName)}&status=active`);
  const zone = Array.isArray(zones) ? zones[0] : null;
  if (!zone?.id) throw new Error(`Could not find active Cloudflare zone for ${zoneName}`);
  return zone.id;
}

async function getCacheRuleset(zoneId) {
  const rulesets = await cloudflare(`/zones/${zoneId}/rulesets`);
  const ruleset = (Array.isArray(rulesets) ? rulesets : []).find(
    (ruleset) => ruleset.kind === "zone" && ruleset.phase === PHASE
  );
  if (!ruleset?.id) return null;
  return cloudflare(`/zones/${zoneId}/rulesets/${ruleset.id}`);
}

async function createCacheRuleset(zoneId, rule) {
  return cloudflare(`/zones/${zoneId}/rulesets`, {
    method: "POST",
    body: JSON.stringify({
      name: "Zone cache rules",
      kind: "zone",
      phase: PHASE,
      rules: [rule]
    })
  });
}

async function updateCacheRuleset(zoneId, ruleset, rules) {
  return cloudflare(`/zones/${zoneId}/rulesets/${ruleset.id}`, {
    method: "PUT",
    body: JSON.stringify({
      name: ruleset.name || "Zone cache rules",
      kind: ruleset.kind || "zone",
      phase: ruleset.phase || PHASE,
      rules
    })
  });
}

function emergencyRule(enabled) {
  return {
    ref: RULE_REF,
    description: RULE_DESCRIPTION,
    enabled,
    expression: [
      '(http.request.method in {"GET" "HEAD"}',
      'http.host in {"bloxodes.com" "www.bloxodes.com"}',
      'not starts_with(http.request.uri.path, "/api")',
      'not starts_with(http.request.uri.path, "/auth")',
      'not starts_with(http.request.uri.path, "/account")',
      'not starts_with(http.request.uri.path, "/login")',
      'not starts_with(http.request.uri.path, "/admin")',
      'not starts_with(http.request.uri.path, "/dashboard")',
      'not starts_with(http.request.uri.path, "/_next/")',
      'not starts_with(http.request.uri.path, "/cdn-cgi/"))'
    ].join(" and "),
    action: "set_cache_settings",
    action_parameters: {
      cache: true,
      edge_ttl: {
        mode: "override_origin",
        default: edgeTtlSeconds,
        status_code_ttl: [
          { status_code_range: { from: 200, to: 299 }, value: edgeTtlSeconds },
          { status_code_range: { from: 300, to: 399 }, value: 0 },
          { status_code_range: { from: 400, to: 499 }, value: 0 },
          { status_code_range: { from: 500 }, value: -1 }
        ]
      },
      browser_ttl: {
        mode: "respect_origin"
      },
      serve_stale: {
        disable_stale_while_updating: false
      }
    }
  };
}

function mergeEmergencyRule(existingRules, enabled) {
  const nextRule = emergencyRule(enabled);
  const withoutEmergency = existingRules.filter(
    (rule) => rule.ref !== RULE_REF && rule.description !== RULE_DESCRIPTION
  );
  return [nextRule, ...withoutEmergency];
}

function summarize(ruleset) {
  const rule = ruleset?.rules?.find((entry) => entry.ref === RULE_REF || entry.description === RULE_DESCRIPTION);
  if (!rule) {
    console.log("Emergency cache rule: missing");
    return;
  }
  console.log(`Emergency cache rule: ${rule.enabled ? "enabled" : "disabled"}`);
  console.log(`Ruleset: ${ruleset.id}`);
  console.log(`Rule: ${rule.id ?? rule.ref ?? RULE_REF}`);
  console.log(`Description: ${rule.description}`);
}

async function main() {
  if (!["on", "off", "status"].includes(command)) {
    throw new Error("Usage: npm run cloudflare:emergency-cache -- <on|off|status> [--dry-run]");
  }

  const zoneId = await getZoneId();
  const ruleset = await getCacheRuleset(zoneId);

  if (command === "status") {
    summarize(ruleset);
    return;
  }

  const enabled = command === "on";
  const existingRules = Array.isArray(ruleset?.rules) ? ruleset.rules : [];
  const nextRules = mergeEmergencyRule(existingRules, enabled);

  if (dryRun) {
    console.log(`Dry run: would ${ruleset ? "update" : "create"} ${PHASE} ruleset with emergency cache ${enabled ? "enabled" : "disabled"}.`);
    console.log(JSON.stringify(nextRules[0], null, 2));
    return;
  }

  const updated = ruleset
    ? await updateCacheRuleset(zoneId, ruleset, nextRules)
    : await createCacheRuleset(zoneId, nextRules[0]);

  summarize(updated);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
