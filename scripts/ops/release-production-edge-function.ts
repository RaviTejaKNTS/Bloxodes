import "../shared/load-env";

import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { isProductionSupabaseUrl } from "../shared/supabase-target";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const argv = process.argv.slice(2);
const apply = argv.includes("--apply");

function value(flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index === -1 ? undefined : argv[index + 1]?.trim();
}

function required(name: string, input: string | undefined): string {
  const resolved = input?.trim();
  if (!resolved) throw new Error(`${name} is required.`);
  return resolved;
}

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
}

function ssh(target: string, command: string, input?: string): string {
  const result = spawnSync("ssh", [
    "-o", "BatchMode=yes",
    "-o", "ConnectTimeout=10",
    target,
    command
  ], {
    cwd: repoRoot,
    input,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024
  });
  if (result.error) throw result.error;
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`SSH command exited with status ${result.status}.`);
  return result.stdout.trim();
}

async function smoke(functionName: string): Promise<void> {
  const baseUrl = required("SUPABASE_URL", process.env.SUPABASE_URL).replace(/\/$/, "");
  const serviceRole = required("SUPABASE_SERVICE_ROLE", process.env.SUPABASE_SERVICE_ROLE);
  let response: Response | null = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    response = await fetch(`${baseUrl}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${serviceRole}`,
        apikey: serviceRole,
        "content-type": "application/json"
      },
      body: "{}"
    });
    if (response.ok) return;
    if (![502, 503].includes(response.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  const body = await response?.text().catch(() => "");
  throw new Error(`Production ${functionName} smoke failed: ${response?.status ?? "no response"} ${body}`);
}

async function main() {
  const approvedSha = required("--approved-sha", value("--approved-sha"));
  const functionName = required("--function", value("--function"));
  if (!/^[0-9a-f]{40}$/.test(approvedSha)) throw new Error("--approved-sha must be a full Git SHA.");
  if (!/^[a-z0-9-]+$/.test(functionName)) throw new Error("--function contains invalid characters.");
  if (git("rev-parse", "HEAD") !== approvedSha) throw new Error("The checkout does not match --approved-sha.");
  if (git("status", "--porcelain")) throw new Error("The checkout is dirty; refusing Edge Function release.");
  if (apply && value("--confirm") !== `APPLY ${functionName}`) {
    throw new Error(`Apply requires --confirm "APPLY ${functionName}".`);
  }
  if (apply && git("rev-parse", "origin/production") !== approvedSha) {
    throw new Error("Apply requires origin/production to equal the approved SHA.");
  }
  const productionUrl = required("SUPABASE_URL", process.env.SUPABASE_URL);
  if (!isProductionSupabaseUrl(productionUrl)) throw new Error("SUPABASE_URL is not production.");

  const source = path.join(repoRoot, "supabase/functions", functionName, "index.ts");
  if (!fs.existsSync(source)) throw new Error(`Missing Edge Function source: ${source}`);
  const sourceBytes = fs.readFileSync(source);
  const desiredSha = createHash("sha256").update(sourceBytes).digest("hex");
  const sshUser = required("VPS_ADMIN_USER", process.env.VPS_ADMIN_USER);
  const sshHost = required("VPS_HOST", process.env.VPS_HOST);
  if (!/^[a-zA-Z0-9_.-]+$/.test(sshUser) || !/^[a-zA-Z0-9_.-]+$/.test(sshHost)) {
    throw new Error("The configured VPS SSH target is invalid.");
  }
  const target = `${sshUser}@${sshHost}`;
  const live = `/home/codex-admin/bloxodes-supabase/volumes/functions/${functionName}/index.ts`;
  const current = ssh(target, `sha256sum ${live}`).split(/\s+/)[0];
  console.log(`${functionName}: current=${current} desired=${desiredSha}`);
  if (current === desiredSha) {
    console.log(`Production ${functionName} already matches the approved source.`);
    return;
  }
  if (!apply) {
    console.log("Plan only; no production file or container was changed.");
    return;
  }

  const shortSha = approvedSha.slice(0, 12);
  const staged = `/tmp/bloxodes-${functionName}-${shortSha}.ts`;
  const backup = `/tmp/bloxodes-${functionName}-pre-${shortSha}.ts`;
  ssh(target, `cat > ${staged}`, sourceBytes.toString("utf8"));
  const metadata = ssh(target, `stat -c %u:%g:%a ${live}`);
  if (!/^\d+:\d+:\d+$/.test(metadata)) throw new Error(`Unexpected function metadata: ${metadata}`);
  const [ownerUid, ownerGid, mode] = metadata.split(":");
  ssh(target, `cp ${live} ${backup}`);

  const install = `set -euo pipefail
test "$(sha256sum ${staged} | awk '{print $1}')" = "${desiredSha}"
docker cp ${staged} supabase-edge-functions:/tmp/${functionName}-index.ts
docker exec -u 0 supabase-edge-functions install -m ${mode} -o ${ownerUid} -g ${ownerGid} /tmp/${functionName}-index.ts /home/deno/functions/${functionName}/index.ts
docker restart supabase-edge-functions >/dev/null
test "$(docker inspect supabase-edge-functions --format '{{.State.Running}}')" = true
test "$(sha256sum ${live} | awk '{print $1}')" = "${desiredSha}"
`;

  try {
    ssh(target, "bash -se", install);
    await smoke(functionName);
  } catch (error) {
    const rollback = `set -euo pipefail
docker cp ${backup} supabase-edge-functions:/tmp/${functionName}-rollback.ts
docker exec -u 0 supabase-edge-functions install -m ${mode} -o ${ownerUid} -g ${ownerGid} /tmp/${functionName}-rollback.ts /home/deno/functions/${functionName}/index.ts
docker restart supabase-edge-functions >/dev/null
`;
    ssh(target, "bash -se", rollback);
    throw error;
  } finally {
    ssh(target, `rm -f ${staged} ${backup}`);
  }
  console.log(`Production ${functionName} deployed and smoke-tested at ${approvedSha}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
