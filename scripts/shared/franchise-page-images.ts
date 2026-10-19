import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertFranchisePageImages, franchiseImageUrl } from "../ci/franchise-image-contract.mjs";

export const MAX_FRANCHISE_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_FRANCHISE_IMAGE_PIXELS = 16 * 1024 * 1024;

async function readImageBody(response: Response): Promise<Buffer> {
  if (Number(response.headers.get("content-length")) > MAX_FRANCHISE_IMAGE_BYTES) {
    await response.body?.cancel();
    throw new Error(`image exceeds ${MAX_FRANCHISE_IMAGE_BYTES} byte limit`);
  }
  if (!response.body) throw new Error("image response has no body");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return Buffer.concat(chunks, size);
      size += value.byteLength;
      if (size > MAX_FRANCHISE_IMAGE_BYTES) throw new Error(`image exceeds ${MAX_FRANCHISE_IMAGE_BYTES} byte limit`);
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}

export async function verifyFranchisePageImage({ url, role, label }: { url: string; role: string; label: string }) {
  // Revalidate here even when the caller already checked its publication plan.
  const allowedUrl = franchiseImageUrl(url);
  if (!allowedUrl) throw new Error(`${label}: disallowed ${role} image URL ${url}`);
  const response = await fetch(allowedUrl, { redirect: "manual", signal: AbortSignal.timeout(30_000) }).catch(error => {
    throw new Error(`${label}: unavailable ${role} image ${url}: ${String(error)}`);
  });
  if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) {
    await response.body?.cancel().catch(() => {});
    throw new Error(`${label}: unavailable ${role} image ${url} (HTTP ${response.status}; redirects are not allowed)`);
  }
  const bytes = await readImageBody(response).catch(error => {
    throw new Error(`${label}: unreadable ${role} image body ${url}: ${String(error)}`);
  });
  const metadata = await (async () => {
    const decoder = sharp(bytes, { failOn: "warning", limitInputPixels: MAX_FRANCHISE_IMAGE_PIXELS });
    const metadata = await decoder.metadata();
    // Metadata alone can accept intact headers with damaged pixel data.
    await decoder.timeout({ seconds: 10 }).raw().toBuffer();
    return metadata;
  })().catch(error => {
    throw new Error(`${label}: unreadable ${role} image ${url}: ${String(error)}`);
  });
  if (!metadata.width || !metadata.height) throw new Error(`${label}: ${role} has no readable image dimensions: ${url}`);
  const ratio = metadata.width / metadata.height;
  if (role === "cover" && (ratio < 1.6 || ratio > 2)) throw new Error(`${label}: cover_image must be landscape artwork between 16:10 and 2:1, ideally 16:9 (${metadata.width}x${metadata.height}): ${url}`);
  if (role === "thumbnail" && Math.abs(ratio - 1) > 0.05) throw new Error(`${label}: hero_image must be a square thumbnail (${metadata.width}x${metadata.height}): ${url}`);
}

const tables: Record<string, string> = { wiki: "game_wiki_pages", codesPages: "game_code_pages", tools: "game_tool_pages", maps: "game_map_pages", quizzes: "game_quiz_pages", catalog: "game_catalog_pages", checklists: "game_checklist_pages" };

export async function validateFranchisePublicationImages(sb: SupabaseClient, namespace: string, payload: Record<string, Array<Record<string, unknown>>>) {
  const storedGames: Array<Record<string, unknown>> = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await sb.from("games").select("*").eq("namespace", namespace).order("id").range(start, start + 999);
    if (error) throw error;
    storedGames.push(...data);
    if (data.length < 1000) break;
  }
  await assertFranchisePageImages({ namespace, payload, storedGames, verifyImage: verifyFranchisePageImage, loadPage: async (group: string, row: Record<string, unknown>) => {
    let query = sb.from(tables[group]).select("*").eq("namespace", namespace);
    query = ["wiki", "codesPages"].includes(group) ? query.eq("game_id", row.game_id) : query.eq("slug", row.slug);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data;
  } });
}
