import "../shared/load-env";

import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

import {
  CURRENT_SUPABASE_API_ORIGIN,
  findNonCanonicalMediaUrls,
  LEGACY_MANAGED_SUPABASE_ORIGIN,
} from "../shared/storage-public-url";
import { isManagedDevelopmentSupabaseUrl } from "../shared/supabase-target";

type Row = Record<string, unknown> & {
  id: string;
  slug: string;
  universe_id?: number | null;
};

type RowContract = {
  table: "code_pages" | "articles";
  publishedColumn: "is_published";
  mutableFields: readonly string[];
  markdownFields: readonly string[];
};

type LegacyReference = {
  table: RowContract["table"];
  rowId: string;
  slug: string;
  field: string;
  legacyUrl: string;
  objectPath: string;
};

type Options = {
  apply: boolean;
  allowProd: boolean;
  allowRemoteRead: boolean;
  recoveryRoot: string | null;
  removeUnrecoverableBodyImages: boolean;
  replaceMissingCoversFromRoblox: boolean;
};

type ObjectResolution = {
  legacyUrl: string;
  currentUrl: string | null;
  objectPath: string;
  action: "already-current" | "recover-original" | "replace-cover" | "remove-reference" | "unresolved";
  sourceFile?: string;
};

const PAGE_SIZE = 1_000;
const DEFAULT_BUCKET = "bloxodes-media";
const USER_AGENT = "Bloxodes legacy media repair/1.0";

const CONTRACTS: readonly RowContract[] = [
  {
    table: "code_pages",
    publishedColumn: "is_published",
    mutableFields: [
      "cover_image",
      "intro_md",
      "redeem_md",
      "rewards_md",
      "troubleshoot_md",
      "find_codes_md",
    ],
    markdownFields: ["intro_md", "redeem_md", "rewards_md", "troubleshoot_md", "find_codes_md"],
  },
  {
    table: "articles",
    publishedColumn: "is_published",
    mutableFields: ["cover_image", "content_md"],
    markdownFields: ["content_md"],
  },
];

function printUsage() {
  console.log(`Usage: npm run repair:legacy-media -- [options]

Read-only by default. It inventories published code_pages and articles for non-canonical Supabase media URLs and prints the planned repair.

Options:
  --allow-remote-read                 Allow an intentional read-only inventory outside managed development.
  --recovery-root <path>              Root containing <object-path>/<physical-version-file> directories.
  --remove-unrecoverable-body-images  Remove only unrecoverable Markdown image tokens; preserve surrounding copy/tables.
  --replace-missing-covers-from-roblox
                                      Replace an unrecoverable code-page cover with its official Roblox universe icon.
  --apply                             Upload media and update affected rows.
  --allow-prod                        Required with --apply outside managed development.
  -h, --help                          Show this help.
`);
}

function parseOptions(argv: string[]): Options {
  const options: Options = {
    apply: false,
    allowProd: false,
    allowRemoteRead: false,
    recoveryRoot: null,
    removeUnrecoverableBodyImages: false,
    replaceMissingCoversFromRoblox: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") options.apply = true;
    else if (arg === "--allow-prod") options.allowProd = true;
    else if (arg === "--allow-remote-read") options.allowRemoteRead = true;
    else if (arg === "--remove-unrecoverable-body-images") options.removeUnrecoverableBodyImages = true;
    else if (arg === "--replace-missing-covers-from-roblox") options.replaceMissingCoversFromRoblox = true;
    else if (arg === "--recovery-root") {
      const value = argv[index + 1];
      if (!value) throw new Error("--recovery-root requires a path");
      options.recoveryRoot = path.resolve(process.cwd(), value);
      index += 1;
    } else if (arg === "-h" || arg === "--help") {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function mediaOrigin(): string {
  const configured = process.env.SUPABASE_MEDIA_PUBLIC_URL?.trim().replace(/\/+$/, "");
  if (!configured) throw new Error("SUPABASE_MEDIA_PUBLIC_URL is required");
  return new URL(configured).origin;
}

function bucketName(): string {
  return process.env.SUPABASE_MEDIA_BUCKET?.trim() || DEFAULT_BUCKET;
}

function objectPathFromLegacyUrl(value: string, bucket: string): string {
  const url = new URL(value);
  if (url.origin !== LEGACY_MANAGED_SUPABASE_ORIGIN && url.origin !== CURRENT_SUPABASE_API_ORIGIN) {
    throw new Error(`Unexpected non-canonical URL origin: ${value}`);
  }
  const prefix = `/storage/v1/object/public/${bucket}/`;
  if (!url.pathname.startsWith(prefix)) {
    throw new Error(`Legacy URL is outside ${bucket}: ${value}`);
  }
  return decodeURIComponent(url.pathname.slice(prefix.length));
}

function currentPublicUrl(objectPath: string, bucket: string): string {
  const encodedPath = objectPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${mediaOrigin()}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodedPath}`;
}

async function fetchAllPublished(client: SupabaseClient, contract: RowContract): Promise<Row[]> {
  const rows: Row[] = [];
  const select = ["id", "slug", "universe_id", ...contract.mutableFields].join(",");
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from(contract.table)
      .select(select)
      .eq(contract.publishedColumn, true)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${contract.table}: ${error.message}`);
    const page = (data ?? []) as unknown as Row[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

function collectReferences(contract: RowContract, rows: Row[], bucket: string): LegacyReference[] {
  const references: LegacyReference[] = [];
  for (const row of rows) {
    for (const field of contract.mutableFields) {
      const value = row[field];
      for (const legacyUrl of findNonCanonicalMediaUrls(value)) {
        references.push({
          table: contract.table,
          rowId: row.id,
          slug: row.slug,
          field,
          legacyUrl,
          objectPath: objectPathFromLegacyUrl(legacyUrl, bucket),
        });
      }
    }
  }
  return references;
}

async function isHealthyImageUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-64", "User-Agent": USER_AGENT },
      redirect: "follow",
    });
    const contentType = response.headers.get("content-type") ?? "";
    await response.body?.cancel();
    return response.ok && contentType.startsWith("image/");
  } catch {
    return false;
  }
}
async function mapWithConcurrency<T, R>(items: readonly T[], concurrency: number, run: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (true) {
        const index = nextIndex;
        nextIndex += 1;
        if (index >= items.length) return;
        results[index] = await run(items[index]);
      }
    })
  );
  return results;
}

async function recoveryFile(recoveryRoot: string | null, objectPath: string): Promise<string | null> {
  if (!recoveryRoot) return null;
  const objectDirectory = path.resolve(recoveryRoot, objectPath);
  if (objectDirectory !== recoveryRoot && !objectDirectory.startsWith(`${recoveryRoot}${path.sep}`)) {
    throw new Error(`Recovery object escapes root: ${objectPath}`);
  }

  let entries;
  try {
    entries = await readdir(objectDirectory, { withFileTypes: true });
  } catch {
    return null;
  }
  const files = entries.filter((entry) => entry.isFile()).map((entry) => path.join(objectDirectory, entry.name));
  if (!files.length) return null;
  if (files.length > 1) {
    const hashes = new Set<string>();
    for (const file of files) hashes.add(createHash("sha256").update(await readFile(file)).digest("hex"));
    if (hashes.size > 1) throw new Error(`Ambiguous recovery versions for ${objectPath}`);
  }
  return files.sort()[0] ?? null;
}

async function validateImageBytes(bytes: Buffer, label: string): Promise<string> {
  const metadata = await sharp(bytes).metadata();
  if (!metadata.width || !metadata.height || !metadata.format) {
    throw new Error(`${label} is not a readable image`);
  }
  return `image/${metadata.format === "jpg" ? "jpeg" : metadata.format}`;
}

async function officialUniverseIcon(universeId: number): Promise<Buffer> {
  const endpoint = new URL("https://thumbnails.roblox.com/v1/games/icons");
  endpoint.searchParams.set("universeIds", String(universeId));
  endpoint.searchParams.set("returnPolicy", "PlaceHolder");
  endpoint.searchParams.set("size", "512x512");
  endpoint.searchParams.set("format", "Png");
  endpoint.searchParams.set("isCircular", "false");

  const metadataResponse = await fetch(endpoint, { headers: { "User-Agent": USER_AGENT } });
  if (!metadataResponse.ok) throw new Error(`Roblox thumbnail metadata returned HTTP ${metadataResponse.status}`);
  const payload = (await metadataResponse.json()) as { data?: Array<{ state?: string; imageUrl?: string }> };
  const imageUrl = payload.data?.find((item) => item.state === "Completed" && item.imageUrl)?.imageUrl;
  if (!imageUrl) throw new Error(`Roblox did not return a completed icon for universe ${universeId}`);

  const imageResponse = await fetch(imageUrl, { headers: { "User-Agent": USER_AGENT } });
  if (!imageResponse.ok) throw new Error(`Roblox universe icon returned HTTP ${imageResponse.status}`);
  const source = Buffer.from(await imageResponse.arrayBuffer());
  return sharp(source).resize(512, 512, { fit: "cover" }).webp({ quality: 90 }).toBuffer();
}

function markdownWithoutImage(markdown: string, legacyUrl: string): string {
  const lines = markdown.split(/\r?\n/);
  const next: string[] = [];
  for (const line of lines) {
    if (!line.includes(legacyUrl)) {
      next.push(line);
      continue;
    }
    const imagePattern = /!\[[^\]]*\]\((https:\/\/(?:bmwksaykcsndsvgspapz\.supabase\.co|database\.bloxodes\.com)[^)]+)\)/g;
    const onlyImage = line
      .trim()
      .match(/^!\[[^\]]*\]\((https:\/\/(?:bmwksaykcsndsvgspapz\.supabase\.co|database\.bloxodes\.com)[^)]+)\)$/);
    if (onlyImage?.[1] === legacyUrl) continue;
    next.push(line.replace(imagePattern, (match, url: string) => (url === legacyUrl ? (line.includes("|") ? "—" : "") : match)));
  }
  return next.join("\n").replace(/\n{3,}/g, "\n\n");
}

async function planResolutions(
  references: LegacyReference[],
  rowsByKey: Map<string, Row>,
  options: Options,
  bucket: string
): Promise<Map<string, ObjectResolution>> {
  const byUrl = new Map<string, LegacyReference[]>();
  for (const reference of references) {
    const matches = byUrl.get(reference.legacyUrl) ?? [];
    matches.push(reference);
    byUrl.set(reference.legacyUrl, matches);
  }

  const planned = await mapWithConcurrency(Array.from(byUrl.entries()), 12, async ([legacyUrl, matches]) => {
    const objectPath = matches[0].objectPath;
    const currentUrl = currentPublicUrl(objectPath, bucket);
    if (await isHealthyImageUrl(currentUrl)) {
      return [legacyUrl, { legacyUrl, currentUrl, objectPath, action: "already-current" }] as const;
    }

    const sourceFile = await recoveryFile(options.recoveryRoot, objectPath);
    if (sourceFile) {
      return [legacyUrl, { legacyUrl, currentUrl, objectPath, action: "recover-original", sourceFile }] as const;
    }

    const coverReference = matches.find((match) => match.table === "code_pages" && match.field === "cover_image");
    if (coverReference && options.replaceMissingCoversFromRoblox) {
      const row = rowsByKey.get(`${coverReference.table}:${coverReference.rowId}`);
      if (typeof row?.universe_id !== "number") {
        throw new Error(`${coverReference.slug} has no universe_id for a cover replacement`);
      }
      return [legacyUrl, { legacyUrl, currentUrl, objectPath, action: "replace-cover" }] as const;
    }

    const bodyOnly = matches.every((match) =>
      CONTRACTS.find((contract) => contract.table === match.table)?.markdownFields.includes(match.field)
    );
    if (bodyOnly && options.removeUnrecoverableBodyImages) {
      return [legacyUrl, { legacyUrl, currentUrl: null, objectPath, action: "remove-reference" }] as const;
    }

    return [legacyUrl, { legacyUrl, currentUrl: null, objectPath, action: "unresolved" }] as const;
  });
  return new Map<string, ObjectResolution>(planned);
}

async function uploadResolution(
  client: SupabaseClient,
  resolution: ObjectResolution,
  references: LegacyReference[],
  rowsByKey: Map<string, Row>,
  bucket: string
) {
  if (resolution.action !== "recover-original" && resolution.action !== "replace-cover") return;

  let bytes: Buffer;
  if (resolution.action === "recover-original") {
    if (!resolution.sourceFile) throw new Error(`Missing recovery source for ${resolution.objectPath}`);
    bytes = await readFile(resolution.sourceFile);
  } else {
    const coverReference = references.find(
      (reference) => reference.legacyUrl === resolution.legacyUrl && reference.table === "code_pages" && reference.field === "cover_image"
    );
    const row = coverReference ? rowsByKey.get(`${coverReference.table}:${coverReference.rowId}`) : null;
    if (typeof row?.universe_id !== "number") throw new Error(`Missing universe for ${resolution.objectPath}`);
    bytes = await officialUniverseIcon(row.universe_id);
  }

  const contentType = await validateImageBytes(bytes, resolution.objectPath);
  const { error } = await client.storage.from(bucket).upload(resolution.objectPath, bytes, {
    cacheControl: "31536000",
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`Upload failed for ${resolution.objectPath}: ${error.message}`);
  if (!resolution.currentUrl || !(await isHealthyImageUrl(resolution.currentUrl))) {
    throw new Error(`Uploaded media did not verify: ${resolution.currentUrl ?? resolution.objectPath}`);
  }
}

function patchedRows(
  contractsWithRows: Array<{ contract: RowContract; rows: Row[] }>,
  resolutions: Map<string, ObjectResolution>
) {
  const updates: Array<{ contract: RowContract; row: Row; patch: Record<string, string | null> }> = [];
  for (const { contract, rows } of contractsWithRows) {
    for (const row of rows) {
      const patch: Record<string, string | null> = {};
      for (const field of contract.mutableFields) {
        const value = row[field];
        if (typeof value !== "string") continue;
        let next = value;
        for (const legacyUrl of findNonCanonicalMediaUrls(value)) {
          const resolution = resolutions.get(legacyUrl);
          if (!resolution || resolution.action === "unresolved") continue;
          if (resolution.action === "remove-reference") next = markdownWithoutImage(next, legacyUrl);
          else if (resolution.currentUrl) next = next.split(legacyUrl).join(resolution.currentUrl);
        }
        if (next !== value) patch[field] = next || null;
      }
      if (Object.keys(patch).length) updates.push({ contract, row, patch });
    }
  }
  return updates;
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE?.trim();
  if (!supabaseUrl || !serviceRole) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE are required");
  const managedDevelopment = isManagedDevelopmentSupabaseUrl(supabaseUrl);
  if (!managedDevelopment && !options.allowRemoteRead && !options.apply) {
    throw new Error("Refusing inventory outside managed development without --allow-remote-read");
  }
  if (options.apply && !managedDevelopment && !options.allowProd) {
    throw new Error("Refusing repair outside managed development without --allow-prod");
  }

  const bucket = bucketName();
  const client = createClient(supabaseUrl, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });
  const contractsWithRows = await Promise.all(
    CONTRACTS.map(async (contract) => ({ contract, rows: await fetchAllPublished(client, contract) }))
  );
  const references = contractsWithRows.flatMap(({ contract, rows }) => collectReferences(contract, rows, bucket));
  const rowsByKey = new Map<string, Row>();
  for (const { contract, rows } of contractsWithRows) {
    for (const row of rows) rowsByKey.set(`${contract.table}:${row.id}`, row);
  }
  const resolutions = await planResolutions(references, rowsByKey, options, bucket);
  const unresolved = Array.from(resolutions.values()).filter((resolution) => resolution.action === "unresolved");
  const counts = Object.fromEntries(
    Array.from(Map.groupBy(Array.from(resolutions.values()), (resolution) => resolution.action)).map(([action, items]) => [
      action,
      items.length,
    ])
  );
  const affectedRows = new Set(references.map((reference) => `${reference.table}:${reference.rowId}`));
  console.log(
    JSON.stringify(
      {
        mode: options.apply ? "apply" : "dry-run",
        publishedRows: Object.fromEntries(contractsWithRows.map(({ contract, rows }) => [contract.table, rows.length])),
        affectedRows: affectedRows.size,
        legacyReferences: references.length,
        uniqueObjects: resolutions.size,
        actions: counts,
        unresolved: unresolved.map((resolution) => resolution.objectPath),
      },
      null,
      2
    )
  );
  if (unresolved.length) throw new Error(`${unresolved.length} media objects remain unresolved`);
  if (!references.length) return;

  const updates = patchedRows(contractsWithRows, resolutions);
  if (!options.apply) {
    console.log(`Would update ${updates.length} rows after media verification.`);
    return;
  }

  const backupDirectory = path.resolve(process.cwd(), "tmp/legacy-media-repair");
  const backupPath = path.join(backupDirectory, `published-rows-before-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  await mkdir(backupDirectory, { recursive: true });
  await writeFile(
    backupPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        supabaseHost: new URL(supabaseUrl).hostname,
        rows: updates.map(({ contract, row }) => ({
          table: contract.table,
          id: row.id,
          slug: row.slug,
          values: Object.fromEntries(contract.mutableFields.map((field) => [field, row[field] ?? null])),
        })),
      },
      null,
      2
    )}\n`
  );
  console.log(`Pre-repair row backup: ${backupPath}`);

  await mapWithConcurrency(Array.from(resolutions.values()), 4, (resolution) =>
    uploadResolution(client, resolution, references, rowsByKey, bucket)
  );
  for (const { contract, row, patch } of updates) {
    const { error } = await client.from(contract.table).update(patch).eq("id", row.id);
    if (error) throw new Error(`Failed to update ${contract.table}:${row.slug}: ${error.message}`);
  }

  const verificationRows = await Promise.all(
    CONTRACTS.map(async (contract) => ({ contract, rows: await fetchAllPublished(client, contract) }))
  );
  const remaining = verificationRows.flatMap(({ contract, rows }) => collectReferences(contract, rows, bucket));
  if (remaining.length) throw new Error(`Verification found ${remaining.length} remaining non-canonical references`);
  await mapWithConcurrency(
    Array.from(resolutions.values()).filter(
      (resolution): resolution is ObjectResolution & { currentUrl: string } => Boolean(resolution.currentUrl)
    ),
    12,
    async (resolution) => {
      if (!(await isHealthyImageUrl(resolution.currentUrl))) {
        throw new Error(`Final media verification failed: ${resolution.currentUrl}`);
      }
    }
  );
  console.log(`Repair complete: ${updates.length} rows updated; zero published non-canonical references remain.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
