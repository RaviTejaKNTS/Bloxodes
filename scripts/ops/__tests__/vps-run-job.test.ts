import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const wrapper = path.resolve(import.meta.dirname, '../vps-run-job.sh');
async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'bloxodes-worker-test-'));
  await mkdir(path.join(root, 'bin')); await writeFile(path.join(root, 'env.stats-worker'), '');
  await writeFile(path.join(root, 'bin/docker'), `#!/bin/sh
case "$1" in
 network) sleep "\${MOCK_NETWORK_DURATION:-0}"; exit 0 ;;
 image) test "\${MOCK_BUILD:-0}" = 0; exit $? ;;
 ps) exit 0 ;;
 rm) echo removed >> "$STATS_WORKER_BASE/removed"; exit 0 ;;
 run) case "$*" in *--entrypoint*) sleep "\${MOCK_SMOKE_DURATION:-0}"; exit 0 ;; *--name*) case "$*" in *BLOXODES_ENV_PROFILE=process-only*) ;; *) exit 22 ;; esac; sleep "\${MOCK_DURATION:-0}"; exit "\${MOCK_EXIT:-0}" ;; *) exit 0 ;; esac ;;
esac
`, {mode:0o755});
  await writeFile(path.join(root, 'bin/build-image.sh'), '#!/bin/sh\nsleep "${MOCK_BUILD_DURATION:-0}"\n', {mode:0o755});
  const env = {...process.env, STATS_WORKER_BASE:root, PATH:path.join(root,'bin')+':'+process.env.PATH};
  return {root, env, cleanup:()=>rm(root,{recursive:true,force:true})};
}
function command(env: NodeJS.ProcessEnv) {
  return new Promise<number>((resolve,reject)=>{
    const child=spawn('sh',[wrapper,'canary','true'],{env,stdio:'ignore'});
    child.on('error',reject); child.on('exit',code=>resolve(code??-1));
  });
}
test('shared-lock contention waits and eventually records successful work',async()=>{
  const f=await fixture();
  const lock=spawn('flock',[path.join(f.root,'group-roblox-api.lock'),'sh','-c','echo ready; sleep 0.4'],{stdio:['ignore','pipe','ignore']});
  try {
    await new Promise(resolve=>lock.stdout!.once('data',resolve));
    assert.equal(await command({...f.env,JOB_LOCK_GROUP:'roblox-api',JOB_LOCK_WAIT_SECONDS:'3'}),0);
    assert.equal(JSON.parse(await readFile(path.join(f.root,'state/canary.json'),'utf8')).state,'success');
  } finally { lock.kill(); await f.cleanup(); }
});
test('explicit nonblocking contention is distinguishable from success',async()=>{
  const f=await fixture();
  const lock=spawn('flock',[path.join(f.root,'group-roblox-api.lock'),'sh','-c','echo ready; sleep 3'],{stdio:['ignore','pipe','ignore']});
  try {
    await new Promise(resolve=>lock.stdout!.once('data',resolve));
    assert.equal(await command({...f.env,JOB_LOCK_GROUP:'roblox-api',JOB_LOCK_WAIT_SECONDS:'0'}),75);
    assert.equal(JSON.parse(await readFile(path.join(f.root,'state/canary.json'),'utf8')).state,'skipped');
  } finally { lock.kill(); await f.cleanup(); }
});
test('a failed or timed-out container is removed and never marked successful',async()=>{
  for(const options of [{MOCK_EXIT:'23'},{MOCK_DURATION:'3',JOB_TIMEOUT_SECONDS:'1'}]) {
    const f=await fixture();
    try {
      assert.notEqual(await command({...f.env,...options}),0);
      assert.equal(JSON.parse(await readFile(path.join(f.root,'state/canary.json'),'utf8')).state,'failed');
      assert.match(await readFile(path.join(f.root,'removed'),'utf8'),/removed/);
    } finally { await f.cleanup(); }
  }
});

test('whole-run deadline covers network, image build and smoke; the next run acquires both locks', async () => {
  for (const options of [
    {MOCK_NETWORK_DURATION:'5'},
    {MOCK_BUILD:'1', MOCK_BUILD_DURATION:'5'},
    {MOCK_SMOKE_DURATION:'5'}
  ]) {
    const f = await fixture();
    try {
      const env = {...f.env, JOB_LOCK_GROUP:'roblox-api', JOB_OVERALL_TIMEOUT_SECONDS:'1'};
      const start = Date.now();
      assert.equal(await command({...env, ...options}), 124);
      assert.ok(Date.now()-start < 4000, 'preflight must stop within the deadline');
      assert.equal(JSON.parse(await readFile(path.join(f.root,'state/canary.json'),'utf8')).state,'failed');
      assert.match(await readFile(path.join(f.root,'removed'),'utf8'), /removed/);
      assert.equal(await command(env), 0);
      assert.equal(JSON.parse(await readFile(path.join(f.root,'state/canary.json'),'utf8')).state,'success');
    } finally { await f.cleanup(); }
  }
});
