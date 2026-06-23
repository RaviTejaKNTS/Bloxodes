import { supabaseAdmin } from "@/lib/supabase-admin";

export type StatsItemIndexRefreshResult = {
  items?: number;
  price_movers?: number;
  indexed_at?: string;
};

function errorSummary(error: unknown) {
  if (!error || typeof error !== "object") return String(error);
  const record = error as Record<string, unknown>;
  return [record.code, record.message, record.details].filter(Boolean).join(": ") || JSON.stringify(record);
}

async function refreshViaPostgresMeta(): Promise<StatsItemIndexRefreshResult> {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE;
  if (!supabaseUrl || !serviceRole) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE are required for postgres-meta item index refresh fallback.");
  }

  const response = await fetch(`${supabaseUrl}/pg/query`, {
    method: "POST",
    headers: {
      accept: "application/json",
      apikey: serviceRole,
      authorization: `Bearer ${serviceRole}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      query: "select public.refresh_stats_item_current_indexes() as result"
    })
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`postgres-meta item index refresh failed (${response.status}): ${text.slice(0, 500)}`);
  }

  const rows = JSON.parse(text) as Array<{ result?: StatsItemIndexRefreshResult }>;
  return rows[0]?.result ?? {};
}

export async function refreshStatsItemCurrentIndexes(): Promise<{ result: StatsItemIndexRefreshResult; method: "rpc" | "postgres-meta" }> {
  const { data, error } = await supabaseAdmin().rpc("refresh_stats_item_current_indexes");
  if (!error) {
    return { result: (data ?? {}) as StatsItemIndexRefreshResult, method: "rpc" };
  }

  console.warn(`Stats item index RPC failed; trying postgres-meta fallback: ${errorSummary(error)}`);
  return { result: await refreshViaPostgresMeta(), method: "postgres-meta" };
}
