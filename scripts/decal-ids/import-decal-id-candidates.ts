import "../shared/load-env";

import fs from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";
import { repoPath } from "@/lib/paths";
import {
  clampNumber,
  insertMissingDecalRows,
  normalizeNumber,
  toBoolean,
  upsertSourceRows,
  type DecalSourceRow,
  type DecalUpsertRow
} from "./decal-id-utils";

const USER_AGENT = "BloxodesDecalCandidateImporter/1.0";
const DRY_RUN = toBoolean(process.env.ROBLOX_DECAL_IMPORT_DRY_RUN, false);
const MAX_URL_IDS = clampNumber(process.env.ROBLOX_DECAL_IMPORT_MAX_URL_IDS, 2000, 1, 100000);

type Args = {
  files: string[];
  urls: string[];
};

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const result: Args = { files: [], urls: [] };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--file") {
      const value = args[i + 1];
      if (value) result.files.push(value);
      i += 1;
    } else if (arg === "--url") {
      const value = args[i + 1];
      if (value) result.urls.push(value);
      i += 1;
    }
  }
  return result;
}

function normalizeAssetId(value: unknown): number | null {
  const id = normalizeNumber(value);
  if (!id || id < 1000 || id > Number.MAX_SAFE_INTEGER) return null;
  return Math.floor(id);
}

async function loadJsonFile(filePath: string): Promise<unknown> {
  const absolutePath = path.isAbsolute(filePath) ? filePath : repoPath(filePath);
  return JSON.parse(await fs.readFile(absolutePath, "utf8"));
}

function extractIdsFromText(text: string): number[] {
  const ids = new Set<number>();
  const robloxUrlRegex = /roblox\.com\/(?:library|catalog|store\/asset)\/(\d{5,18})/gi;
  for (const match of text.matchAll(robloxUrlRegex)) {
    const id = normalizeAssetId(match[1]);
    if (id) ids.add(id);
  }

  const numericRegex = /\b\d{5,18}\b/g;
  for (const match of text.matchAll(numericRegex)) {
    const id = normalizeAssetId(match[0]);
    if (!id) continue;
    if (id < 100000) continue;
    ids.add(id);
  }

  return Array.from(ids);
}

async function importUrl(url: string, seen: Set<number>) {
  const res = await fetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": USER_AGENT
    }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();
  const text = $("body").text();
  const ids = extractIdsFromText(text).slice(0, MAX_URL_IDS);
  const now = new Date().toISOString();
  const decalRows: DecalUpsertRow[] = [];
  const sourceRows: DecalSourceRow[] = [];

  ids.forEach((assetId, index) => {
    if (seen.has(assetId)) return;
    seen.add(assetId);
    decalRows.push({
      asset_id: assetId,
      name: `Roblox Decal ${assetId}`,
      status: "pending",
      status_reason: "external_candidate_awaiting_verification",
      source: "external_decal_candidate",
      raw_payload: { sourceUrl: url },
      last_seen_at: now
    });
    sourceRows.push({
      asset_id: assetId,
      source_kind: "external_decal_candidate",
      source_url: url,
      source_rank: index + 1,
      raw_payload: { sourceUrl: url },
      last_seen_at: now
    });
  });

  return { decalRows, sourceRows };
}

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE must be set.");
  }

  const args = parseArgs();
  const seen = new Set<number>();
  const allDecalRows: DecalUpsertRow[] = [];
  const allSourceRows: DecalSourceRow[] = [];

  for (const filePath of args.files) {
    const payload = await loadJsonFile(filePath);
    const values = Array.isArray(payload) ? payload : [];
    const ids = values.map((value) => (typeof value === "object" && value ? (value as Record<string, unknown>).id : value));
    const now = new Date().toISOString();
    let fileCount = 0;
    ids.forEach((value, index) => {
      const assetId = normalizeAssetId(value);
      if (!assetId || seen.has(assetId)) return;
      seen.add(assetId);
      fileCount += 1;
      allDecalRows.push({
        asset_id: assetId,
        name: `Roblox Decal ${assetId}`,
        status: "pending",
        status_reason: "file_candidate_awaiting_verification",
        source: "file_decal_candidate",
        raw_payload: { file: filePath },
        last_seen_at: now
      });
      allSourceRows.push({
        asset_id: assetId,
        source_kind: "file_decal_candidate",
        source_url: filePath,
        source_rank: index + 1,
        raw_payload: { file: filePath },
        last_seen_at: now
      });
    });
    console.log(`File candidates from ${filePath}: ${fileCount}`);
  }

  for (const url of args.urls) {
    const { decalRows, sourceRows } = await importUrl(url, seen);
    allDecalRows.push(...decalRows);
    allSourceRows.push(...sourceRows);
    console.log(`URL candidates from ${url}: ${decalRows.length}`);
  }

  const insertResult = await insertMissingDecalRows(allDecalRows, { dryRun: DRY_RUN });
  await upsertSourceRows(allSourceRows, { dryRun: DRY_RUN });
  console.log(
    `Done. Candidate rows: ${allDecalRows.length}. Inserted: ${insertResult.inserted}. Already known: ${insertResult.existing}. Source rows: ${allSourceRows.length}.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
