import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertFranchisePageImages } from "../ci/franchise-image-contract.mjs";

export async function verifyFranchisePageImage({ url, role, label }: { url: string; role: string; label: string }) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) }).catch(error => {
    throw new Error(`${label}: unavailable ${role} image ${url}: ${String(error)}`);
  });
  if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) throw new Error(`${label}: unavailable ${role} image ${url}`);
  const metadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata().catch(error => {
    throw new Error(`${label}: unreadable ${role} image ${url}: ${String(error)}`);
  });
  if (!metadata.width || !metadata.height) throw new Error(`${label}: ${role} has no readable image dimensions: ${url}`);
  const ratio = metadata.width / metadata.height;
  if (role === "cover" && Math.abs(ratio - 16 / 9) > 0.08) throw new Error(`${label}: cover_image must be 16:9 landscape artwork (${metadata.width}x${metadata.height}): ${url}`);
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
