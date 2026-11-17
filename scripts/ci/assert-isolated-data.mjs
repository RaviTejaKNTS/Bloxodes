import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { lookup } from "node:dns/promises";
import { setTimeout as pause } from "node:timers/promises";
import { assertFixtureEnvironment } from "./data-server.mjs";

assertFixtureEnvironment();
const managedRef = "bbtcaurrtyoukvjbxbbj";
for (const [key, value] of Object.entries(process.env)) {
  assert.ok(!key.startsWith("MANAGED_DEV_"), `Code checks received forbidden credential ${key}`);
  assert.ok(!value?.includes(managedRef), `Code checks received a managed-development value in ${key}`);
}
assert.equal((await lookup(`${managedRef}.supabase.co`)).address, "0.0.0.0", "Managed-development host must be blocked in /etc/hosts");
if (process.argv.includes("--ready")) {
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try { ready = (await (await fetch("http://127.0.0.1:54321/__health", { signal: AbortSignal.timeout(1000) })).json()).fixture === "bloxodes-ci-read-data-v1"; } catch { /* Starting the owned CI server. */ }
    if (ready) break;
    await pause(250);
  }
  assert.ok(ready, "CI read data server failed to start");
}
if (process.argv.includes("--build")) {
  const scan = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) scan(file);
      else if (entry.isFile()) assert.ok(!fs.readFileSync(file).includes(managedRef), `Build output references managed development: ${file}`);
    }
  };
  for (const directory of ["apps/web/.next/server", "apps/web/.next/static", "apps/web/.next/standalone"]) scan(directory);
}
if (process.argv.includes("--audit")) {
  const audit = await (await fetch("http://127.0.0.1:54321/__audit", { signal: AbortSignal.timeout(5000) })).json();
  fs.mkdirSync("tmp/test-reports", {recursive:true});
  fs.writeFileSync("tmp/test-reports/ci-data-audit.json", JSON.stringify(audit, null, 2));
  assert.ok(audit.requests > 0, "No CI data requests were recorded");
  assert.deepEqual(audit.unexpected, [], "Fixture encountered unsupported queries or writes");
  console.log(`CI data audit passed: ${audit.requests} requests; ${Object.keys(audit.tables).length} tables; ${Object.keys(audit.rpcs).length} read RPCs.`);
}
console.log("Code checks use isolated CI data; managed development is blocked.");
