import type { MusicSortKey } from "@/lib/music-ids-search";
import type { DecalSortKey } from "@/lib/decal-ids-search";

type OrderableQuery<T> = { order: (...args: any[]) => T };

export function applyMusicSort<T extends OrderableQuery<T>>(query: T, sort: MusicSortKey, mapped = false): T {
  if (mapped && sort === "recommended") {
    return query.order("game_sort_order", { ascending: true })
      .order("popularity_score", { ascending: false, nullsFirst: false })
      .order("asset_id", { ascending: true });
  }
  return sortMusic(query, sort).order("asset_id", { ascending: true });
}

function sortMusic<T extends OrderableQuery<T>>(query: T, sort: MusicSortKey): T {
  switch (sort) {
    case "popular":
      return query
        .order("popularity_score", { ascending: false, nullsFirst: false })
        .order("last_seen_at", { ascending: false, nullsFirst: false });
    case "newest":
      return query.order("last_seen_at", { ascending: false, nullsFirst: false });
    case "duration_desc":
      return query
        .order("duration_seconds", { ascending: false, nullsFirst: false })
        .order("popularity_score", { ascending: false, nullsFirst: false });
    case "duration_asc":
      return query
        .order("duration_seconds", { ascending: true, nullsFirst: false })
        .order("popularity_score", { ascending: false, nullsFirst: false });
    case "title_asc":
      return query.order("title", { ascending: true, nullsFirst: false });
    case "artist_asc":
      return query.order("artist", { ascending: true, nullsFirst: false });
    case "recommended":
    default:
      return query
        .order("popularity_score", { ascending: false, nullsFirst: false })
        .order("last_seen_at", { ascending: false, nullsFirst: false })
        .order("duration_bucket", { ascending: true, nullsFirst: false })
        .order("duration_seconds", { ascending: false, nullsFirst: false })
        .order("rank", { ascending: true, nullsFirst: false });
  }
}

export function applyDecalSort<T extends OrderableQuery<T>>(query: T, sort: DecalSortKey, mapped = false): T {
  if (mapped && sort === "recommended") {
    return query.order("game_sort_order", { ascending: true })
      .order("popularity_score", { ascending: false, nullsFirst: false })
      .order("asset_id", { ascending: true });
  }
  return sortDecal(query, sort).order("asset_id", { ascending: true });
}

function sortDecal<T extends OrderableQuery<T>>(query: T, sort: DecalSortKey): T {
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
