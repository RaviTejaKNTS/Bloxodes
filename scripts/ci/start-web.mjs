import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

if (process.env.GITHUB_ACTIONS !== "true") throw new Error("The standalone browser server runs only on GitHub.");
const root = process.cwd();
const standalone = path.join(root, "apps/web/.next/standalone");
const web = path.join(standalone, "apps/web");
for (const [source, target] of [["apps/web/public", "public"], ["apps/web/.next/static", ".next/static"]]) {
  fs.cpSync(path.join(root, source), path.join(web, target), {recursive: true});
}
fs.cpSync(path.join(root, "data"), path.join(standalone, "data"), {recursive: true});
const address = new URL(process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000");
const managedTestHost=process.env.BLOXODES_MANAGED_QA==='true' && address.hostname==='bloxodes.test' && address.port==='3000';
if (address.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(address.hostname) && !managedTestHost) throw new Error("The CI preview must stay on runner loopback.");
const server = spawn(process.execPath, [path.join(web, "server.js")], {
  stdio: "inherit", env: {...process.env, NODE_ENV: "production", HOSTNAME: "127.0.0.1", PORT: address.port || "3000"},
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));
server.on("error", error => { console.error(error.message); process.exitCode = 1; });
server.on("exit", code => { process.exitCode = code ?? 1; });
