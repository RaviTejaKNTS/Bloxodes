import { afterEach, describe, expect, it, vi } from "vitest";
import { loadQuizProgressIndex } from "@/lib/quiz-progress-client";

afterEach(() => { vi.unstubAllGlobals(); });

describe("quiz progress promise cache", () => {
  it.each(["network", "http", "json"])("retries a failed %s load and caches the successful retry", async (failure) => {
    const fetchMock = vi.fn();
    if (failure === "network") fetchMock.mockRejectedValueOnce(new Error("Network unavailable"));
    if (failure === "http") fetchMock.mockResolvedValueOnce(new Response("Unavailable", { status: 503 }));
    if (failure === "json") fetchMock.mockResolvedValueOnce(new Response("not JSON"));
    fetchMock.mockResolvedValueOnce(Response.json({ progress: [{ code: "TEST", lastScore: 12, lastTotal: 15 }] }));
    vi.stubGlobal("fetch", fetchMock);

    const endpoint = `/test-progress-${failure}`;
    expect(await loadQuizProgressIndex(endpoint)).toEqual({ status: "error" });
    const recovered = await loadQuizProgressIndex(endpoint);
    expect(recovered.status).toBe("ready");
    if (recovered.status === "ready") {
      expect(recovered.progress.get("test")).toEqual({ code: "test", lastScore: 12, lastTotal: 15 });
    }
    expect(await loadQuizProgressIndex(endpoint)).toBe(recovered);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shares a pending request between callers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ progress: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const [first, second] = await Promise.all([
      loadQuizProgressIndex("/test-shared-progress"), loadQuizProgressIndex("/test-shared-progress")
    ]);
    expect(first).toBe(second);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
