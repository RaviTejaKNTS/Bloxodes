import "../shared/load-env";
import * as cheerio from "cheerio";
import sharp from "sharp";
import { supabaseAdmin } from "@/lib/supabase-admin";

type PuzzleIconSource = {
  slug: string;
  label: string;
  sourceUrl: string;
  kind: "direct" | "beebom" | "linkedin";
  alt?: string;
};

const BEEBOM_PUZZLE_HUB = "https://beebom.com/puzzle/";
const USER_AGENT = "Mozilla/5.0 (compatible; BloxodesPuzzleIconBot/1.0)";

const sources: PuzzleIconSource[] = [
  { slug: "wordle", label: "Wordle", kind: "beebom", sourceUrl: BEEBOM_PUZZLE_HUB, alt: "Wordle" },
  { slug: "connections", label: "Connections", kind: "beebom", sourceUrl: BEEBOM_PUZZLE_HUB, alt: "Connections" },
  { slug: "strands", label: "Strands", kind: "beebom", sourceUrl: BEEBOM_PUZZLE_HUB, alt: "Strands" },
  { slug: "spelling-bee", label: "Spelling Bee", kind: "beebom", sourceUrl: BEEBOM_PUZZLE_HUB, alt: "Spelling Bee" },
  { slug: "letter-boxed", label: "Letter Boxed", kind: "beebom", sourceUrl: BEEBOM_PUZZLE_HUB, alt: "Letter Boxed" },
  { slug: "sudoku", label: "Sudoku", kind: "direct", sourceUrl: "https://commons.wikimedia.org/wiki/Special:Redirect/file/The_New_York_Times_Sudoku.svg" },
  { slug: "pips", label: "NYT Pips", kind: "beebom", sourceUrl: BEEBOM_PUZZLE_HUB, alt: "NYT Pips" },
  { slug: "contexto", label: "Contexto", kind: "beebom", sourceUrl: BEEBOM_PUZZLE_HUB, alt: "Contexto" },
  { slug: "letroso", label: "Letroso", kind: "beebom", sourceUrl: BEEBOM_PUZZLE_HUB, alt: "Letroso" },
  { slug: "linkedin-zip", label: "LinkedIn Zip", kind: "linkedin", sourceUrl: "https://www.linkedin.com/showcase/zip-game/" },
  { slug: "linkedin-crossclimb", label: "LinkedIn Crossclimb", kind: "linkedin", sourceUrl: "https://www.linkedin.com/showcase/crossclimb/" },
  { slug: "linkedin-queens", label: "LinkedIn Queens", kind: "linkedin", sourceUrl: "https://www.linkedin.com/showcase/queens-game/" },
  { slug: "linkedin-tango", label: "LinkedIn Tango", kind: "linkedin", sourceUrl: "https://www.linkedin.com/showcase/tango-game/" },
  { slug: "linkedin-mini-sudoku", label: "LinkedIn Mini Sudoku", kind: "linkedin", sourceUrl: "https://www.linkedin.com/showcase/minisudoku-game/" }
];

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#038;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#039;/g, "'");
}

function normalizeSourceUrl(value: string) {
  const decoded = decodeHtml(value.trim());
  const url = new URL(decoded);
  if (url.hostname === "static.beebom.com") {
    url.searchParams.set("quality", "100");
    url.searchParams.set("w", "900");
  }
  return url.toString();
}

async function fetchText(sourceUrl: string) {
  const response = await fetch(sourceUrl, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) throw new Error(`Failed to fetch ${sourceUrl}: ${response.status}`);
  return response.text();
}

async function resolveBeebomIcon(source: PuzzleIconSource) {
  const html = await fetchText(source.sourceUrl);
  const $ = cheerio.load(html);
  const targetAlt = source.alt?.toLowerCase();
  const image = $("img").toArray().find((node) => {
    const alt = String($(node).attr("alt") ?? "").trim().toLowerCase();
    return alt === targetAlt;
  });
  const rawUrl = image ? ($(image).attr("src") ?? $(image).attr("data-src") ?? "") : "";
  if (!rawUrl) throw new Error(`Could not find Beebom icon for ${source.slug}`);
  return normalizeSourceUrl(rawUrl);
}

async function resolveLinkedInIcon(source: PuzzleIconSource) {
  const html = await fetchText(source.sourceUrl);
  const $ = cheerio.load(html);
  const pageName = source.label.replace(/^LinkedIn\s+/, "");
  const candidates = $("img").toArray().map((node) => ({
    alt: String($(node).attr("alt") ?? ""),
    src: String($(node).attr("src") ?? $(node).attr("data-delayed-url") ?? "")
  }));
  const exact = candidates.find((candidate) => candidate.alt === `${pageName}, a puzzle by LinkedIn`);
  const logo = exact ?? candidates.find((candidate) => candidate.src.includes("company-logo_200_200"));
  if (!logo?.src) throw new Error(`Could not find LinkedIn icon for ${source.slug}`);
  return normalizeSourceUrl(logo.src);
}

async function resolveIconUrl(source: PuzzleIconSource) {
  if (source.kind === "direct") return source.sourceUrl;
  if (source.kind === "beebom") return resolveBeebomIcon(source);
  return resolveLinkedInIcon(source);
}

async function downloadIcon(sourceUrl: string) {
  const response = await fetch(sourceUrl, {
    headers: {
      "accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      "user-agent": USER_AGENT
    }
  });
  if (!response.ok) throw new Error(`Failed to download ${sourceUrl}: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function convertIcon(buffer: Buffer) {
  return sharp(buffer, { animated: false })
    .flatten({ background: "#ffffff" })
    .trim({ background: "#ffffff", threshold: 12 })
    .resize(675, 675, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

async function ensureBucket(bucket: string) {
  const supabase = supabaseAdmin();
  const { data } = await supabase.storage.getBucket(bucket);
  if (data) return;

  const { error } = await supabase.storage.createBucket(bucket, { public: true });
  if (error && !error.message.toLowerCase().includes("already exists")) {
    throw new Error(`Failed to create storage bucket ${bucket}: ${error.message}`);
  }
}

async function uploadAndUpdate(source: PuzzleIconSource) {
  const bucket = process.env.SUPABASE_MEDIA_BUCKET;
  if (!bucket) throw new Error("SUPABASE_MEDIA_BUCKET is required.");

  const supabase = supabaseAdmin();
  const iconSourceUrl = await resolveIconUrl(source);
  const raw = await downloadIcon(iconSourceUrl);
  const icon = await convertIcon(raw);
  const path = `puzzles/icons/${source.slug}.png`;

  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, icon, {
    contentType: "image/png",
    upsert: true
  });
  if (uploadError) throw new Error(`Failed to upload ${source.slug}: ${uploadError.message}`);

  const publicUrl = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  const { error: updateError } = await supabase
    .from("puzzle_pages")
    .update({ icon_url: publicUrl })
    .eq("slug", source.slug);
  if (updateError) throw new Error(`Failed to update ${source.slug}: ${updateError.message}`);

  console.log(`[ok] ${source.slug} ${publicUrl}`);
}

async function main() {
  const onlySlug = process.argv.find((arg) => arg.startsWith("--slug="))?.slice("--slug=".length);
  const targetSources = onlySlug ? sources.filter((source) => source.slug === onlySlug) : sources;
  if (onlySlug && targetSources.length === 0) throw new Error(`Unsupported puzzle slug: ${onlySlug}`);

  const bucket = process.env.SUPABASE_MEDIA_BUCKET;
  if (!bucket) throw new Error("SUPABASE_MEDIA_BUCKET is required.");
  await ensureBucket(bucket);

  for (const source of targetSources) {
    await uploadAndUpdate(source);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
