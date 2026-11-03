// Read-only HTTP capture, not a test. Run from repository root.
// Inputs are frozen independently of the recorded responses and implementation.
import { readFileSync, writeFileSync } from 'node:fs';
const input = JSON.parse(readFileSync('scripts/routes/fixtures/phase-2-redirect-inputs.json', 'utf8'));
const origin = 'https://bloxodes.com';
const headers = { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' };
async function get(path) {
  for (let attempt = 0; ; attempt++) {
    try { return await fetch(new URL(path, origin), { redirect: 'manual', headers, signal: AbortSignal.timeout(20_000) }); }
    catch (error) {
      if (attempt === 3) throw error;
      await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
}
const health = await get('/api/health?scope=deploy');
if (!health.ok) throw new Error(`Production health returned ${health.status}`);
const deploy = await health.json();
const productionSHA = deploy.build?.sha;
if (!productionSHA) throw new Error('Production health did not expose a build SHA');
console.log('Production SHA:', productionSHA);
const cases = new Array(input.urls.length);
const failures = [];
let index = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (index < input.urls.length) {
    const current = index++;
    const url = input.urls[current];
    try {
      const response = await get(url);
      cases[current] = { url, status: response.status, location: response.headers.get('location') };
      await response.body?.cancel();
    } catch { failures.push(url); }
    if ((current + 1) % 100 === 0) console.log(`Captured ${current + 1}/${input.urls.length}`);
  }
}));
const endHealth = await get('/api/health?scope=deploy');
const endDeploy = await endHealth.json();
if (productionSHA !== endDeploy.build?.sha) throw new Error('Production changed builds during capture; capture again');
writeFileSync('scripts/routes/fixtures/phase-2-redirects.json', JSON.stringify({
  capturedAt: new Date().toISOString(), origin, productionSHA,
  counts: input.counts, failures, cases: cases.filter(Boolean)
}, null, 2) + '\n');
console.log(`Captured ${cases.filter(Boolean).length}; failed ${failures.length}`);
if (failures.length) process.exitCode = 1;
