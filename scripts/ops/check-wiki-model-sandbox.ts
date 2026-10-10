import "../shared/load-env";
import { spawnSync } from "node:child_process";
import { constants } from "node:fs";
import { mkdtemp, mkdir, writeFile, rm, realpath, access } from "node:fs/promises";
import path from "node:path";
import { resolveWikiDevCredentials } from "../wiki/wiki-automation-env";
import { wikiStageSandboxProbeArgs, wikiWorkerEnvironment } from "../wiki/wiki-stage-runtime";

// No model turn or database mutation: exercise the nested CLI sandbox used by workers.
async function main() {
  const root = await realpath(process.env.WIKI_AUTOMATION_WORKTREE || process.cwd());
  await access(path.join(root, ".aws"));
  const dev = resolveWikiDevCredentials();
  const modelHome = process.env.WIKI_AUTOMATION_MODEL_HOME || "/var/lib/bloxodes/wiki-model";
  const env = wikiWorkerEnvironment({ ...process.env, HOME: modelHome, CODEX_HOME: path.join(modelHome, ".codex") });
  delete env.CLAUDE_CODE_OAUTH_TOKEN;
  const auth = path.join(env.CODEX_HOME!, "auth.json");
  // Prove the login file exists outside the nested sandbox, without reading bytes.
  await access(auth, constants.R_OK);
  const dir = await mkdtemp(path.join(root, "tmp/wiki-automation/.sandbox-readiness-"));
  try {
    const probe = path.join(dir, "probe.cjs");
    await mkdir(path.join(dir, ".aws"));
    await writeFile(path.join(dir, ".env.canary"), "not-a-secret");
    await writeFile(path.join(dir, ".aws/credentials"), "not-a-secret");
    await writeFile(probe, `const fs=require('node:fs/promises'), net=require('node:net'), dns=require('node:dns/promises');
    (async()=>{
      await fs.writeFile(${JSON.stringify(path.join(dir, "write-canary"))},'ready');
      for(const credential of ${JSON.stringify([auth, path.join(dir, ".env.canary"), path.join(dir, ".aws/credentials")])}) {
        try {await fs.readFile(credential);throw Error('Credential read unexpectedly allowed');}
        catch(error){if(!['EACCES','EPERM'].includes(error.code))throw error;}
      }
      await dns.lookup(${JSON.stringify(new URL(dev.url).hostname)});
      const response=await fetch(${JSON.stringify(`${dev.url}/rest/v1/`)},{signal:AbortSignal.timeout(20000)});
      if(response.status!==401&&response.status!==200)throw Error('Managed development HTTPS returned '+response.status);
      await new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>server.close(error=>error?reject(error):resolve()));});
      try {const handle=await fs.open(${JSON.stringify(path.join(root, "AGENTS.md"))},'r+');await handle.close();throw Error('Tracked source unexpectedly writable');}
      catch(error){if(!['EROFS','EACCES','EPERM'].includes(error.code))throw error;}
      console.log('Wiki stage sandbox passed: named policy, artifact write, credential-read denials, DNS, HTTPS, preview listener, read-only source.');
    })().catch(error=>{console.error(error.message);process.exitCode=1});`);
    const bin = process.env.WIKI_AUTOMATION_CODEX_BIN || "/home/teja/.local/bin/codex";
    const options = { root: dir, worktree: root, codexBin: bin, env, deadline: Date.now() + 60_000, identity: { id: "readiness", game_name: "Readiness", wiki_slug: "readiness", universe_id: 0, root_place_id: 0 } };
    const task = { stage: "collection_images" as const, folder: dir, attemptDir: path.join(dir, ".stages/probe"), revision: false, feedback: "", approved: [] };
    const args = wikiStageSandboxProbeArgs(options, task, probe);
    const result = spawnSync(bin, args, { cwd: dir, env, encoding: "utf8", timeout: 60_000 });
    if (result.status !== 0) throw new Error(`Wiki model sandbox readiness failed: ${result.error?.message || result.stderr || result.stdout}`);
    process.stdout.write(result.stdout);
  } finally { await rm(dir, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
