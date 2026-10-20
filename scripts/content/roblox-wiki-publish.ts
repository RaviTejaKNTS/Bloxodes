import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { load } from "cheerio";
import { bundleSchema, hubFinalSchema, collectionFinalSchema } from "../../contracts/roblox-wiki/v1/schema";
import { GROW_GARDEN_COLLECTIONS } from "@/lib/game-collections/grow-a-garden-view";
import { THE_FORGE_COLLECTIONS } from "@/lib/game-collections/the-forge-view";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { readGameCollectionGroups } from "@/lib/game-collections/registry";
import { resolveSeoTitle } from "@/lib/seo";
import { resolveWikiMediaUrl, wikiMediaPublicBaseUrl } from "@/lib/wiki-media";
import { fetchOfficialUniverseMedia, hasOfficialUniverseMedia, persistOfficialUniverseMedia } from "@/lib/roblox/universe-media";
import { officialUniverseCover } from "../shared/official-universe-cover";
import { loadR2ClientConfig, R2Client } from "../shared/r2-client";
import { assertLocalContentPublication } from "../shared/local-content-publication-guard";
import { revalidatePublishedContent } from "../shared/revalidate-published-content";
import { readFinal, type WikiFinal } from "../collections/sync-game-wiki-runtime";
import { auditDataset, type Issue } from "../collections/audit-game-collection-datasets-v2";
import { targetSources, planCollection, pageCopyFromFinal, uploadPlanMedia, verifyPlanMedia, applyPlan, type CollectionPlan } from "../collections/sync-game-collection-runtime";
import { publicCopyFindings } from "./check-public-copy";
import { assertRobloxCollectionCopy } from "./roblox-collection-copy";
import { assertEditorialSlug, bundlePath, selectBundlePages, resolveCollectionOrders, assertCollectionFinalOrder, assertCollectionMissingImages } from "../shared/roblox-wiki-bundle";
import { ensureContentUniverse, previewContentUniverse } from "../shared/roblox-wiki-universe";
import type { ContentOptions } from "./roblox-wiki-cli";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(",")}}`;
  return JSON.stringify(value) ?? "undefined";
}

function equalFields(actual: Record<string, unknown>, expected: Record<string, unknown>, context: string) {
  for (const [key, value] of Object.entries(expected)) {
    if (canonical(actual[key]) !== canonical(value)) throw new Error(`${context}: readback mismatch in ${key}. Retry the same bundle after inspecting the stored row.`);
  }
}

async function json(file: string) { return JSON.parse(await fs.readFile(file, "utf8")); }

function checkCopy(value: Record<string, unknown>, file: string) {
  const findings = [
    ...publicCopyFindings(value, file),
    ...publicCopyFindings({ description_json: { title: value.title, seo_title: value.seo_title, display_name: value.display_name } }, file)
  ];
  if (findings.length) throw new Error(findings.map(row => `${row.field}: ${row.rule}. Rewrite: ${row.excerpt}`).join("\n"));
}

async function planHubCover(universeId: number, localFile?: string) {
  const url = await officialUniverseCover(universeId);
  if (!url) throw new Error("Official hub cover is unavailable. Retry after Roblox supplies the 768x432 thumbnail.");
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Official hub cover returned HTTP ${response.status}.`);
  const officialBytes = Buffer.from(await response.arrayBuffer());
  const bytes = localFile ? await fs.readFile(localFile) : officialBytes;
  if (hash(bytes) !== hash(officialBytes)) throw new Error("hub.coverImage differs from the current official thumbnail. Download it again or omit coverImage to use the official image.");
  const metadata = await sharp(bytes).metadata();
  const types: Record<string, string> = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp", avif: "image/avif" };
  if (!metadata.format || !types[metadata.format] || metadata.width !== 768 || metadata.height !== 432 || bytes.length > 1_000_000) {
    throw new Error("Hub cover must be a readable official 768x432 PNG, JPEG, WebP or AVIF under 1 MB. Replace hub.coverImage.");
  }
  const key = `${universeId}/hubs/cover-${hash(bytes).slice(0, 16)}.${metadata.format === "jpeg" ? "jpg" : metadata.format}`;
  return { bytes, key, mime: types[metadata.format], url: resolveWikiMediaUrl(key)! };
}

async function collectionIdentity(plan: CollectionPlan) {
  const db = supabaseAdmin();
  const rows = await db.from("wiki_collection_pages").select("id,universe_id,wiki_slug,collection_slug,code,page_type")
    .or(`code.eq.${plan.config.code},and(wiki_slug.eq.${plan.config.gameSlug},collection_slug.eq.${plan.config.slug})`);
  if (rows.error) throw rows.error;
  for (const row of rows.data ?? []) {
    if ((row.universe_id != null && Number(row.universe_id) !== plan.universeId) || row.wiki_slug !== plan.config.gameSlug || row.collection_slug !== plan.config.slug || row.code !== plan.config.code || row.page_type !== plan.pageType) {
      throw new Error(`${plan.config.code} conflicts with an existing collection identity or page type. Keep the existing route and renderer, or make a separate reviewed migration.`);
    }
  }
}

async function verifyCollection(plan: CollectionPlan) {
  const db = supabaseAdmin();
  const page = await db.from("wiki_collection_pages").select("*").eq("code", plan.config.code).single();
  if (page.error) throw page.error;
  equalFields(page.data, {
    ...pageCopyFromFinal(plan), universe_id: plan.universeId, wiki_slug: plan.config.gameSlug,
    collection_slug: plan.config.slug, code: plan.config.code, page_type: plan.pageType,
    is_published: true, item_count: plan.items.length
  }, plan.config.code);
  const revision = await db.from("wiki_collection_datasets").select("*").eq("id", page.data.published_dataset_id).single();
  if (revision.error) throw revision.error;
  equalFields(revision.data, { collection_page_id: page.data.id, content_hash: plan.contentHash, schema_version: 2, item_count: plan.items.length, meta_json: plan.metaJson }, `${plan.config.code} revision`);
  const expected = new Map(plan.items.map(({ source_path: _path, source_git_path: _git, source_url: _url, media_was_normalized: _normalized, ...item }) => [item.item_slug, item]));
  let count = 0;
  for (let offset = 0; ; offset += 500) {
    const items = await db.from("wiki_collection_items").select("*").eq("dataset_id", revision.data.id).order("item_slug").range(offset, offset + 499);
    if (items.error) throw items.error;
    for (const row of items.data ?? []) {
      const item = expected.get(row.item_slug);
      if (!item) throw new Error(`${plan.config.code}: unexpected stored item ${row.item_slug}.`);
      equalFields(row, item, `${plan.config.code}/${row.item_slug}`);
      expected.delete(row.item_slug);
      count += 1;
    }
    if ((items.data?.length ?? 0) < 500) break;
  }
  if (expected.size || count !== plan.items.length) throw new Error(`${plan.config.code}: incomplete item readback.`);
}

function collectionPageTitle(plan: CollectionPlan) {
  const legacyConfig = plan.pageType === "collectible" ? undefined : plan.config.gameSlug === "grow-a-garden"
    ? GROW_GARDEN_COLLECTIONS.find(entry => entry.slug === plan.config.slug)
    : plan.config.gameSlug === "the-forge"
      ? THE_FORGE_COLLECTIONS.find(entry => entry.slug === plan.config.slug) : undefined;
  return legacyConfig
    ? `All ${plan.items.length.toLocaleString("en-US")} ${legacyConfig.label} in ${plan.config.gameSlug === "the-forge" ? "The Forge" : "Grow a Garden"}`
    : String(pageCopyFromFinal(plan)!.title);
}

async function verifyLive(url: string, title: string, seoTitle: string, expectedImages: string[]) {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (response.status !== 200 || response.url.replace(/\/$/, "") !== url.replace(/\/$/, "")) throw new Error(`${url}: expected HTTP 200 at the exact URL; received ${response.status} at ${response.url}.`);
  const html = load(await response.text());
  const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
  if (normalize(html("h1").first().text()) !== normalize(title) || !normalize(html("title").text()).includes(normalize(resolveSeoTitle(seoTitle) ?? seoTitle))) throw new Error(`${url}: rendered title does not match final.json. Check revalidation and deployed code.`);
  const images = new Set(expectedImages);
  html("img").each((_, image) => {
    const src = html(image).attr("src");
    if (src && !src.startsWith("data:")) images.add(new URL(src, url).href);
  });
  if (!images.size) throw new Error(`${url}: no images were available to verify.`);
  const pending = [...images];
  await Promise.all(Array.from({ length: Math.min(8, pending.length) }, async () => {
    while (pending.length) {
      const image = pending.shift()!;
      const result = await fetch(image, { signal: AbortSignal.timeout(30_000) });
      if (!result.ok || !result.headers.get("content-type")?.startsWith("image/")) throw new Error(`${url}: image failed to load, ${image}, HTTP ${result.status}.`);
      const bytes = Buffer.from(await result.arrayBuffer());
      const metadata = await sharp(bytes).metadata();
      if (!metadata.width || !metadata.height) throw new Error(`${url}: image has no decodable dimensions, ${image}.`);
    }
  }));
  console.log(`PASS live URL, titles and ${images.size} images: ${url}`);
}

export async function publishBundle(options: ContentOptions) {
  const root = await fs.realpath(path.resolve(options.bundle!));
  const raw = await json(await bundlePath(root, "bundle.json"));
  if (raw?.contract !== "roblox-wiki@1") throw new Error(`Unsupported contract ${JSON.stringify(raw?.contract)}. Supported version: roblox-wiki@1. Update bundle.json to the v1 schema in contracts/roblox-wiki/v1/schema.ts.`);
  const bundle = bundleSchema.parse(raw);
  if (!bundle.hub && !bundle.collections?.length) throw new Error("bundle.json must include a hub and/or at least one collection.");
  const selected = await selectBundlePages(bundle, options.only, async file => json(await bundlePath(root, file)));
  const db = supabaseAdmin();
  const failures: string[] = [];
  async function check<T>(label: string, work: () => Promise<T>): Promise<T | undefined> {
    try { const result = await work(); console.log(`PASS ${label}`); return result; }
    catch (error) { const message = error instanceof Error ? error.message : String(error); failures.push(`${label}: ${message}`); console.error(`FAIL ${label}: ${message}`); }
  }
  console.log(`${options.apply ? "Apply preflight" : "Dry run"}: roblox-wiki@1, ${bundle.game.slug}, target=${options.target}`);
  if (options.target === "production") await check("production checkout, deploy and migration ledger", assertLocalContentPublication);
  const registry = await readGameCollectionGroups(db);
  const existingGroup = registry.find(group => group.gameSlug === bundle.game.slug);
  const universe = await ensureContentUniverse(db, bundle.game.universeId, false);
  const plannedUniverse = universe ?? await previewContentUniverse(bundle.game.universeId);
  const gameOrder = bundle.game.sortOrder ?? existingGroup?.sortOrder ?? Math.max(0, ...registry.map(group => group.sortOrder)) + 1000;
  const collectionOrders = resolveCollectionOrders(selected.collections.map(({ manifest }) => manifest.collection), existingGroup, gameOrder);
  const hubs = await db.from("wiki_pages").select("*").or(`slug.eq.${bundle.game.slug},universe_id.eq.${bundle.game.universeId}`);
  if (hubs.error) throw hubs.error;
  const existingHub = (hubs.data ?? []).find(row => row.slug === bundle.game.slug);
  await check("editorial slug and game ownership", async () => {
    assertEditorialSlug(bundle.game.slug, bundle.game.universeId, plannedUniverse.slug, existingHub?.slug ?? existingGroup?.gameSlug);
    if (registry.some(group => group.gameSlug !== bundle.game.slug && group.universeId === bundle.game.universeId) || (existingGroup?.universeId != null && existingGroup.universeId !== bundle.game.universeId)) throw new Error("Registry game/universe identity conflicts with another game. Keep the registered identity.");
    for (const row of hubs.data ?? []) if (row.slug !== bundle.game.slug || Number(row.universe_id) !== bundle.game.universeId) throw new Error("Hub game/universe identity conflicts with an existing row. Keep the stored editorial slug.");
  });
  let hub: WikiFinal | undefined;
  let cover: Awaited<ReturnType<typeof planHubCover>> | undefined;
  let officialMedia: Awaited<ReturnType<typeof fetchOfficialUniverseMedia>> = null;
  if (selected.hub) {
    hub = await check("hub schema, copy and identity", async () => {
      const file = await bundlePath(root, selected.hub!.finalJson);
      hubFinalSchema.parse(await json(file));
      const final = await readFinal(file);
      if (final.slug !== bundle.game.slug || final.universe_id !== bundle.game.universeId) throw new Error("Hub final.json slug/universe_id must match bundle.game.");
      if (final.is_published === false) throw new Error("Set hub final.json is_published to true or omit it to publish.");
      checkCopy(final as unknown as Record<string, unknown>, file);
      return final;
    });
    cover = await check("hub cover image readiness", async () => planHubCover(bundle.game.universeId, selected.hub!.coverImage ? await bundlePath(root, selected.hub!.coverImage) : undefined));
    await check("official hub icon and thumbnail", async () => {
      if (!hasOfficialUniverseMedia(universe ?? {})) {
        officialMedia = await fetchOfficialUniverseMedia(bundle.game.universeId);
        if (!officialMedia) throw new Error("Official 512x512 icon and 768x432 thumbnail are unavailable. Retry after Roblox supplies both images.");
      }
    });
  }
  const plans: CollectionPlan[] = [];
  const slugs = new Set<string>();
  for (const { entry, manifest } of selected.collections) {
    await check(`collection ${entry.manifest}`, async () => {
      const manifestPath = await bundlePath(root, entry.manifest);
      if (manifest.game.slug !== bundle.game.slug || manifest.game.name !== bundle.game.name || manifest.game.universeId !== bundle.game.universeId) throw new Error("Manifest game must match bundle.game exactly.");
      if (slugs.has(manifest.collection.slug)) throw new Error(`Duplicate collection slug ${manifest.collection.slug}. Supply it once.`);
      slugs.add(manifest.collection.slug);
      const [source] = await targetSources([manifestPath]);
      source.config = { ...source.config, gameName: bundle.game.name, label: manifest.collection.label, universeNames: bundle.game.universeNames, sortOrder: collectionOrders.get(manifest.collection.slug)! };
      const document = await json(source.datasetPath);
      const issues: Issue[] = [];
      auditDataset(source.config.code, source.datasetPath, document, issues);
      if (issues.some(issue => issue.level === "error")) throw new Error(issues.map(issue => issue.message).join("\n"));
      const final = collectionFinalSchema.parse(await json(source.finalJsonPath!));
      if (final.wiki_slug !== bundle.game.slug || final.collection_slug !== manifest.collection.slug || final.universe_id !== bundle.game.universeId || final.code !== source.config.code) throw new Error("Collection final.json identity must match bundle.game and its manifest.");
      if (final.is_published === false) throw new Error("Set collection final.json is_published to true or omit it to publish.");
      if (final.display_name !== manifest.collection.label) throw new Error("final.json display_name must match manifest collection.label.");
      assertCollectionFinalOrder(final.wiki_sort_order, source.config.sortOrder);
      assertRobloxCollectionCopy(final);
      checkCopy(final, source.finalJsonPath!);
      const plan = await planCollection(source, document);
      plan.finalJson = final;
      const titleCount = /^All (\{count\}|[\d,]+) .+ in .+$/.exec(final.title);
      if (!titleCount || !final.title.endsWith(` in ${bundle.game.name}`) || (titleCount[1] !== "{count}" && Number(titleCount[1].replaceAll(",", "")) !== plan.items.length)) {
        throw new Error(`Use title: All {count} ${final.display_name} in ${bundle.game.name}. The title count must match all ${plan.items.length} rows.`);
      }
      if (Number(plan.validationJson.duplicateSlugCount) || Number(plan.validationJson.repairedSlugCount)) throw new Error("Fix duplicate or invalid system.slug values in dataset.json. The versioned publisher never repairs item identities.");
      assertCollectionMissingImages(plan.items, entry.missingImages, manifest.missingImages);
      for (const item of plan.items) {
        checkCopy({ description_json: { name: item.item_name, ...item.fields_json } }, `${source.datasetPath}/${item.item_slug}`);
      }
      const imageUrls = plan.items.flatMap(item => item.image_key ? [resolveWikiMediaUrl(item.image_key)!] : []);
      if (final.thumb_url && !imageUrls.includes(final.thumb_url)) throw new Error("thumb_url must be null or an exact planned R2 item image URL.");
      if (!final.thumb_url && imageUrls.length) plan.finalJson!.thumb_url = imageUrls[0];
      pageCopyFromFinal(plan);
      await collectionIdentity(plan);
      plans.push(plan);
    });
  }
  await check("R2 configuration", async () => {
    if (loadR2ClientConfig().bucket !== "bloxodes-wiki") throw new Error("WIKI_R2_BUCKET must be bloxodes-wiki.");
    if (wikiMediaPublicBaseUrl() !== "https://media.bloxodes.com/wiki") throw new Error("Remove WIKI_MEDIA_PUBLIC_BASE_URL override; publication uses https://media.bloxodes.com/wiki.");
  });
  if (options.target === "production" && !process.env.REVALIDATE_SECRET) failures.push("Set REVALIDATE_SECRET in the production target for immediate revalidation.");
  if (failures.length) throw new Error(`${failures.length} preflight check(s) failed. Fix the findings above and rerun the same bundle. No database or media writes were made.`);
  console.table(plans.map(plan => ({ code: plan.config.code, rows: plan.items.length, images: plan.items.filter(row => row.image_key).length, acceptedMissing: plan.items.filter(row => !row.image_key).length, contentHash: plan.contentHash })));
  if (!options.apply) { console.log("PASS all checks. Dry run complete; no database or media writes. Add --apply to publish."); return; }
  // Repeat the production guard immediately before the first write.
  if (options.target === "production") await assertLocalContentPublication();
  if (!universe) {
    const imported = await ensureContentUniverse(db, bundle.game.universeId, true);
    if (!imported || Number(imported.universe_id) !== bundle.game.universeId || Number(imported.root_place_id) !== Number(plannedUniverse.root_place_id) || !imported.name?.trim() || !imported.slug?.trim()) {
      throw new Error("Imported universe identity differs from preflight. No content pages or media were written.");
    }
    assertEditorialSlug(bundle.game.slug, bundle.game.universeId, imported.slug, existingHub?.slug ?? existingGroup?.gameSlug);
  }
  if (hub && existingHub && options.target === "production") {
    const directory = path.join(repoRoot, "tmp/publish-snapshots");
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    const file = path.join(directory, `${bundle.game.slug}-${Date.now()}.json`);
    await fs.writeFile(file, `${JSON.stringify(existingHub, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    console.log(`Production hub snapshot: ${file}`);
  }
  const r2 = new R2Client(loadR2ClientConfig());
  if (cover) {
    await r2.putObject({ key: cover.key, body: cover.bytes, contentType: cover.mime, metadata: { sha256: hash(cover.bytes), width: 768, height: 432 } });
    if (!await r2.hasObject(cover.key)) throw new Error("Hub cover R2 readback failed.");
  }
  for (const plan of plans) { await uploadPlanMedia(plan, r2); await verifyPlanMedia(plan, r2); }
  if (hub) {
    if (officialMedia) await persistOfficialUniverseMedia(db, bundle.game.universeId, officialMedia);
    const payload = { ...hub, cover_image: cover!.url, is_published: true };
    let mutation;
    if (existingHub) mutation = db.from("wiki_pages").update(payload).eq("id", existingHub.id).eq("updated_at", existingHub.updated_at);
    else mutation = db.from("wiki_pages").insert(payload);
    const result = await mutation.select("*").single();
    if (result.error) throw new Error(`Hub write failed or changed during preflight: ${result.error.message}. Inspect the row and rerun.`);
    equalFields(result.data, payload, bundle.game.slug);
  }
  for (const plan of plans) { await applyPlan(plan, true); await verifyCollection(plan); }
  const selectedRegistrations = plans.map(plan => ({ slug: plan.config.slug, label: plan.config.label, sortOrder: plan.config.sortOrder, pageType: plan.pageType })).sort((a, b) => a.sortOrder - b.sortOrder);
  const registered = await db.rpc("merge_roblox_wiki_registry", {
    p_game_slug: bundle.game.slug, p_game_name: bundle.game.name, p_universe_id: bundle.game.universeId,
    p_universe_names: bundle.game.universeNames, p_collections: selectedRegistrations,
    p_sort_order: bundle.game.sortOrder ?? null
  }).single();
  if (registered.error) throw registered.error;
  equalFields(registered.data, {
    game_slug: bundle.game.slug, game_name: bundle.game.name, universe_id: bundle.game.universeId,
    universe_names: bundle.game.universeNames,
    ...(bundle.game.sortOrder != null ? { sort_order: bundle.game.sortOrder } : {})
  }, "registry");
  const storedRegistrations = registered.data.collections as typeof selectedRegistrations;
  for (const entry of selectedRegistrations) {
    const stored = storedRegistrations.find(row => row.slug === entry.slug);
    if (!stored) throw new Error(`Registry readback is missing ${entry.slug}.`);
    equalFields(stored, entry, `registry/${entry.slug}`);
  }
  for (const slug of existingGroup?.collections ?? []) {
    if (!storedRegistrations.some(row => row.slug === slug)) throw new Error(`Registry lost an omitted collection: ${slug}.`);
  }
  if (hub) {
    const row = await db.from("wiki_pages").select("*").eq("slug", hub.slug).single();
    if (row.error) throw row.error;
    equalFields(row.data, { ...hub, cover_image: cover!.url, is_published: true }, "hub final readback");
  }
  const urls = [
    ...(hub ? [{ path: `/wiki/${hub.slug}`, title: hub.title, seo: hub.seo_title, images: [cover!.url] }] : []),
    ...plans.map(plan => ({ path: `/wiki/${plan.config.gameSlug}/${plan.config.slug}`, title: collectionPageTitle(plan), seo: String(pageCopyFromFinal(plan)!.seo_title), images: plan.items.flatMap(item => item.image_key ? [resolveWikiMediaUrl(item.image_key)!] : []) }))
  ];
  if (options.target === "production") {
    const events = [
      { type: "wiki" as const, slug: bundle.game.slug },
      ...plans.map(plan => ({ type: "wiki_collection" as const, slug: `${plan.config.gameSlug}/${plan.config.slug}` }))
    ];
    for (let start = 0; start < events.length; start += 100) await revalidatePublishedContent(process.env, events.slice(start, start + 100));
    for (const entry of urls) await verifyLive(`https://bloxodes.com${entry.path}`, entry.title, entry.seo, entry.images);
  }
  console.log(`PASS published ${urls.length} page(s) to ${options.target}.`);
  for (const entry of urls) console.log(`${options.target === "production" ? "Live" : "Canonical production URL, staged in managed-dev"}: https://bloxodes.com${entry.path}`);
}

export async function contentStatus(options: ContentOptions) {
  const db = supabaseAdmin();
  const registry = (await readGameCollectionGroups(db)).find(group => group.gameSlug === options.game);
  const hub = await db.from("wiki_pages").select("id,slug,is_published").eq("slug", options.game!).maybeSingle();
  if (hub.error) throw hub.error;
  const pages = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await db.from("wiki_collection_pages").select("code,collection_slug,is_published,item_count,published_dataset_id").eq("wiki_slug", options.game!).order("collection_slug").range(offset, offset + 999);
    if (result.error) throw result.error;
    pages.push(...result.data ?? []);
    if ((result.data?.length ?? 0) < 1000) break;
  }
  const slugs = new Set([...(registry?.collections ?? []), ...pages.map(page => page.collection_slug)]);
  console.log(`Target: ${options.target}. URLs are production canonical URLs; development status describes staged rows.`);
  console.table([
    { page: "hub", exists: Boolean(hub.data), published: hub.data?.is_published ?? false, items: "", url: `https://bloxodes.com/wiki/${options.game}` },
    ...[...slugs].map(slug => {
      const row = pages.find(page => page.collection_slug === slug);
      return { page: slug, exists: Boolean(row), published: row?.is_published ?? false, items: row?.item_count ?? 0, url: `https://bloxodes.com/wiki/${options.game}/${slug}` };
    })
  ]);
}

export async function contentCandidates() {
  const { discoverTopWikiCandidates } = await import("../universes/discover-wiki-candidates");
  const candidates = await discoverTopWikiCandidates();
  console.log(JSON.stringify({ next: candidates[0] ?? null, candidates }, null, 2));
}
