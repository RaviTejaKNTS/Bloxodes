import test from "node:test";
import assert from "node:assert/strict";
import { fetchPlaceDetails } from "@/lib/roblox/universe";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

test("place lookup uses the public universe and game endpoints", async () => {
  const urls: string[] = [];
  const detail = await fetchPlaceDetails("6243699076", (async (url: string | URL) => {
    urls.push(String(url));
    if (String(url).startsWith("https://apis.roblox.com/universes/v1/places/6243699076/universe")) return json({ universeId: 2294168059 });
    if (String(url) === "https://games.roblox.com/v1/games?universeIds=2294168059") return json({ data: [{ id: 2294168059, rootPlaceId: 6243699076, name: "The Mimic" }] });
    return json({}, 401);
  }) as typeof fetch);
  assert.deepEqual(detail, { placeId: 6243699076, universeId: 2294168059, name: "The Mimic", rootPlaceId: 6243699076 });
  assert.ok(urls.every(url => !url.includes("multiget-place-details")));
});

test("place lookup returns null for a failed or mismatched lookup", async () => {
  assert.equal(await fetchPlaceDetails("1", (async () => json({ universeId: null })) as typeof fetch), null);
  assert.equal(await fetchPlaceDetails("1", (async () => json({}, 503)) as typeof fetch), null);
  assert.equal(await fetchPlaceDetails("1", (async (url: string | URL) =>
    String(url).includes("apis.roblox.com") ? json({ universeId: 5 }) : json({ data: [{ id: 6 }] })) as typeof fetch), null);
  assert.equal(await fetchPlaceDetails("abc", (async () => { throw new Error("no request expected"); }) as typeof fetch), null);
});
