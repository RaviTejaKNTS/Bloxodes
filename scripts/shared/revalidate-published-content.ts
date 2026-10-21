import { retryPublishNetwork, requirePublishResponse } from "./publish-network.mjs";
import type { PublicCacheEvent } from "@/lib/public-cache-tags";

type PublishedEvent = PublicCacheEvent;

// Trusted publishers only: this secret comes from the protected production target.
export async function revalidatePublishedContent(env: NodeJS.ProcessEnv, events: PublishedEvent[]): Promise<void> {
  if (!env.REVALIDATE_SECRET) throw new Error("Production publication requires REVALIDATE_SECRET for immediate cache verification.");
  if (env.SUPABASE_URL !== "https://database.bloxodes.com") throw new Error("Immediate publication revalidation requires the production target.");
  if (!events.length || events.length > 100 || events.some(event => !/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/.test(event.slug))) {
    throw new Error("Publication revalidation requires 1-100 exact editorial slugs.");
  }
  const result = await retryPublishNetwork(async () => {
    const response = await fetch("https://bloxodes.com/api/revalidate", {
      method: "POST",
      signal: AbortSignal.timeout(30_000),
      headers: { Authorization: `Bearer ${env.REVALIDATE_SECRET}`, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "batch", events }),
    });
    await requirePublishResponse(response, "Published content cache revalidation");
    return response.json() as Promise<{ revalidated?: boolean; cloudflare?: { enabled?: boolean; ok?: boolean } }>;
  });
  if (!result.revalidated || (result.cloudflare?.enabled && !result.cloudflare.ok)) {
    throw new Error("Published content cache revalidation did not complete successfully.");
  }
}
