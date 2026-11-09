// Reports automation incidents as GitHub issues, one open issue per key.
// Uses the `gh` CLI and its existing login, so no token is stored here.
import { execFileSync } from "node:child_process";

const REPO = process.env.BLOXODES_INCIDENT_REPO || "RaviTejaKNTS/Bloxodes";
const LABEL = "incident";

function gh(args, input) {
  return execFileSync("gh", [...args, "--repo", REPO], {
    encoding: "utf8",
    input,
    stdio: ["pipe", "pipe", "inherit"],
    timeout: 60_000
  }).trim();
}

function marker(key) {
  if (!/^[a-z0-9-]+$/.test(key)) throw new Error(`Invalid incident key: ${key}`);
  return `[${key}]`;
}

export function findOpenIncident(key) {
  const title = marker(key);
  const issues = JSON.parse(gh(["issue", "list", "--label", LABEL, "--state", "open", "--limit", "100", "--json", "number,title"]));
  return issues.find((issue) => issue.title.startsWith(title)) ?? null;
}

// Opens an issue for the key, or comments on the one already open.
export function openIncident({ key, title, body }) {
  const existing = findOpenIncident(key);
  if (existing) {
    gh(["issue", "comment", String(existing.number), "--body-file", "-"], body);
    return { number: existing.number, created: false };
  }
  gh(["label", "create", LABEL, "--color", "d73a4a", "--description", "Opened by Bloxodes automation", "--force"]);
  const url = gh(["issue", "create", "--label", LABEL, "--title", `${marker(key)} ${title}`, "--body-file", "-"], body);
  return { number: Number(url.split("/").pop()), created: true };
}

// Comments and closes the open issue for the key, if there is one.
export function resolveIncident({ key, body }) {
  const existing = findOpenIncident(key);
  if (!existing) return null;
  gh(["issue", "close", String(existing.number), "--comment", body]);
  return { number: existing.number };
}
