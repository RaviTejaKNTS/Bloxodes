import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import sharp from 'sharp';
import {parse} from 'yaml';
import {
  ARTWORK_MEDIA_BASE, MANAGED_ARTWORK_TARGET, MAX_ARTWORK_BUNDLE_BYTES,
  artworkHash, artworkLocation, artworkR2Fetch, assertArtworkEnvironment,
  assertArtworkR2Config, decodeArtworkBundle, prepareArtwork, readBoundedBody, runArtwork
} from '../franchise-artwork.mjs';

const sha = 'a'.repeat(40);
const env = hash => ({GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REPOSITORY: 'RaviTejaKNTS/Bloxodes', GITHUB_SHA: sha, BLOXODES_ENV_PROFILE: 'process-only', BLOXODES_FRANCHISE_ARTWORK: 'true', ARTWORK_BUNDLE_SUPABASE_URL: MANAGED_ARTWORK_TARGET, ARTWORK_BUNDLE_SERVICE_ROLE: 'fixture-key', FRANCHISE_ARTWORK_BUNDLE_HASH: hash, FRANCHISE_ARTWORK_APPLY: 'false', GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '1'});
const provenance = {kind: 'official-publisher', pageUrl: 'https://example.com/game', assetUrl: 'https://example.com/original.png', credit: 'Developer/Publisher'};
const encode = value => { const bytes = Buffer.from(JSON.stringify(value)); return {bytes, hash: artworkHash(bytes)}; };
const source = (name, bytes, width, height, mime) => ({path: `media/sources/${name}`, sha256: artworkHash(bytes), bytes: bytes.length, width, height, mime, base64: bytes.toString('base64')});
async function fixture() {
  const cover = await sharp({create: {width: 16, height: 9, channels: 3, background: '#abc123'}}).jpeg().toBuffer();
  const pixels = Buffer.from(Array.from({length: 12 * 8 * 3}, (_, index) => index % 256));
  const hero = await sharp(pixels, {raw: {width: 12, height: 8, channels: 3}}).png().toBuffer();
  return {pixels, cover, value: {version: 1, kind: 'franchise-hub-artwork', namespace: 'example', gameSlug: 'example-game', assets: [
    {role: 'cover', source: source('cover-original.jpg', cover, 16, 9, 'image/jpeg'), provenance},
    {role: 'hero', source: source('hero-original.png', hero, 12, 8, 'image/png'), provenance, crop: {left: 3, top: 1, width: 4, height: 4}}
  ]}};
}
const decode = value => { const {bytes, hash} = encode(value); return decodeArtworkBundle(bytes, hash); };
const config = () => ({endpoint: `https://${'a'.repeat(32)}.r2.cloudflarestorage.com`, bucket: 'bloxodes-wiki', accessKeyId: 'fixture-id', secretAccessKey: 'fixture-secret'});

test('artwork requires exact GitHub dispatch, SHA, managed source, isolation and apply boolean', () => {
  const valid = env('b'.repeat(64));
  assert.equal(assertArtworkEnvironment(valid, sha), false);
  assert.equal(assertArtworkEnvironment({...valid, FRANCHISE_ARTWORK_APPLY: 'true'}, sha), true);
  const mutations = {GITHUB_ACTIONS: 'false', GITHUB_EVENT_NAME: 'pull_request', GITHUB_REPOSITORY: 'other/repository', GITHUB_SHA: 'b'.repeat(40), BLOXODES_ENV_PROFILE: 'managed-dev', BLOXODES_FRANCHISE_ARTWORK: '', ARTWORK_BUNDLE_SUPABASE_URL: 'https://database.bloxodes.com', ARTWORK_BUNDLE_SERVICE_ROLE: '', FRANCHISE_ARTWORK_BUNDLE_HASH: '../escape', FRANCHISE_ARTWORK_APPLY: '1', SELECTED_FRANCHISE_BUNDLE_HASH: 'x', SELECTED_ROBLOX_BUNDLE_HASH: 'x', BLOXODES_CONTENT_RELEASE: 'true', BLOXODES_MANAGED_RECEIPT: 'receipt', BLOXODES_APPROVED_SHA: sha, SUPABASE_URL: MANAGED_ARTWORK_TARGET, SUPABASE_SERVICE_ROLE: 'unexpected', REVALIDATE_SECRET: 'unexpected', NODE_ENV: 'production'};
  for (const [key, value] of Object.entries(mutations)) assert.throws(() => assertArtworkEnvironment({...valid, [key]: value}, sha), undefined, key);
});

test('only bounded art-only bundles with exact roles, hashes, metadata and safe source labels parse', async () => {
  const {value} = await fixture();
  assert.equal(decode(value).assets.length, 2);
  const frozen = encode(value);
  assert.throws(() => decodeArtworkBundle(frozen.bytes, 'f'.repeat(64)), /hash/);
  assert.throws(() => decodeArtworkBundle(Buffer.alloc(MAX_ARTWORK_BUNDLE_BYTES + 1), frozen.hash), /size/);
  const mutations = [
    item => { item.batch = {operations: []}; },
    item => { item.namespace = '../escape'; },
    item => { item.namespace = 'roblox'; },
    item => { item.gameSlug = 'a/b'; },
    item => { item.assets.push(item.assets[0]); },
    item => { item.assets[1].role = 'cover'; delete item.assets[1].crop; },
    item => { item.assets[1].role = 'logo'; },
    item => { item.assets[0].key = 'arbitrary/key'; },
    item => { item.assets[0].url = 'https://evil.example/write'; },
    item => { item.assets[0].source.sha256 = 'f'.repeat(64); },
    item => { item.assets[0].source.bytes++; },
    item => { item.assets[0].source.bytes = 10 * 1024 * 1024 + 1; },
    item => { item.assets[0].source.base64 += '\n'; },
    item => { item.assets[0].source.base64 = '!'.repeat(item.assets[0].source.base64.length); },
    item => { item.assets[0].source.width = 8192; item.assets[0].source.height = 8192; },
    item => { item.assets[0].source.width = 15; },
    item => { item.assets[0].source.mime = 'image/svg+xml'; },
    item => { item.assets[0].source.path = 'media/sources/a.png'; },
    item => { item.assets[0].provenance.kind = 'unknown'; },
    item => { item.assets[0].provenance.credit = ''; },
    item => { item.assets[0].provenance.assetUrl = 'file:///etc/passwd'; },
    item => { item.assets[0].provenance.pageUrl = 'https://user:password@example.com/'; }
  ];
  for (const mutate of mutations) { const item = structuredClone(value); mutate(item); assert.throws(() => decode(item)); }
  for (const name of ['/etc/passwd', '../original.jpg', 'media/sources/../cover.jpg', 'media\\sources\\cover.jpg', 'media/sources/.hidden.jpg', 'media/sources/cover.jpg?x=1', 'media/sources/%2e%2e.jpg']) {
    const item = structuredClone(value); item.assets[0].source.path = name; assert.throws(() => decode(item), undefined, name);
  }
});

test('crop rejects resize options, fractional/negative bounds, rectangles and off-canvas squares', async () => {
  const {value} = await fixture();
  for (const crop of [{left: -1, top: 0, width: 4, height: 4}, {left: 0.5, top: 0, width: 4, height: 4}, {left: 0, top: 0, width: 4, height: 3}, {left: 10, top: 0, width: 4, height: 4}, {left: 0, top: 7, width: 4, height: 4}, {left: 0, top: 0, width: 0, height: 0}, {left: 0, top: 0, width: 4, height: 4, resize: 800}]) {
    const item = structuredClone(value); item.assets[1].crop = crop; assert.throws(() => decode(item), /crop|fields/);
  }
});

test('cover bytes stay identical; PNG hero contains exactly the selected original pixels', async () => {
  const {value, cover, pixels} = await fixture();
  const assets = await prepareArtwork(decode(value));
  assert.deepEqual(assets[0].body, cover);
  assert.equal(assets[0].sha256, artworkHash(cover));
  const hero = await sharp(assets[1].body).raw().toBuffer({resolveWithObject: true});
  assert.equal(hero.info.width, 4); assert.equal(hero.info.height, 4); assert.equal(hero.info.channels, 3);
  const expected = Buffer.concat(Array.from({length: 4}, (_, row) => pixels.subarray(((row + 1) * 12 + 3) * 3, ((row + 1) * 12 + 7) * 3)));
  assert.deepEqual(hero.data, expected);
  assert.equal(assets[1].mime, 'image/png');
  assert.notEqual(assets[0].url, assets[1].url);
  assert.equal(assets[1].key, `example/example-game/hub-hero-${assets[1].sha256}.png`);
  assert.equal(assets[1].url, `${ARTWORK_MEDIA_BASE}/${assets[1].key}`);
  const changed = structuredClone(value); changed.assets[1].crop.left++;
  assert.notEqual((await prepareArtwork(decode(changed)))[1].key, assets[1].key);
  assert.throws(() => artworkLocation('../x', 'game', 'hero', 'a'.repeat(64), 'image/png'));
  assert.throws(() => artworkLocation('example', 'game', 'hero', 'a'.repeat(64), 'image/jpeg'));
});

test('profiled PNG hero preserves original channel values and embedded ICC bytes', async () => {
  const {value, cover} = await fixture();
  // Build a non-sRGB RGB fixture on GitHub using Sharp's built-in Display P3 ICC.
  const swatches = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 0, 255]];
  const pixels = Buffer.from(Array.from({length: 12 * 8}, (_, pixel) => swatches[pixel % swatches.length]).flat());
  const original = await sharp(pixels, {raw: {width: 12, height: 8, channels: 3}}).withIccProfile('p3').png().toBuffer();
  value.assets[1].source = source('hero-original.png', original, 12, 8, 'image/png');
  const inputMeta = await sharp(original).metadata();
  assert.equal(inputMeta.space, 'srgb'); // RGB interpretation also accepts P3.
  assert.equal(inputMeta.depth, 'uchar');
  assert.ok(inputMeta.icc?.length, 'fixture must contain an embedded ICC profile');

  // Disable ICC conversion explicitly on BOTH decoders. Comparing default
  // sRGB-converted decodes could hide a transform in the production pipeline.
  const input = await sharp(original, {ignoreIcc: true}).raw().toBuffer({resolveWithObject: true});
  assert.equal(input.info.channels, 3);
  const {left, top, width, height} = value.assets[1].crop;
  const expected = Buffer.concat(Array.from({length: height}, (_, row) => input.data.subarray(((row + top) * input.info.width + left) * 3, ((row + top) * input.info.width + left + width) * 3)));
  // Ensure this fixture exposes the old default conversion, rather than merely
  // having a profile whose conversion happens to leave these pixels unchanged.
  const converted = await sharp(original).extract(value.assets[1].crop).raw().toBuffer();
  assert.notDeepEqual(converted, expected);

  const assets = await prepareArtwork(decode(value));
  assert.deepEqual(assets[0].body, cover);
  const output = await sharp(assets[1].body, {ignoreIcc: true}).raw().toBuffer({resolveWithObject: true});
  assert.equal(output.info.width, width); assert.equal(output.info.height, height); assert.equal(output.info.channels, 3);
  assert.deepEqual(output.data, expected);
  assert.deepEqual((await sharp(assets[1].body).metadata()).icc, inputMeta.icc);
});

test('non-image and truncated pixel data fail even with matching input hashes; metadata is verified', async () => {
  const {value} = await fixture();
  for (const body of [Buffer.from('not an image'), Buffer.from(value.assets[1].source.base64, 'base64').subarray(0, 40)]) {
    const item = structuredClone(value); item.assets[1].source = source('hero-original.png', body, 12, 8, 'image/png');
    await assert.rejects(prepareArtwork(decode(item)));
  }
  const item = structuredClone(value); item.assets[1].source.width++;
  await assert.rejects(prepareArtwork(decode(item)), /metadata/);
});

test('R2 adapter validates target, bounds signed requests, adds atomic no-overwrite and blocks redirects', async () => {
  for (const mutation of [{bucket: 'other'}, {endpoint: 'http://localhost'}, {endpoint: `https://${'a'.repeat(32)}.r2.cloudflarestorage.com/extra`}, {accessKeyId: ''}, {secretAccessKey: ''}]) assert.throws(() => assertArtworkR2Config({...config(), ...mutation}));
  const key = 'example/example-game/hub-hero-' + 'a'.repeat(64) + '.png';
  const calls = [];
  const send = artworkR2Fetch(config(), [{key}], async (input, init) => {calls.push({input, init}); return new Response('do not log this body', {status: 412});});
  const url = `${config().endpoint}/${config().bucket}/${key}`;
  const result = await send(url, {method: 'PUT', headers: {authorization: 'fixture-signature'}, body: Buffer.from('test')});
  assert.equal(result.status, 412); assert.equal(await result.text(), '');
  assert.equal(calls[0].init.headers.get('if-none-match'), '*');
  assert.equal(calls[0].init.headers.get('authorization'), 'fixture-signature');
  assert.equal(calls[0].init.redirect, 'manual'); assert.ok(calls[0].init.signal);
  for (const [destination, method] of [[url, 'DELETE'], [url.replace(key, 'other-key'), 'PUT'], ['https://evil.example/a', 'PUT'], [url + '?x=1', 'HEAD']]) await assert.rejects(send(destination, {method, headers: {}}));
  assert.equal(calls.length, 1);
});

test('HTTP bodies are bounded with and without content-length', async () => {
  await assert.rejects(readBoundedBody(new Response('too large', {headers: {'content-length': '100'}}), 3), /limit/);
  await assert.rejects(readBoundedBody(new Response('too large'), 3), /limit/);
  assert.equal((await readBoundedBody(new Response('ok'), 3)).toString(), 'ok');
});

async function harness({apply = false, existing = false, corrupt = false, mime = false, redirect = false, missingConfig = false} = {}) {
  const {value} = await fixture(), frozen = encode(value);
  const calls = [], puts = [], reports = [];
  let prepared;
  const result = runArtwork({
    env: {...env(frozen.hash), FRANCHISE_ARTWORK_APPLY: String(apply)}, checkoutSha: sha,
    async fetchImpl(url, init) {
      calls.push({url, init});
      if (calls.length === 1) {
        assert.equal(url, `${MANAGED_ARTWORK_TARGET}/storage/v1/object/authenticated/ci-release-bundles/${frozen.hash}.json`);
        assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'manual');
        return new Response(frozen.bytes);
      }
      const asset = prepared.find(asset => asset.url === url);
      assert.ok(asset, 'only derived fixed-origin media URLs may be fetched');
      assert.equal(init.redirect, 'manual'); assert.ok(init.signal);
      return new Response(corrupt ? 'wrong bytes' : asset.body, {status: redirect ? 302 : 200, headers: {'content-type': mime ? 'text/html' : asset.mime}});
    },
    createStore() {
      calls.push({store: true});
      if (missingConfig) throw new Error('Missing R2 config');
      return {async hasObject(key) {calls.push({head: key}); return existing;}, async putObject(input) {puts.push(input);}};
    },
    async saveArtifacts(assets) {prepared = assets;},
    async saveReport(report) {reports.push(structuredClone(report));}
  });
  return {result, calls, puts, reports, frozen};
}

test('dry-run reads only the exact private Storage object and never opens R2 or public media', async () => {
  const work = await harness(); const report = await work.result;
  assert.equal(work.calls.length, 1); assert.equal(work.puts.length, 0);
  assert.equal(report.status, 'dry-run'); assert.equal(report.databaseWrites, false);
  assert.equal(report.visualReview, 'pending-parent-inspection');
  assert.equal(report.assets[1].source.base64, undefined);
  assert.equal(JSON.stringify(report).includes('fixture-key'), false);
  assert.ok(report.assets.every(asset => asset.readback.status === 'not-attempted'));
});

test('apply uploads only missing roles and verifies both public output hashes and dimensions', async () => {
  const work = await harness({apply: true}); const report = await work.result;
  assert.equal(work.puts.length, 2); assert.equal(report.status, 'hosted-and-byte-verified');
  assert.ok(report.assets.every(asset => asset.readback.status === 'verified' && asset.upload === 'created'));
  for (const asset of report.assets) {assert.equal(asset.readback.sha256, asset.sha256); assert.equal(asset.readback.width, asset.width); assert.equal(asset.readback.height, asset.height);}
  assert.equal(report.visualReview, 'pending-parent-inspection');
});

test('identical existing keys are idempotent; conflicting bytes fail before any upload', async () => {
  const identical = await harness({apply: true, existing: true});
  assert.equal((await identical.result).status, 'hosted-and-byte-verified');
  assert.equal(identical.puts.length, 0);
  const wrong = await harness({apply: true, existing: true, corrupt: true});
  await assert.rejects(wrong.result, /different bytes/);
  assert.equal(wrong.puts.length, 0); assert.equal(wrong.reports.at(-1).status, 'failed');
  assert.equal(wrong.reports.at(-1).failureStage, 'verify-existing-objects');
});

test('a failed readback after upload records partial side effects and cannot claim readiness', async () => {
  const work = await harness({apply: true, corrupt: true});
  await assert.rejects(work.result, /different bytes/);
  assert.equal(work.puts.length, 2);
  const report = work.reports.at(-1);
  assert.equal(report.status, 'failed');
  assert.equal(report.failureStage, 'verify-both-public-urls');
  assert.ok(report.assets.every(asset => asset.upload === 'created'));
  assert.equal(report.visualReview, 'pending-parent-inspection');
});

test('apply refuses missing R2 configuration, redirects and MIME substitution without claiming success', async () => {
  for (const options of [{missingConfig: true}, {mime: true, existing: true}, {redirect: true, existing: true}]) {
    const work = await harness({apply: true, ...options});
    await assert.rejects(work.result);
    assert.equal(work.puts.length, 0);
    assert.equal(work.reports.at(-1).status, 'failed');
  }
});

test('artwork dispatch is isolated from database jobs and credentials in the existing workflow', () => {
  const workflow = parse(fs.readFileSync('.github/workflows/pull-request.yml', 'utf8'));
  const job = workflow.jobs['franchise-hub-artwork'];
  assert.equal(job.environment, 'franchise-artwork');
  assert.equal(job.steps[0].with.ref, '${{ github.sha }}');
  assert.equal(job.steps[0].with['persist-credentials'], false);
  assert.ok(!Object.keys(job.env).some(key => ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE', 'REVALIDATE_SECRET'].includes(key)));
  assert.ok(!job.steps.some(step => /publish-content|schema-release|selected-franchise-qa/.test(step.run ?? '')));
  const prepare = job.steps.find(step => step.run?.includes('prepare-franchise-artwork.ts'));
  assert.equal(Object.keys(prepare.env).filter(key => key.startsWith('WIKI_R2_')).length, 4);
  assert.ok(Object.values(prepare.env).every(value => value.includes('inputs.franchise_artwork_apply && secrets.WIKI_R2_')));
});

const workflow = () => parse(fs.readFileSync('.github/workflows/pull-request.yml', 'utf8'));
const dispatchInputs = overrides => ({franchise_artwork_bundle_hash: '', franchise_artwork_apply: false, selected_franchise_bundle_hash: '', selected_roblox_bundle_hash: '', selected_franchise_stage: false, ...overrides});
const isolatedJobs = ['scope', 'required', 'selected-franchise-development-qa', 'selected-roblox-development-qa'];
function eligibleJobs(inputs, event = 'workflow_dispatch') {
  // These five workflow conditions use only boolean operators, context values
  // and always(); evaluate their actual YAML expressions with typed inputs.
  const jobs = workflow().jobs;
  return [...isolatedJobs, 'franchise-hub-artwork'].filter(name => runInNewContext(jobs[name].if, {github: {event_name: event}, inputs, always: () => true}));
}
function initialArtworkGuard(inputs, overrides = {}) {
  const job = workflow().jobs['franchise-hub-artwork'];
  const guard = job.steps[1];
  assert.match(guard.name, /Require explicit isolated artwork/);
  assert.ok(job.steps.slice(0, 2).every(step => !/npm|download|prepare-franchise-artwork\.ts/.test(step.run ?? '')));
  assert.match(job.steps[2].uses, /^actions\/setup-node@/);
  // Stub only the checkout identity; execute the real initial Bash guard on
  // GitHub without installing anything or contacting Storage/R2.
  const result = spawnSync('bash', ['-e', '-c', 'git() { test "$*" = "rev-parse HEAD" || return 1; printf "%s\\n" "$TEST_CHECKOUT_SHA"; }\n' + guard.run], {encoding: 'utf8', env: {
    PATH: '/usr/bin:/bin', TEST_CHECKOUT_SHA: sha, GITHUB_SHA: sha, GITHUB_EVENT_NAME: 'workflow_dispatch',
    ARTWORK_BUNDLE_SUPABASE_URL: MANAGED_ARTWORK_TARGET,
    FRANCHISE_ARTWORK_BUNDLE_HASH: inputs.franchise_artwork_bundle_hash,
    SELECTED_FRANCHISE_BUNDLE_HASH: inputs.selected_franchise_bundle_hash,
    SELECTED_ROBLOX_BUNDLE_HASH: inputs.selected_roblox_bundle_hash,
    SELECTED_FRANCHISE_STAGE: String(inputs.selected_franchise_stage), ...overrides
  }});
  assert.ifError(result.error);
  return result.status;
}

test('apply without artwork hash selects only artwork and fails its pre-install guard, even with content selectors', () => {
  for (const selectors of [{}, {selected_franchise_bundle_hash: 'c'.repeat(64)}, {selected_franchise_stage: true}, {selected_franchise_bundle_hash: 'c'.repeat(64), selected_franchise_stage: true}, {selected_roblox_bundle_hash: 'd'.repeat(64)}, {selected_franchise_bundle_hash: 'c'.repeat(64), selected_roblox_bundle_hash: 'd'.repeat(64), selected_franchise_stage: true}]) {
    const inputs = dispatchInputs({franchise_artwork_apply: true, ...selectors});
    assert.deepEqual(eligibleJobs(inputs), ['franchise-hub-artwork']);
    assert.notEqual(initialArtworkGuard(inputs), 0);
  }
  // Downstream database checks depend on scope, so a skipped scope cannot
  // leave an independent ordinary database job eligible.
  assert.equal(workflow().jobs['managed-development'].needs, 'scope');
  assert.ok(workflow().jobs.checks.needs.includes('scope'));
});

test('valid isolated artwork dry-run/apply pass initial guard; malformed hashes and mixed selectors fail', () => {
  for (const apply of [false, true]) {
    const inputs = dispatchInputs({franchise_artwork_bundle_hash: 'b'.repeat(64), franchise_artwork_apply: apply});
    assert.deepEqual(eligibleJobs(inputs), ['franchise-hub-artwork']);
    assert.equal(initialArtworkGuard(inputs), 0);
    for (const selectors of [{selected_franchise_bundle_hash: 'c'.repeat(64)}, {selected_roblox_bundle_hash: 'd'.repeat(64)}, {selected_franchise_stage: true}]) {
      const mixed = {...inputs, ...selectors};
      assert.deepEqual(eligibleJobs(mixed), ['franchise-hub-artwork']);
      assert.notEqual(initialArtworkGuard(mixed), 0);
    }
    for (const hash of ['B'.repeat(64), 'b'.repeat(63), 'b'.repeat(65), 'z'.repeat(64), '../bundle']) {
      const invalid = {...inputs, franchise_artwork_bundle_hash: hash};
      assert.deepEqual(eligibleJobs(invalid), ['franchise-hub-artwork']);
      assert.notEqual(initialArtworkGuard(invalid), 0);
    }
    for (const overrides of [{GITHUB_EVENT_NAME: 'pull_request'}, {ARTWORK_BUNDLE_SUPABASE_URL: 'https://database.bloxodes.com'}, {GITHUB_SHA: 'e'.repeat(40)}]) assert.notEqual(initialArtworkGuard(inputs, overrides), 0);
  }
});

test('ordinary PR and non-artwork dispatch routing stays unchanged', () => {
  assert.deepEqual(eligibleJobs(dispatchInputs(), 'pull_request'), ['scope', 'required']);
  // PR routing remains ordinary even if an input context is supplied.
  assert.deepEqual(eligibleJobs(dispatchInputs({franchise_artwork_apply: true, franchise_artwork_bundle_hash: 'b'.repeat(64)}), 'pull_request'), ['scope', 'required']);
  assert.deepEqual(eligibleJobs(dispatchInputs()), ['scope', 'required']);
  assert.deepEqual(eligibleJobs(dispatchInputs({selected_franchise_bundle_hash: 'c'.repeat(64), selected_franchise_stage: true})), ['scope', 'required', 'selected-franchise-development-qa']);
  assert.deepEqual(eligibleJobs(dispatchInputs({selected_roblox_bundle_hash: 'd'.repeat(64)})), ['scope', 'required', 'selected-roblox-development-qa']);
});
