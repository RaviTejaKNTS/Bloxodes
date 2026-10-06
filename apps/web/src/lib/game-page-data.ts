import { parseQuizData, type QuizData } from "./quiz-types";

export type GameMapMarker = { id: string; title: string; x: number; y: number; category?: string; description?: string; href?: string };
export type GameMapData = { image: string; width: number; height: number; attribution: string; markers: GameMapMarker[] };
export type GameCatalogData = { columns: Array<{ key: string; label: string }>; items: Array<Record<string, string | number | boolean | null> & { id: string }> };
export type GameExtendedPage = { id: string; namespace: string; game_id: string; slug: string; title: string; game_title: string; canonical_path: string; seo_title: string | null; meta_description: string | null; intro_md: string | null; description_md: string | null; sources_json: Array<{ title: string; url: string }>; published_at: string | null; created_at: string; updated_at: string; renderer_key?: string; map_data?: unknown; quiz_data?: unknown; catalog_data?: unknown };

function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function text(value: unknown): value is string { return typeof value === "string" && !!value.trim(); }
export function safeGameContentUrl(value: unknown): value is string {
  if (typeof value !== "string" || /[\s\\]/.test(value)) return false;
  if (/^\/(?!\/)[a-zA-Z0-9/_.,%#?=&-]+$/.test(value)) return true;
  if (!/^https:\/\/[a-zA-Z0-9][a-zA-Z0-9.-]*(?::[0-9]{1,5})?(?:[/?#].*)?$/.test(value)) return false;
  const hostname = value.slice(8).split(/[/?#]/)[0].split(":")[0];
  if (!/^[0-9.]+$/.test(hostname) && !/^([a-zA-Z0-9][a-zA-Z0-9-]*[.])*[a-zA-Z][a-zA-Z-]*$/.test(hostname)) return false;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
}
function boundedData(value: unknown) { if (!record(value) || JSON.stringify(value).length > 4_194_304) throw new Error("Page data must be an object smaller than 4 MB."); }
export function parseGameMapData(value: unknown): GameMapData {
  boundedData(value);
  const data = value as Record<string, unknown>;
  if (!safeGameContentUrl(data.image) || typeof data.width !== "number" || !Number.isFinite(data.width) || data.width <= 0 || data.width > 1000000 || typeof data.height !== "number" || !Number.isFinite(data.height) || data.height <= 0 || data.height > 1000000 || !text(data.attribution) || !Array.isArray(data.markers) || !data.markers.length || data.markers.length > 10000) throw new Error("Maps need an image, positive dimensions, attribution and verified markers.");
  const seen = new Set<string>();
  const markers = data.markers.map(marker => {
    if (!record(marker) || !text(marker.id) || seen.has(marker.id) || !text(marker.title) || typeof marker.x !== "number" || !Number.isFinite(marker.x) || marker.x < 0 || marker.x > 100 || typeof marker.y !== "number" || !Number.isFinite(marker.y) || marker.y < 0 || marker.y > 100 || marker.href !== undefined && !safeGameContentUrl(marker.href) || marker.category !== undefined && !text(marker.category) || marker.description !== undefined && typeof marker.description !== "string") throw new Error("Map markers need unique IDs, titles, coordinates from 0 to 100 and safe links.");
    seen.add(marker.id);
    return marker as GameMapMarker;
  });
  return { image: data.image, width: data.width, height: data.height, attribution: data.attribution, markers };
}
export function parseGameQuizData(value: unknown): QuizData {
  boundedData(value);
  const data = parseQuizData(value);
  for (const questions of Object.values(data)) {
    if (questions.length > 1000) throw new Error("Each quiz level supports at most 1000 questions.");
    for (const question of questions) if (question.image && !safeGameContentUrl(question.image)) throw new Error("Quiz images need safe hosted URLs.");
  }
  return data;
}
export function parseGameCatalogData(value: unknown): GameCatalogData {
  boundedData(value);
  const data = value as Record<string, unknown>;
  if (!Array.isArray(data.columns) || !data.columns.length || data.columns.length > 30 || !Array.isArray(data.items) || !data.items.length || data.items.length > 10000) throw new Error("Catalogs need named columns and items.");
  const keys = new Set<string>();
  const columns = data.columns.map(column => {
    if (!record(column) || typeof column.key !== "string" || !/^[a-z][a-z0-9_]*$/.test(column.key) || column.key === "id" || keys.has(column.key) || !text(column.label)) throw new Error("Catalog columns need unique keys and labels.");
    keys.add(column.key);
    return { key: column.key, label: column.label };
  });
  const seen = new Set<string>();
  const items = data.items.map(item => {
    if (!record(item) || !text(item.id) || seen.has(item.id) || Object.entries(item).some(([key,value]) => key !== "id" && (!keys.has(key) || value !== null && !["string","number","boolean"].includes(typeof value) || typeof value === "number" && !Number.isFinite(value)))) throw new Error("Catalog items need unique IDs and plain values for their defined columns.");
    seen.add(item.id);
    return item as GameCatalogData["items"][number];
  });
  return { columns, items };
}
