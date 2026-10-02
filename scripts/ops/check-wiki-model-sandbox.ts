import "../shared/load-env";
import { spawnSync } from "node:child_process";
import { mkdtemp, writeFile, rm, realpath, access } from "node:fs/promises";
import path from "node:path";
import { resolveWikiDevCredentials } from "../wiki/wiki-automation-env";
import { wikiSandboxProbeArgs } from "../wiki/wiki-execution";

// No model turn or database mutation: exercise the nested CLI sandbox used by workers.
async function main() {
  const root = await realpath(process.env.WIKI_AUTOMATION_WORKTREE || process.cwd());
  await access(path.join(root, ".aws"));
  const dir = await mkdtemp(path.join(root, "tmp/wiki-automation/.sandbox-readiness-"));
  const dev = resolveWikiDevCredentials();
  const probe = path.join(dir, "probe.cjs");
  await writeFile(probe, `const fs=require('node:fs/promises'), net=require('node:net'), dns=require('node:dns/promises');
    (async()=>{
      await fs.writeFile(${JSON.stringify(path.join(dir, "write-canary"))},'ready');
      const audit = require('node:child_process').spawnSync(process.execPath,
        ['--import','tsx','scripts/automation/audit-html-size.ts','--url','data:text/html,<h1>Ready</h1>'],
        {cwd:${JSON.stringify(root)},env:{...process.env,WIKI_AUTOMATION_RESULT_ROOT:${JSON.stringify(dir)}},encoding:'utf8',timeout:20000});
      if(audit.status!==0)throw Error('HTML audit report write failed: '+audit.stderr);
      await dns.lookup(${JSON.stringify(new URL(dev.url).hostname)});
      const response=await fetch(${JSON.stringify(`${dev.url}/rest/v1/`)},{signal:AbortSignal.timeout(20000)});
      if(response.status!==401&&response.status!==200)throw Error('Managed development HTTPS returned '+response.status);
      await new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>server.close(error=>error?reject(error):resolve()));});
      try {const handle=await fs.open(${JSON.stringify(path.join(root, "AGENTS.md"))},'r+');await handle.close();throw Error('Tracked source unexpectedly writable');}
      catch(error){if(!['EROFS','EACCES','EPERM'].includes(error.code))throw error;}
      console.log('Wiki model sandbox passed: shell, artifact write, DNS, HTTPS, preview listener, read-only source.');
    })().catch(error=>{console.error(error.message);process.exitCode=1});`);
  try {
    const bin = process.env.WIKI_AUTOMATION_CODEX_BIN || "/home/teja/.local/bin/codex";
    const env = { ...process.env, HOME: process.env.WIKI_AUTOMATION_MODEL_HOME || "/var/lib/bloxodes/wiki-model",
      CODEX_HOME: path.join(process.env.WIKI_AUTOMATION_MODEL_HOME || "/var/lib/bloxodes/wiki-model", ".codex") };
    const help = spawnSync(bin, ["sandbox", "--help"], { encoding: "utf8", env });
    const args = [...wikiSandboxProbeArgs(await realpath(dir), help.stdout), "--cd", root, process.execPath, probe];
    const result = spawnSync(bin, args, { cwd: root, env, encoding: "utf8", timeout: 60_000 });
    if (result.status !== 0) throw new Error(`Wiki model sandbox readiness failed: ${result.error?.message || result.stderr || result.stdout}`);
    process.stdout.write(result.stdout);
  } finally { await rm(dir, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
