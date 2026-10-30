import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { cachedStatsChart } from "@/lib/stats-chart-cache";

function clock(start = 1_000_000) {
  let now = start;
  return { now: () => now, advance: (ms: number) => { now += ms; } };
}

describe("cachedStatsChart", () => {
  it("shares one load between concurrent requests and serves it until it expires", async () => {
    const time = clock();
    const load = vi.fn(async () => ({ points: 3 }));
    const results = await Promise.all([
      cachedStatsChart("dedupe", load, 1000, time.now),
      cachedStatsChart("dedupe", load, 1000, time.now),
      cachedStatsChart("dedupe", load, 1000, time.now)
    ]);
    expect(results).toEqual([{ points: 3 }, { points: 3 }, { points: 3 }]);
    time.advance(999);
    await cachedStatsChart("dedupe", load, 1000, time.now);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("returns null when nothing good has loaded yet", async () => {
    const failed = vi.fn(async () => {
      throw new Error("canceling statement due to statement timeout");
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(cachedStatsChart("never-good", failed)).resolves.toBeNull();
    await expect(cachedStatsChart("never-null", async () => null)).resolves.toBeNull();
    warn.mockRestore();
  });

  it("keeps serving the last good value while a failed refresh runs", async () => {
    const time = clock();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await cachedStatsChart("last-good", async () => "good", 1000, time.now);
    time.advance(1001);

    let failRefresh: (error: Error) => void = () => undefined;
    const refresh = vi.fn(() => new Promise<string | null>((_resolve, reject) => { failRefresh = reject; }));
    // Expired: the old value comes back at once and only one refresh starts.
    await expect(cachedStatsChart("last-good", refresh, 1000, time.now)).resolves.toBe("good");
    await expect(cachedStatsChart("last-good", refresh, 1000, time.now)).resolves.toBe("good");
    expect(refresh).toHaveBeenCalledTimes(1);

    failRefresh(new Error("canceling statement due to statement timeout"));
    await vi.waitFor(() => expect(warn).toHaveBeenCalledTimes(1));

    // The failure didn't replace the value, and the next call starts a new refresh.
    const nextRefresh = vi.fn(async () => null);
    await expect(cachedStatsChart("last-good", nextRefresh, 1000, time.now)).resolves.toBe("good");
    expect(nextRefresh).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("replaces the value after a successful refresh", async () => {
    const time = clock();
    await cachedStatsChart("refresh", async () => "old", 1000, time.now);
    time.advance(1001);
    await cachedStatsChart("refresh", async () => "new", 1000, time.now);
    await vi.waitFor(async () => {
      await expect(cachedStatsChart("refresh", async () => "unused", 1000, time.now)).resolves.toBe("new");
    });
  });
});


it("bounds variable per-game keys and reloads an evicted answer", async () => {
  const load = vi.fn(async () => "first");
  await cachedStatsChart("eviction-first", load);
  for (let i = 0; i < 2048; i++) await cachedStatsChart(`eviction:${i}`, async () => i);
  await cachedStatsChart("eviction-first", load);
  expect(load).toHaveBeenCalledTimes(2);
});

it("keeps a regularly refreshed key when newer keys fill the cache", async () => {
  const time = clock();
  const load = vi.fn(async () => "hot");
  await cachedStatsChart("refreshed-hot", load, 1000, time.now);
  for (let i = 0; i < 1000; i++) await cachedStatsChart(`refresh-before:${i}`, async () => i);
  time.advance(5000);
  // Expired: serves the stale value and refreshes it in the background.
  await cachedStatsChart("refreshed-hot", load, 1000, time.now);
  await new Promise(resolve => setTimeout(resolve, 0));
  for (let i = 0; i < 1500; i++) await cachedStatsChart(`refresh-after:${i}`, async () => i);
  await expect(cachedStatsChart("refreshed-hot", load, 1000, time.now)).resolves.toBe("hot");
  expect(load).toHaveBeenCalledTimes(2);
});
