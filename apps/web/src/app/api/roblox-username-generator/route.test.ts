import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

let requestNumber = 0;

function request(body: unknown) {
  requestNumber += 1;
  return new Request("https://bloxodes.com/api/roblox-username-generator", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://bloxodes.com",
      "x-forwarded-for": `198.51.100.${requestNumber}`
    },
    body: JSON.stringify(body)
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Roblox username generator API", () => {
  it("preserves a moderation rejection instead of calling an unused name available", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ code: 2, message: "Username not appropriate for Roblox" }), { status: 200 })));

    const response = await POST(request({ action: "check", username: "NextGenOpal" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.result.status).toBe("inappropriate");
    expect(payload.result.status).not.toBe("available");
  });

  it("uses exact lookup only to prove taken and never to infer availability", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("Unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request({ action: "check", username: "SafeSample42" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.result.status).toBe("unverified");
    expect(payload.result.status).not.toBe("available");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns only validator-approved names in a generated batch", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ code: 0, message: "Username is valid" }), { status: 200 })));

    const response = await POST(
      request({
        mode: "generate",
        keyword: "Nova",
        vibes: ["space"],
        minLength: 8,
        maxLength: 16,
        allowNumbers: true,
        allowUnderscore: false,
        mustIncludeKeyword: true,
        preference: "balanced",
        amount: 6
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.results).toHaveLength(6);
    expect(payload.results.every((result: { status: string }) => result.status === "available")).toBe(true);
    expect(payload.results.every((result: { username: string }) => result.username.toLowerCase().includes("nova"))).toBe(true);
  });

  it("rejects cross-origin batch use", async () => {
    const badRequest = new Request("https://bloxodes.com/api/roblox-username-generator", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://example.com" },
      body: JSON.stringify({ mode: "generate" })
    });

    const response = await POST(badRequest);
    expect(response.status).toBe(403);
  });
});
