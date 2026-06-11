import { supabaseAdmin } from "@/lib/supabase-admin";

export type RevalidationEvent = {
  type: string;
  slug: string;
};

export function normalizeRevalidationSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "");
}

export async function enqueueRevalidationEvents(events: RevalidationEvent[], source: string) {
  const createdAt = new Date().toISOString();
  const rows = Array.from(
    new Map(
      events
        .map((event) => ({ type: event.type, slug: normalizeRevalidationSlug(event.slug) }))
        .filter((event) => event.type && event.slug)
        .map((event) => [`${event.type}:${event.slug}`, event])
    ).values()
  ).map((event) => ({
    entity_type: event.type,
    slug: event.slug,
    source,
    created_at: createdAt
  }));

  if (!rows.length) return { queued: 0, events: [] as string[] };

  const { error } = await supabaseAdmin()
    .from("revalidation_events")
    .upsert(rows, { onConflict: "entity_type,slug" });
  if (error) throw error;

  return {
    queued: rows.length,
    events: rows.map((row) => `${row.entity_type}:${row.slug}`)
  };
}

