import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ page: vi.fn(), data: vi.fn() }));
vi.mock("@/lib/catalog", () => ({ getCatalogPageContentByCodes: mocks.page }));
vi.mock("@/lib/catalog-image-data", () => ({ loadCatalogImageData: mocks.data }));
vi.mock("node:fs/promises", () => ({ readFile: async () => Buffer.from("font") }));
vi.mock("next/og", () => ({ ImageResponse: class extends Response {
  constructor(_jsx: unknown, options: { headers: HeadersInit }) { super("image", options); }
} }));
import { GET } from "@/app/catalog-image/[...code]/route";

const request = new Request("https://bloxodes.com/catalog-image/roblox-decal-ids.png");
const context = { params: Promise.resolve({ code: ["roblox-decal-ids.png"] }) };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.page.mockResolvedValue({ code: "roblox-decal-ids", title: "Roblox Decal IDs" });
  mocks.data.mockResolvedValue({ type: "items", count: 38657, images: ["https://tr.rbxcdn.com/item.png"] });
});

describe("catalog image failures", () => {
  it("turns thrown catalog reads into uncached 500s", async () => {
    mocks.page.mockRejectedValue(new Error("database unavailable"));
    const result = await GET(request, context);
    expect(result.status).toBe(500);
    expect(result.headers.get("Cache-Control")).toBe("no-store");
  });
  it("turns thrown dataset and artwork reads into uncached 500s", async () => {
    mocks.data.mockRejectedValue(new Error("dataset unavailable"));
    const result = await GET(request, context);
    expect(result.status).toBe(500);
    expect(result.headers.get("Cache-Control")).toBe("no-store");
  });
  it("renders 200 when a remote thumbnail fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));
    try {
      const result = await GET(request, context);
      expect(result.status).toBe(200);
      expect(result.headers.get("Cache-Control")).toBe("public, max-age=3600, s-maxage=21600");
      expect(result.headers.get("Cache-Tag")).toContain("catalog:roblox-decal-ids");
    } finally { vi.unstubAllGlobals(); }
  });
  it("does not cache a missing published catalog", async () => {
    mocks.page.mockResolvedValue(null);
    const result = await GET(request, context);
    expect(result.status).toBe(404);
    expect(result.headers.get("Cache-Control")).toBe("no-store");
  });
});

it.each([
  ["roblox-decal-ids"], ["bad.png.png"], ["Upper.png"], ["..", "x.png"],
  ["a", "b", "c", "d", "e.png"], ["x".repeat(201) + ".png"]
])("rejects invalid cover path %s without reading the database", async (...code) => {
  const result = await GET(request, { params: Promise.resolve({ code }) });
  expect(result.status).toBe(404);
  expect(result.headers.get("Cache-Control")).toBe("no-store");
  expect(mocks.page).not.toHaveBeenCalled();
});
it("uses canonical and legacy free-item candidates for covers", async () => {
  mocks.page.mockResolvedValue({ code: "roblox-free-items", title: "Free items" });
  const result = await GET(request, { params: Promise.resolve({ code: ["free-roblox-items.png"] }) });
  expect(result.status).toBe(200);
  expect(mocks.page).toHaveBeenCalledWith(["free-roblox-items", "roblox-free-items"]);
});
it("resolves legacy category candidates for covers", async () => {
  const result = await GET(request, { params: Promise.resolve({ code: ["free-roblox-items", "hats.png"] }) });
  expect(result.status).toBe(200);
  expect(mocks.page).toHaveBeenCalledWith(["free-roblox-items/hats", "roblox-free-items/hats"]);
});
