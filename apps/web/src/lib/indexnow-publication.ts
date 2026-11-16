import "server-only";

import { load } from "cheerio";
import { supabaseAdmin } from "@/lib/supabase";
import { SITE_URL } from "@/lib/seo";
import { isIndexNowEnabled, submitIndexNowPaths, type IndexNowSubmitResult } from "@/lib/indexnow";

export const INDEXNOW_PUBLICATION_CAP = 100;
const GATE_TIMEOUT_MS = 500;
const PUBLICATION_BUDGET_MS = 20_000;
const GATE_CONCURRENCY = 5;

type GateResult = { ok: boolean; reason: string | null };
type PendingCheck = { path: string; checked_at: string; capped: boolean };

function blocksBing(header: string): boolean {
  // A bot prefix applies to subsequent comma-separated directives until another
  // prefix appears. Google-only noindex must not hide a Bing noindex (or vice versa).
  let bot = "";
  return header.split(",").some(part => {
    const directive = part.trim().toLowerCase();
    const scoped = directive.match(/^([a-z][a-z0-9_-]*):\s*(.*)$/);
    if (scoped) bot = scoped[1];
    return (!bot || bot === "bingbot" || bot === "indexnow") && /\b(noindex|none)\b/.test(scoped?.[2] ?? directive);
  });
}

// The rendered page owns visibility, parent/dataset rules and canonical identity.
// Namespace roots can have a single segment. Redirects never count as publication.
export async function checkPublicIndexNowPage(path: string, signal?: AbortSignal): Promise<GateResult> {
  if (!/^\/(?:[^/?#]+\/)*[^/?#]+$/.test(path) || /\/(?:page|api|sitemaps)(?:\/|$)/.test(path)) {
    return { ok: false, reason: "invalid-page-path" };
  }
  const url = new URL(path, SITE_URL).href;
  try {
    const timeout = AbortSignal.timeout(GATE_TIMEOUT_MS);
    const response = await fetch(url, {
      redirect: "manual", cache: "no-store",
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout
    });
    if (response.status !== 200) return { ok: false, reason: `http-${response.status}` };
    if (!response.headers.get("content-type")?.toLowerCase().includes("text/html")) return { ok: false, reason: "not-html" };
    if (blocksBing(response.headers.get("x-robots-tag") ?? "")) return { ok: false, reason: "header-noindex" };
    const $ = load(await response.text());
    const blocked = $("meta").toArray().some(node => {
      const name = ($(node).attr("name") ?? "").toLowerCase();
      return ["robots", "bingbot", "indexnow"].includes(name) && /\b(noindex|none)\b/i.test($(node).attr("content") ?? "");
    });
    if (blocked) return { ok: false, reason: "meta-noindex" };
    const canonicals = $('link[rel="canonical"]');
    const canonical = canonicals.attr("href");
    if (canonicals.length !== 1 || !canonical || new URL(canonical, url).href !== url) return { ok: false, reason: "not-self-canonical" };
    return { ok: true, reason: null };
  } catch {
    return { ok: false, reason: "fetch-failed-or-timeout" };
  }
}

// No event input: any valid revalidation request can drain an older publication.
export async function drainIndexNowPublications(): Promise<IndexNowSubmitResult> {
  const empty = { enabled: isIndexNowEnabled(), attempted: 0, submitted: 0, successfulBatches: 0, failedBatches: 0 };
  if (!empty.enabled) return { ...empty, reason: "disabled-or-non-production" };
  try {
    const signal = AbortSignal.timeout(PUBLICATION_BUDGET_MS);
    const db = supabaseAdmin();
    // Atomic reservations increment check_count and last_checked_at. Other drains
    // skip these rows for 60 seconds, even across processes and restarts.
    const pending = await db.rpc("take_indexnow_pending_checks").abortSignal(signal);
    if (pending.error) throw pending.error;
    const candidates = (pending.data ?? []) as PendingCheck[];
    if (candidates.some(row => row.capped)) console.warn(`IndexNow publication cap: more pending checks than limit ${INDEXNOW_PUBLICATION_CAP}`);
    if (!candidates.length) return { ...empty, reason: "no-pending-pages" };
    const paths: string[] = [];
    for (let offset = 0; offset < candidates.length; offset += GATE_CONCURRENCY) {
      signal.throwIfAborted();
      await Promise.all(candidates.slice(offset, offset + GATE_CONCURRENCY).map(async row => {
        const gate = await checkPublicIndexNowPage(row.path, signal);
        // The timestamp condition prevents a late checker overwriting a newer
        // check's reason. No failed gate consumes the one-way submission claim.
        const saved = await db.from("indexnow_urls").update({ detail: gate.reason })
          .eq("path", row.path).eq("state", "pending").eq("last_checked_at", row.checked_at).abortSignal(signal);
        if (saved.error) throw saved.error;
        if (gate.ok) paths.push(row.path);
      }));
    }
    if (!paths.length) return { ...empty, reason: "no-new-indexable-pages" };
    const { data, error } = await db.rpc("claim_indexnow_urls", { paths }).abortSignal(signal);
    if (error) throw error;
    const claimed = (data ?? []) as string[];
    if (!claimed.length) return { ...empty, reason: "already-claimed-or-expired" };
    let result: IndexNowSubmitResult;
    try {
      result = await submitIndexNowPaths(claimed, signal);
    } catch {
      result = { ...empty, attempted: claimed.length, failedBatches: 1, reason: "submission-threw" };
    }
    const state = result.submitted === claimed.length ? "submitted" : "failed";
    // A separate small persistence budget still records an expired send budget.
    const saved = await db.from("indexnow_urls").update({ state, detail: state === "failed" ? `${result.reason ?? "submission-failed-or-uncertain"}; automatic retry prohibited` : null })
      .in("path", claimed).eq("state", "attempted").abortSignal(AbortSignal.timeout(1_000));
    if (saved.error) console.warn("IndexNow outcome persistence failed; durable attempted claims retained");
    if (state === "failed") console.warn(`IndexNow publication failure: ${claimed.length} durable claims require inspection`);
    return result;
  } catch {
    console.warn("IndexNow publication processing failed; inspect pending/attempted URL history");
    return { ...empty, reason: "publication-processing-failed" };
  }
}
