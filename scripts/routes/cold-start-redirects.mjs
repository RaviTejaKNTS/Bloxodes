// GitHub-only built-app check. No HTTP readiness probes: the alias is request #1.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
if (process.env.GITHUB_ACTIONS !== 'true') throw new Error('Cold redirect checks run only on GitHub');
const base = 'http://127.0.0.1:3017';
for (const [path, status, target] of [
  ['/lists/top-trending-roblox-action-games', 308, '/stats/games?genre=Action'],
  ['/all-fisch-enchantments-guide', 301, '/articles/all-fisch-enchantments-guide']
]) {
  const server = spawn(process.execPath, ['scripts/ci/start-web.mjs'], {
    detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: {...process.env, TEST_BASE_URL: base}
  });
  const exited = new Promise(resolve => server.once('exit', resolve));
  let output = '';
  let timer;
  try {
    await new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Fresh server did not become ready')), 60_000);
      server.stdout.on('data', chunk => {
        output += chunk;
        if (/Ready in/i.test(output)) resolve();
      });
      server.stderr.on('data', chunk => { output += chunk; });
      server.once('error', reject);
      server.once('exit', () => reject(new Error('Fresh server exited before ready')));
    });
    clearTimeout(timer);
    const response = await fetch(base + path, {redirect:'manual', signal:AbortSignal.timeout(10_000)});
    assert.equal(response.status, status, `First request ${path}`);
    const location = new URL(response.headers.get('location'), base);
    assert.equal(location.pathname + location.search, target, `First request ${path}`);
    await response.body?.cancel();
    console.log(`Fresh server first request: ${path} -> ${status} ${target}`);
  } finally {
    clearTimeout(timer);
    try { process.kill(-server.pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
    const force = setTimeout(() => {
      try { process.kill(-server.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
    }, 5_000);
    await exited;
    clearTimeout(force);
  }
}
