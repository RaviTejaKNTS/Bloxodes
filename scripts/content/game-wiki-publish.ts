import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { wikiMediaPublicBaseUrl } from "@/lib/wiki-media";
import { bundleSchema, gameSchema, hubFinalSchema, collectionFinalSchema } from "../../contracts/game-wiki/v1/schema";
import { assertGameWikiRoutes, assertNoRobloxIdentifiers, gameWikiPath, selectGameWikiPages, resolveGameWikiIdentity } from "../shared/game-wiki-bundle";
import { bundlePath, assertCollectionMissingImages } from "../shared/roblox-wiki-bundle";
import { assertLocalContentPublication } from "../shared/local-content-publication-guard";
import { revalidatePublishedContent } from "../shared/revalidate-published-content";
import { verifyFranchisePageImage, MAX_FRANCHISE_IMAGE_BYTES, MAX_FRANCHISE_IMAGE_PIXELS } from "../shared/franchise-page-images";
import { requireFranchiseHubImages, requireFranchiseCollectionImage } from "../ci/franchise-image-contract.mjs";
import { loadR2ClientConfig, R2Client } from "../shared/r2-client";
import { uploadCollectionImages, verifyCollectionImages } from "../shared/franchise-collection-media";
import { gameFields, wikiFields, pick, saveFranchiseWikiPage } from "../franchise/publish-franchise-wiki-hubs";
import { planManifest, pageCopy, applyPlan, type Plan } from "../franchise/sync-franchise-collection-runtime";
import { auditDataset, type Issue } from "../collections/audit-game-collection-datasets-v2";
import { validateWikiControlsJson } from "../shared/wiki-controls";
import { checkCopy, equalFields, verifyLive } from "./roblox-wiki-publish";
import type { ContentOptions } from "./roblox-wiki-cli";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const json = async (file: string) => JSON.parse(await fs.readFile(file, "utf8"));
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

export async function planGameWikiImage(root: string, value: string, namespace: string, gameSlug: string, role: "cover" | "hero") {
  let bytes: Buffer;
  let metadata: sharp.Metadata;
  const mediaSlug = namespace === "minecraft" ? "minecraft" : gameSlug;
  if (/^https?:/.test(value)) {
    if (!value.startsWith(`https://media.bloxodes.com/wiki/${namespace}/${mediaSlug}/`)) throw new Error(`${role}: use hosted artwork under this game's R2 prefix or a local bundle file.`);
    const image = await verifyFranchisePageImage({ url: value, role: role === "hero" ? "thumbnail" : "cover", label: gameSlug });
    bytes = image.bytes;
    metadata = image.metadata;
  } else {
    const file = await bundlePath(root, value);
    if ((await fs.stat(file)).size > MAX_FRANCHISE_IMAGE_BYTES) throw new Error(`${role}: image exceeds byte limit.`);
    bytes = await fs.readFile(file);
    const decoder = sharp(bytes, { failOn: "warning", limitInputPixels: MAX_FRANCHISE_IMAGE_PIXELS });
    metadata = await decoder.metadata();
    await decoder.timeout({ seconds: 10 }).raw().toBuffer();
  }
  const { width, height, format } = metadata;
  const mime: Record<string, string> = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp", avif: "image/avif", gif: "image/gif" };
  if (!width || !height || !format || !mime[format]) throw new Error(`${role}: unsupported or unreadable image.`);
  if (role === "cover" && Math.abs(width / height - 16 / 9) > 0.01) throw new Error(`${gameSlug}: cover_image must be 16:9 (${width}x${height}).`);
  if (role === "hero" && width !== height) throw new Error(`${gameSlug}: hero_image must be square (${width}x${height}).`);
  const hash = digest(bytes);
  const key = `${namespace}/${mediaSlug}/hub-${role}-${hash.slice(0, 16)}.${format === "jpeg" ? "jpg" : format}`;
  return { bytes, key, url: `https://media.bloxodes.com/wiki/${key}`, mime: mime[format], hash, width, height };
}

async function rows(db: SupabaseClient, table: string, namespace: string) {
  const result: Array<Record<string, any>> = [];
  for (let offset = 0; ; offset += 500) {
    const response = await db.from(table).select("*").eq("namespace", namespace).order("id").range(offset, offset + 499);
    if (response.error) throw response.error;
    result.push(...response.data ?? []);
    if ((response.data?.length ?? 0) < 500) return result;
  }
}

async function verifyCollection(db: SupabaseClient, plan: Plan, route: string) {
  const page = await db.from("game_collection_pages").select("*").eq("namespace", plan.namespace).eq("wiki_slug", plan.manifest.game.slug).eq("collection_slug", plan.manifest.collection.slug).single();
  if (page.error) throw page.error;
  equalFields(page.data, { ...pageCopy(plan), code: plan.code, canonical_path: route, page_type: plan.pageType, item_count: plan.items.length, is_published: true }, plan.code);
  const revision = await db.from("game_collection_datasets").select("*").eq("namespace", plan.namespace).eq("id", page.data.published_dataset_id).single();
  if (revision.error) throw revision.error;
  equalFields(revision.data, { collection_page_id: page.data.id, content_hash: plan.contentHash, item_count: plan.items.length, meta_json: plan.metaJson }, `${plan.code} revision`);
  const expected = new Map(plan.items.map(({ prepared_image: _bytes, ...item }) => [item.item_slug, item]));
  for (let offset = 0; ; offset += 500) {
    const response = await db.from("game_collection_items").select("*").eq("namespace", plan.namespace).eq("dataset_id", revision.data.id).order("item_slug").range(offset, offset + 499);
    if (response.error) throw response.error;
    for (const row of response.data ?? []) {
      const item = expected.get(row.item_slug);
      if (!item) throw new Error(`${plan.code}: unexpected stored item ${row.item_slug}.`);
      equalFields(row, item, `${plan.code}/${row.item_slug}`);
      expected.delete(row.item_slug);
    }
    if ((response.data?.length ?? 0) < 500) break;
  }
  if (expected.size) throw new Error(`${plan.code}: incomplete item readback.`);
}

export async function publishGameBundle(options: ContentOptions, db: SupabaseClient = supabaseAdmin()) {
  // These gates also protect programmatic callers; the CLI checks them earlier.
  if (options.allowProd && (!options.apply || options.target !== "production")) throw new Error("--allow-prod requires --target production --apply.");
  if (options.target === "production" && options.apply && !options.allowProd) throw new Error("Production apply requires --allow-prod.");
  const root = await fs.realpath(path.resolve(options.bundle!));
  const raw = await json(await bundlePath(root, "bundle.json"));
  assertNoRobloxIdentifiers(raw, "bundle.json");
  const bundle = bundleSchema.parse(raw);
  if (!bundle.hub && !bundle.collections?.length) throw new Error("Supply a hub and/or collections in bundle.json.");
  const selected = await selectGameWikiPages(bundle, options.only, async file => json(await bundlePath(root, file)));
  await assertGameWikiRoutes({ ...bundle, collections: selected.collections.map(row => row.entry) }, path.join(repoRoot, "apps/web/src/app/(site)"));
  console.log(`${options.apply ? "Apply preflight" : "Dry run"}: game-wiki@1, ${bundle.namespace}/${bundle.game.slug}, target=${options.target}`);
  if (options.target === "production") await assertLocalContentPublication();
  const gameFile = await json(await bundlePath(root, "game.json"));
  assertNoRobloxIdentifiers(gameFile, "game.json");
  const gameInput = gameSchema.parse(gameFile);
  if (gameInput.slug !== bundle.game.slug || gameInput.title !== bundle.game.name || gameInput.namespace != null && gameInput.namespace !== bundle.namespace || gameInput.kind != null && gameInput.kind !== bundle.game.kind || gameInput.parent_slug != null && gameInput.parent_slug !== bundle.game.parent) throw new Error("game.json identity must match bundle.namespace and bundle.game.");
  checkCopy({ ...gameInput, description_json: { title: gameInput.title, short_title: gameInput.short_title } }, "game.json");
  const games = await rows(db, "games", bundle.namespace);
  const hubs = await rows(db, "game_wiki_pages", bundle.namespace);
  const identity = resolveGameWikiIdentity(games, hubs, bundle.namespace, bundle.game);
  const wikiPath = identity.hub?.canonical_path ?? gameWikiPath(bundle.namespace, bundle.game.slug, bundle.game.parent);
  if (!wikiPath.startsWith(`/${bundle.namespace}/`) || /[?#]/.test(wikiPath)) throw new Error("Stored wiki route is outside its namespace.");
  const failures: string[] = [];
  async function check<T>(label: string, work: () => Promise<T>): Promise<T | undefined> {
    try { const result = await work(); console.log(`PASS ${label}`); return result; }
    catch (error) { const message = error instanceof Error ? error.message : String(error); failures.push(`${label}: ${message}`); console.error(`FAIL ${label}: ${message}`); }
  }
  let hub: ReturnType<typeof hubFinalSchema.parse> | undefined;
  let artwork: Awaited<ReturnType<typeof planGameWikiImage>>[] = [];
  if (selected.hub) {
    hub = await check("hub schema, identity, controls and copy", async () => {
      const file = await json(await bundlePath(root, selected.hub!.finalJson));
      assertNoRobloxIdentifiers(file, "wiki/final.json");
      const final = hubFinalSchema.parse(file);
      if (final.slug !== bundle.game.slug || final.game_slug !== bundle.game.slug || final.namespace != null && final.namespace !== bundle.namespace || final.canonical_path != null && final.canonical_path !== wikiPath) throw new Error("Hub identity/route must match the target game.");
      if (bundle.game.kind === "game" && gameInput.status === "released" && !final.tips_md.trim()) throw new Error("Released games require gameplay tips.");
      validateWikiControlsJson(final.controls_json, "wiki/final.json controls_json");
      checkCopy(final, "wiki/final.json");
      return final;
    });
    await check("16:9 cover and separate square hero readiness", async () => {
      artwork = [await planGameWikiImage(root, gameInput.cover_image, bundle.namespace, bundle.game.slug, "cover"), await planGameWikiImage(root, gameInput.hero_image, bundle.namespace, bundle.game.slug, "hero")];
      if (artwork[0].hash === artwork[1].hash) throw new Error("Cover and hero must be separate artwork.");
      requireFranchiseHubImages({ cover_image: artwork[0].url, hero_image: artwork[1].url }, bundle.game.slug);
      if (hub?.cover_image && hub.cover_image !== gameInput.cover_image && hub.cover_image !== artwork[0].url) throw new Error("Hub cover_image must be null or the game's cover_image.");
    });
  } else if (!identity.game?.is_published || !identity.hub?.is_published) {
    failures.push("Publish the game and hub before a collection-only run, or select hub in the same bundle.");
  } else {
    await check("owning game artwork", async () => {
      requireFranchiseHubImages(identity.game, bundle.game.slug);
      await planGameWikiImage(root, identity.game!.cover_image, bundle.namespace, bundle.game.slug, "cover");
      await planGameWikiImage(root, identity.game!.hero_image, bundle.namespace, bundle.game.slug, "hero");
    });
  }
  if (bundle.game.parent) await check("published namespace root artwork", async () => {
    for (const image of requireFranchiseHubImages(identity.root!, bundle.namespace)) await verifyFranchisePageImage(image);
  });
  const existingCollections = await rows(db, "game_collection_pages", bundle.namespace);
  const plans: Plan[] = [];
  for (const { entry, manifest } of selected.collections) await check(`collection ${manifest.collection.slug}`, async () => {
    const slug = manifest.collection.slug;
    assertNoRobloxIdentifiers(manifest, entry.manifest);
    if (manifest.namespace != null && manifest.namespace !== bundle.namespace || manifest.game.slug !== bundle.game.slug || manifest.game.name !== bundle.game.name) throw new Error("Manifest identity must match the bundle.");
    if (manifest.route != null && manifest.route !== `${wikiPath}/${slug}`) throw new Error("Manifest route must match the target wiki route.");
    const manifestPath = await bundlePath(root, entry.manifest);
    const folder = path.dirname(manifestPath);
    const document = await json(await bundlePath(folder, manifest.dataset));
    assertNoRobloxIdentifiers(document, `${slug}/dataset.json`);
    checkCopy({ description_json: document.meta?.display }, `${slug}/dataset.json metadata`);
    const issues: Issue[] = [];
    auditDataset(`${bundle.game.slug}-${slug}`, path.join(folder, "dataset.json"), document, issues);
    if (issues.some(issue => issue.level === "error")) throw new Error(issues.map(issue => issue.message).join("\n"));
    const file = await json(await bundlePath(folder, manifest.finalJson));
    assertNoRobloxIdentifiers(file, `${slug}/final.json`);
    const final = collectionFinalSchema.parse(file);
    if (final.namespace != null && final.namespace !== bundle.namespace || final.canonical_path != null && final.canonical_path !== `${wikiPath}/${slug}`) throw new Error("Collection target namespace/route mismatch.");
    checkCopy(final, `${slug}/final.json`);
    const sections = new Set(document.items?.map((row: { system?: { section?: string } }) => row.system?.section));
    if (Object.keys(final.description_json).some(section => !sections.has(section))) throw new Error("description_json keys must match dataset sections.");
    const plan = await planManifest(bundle.namespace, manifestPath, { wikiCanonicalPath: wikiPath, strictPaths: true });
    const current = existingCollections.filter(row => row.code === plan.code || row.wiki_slug === bundle.game.slug && row.collection_slug === slug);
    if (current.length > 1 || current.some(row => row.game_id !== identity.game?.id || row.wiki_page_id !== identity.hub?.id || row.wiki_slug !== bundle.game.slug || row.collection_slug !== slug || row.code !== plan.code || row.page_type !== plan.pageType || row.canonical_path !== `${wikiPath}/${slug}`)) throw new Error("Collection conflicts with a permanent target identity, route or page type.");
    const order = manifest.collection.sortOrder ?? current[0]?.wiki_sort_order ?? (plans.at(-1)?.manifest.collection.sortOrder ?? Math.max(0, ...existingCollections.filter(row => row.wiki_slug === bundle.game.slug).map(row => Number(row.wiki_sort_order) || 0))) + 10;
    if (final.wiki_sort_order != null && manifest.collection.sortOrder != null && final.wiki_sort_order !== order) throw new Error("final.json wiki_sort_order conflicts with manifest sortOrder.");
    plan.manifest.collection.sortOrder = order;
    plan.finalJson = final;
    if (final.display_name !== manifest.collection.label) throw new Error("display_name must equal collection.label.");
    const title = /^All (\{count\}|[\d,]+) .+ in .+/.exec(final.title);
    if (!title || !final.title.includes(` in ${bundle.game.name}`) || title[1] !== "{count}" && Number(title[1].replaceAll(",", "")) !== plan.items.length) throw new Error("Use All {count} <Collection> in <Game> as the collection title; literal counts must match the dataset.");
    assertCollectionMissingImages(plan.items, entry.missingImages, manifest.missingImages);
    requireFranchiseCollectionImage(plan.items, plan.code);
    for (const item of plan.items) checkCopy({ description_json: { name: item.item_name, ...item.fields_json } }, `${slug}/${item.item_slug}`);
    const imageUrls = plan.items.flatMap(item => item.image_key ? [`https://media.bloxodes.com/wiki/${item.image_key}`] : []);
    if (final.thumb_url && !imageUrls.includes(final.thumb_url)) throw new Error("thumb_url must be null or an exact planned item image URL.");
    plan.finalJson.thumb_url = final.thumb_url || imageUrls[0];
    pageCopy(plan);
    plans.push(plan);
  });
  await check("route ownership", async () => {
    const expected = [
      ...(hub ? [{ route: wikiPath, table: "game_wiki_pages", id: identity.hub?.id }] : []),
      ...plans.map(plan => ({ route: `${wikiPath}/${plan.manifest.collection.slug}`, table: "game_collection_pages", id: existingCollections.find(row => row.code === plan.code)?.id }))
    ];
    if (new Set(expected.map(page => page.route)).size !== expected.length) throw new Error("Selected pages claim the same route.");
    if (!expected.length) return;
    for (const table of ["game_wiki_pages", "game_collection_pages", "game_code_pages", "game_tool_pages", "game_checklist_pages", "game_map_pages", "game_quiz_pages", "game_catalog_pages"]) {
      const result = await db.from(table).select("id,canonical_path").eq("namespace", bundle.namespace).in("canonical_path", expected.map(page => page.route));
      if (result.error) throw result.error;
      for (const row of result.data ?? []) {
        const page = expected.find(page => page.route === row.canonical_path)!;
        if (table !== page.table || row.id !== page.id) throw new Error(`${row.canonical_path} already belongs to another page. Preserve its UUID and ownership.`);
      }
    }
  });
  await check("R2 configuration", async () => {
    if (loadR2ClientConfig().bucket !== "bloxodes-wiki") throw new Error("WIKI_R2_BUCKET must be bloxodes-wiki.");
    if (wikiMediaPublicBaseUrl() !== "https://media.bloxodes.com/wiki") throw new Error("Remove WIKI_MEDIA_PUBLIC_BASE_URL override.");
  });
  if (options.target === "production" && !process.env.REVALIDATE_SECRET) failures.push("Production needs REVALIDATE_SECRET for immediate revalidation.");
  if (failures.length) throw new Error(`${failures.length} preflight check(s) failed. No database or media writes were made.\n${failures.join("\n")}`);
  const urls = [...(hub ? [{ path: wikiPath, title: hub.title, seo: hub.seo_title, images: artwork.map(image => image.url) }] : []), ...plans.map(plan => ({ path: `${wikiPath}/${plan.manifest.collection.slug}`, title: String(pageCopy(plan)!.title), seo: String(pageCopy(plan)!.seo_title), images: plan.items.flatMap(item => item.image_key ? [`https://media.bloxodes.com/wiki/${item.image_key}`] : []) }))];
  console.table(plans.map(plan => ({ code: plan.code, rows: plan.items.length, images: plan.items.filter(item => item.image_key).length, acceptedMissing: plan.items.filter(item => !item.image_key).length, contentHash: plan.contentHash })));
  for (const url of urls) console.log(`${options.target === "production" ? "Live" : "Canonical production URL, staged in managed-dev"}: https://bloxodes.com${url.path}`);
  if (!options.apply) { console.log("PASS all checks. Dry run complete; no database or media writes. Add --apply to publish."); return; }
  if (options.target === "production") await assertLocalContentPublication();
  if (options.target === "production" && identity.hub && hub) {
    const directory = path.join(repoRoot, "tmp/publish-snapshots");
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    await fs.writeFile(path.join(directory, `${bundle.namespace}-${bundle.game.slug}-${Date.now()}.json`), JSON.stringify({ game: identity.game, hub: identity.hub }, null, 2), { mode: 0o600, flag: "wx" });
  }
  const r2 = new R2Client(loadR2ClientConfig());
  for (const image of artwork) {
    if (!await r2.hasObject(image.key)) await r2.putObject({ key: image.key, body: image.bytes, contentType: image.mime, metadata: { sha256: image.hash, width: image.width, height: image.height } });
    if (!await r2.hasObject(image.key)) throw new Error(`R2 readback failed: ${image.key}`);
  }
  for (const plan of plans) { await uploadCollectionImages(plan.items, r2); await verifyCollectionImages(plan.items, r2, plan.code); }
  if (hub) {
    const payload = { ...pick(gameInput, gameFields), namespace: bundle.namespace, kind: bundle.game.kind, parent_id: identity.parentId, cover_image: artwork[0].url, hero_image: artwork[1].url, is_published: true };
    const query = identity.game ? db.from("games").update(payload).eq("namespace", bundle.namespace).eq("id", identity.game.id) : db.from("games").insert(payload);
    const result = await query.select("*").single();
    if (result.error) throw result.error;
    equalFields(result.data, payload, "game");
    const hubPayload = { ...pick(hub, wikiFields), cover_image: hub.cover_image ? artwork[0].url : null, is_published: true };
    const written = await saveFranchiseWikiPage(db, bundle.namespace, result.data.id, hubPayload);
    equalFields(written, { ...hubPayload, game_id: result.data.id, canonical_path: wikiPath }, "hub");
  }
  for (const plan of plans) {
    await applyPlan(plan, { stage: false, publish: true, includeRoots: true, gameKind: bundle.game.kind });
    await verifyCollection(db, plan, `${wikiPath}/${plan.manifest.collection.slug}`);
  }
  if (options.target === "production") {
    const paths = [...new Set([`/${bundle.namespace}`, `/${bundle.namespace}/wiki`, wikiPath, ...urls.map(url => url.path)])];
    for (let offset = 0; offset < paths.length; offset += 100) await revalidatePublishedContent(process.env, paths.slice(offset, offset + 100).map(route => ({ type: "game_content" as const, slug: route.slice(1) })));
    for (const url of urls) await verifyLive(`https://bloxodes.com${url.path}`, url.title, url.seo, url.images);
  }
  console.log(`PASS published ${urls.length} page(s) to ${options.target}.`);
}

export async function gameContentStatus(options: ContentOptions, db: SupabaseClient = supabaseAdmin()) {
  const namespace = options.namespace!;
  const games = await rows(db, "games", namespace);
  const candidates = games.filter(game => game.slug === options.game && (options.kind ? game.kind === options.kind : options.game !== namespace || game.parent_id == null));
  if (candidates.length > 1) throw new Error("Ambiguous game slug in target namespace.");
  const game = candidates[0];
  const hubs = await rows(db, "game_wiki_pages", namespace);
  const hub = hubs.find(page => game ? page.game_id === game.id : page.slug === options.game);
  const pages = (await rows(db, "game_collection_pages", namespace)).filter(page => game ? page.game_id === game.id : page.wiki_slug === options.game);
  const wikiPath = hub?.canonical_path ?? gameWikiPath(namespace, options.game!, game?.parent_id || options.game !== namespace ? namespace : undefined);
  const parentPublished = !game?.parent_id || Boolean(games.find(parent => parent.id === game.parent_id)?.is_published);
  const visible = Boolean(game?.is_published && parentPublished && hub?.is_published);
  console.log(`Target: ${options.target}. URLs are production canonical URLs; development status describes staged rows.`);
  console.table([
    { page: "hub", exists: Boolean(hub), published: hub?.is_published ?? false, visible, items: "", url: `https://bloxodes.com${wikiPath}` },
    ...pages.map(page => ({ page: page.collection_slug, exists: true, published: page.is_published, visible: Boolean(visible && page.is_published && page.published_dataset_id), items: page.item_count ?? 0, url: `https://bloxodes.com${page.canonical_path}` }))
  ]);
}
