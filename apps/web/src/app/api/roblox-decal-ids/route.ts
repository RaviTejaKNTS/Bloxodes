import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { normalizeCategorySlug } from "@/lib/decal-id-categories";
import { normalizeSearchQuery, normalizeSortKey, type DecalSortKey } from "@/lib/decal-ids-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;
const DECAL_SOURCE_TABLE = "roblox_decal_ids";
const BASE_SELECT_FIELDS =
  "asset_id, texture_id, name, description, creator_id, creator_type, creator_name, creator_verified, roblox_created_at, roblox_updated_at, is_public_domain, is_for_sale, price_in_robux, sales, purchasable, vote_count, upvote_percent, thumbnail_url, thumbnail_state, thumbnail_checked_at, source, first_seen_at, last_seen_at, verified_at, popularity_score, categories, primary_category, curated_score, curated_rank, curated_tier, curated_reason";

type OrderableQuery<T> = {
  order: (...args: any[]) => T;
};

function buildLoosePattern(value: string): string {
  const cleaned = value.replace(/[%_]/g, " ").trim();
  const pattern = cleaned.replace(/[^a-z0-9]+/gi, "%").replace(/%{2,}/g, "%");
  return `%${pattern}%`;
}

function normalizePage(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.floor(parsed);
}

function applySort<T extends OrderableQuery<T>>(query: T, sort: DecalSortKey): T {
  switch (sort) {
    case "popular":
      return query
        .order("vote_count", { ascending: false, nullsFirst: false })
        .order("popularity_score", { ascending: false, nullsFirst: false })
        .order("last_seen_at", { ascending: false, nullsFirst: false });
    case "newest":
      return query.order("roblox_created_at", { ascending: false, nullsFirst: false });
    case "oldest":
      return query.order("roblox_created_at", { ascending: true, nullsFirst: false });
    case "name_asc":
      return query.order("name", { ascending: true, nullsFirst: false });
    case "creator_asc":
      return query.order("creator_name", { ascending: true, nullsFirst: false });
    case "recommended":
    default:
      return query
        .order("curated_rank", { ascending: true, nullsFirst: false })
        .order("curated_score", { ascending: false, nullsFirst: false })
        .order("popularity_score", { ascending: false, nullsFirst: false })
        .order("last_seen_at", { ascending: false, nullsFirst: false });
  }
}

function normalizeBaseRows(rows: unknown[] | null) {
  return (rows ?? []).map((row) => {
    const decal = row as Record<string, unknown>;
    return {
      ...decal,
      thumbnail_ready: decal.thumbnail_state === "Completed" && Boolean(decal.thumbnail_url),
      age_bucket: null,
      source_count: null
    };
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = normalizePage(searchParams.get("page"));
  const search = normalizeSearchQuery(searchParams.get("q"));
  const sort = normalizeSortKey(searchParams.get("sort"));
  const section = searchParams.get("section");
  const category = normalizeCategorySlug(searchParams.get("category"));
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = supabaseAdmin();
  let query = supabase.from(DECAL_SOURCE_TABLE).select(BASE_SELECT_FIELDS, { count: "exact" });

  query = query
    .eq("status", "active")
    .eq("thumbnail_state", "Completed")
    .not("thumbnail_url", "is", null);

  if (section === "curated") {
    query = query.not("curated_rank", "is", null);
  }

  if (category) {
    query = query.contains("categories", [category]);
  }

  if (search) {
    const pattern = buildLoosePattern(search);
    const orParts = [
      `name.ilike.${pattern}`,
      `description.ilike.${pattern}`,
      `creator_name.ilike.${pattern}`
    ];
    if (/^\d+$/.test(search)) {
      orParts.unshift(`asset_id.eq.${search}`, `texture_id.eq.${search}`);
    }
    query = query.or(orParts.join(","));
  }

  if (section === "curated" && sort === "recommended") {
    query = query
      .order("curated_rank", { ascending: true, nullsFirst: false })
      .order("curated_score", { ascending: false, nullsFirst: false })
      .order("popularity_score", { ascending: false, nullsFirst: false });
  } else {
    query = applySort(query, sort);
  }

  const { data, error, count } = await query.range(offset, offset + PAGE_SIZE - 1);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const total = count ?? data?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return NextResponse.json({
    ok: true,
    decals: normalizeBaseRows(data),
    total,
    totalPages
  });
}
