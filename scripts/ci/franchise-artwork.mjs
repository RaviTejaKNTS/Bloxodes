import {createHash} from 'node:crypto';
import sharp from 'sharp';

export const MANAGED_ARTWORK_TARGET = 'https://bbtcaurrtyoukvjbxbbj.supabase.co';
export const ARTWORK_MEDIA_BASE = 'https://media.bloxodes.com/wiki';
export const MAX_ARTWORK_BUNDLE_BYTES = 25 * 1024 * 1024;
export const MAX_ARTWORK_SOURCE_BYTES = 10 * 1024 * 1024;
export const MAX_ARTWORK_PIXELS = 16 * 1024 * 1024;
export const artworkHash = bytes => createHash('sha256').update(bytes).digest('hex');
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const slug = value => typeof value === 'string' && value.length <= 64 && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value);
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
function fields(value, names) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== names.length || names.some(name => !Object.hasOwn(value, name))) throw new Error('Invalid artwork fields.');
}
function provenanceUrl(value) {
  if (typeof value !== 'string' || value.length > 2048 || /[\s\\]/.test(value)) throw new Error('Invalid provenance URL.');
  const url = new URL(value);
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.port) throw new Error('Invalid provenance URL.');
  // Provenance is recorded only. It is never fetched or used as a destination.
}

export function assertArtworkEnvironment(env, checkoutSha) {
  if (env.GITHUB_ACTIONS !== 'true' || env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || env.GITHUB_REPOSITORY !== 'RaviTejaKNTS/Bloxodes' || env.BLOXODES_ENV_PROFILE !== 'process-only' || env.BLOXODES_FRANCHISE_ARTWORK !== 'true') throw new Error('Artwork requires explicit GitHub dispatch.');
  if (!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? '') || env.GITHUB_SHA !== checkoutSha) throw new Error('Artwork checkout must equal the dispatch SHA.');
  if (env.ARTWORK_BUNDLE_SUPABASE_URL !== MANAGED_ARTWORK_TARGET || !env.ARTWORK_BUNDLE_SERVICE_ROLE) throw new Error('Artwork requires the configured private managed-development bundle source.');
  if (!digest(env.FRANCHISE_ARTWORK_BUNDLE_HASH) || !['true', 'false'].includes(env.FRANCHISE_ARTWORK_APPLY)) throw new Error('Artwork requires an exact bundle hash and explicit apply boolean.');
  if (env.SELECTED_FRANCHISE_BUNDLE_HASH || env.SELECTED_ROBLOX_BUNDLE_HASH || env.BLOXODES_CONTENT_RELEASE || env.BLOXODES_MANAGED_RECEIPT || env.BLOXODES_APPROVED_SHA || env.SUPABASE_URL || env.SUPABASE_SERVICE_ROLE || env.REVALIDATE_SECRET || env.NODE_ENV === 'production') throw new Error('Content publication and database credentials cannot enter artwork preparation.');
  return env.FRANCHISE_ARTWORK_APPLY === 'true';
}

export function decodeArtworkBundle(bytes, expectedHash) {
  if (!Buffer.isBuffer(bytes) || bytes.length > MAX_ARTWORK_BUNDLE_BYTES || !digest(expectedHash) || artworkHash(bytes) !== expectedHash) throw new Error('Artwork bundle hash or size mismatch.');
  const bundle = JSON.parse(bytes.toString('utf8'));
  fields(bundle, ['version', 'kind', 'namespace', 'gameSlug', 'assets']);
  if (bundle.version !== 1 || bundle.kind !== 'franchise-hub-artwork' || !slug(bundle.namespace) || bundle.namespace === 'roblox' || !slug(bundle.gameSlug) || !Array.isArray(bundle.assets) || bundle.assets.length !== 2) throw new Error('Invalid artwork identity or role inventory.');
  const roles = new Set(), paths = new Set();
  const assets = bundle.assets.map(asset => {
    const hero = asset?.role === 'hero';
    fields(asset, hero ? ['role', 'source', 'provenance', 'crop'] : ['role', 'source', 'provenance']);
    if (!['cover', 'hero'].includes(asset.role) || roles.has(asset.role)) throw new Error('Artwork requires exactly one cover and one hero.');
    roles.add(asset.role);
    const source = asset.source;
    fields(source, ['path', 'sha256', 'bytes', 'width', 'height', 'mime', 'base64']);
    if (typeof source.path !== 'string' || !/^media\/sources\/[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?\.(png|jpg|jpeg)$/.test(source.path) || source.path.length > 160 || paths.has(source.path)) throw new Error('Unsafe or duplicate artwork source path.');
    paths.add(source.path);
    if (!digest(source.sha256) || !integer(source.bytes, 1, MAX_ARTWORK_SOURCE_BYTES) || !integer(source.width, 1, 8192) || !integer(source.height, 1, 8192) || source.width * source.height > MAX_ARTWORK_PIXELS || !['image/png', 'image/jpeg'].includes(source.mime)) throw new Error('Invalid artwork source limits.');
    if ((source.mime === 'image/png') !== source.path.endsWith('.png')) throw new Error('Artwork extension must match MIME.');
    if (typeof source.base64 !== 'string' || source.base64.length !== 4 * Math.ceil(source.bytes / 3) || !/^[A-Za-z0-9+/]*={0,2}$/.test(source.base64)) throw new Error('Invalid bounded artwork base64.');
    const body = Buffer.from(source.base64, 'base64');
    if (body.length !== source.bytes || body.toString('base64') !== source.base64 || artworkHash(body) !== source.sha256) throw new Error('Artwork source byte count or hash mismatch.');
    fields(asset.provenance, ['kind', 'pageUrl', 'assetUrl', 'credit']);
    if (!['official-store', 'official-publisher', 'official-developer'].includes(asset.provenance.kind) || typeof asset.provenance.credit !== 'string' || !asset.provenance.credit.trim() || asset.provenance.credit.length > 500 || /[\x00-\x1f\x7f]/.test(asset.provenance.credit)) throw new Error('Invalid artwork provenance.');
    provenanceUrl(asset.provenance.pageUrl);
    provenanceUrl(asset.provenance.assetUrl);
    if (hero) {
      const crop = asset.crop;
      fields(crop, ['left', 'top', 'width', 'height']);
      if (!integer(crop.left, 0, source.width - 1) || !integer(crop.top, 0, source.height - 1) || !integer(crop.width, 1, source.width) || !integer(crop.height, 1, source.height) || crop.width !== crop.height || crop.left + crop.width > source.width || crop.top + crop.height > source.height) throw new Error('Hero requires an in-bounds square crop in original pixels.');
    } else if (source.width * 9 !== source.height * 16) throw new Error('Cover must be unmodified true 16:9 artwork.');
    return {...asset, source: {...source, base64: undefined}, body};
  });
  return {version: bundle.version, namespace: bundle.namespace, gameSlug: bundle.gameSlug, assets: ['cover', 'hero'].map(role => assets.find(asset => asset.role === role))};
}

export function artworkLocation(namespace, gameSlug, role, hash, mime) {
  if (!slug(namespace) || namespace === 'roblox' || !slug(gameSlug) || !['cover', 'hero'].includes(role) || !digest(hash) || !['image/png', 'image/jpeg'].includes(mime) || role === 'hero' && mime !== 'image/png') throw new Error('Invalid immutable artwork identity.');
  // The worker strips /wiki/ before reading R2; the object key has no wiki/ prefix.
  const key = `${namespace}/${gameSlug}/hub-${role}-${hash}.${mime === 'image/png' ? 'png' : 'jpg'}`;
  return {key, url: `${ARTWORK_MEDIA_BASE}/${key}`};
}

async function decodedImage(bytes, requireLosslessCrop = false) {
  const image = sharp(bytes, {failOn: 'warning', limitInputPixels: MAX_ARTWORK_PIXELS}).timeout({seconds: 10});
  const meta = await image.metadata();
  if (!['png', 'jpeg'].includes(meta.format) || !meta.width || !meta.height || (meta.pages ?? 1) !== 1 || (meta.orientation ?? 1) !== 1) throw new Error('Artwork must be a single upright PNG or JPEG.');
  if (requireLosslessCrop && (meta.depth !== 'uchar' || meta.space !== 'srgb')) throw new Error('Lossless hero cropping requires an 8-bit RGB source.');
  // Decode every pixel; intact headers with damaged image data are insufficient.
  await image.raw().toBuffer();
  return {width: meta.width, height: meta.height, mime: meta.format === 'png' ? 'image/png' : 'image/jpeg'};
}

export async function prepareArtwork(bundle) {
  const prepared = [];
  for (const asset of bundle.assets) {
    const meta = await decodedImage(asset.body, asset.role === 'hero');
    if (meta.width !== asset.source.width || meta.height !== asset.source.height || meta.mime !== asset.source.mime) throw new Error('Decoded artwork differs from approved source metadata.');
    // `space: srgb` is an RGB interpretation, not proof of a standard sRGB ICC.
    // Keep the original profile so Sharp does not transform the crop's colours.
    const body = asset.role === 'cover' ? asset.body : await sharp(asset.body, {failOn: 'warning', limitInputPixels: MAX_ARTWORK_PIXELS}).timeout({seconds: 10}).extract(asset.crop).keepIccProfile().png({compressionLevel: 9, palette: false}).toBuffer();
    if (body.length > MAX_ARTWORK_SOURCE_BYTES) throw new Error('Prepared artwork exceeds byte limit.');
    const output = await decodedImage(body);
    if (asset.role === 'hero' && (output.width !== asset.crop.width || output.height !== asset.crop.height || output.mime !== 'image/png')) throw new Error('Prepared hero does not match the exact square crop.');
    const sha256 = artworkHash(body);
    prepared.push({role: asset.role, source: asset.source, provenance: asset.provenance, crop: asset.crop ?? null, body, sha256, ...output, ...artworkLocation(bundle.namespace, bundle.gameSlug, asset.role, sha256, output.mime)});
  }
  if (prepared[0].url === prepared[1].url || prepared[0].sha256 === prepared[1].sha256) throw new Error('Cover and hero must be distinct artwork.');
  return prepared;
}

export async function readBoundedBody(response, maxBytes) {
  if (!response.body || Number(response.headers.get('content-length')) > maxBytes) {
    await response.body?.cancel();
    throw new Error('Artwork HTTP body exceeds limit or is missing.');
  }
  const reader = response.body.getReader(), chunks = [];
  let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) return Buffer.concat(chunks, size);
      size += value.byteLength;
      if (size > maxBytes) throw new Error('Artwork HTTP body exceeds limit.');
      chunks.push(value);
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
}

export function assertArtworkR2Config(config) {
  if (!config || !/^https:\/\/[a-f0-9]{32}\.r2\.cloudflarestorage\.com\/?$/.test(config.endpoint) || config.bucket !== 'bloxodes-wiki' || !config.accessKeyId || !config.secretAccessKey) throw new Error('Artwork requires the configured wiki R2 bucket and HTTPS account endpoint.');
}

// Inject into the existing SigV4 R2 client. Never alter its existing callers.
/** @returns {typeof fetch} */
export function artworkR2Fetch(config, assets, fetchImpl = fetch) {
  assertArtworkR2Config(config);
  const paths = new Set(assets.map(asset => `/${config.bucket}/${asset.key}`));
  return async (input, init) => {
    const url = new URL(String(input));
    if (url.origin !== new URL(config.endpoint).origin || url.search || url.hash || !paths.has(url.pathname) || !['HEAD', 'PUT'].includes(init?.method)) throw new Error('Artwork R2 request escaped the exact prepared keys.');
    const headers = new Headers(init.headers);
    // Non-x-amz conditional headers may be sent alongside the SigV4 headers.
    // R2 evaluates this atomically. A racing writer yields 412 and fails safely.
    if (init.method === 'PUT') headers.set('if-none-match', '*');
    const response = await fetchImpl(input, {...init, headers, redirect: 'manual', signal: AbortSignal.timeout(30_000)});
    if (!response.ok) {
      await response.body?.cancel();
      // Do not let the shared client's error include remote bodies or credentials.
      return new Response(null, {status: response.status});
    }
    return response;
  };
}

async function readback(asset, fetchImpl) {
  const response = await fetchImpl(asset.url, {redirect: 'manual', signal: AbortSignal.timeout(30_000)});
  const mime = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (response.status !== 200 || mime !== asset.mime) {
    await response.body?.cancel();
    throw new Error('Artwork public readback failed HTTP or MIME verification.');
  }
  const bytes = await readBoundedBody(response, MAX_ARTWORK_SOURCE_BYTES);
  if (bytes.length !== asset.body.length || artworkHash(bytes) !== asset.sha256) throw new Error('Immutable artwork key contains different bytes; refusing replacement.');
  const meta = await decodedImage(bytes);
  if (meta.width !== asset.width || meta.height !== asset.height || meta.mime !== asset.mime) throw new Error('Artwork public dimensions differ.');
  return {status: 'verified', httpStatus: response.status, ...meta, bytes: bytes.length, sha256: artworkHash(bytes)};
}

// All network destinations are fixed/configured here. The bundle controls no URLs.
export async function runArtwork({env, checkoutSha, fetchImpl = fetch, createStore, saveArtifacts, saveReport}) {
  const apply = assertArtworkEnvironment(env, checkoutSha);
  const hash = env.FRANCHISE_ARTWORK_BUNDLE_HASH;
  const response = await fetchImpl(`${MANAGED_ARTWORK_TARGET}/storage/v1/object/authenticated/ci-release-bundles/${hash}.json`, {
    method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(30_000),
    headers: {apikey: env.ARTWORK_BUNDLE_SERVICE_ROLE, authorization: `Bearer ${env.ARTWORK_BUNDLE_SERVICE_ROLE}`}
  });
  if (response.status !== 200) { await response.body?.cancel(); throw new Error('Exact private artwork bundle is unavailable.'); }
  const bundle = decodeArtworkBundle(await readBoundedBody(response, MAX_ARTWORK_BUNDLE_BYTES), hash);
  const assets = await prepareArtwork(bundle);
  // Save derived pixels before any R2 operation so failed uploads remain reviewable.
  await saveArtifacts(assets);
  const report = {
    version: 1, status: apply ? 'prepared-for-apply' : 'dry-run', apply,
    sourceSha: checkoutSha, bundleHash: hash, runId: env.GITHUB_RUN_ID, runAttempt: env.GITHUB_RUN_ATTEMPT,
    namespace: bundle.namespace, gameSlug: bundle.gameSlug,
    databaseWrites: false, visualReview: 'pending-parent-inspection', failureStage: null,
    assets: assets.map(({body, ...asset}) => ({...asset, bytes: body.length, upload: 'not-attempted', readback: {status: 'not-attempted'}}))
  };
  await saveReport(report);
  if (!apply) return report; // No R2 config, HEAD, upload, or public request in dry-run.
  let stage = 'configure-r2';
  try {
    const store = createStore(assets);
    // Preflight every existing object before uploading either role.
    stage = 'verify-existing-objects';
    const exists = [];
    for (const [index, asset] of assets.entries()) {
      exists[index] = await store.hasObject(asset.key);
      if (exists[index]) {
        report.assets[index].readback = await readback(asset, fetchImpl);
        report.assets[index].upload = 'reused-identical';
        await saveReport(report);
      }
    }
    stage = 'create-missing-objects';
    for (const [index, asset] of assets.entries()) {
      if (exists[index]) continue;
      report.assets[index].upload = 'attempting-create';
      await saveReport(report);
      await store.putObject({key: asset.key, body: asset.body, contentType: asset.mime, metadata: {sha256: asset.sha256, width: asset.width, height: asset.height}});
      report.assets[index].upload = 'created';
      await saveReport(report);
    }
    // Both URLs must read back again, including previously existing objects.
    stage = 'verify-both-public-urls';
    for (const [index, asset] of assets.entries()) {
      report.assets[index].readback = await readback(asset, fetchImpl);
      await saveReport(report);
    }
    report.status = 'hosted-and-byte-verified';
    await saveReport(report);
    return report;
  } catch (error) {
    report.status = 'failed';
    report.failureStage = stage;
    await saveReport(report);
    throw error;
  }
}
