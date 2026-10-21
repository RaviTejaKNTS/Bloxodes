import { retryPublishNetwork, requirePublishResponse } from "./publish-network.mjs";

// Cover metadata only. Never use APIs to construct collection item datasets.
export async function officialUniverseCover(universeId: number, fetcher: typeof fetch = fetch): Promise<string | null> {
  if (!Number.isSafeInteger(universeId) || universeId <= 0) throw new Error("Invalid cover universe identity.");
  const payload = await retryPublishNetwork(async () => {
    const response = await fetcher(`https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${universeId}&size=768x432&format=Png&isCircular=false`, { signal: AbortSignal.timeout(30_000) });
    await requirePublishResponse(response, "Official universe cover");
    return response.json() as Promise<{ data?: Array<{ universeId: number; thumbnails?: Array<{ state: string; imageUrl?: string }> }> }>;
  });
  const url = payload.data?.find(row => row.universeId === universeId)?.thumbnails?.find(image => image.state === "Completed")?.imageUrl;
  if (!url) return null;
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !(parsed.hostname === "rbxcdn.com" || parsed.hostname.endsWith(".rbxcdn.com"))) {
    throw new Error("Official universe cover has an unexpected media origin.");
  }
  return url;
}
