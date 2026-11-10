import { factoryPublicationPayload } from "./factory-commit";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CodePageFinal } from "./final-contract";
import type { loadCodesContext } from "./factory-context";
import type { publicCopyFindings } from "../content/check-public-copy";

export function bundleFingerprint(final: CodePageFinal) {
  return createHash("sha256").update(JSON.stringify(Object.entries(final).sort(([a], [b]) => a.localeCompare(b)))).digest("hex");
}
function matchesLiveBundle(row: any, final: CodePageFinal) {
  return row?.is_published && Object.entries(factoryPublicationPayload(final)).every(
    ([field, value]) => row[field] === value);
}
export async function publishCodesBundle(sb: SupabaseClient, final: CodePageFinal, deps: {
  target?: "development" | "production";
  context: (options: { allRelatedPages: true }) => ReturnType<typeof loadCodesContext>;
  guard: () => Promise<unknown>;
  publicCopyFindings: typeof publicCopyFindings;
  ensureIdentity: (link: string) => Promise<{ universeId?: number | null }>;
  prepare: (game: any, fingerprint: string, linkedIds: string[], final: CodePageFinal) => Promise<void>;
}) {

  const { data: retryRows, error: retryError } = await sb.from("code_pages").select("*").or(`universe_id.eq.${final.universe_id},slug.eq.${final.slug}`);
  if (retryError) throw new Error(`Overlap lookup failed: ${retryError.message}`);
  if ((retryRows ?? []).some((row: any) => row.universe_id !== final.universe_id || row.slug !== final.slug) || (retryRows ?? []).length > 1) throw new Error("Slug or universe overlaps a different code page; review it first");
  // Production retries retain the existing no-context fast path.
  if (deps.target !== "development" && matchesLiveBundle(retryRows?.[0], final)) return;
  const context = await deps.context({ allRelatedPages: true });
  const allowed = new Set(context.related_pages.map(row => `/codes/${row.slug}`));
  if (deps.target === "development") {
    final = { ...final, interlinking_copy_md: final.interlinking_copy_md.replace(
      /\[([^\]]*)\]\(([^)]+)\)/g, (match, label, link) => allowed.has(link) ? match : label) };
  }
  const fingerprint = bundleFingerprint(final);
  if (deps.target === "development" && matchesLiveBundle(retryRows?.[0], final)) return;
  const links = [...final.interlinking_copy_md.matchAll(/\]\(([^)]+)\)/g)].map(match => match[1]);
  if (links.some(link => !allowed.has(link))) throw new Error("Interlink copy contains an ineligible related-page link");
  if (deps.target !== "development" && context.related_pages.length && !links.length) throw new Error("Interlink copy must link an eligible related page");
  let game = retryRows?.[0];
  await deps.guard();
  const findings = ["intro_md", "redeem_md", "troubleshoot_md", "rewards_md", "find_codes_md", "meta_description", "interlinking_copy_md"].flatMap(field =>
    deps.publicCopyFindings({ description_md: final[field as keyof typeof final] }, field));
  if (findings.length) throw new Error(`Public copy check failed: ${JSON.stringify(findings)}`);
  const identityResult = await deps.ensureIdentity(final.roblox_link);
  if (identityResult.universeId !== final.universe_id) throw new Error("Roblox link did not resolve to the bundle universe");
  const identity = { name: final.name, slug: final.slug, universe_id: final.universe_id, roblox_link: final.roblox_link,
    source_url: final.source_url, source_url_2: final.source_url_2 };
  if (!game) {
    const result = await sb.from("code_pages").insert({ ...identity, is_published: false }).select("*").single();
    if (result.error) throw new Error(`Draft write failed: ${result.error.message}`);
    game = result.data;
  }
  // Preparation sees the new sources, but the live row keeps its old content until commit.
  await deps.prepare({ ...game, ...identity }, fingerprint, context.related_pages.filter(row => links.includes(`/codes/${row.slug}`)).map(row => row.id), final);
  const verified = await sb.from("code_pages").select("is_published,universe_id").eq("id", game.id).single();
  if (verified.error || !verified.data?.is_published || verified.data.universe_id !== final.universe_id) throw new Error("Published row readback failed");
}
