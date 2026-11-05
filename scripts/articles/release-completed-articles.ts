import { readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { classifyArticleImageSrc } from "@/lib/article-media";
import {
  findArticleImages,
  usedVerifiedArticleImages,
  type ArticleImageEntry,
  type ArticleImageManifest,
} from "../content/article-image-readiness";
import { CANONICAL_MEDIA_ORIGIN } from "../shared/storage-public-url";
import { fetchWithTransientRetries } from "../shared/transient-http";
import { artifactHashes, type PipelineState } from "./article-pipeline";

// Shared direct-publication helpers and retained pipeline approval readers.
type ArticleFinal = {
  title: string;
  slug: string;
  content_md: string;
};

type ProductionArticleRow = {
  id: string;
  slug: string | null;
  title: string | null;
  cover_image: string | null;
  content_md: string | null;
  is_published: boolean | null;
};

type ProductionProvenanceRow = {
  public_url: string | null;
  uploaded_path: string | null;
  original_url: string | null;
};

export async function resolveReleaseArtifactPath(filePath: string, queueId: string, slug: string, worktree = process.cwd()): Promise<string> {
  const root = await realpath(worktree);
  const actual = await realpath(filePath);
  const legacy = await realpath(path.join(root, "tmp", "content-workspace")).catch(() => path.join(root, "tmp", "content-workspace"));
  if (actual.startsWith(`${legacy}${path.sep}`)) return actual;
  const pipeline = await realpath(path.join(root, "tmp", "article-pipeline")).catch(() => path.join(root, "tmp", "article-pipeline"));
  if (!actual.startsWith(`${pipeline}${path.sep}`) || path.basename(path.dirname(actual)) !== "content") {
    throw new Error(`${filePath} resolves outside an approved article workspace.`);
  }
  const runDir = path.dirname(path.dirname(actual));
  if (path.dirname(runDir) !== pipeline) throw new Error("Invalid pipeline run path.");
  const state = JSON.parse(await readFile(path.join(runDir, "state.json"), "utf8")) as PipelineState;
  const review = JSON.parse(await readFile(path.join(runDir, "editorial_review.json"), "utf8"));
  const hashes = await artifactHashes(path.dirname(actual));
  if (state.status !== "completed" || state.stage !== "done" || state.job.id !== queueId || state.job.slug !== slug || review.status !== "completed") {
    throw new Error("Pipeline article has no matching completed approval.");
  }
  const ownerApproval = state.ownerApprovals?.slice(-1).pop();
  if (ownerApproval && (ownerApproval.status !== "completed" || ["brief.md", "media.json", "final.json"].some(name => ownerApproval.approvedArtifacts[name] !== hashes[name] || review.input_hashes?.[name] !== hashes[name]))) {
    throw new Error("Owner approval is pending or does not match the release inputs.");
  }
  for (const name of ["brief.md", "media.json", "final.json"]) {
    if (!hashes[name] || hashes[name] !== state.artifacts[name]) throw new Error(`Pipeline approval no longer matches ${name}.`);
  }
  for (const stage of ["copy_check", "image_check", "import_verify", "browser_verify"] as const) {
    if (state.history.filter(entry => entry.stage === stage).pop()?.decision.status !== "completed") {
      throw new Error(`Pipeline article is missing ${stage} verification.`);
    }
  }
  return actual;
}

export function pickCoverSourceEntry(manifest: ArticleImageManifest, content: string): ArticleImageEntry | null {
  return usedVerifiedArticleImages(manifest, content)[0] ?? null;
}

function normalizedSet(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function normalizedArticleContent(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

function assertSameValues(actual: string[], expected: string[], label: string): void {
  const normalizedActual = normalizedSet(actual);
  const normalizedExpected = normalizedSet(expected);
  if (JSON.stringify(normalizedActual) !== JSON.stringify(normalizedExpected)) {
    throw new Error(
      `${label} mismatch. Expected ${JSON.stringify(normalizedExpected)}, got ${JSON.stringify(normalizedActual)}.`,
    );
  }
}

export function assertProductionSnapshot(params: {
  finalJson: ArticleFinal;
  manifest: ArticleImageManifest;
  article: ProductionArticleRow;
  provenance: ProductionProvenanceRow[];
}): void {
  const { finalJson, manifest, article, provenance } = params;
  if (article.slug !== finalJson.slug || article.title !== finalJson.title || article.is_published !== true) {
    throw new Error(`${finalJson.slug}: production article identity or publication state does not match final.json.`);
  }
  if (normalizedArticleContent(article.content_md ?? "") !== normalizedArticleContent(finalJson.content_md)) {
    throw new Error(`${finalJson.slug}: production content_md does not match the normalized promoted final.json.`);
  }
  if (!article.cover_image || new URL(article.cover_image).origin !== CANONICAL_MEDIA_ORIGIN) {
    throw new Error(`${finalJson.slug}: production cover_image is missing or not hosted on ${CANONICAL_MEDIA_ORIGIN}.`);
  }

  const verifiedEntries = usedVerifiedArticleImages(manifest, finalJson.content_md);
  const expectedBodyUrls = verifiedEntries.map((entry) => entry.public_url?.trim() || "");
  if (expectedBodyUrls.some((value) => !value)) {
    throw new Error(`${finalJson.slug}: verified manifest entry is missing public_url after promotion.`);
  }
  for (const publicUrl of expectedBodyUrls) {
    if (publicUrl.startsWith("/")) continue;
    if (new URL(publicUrl).origin !== CANONICAL_MEDIA_ORIGIN) {
      throw new Error(`${finalJson.slug}: promoted body image is not hosted on ${CANONICAL_MEDIA_ORIGIN}.`);
    }
  }
  assertSameValues(
    findArticleImages(article.content_md ?? "").map((image) => image.src),
    expectedBodyUrls,
    `${finalJson.slug} body image URLs`,
  );

  const expectedProvenance = verifiedEntries
    .filter((entry) => !entry.public_url?.startsWith("/") || !classifyArticleImageSrc(entry.public_url, finalJson.slug).ok)
    .map((entry) => `${entry.public_url}|${entry.uploaded_path}|${entry.original_image_url}`);
  const actualProvenance = provenance.map(
    (entry) => `${entry.public_url}|${entry.uploaded_path}|${entry.original_url}`,
  );
  assertSameValues(actualProvenance, expectedProvenance, `${finalJson.slug} provenance rows`);
}

export async function downloadCoverSource(
  artifact: { manifest: ArticleImageManifest; finalJson: ArticleFinal },
  targetDir: string,
  fetchSource = fetchWithTransientRetries,
): Promise<string | null> {
  const entry = pickCoverSourceEntry(artifact.manifest, artifact.finalJson.content_md);
  if (!entry?.public_url) return null;
  let bytes: Buffer;
  try {
    const response = await fetchSource(entry.public_url, {
      redirect: "follow",
      headers: { "user-agent": "Bloxodes automated article release" },
    });
    if (!response.ok) throw new Error(`cover source returned HTTP ${response.status}`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      throw new Error(`cover source returned ${contentType || "an unknown content type"}`);
    }
    bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length) throw new Error("cover source returned an empty body");
  } catch (error) {
    console.warn(`${entry.label}: ${error instanceof Error ? error.message : String(error)}; using the normal article cover fallback.`);
    return null;
  }
  // This source is also a used body image, so corrupt pixels must fail publication.
  await sharp(bytes).resize(1, 1).raw().toBuffer();
  const filePath = path.join(targetDir, `${artifact.finalJson.slug}.webp`);
  await writeFile(filePath, bytes);
  return filePath;
}
