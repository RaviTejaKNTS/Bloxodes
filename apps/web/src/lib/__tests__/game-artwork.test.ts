import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: () => db }));

// Import the reader without the registry or a React cache mock.
import { readGameArtwork } from "../game-artwork";

beforeEach(() => {
  vi.clearAllMocks();
  db.from.mockReturnValue(db);
  db.select.mockReturnValue(db);
  db.eq.mockReturnValue(db);
});

describe("owning game artwork", () => {
  it("only reads the published game in the requested namespace", async () => {
    const artwork = { cover_image: "https://media.bloxodes.com/cover.webp", hero_image: "/images/hero.webp" };
    db.maybeSingle.mockResolvedValue({ data: artwork, error: null });
    expect(await readGameArtwork("gta", "owner")).toEqual(artwork);
    expect(db.from).toHaveBeenCalledWith("games");
    expect(db.select).toHaveBeenCalledWith("cover_image,hero_image");
    expect(db.eq.mock.calls).toEqual([["namespace", "gta"], ["id", "owner"], ["is_published", true]]);
  });

  it("returns no artwork for a missing or unpublished game", async () => {
    db.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await readGameArtwork("gta", "missing")).toBeNull();
  });

  it("rejects placeholder and unsafe artwork instead of exposing it", async () => {
    db.maybeSingle.mockResolvedValue({ data: { cover_image: "/Bloxodes.png", hero_image: "javascript:alert(1)" }, error: null });
    expect(await readGameArtwork("gta", "owner")).toEqual({ cover_image: null, hero_image: null });
  });

  it("propagates database failures", async () => {
    db.maybeSingle.mockResolvedValue({ data: null, error: { message: "read failed" } });
    await expect(readGameArtwork("gta", "owner")).rejects.toThrow("Game artwork read failed: read failed");
  });
});
