import type { SupabaseClient } from "@supabase/supabase-js";

import { slugify } from "@/lib/slug";
import { groupingSimilarity } from "./article-curation-intent";
import { ARTICLE_TOPIC_DEDUPE_STATUSES } from "./article-queue-status";
import type { ProductionInventoryItem } from "./production-editorial-inventory";

/** Match the queue's article_generation_queue_idempotency_key trigger. */
export function articleQueueIdempotencyKey(title: string, universeId: number | null = null): string {
  return `${universeId ?? "global"}:${slugify(title)}`;
}

export function nearDuplicateArticleTitle(title: string, existingTitle: string): boolean {
  return groupingSimilarity(title, existingTitle).jaccard >= 0.8;
}

export function findProductionArticleDuplicate(
  title: string,
  inventory: ProductionInventoryItem[]
): ProductionInventoryItem | null {
  return inventory.find((item) => item.family === "article" && nearDuplicateArticleTitle(title, item.title)) ?? null;
}

/** Preserve curation's lookup order, status scope, and 1,000-row similarity scan. */
export async function findExistingQueueRow(
  supabase: SupabaseClient,
  topicKey: string,
  title: string,
  idempotencyKey = articleQueueIdempotencyKey(title)
): Promise<Record<string, unknown> | null> {
  for (const [column, value] of [
    ["topic_key", topicKey],
    ["idempotency_key", idempotencyKey]
  ] as const) {
    const { data, error } = await supabase
      .from("article_generation_queue")
      .select("id, article_title, source_urls, source_items, source_metadata, status")
      .eq("workflow_mode", "agent_runner")
      .eq(column, value)
      .in("status", ARTICLE_TOPIC_DEDUPE_STATUSES)
      .maybeSingle();
    if (error) throw new Error(`Could not check existing queue ${column}: ${error.message}`);
    if (data) return data as Record<string, unknown>;
  }

  const { data: queueRows, error: queueError } = await supabase
    .from("article_generation_queue")
    .select("id, article_title, topic_key, source_urls, source_items, source_metadata, status")
    .eq("workflow_mode", "agent_runner")
    .in("status", ARTICLE_TOPIC_DEDUPE_STATUSES)
    .limit(1000);
  if (queueError) throw new Error(`Could not check semantically similar queue topics: ${queueError.message}`);
  for (const row of queueRows ?? []) {
    const existingTitle = typeof row.article_title === "string" ? row.article_title : "";
    const existingKey = typeof row.topic_key === "string" ? row.topic_key : "";
    if (existingKey && existingKey === topicKey) return row as Record<string, unknown>;
    if (nearDuplicateArticleTitle(title, existingTitle)) return row as Record<string, unknown>;
  }
  return null;
}
