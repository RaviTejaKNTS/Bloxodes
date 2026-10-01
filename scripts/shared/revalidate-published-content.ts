import { fetchWithTransientRetries } from "./transient-http";

type PublishedEvent = { type: "article" | "wiki" | "wiki_collection"; slug: string };

// Trusted publishers only: this secret comes from the protected production target.
export async function revalidatePublishedContent(env: NodeJS.ProcessEnv, events: PublishedEvent[]): Promise<void> {
  if (!env.REVALIDATE_SECRET) throw new Error("Production publication requires REVALIDATE_SECRET for immediate cache verification.");
  if (env.SUPABASE_URL !== "https://database.bloxodes.com") throw new Error("Immediate publication revalidation requires the production target.");
  if (!events.length || events.length > 100 || events.some(event => !/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?$/.test(event.slug))) {
    throw new Error("Publication revalidation requires 1-100 exact editorial slugs.");
  }
  const response = await fetchWithTransientRetries("https://bloxodes.com/api/revalidate", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.REVALIDATE_SECRET}`, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "batch", events }),
  });
  const result = await response.json() as { revalidated?: boolean; cloudflare?: { enabled?: boolean; ok?: boolean } };
  if (!result.revalidated || (result.cloudflare?.enabled && !result.cloudflare.ok)) {
    throw new Error("Published content cache revalidation did not complete successfully.");
  }
}
